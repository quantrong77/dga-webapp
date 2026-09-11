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
    this.current = { token: data.token, email: data.email, role: data.role };
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
      this.current = { token: _authToken, email: me.email, role: me.role };
      authLsSet(this.current);
      return this.current;
    } catch (err) {
      _authToken = null;
      this.current = null;
      authLsSet(null);
      return null;
    }
  },

  isAdmin() {
    return !!(this.current && this.current.role === "admin");
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
};

const Storage = {
  mode: hasGsheetConfig() ? "gsheet" : hasSupabaseConfig() ? "supabase" : "local",

  async listMeasurements() {
    if (this.mode === "gsheet") {
      return await gsheetGet("listMeasurements");
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("measurements").select("*").order("sample_date", { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return lsGet(LS_KEYS.measurements);
  },

  async addMeasurement(m) {
    const record = normalizeGasKeys({ ...m, id: m.id || uid(), created_at: new Date().toISOString() });
    if (this.mode === "gsheet") {
      return await gsheetPost("addMeasurement", { record });
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("measurements").insert(record).select();
      if (error) throw error;
      return data[0];
    }
    const all = lsGet(LS_KEYS.measurements);
    all.push(record);
    lsSet(LS_KEYS.measurements, all);
    return record;
  },

  async deleteMeasurement(id) {
    if (this.mode === "gsheet") {
      await gsheetPost("deleteMeasurement", { id });
      return;
    }
    if (this.mode === "supabase") {
      const { error } = await sb().from("measurements").delete().eq("id", id);
      if (error) throw error;
      return;
    }
    const all = lsGet(LS_KEYS.measurements).filter((r) => r.id !== id);
    lsSet(LS_KEYS.measurements, all);
  },

  async listStandards() {
    if (this.mode === "gsheet") {
      return await gsheetGet("listStandards");
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("manufacturer_standards").select("*");
      if (error) throw error;
      return data || [];
    }
    return lsGet(LS_KEYS.standards);
  },

  async saveStandard(s) {
    const record = { ...s, id: s.id || uid() };
    if (this.mode === "gsheet") {
      return await gsheetPost("saveStandard", { record });
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("manufacturer_standards").upsert(record).select();
      if (error) throw error;
      return data[0];
    }
    const all = lsGet(LS_KEYS.standards);
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.push(record);
    lsSet(LS_KEYS.standards, all);
    return record;
  },

  async deleteStandard(id) {
    if (this.mode === "gsheet") {
      await gsheetPost("deleteStandard", { id });
      return;
    }
    if (this.mode === "supabase") {
      const { error } = await sb().from("manufacturer_standards").delete().eq("id", id);
      if (error) throw error;
      return;
    }
    const all = lsGet(LS_KEYS.standards).filter((r) => r.id !== id);
    lsSet(LS_KEYS.standards, all);
  },

  // Danh mục Trạm (MaTram/TenTram) — dùng để gợi ý/tìm kiếm ở ô "Trạm", không bắt buộc.
  async listStations() {
    if (this.mode === "gsheet") {
      return await gsheetGet("listStations");
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("stations").select("*");
      if (error) throw error;
      return data || [];
    }
    return lsGet(LS_KEYS.stations);
  },

  async saveStation(s) {
    const record = { ...s, id: s.id || uid() };
    if (this.mode === "gsheet") {
      return await gsheetPost("saveStation", { record });
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("stations").upsert(record).select();
      if (error) throw error;
      return data[0];
    }
    const all = lsGet(LS_KEYS.stations);
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.push(record);
    lsSet(LS_KEYS.stations, all);
    return record;
  },

  async deleteStation(id) {
    if (this.mode === "gsheet") {
      await gsheetPost("deleteStation", { id });
      return;
    }
    if (this.mode === "supabase") {
      const { error } = await sb().from("stations").delete().eq("id", id);
      if (error) throw error;
      return;
    }
    const all = lsGet(LS_KEYS.stations).filter((r) => r.id !== id);
    lsSet(LS_KEYS.stations, all);
  },

  // Thí nghiệm dầu MBA (độ ẩm/tgδ 90°C/điện áp chọc thủng) — Điều 46/47/50, QĐ1901.
  async listOilTests() {
    if (this.mode === "gsheet") {
      return await gsheetGet("listOilTests");
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("oil_tests").select("*").order("sample_date", { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return lsGet(LS_KEYS.oilTests);
  },

  async addOilTest(t) {
    const record = { ...t, id: t.id || uid(), created_at: new Date().toISOString() };
    if (this.mode === "gsheet") {
      return await gsheetPost("addOilTest", { record });
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("oil_tests").insert(record).select();
      if (error) throw error;
      return data[0];
    }
    const all = lsGet(LS_KEYS.oilTests);
    all.push(record);
    lsSet(LS_KEYS.oilTests, all);
    return record;
  },

  async deleteOilTest(id) {
    if (this.mode === "gsheet") {
      await gsheetPost("deleteOilTest", { id });
      return;
    }
    if (this.mode === "supabase") {
      const { error } = await sb().from("oil_tests").delete().eq("id", id);
      if (error) throw error;
      return;
    }
    const all = lsGet(LS_KEYS.oilTests).filter((r) => r.id !== id);
    lsSet(LS_KEYS.oilTests, all);
  },

  // Thí nghiệm dầu khoang điều áp dưới tải (OLTC) — Điều 37/Bảng 49, QĐ1901. Bảng
  // riêng khỏi oil_tests (dầu thùng dầu chính) vì có thêm điểm lấy mẫu + pha.
  async listOltcOilTests() {
    if (this.mode === "gsheet") {
      return await gsheetGet("listOltcOilTests");
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("oltc_oil_tests").select("*").order("sample_date", { ascending: true });
      if (error) throw error;
      return data || [];
    }
    return lsGet(LS_KEYS.oltcOilTests);
  },

  async addOltcOilTest(t) {
    const record = { ...t, id: t.id || uid(), created_at: new Date().toISOString() };
    if (this.mode === "gsheet") {
      return await gsheetPost("addOltcOilTest", { record });
    }
    if (this.mode === "supabase") {
      const { data, error } = await sb().from("oltc_oil_tests").insert(record).select();
      if (error) throw error;
      return data[0];
    }
    const all = lsGet(LS_KEYS.oltcOilTests);
    all.push(record);
    lsSet(LS_KEYS.oltcOilTests, all);
    return record;
  },

  async deleteOltcOilTest(id) {
    if (this.mode === "gsheet") {
      await gsheetPost("deleteOltcOilTest", { id });
      return;
    }
    if (this.mode === "supabase") {
      const { error } = await sb().from("oltc_oil_tests").delete().eq("id", id);
      if (error) throw error;
      return;
    }
    const all = lsGet(LS_KEYS.oltcOilTests).filter((r) => r.id !== id);
    lsSet(LS_KEYS.oltcOilTests, all);
  },
};

if (typeof window !== "undefined") {
  window.Storage = Storage;
  window.Auth = Auth;
}
