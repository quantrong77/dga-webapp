/* app-core.js — Lõi khởi động app (initApp: nạp dữ liệu, gắn toàn bộ event
   listener của mọi tab) + tiện ích dùng chung (combo box tự viết, chuyển tab,
   escapeHtml). NẠP FILE NÀY SAU CÙNG (sau mọi ui-*.js) trong index.html — dòng cuối
   file này (document.addEventListener("DOMContentLoaded", init)) cần init() đã
   được khai báo từ ui-auth.js. Xem ui-auth.js đầu file đó để biết đầy đủ quy ước
   chia sẻ scope giữa các file ui-*.js + app-core.js. */

function syncDienApDmToBang63Voltage() {
  const el = $("f_dienapdm");
  const b63 = $("f_bang63_voltage");
  if (!b63) return;
  const tram = $("f_tram") ? $("f_tram").value : "";
  const thietbi = $("f_thietbi") ? $("f_thietbi").value : "";
  const helper = (window.BbtnImport && window.BbtnImport.mapVoltageToBang63Class);
  if (!helper) return;
  const vClass = helper(el ? el.value : "", tram, thietbi);
  if (vClass) {
    b63.value = vClass;
  }
}

/** Gợi ý ô "Trạm" (mọi tab dùng chung): danh mục Trạm, sắp xếp theo tên (tiếng Việt). */
function stationComboOptions() {
  return _allStations
    .slice()
    .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
    .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram }));
}

/** Gợi ý ô "Thiết bị": gom tên thiết bị (lần xuất hiện ĐẦU TIÊN theo thứ tự các nguồn) từ các danh sách bản ghi đã
 *  lưu, bỏ tên rỗng/trùng, `accept(r)` (tùy chọn) lọc thêm; sắp xếp theo tên. Truyền mảng lúc GỌI (không giữ tham chiếu)
 *  vì _allMeasurements/_allOilTests… được gán lại mỗi lần nạp dữ liệu. */
function deviceComboOptions(sources, accept) {
  const byName = new Map();
  sources.forEach((list) => {
    list.forEach((r) => {
      if (accept && !accept(r)) return;
      const name = (r.thiet_bi || "").trim();
      if (!name || byName.has(name)) return;
      byName.set(name, r.tram || "");
    });
  });
  return Array.from(byName.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "vi"))
    .map(([name, tram]) => ({ value: name, label: tram ? `${name} — ${tram}` : name }));
}

// ---------------------------------------------------------------------
// Khởi động app THẬT SỰ — chỉ gọi sau khi đã xác định được quyền truy cập
// (Auth tắt, hoặc đã đăng nhập thành công). Hiện trạng thái lưu trữ, nạp
// danh sách tiêu chuẩn & lịch sử, khóa các nút Lưu/Sửa/Xóa nếu không phải Admin.
// ---------------------------------------------------------------------
async function initApp() {
  renderUserHeader();

  // Badge "Database" chỉ hiện với Admin (hoặc khi tắt Auth) — xem renderStorageBadge() (app-status.js)
  const isAdminOrNoAuth = !Auth.enabled || (Auth.current && Auth.current.role === "admin");
  renderStorageBadge(isAdminOrNoAuth);
  setupStorageBadgeLink();
  setupAutoSyncUI();
  registerServiceWorker();

  setupStaticUI();
  await loadInitialData(isAdminOrNoAuth);

  // Khóa nút Lưu tiêu chuẩn với user không có quyền ghi (User thường khi đã bật
  // đăng nhập). Nút Xóa ở bảng Lịch sử/Tiêu chuẩn được ẩn ngay khi render dòng
  // (xem refreshHistoryUI/refreshStandardsUI) nên không cần xử lý thêm ở đây.
  $("btnSaveStandard").disabled = !canWrite();
  $("btnSaveStandard").title = canWrite() ? "" : "Chỉ Admin mới lưu được tiêu chuẩn.";

  setupStationDeviceCombos();
  bindInputFormEvents();
  bindHistoryTrendAlertEvents();
  if (typeof setupViewContext === "function") setupViewContext();
  enhanceAllDropzonesA11y();
  toggleMbaSubtypeField();
  toggleStandardTypeFields();
  drawDuvalTriangleBase();
  const bbtnInput = $("f_bbtn");
  if (bbtnInput && $("tab-dga") && !$("tab-dga").classList.contains("hidden")) {
    bbtnInput.focus();
  }
}

/** Tên/vai trò người dùng ở thanh trên + hiện tab "Quản trị" cho Admin (hoặc khi tắt Auth). */
function renderUserHeader() {
  // Viewer (chỉ xem): ẩn vùng nhập liệu + nút Xuất Excel bằng CSS (.role-viewer, style-components.css).
  document.body.classList.toggle("role-viewer", !!(Auth.enabled && Auth.current && Auth.current.role === "viewer"));
  if (Auth.enabled && Auth.current) {
    const roleLabel = Auth.current.role === "admin" ? "Admin" : Auth.current.role === "viewer" ? "Viewer" : "User";
    $("userBadge").textContent = `${Auth.current.email} — ${roleLabel}`;
    $("userBadge").classList.remove("hidden");
    $("btnOpenChangePassword").classList.remove("hidden");
    $("navQuanTri").classList.toggle("hidden", Auth.current.role !== "admin");
  } else if (!Auth.enabled) {
    $("navQuanTri").classList.remove("hidden");
  }
}

/** Khởi tạo giao diện KHÔNG phụ thuộc dữ liệu: tab, bố cục, tab con, khối nội dung tĩnh, ngày mặc định, các ô phụ thuộc. */
function setupStaticUI() {
  setupTabs();
  setupTabAriaSync();
  setupMiniModalEscape();
  if (typeof setupDialogFocus === "function") setupDialogFocus();
  if (typeof setupTopScrollbars === "function") setupTopScrollbars();
  if (typeof setupBackToTop === "function") setupBackToTop();
  if (typeof setupClearFormConfirm === "function") setupClearFormConfirm();
  setupStickyHeaderObserver();
  setupHeaderMenu();
  setupTabLayoutToggle();
  setupSidebarCollapseToggle();
  setupCauHinhSubtabs();
  setupQuyTrinhSubtabs();
  if (typeof setupInputSubtabs === "function") setupInputSubtabs();
  if (typeof setupDeviceSpecs === "function") setupDeviceSpecs();
  setupQuantriSubtabs();
  setupHandbookLightbox();
  setupMindmap();
  setupOverviewMindmap();
  setupSampleMethods();
  setupSamplingLightbox();
  setupUserGuideExpandCollapse();
  if (typeof setupUserGuideSearch === "function") setupUserGuideSearch();
  setupFeedbackDropzone();
  setupFeedbackPaste();
  setupFeedbackLightbox();
  // Tab "Quản trị" (tạo tài khoản/đặt lại mật khẩu/đổi vai trò) — chỉ Admin thấy được
  // tab (xem $("navQuanTri") ở trên), nhưng nối sự kiện 1 lần cho MỌI user không hại gì
  // (nút thật sự chỉ bấm được khi tab hiện ra, và server luôn kiểm tra lại requireAdmin()).
  setupAdminUsers();
  setupNameplateFieldsToggle();
  $("f_ngay").value = new Date().toISOString().slice(0, 10);
  $("o_ngay").value = new Date().toISOString().slice(0, 10);
  $("ot_ngay").value = new Date().toISOString().slice(0, 10);
  $("tio_ngay").value = new Date().toISOString().slice(0, 10);
  populateOilVoltageClasses();
  toggleOilMembraneField();
  toggleOilPhaseField();
  populateOltcOptions();
  toggleOltcPhaseField();
  toggleOltcMembraneField();
}

/** Nạp dữ liệu lần đầu (Trạm → Cấu hình quy định → Tiêu chuẩn/Lịch sử → dầu MBA/OLTC/TI-TU → góp ý → user) — mỗi nguồn
 *  cô lập try/catch riêng để 1 bảng backend chưa có không chặn các tab khác. */
async function loadInitialData(isAdminOrNoAuth) {
  // Trong lúc nạp Trạm/Thiết bị/Lịch sử đo lần đầu (chuỗi try/catch tuần tự bên dưới —
  // có thể mất vài giây, đặc biệt ở chế độ gsheet do Apps Script có độ trễ khởi động),
  // hiện thông báo "đang tải" ở khung Trạm/Thiết bị (DGA, Dầu cách điện MBA lẫn OLTC —
  // xem class "combo-loading-hint" trong index.html) và ở bảng Lịch sử đo, tránh cảm
  // giác app bị đứng/lỗi khi bấm mở gợi ý mà danh sách rỗng hoặc thấy "Chưa có lần đo
  // nào" trong lúc dữ liệu thật sự vẫn đang trên đường về (xem setComboLoading() dưới
  // đây và setHistoryLoading() ở ui-history.js).
  setComboLoading(true);
  setHistoryLoading(true);
  // Tab "Cảnh báo" cần CẢ 3 nguồn dữ liệu (khí/dầu MBA/dầu OLTC) mới tổng hợp đủ và
  // đúng — không tắt sớm theo từng nguồn riêng lẻ như setHistoryLoading(), để tránh
  // hiện "Chưa phát hiện thiết bị nào..." nhầm lẫn khi mới có 1-2/3 nguồn đã tải xong.
  setAlertsLoading(true);

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

  // "Cấu hình quy định" (regulation_config) — PHẢI áp dụng TRƯỚC khi bất kỳ phân tích
  // DGA/Dầu cách điện nào chạy (kể cả refreshHistoryUI()/refreshOilTestsUI() ngay bên
  // dưới, vốn tự tính lại chẩn đoán cho lịch sử đã lưu) — nếu không, lần hiển thị ĐẦU
  // TIÊN sẽ dùng số mặc định gốc rồi mới "nhảy" số khi mục "Quy định" (tab "Cấu hình") được mở.
  // Cô lập trong try/catch RIÊNG (giống danh mục Trạm) — sheet "regulation_config" là
  // MỚI, backend (Apps Script/Supabase) có thể chưa deploy/tạo bảng kịp; lỗi ở đây
  // KHÔNG được chặn các tab khác — ứng dụng vẫn chạy đúng với số liệu mặc định gốc.
  try {
    await refreshRegulationConfigUI();
  } catch (err) {
    console.warn("Không tải được Cấu hình quy định — dùng mặc định gốc QĐ1901/IEC60599:", err);
  }

  try {
    await refreshStandardsUI();
    await refreshHistoryUI();
  } catch (err) {
    notifyError(storageErrorMessage(err));
    markStorageBadgeDisconnected(err, isAdminOrNoAuth);
  } finally {
    // Tắt thông báo "đang tải" của bảng Lịch sử đo ngay khi refreshHistoryUI() ở trên
    // xong (dù thành công hay lỗi) — sớm hơn setComboLoading(false) vì Trạm/Thiết bị
    // ở tab Dầu cách điện còn cần chờ thêm 2 bước tải oil_tests/oltc_oil_tests bên dưới.
    setHistoryLoading(false);
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

  // Dầu TI/TU — cô lập trong try/catch RIÊNG, y hệt lý do ở dầu OLTC: sheet
  // "instrument_oil_tests" là MỚI NHẤT, backend (Apps Script/Supabase) có thể chưa
  // deploy/tạo bảng kịp.
  try {
    await refreshTioOilTestsUI();
  } catch (err) {
    console.warn("Không tải được lịch sử thí nghiệm dầu TI/TU:", err);
  }

  // Đến đây cả 4 nguồn dữ liệu mà gợi ý Trạm/Thiết bị dùng tới (stations,
  // measurements, oil_tests, oltc_oil_tests) đều đã thử tải xong (thành công hay
  // lỗi đều tắt thông báo — lỗi đã có console.warn/alert riêng ở từng khối trên).
  setComboLoading(false);
  setAlertsLoading(false);
  // Bộ chọn Khí hòa tan/Dầu MBA chính/Dầu OLTC ở tab "Lịch sử đo" — gọi SAU khi cả 3
  // nguồn đã nạp xong để bảng hiện đúng ngay theo lựa chọn đã lưu (thay vì luôn mặc
  // định "gas" trước rồi mới nhảy bảng, gây chớp giao diện).
  setupLichSuViewToggle();
  // Bộ chọn "Loại thiết bị" ở tab "Dầu cách điện" (#dau_equipmenttype) — chỉ ẩn/hiện
  // DOM (không phụ thuộc dữ liệu đã nạp) nên gọi ở đây cũng được, đặt cạnh
  // setupLichSuViewToggle() cho dễ tìm (2 bộ chọn "nhớ lựa chọn qua localStorage" duy
  // nhất trong app hiện có).
  setupDauEquipmentTypeToggle();

  // Tab "Người dùng phản hồi" — cô lập trong try/catch RIÊNG, y hệt lý do ở Dầu OLTC:
  // sheet "feedback" là MỚI, backend có thể chưa deploy/tạo bảng kịp.
  try {
    await refreshFeedbackUI();
  } catch (err) {
    console.warn("Không tải được danh sách góp ý:", err);
  }

  // Tab "Quản trị" (quản lý user) — cô lập trong try/catch riêng, chỉ Admin mới
  // gọi tới vì listUsers() bị Apps Script chặn với user thường (requireAdmin).
  const isAdminUser = (typeof Auth !== "undefined" && typeof Auth.isAdmin === "function")
    ? Auth.isAdmin()
    : !!(typeof Auth !== "undefined" && Auth && Auth.current && Auth.current.role === "admin");
  if (Auth && Auth.enabled && isAdminUser) {
    try {
      await refreshUsersUI();
      await refreshSupabaseSyncUI();
    } catch (err) {
      console.warn("Không tải được danh sách user:", err);
    }
  }
}

/** Ô combo Trạm/Thiết bị/Nhà sản xuất ở các tab nhập liệu (DGA, Dầu MBA, OLTC, TI/TU, Tiêu chuẩn). */
function setupStationDeviceCombos() {
  // Mọi form nhập liệu dùng CHUNG bộ chọn bậc thang Trạm ▸ Thiết bị ▸ Pha (setupLocationPicker(),
  // ui-location-picker.js): Thiết bị chỉ gợi ý theo Trạm đã chọn, Pha ghi số lần đo đã có. Ô Trạm gợi ý từ
  // danh mục trạm (stationComboOptions()).
  ["f", "o", "ot", "tio"].forEach((p) => {
    setupCombo({
      input: $(`${p}_tram`),
      toggleBtn: $(`${p}_tram_toggle`),
      listEl: $(`${p}_tram_list`),
      getOptions: () => stationComboOptions(),
    });
  });

  // Khí hòa tan: gợi ý thiết bị từ lịch sử đo khí; Pha theo trường "pha" (A/B/C/chung3pha).
  setupLocationPicker({
    stationInput: $("f_tram"),
    deviceInput: $("f_thietbi"),
    deviceToggle: $("f_thietbi_toggle"),
    deviceList: $("f_thietbi_list"),
    phaseSelect: $("f_pha"),
    sources: () => [_allMeasurements],
    phaseOf: (r) => r.pha,
  });

  // Dầu MBA: cùng 1 MBA có thể vừa có lịch sử đo khí, vừa có lịch sử dầu. Pha chỉ có khi lấy mẫu riêng từng pha.
  setupLocationPicker({
    stationInput: $("o_tram"),
    deviceInput: $("o_thietbi"),
    deviceToggle: $("o_thietbi_toggle"),
    deviceList: $("o_thietbi_list"),
    phaseSelect: $("o_phase"),
    sources: () => [_allMeasurements, _allOilTests],
    phaseOf: (r) => (r.oil_sample_point === "pharieng" ? r.phase : ""),
  });

  // Dầu OLTC: gợi ý từ lịch sử đo khí, dầu MBA chính lẫn dầu OLTC (cùng 1 MBA có thể xuất hiện ở cả 3 nơi).
  setupLocationPicker({
    stationInput: $("ot_tram"),
    deviceInput: $("ot_thietbi"),
    deviceToggle: $("ot_thietbi_toggle"),
    deviceList: $("ot_thietbi_list"),
    phaseSelect: $("ot_phase"),
    sources: () => [_allMeasurements, _allOilTests, _allOltcOilTests],
    phaseOf: (r) => (r.oltc_sample_point === "pharieng" ? r.phase : ""),
  });

  // Dầu TI/TU/Sứ xuyên: gợi ý từ lịch sử đo khí của TI/TU/Sứ xuyên lẫn dầu TI/TU — không gộp
  // _allOilTests/_allOltcOilTests vì đó là thiết bị MBA/OLTC, khác nhóm thiết bị.
  const instrumentTypes = [DGA.EQUIPMENT_TYPES.TI, DGA.EQUIPMENT_TYPES.TU, DGA.EQUIPMENT_TYPES.BUSHING];
  setupLocationPicker({
    stationInput: $("tio_tram"),
    deviceInput: $("tio_thietbi"),
    deviceToggle: $("tio_thietbi_toggle"),
    deviceList: $("tio_thietbi_list"),
    phaseSelect: $("tio_phase"),
    sources: () => [_allMeasurements.filter((r) => instrumentTypes.includes(r.equipment_type)), _allTioOilTests],
    phaseOf: (r) => r.phase ?? r.pha,
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
}

/** Sự kiện của các form nhập liệu: DGA (phân tích, BBTN, nhãn thiết bị, nhập hàng loạt), Dầu MBA/OLTC/TI-TU,
 *  góp ý, Tiêu chuẩn NSX. */
function bindInputFormEvents() {
  $("btnAnalyze").addEventListener("click", onAnalyze);
  $("btnClearForm").addEventListener("click", clearForm);
  $("btnCancelEditMeasurement").addEventListener("click", clearForm);
  $("f_bbtn").addEventListener("change", onBbtnFileSelected);
  setupBbtnDropzone();
  if ($("btnBbtnNewTab")) {
    $("btnBbtnNewTab").addEventListener("click", () => {
      const frame = $("bbtnPreviewFrame");
      if (!frame) return;
      const target = frame.dataset.originalUrl || frame.src;
      if (target && target !== "about:blank") {
        window.open(target, "_blank", "noopener");
      }
    });
  }
  if ($("btnCloseBbtnPreview")) {
    $("btnCloseBbtnPreview").addEventListener("click", hideBbtnPreview);
  }
  if ($("btnToggleBbtnPreview")) {
    $("btnToggleBbtnPreview").addEventListener("click", toggleBbtnPreview);
  }

  $("f_nameplate").addEventListener("change", onNameplateFileSelected);
  setupNameplateDropzone();
  setupInfoPopovers();
  setupTabLayoutToggle();
  setupSidebarCollapseToggle();
  setupTrendForecastToggle();
  setupGuideToggles();
  $("btnExportBbtn").addEventListener("click", onExportBbtn);
  $("btnExportTechReport").addEventListener("click", onExportTechReport);
  // Tùy chọn nhập liệu thứ 2 (bên cạnh nhập rời từng BBTN ở trên): nhập hàng loạt
  // nhiều file BBTN cùng lúc (chọn nhiều file, chọn cả thư mục, hoặc kéo-thả nhiều
  // file) — xem bbtn-batch-import.js.
  $("batchFiles").addEventListener("change", (e) => handleBatchFileList(e.target.files));
  $("btnBatchChooseFolder").addEventListener("click", () => $("batchFolderFiles").click());
  $("batchFolderFiles").addEventListener("change", (e) => handleBatchFileList(e.target.files));
  setupBatchDropzone();
  $("btnBatchSelectAll").addEventListener("click", onBatchSelectAll);
  $("btnBatchSelectNone").addEventListener("click", onBatchSelectNone);
  $("btnBatchSave").addEventListener("click", onBatchSave);
  $("btnBatchRenumber").addEventListener("click", onBatchRenumber);
  // Gợi ý "Lần đo" kế tiếp theo Trạm+Thiết bị+Pha — xem updateLanDoSuggestion() ở
  // ui-dga.js. "change" bắt được cả lúc chọn từ danh sách gợi ý (setupCombo() tự
  // bắn "change" khi chọn) lẫn lúc gõ tay rồi rời khỏi ô (blur mặc định của trình
  // duyệt cũng bắn "change" nếu giá trị đã đổi).
  ["f_tram", "f_thietbi", "f_pha"].forEach((id) => $(id).addEventListener("change", updateLanDoSuggestion));
  if ($("f_dienapdm")) {
    $("f_dienapdm").addEventListener("input", syncDienApDmToBang63Voltage);
    $("f_dienapdm").addEventListener("change", syncDienApDmToBang63Voltage);
  }
  ["f_tram", "f_thietbi"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("change", syncDienApDmToBang63Voltage);
  });
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
  $("o_samplepoint").addEventListener("change", toggleOilPhaseField);
  setupOilBbtnImport();
  if (typeof setupOilBatchImport === "function") setupOilBatchImport();
  if (typeof setupOilBbtnExport === "function") setupOilBbtnExport();
  $("btnAnalyzeOltcOil").addEventListener("click", onAnalyzeOltcOil);
  $("btnClearOltcOilForm").addEventListener("click", clearOltcOilForm);
  $("btnCancelEditOltcOilTest").addEventListener("click", clearOltcOilForm);
  $("ot_voltage_class").addEventListener("change", toggleOltcMembraneField);
  $("ot_samplepoint").addEventListener("change", toggleOltcPhaseField);
  if (typeof setupOltcInherit === "function") setupOltcInherit();
  setupTio3Phase();
  $("btnAnalyzeTioOil").addEventListener("click", onAnalyzeTioOil);
  $("btnClearTioOilForm").addEventListener("click", clearTioOilForm);
  $("btnCancelEditTioOilTest").addEventListener("click", clearTioOilForm);
  $("tio_equipmenttype").addEventListener("change", onTioEquipmentTypeChange);
  $("fb_image").addEventListener("change", onFeedbackImageSelected);
  $("btnRemoveFbImage").addEventListener("click", clearFeedbackImage);
  $("btnSubmitFeedback").addEventListener("click", onSubmitFeedback);
  $("btnSaveStandard").addEventListener("click", onSaveStandard);
  $("btnCancelEditStandard").addEventListener("click", resetStandardForm);
  $("s_standard_type").addEventListener("change", toggleStandardTypeFields);
  // Đổi "Loại thiết bị" khi đang ở tiêu chuẩn DẦU: MBA/Kháng dầu <-> TI/TU cần hiện 2
  // khối trường KHÁC nhau (Cấp điện áp/Trạng thái dầu vs Ngưỡng loại bỏ) — xem
  // toggleOilStandardEquipmentFields() ở ui-standards.js.
  $("s_equipmenttype").addEventListener("change", toggleOilStandardEquipmentFields);
  // Danh sách tiêu chuẩn (cột trái): lọc/tìm + nút "+ Thêm tiêu chuẩn" (bỏ form đang sửa, bắt đầu tiêu chuẩn mới)
  if ($("stdListSearch")) $("stdListSearch").addEventListener("input", renderStandardsList);
  if ($("stdListFilter")) $("stdListFilter").addEventListener("change", renderStandardsList);
  if ($("btnNewStandard")) {
    $("btnNewStandard").addEventListener("click", () => {
      resetStandardForm();
      $("s_manufacturer").focus();
    });
  }
}

/** Sự kiện của các tab xem/tra cứu: Lịch sử đo, So sánh tốc độ tăng, Cảnh báo, Xu hướng. */
function bindHistoryTrendAlertEvents() {
  // Bộ lọc "Trạm biến áp"/"Thiết bị" ở tab "Lịch sử đo" — 2 ô combo tự gõ-tìm
  // (#lichsu_station/#lichsu_device, THAY THẾ ô tìm kiếm tự do #historyFilter cũ) giống
  // hệt kiểu #tr_station/#tr_device ở tab "Xu hướng" (xem lichsuStationOptions()/
  // lichsuDeviceOptions()/lichsuFilterValues(), ui-history.js). Áp dụng CHUNG cho cả 4
  // bảng — đổi qua lại DGA/Dầu MBA chính/Dầu OLTC/Dầu TI-TU-Sứ xuyên vẫn giữ nguyên Trạm/
  // Thiết bị đang chọn. #lichsu_device tự lọc theo đúng Trạm đang chọn + đúng "gom nhóm"
  // ở #historyEquipmentFilter mỗi lần mở/gõ (không cần nạp lại thủ công, giống mọi combo
  // tự gõ-tìm khác trong app) — không ép người dùng phải đổi Trạm trước mới đổi được
  // Thiết bị, chỉ đơn giản là danh sách gợi ý sẽ khác nhau tùy Trạm đang chọn.
  setupCombo({
    input: $("lichsu_station"),
    toggleBtn: $("lichsu_station_toggle"),
    listEl: $("lichsu_station_list"),
    getOptions: () => lichsuStationOptions(),
  });
  setupCombo({
    input: $("lichsu_device"),
    toggleBtn: $("lichsu_device_toggle"),
    listEl: $("lichsu_device_list"),
    getOptions: () => lichsuDeviceOptions(),
  });
  const refreshAllLichSuTables = () => {
    refreshHistoryUI();
    refreshLichSuOilTable();
    refreshLichSuOltcTable();
    refreshLichSuInstrumentOilTable();
  };
  ["input", "change"].forEach((evt) => {
    $("lichsu_station").addEventListener(evt, refreshAllLichSuTables);
    $("lichsu_device").addEventListener(evt, refreshAllLichSuTables);
    $("lichsu_from").addEventListener(evt, refreshAllLichSuTables);
    $("lichsu_to").addEventListener(evt, refreshAllLichSuTables);
  });
  // Loại thiết bị (bộ lọc chung): lọc lại bảng khí + ẩn/hiện bảng con dầu đúng loại — giữ nguyên khi chuyển bảng.
  $("historyEquipmentFilter").addEventListener("change", () => {
    refreshHistoryUI();
    toggleLichSuOilSourceWraps();
  });
  $("btnLichsuClearFilters").addEventListener("click", () => {
    ["lichsu_station", "lichsu_device", "lichsu_from", "lichsu_to", "historyEquipmentFilter"].forEach((id) => {
      $(id).value = "";
      $(id).classList.remove("is-invalid");
    });
    // Báo cho ngữ cảnh xem chung (ui-view-context.js) biết đã bỏ chọn Trạm/Thiết bị → 2 tab Xu hướng/Cảnh báo cũng bỏ lọc.
    $("lichsu_device").dispatchEvent(new Event("change", { bubbles: true }));
    $("lichsu_station").dispatchEvent(new Event("change", { bubbles: true }));
    toggleLichSuOilSourceWraps();
    refreshAllLichSuTables();
    $("lichsu_station").focus();
  });
  // Nút "Sắp xếp lại Lần đo..." ở bảng "Lịch sử đo khí hòa tan (DGA)" — xem
  // onHistoryRenumber() ở ui-history.js.
  $("btnHistoryRenumber").addEventListener("click", onHistoryRenumber);
  $("f_loai").addEventListener("change", () => { refreshManufacturerOptions(); toggleMbaSubtypeField(); });
  $("cmp_device").addEventListener("change", refreshCompareMeasurementOptions);
  $("btnCompareRate").addEventListener("click", onCompareRate);
  $("btnExportAlertsExcel").addEventListener("click", openAlertsExportDialog);
  setupAlertsExportDialog();
  const btnRefreshAlerts = $("btnRefreshAlerts");
  if (btnRefreshAlerts) {
    btnRefreshAlerts.addEventListener("click", async () => {
      setAlertsLoading(true);
      try {
        if (typeof Storage !== "undefined") {
          const [measurements, oilTests, oltcOilTests, tioOilTests] = await Promise.all([
            Storage.listMeasurements().catch(() => _allMeasurements),
            Storage.listOilTests().catch(() => _allOilTests),
            Storage.listOltcOilTests().catch(() => _allOltcOilTests),
            Storage.listInstrumentOilTests().catch(() => _allTioOilTests),
          ]);
          _allMeasurements = measurements;
          _allOilTests = oilTests;
          _allOltcOilTests = oltcOilTests;
          _allTioOilTests = tioOilTests;
        }
        refreshAlertsUI();
        showToast("Đã làm mới danh sách Cảnh báo theo số liệu mới nhất.");
      } catch (err) {
        refreshAlertsUI();
      } finally {
        setAlertsLoading(false);
      }
    });
  }
  // Tab "Xu hướng" — 2 ô combo tự gõ-tìm (không còn là <select> tĩnh) giống ô Trạm/Thiết
  // bị ở tab DGA/Dầu cách điện, xem setupCombo() bên dưới. #tr_device gợi ý chỉ trong
  // đúng trạm đang gõ ở #tr_station (ràng buộc lọc theo trạm, xem trendDeviceOptions()
  // ở ui-trend.js). #tr_station cũng phải gọi lại onTrendDeviceChange() (không chỉ
  // updateTrendEmptyNote()) — vì trendRecordsForDevice() giờ LỌC DỮ LIỆU đồ thị theo
  // đúng Trạm đang gõ (sửa lỗi đồ thị gộp nhầm số liệu của thiết bị TRÙNG TÊN ở trạm
  // khác — xem ghi chú đầy đủ ở trendRecordsForDevice()), nên đổi Trạm phải vẽ lại ngay,
  // không đợi người dùng chọn lại Thiết bị.
  setupCombo({
    input: $("tr_station"),
    toggleBtn: $("tr_station_toggle"),
    listEl: $("tr_station_list"),
    getOptions: () => trendStationOptions(),
  });
  setupCombo({
    input: $("tr_device"),
    toggleBtn: $("tr_device_toggle"),
    listEl: $("tr_device_list"),
    getOptions: () => trendDeviceOptions(),
  });
  $("tr_device").addEventListener("change", onTrendDeviceChange);
  if (typeof setupTrendQuickPick === "function") setupTrendQuickPick();
  ["input", "change"].forEach((evt) => $("tr_station").addEventListener(evt, () => {
    updateTrendEmptyNote();
    onTrendDeviceChange();
  }));
  // Ô "Số năm dự báo" (khối "Dự báo xu hướng", xem renderTrendChart()/renderTrendForecastTable()
  // ở ui-trend.js) — đổi số năm phải vẽ lại ngay cả đường ngoại suy trên đồ thị lẫn bảng kết
  // quả, nên gọi lại onTrendDeviceChange() y hệt cách #tr_station làm ở trên (đơn giản, dữ liệu
  // nhỏ nên không cần tối ưu chỉ vẽ lại phần dự báo).
  $("tr_forecastYears").addEventListener("input", onTrendDeviceChange);
  // Diễn biến loại khiếm khuyết (Bảng 66/Duval, ui-trend.js): đổi cơ sở tính hoặc pha chỉ vẽ lại phần đó.
  $("tr_faultBasis").addEventListener("change", () => { if (_trendLastArgs) renderTrendFaultEvolution(_trendLastArgs[0]); });
  $("tr_faultPhase").addEventListener("change", (e) => {
    _trendFaultPhase = e.target.value;
    if (_trendLastArgs) renderTrendFaultEvolution(_trendLastArgs[0]);
  });
  // Checkbox "Hiện dự báo xu hướng tương lai" (#tr_forecastEnabled) — bật/tắt hẳn cả
  // đường nét đứt trên đồ thị lẫn bảng dự báo bên dưới (xem renderTrendChart() ở
  // ui-trend.js); trạng thái tick là SỞ THÍCH GIAO DIỆN, lưu qua setupTrendForecastToggle()
  // (localStorage, giống TAB_LAYOUT_STORAGE_KEY) chứ không qua onTrendDeviceChange() ở đây.
  $("tr_forecastEnabled").addEventListener("change", () => {
    try { localStorage.setItem(TREND_FORECAST_ENABLED_STORAGE_KEY, $("tr_forecastEnabled").checked ? "1" : "0"); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
    onTrendDeviceChange();
  });
  // Tab "Cảnh báo" — combo tự gõ-tìm lọc theo Trạm biến áp (#al_stationFilter), chỉ gợi
  // ý các trạm đang thực sự có cảnh báo (xem alertStationOptions(), ui-alerts.js); để
  // trống = xem tất cả. Gõ/chọn xong gọi lại refreshAlertsUI() để lọc lại bảng + thống kê.
  setupCombo({
    input: $("al_stationFilter"),
    toggleBtn: $("al_stationFilter_toggle"),
    listEl: $("al_stationFilter_list"),
    getOptions: () => alertStationOptions(),
  });
  // Ô "Thiết bị" thuộc trạm đang chọn (xem alertDeviceOptions(), ui-alerts.js).
  setupCombo({
    input: $("al_deviceFilter"),
    toggleBtn: $("al_deviceFilter_toggle"),
    listEl: $("al_deviceFilter_list"),
    getOptions: () => alertDeviceOptions(),
  });
  ["input", "change"].forEach((evt) => $("al_stationFilter").addEventListener(evt, () => {
    // Đổi trạm: bỏ Thiết bị đang lọc nếu thiết bị đó không thuộc trạm mới (tránh lọc ra bảng rỗng khó hiểu)
    const dev = $("al_deviceFilter");
    if (dev && dev.value.trim() && !alertDeviceOptions().some((o) => o.value === dev.value.trim())) dev.value = "";
    refreshAlertsUI();
  }));
  ["input", "change"].forEach((evt) => $("al_deviceFilter").addEventListener(evt, refreshAlertsUI));
  ["al_typeFilter", "al_dataFilter"].forEach((id) => { if ($(id)) $(id).addEventListener("change", refreshAlertsUI); });
  if (typeof setupAlertKpiFilters === "function") setupAlertKpiFilters();
}

document.addEventListener("DOMContentLoaded", init);
