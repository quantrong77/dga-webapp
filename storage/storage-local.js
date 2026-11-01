/* storage/storage-local.js — Thao tác lưu trữ cục bộ (localStorage) cho dữ liệu và file đính kèm thử nghiệm. */

const LS_BBTN_KEY = "dga_bbtn_files_v1";
const MAX_LOCAL_BBTN_BYTES = 4 * 1024 * 1024; // 4MB — dè dặt hơn nhiều so với hạn mức chung của localStorage

function lsBbtnGetAll() {
  try {
    const raw = localStorage.getItem(LS_BBTN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("localStorage read failed (bbtn)", e);
    return {};
  }
}

function lsBbtnSetAll(map) {
  try {
    localStorage.setItem(LS_BBTN_KEY, JSON.stringify(map));
  } catch (e) {
    // Thường gặp nhất: QuotaExceededError khi tổng dữ liệu vượt hạn mức trình duyệt —
    // ném lại lỗi rõ ràng để app.js hiển thị cho người dùng thay vì âm thầm mất file.
    throw new Error("Không lưu được file vào bộ nhớ trình duyệt (có thể đã đầy dung lượng cho phép): " + ((e && e.message) || e));
  }
}

function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("localStorage read failed", e);
    return [];
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("localStorage write failed", e);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LS_BBTN_KEY,
    MAX_LOCAL_BBTN_BYTES,
    lsBbtnGetAll,
    lsBbtnSetAll,
    lsGet,
    lsSet,
  };
}
