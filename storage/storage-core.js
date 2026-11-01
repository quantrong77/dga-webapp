/* storage/storage-core.js — Hằng số, hàm tiện ích lõi và kết nối cơ sở cho tầng Storage. */

const LS_KEYS = {
  measurements: "dga_measurements_v1",
  standards: "dga_manufacturer_standards_v1",
  stations: "dga_stations_v1",
  oilTests: "dga_oil_tests_v1",
  oltcOilTests: "dga_oltc_oil_tests_v1",
  instrumentOilTests: "dga_instrument_oil_tests_v1",
  feedback: "dga_feedback_v1",
  regulationConfig: "dga_regulation_config_v1",
};

// Tên các khí — dùng để chuẩn hóa key về chữ thường (h2, ch4, ...) khi lưu, khớp với
// tên cột trong Supabase/Google Sheets. Phía đọc (app.js) đã tự chấp nhận cả 2 kiểu
// (rec.H2 ?? rec.h2) nên việc chuẩn hóa 1 chiều này không phá dữ liệu cũ.
const GAS_KEYS = ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2"];

function normalizeGasKeys(record) {
  const out = { ...record };
  GAS_KEYS.forEach((g) => {
    if (out[g] !== undefined) {
      out[g.toLowerCase()] = out[g];
      delete out[g];
    }
  });
  return out;
}

function hasLocalServerConfig() {
  return (
    typeof window !== "undefined" &&
    window.DGA_CONFIG &&
    Boolean(window.DGA_CONFIG.LOCAL_SERVER_URL)
  );
}

function hasSupabaseConfig() {
  return (
    typeof window !== "undefined" &&
    window.DGA_CONFIG &&
    window.DGA_CONFIG.SUPABASE_URL &&
    window.DGA_CONFIG.SUPABASE_ANON_KEY &&
    window.supabase
  );
}

function hasGsheetConfig() {
  return (
    typeof window !== "undefined" &&
    window.DGA_CONFIG &&
    window.DGA_CONFIG.GSHEET_WEBAPP_URL
  );
}

/** URL "quản lý database" để Admin bấm vào badge #storageBadge ở header mở nhanh
 *  Google Sheet/Supabase Dashboard tương ứng (xem setupStorageBadgeLink() ở
 *  app-core.js), tiện thao tác trực tiếp (sửa tay bản ghi lỗi, lọc, export...) mà
 *  không cần tự đi tìm lại đúng Sheet/dự án. Trả về null nếu không có link (chế độ
 *  local, hoặc chưa cấu hình) — badge khi đó vẫn hiển thị bình thường, chỉ không bấm
 *  mở được gì, y hệt hành vi trước khi có tính năng này.
 *    - On-Premise Local Server: Trả về link /api?action=health để xem trạng thái CSDL máy chủ nội bộ.
 *    - Google Sheets: KHÔNG suy ra được từ GSHEET_WEBAPP_URL (URL đó là link Web App
 *      /exec, khác hẳn link Sheet) nên phải đọc từ GSHEET_SHEET_URL — admin tự dán tay
 *      1 lần vào config.js (xem chú thích ở đó).
 *    - Supabase: TỰ suy ra từ SUPABASE_URL (dạng https://<ref>.supabase.co) thành link
 *      Dashboard https://supabase.com/dashboard/project/<ref> — không cần cấu hình gì
 *      thêm. Nếu SUPABASE_URL không đúng khuôn dạng này (vd Supabase tự host), trả về
 *      null thay vì đoán bừa 1 link sai.
 */
function databaseManagementUrl() {
  if (typeof window === "undefined" || !window.DGA_CONFIG) return null;
  const currentMode = typeof Storage !== "undefined" ? Storage.mode : (hasLocalServerConfig() ? "local-server" : hasGsheetConfig() ? "gsheet" : hasSupabaseConfig() ? "supabase" : "local");
  if (currentMode === "local-server") {
    const base = String(window.DGA_CONFIG.LOCAL_SERVER_URL || "/api").trim();
    return base + (base.includes("?") ? "&" : "?") + "action=health";
  }
  if (currentMode === "gsheet") {
    const url = String(window.DGA_CONFIG.GSHEET_SHEET_URL || "").trim();
    return url || null;
  }
  if (currentMode === "supabase") {
    const m = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(String(window.DGA_CONFIG.SUPABASE_URL || "").trim());
    return m ? `https://supabase.com/dashboard/project/${m[1]}` : null;
  }
  return null;
}

let _sb = null;
function sb() {
  if (!_sb) {
    const client = (typeof window !== "undefined" && window.supabase) || (typeof global !== "undefined" && global.supabase);
    const cfg = (typeof window !== "undefined" && window.DGA_CONFIG) || (typeof global !== "undefined" && global.DGA_CONFIG);
    if (client && cfg) {
      _sb = client.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
  }
  return _sb;
}

function gsheetUrl() {
  const cfg = (typeof window !== "undefined" && window.DGA_CONFIG) || (typeof global !== "undefined" && global.DGA_CONFIG);
  if (!cfg) return "";
  if (cfg.LOCAL_SERVER_URL) return cfg.LOCAL_SERVER_URL;
  return cfg.GSHEET_WEBAPP_URL || "";
}

// Token phiên đăng nhập hiện tại (Google Sheets / On-Premise Local Server mode) — gắn tự động vào MỌI request
// gsheetGet/gsheetPost bên dưới khi đã đăng nhập, để Server xác thực.
// Auth.init()/Auth._applySession() bên dưới là nơi duy nhất set biến này.
let _authToken = null;

function uid() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Đọc file thất bại."));
    reader.readAsDataURL(file);
  });
}

async function fileToBase64(file) {
  const dataUrl = await fileToDataUrl(file);
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function isNetworkError(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err) return false;
  const msg = String((err && (err.message || err.details || err.hint)) || err || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("connection") ||
    msg.includes("err_") ||
    msg.includes("dns") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("abort") ||
    msg.includes("offline")
  );
}

let _isSyncing = false;
const _syncListeners = [];

function notifySyncStatus(override) {
  const queue = typeof lsSyncQueueGet === "function" ? lsSyncQueueGet() : [];
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const status = {
    online: override && override.online !== undefined ? override.online : isOnline,
    syncing: override && override.syncing !== undefined ? override.syncing : _isSyncing,
    pendingCount: queue.length,
    mode: typeof Storage !== "undefined" ? Storage.mode : "local",
  };
  _syncListeners.forEach((fn) => {
    try {
      fn(status);
    } catch (e) {
      console.warn("Lỗi listener sync status:", e);
    }
  });
}

function storageErrorMessage(err) {
  const base = (err && err.message) || String(err);
  const mode = typeof Storage !== "undefined" ? Storage.mode : "";
  if (mode === "local-server") {
    return "Lỗi kết nối Máy chủ nội bộ On-Premise: " + base +
      "\n\nKiểm tra: Máy chủ nội bộ tại LOCAL_SERVER_URL đã được khởi động chưa (npm start) và cổng 8080 đang mở.";
  }
  if (mode === "gsheet") {
    return "Lỗi kết nối Google Sheets: " + base +
      "\n\nKiểm tra: URL trong config.js đúng chưa, Apps Script đã Deploy > New deployment với " +
      "\"Who has access: Anyone\" chưa, và Google Sheet chưa bị xóa/đổi quyền.";
  }
  if (mode === "supabase") {
    return "Lỗi kết nối Supabase: " + base;
  }
  return "Lỗi lưu dữ liệu: " + base;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LS_KEYS,
    GAS_KEYS,
    normalizeGasKeys,
    hasLocalServerConfig,
    hasSupabaseConfig,
    hasGsheetConfig,
    databaseManagementUrl,
    _sb,
    sb,
    gsheetUrl,
    _authToken,
    uid,
    fileToDataUrl,
    fileToBase64,
    isNetworkError,
    _isSyncing,
    _syncListeners,
    notifySyncStatus,
    storageErrorMessage,
  };
}
