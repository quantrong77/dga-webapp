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
    const roleLabel = Auth.current.role === "admin" ? "Admin" : "User";
    $("userBadge").textContent = `${Auth.current.email} — ${roleLabel}`;
    $("userBadge").classList.remove("hidden");
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
  setupHandbookLightbox();
  setupMindmap();
  setupOverviewMindmap();
  setupSampleMethods();
  setupSamplingLightbox();
  setupFeedbackDropzone();
  setupFeedbackPaste();
  setupFeedbackLightbox();
  $("f_ngay").value = new Date().toISOString().slice(0, 10);
  $("o_ngay").value = new Date().toISOString().slice(0, 10);
  $("ot_ngay").value = new Date().toISOString().slice(0, 10);
  populateOilVoltageClasses();
  toggleOilMembraneField();
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

  // Đến đây cả 4 nguồn dữ liệu mà gợi ý Trạm/Thiết bị dùng tới (stations,
  // measurements, oil_tests, oltc_oil_tests) đều đã thử tải xong (thành công hay
  // lỗi đều tắt thông báo — lỗi đã có console.warn/alert riêng ở từng khối trên).
  setComboLoading(false);

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

  $("btnAnalyze").addEventListener("click", onAnalyze);
  $("btnClearForm").addEventListener("click", clearForm);
  $("btnCancelEditMeasurement").addEventListener("click", clearForm);
  $("f_bbtn").addEventListener("change", onBbtnFileSelected);
  setupBbtnDropzone();
  setupInfoPopovers();
  setupTabLayoutToggle();
  setupSidebarCollapseToggle();
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
  $("btnAnalyzeOltcOil").addEventListener("click", onAnalyzeOltcOil);
  $("btnClearOltcOilForm").addEventListener("click", clearOltcOilForm);
  $("btnCancelEditOltcOilTest").addEventListener("click", clearOltcOilForm);
  $("ot_voltage_class").addEventListener("change", toggleOltcMembraneField);
  $("ot_samplepoint").addEventListener("change", toggleOltcPhaseField);
  $("fb_image").addEventListener("change", onFeedbackImageSelected);
  $("btnRemoveFbImage").addEventListener("click", clearFeedbackImage);
  $("btnSubmitFeedback").addEventListener("click", onSubmitFeedback);
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
 *  ở style.css), lưu lại lựa chọn vào localStorage để lần sau mở lại vẫn giữ nguyên.
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
    try { localStorage.setItem(TAB_LAYOUT_STORAGE_KEY, next ? "sidebar" : "top"); } catch (e) {}
  });
}

/** Khóa localStorage lưu trạng thái thu gọn sidebar — chỉ có tác dụng hiển thị khi
 *  đang ở bố cục dọc (xem CSS "body.tabs-sidebar.sidebar-collapsed" ở style.css), lưu
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
 *  cũ. Nút này CSS đã tự ẩn khi không ở bố cục dọc/màn hình hẹp (xem style.css) nên ở
 *  đây chỉ cần lo phần bật/tắt + lưu lựa chọn, không cần kiểm tra thêm điều kiện. */
function setupSidebarCollapseToggle() {
  const btn = $("btnCollapseSidebar");
  if (!btn) return;
  applySidebarCollapse(document.body.classList.contains("sidebar-collapsed"));
  btn.addEventListener("click", () => {
    const next = !document.body.classList.contains("sidebar-collapsed");
    applySidebarCollapse(next);
    try { localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? "1" : "0"); } catch (e) {}
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
    });
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.addEventListener("DOMContentLoaded", init);
