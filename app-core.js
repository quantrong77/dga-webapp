/* app-core.js — Lõi khởi động app (initApp: nạp dữ liệu, gắn toàn bộ event
   listener của mọi tab) + tiện ích dùng chung (combo box tự viết, chuyển tab,
   escapeHtml). NẠP FILE NÀY SAU CÙNG (sau mọi ui-*.js) trong index.html — dòng cuối
   file này (document.addEventListener("DOMContentLoaded", init)) cần init() đã
   được khai báo từ ui-auth.js. Xem ui-auth.js đầu file đó để biết đầy đủ quy ước
   chia sẻ scope giữa các file ui-*.js + app-core.js. */

// ---------------------------------------------------------------------
// Khởi động app THẬT SỰ — chỉ gọi sau khi đã xác định được quyền truy cập
// (Auth tắt, hoặc đã đăng nhập thành công). Hiện trạng thái lưu trữ, nạp
// danh sách tiêu chuẩn & lịch sử, khóa các nút Lưu/Sửa/Xóa nếu không phải Admin.
// ---------------------------------------------------------------------
async function initApp() {
  if (Auth.enabled && Auth.current) {
    const roleLabel = Auth.current.role === "admin" ? "Admin" : "User";
    $("userBadge").textContent = `${Auth.current.email} — ${roleLabel}`;
    $("userBadge").classList.remove("hidden");
    $("btnLogout").classList.remove("hidden");
    $("navQuanTri").classList.toggle("hidden", Auth.current.role !== "admin");
  }

  // Badge "Đã kết nối database" chỉ hiện với Admin (chi tiết vận hành/hạ tầng, không
  // cần thiết cho User thường) — khi tắt Auth (Auth.enabled=false, không phân quyền)
  // vẫn hiện bình thường, coi như tương đương Admin. Cảnh báo "Chế độ thử nghiệm"
  // (localStorage) vẫn hiện cho MỌI người vì ai cũng cần biết dữ liệu không dùng chung.
  const badge = $("storageBadge");
  const footerInfo = $("footerStorageInfo");
  const isAdminOrNoAuth = !Auth.enabled || (Auth.current && Auth.current.role === "admin");
  if (Storage.mode === "gsheet" || Storage.mode === "supabase") {
    footerInfo.textContent = "lưu trên database dùng chung (nhiều máy cùng truy cập)";
    badge.classList.toggle("hidden", !isAdminOrNoAuth);
    if (isAdminOrNoAuth) {
      badge.textContent = "Đã kết nối database";
      badge.className = "badge supabase";
    }
  } else {
    badge.textContent = "Chế độ thử nghiệm (chỉ lưu trên trình duyệt này)";
    badge.className = "badge local";
    badge.classList.remove("hidden");
    footerInfo.textContent = "lưu trong localStorage của trình duyệt này — điền config.js để dùng database dùng chung";
  }

  setupTabs();
  setupHandbookLightbox();
  setupMindmap();
  setupOverviewMindmap();
  setupSampleMethods();
  setupSamplingLightbox();
  $("f_ngay").value = new Date().toISOString().slice(0, 10);
  $("o_ngay").value = new Date().toISOString().slice(0, 10);
  $("ot_ngay").value = new Date().toISOString().slice(0, 10);
  populateOilVoltageClasses();
  toggleOilMembraneField();
  populateOltcOptions();
  toggleOltcPhaseField();
  toggleOltcMembraneField();

  // Danh mục Trạm được cô lập trong try/catch RIÊNG — nếu backend chưa deploy
  // hỗ trợ Trạm (vd: Apps Script chưa deploy bản mới, hoặc bảng "stations" chưa
  // tạo trong Supabase), lỗi ở đây KHÔNG được để chặn phần Tiêu chuẩn/Lịch sử
  // đo bên dưới — 2 phần đó độc lập với danh mục Trạm.
  try {
    await seedStationsIfNeeded();
    await refreshStationsUI();
  } catch (err) {
    console.warn("Không tải được danh mục Trạm:", err);
  }

  try {
    await refreshStandardsUI();
    await refreshHistoryUI();
  } catch (err) {
    alert(storageErrorMessage(err));
  }

  // Tab "Dầu cách điện" — cô lập trong try/catch RIÊNG (giống danh mục Trạm):
  // nếu backend chưa deploy hỗ trợ oil_tests (Apps Script chưa deploy bản mới,
  // hoặc bảng "oil_tests" chưa tạo trong Supabase), lỗi ở đây KHÔNG được chặn
  // các tab khác đã tải xong ở trên.
  try {
    await refreshOilTestsUI();
  } catch (err) {
    console.warn("Không tải được lịch sử thí nghiệm dầu:", err);
  }

  // Dầu OLTC — cô lập trong try/catch RIÊNG, y hệt lý do ở dầu chính MBA: sheet
  // "oltc_oil_tests" là MỚI, backend có thể chưa deploy/tạo bảng kịp.
  try {
    await refreshOltcOilTestsUI();
  } catch (err) {
    console.warn("Không tải được lịch sử thí nghiệm dầu OLTC:", err);
  }

  // Tab "Quản trị" (quản lý user) — cô lập trong try/catch riêng, chỉ Admin mới
  // gọi tới vì listUsers() bị Apps Script chặn với user thường (requireAdmin).
  if (Auth.enabled && Auth.isAdmin()) {
    try {
      await refreshUsersUI();
    } catch (err) {
      console.warn("Không tải được danh sách user:", err);
    }
  }

  // Khóa nút Lưu tiêu chuẩn với user không có quyền ghi (User thường khi đã bật
  // đăng nhập). Nút Xóa ở bảng Lịch sử/Tiêu chuẩn được ẩn ngay khi render dòng
  // (xem refreshHistoryUI/refreshStandardsUI) nên không cần xử lý thêm ở đây.
  $("btnSaveStandard").disabled = !canWrite();
  $("btnSaveStandard").title = canWrite() ? "" : "Chỉ Admin mới lưu được tiêu chuẩn.";

  setupCombo({
    input: $("o_tram"),
    toggleBtn: $("o_tram_toggle"),
    listEl: $("o_tram_list"),
    getOptions: () =>
      _allStations
        .slice()
        .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
        .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
  });
  // Ô "Thiết bị" ở tab Dầu cách điện gợi ý từ cả lần đo DGA lẫn thí nghiệm dầu đã
  // lưu trước đó (cùng 1 MBA có thể vừa có lịch sử đo khí, vừa có lịch sử dầu).
  setupCombo({
    input: $("o_thietbi"),
    toggleBtn: $("o_thietbi_toggle"),
    listEl: $("o_thietbi_list"),
    getOptions: () => {
      const byName = new Map();
      _allMeasurements.forEach((r) => {
        const name = (r.thiet_bi || "").trim();
        if (!name || byName.has(name)) return;
        byName.set(name, r.tram || "");
      });
      _allOilTests.forEach((r) => {
        const name = (r.thiet_bi || "").trim();
        if (!name || byName.has(name)) return;
        byName.set(name, r.tram || "");
      });
      return Array.from(byName.entries())
        .sort((a, b) => a[0].localeCompare(b[0], "vi"))
        .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
    },
  });

  setupCombo({
    input: $("f_tram"),
    toggleBtn: $("f_tram_toggle"),
    listEl: $("f_tram_list"),
    getOptions: () =>
      _allStations
        .slice()
        .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
        .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
  });
  setupCombo({
    input: $("s_manufacturer"),
    toggleBtn: $("s_manufacturer_toggle"),
    listEl: $("s_manufacturer_list"),
    getOptions: () => {
      const names = Array.from(new Set(_allStandards.map((s) => s.manufacturer).filter(Boolean)));
      names.sort((a, b) => a.localeCompare(b, "vi"));
      return names.map((n) => ({ value: n, label: n }));
    },
  });
  // Ô "Thiết bị" chưa có danh mục riêng như Trạm — gợi ý được lấy từ các thiết bị
  // đã từng nhập trong lịch sử đo (_allMeasurements), không bắt buộc chọn từ đó. Nếu
  // đã chọn/gõ Trạm, chỉ gợi ý thiết bị THUỘC đúng trạm đó (đọc $("f_tram") mỗi lần mở
  // danh sách nên luôn theo giá trị Trạm hiện tại, kể cả đổi sau khi đã mở form) — gõ
  // tên chưa có trong danh mục vẫn dùng được bình thường (xem "combo-empty" ở
  // setupCombo()), không bị khóa chỉ chọn từ gợi ý.
  setupCombo({
    input: $("f_thietbi"),
    toggleBtn: $("f_thietbi_toggle"),
    listEl: $("f_thietbi_list"),
    getOptions: () => {
      const tram = $("f_tram").value.trim();
      const byName = new Map();
      _allMeasurements.forEach((r) => {
        const name = (r.thiet_bi || "").trim();
        if (!name || byName.has(name)) return;
        if (tram && (r.tram || "").trim() !== tram) return;
        byName.set(name, r.tram || "");
      });
      return Array.from(byName.entries())
        .sort((a, b) => a[0].localeCompare(b[0], "vi"))
        .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
    },
  });

  setupCombo({
    input: $("ot_tram"),
    toggleBtn: $("ot_tram_toggle"),
    listEl: $("ot_tram_list"),
    getOptions: () =>
      _allStations
        .slice()
        .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
        .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
  });
  // Ô "Thiết bị" ở dầu OLTC gợi ý từ cả lịch sử đo DGA, dầu chính MBA lẫn dầu OLTC
  // đã lưu trước đó (cùng 1 MBA có thể xuất hiện ở cả 3 nơi).
  setupCombo({
    input: $("ot_thietbi"),
    toggleBtn: $("ot_thietbi_toggle"),
    listEl: $("ot_thietbi_list"),
    getOptions: () => {
      const byName = new Map();
      _allMeasurements.forEach((r) => {
        const name = (r.thiet_bi || "").trim();
        if (!name || byName.has(name)) return;
        byName.set(name, r.tram || "");
      });
      _allOilTests.forEach((r) => {
        const name = (r.thiet_bi || "").trim();
        if (!name || byName.has(name)) return;
        byName.set(name, r.tram || "");
      });
      _allOltcOilTests.forEach((r) => {
        const name = (r.thiet_bi || "").trim();
        if (!name || byName.has(name)) return;
        byName.set(name, r.tram || "");
      });
      return Array.from(byName.entries())
        .sort((a, b) => a[0].localeCompare(b[0], "vi"))
        .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
    },
  });

  $("btnAnalyze").addEventListener("click", onAnalyze);
  $("btnClearForm").addEventListener("click", clearForm);
  $("btnCancelEditMeasurement").addEventListener("click", clearForm);
  $("f_bbtn").addEventListener("change", onBbtnFileSelected);
  $("btnExportBbtn").addEventListener("click", onExportBbtn);
  $("btnExportTechReport").addEventListener("click", onExportTechReport);
  // Gợi ý "Lần đo" kế tiếp theo Trạm+Thiết bị+Pha — xem updateLanDoSuggestion() ở
  // ui-dga.js. "change" bắt được cả lúc chọn từ danh sách gợi ý (setupCombo() tự
  // bắn "change" khi chọn) lẫn lúc gõ tay rồi rời khỏi ô (blur mặc định của trình
  // duyệt cũng bắn "change" nếu giá trị đã đổi).
  ["f_tram", "f_thietbi", "f_pha"].forEach((id) => $(id).addEventListener("change", updateLanDoSuggestion));
  $("btnViewBbtn").addEventListener("click", () => viewBbtn(_editingMeasurementAttachment));
  $("btnRemoveBbtn").addEventListener("click", () => {
    if (!confirm("Bỏ file Biên bản thí nghiệm đã đính kèm khỏi lần đo này?")) return;
    _editingMeasurementAttachment = null;
    _removeBbtnOnSave = true;
    renderBbtnCurrent();
  });
  $("btnAnalyzeOil").addEventListener("click", onAnalyzeOil);
  $("btnClearOilForm").addEventListener("click", clearOilForm);
  $("btnCancelEditOilTest").addEventListener("click", clearOilForm);
  $("o_voltage_class").addEventListener("change", toggleOilMembraneField);
  $("btnAnalyzeOltcOil").addEventListener("click", onAnalyzeOltcOil);
  $("btnClearOltcOilForm").addEventListener("click", clearOltcOilForm);
  $("btnCancelEditOltcOilTest").addEventListener("click", clearOltcOilForm);
  $("ot_voltage_class").addEventListener("change", toggleOltcMembraneField);
  $("ot_samplepoint").addEventListener("change", toggleOltcPhaseField);
  $("btnSaveStandard").addEventListener("click", onSaveStandard);
  $("btnCancelEditStandard").addEventListener("click", resetStandardForm);
  $("s_standard_type").addEventListener("change", toggleStandardTypeFields);
  $("historyFilter").addEventListener("input", () => refreshHistoryUI());
  $("f_loai").addEventListener("change", () => { refreshManufacturerOptions(); toggleMbaSubtypeField(); });
  $("cmp_device").addEventListener("change", refreshCompareMeasurementOptions);
  $("btnCompareRate").addEventListener("click", onCompareRate);
  $("tr_device").addEventListener("change", onTrendDeviceChange);
  toggleMbaSubtypeField();
  toggleStandardTypeFields();
  drawDuvalTriangleBase();
}

// ---------------------------------------------------------------------
// Combo box tự viết: ô nhập text + nút ▼ + danh sách gợi ý (thay <datalist>
// gốc — <datalist> của trình duyệt không tìm bỏ dấu tiếng Việt được và giới
// hạn số dòng hiển thị). Vẫn cho gõ tự do bất kỳ giá trị nào không có trong
// danh sách (không ép buộc phải chọn 1 mục có sẵn).
// ---------------------------------------------------------------------
function normalizeSearch(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bỏ các dấu thanh/dấu phụ đã tách rời sau NFD
    .replace(/đ|Đ/g, "d") // "đ"/"Đ" không tách bằng NFD nên thay thủ công
    .toLowerCase()
    .trim();
}

function setupCombo({ input, toggleBtn, listEl, getOptions }) {
  if (!input || !toggleBtn || !listEl) return;
  let currentOptions = [];

  function render(filterText) {
    const norm = normalizeSearch(filterText);
    const all = getOptions();
    currentOptions = !norm
      ? all
      : all.filter((o) => normalizeSearch(o.label).includes(norm) || normalizeSearch(o.value).includes(norm));
    if (currentOptions.length === 0) {
      listEl.innerHTML = `<div class="combo-empty">Không tìm thấy mục nào khớp — cứ gõ tiếp để dùng làm giá trị mới</div>`;
    } else {
      listEl.innerHTML = currentOptions
        .map((o, i) => `<div class="combo-item" data-idx="${i}">${escapeHtml(o.label)}</div>`)
        .join("");
    }
  }

  function open(filterText) {
    render(filterText);
    listEl.classList.remove("hidden");
  }
  function close() {
    listEl.classList.add("hidden");
  }

  input.addEventListener("input", () => open(input.value));
  input.addEventListener("focus", () => open(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  toggleBtn.addEventListener("click", () => {
    if (listEl.classList.contains("hidden")) {
      input.focus();
      open("");
    } else {
      close();
    }
  });
  // mousedown (không phải click) để chọn được TRƯỚC khi input mất focus (blur
  // sẽ đóng danh sách trước khi sự kiện click kịp bắn nếu dùng "click").
  listEl.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".combo-item");
    if (!item) return;
    e.preventDefault();
    const opt = currentOptions[Number(item.dataset.idx)];
    if (opt) {
      input.value = opt.value;
      close();
      input.dispatchEvent(new Event("change"));
    }
  });
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !toggleBtn.contains(e.target) && !listEl.contains(e.target)) close();
  });
}

function toggleMbaSubtypeField() {
  const isMba = $("f_loai").value === DGA.EQUIPMENT_TYPES.MBA;
  $("f_mbasubtype_wrap").classList.toggle("hidden", !isMba);
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      btn.classList.add("active");
      $("tab-" + btn.dataset.tab).classList.remove("hidden");
    });
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.addEventListener("DOMContentLoaded", init);
