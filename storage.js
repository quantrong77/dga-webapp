/*
 * storage.js
 * Lớp lưu trữ dữ liệu — tự động chọn 1 trong 3 chế độ theo config.js:
 *   1. Google Sheets (qua Apps Script Web App) nếu đã điền GSHEET_WEBAPP_URL — ưu tiên cao nhất
 *   2. Supabase (Postgres) nếu đã điền SUPABASE_URL/SUPABASE_ANON_KEY
 *   3. localStorage của trình duyệt (mặc định, chạy được ngay không cần cấu hình gì)
 *
 * Mọi hàm đều là async và trả về Promise để cả 3 chế độ dùng chung 1 API.
 */

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
  if (Storage.mode === "gsheet") {
    const url = String(window.DGA_CONFIG.GSHEET_SHEET_URL || "").trim();
    return url || null;
  }
  if (Storage.mode === "supabase") {
    const m = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(String(window.DGA_CONFIG.SUPABASE_URL || "").trim());
    return m ? `https://supabase.com/dashboard/project/${m[1]}` : null;
  }
  return null;
}

let _sb = null;
function sb() {
  if (!_sb) {
    _sb = window.supabase.createClient(window.DGA_CONFIG.SUPABASE_URL, window.DGA_CONFIG.SUPABASE_ANON_KEY);
  }
  return _sb;
}

function gsheetUrl() {
  return window.DGA_CONFIG.GSHEET_WEBAPP_URL;
}

// Token phiên đăng nhập hiện tại (Google Sheets mode) — gắn tự động vào MỌI request
// gsheetGet/gsheetPost bên dưới khi đã đăng nhập, để Apps Script (Code.gs) xác thực.
// Auth.init()/Auth._applySession() bên dưới là nơi duy nhất set biến này.
let _authToken = null;

/** GET với action= (+ token nếu có) trong query string — dùng cho các thao tác đọc. */
async function gsheetGet(action, params) {
  const qs = new URLSearchParams({ action, ...(params || {}) });
  if (_authToken) qs.set("token", _authToken);
  const res = await fetch(gsheetUrl() + "?" + qs.toString(), { method: "GET" });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

/**
 * POST cho các thao tác ghi (+ token nếu đã đăng nhập). Dùng Content-Type: text/plain
 * (thay vì application/json) để trình duyệt coi đây là "simple request", KHÔNG gửi
 * preflight OPTIONS trước — vì Google Apps Script Web App không tự xử lý OPTIONS,
 * preflight sẽ bị chặn nếu dùng application/json. Phía Apps Script (Code.gs) tự
 * JSON.parse(e.postData.contents).
 */
async function gsheetPost(action, payload) {
  const body = { action, ...payload };
  if (_authToken) body.token = _authToken;
  const res = await fetch(gsheetUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

function uid() {
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

// ---------------------------------------------------------------------------
// Biên bản thí nghiệm (BBTN, file PDF) đính kèm 1 lần đo (measurements) — lưu theo
// ĐÚNG 3 chế độ như Storage bên dưới: Google Sheets (Drive, qua action "uploadAttachment"
// ở Code.gs), Supabase (Storage bucket "bbtn"), hoặc localStorage (base64, chỉ chế độ thử
// nghiệm — giới hạn kích thước vì localStorage tổng dung lượng rất nhỏ, xem MAX_LOCAL_BBTN_BYTES).
// ---------------------------------------------------------------------------
const LS_BBTN_KEY = "dga_bbtn_files_v1";
const MAX_LOCAL_BBTN_BYTES = 4 * 1024 * 1024; // 4MB — dè dặt hơn nhiều so với hạn mức chung của localStorage

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

// ---------------------------------------------------------------------------
// Hàng đợi ngoại tuyến (Offline Sync Queue) & Bộ phát hiện mạng
// ---------------------------------------------------------------------------
const LS_SYNC_QUEUE_KEY = "dga_sync_queue_v1";

function lsSyncQueueGet() {
  try {
    const raw = localStorage.getItem(LS_SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("localStorage read failed (sync queue)", e);
    return [];
  }
}

function lsSyncQueueSet(queue) {
  try {
    localStorage.setItem(LS_SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn("localStorage write failed (sync queue)", e);
  }
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
  const queue = lsSyncQueueGet();
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

function enqueueSyncOp(action, payload) {
  const queue = lsSyncQueueGet();
  const item = {
    id: "sq_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
    action,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  queue.push(item);
  lsSyncQueueSet(queue);
  notifySyncStatus();
  return item;
}

// ---------------------------------------------------------------------------
// Auth — đăng ký / đăng nhập / phân quyền. CHỈ hỗ trợ ở chế độ Google Sheets
// (backend xác thực nằm trong gsheet/Code.gs — action register/login/logout/me/
// listUsers/setUserRole/deleteUser). Ở chế độ Supabase/localStorage, Auth.enabled
// = false và app.js bỏ qua toàn bộ màn hình đăng nhập, dùng app như trước đây.
// ---------------------------------------------------------------------------
const AUTH_LS_KEY = "dga_auth_v1";

function authLsGet() {
  try {
    const raw = localStorage.getItem(AUTH_LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function authLsSet(session) {
  try {
    if (session) localStorage.setItem(AUTH_LS_KEY, JSON.stringify(session));
    else localStorage.removeItem(AUTH_LS_KEY);
  } catch (e) {
    console.warn("localStorage write failed (auth)", e);
  }
}

const Auth = {
  enabled: hasGsheetConfig(),
  current: null, // { token, email, role } sau khi xác thực thành công, null nếu chưa đăng nhập

  /** Nạp phiên đã lưu (nếu có) từ lần trước — gọi 1 lần lúc khởi động trang. */
  loadSaved() {
    const saved = authLsGet();
    if (saved && saved.token) {
      _authToken = saved.token;
      this.current = saved;
    }
    return this.current;
  },

  _applySession(data) {
    _authToken = data.token;
    // mustChangePassword: đang dùng mật khẩu TẠM do Admin cấp — server chặn mọi thao tác
    // khác cho tới khi đổi (requireSession(), Code.gs); xem enterApp() ở ui-auth.js.
    this.current = { token: data.token, email: data.email, role: data.role, mustChangePassword: !!data.mustChangePassword };
    authLsSet(this.current);
    return this.current;
  },

  async register(email, password) {
    const data = await gsheetPost("register", { email, password });
    return this._applySession(data);
  },

  async login(email, password) {
    const data = await gsheetPost("login", { email, password });
    return this._applySession(data);
  },

  /** Đăng nhập/đăng ký bằng Google — idToken là credential JWT do Google Identity
   *  Services (GIS) trả về ở trình duyệt sau khi người dùng chọn tài khoản Google. */
  async loginWithGoogle(idToken) {
    const data = await gsheetPost("googleLogin", { idToken });
    return this._applySession(data);
  },

  async logout() {
    try {
      await gsheetPost("logout", {});
    } catch (e) {
      console.warn("Đăng xuất phía server thất bại (bỏ qua, vẫn xóa phiên cục bộ):", e);
    }
    _authToken = null;
    this.current = null;
    authLsSet(null);
  },

  /** Xác thực lại token đã lưu (sau khi tải lại trang) — null nếu hết hạn/không hợp lệ. */
  async refresh() {
    if (!_authToken) return null;
    try {
      const me = await gsheetGet("me");
      // hasPassword: xem actionMe() ở Code.gs — dùng để hiện gợi ý #changePasswordGoogleHint
      // (setupChangePassword(), ui-auth.js) TRƯỚC khi tài khoản chỉ đăng nhập Google thử đổi
      // mật khẩu. Server cũ (chưa có trường này) trả undefined -> !!undefined = false, coi
      // như "chưa có mật khẩu" (an toàn hơn: hiện gợi ý nhầm còn hơn để lỗi khó hiểu).
      this.current = {
        token: _authToken, email: me.email, role: me.role,
        hasPassword: !!me.hasPassword, mustChangePassword: !!me.mustChangePassword,
      };
      authLsSet(this.current);
      return this.current;
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn("Mất mạng khi xác thực token — giữ nguyên phiên đăng nhập cục bộ đã lưu.");
        return this.current;
      }
      _authToken = null;
      this.current = null;
      authLsSet(null);
      return null;
    }
  },

  isAdmin() {
    return !!(this.current && this.current.role === "admin");
  },

  /** role "viewer" — chỉ đọc, không nhập/sửa được dữ liệu thiết bị (server luôn kiểm tra
   *  lại qua requireWriter(), xem gsheet/Code.gs) — dùng ở canSaveEntry() (ui-auth.js). */
  isViewer() {
    return !!(this.current && this.current.role === "viewer");
  },

  async listUsers() {
    return await gsheetGet("listUsers");
  },

  async setUserRole(email, role) {
    return await gsheetPost("setUserRole", { email, role });
  },

  async deleteUser(email) {
    return await gsheetPost("deleteUser", { email });
  },

  /** Trạng thái đăng ký hiện tại của server ("open"/"domain"/"closed" + domain cho phép
   *  nếu có, xem REGISTRATION_MODE ở Code.gs) — public, KHÔNG cần đăng nhập trước. Dùng để
   *  ẩn/hiện link "Đăng ký" và gợi ý domain ở màn hình đăng nhập (setupAuthForms(), ui-auth.js).
   *  Gọi lỗi (server cũ chưa có action này/mất mạng) → coi như "open" để không lỡ chặn nhầm
   *  luồng đăng ký hiện có vì một lỗi không liên quan. */
  async registrationInfo() {
    try {
      return await gsheetGet("registrationInfo");
    } catch (err) {
      return { mode: "open", domain: "" };
    }
  },

  /** Tự đổi mật khẩu (đã đăng nhập, phải biết đúng mật khẩu cũ) — server hủy MỌI phiên
   *  khác và cấp lại 1 phiên MỚI ngay trong cùng response (xem actionChangePassword(),
   *  Code.gs), nên PHẢI áp dụng qua _applySession() để thay token/role đang lưu — nếu chỉ
   *  đọc kết quả mà không gọi hàm này, lần gọi API kế tiếp sẽ dùng token CŨ đã bị hủy. */
  async changePassword(oldPassword, newPassword) {
    const data = await gsheetPost("changePassword", { oldPassword, newPassword });
    return this._applySession(data);
  },

  /** Admin đặt lại mật khẩu cho 1 tài khoản đã quên mật khẩu — trả về { email, tempPassword }
   *  ĐÚNG 1 LẦN để Admin copy gửi cho người dùng qua kênh khác (app không có email server để
   *  tự gửi); KHÔNG lưu lại mật khẩu tạm này ở đâu trong app. Hủy luôn mọi phiên cũ của tài
   *  khoản đó ở phía server (đăng xuất khỏi mọi thiết bị). */
  async adminResetPassword(email) {
    return await gsheetPost("adminResetPassword", { email });
  },

  /** Admin tạo tài khoản mới trực tiếp (không cần người dùng tự đăng ký) — dùng khi
   *  registrationInfo().mode !== "open", hoặc đơn giản Admin muốn chủ động cấp tài khoản.
   *  Trả về { email, role, tempPassword } giống adminResetPassword() ở trên. */
  async adminCreateUser(email, role) {
    return await gsheetPost("adminCreateUser", { email, role });
  },

  /** Bản sao song song trên Supabase (Code.gs ghi theo phía máy chủ) — chỉ Admin. Server cũ
   *  chưa có action này sẽ báo lỗi "unknown action" (hiện nguyên văn ở tab Quản trị). */
  async supabaseSyncStatus() {
    return await gsheetGet("supabaseSyncStatus");
  },

  async syncSupabase() {
    return await gsheetPost("syncSupabase", {});
  },
};

/** Thực thi lại 1 tác vụ từ hàng đợi đồng bộ lên server (Google Sheets hoặc Supabase). */
async function executeRemoteSyncItem(item) {
  const { action, payload } = item;
  if (Storage.mode === "gsheet") {
    if (action === "addMeasurement") return await gsheetPost("addMeasurement", payload);
    if (action === "deleteMeasurement") return await gsheetPost("deleteMeasurement", payload);
    if (action === "saveStandard") return await gsheetPost("saveStandard", payload);
    if (action === "deleteStandard") return await gsheetPost("deleteStandard", payload);
    if (action === "saveStation") return await gsheetPost("saveStation", payload);
    if (action === "deleteStation") return await gsheetPost("deleteStation", payload);
    if (action === "addOilTest") return await gsheetPost("addOilTest", payload);
    if (action === "deleteOilTest") return await gsheetPost("deleteOilTest", payload);
    if (action === "addOltcOilTest") return await gsheetPost("addOltcOilTest", payload);
    if (action === "deleteOltcOilTest") return await gsheetPost("deleteOltcOilTest", payload);
    if (action === "addInstrumentOilTest") return await gsheetPost("addInstrumentOilTest", payload);
    if (action === "deleteInstrumentOilTest") return await gsheetPost("deleteInstrumentOilTest", payload);
    if (action === "saveRegulationConfig") return await gsheetPost("saveRegulationConfig", payload);
    if (action === "deleteRegulationConfig") return await gsheetPost("deleteRegulationConfig", payload);
    if (action === "addFeedback") return await gsheetPost("addFeedback", payload);
    if (action === "deleteFeedback") return await gsheetPost("deleteFeedback", payload);
    if (action === "uploadAttachment") {
      const res = await gsheetPost("uploadAttachment", payload);
      if (res && res.url && payload.measurementId) {
        await gsheetPost("addMeasurement", {
          record: { id: payload.measurementId, bbtn_url: res.url, bbtn_name: res.name || payload.filename, bbtn_file_id: res.id || null },
        });
      }
      return res;
    }
  } else if (Storage.mode === "supabase") {
    if (action === "addMeasurement") {
      const { data, error } = await sb().from("measurements").upsert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteMeasurement") {
      const { error } = await sb().from("measurements").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "saveStandard") {
      const { data, error } = await sb().from("manufacturer_standards").upsert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteStandard") {
      const { error } = await sb().from("manufacturer_standards").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "saveStation") {
      const { data, error } = await sb().from("stations").upsert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteStation") {
      const { error } = await sb().from("stations").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "addOilTest") {
      const { data, error } = await sb().from("oil_tests").insert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteOilTest") {
      const { error } = await sb().from("oil_tests").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "addOltcOilTest") {
      const { data, error } = await sb().from("oltc_oil_tests").insert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteOltcOilTest") {
      const { error } = await sb().from("oltc_oil_tests").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "addInstrumentOilTest") {
      const { data, error } = await sb().from("instrument_oil_tests").upsert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteInstrumentOilTest") {
      const { error } = await sb().from("instrument_oil_tests").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "saveRegulationConfig") {
      const { error } = await sb().from("regulation_config").upsert(payload.record);
      if (error) throw error;
      return;
    }
    if (action === "deleteRegulationConfig") {
      const { error } = await sb().from("regulation_config").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "addFeedback") {
      const { data, error } = await sb().from("feedback").insert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteFeedback") {
      const { error } = await sb().from("feedback").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
  }
}

const Storage = {
  mode: hasGsheetConfig() ? "gsheet" : hasSupabaseConfig() ? "supabase" : "local",

  async listMeasurements() {
    if (this.mode === "gsheet") {
      try {
        const data = await gsheetGet("listMeasurements");
        lsSet(LS_KEYS.measurements, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Mất kết nối mạng: trả về measurements từ bộ nhớ đệm ngoại tuyến (localStorage)");
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.measurements);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("measurements").select("*").order("sample_date", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.measurements, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Mất kết nối mạng: trả về measurements từ bộ nhớ đệm ngoại tuyến (localStorage)");
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.measurements);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.measurements);
  },

  async addMeasurement(m) {
    // Dùng chung cho cả TẠO MỚI và SỬA/LƯU LẠI 1 bản ghi đã có (không có
    // updateMeasurement() riêng — khi sửa, m.id là id bản ghi cũ nên phải UPDATE
    // đúng dòng đó, không được tạo thêm dòng mới trùng thiết bị/ngày đo).
    const isEdit = !!m.id;
    const record = normalizeGasKeys({ ...m, id: m.id || uid(), created_at: m.created_at || new Date().toISOString() });

    // Lưu ngay vào bộ nhớ cục bộ để UI phản ánh tức thì (Optimistic UI)
    const all = lsGet(LS_KEYS.measurements);
    const idx = isEdit ? all.findIndex((r) => r.id === record.id) : -1;
    if (idx >= 0) all[idx] = record; else all.push(record);
    lsSet(LS_KEYS.measurements, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addMeasurement", { record });
        return record;
      }
      try {
        const res = await gsheetPost("addMeasurement", { record });
        return res || record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addMeasurement", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addMeasurement", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("measurements").upsert(record).select();
        if (error) throw error;
        if (data && data[0]) {
          const freshIdx = all.findIndex((r) => r.id === record.id);
          if (freshIdx >= 0) { all[freshIdx] = data[0]; lsSet(LS_KEYS.measurements, all); }
          return data[0];
        }
        return record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addMeasurement", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteMeasurement(id) {
    const all = lsGet(LS_KEYS.measurements).filter((r) => r.id !== id);
    lsSet(LS_KEYS.measurements, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteMeasurement", { id });
        return;
      }
      try {
        await gsheetPost("deleteMeasurement", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteMeasurement", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteMeasurement", { id });
        return;
      }
      try {
        const { error } = await sb().from("measurements").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteMeasurement", { id });
          return;
        }
        throw err;
      }
    }
  },

  async listStandards() {
    if (this.mode === "gsheet") {
      try {
        const data = await gsheetGet("listStandards");
        lsSet(LS_KEYS.standards, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.standards);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("manufacturer_standards").select("*");
        if (error) throw error;
        lsSet(LS_KEYS.standards, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.standards);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.standards);
  },

  async saveStandard(s) {
    const record = { ...s, id: s.id || uid() };
    const all = lsGet(LS_KEYS.standards);
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.push(record);
    lsSet(LS_KEYS.standards, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveStandard", { record });
        return record;
      }
      try {
        return await gsheetPost("saveStandard", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveStandard", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveStandard", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("manufacturer_standards").upsert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveStandard", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteStandard(id) {
    const all = lsGet(LS_KEYS.standards).filter((r) => r.id !== id);
    lsSet(LS_KEYS.standards, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteStandard", { id });
        return;
      }
      try {
        await gsheetPost("deleteStandard", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteStandard", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteStandard", { id });
        return;
      }
      try {
        const { error } = await sb().from("manufacturer_standards").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteStandard", { id });
          return;
        }
        throw err;
      }
    }
  },

  // -------------------------------------------------------------------
  // "Cấu hình quy định" (tab riêng, xem ui/ui-regulation-config.js) — cho phép Admin
  // sửa số liệu/tham chiếu nguồn của các bảng ngưỡng ĐƠN GIẢN trong dga-logic.js (mục 9,
  // REGULATION_CONFIG_REGISTRY) mà KHÔNG cần sửa code, đáp ứng khi QĐ1901/IEC 60599 có
  // bản cập nhật trong tương lai. Mỗi bản ghi ứng với ĐÚNG 1 bảng (id = key trong
  // registry, VD "BANG64_MBA") — không phải danh sách tự do như Tiêu chuẩn NSX.
  // "values" ở phía gọi (dga-logic.js applyRegulationConfigOverride()) LUÔN là 1 object
  // JS lồng nhau đúng shape của bảng đó — storage.js CHỈ lo phần (de)serialize thành
  // chuỗi JSON (values_json) để lưu thống nhất trên CẢ 3 backend (kể cả Supabase — dùng
  // cột text thay vì jsonb để khỏi phải đổi schema riêng), người gọi không cần biết.
  // -------------------------------------------------------------------
  async listRegulationConfig() {
    let rows;
    if (this.mode === "gsheet") {
      try {
        rows = await gsheetGet("listRegulationConfig");
        lsSet(LS_KEYS.regulationConfig, rows || []);
      } catch (err) {
        if (isNetworkError(err)) {
          rows = lsGet(LS_KEYS.regulationConfig);
        } else {
          throw err;
        }
      }
    } else if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("regulation_config").select("*");
        if (error) throw error;
        rows = data || [];
        lsSet(LS_KEYS.regulationConfig, rows);
      } catch (err) {
        if (isNetworkError(err)) {
          rows = lsGet(LS_KEYS.regulationConfig);
        } else {
          throw err;
        }
      }
    } else {
      rows = lsGet(LS_KEYS.regulationConfig);
    }
    return (rows || []).map((r) => {
      let values = null;
      try {
        values = r.values_json ? JSON.parse(r.values_json) : null;
      } catch (err) {
        console.warn("Không đọc được values_json của cấu hình quy định:", r.id, err);
      }
      return { id: r.id, citation: r.citation || null, values, updated_by: r.updated_by, updated_at: r.updated_at };
    });
  },

  /** @param {{id:string, citation?:string, values?:object}} rec */
  async saveRegulationConfig(rec) {
    const wire = {
      id: rec.id,
      citation: rec.citation || "",
      values_json: JSON.stringify(rec.values || {}),
      updated_at: new Date().toISOString(),
    };
    const all = lsGet(LS_KEYS.regulationConfig);
    const idx = all.findIndex((r) => r.id === wire.id);
    if (idx >= 0) all[idx] = wire; else all.push(wire);
    lsSet(LS_KEYS.regulationConfig, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveRegulationConfig", { record: wire });
        return;
      }
      try {
        await gsheetPost("saveRegulationConfig", { record: wire });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveRegulationConfig", { record: wire });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveRegulationConfig", { record: wire });
        return;
      }
      try {
        const { error } = await sb().from("regulation_config").upsert(wire);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveRegulationConfig", { record: wire });
          return;
        }
        throw err;
      }
    }
  },

  /** Xóa bản ghi ghi đè — dùng cho nút "Khôi phục mặc định" (xóa override thì lần nạp
   *  sau tự dùng lại hằng số mặc định trong dga-logic.js). */
  async deleteRegulationConfig(id) {
    const all = lsGet(LS_KEYS.regulationConfig).filter((r) => r.id !== id);
    lsSet(LS_KEYS.regulationConfig, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteRegulationConfig", { id });
        return;
      }
      try {
        await gsheetPost("deleteRegulationConfig", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteRegulationConfig", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteRegulationConfig", { id });
        return;
      }
      try {
        const { error } = await sb().from("regulation_config").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteRegulationConfig", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Danh mục Trạm (MaTram/TenTram) — dùng để gợi ý/tìm kiếm ở ô "Trạm", không bắt buộc.
  async listStations() {
    if (this.mode === "gsheet") {
      try {
        const data = await gsheetGet("listStations");
        lsSet(LS_KEYS.stations, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.stations);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("stations").select("*");
        if (error) throw error;
        lsSet(LS_KEYS.stations, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.stations);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.stations);
  },

  async saveStation(s) {
    const record = { ...s, id: s.id || uid() };
    const all = lsGet(LS_KEYS.stations);
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.push(record);
    lsSet(LS_KEYS.stations, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveStation", { record });
        return record;
      }
      try {
        return await gsheetPost("saveStation", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveStation", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveStation", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("stations").upsert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveStation", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteStation(id) {
    const all = lsGet(LS_KEYS.stations).filter((r) => r.id !== id);
    lsSet(LS_KEYS.stations, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteStation", { id });
        return;
      }
      try {
        await gsheetPost("deleteStation", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteStation", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteStation", { id });
        return;
      }
      try {
        const { error } = await sb().from("stations").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteStation", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Thí nghiệm dầu MBA (độ ẩm/tgδ 90°C/điện áp chọc thủng) — Điều 46/47/50, QĐ1901.
  async listOilTests() {
    if (this.mode === "gsheet") {
      try {
        const data = await gsheetGet("listOilTests");
        lsSet(LS_KEYS.oilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.oilTests);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("oil_tests").select("*").order("sample_date", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.oilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.oilTests);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.oilTests);
  },

  async addOilTest(t) {
    const record = { ...t, id: t.id || uid(), created_at: new Date().toISOString() };
    const all = lsGet(LS_KEYS.oilTests);
    all.push(record);
    lsSet(LS_KEYS.oilTests, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addOilTest", { record });
        return record;
      }
      try {
        return await gsheetPost("addOilTest", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addOilTest", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("oil_tests").insert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteOilTest(id) {
    const all = lsGet(LS_KEYS.oilTests).filter((r) => r.id !== id);
    lsSet(LS_KEYS.oilTests, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteOilTest", { id });
        return;
      }
      try {
        await gsheetPost("deleteOilTest", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteOilTest", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteOilTest", { id });
        return;
      }
      try {
        const { error } = await sb().from("oil_tests").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteOilTest", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Thí nghiệm dầu khoang điều áp dưới tải (OLTC) — Điều 37/Bảng 49, QĐ1901. Bảng
  // riêng khỏi oil_tests (dầu thùng dầu chính) vì có thêm điểm lấy mẫu + pha.
  async listOltcOilTests() {
    if (this.mode === "gsheet") {
      try {
        const data = await gsheetGet("listOltcOilTests");
        lsSet(LS_KEYS.oltcOilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.oltcOilTests);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("oltc_oil_tests").select("*").order("sample_date", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.oltcOilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.oltcOilTests);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.oltcOilTests);
  },

  async addOltcOilTest(t) {
    const record = { ...t, id: t.id || uid(), created_at: new Date().toISOString() };
    const all = lsGet(LS_KEYS.oltcOilTests);
    all.push(record);
    lsSet(LS_KEYS.oltcOilTests, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addOltcOilTest", { record });
        return record;
      }
      try {
        return await gsheetPost("addOltcOilTest", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addOltcOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addOltcOilTest", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("oltc_oil_tests").insert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addOltcOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteOltcOilTest(id) {
    const all = lsGet(LS_KEYS.oltcOilTests).filter((r) => r.id !== id);
    lsSet(LS_KEYS.oltcOilTests, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteOltcOilTest", { id });
        return;
      }
      try {
        await gsheetPost("deleteOltcOilTest", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteOltcOilTest", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteOltcOilTest", { id });
        return;
      }
      try {
        const { error } = await sb().from("oltc_oil_tests").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteOltcOilTest", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Thí nghiệm dầu cách điện TI/TU (biến dòng điện/biến điện áp kiểu kín, cách điện
  // dầu) — Điều 10/11 QĐ1901 (chỉ dẫn chiếu "theo quy định nhà sản xuất", không có
  // bảng số mặc định — xem DGA.evaluateInstrumentOilTest() ở dga-logic.js). Bảng
  // RIÊNG khỏi oil_tests (MBA) vì khác hẳn cấu trúc (equipment_type TI/TU thay cấp
  // điện áp/trạng thái dầu, không có has_membrane_n2/oil_sample_point).
  async listInstrumentOilTests() {
    if (this.mode === "gsheet") {
      try {
        const data = await gsheetGet("listInstrumentOilTests");
        lsSet(LS_KEYS.instrumentOilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.instrumentOilTests);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("instrument_oil_tests").select("*").order("sample_date", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.instrumentOilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.instrumentOilTests);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.instrumentOilTests);
  },

  async addInstrumentOilTest(t) {
    // Có id sẵn = cập nhật bản ghi đã có (sửa, hoặc nhập lại đúng BBTN 3 pha đã lưu): giữ
    // created_at gốc và ghi đè đúng dòng đó, không tạo dòng trùng.
    const record = { ...t, id: t.id || uid(), created_at: t.created_at || new Date().toISOString() };
    const all = lsGet(LS_KEYS.instrumentOilTests).filter((r) => r.id !== record.id);
    all.push(record);
    lsSet(LS_KEYS.instrumentOilTests, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addInstrumentOilTest", { record });
        return record;
      }
      try {
        return await gsheetPost("addInstrumentOilTest", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addInstrumentOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addInstrumentOilTest", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("instrument_oil_tests").upsert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addInstrumentOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteInstrumentOilTest(id) {
    const all = lsGet(LS_KEYS.instrumentOilTests).filter((r) => r.id !== id);
    lsSet(LS_KEYS.instrumentOilTests, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteInstrumentOilTest", { id });
        return;
      }
      try {
        await gsheetPost("deleteInstrumentOilTest", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteInstrumentOilTest", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteInstrumentOilTest", { id });
        return;
      }
      try {
        const { error } = await sb().from("instrument_oil_tests").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteInstrumentOilTest", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Góp ý người dùng (tab "Người dùng phản hồi") — nội dung tự do + 1 ảnh minh họa tùy
  // chọn (xem uploadFeedbackImage() bên dưới). KHÔNG dùng prepareOwnedRecord()/audit như
  // measurements (feedback không có khái niệm "sửa lại" — chỉ tạo mới và Admin xóa được),
  // nên phía gsheet (Code.gs) vẫn gắn created_by nếu đã đăng nhập nhưng không giới hạn ai
  // sửa vì client không cung cấp tính năng sửa.
  async listFeedback() {
    if (this.mode === "gsheet") {
      try {
        const data = await gsheetGet("listFeedback");
        lsSet(LS_KEYS.feedback, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.feedback);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("feedback").select("*").order("created_at", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.feedback, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.feedback);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.feedback);
  },

  async addFeedback(f) {
    const record = { ...f, id: f.id || uid(), created_at: new Date().toISOString() };
    const all = lsGet(LS_KEYS.feedback);
    all.push(record);
    lsSet(LS_KEYS.feedback, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addFeedback", { record });
        return record;
      }
      try {
        return await gsheetPost("addFeedback", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addFeedback", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addFeedback", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("feedback").insert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addFeedback", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteFeedback(id) {
    const all = lsGet(LS_KEYS.feedback).filter((r) => r.id !== id);
    lsSet(LS_KEYS.feedback, all);

    if (this.mode === "gsheet") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteFeedback", { id });
        return;
      }
      try {
        await gsheetPost("deleteFeedback", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteFeedback", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteFeedback", { id });
        return;
      }
      try {
        const { error } = await sb().from("feedback").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteFeedback", { id });
          return;
        }
        throw err;
      }
    }
  },

  /** Tải lên 1 ảnh minh họa đính kèm góp ý — cùng cơ chế với uploadAttachment() (BBTN) ở
   *  trên, nhưng tách riêng bucket Supabase ("feedback" thay vì "bbtn") / thư mục Drive
   *  ("DGA_Feedback_DinhKem" thay vì "DGA_BBTN_DinhKem") để 2 loại file khác mục đích
   *  không lẫn vào nhau. Chế độ localStorage dùng lại NGUYÊN uploadAttachment()/
   *  getLocalAttachment() — cơ chế đó vốn chỉ là 1 map id→file dùng chung, khóa nào (id
   *  lần đo hay id góp ý) cũng được, không cần tách riêng như 2 chế độ kia. feedbackId
   *  phải sinh TRƯỚC bằng Storage.newId() (giống cách BBTN làm) vì ảnh có thể tải lên
   *  trước khi gọi addFeedback(). Trả về { image_url, image_name, image_file_id }. */
  async uploadFeedbackImage(feedbackId, file) {
    if (this.mode === "gsheet") {
      const base64Data = await fileToBase64(file);
      const res = await gsheetPost("uploadAttachment", {
        measurementId: feedbackId,
        filename: file.name,
        mimeType: file.type || "image/png",
        base64Data,
        folder: "DGA_Feedback_DinhKem",
      });
      return { image_url: res.url, image_name: res.name || file.name, image_file_id: res.id || null };
    }
    if (this.mode === "supabase") {
      const path = `${feedbackId}/${Date.now()}_${file.name}`;
      const { error } = await sb().storage.from("feedback").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/png",
      });
      if (error) throw error;
      const { data } = sb().storage.from("feedback").getPublicUrl(path);
      return { image_url: data.publicUrl, image_name: file.name, image_file_id: null };
    }
    const uploaded = await this.uploadAttachment(feedbackId, file);
    return { image_url: uploaded.bbtn_url, image_name: uploaded.bbtn_name, image_file_id: uploaded.bbtn_file_id };
  },

  // Id sinh phía client — dùng khi cần biết trước id của 1 lần đo (vd: để đính kèm
  // BBTN trước khi gọi addMeasurement()), thay vì để addMeasurement() tự sinh id.
  newId() {
    return uid();
  },

  /** Tải lên 1 file BBTN (PDF) và gắn với 1 lần đo (measurementId) — trả về các cột
   *  cần gộp vào record trước khi gọi addMeasurement(): { bbtn_url, bbtn_name, bbtn_file_id }.
   *  bbtn_file_id chỉ có giá trị ở chế độ Google Sheets (id file trên Drive); 2 chế độ
   *  còn lại để null. Ở chế độ localStorage, bbtn_url có dạng "local:<measurementId>" —
   *  KHÔNG phải URL thật, chỉ là "khóa" để tra lại qua getLocalAttachment(). */
  async uploadAttachment(measurementId, file) {
    if (this.mode === "gsheet") {
      const base64Data = await fileToBase64(file);
      const res = await gsheetPost("uploadAttachment", {
        measurementId,
        filename: file.name,
        mimeType: file.type || "application/pdf",
        base64Data,
      });
      return { bbtn_url: res.url, bbtn_name: res.name || file.name, bbtn_file_id: res.id || null };
    }
    if (this.mode === "supabase") {
      const path = `${measurementId}/${Date.now()}_${file.name}`;
      const { error } = await sb().storage.from("bbtn").upload(path, file, {
        upsert: true,
        contentType: file.type || "application/pdf",
      });
      if (error) throw error;
      const { data } = sb().storage.from("bbtn").getPublicUrl(path);
      return { bbtn_url: data.publicUrl, bbtn_name: file.name, bbtn_file_id: null };
    }
    // Chế độ thử nghiệm (localStorage) — chỉ máy/trình duyệt hiện tại thấy được file này.
    if (file.size > MAX_LOCAL_BBTN_BYTES) {
      throw new Error(
        `Chế độ lưu cục bộ (localStorage) chỉ hỗ trợ file tối đa 4MB — file này ${(file.size / 1024 / 1024).toFixed(1)}MB. ` +
        "Cấu hình Google Sheets hoặc Supabase trong config.js để lưu file lớn hơn."
      );
    }
    const dataUrl = await fileToDataUrl(file);
    const map = lsBbtnGetAll();
    map[measurementId] = { name: file.name, dataUrl };
    lsBbtnSetAll(map);
    return { bbtn_url: "local:" + measurementId, bbtn_name: file.name, bbtn_file_id: null };
  },

  /** Chỉ dùng ở chế độ localStorage — tra lại {name, dataUrl} đã lưu bằng
   *  uploadAttachment() ở trên, theo measurementId (phần sau "local:" trong bbtn_url). */
  getLocalAttachment(measurementId) {
    const map = lsBbtnGetAll();
    return map[measurementId] || null;
  },

  // ---------------------------------------------------------------------------
  // API quản lý hàng đợi & Tự động đồng bộ (Outbox Processor)
  // ---------------------------------------------------------------------------
  async processSyncQueue() {
    if (_isSyncing) return { syncing: true, pending: lsSyncQueueGet().length };
    if (this.mode === "local") return { mode: "local", pending: 0 };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      notifySyncStatus({ online: false });
      return { offline: true, pending: lsSyncQueueGet().length };
    }

    const queue = lsSyncQueueGet();
    if (!queue.length) {
      notifySyncStatus({ syncing: false, pending: 0 });
      return { processed: 0, pending: 0 };
    }

    _isSyncing = true;
    notifySyncStatus({ syncing: true, pending: queue.length });

    let processedCount = 0;
    try {
      while (queue.length > 0) {
        const item = queue[0];
        try {
          await executeRemoteSyncItem(item);
          queue.shift();
          lsSyncQueueSet(queue);
          processedCount++;
          notifySyncStatus({ syncing: true, pending: queue.length });
        } catch (err) {
          if (isNetworkError(err)) {
            console.warn("Đang đồng bộ thì gặp sự cố mạng, tạm hoãn chờ lần kết nối tiếp theo:", err);
            break;
          } else {
            console.error("Lỗi khi xử lý mục đồng bộ (bỏ qua sau nhiều lần lỗi):", item, err);
            item.retries = (item.retries || 0) + 1;
            if (item.retries >= 3) {
              queue.shift();
              lsSyncQueueSet(queue);
            } else {
              lsSyncQueueSet(queue);
              break;
            }
          }
        }
      }
    } finally {
      _isSyncing = false;
      notifySyncStatus();
    }

    return { processed: processedCount, pending: queue.length };
  },

  getSyncQueue() {
    return lsSyncQueueGet();
  },

  clearSyncQueue() {
    lsSyncQueueSet([]);
    notifySyncStatus();
  },

  getSyncStatus() {
    const queue = lsSyncQueueGet();
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    return {
      online: isOnline,
      syncing: _isSyncing,
      pendingCount: queue.length,
      mode: this.mode,
    };
  },

  onSyncStatusChange(fn) {
    if (typeof fn === "function") {
      _syncListeners.push(fn);
      try {
        fn(this.getSyncStatus());
      } catch (e) {}
    }
  },
};

if (typeof window !== "undefined") {
  window.Storage = Storage;
  window.Auth = Auth;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    Storage,
    Auth,
    LS_KEYS,
    LS_SYNC_QUEUE_KEY,
    lsSyncQueueGet,
    lsSyncQueueSet,
    enqueueSyncOp,
    isNetworkError,
    executeRemoteSyncItem,
  };
}
