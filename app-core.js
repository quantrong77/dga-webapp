/* app-core.js — Lõi khởi động app (initApp: nạp dữ liệu, gắn toàn bộ event
   listener của mọi tab) + tiện ích dùng chung (combo box tự viết, chuyển tab,
   escapeHtml). NẠP FILE NÀY SAU CÙNG (sau mọi ui-*.js) trong index.html — dòng cuối
   file này (document.addEventListener("DOMContentLoaded", init)) cần init() đã
   được khai báo từ ui-auth.js. Xem ui-auth.js đầu file đó để biết đầy đủ quy ước
   chia sẻ scope giữa các file ui-*.js + app-core.js. */

/** Gắn sự kiện bấm cho badge #storageBadge — mở Google Sheet/Supabase Dashboard (link
 *  lấy từ data-db-link, xem applyDatabaseBadgeLink() ngay dưới) ở tab mới, tiện cho
 *  Admin thao tác trực tiếp lên dữ liệu. Gắn DUY NHẤT 1 LẦN (initApp() có thể chạy lại
 *  nhiều lần trong 1 phiên trình duyệt — sau khi đăng nhập, sau khi đổi trạng thái badge
 *  do mất kết nối... — nhưng listener chỉ cần gắn 1 lần, luôn đọc link MỚI NHẤT từ
 *  dataset ngay lúc bấm chứ không cần gắn lại) — dùng dataset.linkBound làm cờ đánh dấu
 *  đã gắn, y hệt cách setSidebarCollapse/setupTabLayoutToggle tự đồng bộ trạng thái. */
function setupStorageBadgeLink() {
  const badge = $("storageBadge");
  if (!badge || badge.dataset.linkBound) return;
  badge.dataset.linkBound = "1";
  badge.addEventListener("click", () => {
    const url = badge.dataset.dbLink;
    if (url) window.open(url, "_blank", "noopener");
  });
}

/** Cập nhật link quản lý database gắn trên badge #storageBadge (data-db-link + class
 *  "has-link", xem CSS) theo cấu hình hiện tại (databaseManagementUrl() ở storage.js).
 *  PHẢI gọi lại mỗi khi initApp() gán lại badge.className (className bị GHI ĐÈ toàn bộ
 *  ở đó, xóa mất class "has-link" nếu gọi hàm này trước đó) — xem 3 nơi gọi hàm này
 *  trong initApp(). Không đổi textContent (vẫn luôn là "Database"/"Chế độ thử
 *  nghiệm..." như initApp() đã đặt), chỉ nối thêm gợi ý bấm vào title nếu có link. */
function applyDatabaseBadgeLink(badge) {
  const url = databaseManagementUrl();
  badge.classList.toggle("has-link", !!url);
  if (!url) {
    delete badge.dataset.dbLink;
    return;
  }
  badge.dataset.dbLink = url;
  const hint = Storage.mode === "gsheet" ? "Bấm để mở Google Sheet quản lý dữ liệu" : "Bấm để mở Supabase Dashboard";
  badge.title = badge.title ? `${badge.title} — ${hint}` : hint;
}

// ---------------------------------------------------------------------
// Khởi động app THẬT SỰ — chỉ gọi sau khi đã xác định được quyền truy cập
// (Auth tắt, hoặc đã đăng nhập thành công). Hiện trạng thái lưu trữ, nạp
// danh sách tiêu chuẩn & lịch sử, khóa các nút Lưu/Sửa/Xóa nếu không phải Admin.
// ---------------------------------------------------------------------
async function initApp() {
  if (Auth.enabled && Auth.current) {
    const roleLabel = Auth.current.role === "admin" ? "Admin" : Auth.current.role === "viewer" ? "Viewer" : "User";
    $("userBadge").textContent = `${Auth.current.email} — ${roleLabel}`;
    $("userBadge").classList.remove("hidden");
    $("btnOpenChangePassword").classList.remove("hidden");
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
      // Màu xanh (.badge.supabase) là trạng thái LẠC QUAN ban đầu — đã có cấu hình
      // (config.js) nên coi như sẽ kết nối được; nếu bước tải Tiêu chuẩn/Lịch sử đo
      // ngay bên dưới (nơi thật sự gọi API đầu tiên) thất bại, badge sẽ bị chuyển
      // sang đỏ (.badge.error) ở khối try/catch tương ứng, xem thêm ghi chú ở đó.
      badge.textContent = "Database";
      badge.className = "badge supabase";
      badge.title = "Đã kết nối database";
      applyDatabaseBadgeLink(badge);
    }
  } else {
    badge.textContent = "Chế độ thử nghiệm (chỉ lưu trên trình duyệt này)";
    badge.className = "badge local";
    badge.classList.remove("hidden");
    footerInfo.textContent = "lưu trong localStorage của trình duyệt này — điền config.js để dùng database dùng chung";
  }
  setupStorageBadgeLink();

  setupTabs();
  setupCauHinhSubtabs();
  setupQuyTrinhSubtabs();
  setupHandbookLightbox();
  setupMindmap();
  setupOverviewMindmap();
  setupSampleMethods();
  setupSamplingLightbox();
  setupUserGuideExpandCollapse();
  setupFeedbackDropzone();
  setupFeedbackPaste();
  setupFeedbackLightbox();
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
    // Đây là lần gọi API đầu tiên thật sự chạm tới database (Tiêu chuẩn/Lịch sử đo) —
    // nếu lỗi ngay tại đây, coi như MẤT KẾT NỐI database, chuyển badge #storageBadge
    // (đang lạc quan để xanh từ đầu initApp(), xem phía trên) sang đỏ để phản ánh
    // đúng tình trạng thay vì vẫn hiện xanh gây hiểu lầm là app đang hoạt động bình
    // thường. Không đổi badge khi ở chế độ local (không có khái niệm "mất kết nối").
    if ((Storage.mode === "gsheet" || Storage.mode === "supabase") && isAdminOrNoAuth) {
      badge.textContent = "Database";
      badge.className = "badge error";
      badge.title = "Mất kết nối database: " + storageErrorMessage(err);
      // Vẫn giữ link Sheet/Dashboard (nếu có) ngay cả khi mất kết nối — admin thường sẽ
      // CẦN mở thẳng Sheet/Dashboard lúc này để xem trực tiếp chuyện gì đang xảy ra.
      applyDatabaseBadgeLink(badge);
    }
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

  setupCombo({
    input: $("tio_tram"),
    toggleBtn: $("tio_tram_toggle"),
    listEl: $("tio_tram_list"),
    getOptions: () =>
      _allStations
        .slice()
        .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
        .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
  });
  // Ô "Thiết bị" ở dầu TI/TU gợi ý từ cả lịch sử đo DGA lẫn dầu TI/TU đã lưu trước đó
  // (cùng 1 TI/TU có thể vừa có lịch sử đo khí, vừa có lịch sử dầu) — không gộp
  // _allOilTests/_allOltcOilTests vì đó là thiết bị MBA/OLTC, khác nhóm thiết bị.
  setupCombo({
    input: $("tio_thietbi"),
    toggleBtn: $("tio_thietbi_toggle"),
    listEl: $("tio_thietbi_list"),
    getOptions: () => {
      const byName = new Map();
      _allMeasurements.forEach((r) => {
        if (r.equipment_type !== DGA.EQUIPMENT_TYPES.TI && r.equipment_type !== DGA.EQUIPMENT_TYPES.TU) return;
        const name = (r.thiet_bi || "").trim();
        if (!name || byName.has(name)) return;
        byName.set(name, r.tram || "");
      });
      _allTioOilTests.forEach((r) => {
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
  setupBbtnDropzone();
  $("f_nameplate").addEventListener("change", onNameplateFileSelected);
  setupNameplateDropzone();
  setupInfoPopovers();
  setupTabLayoutToggle();
  setupSidebarCollapseToggle();
  setupTrendForecastToggle();
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
  $("o_samplepoint").addEventListener("change", toggleOilPhaseField);
  $("btnAnalyzeOltcOil").addEventListener("click", onAnalyzeOltcOil);
  $("btnClearOltcOilForm").addEventListener("click", clearOltcOilForm);
  $("btnCancelEditOltcOilTest").addEventListener("click", clearOltcOilForm);
  $("ot_voltage_class").addEventListener("change", toggleOltcMembraneField);
  $("ot_samplepoint").addEventListener("change", toggleOltcPhaseField);
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
  // Áp dụng CHUNG cho cả 4 bảng ở tab "Lịch sử đo" (xem lichsuFilterText(), ui-history.js)
  // — đổi qua lại DGA/Dầu MBA chính/Dầu OLTC/Dầu TI-TU-Sứ xuyên vẫn giữ nguyên bộ lọc đang gõ.
  $("historyFilter").addEventListener("input", () => {
    refreshHistoryUI();
    refreshLichSuOilTable();
    refreshLichSuOltcTable();
    refreshLichSuInstrumentOilTable();
  });
  // #historyEquipmentFilter dùng CHUNG cho cả 2 view nhưng xử lý khác nhau: view "gas"
  // cần nạp lại bảng (lọc theo loại thiết bị, xem refreshHistoryUI()); view "oil" chỉ
  // cần ẩn/hiện 2 bảng con đã tính sẵn (lọc theo nguồn dầu, xem toggleLichSuOilSourceWraps()).
  $("historyEquipmentFilter").addEventListener("change", () => {
    if (currentLichSuView() === "gas") refreshHistoryUI();
    else toggleLichSuOilSourceWraps();
  });
  $("f_loai").addEventListener("change", () => { refreshManufacturerOptions(); toggleMbaSubtypeField(); });
  $("cmp_device").addEventListener("change", refreshCompareMeasurementOptions);
  $("btnCompareRate").addEventListener("click", onCompareRate);
  $("btnExportAlertsExcel").addEventListener("click", onExportAlertsExcel);
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
  ["input", "change"].forEach((evt) => $("tr_station").addEventListener(evt, () => {
    updateTrendEmptyNote();
    onTrendDeviceChange();
  }));
  // Ô "Số năm dự báo" (khối "Dự báo xu hướng", xem renderTrendChart()/renderTrendForecastTable()
  // ở ui-trend.js) — đổi số năm phải vẽ lại ngay cả đường ngoại suy trên đồ thị lẫn bảng kết
  // quả, nên gọi lại onTrendDeviceChange() y hệt cách #tr_station làm ở trên (đơn giản, dữ liệu
  // nhỏ nên không cần tối ưu chỉ vẽ lại phần dự báo).
  $("tr_forecastYears").addEventListener("input", onTrendDeviceChange);
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
  ["input", "change"].forEach((evt) => $("al_stationFilter").addEventListener(evt, refreshAlertsUI));
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

/** Hiện/ẩn thông báo "Vui lòng chờ! Đang nạp dữ liệu..." ở mọi khung Trạm/Thiết bị
 *  đang gắn class "combo-loading-hint" (DGA, Dầu cách điện MBA, Dầu OLTC — xem
 *  index.html) — dùng querySelectorAll thay vì liệt kê từng id để tự động áp dụng
 *  cho cả 3 nơi cùng lúc, khỏi phải sửa thêm nếu sau này có thêm khung Trạm/Thiết bị
 *  mới (chỉ cần gắn đúng class này). Gọi ở initApp() (xem phía trên), KHÔNG gọi lại ở
 *  mỗi lần refreshStationsUI()/refreshHistoryUI() thường (vd sau khi lưu 1 bản ghi)
 *  để tránh chớp thông báo không cần thiết ngoài lần tải đầu tiên. */
function setComboLoading(isLoading) {
  document.querySelectorAll(".combo-loading-hint").forEach((el) => {
    el.classList.toggle("hidden", !isLoading);
  });
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

/** Gắn sự kiện cho MỌI nút icon "i" (class="info-icon-btn", có aria-controls trỏ tới id
 *  1 div.info-popover ngay trong HTML — xem ví dụ "Điểm lấy mẫu OLTC" ở index.html/tab
 *  OLTC) — bấm icon để mở/đóng khung giải thích thêm ngay dưới trường đó. Dùng 1 hàm
 *  chung cho tất cả các icon loại này thay vì viết lặp lại: thêm 1 icon mới ở HTML chỉ
 *  cần đúng 2 thuộc tính (aria-controls + id khớp trên div.info-popover), không cần sửa
 *  gì thêm ở đây. Chỉ cho phép 1 khung mở tại 1 thời điểm; bấm ra ngoài hoặc bấm nút "×"
 *  trong khung đều đóng lại. */
function setupInfoPopovers() {
  const closeAll = () => {
    document.querySelectorAll(".info-popover:not(.hidden)").forEach((panel) => {
      panel.classList.add("hidden");
      const btn = document.querySelector(`.info-icon-btn[aria-controls="${panel.id}"]`);
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };
  document.querySelectorAll(".info-icon-btn[aria-controls]").forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = panel.classList.contains("hidden");
      closeAll();
      if (willShow) {
        panel.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
      }
    });
    const closeBtn = panel.querySelector(".info-popover-close");
    if (closeBtn) closeBtn.addEventListener("click", closeAll);
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest(".info-popover") || e.target.closest(".info-icon-btn")) return;
    closeAll();
  });
}

/** Khóa localStorage lưu lựa chọn bố cục thanh tab (xem setupTabLayoutToggle() ngay
 *  dưới) — SỞ THÍCH GIAO DIỆN riêng của trình duyệt đang dùng, không phải dữ liệu
 *  nghiệp vụ, nên KHÔNG lưu qua Storage (gsheet/Supabase) như measurements. */
const TAB_LAYOUT_STORAGE_KEY = "dga_tab_layout";

/** Bật/tắt bố cục thanh tab dọc (sidebar) trên <body> + đồng bộ trạng thái nút
 *  #btnToggleTabLayout (aria-pressed + title) cho khớp. */
function applyTabLayout(isSidebar) {
  document.body.classList.toggle("tabs-sidebar", isSidebar);
  const btn = $("btnToggleTabLayout");
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(isSidebar));
  btn.title = isSidebar ? "Chuyển thanh tab về ngang (phía trên)" : "Chuyển thanh tab sang cột dọc (bên trái)";
}

/** Gắn sự kiện cho nút #btnToggleTabLayout ở header — đổi thanh tab giữa "ngang"
 *  (mặc định, phía trên) và "dọc" (sidebar bên trái, xem khối CSS "body.tabs-sidebar"
 *  ở css/style-nav-layout.css), lưu lại lựa chọn vào localStorage để lần sau mở lại vẫn giữ nguyên.
 *  Lựa chọn đã lưu được áp dụng SỚM ở ngay đầu <body> (xem index.html) để tránh nháy
 *  layout lúc tải trang — hàm này chỉ cần đồng bộ lại nút cho khớp trạng thái đó rồi
 *  gắn sự kiện bấm. */
function setupTabLayoutToggle() {
  const btn = $("btnToggleTabLayout");
  if (!btn) return;
  applyTabLayout(document.body.classList.contains("tabs-sidebar"));
  btn.addEventListener("click", () => {
    const next = !document.body.classList.contains("tabs-sidebar");
    applyTabLayout(next);
    try { localStorage.setItem(TAB_LAYOUT_STORAGE_KEY, next ? "sidebar" : "top"); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
  });
}

/** Khóa localStorage lưu trạng thái thu gọn sidebar — chỉ có tác dụng hiển thị khi
 *  đang ở bố cục dọc (xem CSS "body.tabs-sidebar.sidebar-collapsed" ở css/style-nav-layout.css), lưu
 *  riêng khóa với TAB_LAYOUT_STORAGE_KEY vì đây là 2 lựa chọn độc lập nhau (người dùng
 *  có thể chọn dọc nhưng không thu gọn, hoặc từng thu gọn rồi tạm quay về ngang mà vẫn
 *  muốn nhớ trạng thái thu gọn cho lần sau bật lại "dọc"). */
const SIDEBAR_COLLAPSE_STORAGE_KEY = "dga_sidebar_collapsed";

/** Bật/tắt trạng thái thu gọn sidebar trên <body> + đồng bộ nút #btnCollapseSidebar
 *  (aria-pressed + title) cho khớp. */
function applySidebarCollapse(isCollapsed) {
  document.body.classList.toggle("sidebar-collapsed", isCollapsed);
  const btn = $("btnCollapseSidebar");
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(isCollapsed));
  btn.title = isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar";
}

/** Gắn sự kiện cho nút #btnCollapseSidebar trong <nav class="tabs"> — thu gọn sidebar
 *  (chỉ còn 1 cột icon hẹp) để "mở rộng màn hình" cho nội dung chính, hoặc mở lại như
 *  cũ. Nút này CSS đã tự ẩn khi không ở bố cục dọc/màn hình hẹp (xem css/style-nav-layout.css) nên ở
 *  đây chỉ cần lo phần bật/tắt + lưu lựa chọn, không cần kiểm tra thêm điều kiện. */
/** Khóa localStorage lưu trạng thái tick "Hiện dự báo xu hướng tương lai" ở tab "Xu
 *  hướng" (#tr_forecastEnabled) — SỞ THÍCH GIAO DIỆN riêng của trình duyệt đang dùng
 *  (giống TAB_LAYOUT_STORAGE_KEY ở trên), không phải dữ liệu nghiệp vụ nên KHÔNG lưu
 *  qua Storage (gsheet/Supabase) — mỗi trình duyệt/máy tự nhớ lựa chọn riêng. */
const TREND_FORECAST_ENABLED_STORAGE_KEY = "dga_trend_forecast_enabled";

/** Đọc lựa chọn đã lưu (nếu có) và đồng bộ lại checkbox #tr_forecastEnabled cho khớp —
 *  gọi 1 lần lúc khởi động app (initApp()), TRƯỚC khi tab "Xu hướng" render lần đầu, để
 *  khỏi phải vẽ lại ngay sau khi đọc xong. Mặc định BẬT (checked="checked" ở index.html)
 *  nếu người dùng CHƯA từng đổi lựa chọn này bao giờ. */
function setupTrendForecastToggle() {
  const checkbox = $("tr_forecastEnabled");
  if (!checkbox) return;
  let saved = null;
  try { saved = localStorage.getItem(TREND_FORECAST_ENABLED_STORAGE_KEY); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
  if (saved !== null) checkbox.checked = saved === "1";
}

/** Bộ chọn xem lịch sử ở tab "Lịch sử đo" (#lichsuTypeToggle: "gas"/"oil" — xem
 *  #lichsuGasWrap/#lichsuOilWrap, ui-history.js) — SỞ THÍCH GIAO DIỆN riêng trình duyệt
 *  (giống TAB_LAYOUT_STORAGE_KEY/TREND_FORECAST_ENABLED_STORAGE_KEY ở trên), không phải
 *  dữ liệu nghiệp vụ nên KHÔNG lưu qua Storage. Đổi class .primary/.ghost trên chính nút
 *  bấm để hiện rõ đang chọn loại nào (không thêm class CSS mới, tái dùng luôn 2 biến thể
 *  nút đã có ở toàn app). View "oil" gộp CHUNG "Dầu MBA chính" + "Dầu OLTC" + "Dầu TI/TU/
 *  Sứ xuyên" (trước đây Dầu MBA chính/Dầu OLTC là 2 nút riêng, còn dầu TI/TU chưa từng
 *  hiện ở tab này) — phân biệt tiếp bằng #historyEquipmentFilter (xem
 *  populateHistoryEquipmentFilterOptions()/toggleLichSuOilSourceWraps() bên dưới), CÙNG 1
 *  ô lọc dùng lại được cho cả 2 view — ở view "gas" lọc theo LOẠI THIẾT BỊ (bảng đó gộp
 *  chung mọi loại), ở view "oil" lọc theo NGUỒN dầu (Dầu MBA chính/Dầu OLTC/Dầu TI/TU/Sứ
 *  xuyên — 3 bảng con cột dữ liệu khác hẳn nhau nên vẫn hiện tách riêng, không gộp chung
 *  1 bảng). */
const LICHSU_VIEW_STORAGE_KEY = "dga_lichsu_view";

const LICHSU_GAS_EQUIPMENT_OPTIONS = [
  { value: "", label: "Tất cả loại thiết bị" },
  { value: "TI (biến dòng điện)", label: "TI (biến dòng điện)" },
  { value: "TU (biến điện áp)", label: "TU (biến điện áp)" },
  { value: "Sứ xuyên (Bushing)", label: "Sứ xuyên (Bushing)" },
  { value: "MBA/Kháng dầu", label: "MBA/Kháng dầu" },
  { value: "Khác", label: "Khác" },
];
const LICHSU_OIL_SOURCE_OPTIONS = [
  { value: "", label: "Tất cả (MBA chính + OLTC + TI/TU/Sứ xuyên)" },
  { value: "main", label: "Dầu MBA chính" },
  { value: "oltc", label: "Dầu OLTC" },
  { value: DGA.EQUIPMENT_TYPES.TI, label: "Dầu TI (biến dòng điện)" },
  { value: DGA.EQUIPMENT_TYPES.TU, label: "Dầu TU (biến điện áp)" },
  { value: DGA.EQUIPMENT_TYPES.BUSHING, label: "Dầu Sứ xuyên (Bushing)" },
];

/** Nạp lại nội dung <option> của #historyEquipmentFilter theo đúng view đang xem — 2 bộ
 *  lựa chọn Ý NGHĨA KHÁC NHAU hoàn toàn (loại thiết bị vs nguồn dầu) nên không thể dùng
 *  chung 1 danh sách <option> tĩnh, phải nạp lại bằng JS mỗi lần đổi view. Luôn reset về
 *  "" (Tất cả) khi đổi view — đơn giản hơn nhớ riêng từng view, và tránh lẫn giá trị của
 *  view cũ (VD "oltc" không có nghĩa gì ở view "gas"). */
function populateHistoryEquipmentFilterOptions(view) {
  const select = $("historyEquipmentFilter");
  if (!select) return;
  const options = view === "oil" ? LICHSU_OIL_SOURCE_OPTIONS : LICHSU_GAS_EQUIPMENT_OPTIONS;
  select.innerHTML = options.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
}

/** Ở view "Dầu": hiện 1 trong 3 (hoặc cả 3, khi #historyEquipmentFilter = "" = "Tất cả")
 *  bảng con #lichsuOilMainSubWrap/#lichsuOltcSubWrap/#lichsuInstrumentOilSubWrap theo
 *  đúng lựa chọn. 2 bảng dầu MBA/OLTC luôn được TÍNH SẴN cả 2 (xem
 *  refreshLichSuOilTable()/refreshLichSuOltcTable(), ui-history.js) nên chỉ cần ẩn/hiện
 *  DOM — nhưng bảng TI/TU/Sứ xuyên thì NGƯỢC LẠI, gộp CHUNG 1 bảng dữ liệu
 *  (_allTioOilTests) cho cả 3 loại thiết bị nên phải LỌC LẠI theo đúng loại đang chọn mỗi
 *  khi đổi lựa chọn (xem refreshLichSuInstrumentOilTable(), ui-history.js) — không thể
 *  chỉ ẩn/hiện DOM như 2 bảng kia. Gọi được trực tiếp từ sự kiện "change". */
function toggleLichSuOilSourceWraps() {
  const value = ($("historyEquipmentFilter") && $("historyEquipmentFilter").value) || "";
  const isInstrumentType = [DGA.EQUIPMENT_TYPES.TI, DGA.EQUIPMENT_TYPES.TU, DGA.EQUIPMENT_TYPES.BUSHING].includes(value);
  $("lichsuOilMainSubWrap").classList.toggle("hidden", value !== "" && value !== "main");
  $("lichsuOltcSubWrap").classList.toggle("hidden", value !== "" && value !== "oltc");
  $("lichsuInstrumentOilSubWrap").classList.toggle("hidden", value !== "" && !isInstrumentType);
  refreshLichSuInstrumentOilTable();
}

function currentLichSuView() {
  return $("lichsuGasWrap") && !$("lichsuGasWrap").classList.contains("hidden") ? "gas" : "oil";
}

function setLichSuView(view) {
  const toggle = $("lichsuTypeToggle");
  if (!toggle) return;
  toggle.querySelectorAll("[data-lichsu-type]").forEach((btn) => {
    const active = btn.dataset.lichsuType === view;
    btn.classList.toggle("primary", active);
    btn.classList.toggle("ghost", !active);
  });
  const wraps = { gas: $("lichsuGasWrap"), oil: $("lichsuOilWrap") };
  Object.entries(wraps).forEach(([key, el]) => { if (el) el.classList.toggle("hidden", key !== view); });
  populateHistoryEquipmentFilterOptions(view);
  try { localStorage.setItem(LICHSU_VIEW_STORAGE_KEY, view); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
  // Đổi bảng đang xem thì nạp lại đúng bảng đó theo bộ lọc #historyFilter hiện tại — cả 3
  // bảng dầu chỉ tính lại từ dữ liệu ĐÃ CÓ SẴN trong bộ nhớ (_allOilTests/
  // _allOltcOilTests/_allTioOilTests), không gọi lại Storage nên rất nhẹ.
  // (toggleLichSuOilSourceWraps() ở cuối tự gọi refreshLichSuInstrumentOilTable().)
  if (view === "gas") {
    refreshHistoryUI();
  } else if (view === "oil") {
    refreshLichSuOilTable();
    refreshLichSuOltcTable();
    toggleLichSuOilSourceWraps();
  }
}

/** Bộ chọn "Loại thiết bị" ở tab "Dầu cách điện" (#dau_equipmenttype, giống #f_loai ở
 *  tab "DGA") — CHỈ ẩn/hiện (các) khối nhập liệu liên quan để đỡ cuộn qua cả 3 khối
 *  MBA/OLTC/TI-TU cùng lúc, không phải 1 trường dữ liệu của bản ghi nên KHÔNG lưu qua
 *  Storage — chỉ SỞ THÍCH GIAO DIỆN riêng trình duyệt, cùng quy ước với
 *  LICHSU_VIEW_STORAGE_KEY ở trên. MBA/Kháng dầu gộp chung với OLTC (#dauMbaWrap, OLTC
 *  là 1 khoang dầu phụ CỦA chính MBA đó — xem ghi chú ở index.html); TI và TU đều dùng
 *  chung 1 khối "Dầu cách điện TI/TU" (#dauInstrumentWrap) — chọn TI/TU ở đây thì tự
 *  đồng bộ luôn #tio_equipmenttype BÊN TRONG khối đó theo đúng lựa chọn, khỏi phải chọn
 *  lại lần 2 (xem onTioEquipmentTypeChange(), ui-ti-oil.js, lọc lại danh sách Nhà sản
 *  xuất theo đúng loại). Sứ xuyên/Khác chưa có tính năng nhập dầu ở tab này (QĐ1901
 *  không có bảng dầu cho sứ xuyên, "Khác" không xác định được tiêu chuẩn nào) nên ẩn cả
 *  3 khối, chỉ hiện ghi chú #dauNoOilSupportNote. */
const DAU_EQUIPMENTTYPE_STORAGE_KEY = "dga_dau_equipmenttype";

function toggleDauEquipmentType() {
  const select = $("dau_equipmenttype");
  if (!select) return;
  const value = select.value;
  const isMba = value === DGA.EQUIPMENT_TYPES.MBA;
  const isInstrument = value === DGA.EQUIPMENT_TYPES.TI || value === DGA.EQUIPMENT_TYPES.TU;

  $("dauMbaWrap").classList.toggle("hidden", !isMba);
  $("dauInstrumentWrap").classList.toggle("hidden", !isInstrument);
  $("dauNoOilSupportNote").classList.toggle("hidden", isMba || isInstrument);

  if (isInstrument && $("tio_equipmenttype").value !== value) {
    $("tio_equipmenttype").value = value;
    onTioEquipmentTypeChange();
  }

  try { localStorage.setItem(DAU_EQUIPMENTTYPE_STORAGE_KEY, value); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
}

function setupDauEquipmentTypeToggle() {
  const select = $("dau_equipmenttype");
  if (!select) return;
  select.addEventListener("change", toggleDauEquipmentType);
  let saved = null;
  try { saved = localStorage.getItem(DAU_EQUIPMENTTYPE_STORAGE_KEY); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
  if (saved && Array.from(select.options).some((o) => o.value === saved)) select.value = saved;
  toggleDauEquipmentType();
}

/** Đọc lựa chọn đã lưu (nếu có, mặc định "gas") và gắn sự kiện click cho 2 nút — gọi
 *  1 lần lúc khởi động app (initApp()), sau khi refreshHistoryUI()/refreshOilTestsUI()/
 *  refreshOltcOilTestsUI() đã nạp xong dữ liệu lần đầu, để bảng hiện đúng ngay từ đầu
 *  thay vì luôn mặc định "gas" rồi mới nhảy sang bảng đã lưu. "oltc" là giá trị CŨ (trước
 *  khi gộp 2 nút Dầu MBA chính/Dầu OLTC thành 1 nút "Dầu") có thể còn sót lại trong
 *  localStorage của người dùng cũ — coi như "oil" để không bị kẹt ở view không còn tồn
 *  tại. */
function setupLichSuViewToggle() {
  const toggle = $("lichsuTypeToggle");
  if (!toggle) return;
  toggle.querySelectorAll("[data-lichsu-type]").forEach((btn) => {
    btn.addEventListener("click", () => setLichSuView(btn.dataset.lichsuType));
  });
  let saved = null;
  try { saved = localStorage.getItem(LICHSU_VIEW_STORAGE_KEY); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
  setLichSuView(saved === "oil" || saved === "oltc" ? "oil" : "gas");
}

function setupSidebarCollapseToggle() {
  const btn = $("btnCollapseSidebar");
  if (!btn) return;
  applySidebarCollapse(document.body.classList.contains("sidebar-collapsed"));
  btn.addEventListener("click", () => {
    const next = !document.body.classList.contains("sidebar-collapsed");
    applySidebarCollapse(next);
    try { localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? "1" : "0"); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
  });
}

/** Gắn sự kiện kéo-thả (drag & drop) cho ô chọn BBTN (PDF) ở tab "DGA" — #bbtnDropzone
 *  bọc quanh input[type=file] #f_bbtn thật (xem index.html), input đó đã phủ opacity:0
 *  toàn bộ khung nên bấm chọn tay vẫn hoạt động bình thường không cần thêm gì; hàm này
 *  chỉ thêm phần kéo-thả. Khi thả file: gán file vào input thật bằng DataTransfer rồi tự
 *  bắn sự kiện "change" — TÁI DÙNG đúng luồng xử lý sẵn có (onBbtnFileSelected() ở
 *  ui-dga.js: tự động đọc BBTN điền form, cập nhật nhãn tên file...) như khi người dùng
 *  bấm chọn file thủ công, không viết trùng logic ở đây. */
function setupBbtnDropzone() {
  const zone = $("bbtnDropzone");
  const input = $("f_bbtn");
  if (!zone || !input) return;

  ["dragenter", "dragover"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add("dragover");
    });
  });
  ["dragleave", "dragend"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("dragover");
    });
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("dragover");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      const note = $("bbtnImportNote");
      note.textContent = `Chỉ nhận file PDF — "${file.name}" không phải PDF, vui lòng kéo-thả lại đúng file Biên bản thí nghiệm (PDF).`;
      note.classList.remove("hidden");
      return;
    }
    // DataTransfer: cách chuẩn để gán 1 File (lấy từ sự kiện "drop") vào lại 1
    // input[type=file] thật — input.files chỉ đọc (readonly) nên không gán trực tiếp
    // được, phải đi qua DataTransfer.items.add() rồi gán .files của nó.
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Kéo-thả ẢNH CHỤP TẤM NHÃN THIẾT BỊ (nameplate) vào ô #nameplateDropzone — cùng cơ
 *  chế với setupBbtnDropzone() ở trên, khác chỗ: chấp nhận ảnh (JPG/PNG/...) hoặc PDF
 *  thay vì chỉ PDF, xem accept="image/*,application/pdf" ở input#f_nameplate trong
 *  index.html. Khi thả file: gán vào input thật rồi tự bắn "change" — tái dùng đúng luồng
 *  xử lý sẵn có (onNameplateFileSelected() ở ui-dga.js). */
function setupNameplateDropzone() {
  const zone = $("nameplateDropzone");
  const input = $("f_nameplate");
  if (!zone || !input) return;

  ["dragenter", "dragover"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add("dragover");
    });
  });
  ["dragleave", "dragend"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("dragover");
    });
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("dragover");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    const isImageOrPdf = /^image\//.test(file.type) || file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isImageOrPdf) {
      const note = $("nameplateImportNote");
      note.textContent = `Chỉ nhận ảnh (JPG/PNG...) hoặc PDF — "${file.name}" không đúng định dạng, vui lòng kéo-thả lại đúng ảnh chụp tấm nhãn thiết bị.`;
      note.classList.remove("hidden");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Kéo-thả NHIỀU file cùng lúc cho panel "Nhập hàng loạt" (#batchDropzone) — cùng
 *  cơ chế với setupBbtnDropzone() ở trên (dragenter/dragover/dragleave/dragend/drop),
 *  khác chỗ: nhận toàn bộ danh sách file thả vào (không chỉ file đầu tiên) và không
 *  chặn sớm nếu có file không phải PDF — handleBatchFileList() ở bbtn-batch-import.js
 *  đã tự lọc/báo cáo từng file không hợp lệ trong bảng xem trước. */
function setupBatchDropzone() {
  const zone = $("batchDropzone");
  if (!zone) return;

  ["dragenter", "dragover"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add("dragover");
    });
  });
  ["dragleave", "dragend"].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("dragover");
    });
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove("dragover");
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    handleBatchFileList(files);
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
      // Khi cụm nút tab không đủ chỗ (tràn ngang ở chế độ tab NGANG, hoặc tràn dọc ở chế
      // độ sidebar — xem ghi chú CSS "nav.tabs"/".tabs-inner"), nút vừa bấm có thể đang
      // nằm ngoài (hoặc chỉ lộ 1 phần trong) vùng nhìn thấy của nav.tabs — ví dụ bấm tab
      // "Quản trị"/"Cấu hình" ở cuối cụm lúc màn hình hẹp. Cuộn nhẹ (chỉ cuộn
      // TỐI THIỂU cần thiết nhờ "nearest", không giật cả trang) để nút luôn hiện đầy đủ
      // sau khi chọn, thay vì vẫn bị che 1 phần như trước khi bấm.
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    });
  });
}

/** Tab "Cấu hình" gộp 2 nội dung cũ ("Tiêu chuẩn theo nhà sản xuất" + "Cấu hình quy định")
 *  vào 1 tab duy nhất trên nav.tabs để thu gọn thanh tab — chọn nội dung nào hiện bằng
 *  cụm nút .cauhinh-subtab-btn (data-subtab="tieuchuan"|"quydinh") ngay trong tab, khớp
 *  với .cauhinh-subpanel có id="cauhinh-"+subtab tương ứng (xem index.html). Đây là lựa
 *  chọn NỘI DUNG CON bên trong 1 tab — độc lập hoàn toàn với setupTabs() (điều hướng giữa
 *  CÁC TAB với nhau) — nên không đụng gì đến .tab-btn/.tab-panel/nav.tabs, và hoạt động
 *  giống hệt nhau dù đang ở bố cục tab NGANG hay SIDEBAR (chỉ nav.tabs đổi bố cục, còn nội
 *  dung bên trong 1 tab — kể cả cụm subtab này — nằm trong <main>, không phụ thuộc bố cục
 *  nav.tabs đang chọn). Mặc định luôn mở "Tiêu chuẩn" trước mỗi lần tải lại trang (đúng
 *  thứ tự tab cũ: Tiêu chuẩn đứng trước Quy định) — không cần nhớ lựa chọn qua
 *  localStorage vì đây chỉ là điều hướng trong phiên xem hiện tại. */
function setupCauHinhSubtabs() {
  const btns = document.querySelectorAll(".cauhinh-subtab-btn");
  if (!btns.length) return;
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.subtab;
      document.querySelectorAll(".cauhinh-subtab-btn").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      document.querySelectorAll(".cauhinh-subpanel").forEach((p) => {
        p.classList.toggle("hidden", p.id !== "cauhinh-" + key);
      });
    });
  });
}

/** Tab "Quy trình" gộp 2 nội dung cũ ("Quy trình lấy mẫu" + "Quy trình đánh giá") vào 1
 *  tab duy nhất trên nav.tabs để thu gọn thanh tab — CÙNG CƠ CHẾ với setupCauHinhSubtabs()
 *  ở trên (chọn nội dung con bằng cụm nút dạng "segmented control" ngay trong tab, độc lập
 *  hoàn toàn với setupTabs() điều hướng giữa CÁC TAB với nhau), chỉ dùng riêng lớp
 *  .quytrinh-subtab-btn/.quytrinh-subpanel (thay vì .cauhinh-*) để 2 cụm subtab của 2 tab
 *  khác nhau không lẫn vào nhau. Mặc định luôn mở "Lấy mẫu dầu" trước mỗi lần tải lại
 *  trang (đúng thứ tự tab cũ trên thanh tab: quymau đứng trước quytrinh) — không cần nhớ
 *  lựa chọn qua localStorage vì chỉ là điều hướng trong phiên xem hiện tại. */
function setupQuyTrinhSubtabs() {
  const btns = document.querySelectorAll(".quytrinh-subtab-btn");
  if (!btns.length) return;
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.subtab;
      document.querySelectorAll(".quytrinh-subtab-btn").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      document.querySelectorAll(".quytrinh-subpanel").forEach((p) => {
        p.classList.toggle("hidden", p.id !== "quytrinh-" + key);
      });
    });
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Xác thực dữ liệu đầu vào: không đại lượng nào ở đây (nồng độ khí ppm, %, kV, °C, năm,
 *  lần đo, ngưỡng cấu hình...) có thể ÂM về mặt vật lý — người dùng gõ nhầm dấu "-" hoặc
 *  paste nhầm số âm là lỗi nhập liệu, không phải giá trị hợp lệ. Dùng CHUNG cho mọi form
 *  nhập số liệu (DGA, dầu MBA, dầu OLTC, cấu hình tiêu chuẩn NSX — xem các lời gọi ở
 *  ui-dga.js/ui-oil.js/ui-oltc.js/ui-standards.js). fields: mảng [{label, value}]; value
 *  có thể là number|null|undefined|NaN — bỏ qua khi không phải số (nghĩa là "chưa nhập").
 *  Trả về nhãn tiếng Việt của trường ÂM đầu tiên tìm thấy, hoặc null nếu tất cả hợp lệ. */
function findNegativeValueField(fields) {
  for (const { label, value } of fields) {
    if (typeof value === "number" && !Number.isNaN(value) && value < 0) return label;
  }
  return null;
}

function alertIfNegative(fields) {
  const negativeField = findNegativeValueField(fields);
  if (negativeField) {
    notifyError(`Giá trị "${negativeField}" không hợp lệ: không được nhập số âm.`);
    return true;
  }
  return false;
}

/** Cảnh báo (KHÔNG chặn lưu, khác alertIfNegative ở trên) khi để TRỐNG 1/nhiều trong 7
 *  khí chính (H2, CH4, C2H6, C2H4, C2H2, CO, CO2) lúc nhập/sửa số liệu ở tab DGA. Lý do
 *  cần cảnh báo riêng: để trống 1 ô khí sẽ tự động tính là 0 ppm khi lưu (xem onAnalyze()
 *  ở ui-dga.js — num() ở dga-logic.js coi mọi giá trị rỗng/không phải số là 0), và 0 ppm
 *  đó VẪN được đưa vào TCG/so sánh tiêu chuẩn/Bảng 66/Duval/vẽ đồ thị xu hướng y như thể
 *  đã đo được 0 ppm thật — khác N2/O2 (2 khí BỔ SUNG, không thuộc DGA.GASES) vốn để trống
 *  thì giữ đúng là "chưa đo", tự ẩn khỏi các phép tính cần cả 2 khí đó (xem ghi chú ở
 *  onAnalyze()). Vì nhiều khí (đặc biệt C2H2) trong thực tế thường ĐÚNG LÀ đo được 0 ppm
 *  ở thiết bị bình thường, không thể coi "trống" là lỗi nhập liệu để chặn lưu như số âm —
 *  chỉ nhắc người dùng tự kiểm tra lại BBTN/số liệu gốc xem khí đó thực sự đo được 0 ppm
 *  hay đơn giản là CHƯA ĐO (quên nhập) trước khi tin vào kết quả đánh giá/đồ thị. Đọc
 *  thẳng DOM (không dùng object "gases" đã build ở onAnalyze() vì lúc đó "" đã bị đổi
 *  thành 0, không còn phân biệt được nữa) để biết CHÍNH XÁC ô nào người dùng để trống. */
function findEmptyMainGasLabels() {
  return DGA.GASES.filter((g) => $("g_" + g) && $("g_" + g).value.trim() === "");
}

function warnIfEmptyMainGas() {
  const empty = findEmptyMainGasLabels();
  if (empty.length === 0) return;
  alert(
    `Lưu ý: khí ${empty.join(", ")} đang để TRỐNG — hệ thống sẽ tự động tính là 0 ppm và vẫn dùng ` +
    `giá trị này để đánh giá/vẽ đồ thị xu hướng như đã đo được 0 ppm.\n\n` +
    `Vui lòng kiểm tra lại BBTN/số liệu gốc: nếu khí này CHƯA ĐO (không phải đo được 0), hãy quay lại ` +
    `sửa cho đúng sau khi lưu — số liệu vẫn được lưu lại bình thường ngay bây giờ.`
  );
}

// ---------------------------------------------------------------------------
// Lưu vết CHỈNH SỬA số liệu khí — khi người dùng SỬA 1 lần đo đã lưu (không phải nhập
// mới), so sánh 7 khí chính + N2/O2 giữa bản ghi GỐC và giá trị vừa nhập để biết ĐÚNG
// những ô nào đã bị chỉnh sửa, dùng tô nền đỏ cảnh báo + ghi log kèm timestamp ở tab
// "Lịch sử đo" (xem onAnalyze() ở ui-dga.js gọi diffTrackedGasFields(), và
// refreshHistoryUI() ở ui-history.js đọc lại rec.edited_fields/edit_log để hiển thị).
// KHÔNG theo dõi các trường khác (Ghi chú, thông số kỹ thuật...) — chỉ số liệu khí là
// dữ liệu đo đạc gốc, quan trọng nhất về mặt truy xuất nguồn gốc/tính toàn vẹn.
// ---------------------------------------------------------------------------

const EDIT_TRACKED_GAS_FIELDS = ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2", "N2", "O2"];

function editTrackedFieldOldValue(oldRec, field) {
  if (field === "N2") return oldRec.n2 ?? oldRec.N2 ?? null;
  if (field === "O2") return oldRec.o2 ?? oldRec.O2 ?? null;
  return recordGases(oldRec)[field] ?? null;
}

function editTrackedFieldNewValue(field, gases, n2, o2) {
  if (field === "N2") return n2;
  if (field === "O2") return o2;
  return gases[field] ?? null;
}

function numOrNullForDiff(v) {
  return v === null || v === undefined || v === "" ? null : Number(v);
}

/** So sánh giá trị 9 trường số liệu chính (7 khí + N2/O2) giữa bản ghi GỐC (trước khi
 *  sửa, "oldRec") và giá trị MỚI đang chuẩn bị lưu ("gases"/"n2"/"o2") — dùng khi SỬA 1
 *  lần đo đã lưu. Trả về { editedFields, editLogEntry }:
 *  - editedFields: chuỗi "H2:12|CO2:2000" (field:GIÁ TRỊ CŨ, chỉ những field ĐÃ ĐỔI) —
 *    dùng để tô nền đỏ ĐÚNG ô đã sửa và hiện tooltip "giá trị trước khi sửa" ở tab "Lịch
 *    sử đo", không cần phân tích lại edit_log dạng văn bản.
 *  - editLogEntry: 1 dòng log dạng "<thời điểm>: H2: 12 → 18; CO2: 2000 → 2500" — nối
 *    vào edit_log (lưu TOÀN BỘ lịch sử các lần sửa, không chỉ lần gần nhất).
 *  Cả 2 đều rỗng nếu không field nào thực sự đổi giá trị (vd chỉ sửa Ghi chú) — không
 *  coi đó là "đã sửa số liệu". */
function diffTrackedGasFields(oldRec, gases, n2, o2) {
  const changes = [];
  EDIT_TRACKED_GAS_FIELDS.forEach((field) => {
    const oldVal = numOrNullForDiff(editTrackedFieldOldValue(oldRec, field));
    const newVal = numOrNullForDiff(editTrackedFieldNewValue(field, gases, n2, o2));
    if (oldVal === newVal) return; // cả 2 cùng null, hoặc cùng 1 số — không đổi
    changes.push({ field, oldVal, newVal });
  });
  if (changes.length === 0) return { editedFields: "", editLogEntry: "" };
  const editedFields = changes.map((c) => `${c.field}:${c.oldVal ?? ""}`).join("|");
  const changeText = changes.map((c) => `${c.field}: ${c.oldVal ?? "—"} → ${c.newVal ?? "—"}`).join("; ");
  const editLogEntry = `${new Date().toLocaleString("vi-VN")}: ${changeText}`;
  return { editedFields, editLogEntry };
}

/** Phân tích chuỗi "H2:12|CO2:2000" (rec.edited_fields, xem diffTrackedGasFields() trên)
 *  thành Map<field, giá trị cũ dạng chuỗi> — dùng ở refreshHistoryUI() (ui-history.js)
 *  để biết field nào cần tô đỏ và hiện giá trị cũ trong tooltip. Trả về Map rỗng nếu
 *  chưa từng sửa số liệu (edited_fields rỗng/không có). */
function parseEditedFields(editedFieldsStr) {
  const map = new Map();
  if (!editedFieldsStr) return map;
  String(editedFieldsStr).split("|").forEach((part) => {
    const idx = part.indexOf(":");
    if (idx < 0) return;
    map.set(part.slice(0, idx), part.slice(idx + 1));
  });
  return map;
}

/** Icon nhỏ cạnh TÊN 1 khí hòa tan cụ thể — dùng ở mọi nơi hiển thị tên khí đứng riêng
 *  (ô nhập DGA, bảng kết quả/lịch sử/tốc độ tăng khí, checkbox "Xu hướng", pill "Chỉ
 *  tiêu vượt ngưỡng" tab "Cảnh báo"), KHÔNG dùng trong câu văn khuyến cáo (những câu đó
 *  là chuỗi thuần từ dga-logic.js, không có HTML). 5 khí sinh ra từ phân hủy DẦU cách
 *  điện (H2, CH4, C2H6, C2H4, C2H2) dùng icon-flask (giống icon tab "DGA"); CO/CO2 sinh
 *  ra từ phân hủy GIẤY CÁCH ĐIỆN (cellulose, không phải dầu) nên dùng icon-book (trang
 *  giấy) để phân biệt đúng nguồn gốc — không phải icon chọn ngẫu nhiên. */
function gasLabelIcon(gas) {
  const icon = gas === "CO" || gas === "CO2" ? "book" : "flask";
  return `<svg class="gas-icon" aria-hidden="true"><use href="#icon-${icon}"></use></svg>`;
}

document.addEventListener("DOMContentLoaded", init);
