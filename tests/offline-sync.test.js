// Kiểm thử tính năng Chạy ngoại tuyến (Offline-First) và Hàng đợi tự động đồng bộ (Sync Queue / Outbox Pattern).
const {
  Storage,
  LS_KEYS,
  LS_SYNC_QUEUE_KEY,
  lsSyncQueueGet,
  lsSyncQueueSet,
  enqueueSyncOp,
  isNetworkError,
  executeRemoteSyncItem,
} = require("../storage");

// Mock đơn giản cho localStorage trong môi trường Node.js
function createLocalStorageMock() {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

describe("Cơ chế phát hiện lỗi mạng (isNetworkError)", () => {
  test("nhận diện đúng các lỗi mạng phổ biến của trình duyệt", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(isNetworkError(new Error("The network connection was lost."))).toBe(true);
    expect(isNetworkError(new Error("net::ERR_CONNECTION_REFUSED"))).toBe(true);
    expect(isNetworkError(new Error("net::ERR_NAME_NOT_RESOLVED"))).toBe(true);
    expect(isNetworkError(new Error("The user is offline"))).toBe(true);
    expect(isNetworkError(new Error("Request timeout"))).toBe(true);
  });

  test("không nhầm lẫn lỗi nghiệp vụ hoặc server 4xx/5xx thành lỗi mạng", () => {
    expect(isNetworkError(new Error("Sai mật khẩu hoặc tài khoản không tồn tại."))).toBe(false);
    expect(isNetworkError(new Error("Token phiên đăng nhập không hợp lệ hoặc đã hết hạn."))).toBe(false);
    expect(isNetworkError(new Error("Bản ghi thiếu trường bắt buộc: thiet_bi"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("Hàng đợi đồng bộ (Sync Queue / Outbox)", () => {
  beforeEach(() => {
    global.localStorage = createLocalStorageMock();
    global.navigator = { onLine: true };
    Storage.clearSyncQueue();
  });

  test("thêm tác vụ vào hàng đợi và lấy ra đúng thứ tự FIFO", () => {
    const item1 = enqueueSyncOp("addMeasurement", { record: { id: "m1", tram: "TBA 500kV", h2: 10 } });
    const item2 = enqueueSyncOp("deleteMeasurement", { id: "m2" });

    const queue = lsSyncQueueGet();
    expect(queue).toHaveLength(2);
    expect(queue[0].id).toBe(item1.id);
    expect(queue[0].action).toBe("addMeasurement");
    expect(queue[0].payload.record.id).toBe("m1");
    expect(queue[1].id).toBe(item2.id);
    expect(queue[1].action).toBe("deleteMeasurement");
  });

  test("Storage.getSyncStatus phản ánh đúng số lượng mục chờ đồng bộ", () => {
    expect(Storage.getSyncStatus().pendingCount).toBe(0);
    enqueueSyncOp("addOilTest", { record: { id: "ot1", bdv: 65 } });
    expect(Storage.getSyncStatus().pendingCount).toBe(1);
    enqueueSyncOp("saveStandard", { record: { id: "s1", manufacturer: "ABB" } });
    expect(Storage.getSyncStatus().pendingCount).toBe(2);

    Storage.clearSyncQueue();
    expect(Storage.getSyncStatus().pendingCount).toBe(0);
  });

  test("người nghe (listener) nhận được thông báo khi trạng thái đồng bộ thay đổi", () => {
    const events = [];
    Storage.onSyncStatusChange((st) => {
      events.push(st.pendingCount);
    });

    enqueueSyncOp("addMeasurement", { record: { id: "m1" } });
    enqueueSyncOp("addMeasurement", { record: { id: "m2" } });
    Storage.clearSyncQueue();

    expect(events).toContain(1);
    expect(events).toContain(2);
    expect(events[events.length - 1]).toBe(0);
  });
});

describe("Hành vi đọc/ghi Offline-First của Storage", () => {
  beforeEach(() => {
    global.localStorage = createLocalStorageMock();
    global.navigator = { onLine: true };
    Storage.clearSyncQueue();
  });

  test("ở chế độ local: lưu và đọc ngay lập tức từ localStorage", async () => {
    Storage.mode = "local";
    const record = await Storage.addMeasurement({
      tram: "Trạm 220kV Hà Đông",
      thiet_bi: "AT1",
      equipment_type: "MBA",
      sample_date: "2026-10-31",
      h2: 12,
    });

    expect(record.id).toBeDefined();
    expect(record.tram).toBe("Trạm 220kV Hà Đông");

    const list = await Storage.listMeasurements();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(record.id);

    await Storage.deleteMeasurement(record.id);
    const afterDelete = await Storage.listMeasurements();
    expect(afterDelete).toHaveLength(0);
  });

  test("khi offline (!navigator.onLine): ghi ngay vào local và tự đưa vào Sync Queue", async () => {
    Storage.mode = "gsheet"; // Đang ở chế độ kết nối database
    global.navigator = { onLine: false }; // Mất mạng / Ngoại tuyến tại trạm

    const record = await Storage.addMeasurement({
      tram: "Trạm 500kV Phố Nối",
      thiet_bi: "AT2",
      equipment_type: "MBA",
      sample_date: "2026-10-31",
      h2: 25,
      ch4: 15,
    });

    // 1. Phải trả về bản ghi thành công (không ném lỗi mạng chặn người dùng)
    expect(record.id).toBeDefined();
    expect(record.h2).toBe(25);

    // 2. Dữ liệu đã có sẵn trong bộ nhớ cục bộ để hiển thị ngay trên bảng lịch sử
    const localData = JSON.parse(global.localStorage.getItem(LS_KEYS.measurements) || "[]");
    expect(localData).toHaveLength(1);
    expect(localData[0].id).toBe(record.id);

    // 3. Tác vụ đã được lưu an toàn vào hàng đợi dga_sync_queue_v1
    const queue = lsSyncQueueGet();
    expect(queue).toHaveLength(1);
    expect(queue[0].action).toBe("addMeasurement");
    expect(queue[0].payload.record.id).toBe(record.id);
  });

  test("khi mất mạng lúc đọc (list*): tự động fallback về bộ nhớ đệm cục bộ thay vì lỗi", async () => {
    Storage.mode = "gsheet";
    global.navigator = { onLine: false }; // Đang ngoại tuyến

    // Đã có sẵn 2 bản ghi lưu trong cache từ lần đồng bộ trước
    const cachedRecords = [
      { id: "m1", tram: "Trạm 500kV Thường Tín", thiet_bi: "AT1", sample_date: "2026-10-01" },
      { id: "m2", tram: "Trạm 500kV Thường Tín", thiet_bi: "AT2", sample_date: "2026-10-15" },
    ];
    global.localStorage.setItem(LS_KEYS.measurements, JSON.stringify(cachedRecords));

    // Gọi đọc dữ liệu: hàm không văng exception mà trả về bản ghi cached
    const res = await Storage.listMeasurements();
    expect(res).toHaveLength(2);
    expect(res[0].id).toBe("m1");
    expect(res[1].id).toBe("m2");
  });
});

describe("Bộ xử lý đồng bộ tự động (processSyncQueue)", () => {
  beforeEach(() => {
    global.localStorage = createLocalStorageMock();
    global.navigator = { onLine: true };
    Storage.clearSyncQueue();
  });

  test("không làm gì nếu hàng đợi rỗng", async () => {
    Storage.mode = "gsheet";
    const res = await Storage.processSyncQueue();
    expect(res.processed).toBe(0);
    expect(res.pending).toBe(0);
  });

  test("không gửi nếu đang offline", async () => {
    Storage.mode = "gsheet";
    global.navigator = { onLine: false };
    enqueueSyncOp("addMeasurement", { record: { id: "m1" } });

    const res = await Storage.processSyncQueue();
    expect(res.offline).toBe(true);
    expect(res.pending).toBe(1);
    expect(lsSyncQueueGet()).toHaveLength(1);
  });
});
