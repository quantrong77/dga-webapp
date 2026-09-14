/* app.js — Ứng dụng di động THẬT (không phải bản thiết kế/demo) của Trợ Lý DGA.
 * Dùng lại NGUYÊN VĂN dga-logic.js + storage.js + bbtn-export.js với bản web app
 * (index.html) — chỉ cần config.js của 2 bản trỏ cùng 1 GSHEET_WEBAPP_URL (hoặc
 * cùng SUPABASE_URL/SUPABASE_ANON_KEY) là 2 app đọc/ghi chung đúng 1 nơi lưu trữ,
 * đăng nhập 1 bên thì bên kia thấy dữ liệu ngay — không có 2 database riêng biệt.
 *
 * File này CHỈ chứa phần giao diện/điều phối riêng cho di động (tương đương gộp
 * của app-core.js + ui-auth.js + ui-dga.js + ui-standards.js + ui-history.js bên
 * bản web, nhưng rút gọn cho đúng 1 luồng chính: Đăng nhập → Nhập liệu → Kết quả →
 * Lịch sử) — không đụng gì tới 3 file logic/lưu trữ dùng chung ở trên.
 */

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => t.classList.add("hidden"), 3200);
}

function storageErrorMessage(err) {
  const msg = (err && err.message) || String(err);
  return "Lỗi lưu trữ: " + msg;
}

// ---------------------------------------------------------------------
// Điều hướng màn hình — 5 tab chính (có thanh điều hướng dưới) + các màn "drill
// down" (Kết quả/Lịch sử đo — có nút Quay lại, không có thanh tab) + màn Đăng nhập.
// ---------------------------------------------------------------------
const SCREENS = [
  "screenAuth", "screenEntry", "screenResults", "screenHistory",
  "screenDau", "screenXuHuong", "screenTieuChuan", "screenQuanTri",
];
const TOP_LEVEL_SCREENS = ["screenEntry", "screenDau", "screenXuHuong", "screenTieuChuan", "screenQuanTri"];

function showScreen(name) {
  SCREENS.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle("hidden", id !== name);
    el.classList.toggle("with-tabbar", id === name && TOP_LEVEL_SCREENS.includes(name));
  });
  const isTop = TOP_LEVEL_SCREENS.includes(name);
  $("topTabbar").classList.toggle("hidden", !isTop);
  if (isTop) {
    document.querySelectorAll(".tabbar-btn").forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
  }
  closeAcctMenu();
  window.scrollTo(0, 0);
}

// Điều hướng khi bấm 1 nút ở thanh tab dưới — nạp/refresh dữ liệu của tab đó
// (dùng lại đúng danh mục _allStandards/_allMeasurements/... đã có trong bộ nhớ,
// không gọi lại Storage trừ khi thật sự cần) rồi mới hiện màn hình tương ứng.
async function onTabbarNav(screenName) {
  try {
    if (screenName === "screenDau") {
      populateOilVoltageClasses();
      populateOltcOptions();
      refreshOilManufacturerOptions();
      await refreshOilTestsUI();
      await refreshOltcOilTestsUI();
    } else if (screenName === "screenXuHuong") {
      refreshTrendDeviceOptions();
    } else if (screenName === "screenTieuChuan") {
      await refreshStandardsUI();
    } else if (screenName === "screenQuanTri") {
      await refreshUsersUI();
    }
  } catch (err) {
    showToast(storageErrorMessage(err));
  }
  showScreen(screenName);
}

function setupTabbar() {
  document.querySelectorAll(".tabbar-btn").forEach((btn) => {
    btn.addEventListener("click", () => onTabbarNav(btn.dataset.screen));
  });
}

// ---------------------------------------------------------------------
// Quyền — y hệt ui-auth.js bên web (Auth định nghĩa trong storage.js, dùng chung)
// ---------------------------------------------------------------------
function canWrite() { return !Auth.enabled || Auth.isAdmin(); }
function currentUserEmail() { return (Auth.current && Auth.current.email) || null; }
function isOwnRecord(rec) {
  const email = currentUserEmail();
  return !!(email && rec && rec.created_by && String(rec.created_by).trim().toLowerCase() === email.trim().toLowerCase());
}
function canSaveEntry() { return !Auth.enabled || !!Auth.current; }
function canEditRecord(rec) { return !Auth.enabled || Auth.isAdmin() || isOwnRecord(rec); }

// ---------------------------------------------------------------------
// Đăng nhập / đăng ký / đăng xuất — cổng vào (chỉ có tác dụng ở chế độ Google
// Sheets; Supabase/localStorage bỏ qua toàn bộ, vào thẳng màn Nhập liệu).
// ---------------------------------------------------------------------
function setAuthLoading(loading, text) {
  $("authSpinner").classList.toggle("hidden", !loading);
  $("authSpinnerText").textContent = text || "";
}

function setupAuthForms() {
  $("linkShowRegister").addEventListener("click", (e) => {
    e.preventDefault();
    $("authLoginForm").classList.add("hidden");
    $("authRegisterForm").classList.remove("hidden");
  });
  $("linkShowLogin").addEventListener("click", (e) => {
    e.preventDefault();
    $("authRegisterForm").classList.add("hidden");
    $("authLoginForm").classList.remove("hidden");
  });

  $("btnAuthLogin").addEventListener("click", async () => {
    const email = $("auth_login_email").value.trim();
    const password = $("auth_login_password").value;
    const errEl = $("authLoginError");
    errEl.classList.add("hidden");
    if (!email || !password) {
      errEl.textContent = "Vui lòng nhập email và mật khẩu.";
      errEl.classList.remove("hidden");
      return;
    }
    setAuthLoading(true, "Đang đăng nhập...");
    try {
      await Auth.login(email, password);
      setAuthLoading(false);
      showToast("Đăng nhập thành công!");
      await loadApp();
    } catch (err) {
      setAuthLoading(false);
      errEl.textContent = err.message || String(err);
      errEl.classList.remove("hidden");
    }
  });

  $("btnAuthRegister").addEventListener("click", async () => {
    const email = $("auth_register_email").value.trim();
    const password = $("auth_register_password").value;
    const errEl = $("authRegisterError");
    errEl.classList.add("hidden");
    if (!email || !password) {
      errEl.textContent = "Vui lòng nhập email và mật khẩu.";
      errEl.classList.remove("hidden");
      return;
    }
    setAuthLoading(true, "Đang đăng ký...");
    try {
      await Auth.register(email, password);
      setAuthLoading(false);
      showToast("Đăng ký thành công!");
      await loadApp();
    } catch (err) {
      setAuthLoading(false);
      errEl.textContent = err.message || String(err);
      errEl.classList.remove("hidden");
    }
  });

  $("btnLogout").addEventListener("click", async () => {
    await Auth.logout();
    location.reload();
  });
}

// Google Identity Services — cổng đăng nhập Google, y hệt logic đã kiểm chứng ở
// ui-auth.js bên web (chỉ đổi id nút sang DOM của bản mobile).
let googleSignInInitialized = false;
function initGoogleSignIn() {
  if (googleSignInInitialized) return;
  const clientId = window.DGA_CONFIG && window.DGA_CONFIG.GOOGLE_CLIENT_ID;
  if (!clientId) return;
  if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
    console.warn("Google Identity Services chưa sẵn sàng ở lần gọi này — sẽ tự thử lại khi tải xong.");
    return;
  }
  try {
    google.accounts.id.initialize({ client_id: clientId, callback: onGoogleCredential });
    google.accounts.id.renderButton($("googleSignInBtn"), {
      theme: "outline", size: "large", text: "continue_with", width: 300, locale: "vi",
    });
    $("googleSignInWrap").classList.remove("hidden");
    googleSignInInitialized = true;
  } catch (err) {
    console.warn("Không khởi tạo được Đăng nhập Google:", err);
  }
}
window.onGoogleLibraryLoad = initGoogleSignIn;

async function onGoogleCredential(response) {
  const errEl = $("authLoginError");
  errEl.classList.add("hidden");
  setAuthLoading(true, "Đang xác thực với Google...");
  try {
    await Auth.loginWithGoogle(response.credential);
    setAuthLoading(false);
    showToast("Đăng nhập thành công!");
    await loadApp();
  } catch (err) {
    setAuthLoading(false);
    errEl.textContent = "Đăng nhập Google thất bại: " + ((err && err.message) || err);
    errEl.classList.remove("hidden");
  }
}

// ---------------------------------------------------------------------
// Menu tài khoản (góc trên bên phải màn Nhập liệu)
// ---------------------------------------------------------------------
function closeAcctMenu() {
  $("acctMenu").classList.add("hidden");
  $("acctMenuBackdrop").classList.add("hidden");
}
function openAcctMenu() {
  if (!Auth.enabled) {
    $("acctLabel").textContent = "Chế độ lưu trữ";
    $("acctEmail").textContent = Storage.mode === "supabase" ? "Supabase (chung với web)" : "localStorage (chỉ máy này)";
  } else {
    $("acctLabel").textContent = Auth.isAdmin() ? "Admin" : "Người dùng";
    $("acctEmail").textContent = currentUserEmail() || "—";
  }
  $("acctMenu").classList.remove("hidden");
  $("acctMenuBackdrop").classList.remove("hidden");
}
function setupAcctMenu() {
  // Nút tài khoản xuất hiện ở topbar của cả 5 tab chính (id khác nhau vì mỗi
  // <header> chỉ được có 1 phần tử cùng id trong toàn trang), cùng trỏ về 1 menu.
  ["btnAcctMenu", "btnAcctMenu2", "btnAcctMenu3", "btnAcctMenu4", "btnAcctMenu5"].forEach((id) => {
    const btn = $(id);
    if (btn) btn.addEventListener("click", openAcctMenu);
  });
  $("acctMenuBackdrop").addEventListener("click", closeAcctMenu);
}

// ---------------------------------------------------------------------
// Chuyển đổi bản ghi Tiêu chuẩn NSX (Storage) <-> định dạng DGA.evaluate*() cần —
// PORT NGUYÊN VĂN các hàm thuần (không đụng DOM) từ ui-standards.js bên web, để
// mobile áp dụng đúng y hệt tiêu chuẩn riêng NSX mà web app đã cấu hình.
// ---------------------------------------------------------------------
function standardRecordToLimits(rec) {
  return {
    H2: rec.h2 ?? rec.H2, CH4: rec.ch4 ?? rec.CH4, C2H6: rec.c2h6 ?? rec.C2H6,
    C2H4: rec.c2h4 ?? rec.C2H4, C2H2: rec.c2h2 ?? rec.C2H2, CO: rec.co ?? rec.CO, CO2: rec.co2 ?? rec.CO2,
  };
}
function standardRecordToCondemning(rec) {
  const out = {};
  let any = false;
  DGA.GASES.forEach((g) => {
    const v = rec["loaibo_" + g.toLowerCase()] ?? rec["loaibo_" + g];
    if (v !== undefined && v !== null && v !== "") { out[g] = Number(v); any = true; }
  });
  return any ? out : null;
}
function standardRecordToRate(rec) {
  const pairs = [
    ["H2", "rate_h2_lo", "rate_h2_hi"], ["CH4", "rate_ch4_lo", "rate_ch4_hi"],
    ["C2H6", "rate_c2h6_lo", "rate_c2h6_hi"], ["C2H4", "rate_c2h4_lo", "rate_c2h4_hi"],
    ["C2H2", "rate_c2h2_lo", "rate_c2h2_hi"], ["CO", "rate_co_lo", "rate_co_hi"],
    ["CO2", "rate_co2_lo", "rate_co2_hi"],
  ];
  const rate = {};
  let any = false;
  pairs.forEach(([gas, loKey, hiKey]) => {
    if (rec[loKey] !== undefined && rec[loKey] !== null && rec[hiKey] !== undefined && rec[hiKey] !== null) {
      rate[gas] = [Number(rec[loKey]), Number(rec[hiKey])];
      any = true;
    }
  });
  return any ? rate : null;
}
function isOilStandardRecord(rec) { return rec.standard_type === "dau"; }
function isGasStandardRecord(rec) { return !isOilStandardRecord(rec); }
function toManufacturerStandardsForLogic(list) {
  return list.filter(isGasStandardRecord).map((rec) => ({
    manufacturer: rec.manufacturer,
    equipmentType: rec.equipment_type || rec.equipmentType,
    source: rec.source,
    limits: standardRecordToLimits(rec),
    rate: standardRecordToRate(rec),
    condemning: standardRecordToCondemning(rec),
  }));
}
function recordGases(rec) {
  return {
    H2: rec.H2 ?? rec.h2, CH4: rec.CH4 ?? rec.ch4, C2H6: rec.C2H6 ?? rec.c2h6,
    C2H4: rec.C2H4 ?? rec.c2h4, C2H2: rec.C2H2 ?? rec.c2h2, CO: rec.CO ?? rec.co, CO2: rec.CO2 ?? rec.co2,
  };
}

// Tiêu chuẩn dầu NSX (dùng cho DGA.evaluateOilTest/evaluateOltcOilTest ở tab "Dầu
// cách điện") — PORT NGUYÊN VĂN từ ui-standards.js bên web.
function toOilStandardsForLogic(list) {
  return list.filter(isOilStandardRecord).map((rec) => ({
    manufacturer: rec.manufacturer,
    voltageClass: rec.oil_voltage_class,
    oilState: rec.oil_state === "new" ? "new" : "inservice",
    moisture: rec.oil_moisture_ppm,
    tgd90: rec.oil_tgd_90c_percent,
    bdv: rec.oil_bdv_kv,
    source: rec.source,
  }));
}
function oilVoltageClassLabel(vc) {
  const found = DGA.OIL_VOLTAGE_CLASSES.find((c) => c.value === vc);
  return found ? found.label : vc || "—";
}

// ---------------------------------------------------------------------
// State + nạp danh mục từ Storage (CHUNG với web app)
// ---------------------------------------------------------------------
let _allStations = [];
let _allMeasurements = [];
let _allStandards = [];
let _allOilTests = [];
let _allOltcOilTests = [];
let _editingMeasurementId = null;
let _lastAnalysis = null;
let _selectedPha = "A";
let _editingMeasurementAttachment = null; // {bbtn_url, bbtn_name, bbtn_file_id} hoặc null
let _removeBbtnOnSave = false;

async function loadLists() {
  const [stations, measurements, standards, oilTests, oltcOilTests] = await Promise.all([
    Storage.listStations().catch(() => []),
    Storage.listMeasurements().catch(() => []),
    Storage.listStandards().catch(() => []),
    Storage.listOilTests().catch(() => []),
    Storage.listOltcOilTests().catch(() => []),
  ]);
  _allStations = stations || [];
  _allMeasurements = measurements || [];
  _allStandards = standards || [];
  _allOilTests = oilTests || [];
  _allOltcOilTests = oltcOilTests || [];
}

// ---------------------------------------------------------------------
// Combo box (Trạm / Thiết bị) — gõ để tìm, bấm nút để xem danh sách, hoặc nhập
// tự do 1 giá trị chưa có (y hệt hành vi setupCombo() ở app-core.js bên web).
// ---------------------------------------------------------------------
function normVi(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function setupCombo({ input, toggleBtn, listEl, getOptions }) {
  function render(filterText) {
    const options = getOptions();
    const f = normVi(filterText || "");
    const filtered = f ? options.filter((o) => normVi(o.label).includes(f)) : options;
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="combo-empty">Không có gợi ý — gõ để nhập giá trị mới.</div>`;
    } else {
      listEl.innerHTML = filtered.slice(0, 40).map((o) =>
        `<div class="combo-item" data-value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</div>`
      ).join("");
    }
    listEl.classList.remove("hidden");
  }
  function close() { listEl.classList.add("hidden"); }

  toggleBtn.addEventListener("click", () => {
    if (listEl.classList.contains("hidden")) render(""); else close();
  });
  input.addEventListener("focus", () => render(input.value));
  input.addEventListener("input", () => render(input.value));
  listEl.addEventListener("click", (e) => {
    const item = e.target.closest(".combo-item");
    if (!item) return;
    input.value = item.dataset.value;
    close();
    input.dispatchEvent(new Event("change"));
  });
  document.addEventListener("click", (e) => {
    if (!listEl.contains(e.target) && e.target !== input && e.target !== toggleBtn && !toggleBtn.contains(e.target)) close();
  });
}

function stationOptions() {
  return _allStations.slice()
    .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
    .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram }));
}
function deviceOptionsFor(tramInputId, sourceLists) {
  const tram = $(tramInputId).value.trim();
  const byName = new Map();
  sourceLists.forEach((list) => {
    list.forEach((r) => {
      const name = (r.thiet_bi || "").trim();
      if (!name || byName.has(name)) return;
      if (tram && (r.tram || "").trim() !== tram) return;
      byName.set(name, r.tram || "");
    });
  });
  return Array.from(byName.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "vi"))
    .map(([name, t]) => ({ value: name, label: t ? `${name} — ${t}` : name }));
}

function setupCombos() {
  setupCombo({ input: $("f_tram"), toggleBtn: $("f_tram_toggle"), listEl: $("f_tram_list"), getOptions: stationOptions });
  setupCombo({
    input: $("f_thietbi"), toggleBtn: $("f_thietbi_toggle"), listEl: $("f_thietbi_list"),
    getOptions: () => deviceOptionsFor("f_tram", [_allMeasurements]),
  });
  setupCombo({ input: $("o_tram"), toggleBtn: $("o_tram_toggle"), listEl: $("o_tram_list"), getOptions: stationOptions });
  setupCombo({
    input: $("o_thietbi"), toggleBtn: $("o_thietbi_toggle"), listEl: $("o_thietbi_list"),
    getOptions: () => deviceOptionsFor("o_tram", [_allMeasurements, _allOilTests, _allOltcOilTests]),
  });
  setupCombo({ input: $("ot_tram"), toggleBtn: $("ot_tram_toggle"), listEl: $("ot_tram_list"), getOptions: stationOptions });
  setupCombo({
    input: $("ot_thietbi"), toggleBtn: $("ot_thietbi_toggle"), listEl: $("ot_thietbi_list"),
    getOptions: () => deviceOptionsFor("ot_tram", [_allMeasurements, _allOilTests, _allOltcOilTests]),
  });
  setupCombo({
    input: $("s_manufacturer"), toggleBtn: $("s_manufacturer_toggle"), listEl: $("s_manufacturer_list"),
    getOptions: () => Array.from(new Set(_allStandards.map((s) => s.manufacturer).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "vi")).map((m) => ({ value: m, label: m })),
  });
}

async function registerStationIfNew(tenTram) {
  const name = (tenTram || "").trim();
  if (!name) return;
  const already = _allStations.some((s) => (s.ten_tram || "").trim().toLowerCase() === name.toLowerCase());
  if (already) return;
  try {
    await Storage.saveStation({ ma_tram: "", ten_tram: name });
    _allStations = await Storage.listStations();
  } catch (err) {
    console.warn("Không thể tự thêm trạm mới vào danh mục:", err);
  }
}

// ---------------------------------------------------------------------
// Dựng các phần tĩnh của form: Pha, Loại thiết bị, NSX, Lưới nhập khí.
// ---------------------------------------------------------------------
function renderPhaRow() {
  const wrap = $("phaRow");
  wrap.innerHTML = DGA.PHA_OPTIONS.map((o) =>
    `<button type="button" class="pha-pill${o.value === _selectedPha ? " selected" : ""}" data-value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</button>`
  ).join("");
  wrap.querySelectorAll(".pha-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      _selectedPha = btn.dataset.value;
      renderPhaRow();
    });
  });
}

function renderLoaiSelect() {
  const sel = $("f_loai");
  sel.innerHTML = Object.values(DGA.EQUIPMENT_TYPES).map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join("");
  sel.addEventListener("change", () => {
    $("f_mbasubtype_wrap").classList.toggle("hidden", sel.value !== DGA.EQUIPMENT_TYPES.MBA);
    refreshManufacturerOptions();
  });
}
function renderMbaSubtypeSelect() {
  $("f_mbasubtype").innerHTML = Object.values(DGA.MBA_SUBTYPES).map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join("");
}
function refreshManufacturerOptions() {
  const sel = $("f_nsx");
  const loai = $("f_loai").value;
  const currentVal = sel.value;
  const options = _allStandards.filter((s) => (s.equipment_type === loai || s.equipmentType === loai) && !isOilStandardRecord(s));
  sel.innerHTML = '<option value="">— Không có / dùng QĐ1901 —</option>' +
    options.map((s) => `<option value="${escapeHtml(s.manufacturer)}">${escapeHtml(s.manufacturer)}</option>`).join("");
  if (options.some((o) => o.manufacturer === currentVal)) sel.value = currentVal;
}

// Dropdown "Nhà sản xuất" ở tab Dầu cách điện (o_nsx / ot_nsx) — chỉ liệt kê NSX
// có tiêu chuẩn DẦU (standard_type = "dau").
function refreshOilManufacturerOptions() {
  const names = Array.from(new Set(_allStandards.filter(isOilStandardRecord).map((s) => s.manufacturer).filter(Boolean)));
  names.sort((a, b) => a.localeCompare(b, "vi"));
  ["o_nsx", "ot_nsx"].forEach((id) => {
    const sel = $(id);
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">— Không có / dùng QĐ1901 —</option>' +
      names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
    if (names.includes(currentVal)) sel.value = currentVal;
  });
}

const GAS_LIMITS_HINT = { H2: 300, CH4: 30, C2H6: 50, C2H4: 10, C2H2: 2, CO: 300, CO2: 900 };
function renderGasGrid() {
  $("gasGrid").innerHTML = DGA.GASES.map((g) =>
    `<div class="gas-field">
      <label>${g} <span class="gas-hint">/ ${GAS_LIMITS_HINT[g]}</span></label>
      <input id="g_${g}" type="number" step="0.01" min="0" class="input" placeholder="0" />
    </div>`
  ).join("");
}

function clearForm() {
  _editingMeasurementId = null;
  $("editingBanner").classList.add("hidden");
  $("btnCancelEdit2").classList.add("hidden");
  $("btnAnalyze").textContent = "Phân tích & Lưu";
  $("f_tram").value = "";
  $("f_thietbi").value = "";
  _selectedPha = "A";
  renderPhaRow();
  $("f_loai").value = DGA.EQUIPMENT_TYPES.TI;
  $("f_mbasubtype_wrap").classList.add("hidden");
  $("f_nsx").value = "";
  $("f_ngay").value = new Date().toISOString().slice(0, 10);
  $("f_landocount").value = 1;
  $("f_ghichu").value = "";
  DGA.GASES.forEach((g) => { const el = $("g_" + g); if (el) el.value = ""; });
  $("entryError").classList.add("hidden");
  $("f_bbtn").value = "";
  $("bbtnImportHint").textContent = "";
  _editingMeasurementAttachment = null;
  _removeBbtnOnSave = false;
  renderBbtnCurrent();
}

function onEditMeasurement(rec) {
  _editingMeasurementId = rec.id;
  $("editingBanner").classList.remove("hidden");
  $("btnCancelEdit2").classList.remove("hidden");
  $("btnAnalyze").textContent = "Cập nhật & Lưu";
  $("f_tram").value = rec.tram || "";
  $("f_thietbi").value = rec.thiet_bi || "";
  _selectedPha = rec.pha || "A";
  renderPhaRow();
  $("f_loai").value = rec.equipment_type || DGA.EQUIPMENT_TYPES.TI;
  $("f_mbasubtype_wrap").classList.toggle("hidden", rec.equipment_type !== DGA.EQUIPMENT_TYPES.MBA);
  refreshManufacturerOptions();
  if (rec.mba_subtype) $("f_mbasubtype").value = rec.mba_subtype;
  $("f_nsx").value = rec.manufacturer || "";
  $("f_ngay").value = (rec.sample_date || "").slice(0, 10);
  $("f_landocount").value = rec.lan_do || 1;
  $("f_ghichu").value = rec.ghi_chu || "";
  const g = recordGases(rec);
  DGA.GASES.forEach((gas) => { const el = $("g_" + gas); if (el) el.value = g[gas] ?? ""; });
  $("f_bbtn").value = "";
  $("bbtnImportHint").textContent = "";
  _removeBbtnOnSave = false;
  _editingMeasurementAttachment = rec.bbtn_url ? { bbtn_url: rec.bbtn_url, bbtn_name: rec.bbtn_name, bbtn_file_id: rec.bbtn_file_id } : null;
  renderBbtnCurrent();
  showScreen("screenEntry");
}

// ---------------------------------------------------------------------
// Vẽ Tam giác Duval 1 — PORT NGUYÊN VĂN từ ui-dga.js (chỉ target #duvalSvg)
// ---------------------------------------------------------------------
function duvalToSvgY(y) { return 86.602540378 - y; }
function duvalEdgePoint(pct) {
  const h = 86.602540378;
  const x = (pct.pctCH4 / 100) * 50 + (pct.pctC2H4 / 100) * 100;
  const y = (pct.pctCH4 / 100) * h;
  return { x, y: duvalToSvgY(y) };
}
function drawDuvalTriangleBase() {
  const svg = $("duvalSvg");
  if (!svg) return;
  const h = 86.602540378;
  let s = "";
  s += `<polygon class="duval-tri-line" points="0,${h} 100,${h} 50,0" />`;
  for (let k = 10; k < 100; k += 10) {
    const y = duvalToSvgY((k / 100) * h);
    const xL = (k / 100) * 50;
    const xR = 100 - (k / 100) * 50;
    s += `<line class="duval-grid-line" x1="${xL}" y1="${y}" x2="${xR}" y2="${y}" />`;
  }
  const P = (m, e, a) => duvalEdgePoint({ pctCH4: m, pctC2H4: e, pctC2H2: a });
  const zoneLines = [
    [P(98, 2, 0), P(98, 0, 2)],
    [P(96, 0, 4), P(46, 50, 4)],
    [P(90, 10, 0), P(86, 10, 4)],
    [P(50, 50, 0), P(46, 50, 4)],
    [P(64, 23, 13), P(0, 23, 77)],
    [P(64, 23, 13), P(87, 0, 13)],
    [P(49, 38, 13), P(0, 38, 62)],
  ];
  zoneLines.forEach(([a, b]) => { s += `<line class="duval-zone-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`; });
  s += `<text class="duval-label" x="50" y="-2" text-anchor="middle">CH4</text>`;
  s += `<text class="duval-label" x="-2" y="${h + 4}" text-anchor="start">C2H2</text>`;
  s += `<text class="duval-label" x="102" y="${h + 4}" text-anchor="end">C2H4</text>`;
  s += `<text class="duval-label" x="50" y="${h * 0.35}" text-anchor="middle">D1</text>`;
  s += `<text class="duval-label" x="30" y="${h * 0.6}" text-anchor="middle">D2</text>`;
  s += `<text class="duval-label" x="70" y="${h * 0.85}" text-anchor="middle">T3</text>`;
  s += `<text class="duval-label" x="35" y="${h * 0.92}" text-anchor="middle">T2</text>`;
  s += `<text class="duval-label" x="15" y="${h * 0.97}" text-anchor="middle">T1</text>`;
  svg.innerHTML = s;
}
function drawDuvalPoint(xyMath) {
  const svg = $("duvalSvg");
  if (!svg) return;
  const pt = { x: xyMath.x, y: duvalToSvgY(xyMath.y) };
  svg.innerHTML += `<circle class="duval-point" cx="${pt.x}" cy="${pt.y}" r="2.2" />`;
}

function verdictPill(v) {
  if (v === "Đạt") return `<span class="pill ok">Đạt</span>`;
  if (v === "Không có ngưỡng") return `<span class="pill muted">—</span>`;
  return `<span class="pill bad">${escapeHtml(v)}</span>`;
}

// ---------------------------------------------------------------------
// Phân tích & Lưu — PORT logic điều phối từ onAnalyze() (ui-dga.js), cùng thứ
// tự gọi dga-logic.js y hệt bản web nên 2 bản LUÔN cho ra kết luận giống nhau
// với cùng 1 số liệu đầu vào.
// ---------------------------------------------------------------------
async function onAnalyze() {
  $("entryError").classList.add("hidden");
  const gases = {};
  DGA.GASES.forEach((g) => { const v = $("g_" + g).value; gases[g] = v === "" ? 0 : Number(v); });

  const equipmentType = $("f_loai").value;
  const mbaSubtype = equipmentType === DGA.EQUIPMENT_TYPES.MBA ? $("f_mbasubtype").value : null;

  const measurement = {
    id: _editingMeasurementId || undefined,
    tram: $("f_tram").value.trim(),
    thiet_bi: $("f_thietbi").value.trim(),
    equipment_type: equipmentType,
    mba_subtype: mbaSubtype,
    manufacturer: $("f_nsx").value || null,
    pha: _selectedPha,
    lan_do: Number($("f_landocount").value) || 1,
    sample_date: $("f_ngay").value,
    ghi_chu: $("f_ghichu").value.trim(),
    ...gases,
  };

  if (!measurement.thiet_bi || !measurement.sample_date) {
    $("entryError").textContent = "Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.";
    $("entryError").classList.remove("hidden");
    return;
  }

  const btn = $("btnAnalyze");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang phân tích...";

  try {
    const logicMeasurement = { equipmentType: measurement.equipment_type, manufacturer: measurement.manufacturer, mbaSubtype };
    const standard = DGA.resolveStandard(logicMeasurement, toManufacturerStandardsForLogic(_allStandards));

    const tcg = DGA.computeTCG(gases);
    const evalRows = DGA.evaluateAbsolute(gases, standard.limits);
    const overall = DGA.overallVerdict(evalRows);
    const exceedCount = DGA.countExceedTypical(gases, measurement.equipment_type, logicMeasurement);

    const ratios = DGA.computeRatios(gases);
    const diagnosis = DGA.diagnoseRatios(ratios, standard.pdThreshold);
    const applicability = DGA.ratioApplicability(exceedCount);
    const duval = DGA.diagnoseDuval1(gases);
    const condemningRows = DGA.evaluateCondemning(gases, standard.condemning);

    let all;
    try {
      all = await Storage.listMeasurements();
    } catch (err) {
      $("entryError").textContent = storageErrorMessage(err);
      $("entryError").classList.remove("hidden");
      return;
    }
    const prior = all
      .filter((r) => r.tram === measurement.tram && r.thiet_bi === measurement.thiet_bi && r.pha === measurement.pha)
      .filter((r) => new Date(r.sample_date) < new Date(measurement.sample_date))
      .sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date))[0];

    let rateRows = null;
    let priorDiagnosis = null;
    if (prior) {
      const priorGases = recordGases(prior);
      const deltaDays = Math.round((new Date(measurement.sample_date) - new Date(prior.sample_date)) / 86400000);
      rateRows = DGA.computeRateOfChange(priorGases, gases, deltaDays, standard.rate, measurement.equipment_type);
      priorDiagnosis = DGA.diagnoseRatios(DGA.computeRatios(priorGases), standard.pdThreshold);
    }

    const recs = DGA.buildRecommendations({ overallOk: overall === "Đạt", exceedCount, diagnosis, duval, rateRows, condemningRows });
    const overallStatus = DGA.computeOverallStatus({ overallOk: overall === "Đạt", exceedCount, diagnosis, priorDiagnosis, rateRows, condemningRows });

    _lastAnalysis = { measurement, tcg, evalRows, overall, diagnosis, standard, ratios, applicability, duval, rateRows, prior, recs, condemningRows, overallStatus };
    renderResults(_lastAnalysis);
    showScreen("screenResults");

    if (!canSaveEntry()) { showToast("Đăng nhập để lưu lại lần đo này."); return; }

    const wasEditingMeasurement = !!_editingMeasurementId;
    measurement.id = measurement.id || Storage.newId();

    const bbtnFile = $("f_bbtn").files[0] || null;
    if (bbtnFile) {
      btn.textContent = "Đang tải lên Biên bản...";
      try {
        const uploaded = await Storage.uploadAttachment(measurement.id, bbtnFile);
        Object.assign(measurement, uploaded);
      } catch (err) {
        showToast("Tải lên Biên bản (PDF) thất bại: " + ((err && err.message) || err) + " — lần đo vẫn được lưu, không kèm file.");
      }
    } else if (wasEditingMeasurement && _removeBbtnOnSave) {
      Object.assign(measurement, { bbtn_url: null, bbtn_name: null, bbtn_file_id: null });
    } else if (wasEditingMeasurement && _editingMeasurementAttachment) {
      Object.assign(measurement, _editingMeasurementAttachment);
    }

    await Storage.addMeasurement(measurement);
    await registerStationIfNew(measurement.tram);
    _allMeasurements = await Storage.listMeasurements();
    showToast(_editingMeasurementId ? "Đã cập nhật lần đo." : "Đã lưu lần đo vào " + (Storage.mode === "gsheet" ? "Google Sheets" : Storage.mode === "supabase" ? "Supabase" : "bộ nhớ máy") + ".");
    _editingMeasurementId = null;
    _editingMeasurementAttachment = null;
    _removeBbtnOnSave = false;
    $("f_bbtn").value = "";
    renderBbtnCurrent();
    $("editingBanner").classList.add("hidden");
    $("btnCancelEdit2").classList.add("hidden");
  } catch (err) {
    $("entryError").textContent = storageErrorMessage(err);
    $("entryError").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function renderResults(a) {
  const { tcg, evalRows, overall, diagnosis, standard, ratios, applicability, duval, rateRows, prior, recs, condemningRows, overallStatus } = a;

  if (overallStatus) {
    const STATUS_ICON = { normal: "check-circle", alert: "alert-triangle", alarm: "alert-octagon" };
    $("overallStatusBanner").className = "status-banner status-" + overallStatus.level;
    $("statusBadgeText").innerHTML =
      `<svg class="icon-svg" aria-hidden="true"><use href="#icon-${STATUS_ICON[overallStatus.level] || "check-circle"}"></use></svg>` + escapeHtml(overallStatus.label);
    $("statusReasonsList").innerHTML = overallStatus.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    $("statusActionText").textContent = overallStatus.action;
  }

  $("r_tcg").textContent = tcg.toFixed(1) + " ppm";
  $("r_overall").innerHTML = overall === "Đạt" ? `<span class="pill ok">Đạt</span>` : `<span class="pill bad">Không đạt</span>`;
  $("r_diag").textContent = diagnosis;
  $("r_duval").textContent = duval ? duval.zone : "—";
  $("r_standard").textContent = standard.sourceLabel;

  const condemnMap = {};
  (condemningRows || []).forEach((r) => (condemnMap[r.gas] = r));
  const condemnExceeded = DGA.condemningExceededRows(condemningRows);
  if (condemnExceeded.length > 0) {
    $("condemnBanner").classList.remove("hidden");
    $("condemnBanner").innerHTML = `⚠ CẢNH BÁO NGHIÊM TRỌNG — VƯỢT NGƯỠNG LOẠI BỎ ở ${condemnExceeded.length} khí: ` +
      condemnExceeded.map((r) => `${r.gas} (${r.value} &gt; ${r.limit} ppm)`).join(", ") + `.`;
  } else {
    $("condemnBanner").classList.add("hidden");
  }

  $("r_gasTable").innerHTML = evalRows.map((r) => {
    const c = condemnMap[r.gas];
    const condemnCell = !c ? "—" : c.exceeded ? `<strong style="color:var(--bad);">${c.limit} ⚠</strong>` : c.limit;
    return `<tr><td>${r.gas}</td><td>${r.value}</td><td>${r.limit ?? "—"}</td><td>${condemnCell}</td><td>${verdictPill(r.verdict)}</td></tr>`;
  }).join("");

  $("r_ratio1").textContent = ratios.c2h2_c2h4.toFixed(3);
  $("r_ratio2").textContent = ratios.ch4_h2.toFixed(3);
  $("r_ratio3").textContent = ratios.c2h4_c2h6.toFixed(3);
  $("r_pdthreshold").textContent = "< " + standard.pdThreshold;
  $("r_applicability").textContent = applicability;

  if (duval) {
    $("r_pctch4").textContent = duval.pctCH4.toFixed(1) + "%";
    $("r_pctc2h4").textContent = duval.pctC2H4.toFixed(1) + "%";
    $("r_pctc2h2").textContent = duval.pctC2H2.toFixed(1) + "%";
    $("r_duvalzone").innerHTML = `<strong>${escapeHtml(duval.zone)}</strong> — ${escapeHtml(duval.label)}`;
    drawDuvalTriangleBase();
    drawDuvalPoint(duval.xy);
  } else {
    $("r_pctch4").textContent = $("r_pctc2h4").textContent = $("r_pctc2h2").textContent = "—";
    $("r_duvalzone").textContent = "Không đủ dữ liệu (cần CH4/C2H4/C2H2 > 0)";
    drawDuvalTriangleBase();
  }

  if (rateRows) {
    $("rateSection").classList.remove("hidden");
    $("rateNote").textContent = `So với lần đo trước (${prior.sample_date}) — ` +
      (rateRows[0].officialForEquipment ? "Bảng 65 áp dụng CHÍNH THỨC cho MBA/Kháng dầu." : "Chỉ dùng để THAM KHẢO với loại thiết bị này.");
    $("r_rateTable").innerHTML = rateRows.map((r) => `
      <tr><td>${r.gas}</td><td>${r.before}</td><td>${r.after}</td><td>${r.delta}</td><td>${r.ratePerYear}</td>
      <td>${r.rangeLo}–${r.rangeHi}</td><td>${r.verdict.startsWith("⚠") ? `<span class="pill warn">${escapeHtml(r.verdict)}</span>` : escapeHtml(r.verdict)}</td></tr>
    `).join("");
  } else {
    $("rateSection").classList.add("hidden");
  }

  $("r_recs").innerHTML = recs.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
}

async function onExportBbtn() {
  if (!_lastAnalysis) return;
  const btn = $("btnExportBbtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Đang tạo BBTN...";
  try {
    const fileName = await BbtnExport.exportBbtnDocx(_lastAnalysis);
    showToast("Đã tải xuống " + fileName);
  } catch (err) {
    showToast("Lỗi xuất BBTN: " + ((err && err.message) || err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ---------------------------------------------------------------------
// Lịch sử đo
// ---------------------------------------------------------------------
function quickEvaluate(rec) {
  const g = recordGases(rec);
  const logicMeasurement = { equipmentType: rec.equipment_type, manufacturer: rec.manufacturer, mbaSubtype: rec.mba_subtype };
  const standard = DGA.resolveStandard(logicMeasurement, toManufacturerStandardsForLogic(_allStandards));
  const tcg = DGA.computeTCG(g);
  const evalRows = DGA.evaluateAbsolute(g, standard.limits);
  const overall = DGA.overallVerdict(evalRows);
  return { tcg, overall };
}

async function renderHistory() {
  const list = _allMeasurements.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  $("historyEmpty").classList.toggle("hidden", list.length > 0);
  $("historyList").innerHTML = list.map((rec) => {
    let tcgText = "—", pillHtml = "";
    try {
      const { tcg, overall } = quickEvaluate(rec);
      tcgText = tcg.toFixed(1) + " ppm";
      pillHtml = overall === "Đạt" ? `<span class="pill ok">Đạt</span>` : `<span class="pill bad">Không đạt</span>`;
    } catch (e) { /* bản ghi thiếu dữ liệu — vẫn hiện dòng, chỉ bỏ qua đánh giá nhanh */ }
    const phaText = rec.pha ? DGA.phaLabelWithPrefix(rec.pha) : "";
    return `
      <div class="history-card" data-id="${escapeHtml(rec.id)}">
        <div class="history-main">
          <div class="history-title">${escapeHtml(rec.thiet_bi || "?")}</div>
          <div class="history-sub">${escapeHtml(rec.tram || "—")} · ${escapeHtml(phaText)} · ${escapeHtml((rec.sample_date || "").slice(0, 10))} · ${tcgText}</div>
        </div>
        <div class="history-right">
          ${pillHtml}
          <svg class="icon-svg-sm" aria-hidden="true"><use href="#icon-chevron-right"></use></svg>
        </div>
      </div>`;
  }).join("");

  $("historyList").querySelectorAll(".history-card").forEach((card) => {
    card.addEventListener("click", () => {
      const rec = _allMeasurements.find((r) => String(r.id) === card.dataset.id);
      if (rec) onEditMeasurement(rec);
    });
  });
}

// =======================================================================
// TAB "DẦU CÁCH ĐIỆN" — dầu chính MBA/Kháng dầu (Bảng 54/55/58) — PORT từ
// ui-oil.js bên web, chỉ đổi phần render sang danh sách dạng thẻ (list-card)
// thay vì bảng ngang, cho hợp màn hình dọc.
// =======================================================================
function populateOilVoltageClasses() {
  const optionsHtml = DGA.OIL_VOLTAGE_CLASSES.map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`).join("");
  $("o_voltage_class").innerHTML = optionsHtml;
  $("s_oil_voltage_class").innerHTML = optionsHtml;
}
function toggleOilMembraneField() {
  const vc = $("o_voltage_class").value;
  const withMembrane = DGA.bang58WaterLimits(vc, true);
  const withoutMembrane = DGA.bang58WaterLimits(vc, false);
  const applicable = withMembrane.new !== withoutMembrane.new || withMembrane.inservice !== withoutMembrane.inservice;
  $("o_membrane_wrap").classList.toggle("hidden", !applicable);
  if (!applicable) $("o_membrane").checked = false;
}
let _editingOilTestId = null;
function clearOilForm() {
  ["o_tram", "o_thietbi", "o_ghichu", "o_moisture", "o_tgd90", "o_bdv"].forEach((id) => { $(id).value = ""; });
  $("o_membrane").checked = false;
  $("o_ngay").value = new Date().toISOString().slice(0, 10);
  $("oilResultsPanel").classList.add("hidden");
  resetOilTestEditState();
}
function resetOilTestEditState() {
  _editingOilTestId = null;
  $("editingOilTestNote").classList.add("hidden");
  $("btnCancelEditOilTest").classList.add("hidden");
  $("btnAnalyzeOil").textContent = "Đánh giá & Lưu";
}
function onEditOilTest(rec) {
  if (!canEditRecord(rec)) return;
  _editingOilTestId = rec.id;
  $("o_tram").value = rec.tram || "";
  $("o_thietbi").value = rec.thiet_bi || "";
  $("o_voltage_class").value = rec.voltage_class || "";
  toggleOilMembraneField();
  $("o_oilstate").value = rec.oil_state || "inservice";
  $("o_nsx").value = rec.manufacturer || "";
  $("o_membrane").checked = !!rec.has_membrane_n2;
  $("o_ngay").value = (rec.sample_date || "").slice(0, 10);
  $("o_moisture").value = rec.moisture_ppm ?? "";
  $("o_tgd90").value = rec.tgd_90c_percent ?? "";
  $("o_bdv").value = rec.bdv_kv ?? "";
  $("o_ghichu").value = rec.ghi_chu || "";
  $("editingOilTestNote").classList.remove("hidden");
  $("btnCancelEditOilTest").classList.remove("hidden");
  $("btnAnalyzeOil").textContent = "Cập nhật & Lưu";
  showScreen("screenDau");
  $("o_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}
async function onAnalyzeOil() {
  const voltageClass = $("o_voltage_class").value;
  const oilState = $("o_oilstate").value;
  const hasMembraneN2 = !$("o_membrane_wrap").classList.contains("hidden") && $("o_membrane").checked;
  const manufacturer = $("o_nsx").value || null;
  const oilTest = {
    id: _editingOilTestId || undefined,
    tram: $("o_tram").value.trim(),
    thiet_bi: $("o_thietbi").value.trim(),
    voltage_class: voltageClass,
    oil_state: oilState,
    has_membrane_n2: hasMembraneN2,
    manufacturer,
    sample_date: $("o_ngay").value,
    moisture_ppm: $("o_moisture").value === "" ? null : Number($("o_moisture").value),
    tgd_90c_percent: $("o_tgd90").value === "" ? null : Number($("o_tgd90").value),
    bdv_kv: $("o_bdv").value === "" ? null : Number($("o_bdv").value),
    ghi_chu: $("o_ghichu").value.trim(),
  };
  if (!oilTest.thiet_bi || !oilTest.sample_date) { showToast("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu."); return; }
  if (oilTest.moisture_ppm === null && oilTest.tgd_90c_percent === null && oilTest.bdv_kv === null) {
    showToast("Vui lòng nhập ít nhất 1 trong 3 giá trị: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng dầu.");
    return;
  }
  const evalResult = DGA.evaluateOilTest({
    voltageClass, oilState, hasMembraneN2, manufacturer,
    manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
    moisture: oilTest.moisture_ppm, tgd90: oilTest.tgd_90c_percent, bdv: oilTest.bdv_kv,
  });
  renderOilResults(evalResult);
  if (!canSaveEntry()) { showToast("Đăng nhập để lưu lại kết quả này."); return; }
  const wasEditing = !!_editingOilTestId;
  oilTest.id = oilTest.id || Storage.newId();
  try {
    await Storage.addOilTest(oilTest);
    await registerStationIfNew(oilTest.tram);
    _allOilTests = await Storage.listOilTests();
    resetOilTestEditState();
    await refreshOilTestsUI();
    showToast(wasEditing ? "Đã cập nhật thí nghiệm dầu." : "Đã lưu thí nghiệm dầu.");
  } catch (err) {
    showToast("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + ((err && err.message) || err));
  }
}
function renderOilResultRows(rows) {
  return rows.map((r) => {
    const limitText = r.limit === null || r.limit === undefined ? "—" : `${r.direction === "ge" ? "≥ " : "≤ "}${r.limit} ${r.unit}`;
    return `<tr><td>${escapeHtml(r.label)}</td><td>${r.value ?? "—"}</td><td>${limitText}</td><td>${verdictPill(r.verdict)}</td></tr>`;
  }).join("");
}
function overallPillHtml(overall) {
  if (overall === "Đạt") return `<span class="pill ok">Đạt</span>`;
  if (overall === "Chưa đủ dữ liệu") return `<span class="pill muted">—</span>`;
  return `<span class="pill bad">Không đạt</span>`;
}
function renderOilResults(evalResult) {
  $("oilResultsPanel").classList.remove("hidden");
  $("o_overall").innerHTML = overallPillHtml(evalResult.overall);
  $("o_resultTable").innerHTML = renderOilResultRows(evalResult.rows);
}
function quickEvaluateOilTest(rec) {
  return DGA.evaluateOilTest({
    voltageClass: rec.voltage_class, oilState: rec.oil_state, hasMembraneN2: !!rec.has_membrane_n2, manufacturer: rec.manufacturer,
    manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
    moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
  });
}
function oilTestCardHtml(rec) {
  let pill = "";
  try { pill = overallPillHtml(quickEvaluateOilTest(rec).overall); } catch (e) { /* thiếu dữ liệu — bỏ qua pill */ }
  const stateLabel = rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành";
  const canEdit = canEditRecord(rec), canDel = canWrite();
  return `<div class="list-card" data-id="${escapeHtml(rec.id)}">
    <div class="list-card-top">
      <div>
        <div class="list-card-title">${escapeHtml(rec.thiet_bi || "?")} — ${escapeHtml(rec.tram || "—")}</div>
        <div class="list-card-sub">${escapeHtml((rec.sample_date || "").slice(0, 10))} · ${escapeHtml(oilVoltageClassLabel(rec.voltage_class))} · ${stateLabel}</div>
      </div>
      ${pill}
    </div>
    <div class="list-card-meta">Độ ẩm ${rec.moisture_ppm ?? "—"} ppm · tgδ ${rec.tgd_90c_percent ?? "—"}% · BDV ${rec.bdv_kv ?? "—"} kV</div>
    ${(canEdit || canDel) ? `<div class="list-card-actions">
      ${canEdit ? `<button data-action="edit">Sửa</button>` : ""}
      ${canDel ? `<button data-action="delete" class="danger">Xóa</button>` : ""}
    </div>` : ""}
  </div>`;
}
function wireOilHistoryCardActions() {
  $("oilHistoryList").querySelectorAll(".list-card").forEach((card) => {
    const rec = _allOilTests.find((r) => String(r.id) === card.dataset.id);
    if (!rec) return;
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener("click", () => onEditOilTest(rec));
    const delBtn = card.querySelector('[data-action="delete"]');
    if (delBtn) delBtn.addEventListener("click", async () => {
      if (!confirm(`Xóa thí nghiệm dầu của ${rec.thiet_bi || "?"} ngày ${(rec.sample_date || "").slice(0, 10)}?`)) return;
      try {
        await Storage.deleteOilTest(rec.id);
        _allOilTests = await Storage.listOilTests();
        await refreshOilTestsUI();
        showToast("Đã xóa thí nghiệm dầu.");
      } catch (err) {
        showToast("Xóa thất bại: " + ((err && err.message) || err));
      }
    });
  });
}
async function refreshOilTestsUI() {
  const sorted = _allOilTests.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  $("oilHistoryEmpty").classList.toggle("hidden", sorted.length > 0);
  $("oilHistoryList").innerHTML = sorted.map(oilTestCardHtml).join("");
  wireOilHistoryCardActions();
}

// =======================================================================
// TAB "DẦU CÁCH ĐIỆN" — dầu OLTC (Điều 37, Bảng 49) — PORT từ ui-oltc.js
// =======================================================================
function populateOltcOptions() {
  $("ot_samplepoint").innerHTML = DGA.OLTC_SAMPLE_POINTS.map((p) => `<option value="${p.value}">${escapeHtml(p.label)}</option>`).join("");
  $("ot_voltage_class").innerHTML = DGA.OIL_VOLTAGE_CLASSES.map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`).join("");
}
function toggleOltcPhaseField() {
  $("ot_phase_wrap").classList.toggle("hidden", $("ot_samplepoint").value !== "pharieng");
}
function toggleOltcMembraneField() {
  const vc = $("ot_voltage_class").value;
  const withMembrane = DGA.bang58WaterLimits(vc, true);
  const withoutMembrane = DGA.bang58WaterLimits(vc, false);
  const applicable = withMembrane.new !== withoutMembrane.new || withMembrane.inservice !== withoutMembrane.inservice;
  $("ot_membrane_wrap").classList.toggle("hidden", !applicable);
  if (!applicable) $("ot_membrane").checked = false;
}
function oltcSamplePointLabel(sp) {
  const found = DGA.OLTC_SAMPLE_POINTS.find((p) => p.value === sp);
  return found ? found.label : sp || "—";
}
let _editingOltcOilTestId = null;
function clearOltcOilForm() {
  ["ot_tram", "ot_thietbi", "ot_ghichu", "ot_moisture", "ot_tgd90", "ot_bdv"].forEach((id) => { $(id).value = ""; });
  $("ot_membrane").checked = false;
  $("ot_ngay").value = new Date().toISOString().slice(0, 10);
  $("oltcOilResultsPanel").classList.add("hidden");
  resetOltcOilTestEditState();
}
function resetOltcOilTestEditState() {
  _editingOltcOilTestId = null;
  $("editingOltcOilTestNote").classList.add("hidden");
  $("btnCancelEditOltcOilTest").classList.add("hidden");
  $("btnAnalyzeOltcOil").textContent = "Đánh giá & Lưu";
}
function onEditOltcOilTest(rec) {
  if (!canEditRecord(rec)) return;
  _editingOltcOilTestId = rec.id;
  $("ot_tram").value = rec.tram || "";
  $("ot_thietbi").value = rec.thiet_bi || "";
  $("ot_samplepoint").value = rec.oltc_sample_point || "";
  toggleOltcPhaseField();
  if (rec.phase) $("ot_phase").value = rec.phase;
  $("ot_voltage_class").value = rec.voltage_class || "";
  toggleOltcMembraneField();
  $("ot_oilstate").value = rec.oil_state || "inservice";
  $("ot_nsx").value = rec.manufacturer || "";
  $("ot_membrane").checked = !!rec.has_membrane_n2;
  $("ot_ngay").value = (rec.sample_date || "").slice(0, 10);
  $("ot_moisture").value = rec.moisture_ppm ?? "";
  $("ot_tgd90").value = rec.tgd_90c_percent ?? "";
  $("ot_bdv").value = rec.bdv_kv ?? "";
  $("ot_ghichu").value = rec.ghi_chu || "";
  $("editingOltcOilTestNote").classList.remove("hidden");
  $("btnCancelEditOltcOilTest").classList.remove("hidden");
  $("btnAnalyzeOltcOil").textContent = "Cập nhật & Lưu";
  showScreen("screenDau");
  $("ot_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}
async function onAnalyzeOltcOil() {
  const oltcSamplePoint = $("ot_samplepoint").value;
  const phase = oltcSamplePoint === "pharieng" ? $("ot_phase").value : "";
  const voltageClass = $("ot_voltage_class").value;
  const oilState = $("ot_oilstate").value;
  const hasMembraneN2 = !$("ot_membrane_wrap").classList.contains("hidden") && $("ot_membrane").checked;
  const manufacturer = $("ot_nsx").value || null;
  const oltcOilTest = {
    id: _editingOltcOilTestId || undefined,
    tram: $("ot_tram").value.trim(), thiet_bi: $("ot_thietbi").value.trim(),
    oltc_sample_point: oltcSamplePoint, phase, voltage_class: voltageClass, oil_state: oilState,
    has_membrane_n2: hasMembraneN2, manufacturer, sample_date: $("ot_ngay").value,
    moisture_ppm: $("ot_moisture").value === "" ? null : Number($("ot_moisture").value),
    tgd_90c_percent: $("ot_tgd90").value === "" ? null : Number($("ot_tgd90").value),
    bdv_kv: $("ot_bdv").value === "" ? null : Number($("ot_bdv").value),
    ghi_chu: $("ot_ghichu").value.trim(),
  };
  if (!oltcOilTest.thiet_bi || !oltcOilTest.sample_date) { showToast("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu."); return; }
  if (oltcOilTest.moisture_ppm === null && oltcOilTest.tgd_90c_percent === null && oltcOilTest.bdv_kv === null) {
    showToast("Vui lòng nhập ít nhất 1 trong 3 giá trị: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng dầu.");
    return;
  }
  const evalResult = DGA.evaluateOltcOilTest({
    oltcSamplePoint, voltageClass, oilState, hasMembraneN2, manufacturer,
    manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
    moisture: oltcOilTest.moisture_ppm, tgd90: oltcOilTest.tgd_90c_percent, bdv: oltcOilTest.bdv_kv,
  });
  renderOltcOilResults(evalResult);
  if (!canSaveEntry()) { showToast("Đăng nhập để lưu lại kết quả này."); return; }
  const wasEditing = !!_editingOltcOilTestId;
  oltcOilTest.id = oltcOilTest.id || Storage.newId();
  try {
    await Storage.addOltcOilTest(oltcOilTest);
    await registerStationIfNew(oltcOilTest.tram);
    _allOltcOilTests = await Storage.listOltcOilTests();
    resetOltcOilTestEditState();
    await refreshOltcOilTestsUI();
    showToast(wasEditing ? "Đã cập nhật thí nghiệm dầu OLTC." : "Đã lưu thí nghiệm dầu OLTC.");
  } catch (err) {
    showToast("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + ((err && err.message) || err));
  }
}
function renderOltcOilResults(evalResult) {
  $("oltcOilResultsPanel").classList.remove("hidden");
  $("ot_overall").innerHTML = overallPillHtml(evalResult.overall);
  $("ot_resultTable").innerHTML = renderOilResultRows(evalResult.rows);
}
function quickEvaluateOltcOilTest(rec) {
  return DGA.evaluateOltcOilTest({
    oltcSamplePoint: rec.oltc_sample_point, voltageClass: rec.voltage_class, oilState: rec.oil_state,
    hasMembraneN2: !!rec.has_membrane_n2, manufacturer: rec.manufacturer,
    manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
    moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
  });
}
function oltcOilTestCardHtml(rec) {
  let pill = "";
  try { pill = overallPillHtml(quickEvaluateOltcOilTest(rec).overall); } catch (e) { /* thiếu dữ liệu — bỏ qua pill */ }
  const stateLabel = rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành";
  const canEdit = canEditRecord(rec), canDel = canWrite();
  return `<div class="list-card" data-id="${escapeHtml(rec.id)}">
    <div class="list-card-top">
      <div>
        <div class="list-card-title">${escapeHtml(rec.thiet_bi || "?")} — ${escapeHtml(rec.tram || "—")}</div>
        <div class="list-card-sub">${escapeHtml((rec.sample_date || "").slice(0, 10))} · ${escapeHtml(oltcSamplePointLabel(rec.oltc_sample_point))}${rec.phase ? (" · " + escapeHtml(DGA.phaLabelWithPrefix(rec.phase))) : ""} · ${escapeHtml(oilVoltageClassLabel(rec.voltage_class))} · ${stateLabel}</div>
      </div>
      ${pill}
    </div>
    <div class="list-card-meta">Độ ẩm ${rec.moisture_ppm ?? "—"} ppm · tgδ ${rec.tgd_90c_percent ?? "—"}% · BDV ${rec.bdv_kv ?? "—"} kV</div>
    ${(canEdit || canDel) ? `<div class="list-card-actions">
      ${canEdit ? `<button data-action="edit">Sửa</button>` : ""}
      ${canDel ? `<button data-action="delete" class="danger">Xóa</button>` : ""}
    </div>` : ""}
  </div>`;
}
function wireOltcOilHistoryCardActions() {
  $("oltcOilHistoryList").querySelectorAll(".list-card").forEach((card) => {
    const rec = _allOltcOilTests.find((r) => String(r.id) === card.dataset.id);
    if (!rec) return;
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener("click", () => onEditOltcOilTest(rec));
    const delBtn = card.querySelector('[data-action="delete"]');
    if (delBtn) delBtn.addEventListener("click", async () => {
      if (!confirm(`Xóa thí nghiệm dầu OLTC của ${rec.thiet_bi || "?"} ngày ${(rec.sample_date || "").slice(0, 10)}?`)) return;
      try {
        await Storage.deleteOltcOilTest(rec.id);
        _allOltcOilTests = await Storage.listOltcOilTests();
        await refreshOltcOilTestsUI();
        showToast("Đã xóa thí nghiệm dầu OLTC.");
      } catch (err) {
        showToast("Xóa thất bại: " + ((err && err.message) || err));
      }
    });
  });
}
async function refreshOltcOilTestsUI() {
  const sorted = _allOltcOilTests.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  $("oltcOilHistoryEmpty").classList.toggle("hidden", sorted.length > 0);
  $("oltcOilHistoryList").innerHTML = sorted.map(oltcOilTestCardHtml).join("");
  wireOltcOilHistoryCardActions();
}

// =======================================================================
// TAB "XU HƯỚNG" — biểu đồ theo Trạm/Thiết bị/Pha (Chart.js) — PORT từ
// ui-trend.js, chỉ đổi phần bảng lịch sử thô sang danh sách thẻ.
// =======================================================================
const TREND_COLORS = ["#2e75b6", "#c1121f", "#1a7f37", "#b45309", "#6f42c1", "#0891b2", "#be185d", "#4d7c0f", "#9333ea", "#0d9488", "#ca8a04", "#475569", "#db2777", "#0f766e", "#a21caf", "#65a30d", "#c2410c", "#1e40af", "#991b1b"];
const TREND_PHASE_ORDER = { A: 0, B: 1, C: 2 };
const TREND_PARAM_DEFS = Object.assign({}, ...DGA.GASES.map((g) => ({ ["gas:" + g]: { label: g, unit: "ppm", axis: "yGas", field: g } })), {
  "oil:moisture": { label: "Độ ẩm dầu chính", unit: "ppm", axis: "yMoisture", field: "moisture_ppm" },
  "oil:tgd90": { label: "tgδ 90°C dầu chính", unit: "%", axis: "yTgd", field: "tgd_90c_percent" },
  "oil:bdv": { label: "Điện áp chọc thủng dầu chính", unit: "kV", axis: "yBdv", field: "bdv_kv" },
  "oltc:moisture": { label: "Độ ẩm dầu OLTC", unit: "ppm", axis: "yMoisture", field: "moisture_ppm" },
  "oltc:tgd90": { label: "tgδ 90°C dầu OLTC", unit: "%", axis: "yTgd", field: "tgd_90c_percent" },
  "oltc:bdv": { label: "Điện áp chọc thủng dầu OLTC", unit: "kV", axis: "yBdv", field: "bdv_kv" },
});
const TREND_AXIS_DEFS = {
  yGas: { title: "Nồng độ khí (ppm)", position: "left" },
  yTgd: { title: "tgδ 90°C (%)", position: "left" },
  yMoisture: { title: "Độ ẩm dầu (ppm)", position: "right" },
  yBdv: { title: "Điện áp chọc thủng (kV)", position: "right" },
};
let _trendSelectedParams = new Set();
let _trendSelectedPhases = new Set(["A", "B", "C"]);
let _trendChart = null;

function trendDeviceName(rec) { return (rec.thiet_bi || "").trim(); }
function trendDistinctPhases(gasRecords, oltcRecords) {
  const set = new Set();
  gasRecords.forEach((r) => { const p = (r.pha || "").trim(); if (p) set.add(p); });
  oltcRecords.forEach((r) => { if (r.oltc_sample_point !== "pharieng") return; const p = (r.phase || "").trim(); if (p) set.add(p); });
  return Array.from(set).sort((a, b) => (TREND_PHASE_ORDER[a] ?? 99) - (TREND_PHASE_ORDER[b] ?? 99) || a.localeCompare(b));
}
function refreshTrendDeviceOptions() {
  const sel = $("tr_device");
  if (!sel) return;
  const currentVal = sel.value;
  const names = new Set();
  _allMeasurements.forEach((r) => { const n = trendDeviceName(r); if (n) names.add(n); });
  _allOilTests.forEach((r) => { const n = trendDeviceName(r); if (n) names.add(n); });
  _allOltcOilTests.forEach((r) => { const n = trendDeviceName(r); if (n) names.add(n); });
  sel.innerHTML = '<option value="">— Chọn thiết bị —</option>' +
    Array.from(names).sort((a, b) => a.localeCompare(b, "vi")).map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  $("trEmpty").classList.toggle("hidden", names.size > 0);
  if (names.has(currentVal)) sel.value = currentVal;
  onTrendDeviceChange();
}
function trendRecordsForDevice(device) {
  const byDate = (a, b) => new Date(a.sample_date) - new Date(b.sample_date);
  return {
    gasRecords: _allMeasurements.filter((r) => trendDeviceName(r) === device).sort(byDate),
    oilRecords: _allOilTests.filter((r) => trendDeviceName(r) === device).sort(byDate),
    oltcRecords: _allOltcOilTests.filter((r) => trendDeviceName(r) === device).sort(byDate),
  };
}
function buildTrendChecks(containerId, keys, onChangeCb) {
  const el = $(containerId);
  el.innerHTML = keys.map((key) => {
    const def = TREND_PARAM_DEFS[key];
    const checked = _trendSelectedParams.has(key) ? "checked" : "";
    return `<label><input type="checkbox" data-trend-param="${escapeHtml(key)}" ${checked} /> ${escapeHtml(def.label)}</label>`;
  }).join("");
  el.querySelectorAll("input[data-trend-param]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) _trendSelectedParams.add(cb.dataset.trendParam); else _trendSelectedParams.delete(cb.dataset.trendParam);
      onChangeCb();
    });
  });
}
function renderTrendPhaseFilter(gasRecords, oilRecords, oltcRecords) {
  const phases = trendDistinctPhases(gasRecords, oltcRecords);
  const wrap = $("trPhaseWrap");
  if (phases.length < 2) { wrap.classList.add("hidden"); return; }
  wrap.classList.remove("hidden");
  const el = $("trPhaseChecks");
  el.innerHTML = phases.map((p) => {
    const checked = _trendSelectedPhases.has(p) ? "checked" : "";
    return `<label><input type="checkbox" data-trend-phase="${escapeHtml(p)}" ${checked} /> ${escapeHtml(DGA.phaLabelWithPrefix(p))}</label>`;
  }).join("");
  el.querySelectorAll("input[data-trend-phase]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) _trendSelectedPhases.add(cb.dataset.trendPhase); else _trendSelectedPhases.delete(cb.dataset.trendPhase);
      renderTrendChart(gasRecords, oilRecords, oltcRecords);
    });
  });
}
function renderTrendParamCheckboxesAll(gasRecords, oilRecords, oltcRecords) {
  const hasGas = gasRecords.length > 0, hasOil = oilRecords.length > 0, hasOltc = oltcRecords.length > 0;
  $("trParamsGasWrap").classList.toggle("hidden", !hasGas);
  $("trParamsOilWrap").classList.toggle("hidden", !hasOil);
  $("trParamsOltcWrap").classList.toggle("hidden", !hasOltc);
  const rerender = () => renderTrendChart(gasRecords, oilRecords, oltcRecords);
  if (hasGas) buildTrendChecks("trParamsGas", DGA.GASES.map((g) => "gas:" + g), rerender);
  if (hasOil) buildTrendChecks("trParamsOil", ["oil:moisture", "oil:tgd90", "oil:bdv"], rerender);
  if (hasOltc) buildTrendChecks("trParamsOltc", ["oltc:moisture", "oltc:tgd90", "oltc:bdv"], rerender);
}
function renderTrendHistoryLists(gasRecords, oilRecords, oltcRecords) {
  $("trHistGasWrap").classList.toggle("hidden", gasRecords.length === 0);
  $("trHistGasList").innerHTML = gasRecords.slice().reverse().map((r) => {
    const g = recordGases(r);
    return `<div class="list-card"><div class="list-card-title">${escapeHtml((r.sample_date || "").slice(0, 10))}${r.pha ? (" · " + escapeHtml(DGA.phaLabelWithPrefix(r.pha))) : ""}${r.lan_do ? (" · Lần " + r.lan_do) : ""}</div>
      <div class="list-card-meta">H2 ${g.H2 ?? "—"} · CH4 ${g.CH4 ?? "—"} · C2H6 ${g.C2H6 ?? "—"} · C2H4 ${g.C2H4 ?? "—"} · C2H2 ${g.C2H2 ?? "—"} · CO ${g.CO ?? "—"} · CO2 ${g.CO2 ?? "—"}</div></div>`;
  }).join("");

  $("trHistOilWrap").classList.toggle("hidden", oilRecords.length === 0);
  $("trHistOilList").innerHTML = oilRecords.slice().reverse().map((r) => `<div class="list-card">
    <div class="list-card-title">${escapeHtml((r.sample_date || "").slice(0, 10))} · ${r.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</div>
    <div class="list-card-meta">Độ ẩm ${r.moisture_ppm ?? "—"} ppm · tgδ ${r.tgd_90c_percent ?? "—"}% · BDV ${r.bdv_kv ?? "—"} kV</div></div>`).join("");

  $("trHistOltcWrap").classList.toggle("hidden", oltcRecords.length === 0);
  $("trHistOltcList").innerHTML = oltcRecords.slice().reverse().map((r) => `<div class="list-card">
    <div class="list-card-title">${escapeHtml((r.sample_date || "").slice(0, 10))} · ${escapeHtml(oltcSamplePointLabel(r.oltc_sample_point))}${r.phase ? (" · " + escapeHtml(DGA.phaLabelWithPrefix(r.phase))) : ""}</div>
    <div class="list-card-meta">Độ ẩm ${r.moisture_ppm ?? "—"} ppm · tgδ ${r.tgd_90c_percent ?? "—"}% · BDV ${r.bdv_kv ?? "—"} kV</div></div>`).join("");
}
function destroyTrendChart() { if (_trendChart) { _trendChart.destroy(); _trendChart = null; } }
function trendPoints(records, valueOf) {
  return records.filter((r) => valueOf(r) !== undefined && valueOf(r) !== null && valueOf(r) !== "")
    .map((r) => ({ x: new Date(r.sample_date).getTime(), y: Number(valueOf(r)) }));
}
function renderTrendChart(gasRecords, oilRecords, oltcRecords) {
  const canvas = $("trendChart");
  if (typeof Chart === "undefined") {
    $("trChartNoLib").classList.remove("hidden"); $("trChartEmpty").classList.add("hidden"); canvas.classList.add("hidden");
    return;
  }
  $("trChartNoLib").classList.add("hidden");
  const hasGas = gasRecords.length > 0, hasOil = oilRecords.length > 0, hasOltc = oltcRecords.length > 0;
  const sourceOk = { gas: hasGas, oil: hasOil, oltc: hasOltc };
  const selectedKeys = Array.from(_trendSelectedParams).filter((k) => TREND_PARAM_DEFS[k]).filter((k) => sourceOk[k.split(":")[0]]);
  destroyTrendChart();
  const gasValueOf = (r, field) => recordGases(r)[field];
  const phases = trendDistinctPhases(gasRecords, oltcRecords);
  const phaseFilterActive = phases.length >= 2;
  const tickedPhases = phases.filter((p) => _trendSelectedPhases.has(p));
  const recordsBySource = { gas: gasRecords, oil: oilRecords, oltc: oltcRecords };
  const seriesSpecs = [];
  selectedKeys.forEach((key) => {
    const def = TREND_PARAM_DEFS[key];
    const source = key.split(":")[0];
    if (source === "gas" && phaseFilterActive) {
      tickedPhases.forEach((p) => {
        const recs = gasRecords.filter((r) => (r.pha || "").trim() === p);
        seriesSpecs.push({ label: `${def.label} - ${DGA.phaLabelWithPrefix(p)} (${def.unit})`, axis: def.axis, points: trendPoints(recs, (r) => gasValueOf(r, def.field)) });
      });
      return;
    }
    if (source === "oltc" && phaseFilterActive) {
      const trungtinhRecs = oltcRecords.filter((r) => r.oltc_sample_point !== "pharieng");
      const trungtinhPoints = trendPoints(trungtinhRecs, (r) => r[def.field]);
      if (trungtinhPoints.length > 0) seriesSpecs.push({ label: `${def.label} (${def.unit})`, axis: def.axis, points: trungtinhPoints });
      tickedPhases.forEach((p) => {
        const recs = oltcRecords.filter((r) => r.oltc_sample_point === "pharieng" && (r.phase || "").trim() === p);
        const points = trendPoints(recs, (r) => r[def.field]);
        if (points.length > 0) seriesSpecs.push({ label: `${def.label} - ${DGA.phaLabelWithPrefix(p)} (${def.unit})`, axis: def.axis, points });
      });
      return;
    }
    const valueOf = source === "gas" ? (r) => gasValueOf(r, def.field) : (r) => r[def.field];
    seriesSpecs.push({ label: `${def.label} (${def.unit})`, axis: def.axis, points: trendPoints(recordsBySource[source], valueOf) });
  });
  if (seriesSpecs.length === 0) { $("trChartEmpty").classList.remove("hidden"); canvas.classList.add("hidden"); return; }
  $("trChartEmpty").classList.add("hidden"); canvas.classList.remove("hidden");
  const datasets = seriesSpecs.map((spec, idx) => ({
    label: spec.label, data: spec.points, borderColor: TREND_COLORS[idx % TREND_COLORS.length],
    backgroundColor: TREND_COLORS[idx % TREND_COLORS.length], yAxisID: spec.axis, tension: 0.15, pointRadius: 3, borderWidth: 1.6, spanGaps: true,
  }));
  const usedAxes = new Set(datasets.map((d) => d.yAxisID));
  const scales = { x: { type: "linear", ticks: { callback: (val) => new Date(val).toLocaleDateString("vi-VN"), font: { size: 10 } }, title: { display: true, text: "Ngày lấy mẫu", font: { size: 11 } } } };
  let axisIdx = 0;
  usedAxes.forEach((axisKey) => {
    const def = TREND_AXIS_DEFS[axisKey];
    scales[axisKey] = {
      type: "linear", position: def.position, title: { display: true, text: def.title, font: { size: 10 } },
      ticks: { font: { size: 10 } }, grid: { drawOnChartArea: axisIdx === 0 },
    };
    axisIdx++;
  });
  _trendChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, boxWidth: 12 } } },
      scales,
    },
  });
}
function onTrendDeviceChange() {
  const device = $("tr_device").value;
  ["trHistGasWrap", "trHistOilWrap", "trHistOltcWrap"].forEach((id) => $(id).classList.add("hidden"));
  if (!device) { $("trContentWrap").classList.add("hidden"); destroyTrendChart(); return; }
  $("trContentWrap").classList.remove("hidden");
  const { gasRecords, oilRecords, oltcRecords } = trendRecordsForDevice(device);
  renderTrendPhaseFilter(gasRecords, oilRecords, oltcRecords);
  renderTrendParamCheckboxesAll(gasRecords, oilRecords, oltcRecords);
  renderTrendHistoryLists(gasRecords, oilRecords, oltcRecords);
  renderTrendChart(gasRecords, oilRecords, oltcRecords);
}

// =======================================================================
// TAB "TIÊU CHUẨN" — CRUD tiêu chuẩn NSX (khí + dầu), chỉ Admin ghi — PORT
// từ ui-standards.js.
// =======================================================================
function populateEquipmentTypeSelect() {
  $("s_equipmenttype").innerHTML = Object.values(DGA.EQUIPMENT_TYPES).map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join("");
}
function toggleStandardTypeFields() {
  const isOil = $("s_standard_type").value === "dau";
  $("stdGasFields").classList.toggle("hidden", isOil);
  $("stdOilFields").classList.toggle("hidden", !isOil);
  $("s_equipmenttype_wrap").classList.toggle("hidden", isOil);
}
let _editingStandardId = null;
function resetStandardForm() {
  _editingStandardId = null;
  ["s_manufacturer", "s_source", "s_oil_moisture", "s_oil_tgd90", "s_oil_bdv"].forEach((id) => { $(id).value = ""; });
  DGA.GASES.forEach((g) => { $("s_" + g).value = ""; $("s_loaibo_" + g).value = ""; });
  $("s_standard_type").value = "khi";
  toggleStandardTypeFields();
  $("editingStandardNote").classList.add("hidden");
  $("btnCancelEditStandard").classList.add("hidden");
  $("btnSaveStandard").textContent = "Lưu tiêu chuẩn";
}
function onEditStandard(rec) {
  if (!canWrite()) return;
  _editingStandardId = rec.id;
  $("s_manufacturer").value = rec.manufacturer || "";
  $("s_source").value = rec.source || "";
  const isOil = isOilStandardRecord(rec);
  $("s_standard_type").value = isOil ? "dau" : "khi";
  toggleStandardTypeFields();
  if (isOil) {
    $("s_oil_voltage_class").value = rec.oil_voltage_class || "";
    $("s_oil_state").value = rec.oil_state || "inservice";
    $("s_oil_moisture").value = rec.oil_moisture_ppm ?? "";
    $("s_oil_tgd90").value = rec.oil_tgd_90c_percent ?? "";
    $("s_oil_bdv").value = rec.oil_bdv_kv ?? "";
  } else {
    $("s_equipmenttype").value = rec.equipment_type || rec.equipmentType || "";
    DGA.GASES.forEach((g) => {
      $("s_" + g).value = rec[g.toLowerCase()] ?? "";
      $("s_loaibo_" + g).value = rec["loaibo_" + g.toLowerCase()] ?? "";
    });
  }
  $("editingStandardNote").classList.remove("hidden");
  $("btnCancelEditStandard").classList.remove("hidden");
  $("btnSaveStandard").textContent = "Cập nhật tiêu chuẩn";
  $("standardFormWrap").scrollIntoView({ behavior: "smooth", block: "start" });
}
async function onSaveStandard() {
  if (!canWrite()) { showToast("Chỉ Admin mới lưu được tiêu chuẩn."); return; }
  const manufacturer = $("s_manufacturer").value.trim();
  if (!manufacturer) { showToast("Vui lòng nhập tên nhà sản xuất."); return; }
  const standardType = $("s_standard_type").value === "dau" ? "dau" : "khi";
  const source = $("s_source").value.trim();
  let rec;
  if (standardType === "dau") {
    const moisture = $("s_oil_moisture").value, tgd90 = $("s_oil_tgd90").value, bdv = $("s_oil_bdv").value;
    if (moisture === "" && tgd90 === "" && bdv === "") { showToast("Vui lòng nhập ít nhất 1 trong 3 ngưỡng dầu."); return; }
    rec = {
      manufacturer, source, standard_type: "dau", equipment_type: DGA.EQUIPMENT_TYPES.MBA,
      oil_voltage_class: $("s_oil_voltage_class").value, oil_state: $("s_oil_state").value,
      oil_moisture_ppm: moisture === "" ? null : Number(moisture), oil_tgd_90c_percent: tgd90 === "" ? null : Number(tgd90),
      oil_bdv_kv: bdv === "" ? null : Number(bdv),
    };
  } else {
    const equipmentType = $("s_equipmenttype").value;
    rec = { manufacturer, source, standard_type: "khi", equipment_type: equipmentType };
    DGA.GASES.forEach((g) => {
      const v = $("s_" + g).value; rec[g.toLowerCase()] = v === "" ? null : Number(v);
      const vLoaibo = $("s_loaibo_" + g).value; rec["loaibo_" + g.toLowerCase()] = vLoaibo === "" ? null : Number(vLoaibo);
    });
  }
  if (_editingStandardId) rec.id = _editingStandardId;
  const wasEditing = !!_editingStandardId;
  try {
    await Storage.saveStandard(rec);
    resetStandardForm();
    await refreshStandardsUI();
    showToast((wasEditing ? "Đã cập nhật tiêu chuẩn cho " : "Đã lưu tiêu chuẩn cho ") + manufacturer + ".");
  } catch (err) {
    showToast(storageErrorMessage(err));
  }
}
function standardThresholdText(rec) {
  if (isOilStandardRecord(rec)) {
    const parts = [];
    if (rec.oil_moisture_ppm != null) parts.push(`Ẩm ≤${rec.oil_moisture_ppm}ppm`);
    if (rec.oil_tgd_90c_percent != null) parts.push(`tgδ ≤${rec.oil_tgd_90c_percent}%`);
    if (rec.oil_bdv_kv != null) parts.push(`BDV ≥${rec.oil_bdv_kv}kV`);
    return parts.length ? parts.join(" · ") : "—";
  }
  const parts = [];
  DGA.GASES.forEach((g) => { const v = rec[g.toLowerCase()]; if (v != null) parts.push(`${g}≤${v}`); });
  return parts.length ? parts.join(" · ") : "—";
}
function standardAppliesToText(rec) {
  return isOilStandardRecord(rec)
    ? `${oilVoltageClassLabel(rec.oil_voltage_class)} · ${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}`
    : (rec.equipment_type || rec.equipmentType || "—");
}
function standardCardHtml(rec) {
  const canEdit = canWrite();
  return `<div class="list-card" data-id="${escapeHtml(rec.id)}">
    <div class="list-card-top">
      <div>
        <div class="list-card-title">${escapeHtml(rec.manufacturer)}</div>
        <div class="list-card-sub">${isOilStandardRecord(rec) ? "Dầu" : "Khí"} · ${escapeHtml(standardAppliesToText(rec))}</div>
      </div>
    </div>
    <div class="list-card-meta">${escapeHtml(standardThresholdText(rec))}</div>
    ${rec.source ? `<div class="list-card-meta">Nguồn: ${escapeHtml(rec.source)}</div>` : ""}
    ${canEdit ? `<div class="list-card-actions"><button data-action="edit">Sửa</button><button data-action="delete" class="danger">Xóa</button></div>` : ""}
  </div>`;
}
async function refreshStandardsUI() {
  _allStandards = await Storage.listStandards();
  refreshManufacturerOptions();
  refreshOilManufacturerOptions();
  const canEdit = canWrite();
  $("standardFormWrap").classList.toggle("hidden", !canEdit);
  $("standardsWriteLocked").style.display = canEdit ? "none" : "block";
  const sorted = _allStandards.slice().sort((a, b) => (a.manufacturer || "").localeCompare(b.manufacturer || "", "vi"));
  $("standardsEmpty").classList.toggle("hidden", sorted.length > 0);
  $("standardsList").innerHTML = sorted.map(standardCardHtml).join("");
  $("standardsList").querySelectorAll(".list-card").forEach((card) => {
    const rec = _allStandards.find((r) => String(r.id) === card.dataset.id);
    if (!rec) return;
    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener("click", () => onEditStandard(rec));
    const delBtn = card.querySelector('[data-action="delete"]');
    if (delBtn) delBtn.addEventListener("click", async () => {
      if (!canWrite() || !confirm(`Xóa tiêu chuẩn của ${rec.manufacturer}?`)) return;
      try { await Storage.deleteStandard(rec.id); await refreshStandardsUI(); showToast("Đã xóa tiêu chuẩn."); }
      catch (err) { showToast("Xóa thất bại: " + ((err && err.message) || err)); }
    });
  });
}

// =======================================================================
// TAB "QUẢN TRỊ" (chỉ Admin) — PORT từ ui-admin.js
// =======================================================================
function userCardHtml(u) {
  const isSelf = Auth.current && Auth.current.email === u.email;
  return `<div class="list-card" data-email="${escapeHtml(u.email)}">
    <div class="list-card-top">
      <div>
        <div class="list-card-title">${escapeHtml(u.email)}${isSelf ? ' <span class="pill muted">bạn</span>' : ""}</div>
        <div class="list-card-sub">Đăng ký: ${escapeHtml(u.created_at || "—")} · Đăng nhập gần nhất: ${escapeHtml(u.last_login || "—")}</div>
      </div>
    </div>
    <div class="list-card-meta" style="display:flex; align-items:center; gap:8px; margin-top:8px;">
      <span>Vai trò:</span>
      <select class="role-select" data-role-select ${isSelf ? "disabled" : ""}>
        <option value="user" ${u.role !== "admin" ? "selected" : ""}>User</option>
        <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
      </select>
    </div>
    ${!isSelf ? `<div class="list-card-actions"><button data-action="delete" class="danger">Xóa tài khoản</button></div>` : ""}
  </div>`;
}
async function refreshUsersUI() {
  const users = await Auth.listUsers();
  const sorted = users.slice().sort((a, b) => (a.email || "").localeCompare(b.email || ""));
  $("usersEmpty").classList.toggle("hidden", sorted.length > 0);
  $("usersList").innerHTML = sorted.map(userCardHtml).join("");
  $("usersList").querySelectorAll(".list-card").forEach((card) => {
    const u = sorted.find((x) => x.email === card.dataset.email);
    if (!u) return;
    const sel = card.querySelector("[data-role-select]");
    if (sel) sel.addEventListener("change", async () => {
      try { await Auth.setUserRole(u.email, sel.value); await refreshUsersUI(); }
      catch (err) { showToast("Đổi quyền thất bại: " + ((err && err.message) || err)); await refreshUsersUI(); }
    });
    const delBtn = card.querySelector('[data-action="delete"]');
    if (delBtn) delBtn.addEventListener("click", async () => {
      if (!confirm(`Xóa tài khoản ${u.email}? Người này sẽ không đăng nhập được nữa.`)) return;
      try { await Auth.deleteUser(u.email); await refreshUsersUI(); showToast("Đã xóa tài khoản."); }
      catch (err) { showToast("Xóa user thất bại: " + ((err && err.message) || err)); }
    });
  });
  $("tabbarQuanTri").classList.toggle("hidden", !(Auth.enabled && Auth.isAdmin()));
}

// =======================================================================
// ĐÍNH KÈM BBTN (PDF) khi nhập lần đo DGA — PORT từ ui-dga.js + bbtn-import.js
// =======================================================================
function renderBbtnCurrent() {
  const wrap = $("bbtnCurrentWrap");
  if (_editingMeasurementAttachment && _editingMeasurementAttachment.bbtn_url) {
    wrap.classList.remove("hidden");
    $("bbtnCurrentName").textContent = _editingMeasurementAttachment.bbtn_name || "Biên bản thí nghiệm";
  } else {
    wrap.classList.add("hidden");
  }
}
async function viewBbtn(att) {
  if (!att || !att.bbtn_url) return;
  const url = String(att.bbtn_url).trim();
  if (url.startsWith("local:")) {
    try {
      const local = await Storage.getLocalAttachment(_editingMeasurementId);
      if (!local || !local.dataUrl) { showToast("Không tìm thấy file đính kèm trên máy này."); return; }
      const res = await fetch(local.dataUrl);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast("Không mở được file đính kèm: " + ((err && err.message) || err));
    }
    return;
  }
  if (!/^https:\/\//i.test(url)) {
    showToast("Đường dẫn file không an toàn (chỉ chấp nhận https://).");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
async function onBbtnFileSelected(e) {
  const file = e.target.files[0];
  $("bbtnImportHint").textContent = "";
  if (!file || !window.BbtnImport) return;
  $("bbtnImportHint").textContent = "Đang đọc dữ liệu từ PDF...";
  try {
    const data = await window.BbtnImport.extract(file);
    const filled = [];
    if (data.tram) { $("f_tram").value = data.tram; filled.push("Trạm"); }
    if (data.thietbi) { $("f_thietbi").value = data.thietbi; filled.push("Thiết bị"); }
    if (data.loai) {
      $("f_loai").value = data.loai;
      $("f_mbasubtype_wrap").classList.toggle("hidden", data.loai !== DGA.EQUIPMENT_TYPES.MBA);
      refreshManufacturerOptions();
      filled.push("Loại thiết bị");
    }
    if (data.hangSanXuat) {
      const opts = Array.from($("f_nsx").options);
      const match = opts.find((o) => o.value && (data.hangSanXuat.toLowerCase().includes(o.value.toLowerCase()) || o.value.toLowerCase().includes(data.hangSanXuat.toLowerCase())));
      if (match) { $("f_nsx").value = match.value; filled.push("Nhà sản xuất"); }
    }
    if (data.pha) { _selectedPha = data.pha; renderPhaRow(); filled.push("Pha"); }
    if (data.ngay) { $("f_ngay").value = data.ngay; filled.push("Ngày lấy mẫu"); }
    if (data.gases && Object.keys(data.gases).length) {
      DGA.GASES.forEach((g) => { if (data.gases[g] !== undefined && data.gases[g] !== null) { const el = $("g_" + g); if (el) el.value = data.gases[g]; } });
      filled.push("Giá trị khí");
    }
    $("bbtnImportHint").textContent = filled.length
      ? "Đã tự điền từ PDF: " + filled.join(", ") + " — vui lòng kiểm tra lại trước khi lưu."
      : "Không đọc được số liệu tự động từ file này — vui lòng nhập tay.";
  } catch (err) {
    $("bbtnImportHint").textContent = "Không đọc được PDF: " + ((err && err.message) || err);
  }
}
function setupBbtnAttachUI() {
  $("bbtnCurrentLink").addEventListener("click", (e) => { e.preventDefault(); viewBbtn(_editingMeasurementAttachment); });
  $("btnRemoveBbtn").addEventListener("click", () => {
    _removeBbtnOnSave = true;
    _editingMeasurementAttachment = null;
    renderBbtnCurrent();
  });
  $("f_bbtn").addEventListener("change", onBbtnFileSelected);
}

// ---------------------------------------------------------------------
// Khởi động
// ---------------------------------------------------------------------
async function loadApp() {
  showScreen("screenEntry");
  try {
    await loadLists();
  } catch (err) {
    showToast(storageErrorMessage(err));
  }
  renderLoaiSelect();
  renderMbaSubtypeSelect();
  refreshManufacturerOptions();
  refreshOilManufacturerOptions();
  renderPhaRow();
  renderGasGrid();
  populateOilVoltageClasses();
  populateOltcOptions();
  populateEquipmentTypeSelect();
  toggleOilMembraneField();
  toggleOltcPhaseField();
  toggleOltcMembraneField();
  toggleStandardTypeFields();
  $("o_ngay").value = new Date().toISOString().slice(0, 10);
  $("ot_ngay").value = new Date().toISOString().slice(0, 10);
  setupCombos();
  $("tabbarQuanTri").classList.toggle("hidden", !(Auth.enabled && Auth.isAdmin()));
  refreshTrendDeviceOptions();
  $("f_ngay").value = new Date().toISOString().slice(0, 10);
}

async function init() {
  setupAuthForms();
  setupAcctMenu();
  setupTabbar();
  setupBbtnAttachUI();

  $("btnGoHistory").addEventListener("click", async () => { await renderHistory(); showScreen("screenHistory"); });
  $("btnBackFromHistory").addEventListener("click", () => showScreen("screenEntry"));
  $("btnFabAdd").addEventListener("click", () => { clearForm(); showScreen("screenEntry"); });
  $("btnBackFromResults").addEventListener("click", () => showScreen("screenEntry"));
  $("btnAnalyze").addEventListener("click", onAnalyze);
  $("btnExportBbtn").addEventListener("click", onExportBbtn);
  $("btnCancelEdit2").addEventListener("click", () => { clearForm(); });
  $("linkCancelEdit").addEventListener("click", (e) => { e.preventDefault(); clearForm(); });

  // --- Tab "Dầu cách điện" (dầu chính MBA + OLTC) ---
  $("o_voltage_class").addEventListener("change", toggleOilMembraneField);
  $("btnAnalyzeOil").addEventListener("click", onAnalyzeOil);
  $("btnCancelEditOilTest").addEventListener("click", clearOilForm);
  $("ot_samplepoint").addEventListener("change", toggleOltcPhaseField);
  $("ot_voltage_class").addEventListener("change", toggleOltcMembraneField);
  $("btnAnalyzeOltcOil").addEventListener("click", onAnalyzeOltcOil);
  $("btnCancelEditOltcOilTest").addEventListener("click", clearOltcOilForm);

  // --- Tab "Xu hướng" ---
  $("tr_device").addEventListener("change", onTrendDeviceChange);

  // --- Tab "Tiêu chuẩn" ---
  $("s_standard_type").addEventListener("change", toggleStandardTypeFields);
  $("btnSaveStandard").addEventListener("click", onSaveStandard);
  $("btnCancelEditStandard").addEventListener("click", resetStandardForm);

  clearForm();
  clearOilForm();
  clearOltcOilForm();

  if (!Auth.enabled) {
    await loadApp();
    return;
  }

  Auth.loadSaved();
  const session = await Auth.refresh();
  if (session) {
    await loadApp();
  } else {
    showScreen("screenAuth");
    initGoogleSignIn();
  }
}

document.addEventListener("DOMContentLoaded", init);
