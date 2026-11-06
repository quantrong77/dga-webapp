// Test ĐẶC TẢ hành vi hiện tại của các hàm CRUD trong window.Storage (REFACTOR_PLAN Bước 4.1) — viết TRƯỚC khi gom các
// hàm list/add/save/delete về 1 khuôn chung, để bảo đảm refactor không đổi hành vi dù chỉ 1 chi tiết.
//
// Mỗi hàm × mỗi tình huống (chế độ local / Google Sheets-on-premise / Supabase; online, offline, lỗi mạng, lỗi khác, …)
// ghi lại MỌI tác động quan sát được: giá trị trả về, lỗi ném ra, lời gọi gsheetGet/gsheetPost (tham số), chuỗi lời gọi
// Supabase (bảng, select/order/insert/upsert/delete/eq + tham số), nội dung localStorage, hàng đợi đồng bộ,
// notifySyncStatus (qua onSyncStatusChange) và console.warn. Kết quả so với tests/fixtures/storage-characterization.json
// (ghi lại từ code TRƯỚC refactor). Cập nhật mốc CHỈ khi cố ý đổi hành vi: STORAGE_CHAR_UPDATE=1 npx jest storage-characterization
const fs = require("fs");
const path = require("path");
const storageMod = require("../src/data/storage");
const { Storage, LS_KEYS, LS_SYNC_QUEUE_KEY } = storageMod;

const FIXTURE = path.join(__dirname, "fixtures", "storage-characterization.json");
const FIXED_NOW = new Date("2026-11-06T08:00:00.000Z");

function createLocalStorageMock() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    dump: () => ({ ...store }),
  };
}

/** Supabase giả: ghi lại chuỗi lời gọi; kết quả lấy từ hàng đợi `responses` (mỗi lần await 1 phần tử). */
function createSupabaseMock(responses, calls) {
  return () => ({
    from(table) {
      const chain = [{ from: table }];
      calls.push(chain);
      const builder = {
        then(resolve, reject) {
          const r = responses.length ? responses.shift() : { data: null, error: null };
          if (r instanceof Error) return Promise.reject(r).then(resolve, reject);
          return Promise.resolve(r).then(resolve, reject);
        },
      };
      for (const op of ["select", "order", "insert", "upsert", "delete", "eq"]) {
        builder[op] = (...args) => {
          chain.push({ [op]: JSON.parse(JSON.stringify(args)) });
          return builder;
        };
      }
      return builder;
    },
  });
}

const SEED = {
  measurements: [{ id: "m_old", tram: "T1", h2: 1 }, { id: "m_edit", tram: "T2", h2: 2, created_at: "2025-01-01T00:00:00.000Z" }],
  standards: [{ id: "s_old", manufacturer: "A" }],
  stations: [{ id: "st_old", TenTram: "T1" }],
  oilTests: [{ id: "o_old" }],
  oltcOilTests: [{ id: "ol_old" }],
  instrumentOilTests: [{ id: "i_old" }, { id: "i_edit", created_at: "2025-02-02T00:00:00.000Z" }],
  feedback: [{ id: "f_old" }],
  regulationConfig: [{ id: "BANG64_MBA", citation: "c", values_json: "{\"a\":1}" }, { id: "BAD", values_json: "{không phải json" }],
};

const NET_ERR = () => new TypeError("Failed to fetch");
const BIZ_ERR = () => new Error("Lỗi nghiệp vụ từ máy chủ");

// onSyncStatusChange() không có hủy đăng ký → chỉ gắn 1 listener cho cả bộ test, ghi vào tình huống đang chạy.
let currentStatuses = null;
Storage.onSyncStatusChange((s) => {
  if (currentStatuses) currentStatuses.push({ online: s.online, pendingCount: s.pendingCount });
});

/** Chạy 1 tình huống và trả về toàn bộ tác động quan sát được. */
async function runCase({ mode, online = true, gsGet, gsPost, sbResponses = [], call }) {
  const ls = createLocalStorageMock();
  global.localStorage = ls;
  for (const [k, rows] of Object.entries(SEED)) ls.setItem(LS_KEYS[k], JSON.stringify(rows));
  global.navigator = { onLine: online };
  Storage.mode = mode;

  const gsCalls = [];
  const sbCalls = [];
  const statuses = [];
  const warns = [];
  let seq = 0;
  global.uid = () => `uid_${++seq}`;
  global.gsheetGet = async (action, params) => {
    gsCalls.push({ get: action, params: params === undefined ? null : params });
    if (gsGet instanceof Error) throw gsGet;
    return typeof gsGet === "function" ? gsGet(action) : gsGet;
  };
  global.gsheetPost = async (action, body) => {
    gsCalls.push({ post: action, body: JSON.parse(JSON.stringify(body)) });
    if (gsPost instanceof Error) throw gsPost;
    return typeof gsPost === "function" ? gsPost(action) : gsPost;
  };
  global.sb = createSupabaseMock([...sbResponses], sbCalls);
  currentStatuses = statuses;
  const warnSpy = jest.spyOn(console, "warn").mockImplementation((...a) => warns.push(String(a[0]).slice(0, 80)));

  let ret;
  let err = null;
  try {
    ret = await call();
  } catch (e) {
    err = e && e.message;
  } finally {
    warnSpy.mockRestore();
    currentStatuses = null;
  }
  const dump = ls.dump();
  const lsOut = {};
  for (const [k, key] of Object.entries(LS_KEYS)) {
    const now = dump[key] ? JSON.parse(dump[key]) : null;
    if (JSON.stringify(now) !== JSON.stringify(SEED[k] || null)) lsOut[k] = now;
  }
  const queue = dump[LS_SYNC_QUEUE_KEY] ? JSON.parse(dump[LS_SYNC_QUEUE_KEY]).map((q) => ({ action: q.action, payload: q.payload })) : [];
  return { ret: ret === undefined ? "<undefined>" : ret, err, gsCalls, sbCalls, ls: lsOut, queue, statuses, warns };
}

// ---- Bộ tình huống ----
const listScenarios = [
  ["local", { mode: "local" }],
  ["gsheet ok", { mode: "gsheet", gsGet: [{ id: "srv1" }] }],
  ["gsheet null", { mode: "gsheet", gsGet: null }],
  ["local-server ok", { mode: "local-server", gsGet: [{ id: "srv1" }] }],
  ["gsheet lỗi mạng", { mode: "gsheet", gsGet: NET_ERR() }],
  ["gsheet lỗi khác", { mode: "gsheet", gsGet: BIZ_ERR() }],
  ["supabase ok", { mode: "supabase", sbResponses: [{ data: [{ id: "sb1" }], error: null }] }],
  ["supabase null", { mode: "supabase", sbResponses: [{ data: null, error: null }] }],
  ["supabase lỗi mạng", { mode: "supabase", sbResponses: [NET_ERR()] }],
  ["supabase error object", { mode: "supabase", sbResponses: [{ data: null, error: { message: "permission denied" } }] }],
];
const writeScenarios = [
  ["local", { mode: "local" }],
  ["gsheet ok", { mode: "gsheet", gsPost: { id: "srv", ok: true } }],
  ["gsheet trả null", { mode: "gsheet", gsPost: null }],
  ["local-server ok", { mode: "local-server", gsPost: { id: "srv", ok: true } }],
  ["gsheet offline", { mode: "gsheet", online: false }],
  ["gsheet lỗi mạng", { mode: "gsheet", gsPost: NET_ERR() }],
  ["gsheet lỗi khác", { mode: "gsheet", gsPost: BIZ_ERR() }],
  ["supabase ok", { mode: "supabase", sbResponses: [{ data: [{ id: "sbrow", fromServer: true }], error: null }] }],
  ["supabase rỗng", { mode: "supabase", sbResponses: [{ data: [], error: null }] }],
  ["supabase offline", { mode: "supabase", online: false }],
  ["supabase lỗi mạng", { mode: "supabase", sbResponses: [NET_ERR()] }],
  ["supabase error object", { mode: "supabase", sbResponses: [{ data: null, error: { message: "duplicate key" } }] }],
];

const METHODS = {
  listMeasurements: [listScenarios, () => Storage.listMeasurements()],
  listStandards: [listScenarios, () => Storage.listStandards()],
  listRegulationConfig: [
    [...listScenarios, ["gsheet values_json", { mode: "gsheet", gsGet: [{ id: "X", citation: "", values_json: "{\"k\":[1,2]}", updated_by: "a", updated_at: "t" }] }]],
    () => Storage.listRegulationConfig(),
  ],
  listStations: [listScenarios, () => Storage.listStations()],
  listOilTests: [listScenarios, () => Storage.listOilTests()],
  listOltcOilTests: [listScenarios, () => Storage.listOltcOilTests()],
  listInstrumentOilTests: [listScenarios, () => Storage.listInstrumentOilTests()],
  listFeedback: [listScenarios, () => Storage.listFeedback()],

  "addMeasurement (mới)": [writeScenarios, () => Storage.addMeasurement({ tram: "TBA X", H2: 5, CH4: 1 })],
  "addMeasurement (sửa)": [writeScenarios, () => Storage.addMeasurement({ id: "m_edit", tram: "T2", h2: 9, created_at: "2025-01-01T00:00:00.000Z" })],
  saveStandard: [writeScenarios, () => Storage.saveStandard({ manufacturer: "B" })],
  "saveStandard (sửa)": [writeScenarios, () => Storage.saveStandard({ id: "s_old", manufacturer: "A2" })],
  saveStation: [writeScenarios, () => Storage.saveStation({ TenTram: "T9" })],
  saveRegulationConfig: [writeScenarios, () => Storage.saveRegulationConfig({ id: "BANG64_MBA", citation: "QĐ", values: { a: 2 } })],
  "saveRegulationConfig (mới, thiếu citation)": [writeScenarios, () => Storage.saveRegulationConfig({ id: "NEW_TABLE" })],
  addOilTest: [writeScenarios, () => Storage.addOilTest({ thiet_bi: "MBA1" })],
  "addOilTest (device_info)": [
    [
      ...writeScenarios,
      ["supabase thiếu cột device_info", { mode: "supabase", sbResponses: [{ data: null, error: { message: 'column "device_info" does not exist' } }, { data: [{ id: "retry" }], error: null }] }],
    ],
    () => Storage.addOilTest({ thiet_bi: "MBA1", device_info: "{\"hang\":\"X\"}" }),
  ],
  addOltcOilTest: [writeScenarios, () => Storage.addOltcOilTest({ thiet_bi: "OLTC1" })],
  addInstrumentOilTest: [writeScenarios, () => Storage.addInstrumentOilTest({ thiet_bi: "TI1" })],
  "addInstrumentOilTest (sửa)": [writeScenarios, () => Storage.addInstrumentOilTest({ id: "i_edit", thiet_bi: "TI1", created_at: "2025-02-02T00:00:00.000Z" })],
  addFeedback: [writeScenarios, () => Storage.addFeedback({ noi_dung: "góp ý" })],

  deleteMeasurement: [writeScenarios, () => Storage.deleteMeasurement("m_old")],
  deleteStandard: [writeScenarios, () => Storage.deleteStandard("s_old")],
  deleteRegulationConfig: [writeScenarios, () => Storage.deleteRegulationConfig("BANG64_MBA")],
  deleteStation: [writeScenarios, () => Storage.deleteStation("st_old")],
  deleteOilTest: [writeScenarios, () => Storage.deleteOilTest("o_old")],
  deleteOltcOilTest: [writeScenarios, () => Storage.deleteOltcOilTest("ol_old")],
  deleteInstrumentOilTest: [writeScenarios, () => Storage.deleteInstrumentOilTest("i_old")],
  deleteFeedback: [writeScenarios, () => Storage.deleteFeedback("f_old")],
};

const saved = {
  uid: global.uid, gsheetGet: global.gsheetGet, gsheetPost: global.gsheetPost, sb: global.sb,
  localStorage: global.localStorage, navigator: global.navigator, mode: Storage.mode,
};
let randomSpy;
beforeAll(() => {
  jest.useFakeTimers({ now: FIXED_NOW, doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.123456789);
});
afterAll(() => {
  jest.useRealTimers();
  randomSpy.mockRestore();
  Object.assign(global, { uid: saved.uid, gsheetGet: saved.gsheetGet, gsheetPost: saved.gsheetPost, sb: saved.sb, localStorage: saved.localStorage, navigator: saved.navigator });
  Storage.mode = saved.mode;
});

const results = {};
const expected = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, "utf8")) : null;

describe("Storage — đặc tả hành vi CRUD (không được đổi khi refactor)", () => {
  test.each(Object.keys(METHODS))("%s", async (name) => {
    const [scenarios, call] = METHODS[name];
    const out = {};
    for (const [label, sc] of scenarios) out[label] = await runCase({ ...sc, call });
    results[name] = out;
    if (!process.env.STORAGE_CHAR_UPDATE) {
      expect(expected).not.toBeNull();
      expect(JSON.parse(JSON.stringify(out))).toEqual(expected[name]);
    }
  });

  afterAll(() => {
    if (process.env.STORAGE_CHAR_UPDATE) {
      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
      fs.writeFileSync(FIXTURE, JSON.stringify(results, null, 1) + "\n");
    }
  });
});
