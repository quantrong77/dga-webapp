// Lỗi #5 (docs/refactor/BUGS_FOUND.md): hàng đợi đồng bộ ngoại tuyến phải GỬI THẬT lên máy chủ ở MỌI chế độ dùng
// giao thức Apps Script (Google Sheets "gsheet" và máy chủ on-premise "local-server"). Trước khi sửa,
// executeRemoteSyncItem() chỉ có nhánh "gsheet"/"supabase": ở "local-server" mục trong hàng đợi bị coi là "đã đồng
// bộ" (hàm trả undefined, processSyncQueue() xóa mục) mà không có lời gọi nào tới máy chủ → mất bản ghi.
const { Storage, lsSyncQueueGet, enqueueSyncOp } = require("../src/data/storage");

function createLocalStorageMock() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

const realGsheetPost = global.gsheetPost;
// executeRemoteSyncItem() đọc chế độ qua biến toàn cục Storage (trình duyệt: const Storage của app). Node 24 có sẵn
// lớp Web Storage tên "Storage" nên phải gán đối tượng của app vào global để test đúng như trên trình duyệt.
const realStorageGlobal = global.Storage;
let sent;

beforeEach(() => {
  global.localStorage = createLocalStorageMock();
  global.navigator = { onLine: true };
  global.Storage = Storage;
  Storage.clearSyncQueue();
  sent = [];
  global.gsheetPost = async (action, body) => {
    sent.push({ action, body });
    if (action === "uploadAttachment") return { url: "/api/files/2026/11/abcd1234_bbtn.pdf", name: "bbtn.pdf", id: "f1" };
    return { ok: true };
  };
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  global.gsheetPost = realGsheetPost;
  global.Storage = realStorageGlobal;
  console.error.mockRestore();
});

// Mọi action mà Storage.* có thể đưa vào hàng đợi (repoRemoteWrite + uploadAttachment)
const ACTIONS = [
  ["addMeasurement", { record: { id: "m1", thiet_bi: "MBA-1", h2: 10 } }],
  ["deleteMeasurement", { id: "m2" }],
  ["saveStandard", { record: { id: "s1" } }],
  ["deleteStandard", { id: "s2" }],
  ["saveStation", { record: { id: "st1" } }],
  ["deleteStation", { id: "st2" }],
  ["addOilTest", { record: { id: "o1" } }],
  ["deleteOilTest", { id: "o2" }],
  ["addOltcOilTest", { record: { id: "ot1" } }],
  ["deleteOltcOilTest", { id: "ot2" }],
  ["addInstrumentOilTest", { record: { id: "i1" } }],
  ["deleteInstrumentOilTest", { id: "i2" }],
  ["saveRegulationConfig", { record: { key: "BANG64_MBA" } }],
  ["deleteRegulationConfig", { key: "BANG64_MBA" }],
  ["addFeedback", { record: { id: "fb1" } }],
  ["deleteFeedback", { id: "fb2" }],
];

describe.each(["gsheet", "local-server"])("Hàng đợi đồng bộ — chế độ %s gửi thật lên máy chủ", (mode) => {
  beforeEach(() => { Storage.mode = mode; });

  test("mọi action trong hàng đợi được gửi đúng tên + đúng dữ liệu, theo thứ tự, rồi mới rời hàng đợi", async () => {
    ACTIONS.forEach(([a, p]) => enqueueSyncOp(a, p));
    const res = await Storage.processSyncQueue();
    expect(sent.map((s) => s.action)).toEqual(ACTIONS.map(([a]) => a));
    expect(sent.map((s) => s.body)).toEqual(ACTIONS.map(([, p]) => p));
    expect(res).toEqual({ processed: ACTIONS.length, pending: 0 });
    expect(lsSyncQueueGet()).toHaveLength(0);
  });

  test("lưu lúc mất mạng → hàng đợi → có mạng lại: bản ghi được gửi (kịch bản lỗi #5)", async () => {
    global.navigator = { onLine: false };
    await Storage.addMeasurement({ tram: "T", thiet_bi: "MBA-OFFLINE", h2: 1 });
    expect(lsSyncQueueGet()).toHaveLength(1);
    expect(sent).toHaveLength(0);

    global.navigator = { onLine: true };
    const res = await Storage.processSyncQueue();
    expect(res.processed).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].action).toBe("addMeasurement");
    expect(sent[0].body.record.thiet_bi).toBe("MBA-OFFLINE");
  });

  test("tải file đính kèm từ hàng đợi rồi gắn link vào lần đo", async () => {
    enqueueSyncOp("uploadAttachment", { measurementId: "m9", filename: "bbtn.pdf", base64: "AAAA" });
    await Storage.processSyncQueue();
    expect(sent.map((s) => s.action)).toEqual(["uploadAttachment", "addMeasurement"]);
    expect(sent[1].body.record).toMatchObject({ id: "m9", bbtn_url: "/api/files/2026/11/abcd1234_bbtn.pdf", bbtn_name: "bbtn.pdf" });
  });

  test("máy chủ báo lỗi mạng giữa chừng: mục chưa gửi được GIỮ LẠI trong hàng đợi", async () => {
    enqueueSyncOp("addMeasurement", { record: { id: "a" } });
    enqueueSyncOp("addMeasurement", { record: { id: "b" } });
    let n = 0;
    global.gsheetPost = async (action, body) => {
      if (++n === 2) throw new TypeError("Failed to fetch");
      sent.push({ action, body });
      return { ok: true };
    };
    const res = await Storage.processSyncQueue();
    expect(res).toEqual({ processed: 1, pending: 1 });
    expect(lsSyncQueueGet()[0].payload.record.id).toBe("b");
  });
});

describe("Action lạ trong hàng đợi không được coi là đã đồng bộ", () => {
  test.each(["gsheet", "local-server"])("chế độ %s: action không hỗ trợ → báo lỗi, giữ lại, không gửi", async (mode) => {
    Storage.mode = mode;
    enqueueSyncOp("actionKhongTonTai", { id: "x" });
    const res = await Storage.processSyncQueue();
    expect(res.processed).toBe(0);
    expect(res.pending).toBe(1);
    expect(sent).toHaveLength(0);
    expect(lsSyncQueueGet()[0].retries).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });
});
