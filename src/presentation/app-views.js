/* app-views.js — Các bộ chọn CHẾ ĐỘ XEM có nhớ lựa chọn trong localStorage (sở thích giao diện của trình duyệt, không
   phải dữ liệu nghiệp vụ): bảng Lịch sử đo (Khí/Dầu + bộ lọc nguồn), Loại thiết bị ở tab Lý-Hóa dầu, Dự báo xu hướng,
   ẩn/hiện khối Thông số kỹ thuật, ô "Loại MBA". Tách từ app-core.js (Bước 4.2 REFACTOR_PLAN). Nạp TRƯỚC app-core.js. */

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

/** Khóa localStorage lưu trạng thái tick "Ẩn phần này" ở khối "Thông số kỹ thuật thiết
 *  bị" (tab "DGA", #f_hideNameplateFields) — SỞ THÍCH GIAO DIỆN riêng trình duyệt (giống
 *  TAB_LAYOUT_STORAGE_KEY/TREND_FORECAST_ENABLED_STORAGE_KEY ở trên), KHÔNG lưu qua
 *  Storage (gsheet/Supabase) — mỗi trình duyệt/máy tự nhớ lựa chọn riêng. */
const NAMEPLATE_FIELDS_HIDDEN_STORAGE_KEY = "dga_nameplate_fields_hidden";

/** Ẩn/hiện #nameplateFieldsWrap (dropzone nameplate + 8 trường "Thông số kỹ thuật thiết
 *  bị", index.html) theo nút icon con mắt #btnToggleNameplateFields — CHỈ ẩn giao diện,
 *  KHÔNG xóa giá trị đã nhập trong các ô (vẫn được lưu/gửi bình thường khi "Phân tích &
 *  Lưu", xem onAnalyze() ở ui-dga.js) — bấm lại để hiện thì dữ liệu vẫn còn nguyên. Mặc
 *  định HIỆN (icon-eye, aria-pressed="false") nếu người dùng CHƯA từng đổi lựa chọn này
 *  bao giờ, giữ hành vi cũ — kiểu ẩn/hiện giống nút ẩn/hiện mật khẩu. */
function setupNameplateFieldsToggle() {
  const btn = $("btnToggleNameplateFields");
  const wrap = $("nameplateFieldsWrap");
  if (!btn || !wrap) return;
  const iconUse = btn.querySelector("use");
  const applyState = (hidden) => {
    wrap.classList.toggle("hidden", hidden);
    btn.setAttribute("aria-pressed", hidden ? "true" : "false");
    btn.title = hidden ? "Hiện phần này" : "Ẩn phần này";
    if (iconUse) iconUse.setAttribute("href", hidden ? "#icon-eye-off" : "#icon-eye");
  };
  let saved = null;
  try { saved = localStorage.getItem(NAMEPLATE_FIELDS_HIDDEN_STORAGE_KEY); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
  applyState(saved === "1");
  btn.addEventListener("click", () => {
    const nowHidden = btn.getAttribute("aria-pressed") !== "true";
    applyState(nowHidden);
    try { localStorage.setItem(NAMEPLATE_FIELDS_HIDDEN_STORAGE_KEY, nowHidden ? "1" : "0"); } catch (e) { /* localStorage bị chặn (chế độ riêng tư/tắt lưu trữ) — chủ ý bỏ qua, app vẫn chạy */ }
  });
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
  // Đổi bảng đang xem thì nạp lại đúng bảng đó theo bộ lọc #lichsu_station/#lichsu_device hiện tại — cả 3
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
 *  Storage. Mỗi lần mở app luôn bắt đầu ở "MBA/Kháng dầu" (giống #f_loai) — KHÔNG nhớ lựa
 *  chọn lần trước (trước đây có nhớ qua localStorage "dga_dau_equipmenttype", đã bỏ theo
 *  yêu cầu; khóa cũ được xóa lúc khởi động). MBA/Kháng dầu gộp chung với OLTC (#dauMbaWrap, OLTC
 *  là 1 khoang dầu phụ CỦA chính MBA đó — xem ghi chú ở index.html); TI và TU đều dùng
 *  chung 1 khối "Dầu cách điện TI/TU" (#dauInstrumentWrap) — chọn TI/TU ở đây thì tự
 *  đồng bộ luôn #tio_equipmenttype BÊN TRONG khối đó theo đúng lựa chọn, khỏi phải chọn
 *  lại lần 2 (xem onTioEquipmentTypeChange(), ui-ti-oil.js, lọc lại danh sách Nhà sản
 *  xuất theo đúng loại). Sứ xuyên/Khác chưa có tính năng nhập dầu ở tab này (QĐ1901
 *  không có bảng dầu cho sứ xuyên, "Khác" không xác định được tiêu chuẩn nào) nên ẩn cả
 *  3 khối, chỉ hiện ghi chú #dauNoOilSupportNote. */
const LEGACY_DAU_EQUIPMENTTYPE_STORAGE_KEY = "dga_dau_equipmenttype";

function toggleDauEquipmentType() {
  const select = $("dau_equipmenttype");
  if (!select) return;
  const value = select.value;
  const isMba = value === DGA.EQUIPMENT_TYPES.MBA;
  // Sứ xuyên dùng chung khối dầu TI/TU: cùng kiểu đánh giá theo tiêu chuẩn nhà sản xuất (2 mức Bình thường/Loại bỏ)
  const isInstrument = value === DGA.EQUIPMENT_TYPES.TI || value === DGA.EQUIPMENT_TYPES.TU || value === DGA.EQUIPMENT_TYPES.BUSHING;

  $("dauMbaWrap").classList.toggle("hidden", !isMba);
  $("dauInstrumentWrap").classList.toggle("hidden", !isInstrument);
  $("dauNoOilSupportNote").classList.toggle("hidden", isMba || isInstrument);

  if (isInstrument && $("tio_equipmenttype").value !== value) {
    $("tio_equipmenttype").value = value;
    onTioEquipmentTypeChange();
  }
}

function setupDauEquipmentTypeToggle() {
  const select = $("dau_equipmenttype");
  if (!select) return;
  select.addEventListener("change", toggleDauEquipmentType);
  select.value = DGA.EQUIPMENT_TYPES.MBA; // luôn mở ở MBA/Kháng dầu (kể cả khi trình duyệt tự khôi phục lựa chọn cũ của form)
  try { localStorage.removeItem(LEGACY_DAU_EQUIPMENTTYPE_STORAGE_KEY); } catch (e) { /* localStorage bị chặn — bỏ qua */ }
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

function toggleMbaSubtypeField() {
  const isMba = $("f_loai").value === DGA.EQUIPMENT_TYPES.MBA;
  $("f_mbasubtype_wrap").classList.toggle("hidden", !isMba);
}
