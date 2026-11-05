/* ui-input-subtabs.js — 2 tab con DÙNG CHUNG cho tab "Khí hòa tan" (#tab-nhap) và "Lý-Hóa dầu" (#tab-dau):
     - "Nhập BBTN cũ" (mode "import"): đọc BBTN PDF/DOCX + khung đối chiếu, nhập hàng loạt, Số liệu đã lưu
       của thiết bị đang chọn ở form.
     - "Lập BBTN" (mode "lap"): nhập tay, đánh giá, xuất BBTN (docx).
   Form nhập liệu là MỘT form dùng chung cho cả 2 tab con (đọc BBTN vẫn đổ số liệu vào đúng form đó để đối
   chiếu rồi lưu) — tab con chỉ ẩn/hiện các khối gắn lớp .mode-import / .mode-lap (CSS theo thuộc tính
   data-input-mode trên <section>, xem style-nav-layout.css). Không đổi id/hành vi của khối nào. */

const INPUT_MODE_STORAGE_KEY = "dga_input_subtab_v1";
const INPUT_MODE_TABS = ["nhap", "dau"];
const INPUT_MODES = ["import", "lap"];

function inputModeLoad() {
  try { return JSON.parse(localStorage.getItem(INPUT_MODE_STORAGE_KEY) || "{}") || {}; } catch (_) { return {}; }
}

function getInputMode(tab) {
  const sec = $("tab-" + tab);
  return (sec && sec.dataset.inputMode) || "import";
}

/** Đổi tab con của tab `tab` ("nhap" | "dau") sang `mode` ("import" | "lap"); nhớ lựa chọn giữa các lần mở app. */
function setInputMode(tab, mode, opts) {
  const sec = $("tab-" + tab);
  if (!sec || !INPUT_MODES.includes(mode)) return;
  sec.dataset.inputMode = mode;
  sec.querySelectorAll(".input-subtab-btn").forEach((b) => {
    const on = b.dataset.inputMode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  if (opts && opts.persist === false) return;
  const saved = inputModeLoad();
  saved[tab] = mode;
  try { localStorage.setItem(INPUT_MODE_STORAGE_KEY, JSON.stringify(saved)); } catch (_) {}
}

// ---------------------------------------------------------------------
// Số liệu đã lưu của THIẾT BỊ ĐANG CHỌN ở form (cùng 1 cách lọc cho DGA và dầu): khớp CHÍNH XÁC Trạm/Thiết bị
// đã nhập (bỏ khoảng trắng 2 đầu, giống bộ lọc tab "Lịch sử đo"); để trống cả 2 → chưa hiện gì (xem toàn bộ ở
// tab "Lịch sử đo").
// ---------------------------------------------------------------------
function savedDeviceFilter(tramId, deviceId) {
  const station = $(tramId) ? $(tramId).value.trim() : "";
  const device = $(deviceId) ? $(deviceId).value.trim() : "";
  return { station, device, active: !!(station || device) };
}

function savedFilterRecords(records, f) {
  if (!f.active) return [];
  return (records || [])
    .filter((r) => (!f.station || (r.tram || "").trim() === f.station) && (!f.device || (r.thiet_bi || "").trim() === f.device))
    .sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
}

/** Dòng mô tả trên bảng + nội dung thông báo khi bảng trống. */
function savedRenderCaption(captionId, emptyId, f, count, noun) {
  const label = [f.station, f.device].filter(Boolean).join(" · ");
  if ($(captionId)) {
    $(captionId).textContent = f.active
      ? `${label} — ${count} ${noun} đã lưu.`
      : "Nhập hoặc chọn Trạm và Thiết bị ở form phía trên để xem số liệu đã lưu của thiết bị đó (toàn bộ dữ liệu xem ở tab \"Lịch sử đo\").";
  }
  if ($(emptyId)) {
    $(emptyId).textContent = f.active ? `Thiết bị này chưa có ${noun} nào được lưu.` : "";
  }
}

function renderNhapSavedTable() {
  if (!$("nhapSavedTable") || typeof renderMeasurementRows !== "function") return;
  const f = savedDeviceFilter("f_tram", "f_thietbi");
  const rows = savedFilterRecords(_allMeasurements, f);
  savedRenderCaption("nhapSavedCaption", "nhapSavedEmpty", f, rows.length, "lần đo khí hòa tan");
  renderMeasurementRows($("nhapSavedTable"), rows);
  $("nhapSavedEmpty").classList.toggle("hidden", rows.length > 0 || !f.active);
}

function renderOilSavedTable() {
  if (!$("oilHistoryTable") || typeof renderOilTestRows !== "function") return;
  const f = savedDeviceFilter("o_tram", "o_thietbi");
  const rows = savedFilterRecords(_allOilTests, f);
  savedRenderCaption("oilSavedCaption", "oilHistoryEmpty", f, rows.length, "thí nghiệm dầu MBA chính");
  renderOilTestRows("oilHistoryTable", "oilHistoryEmpty", rows);
  if (!f.active) $("oilHistoryEmpty").classList.add("hidden");
}

function renderOltcSavedTable() {
  if (!$("oltcOilHistoryTable") || typeof renderOltcOilTestRows !== "function") return;
  // OLTC là khoang dầu CỦA chính MBA đó: khi "kế thừa" bật, ot_tram/ot_thietbi đã được chép từ form dầu MBA chính
  const f = savedDeviceFilter("ot_tram", "ot_thietbi");
  const rows = savedFilterRecords(_allOltcOilTests, f);
  savedRenderCaption("oltcSavedCaption", "oltcOilHistoryEmpty", f, rows.length, "thí nghiệm dầu OLTC");
  renderOltcOilTestRows("oltcOilHistoryTable", "oltcOilHistoryEmpty", rows);
  if (!f.active) $("oltcOilHistoryEmpty").classList.add("hidden");
}

// Form TI/TU 1 pha (#tio_*) và biên bản 3 pha (#t3_*) nằm cạnh nhau: bảng đi theo form được nhập/mở GẦN NHẤT
// (gán ở listener bên dưới, onEditTioOilTest() và tio3FillForm()); form đó trống thì dùng form còn lại.
let _tioSavedSource = "tio";

function renderTioSavedTable() {
  if (!$("tioOilHistoryTable") || typeof renderTioOilTestRows !== "function") return;
  const src = _tioSavedSource === "t3" ? ["t3_tram", "t3_thietbi"] : ["tio_tram", "tio_thietbi"];
  const alt = _tioSavedSource === "t3" ? ["tio_tram", "tio_thietbi"] : ["t3_tram", "t3_thietbi"];
  let f = savedDeviceFilter(src[0], src[1]);
  if (!f.active) f = savedDeviceFilter(alt[0], alt[1]);
  const rows = savedFilterRecords(typeof _allTioOilTests !== "undefined" ? _allTioOilTests : [], f);
  savedRenderCaption("tioSavedCaption", "tioOilHistoryEmpty", f, rows.length, "thí nghiệm dầu TI/TU");
  renderTioOilTestRows("tioOilHistoryTable", "tioOilHistoryEmpty", rows);
  if (!f.active) $("tioOilHistoryEmpty").classList.add("hidden");
}

function debounceSaved(fn, ms) {
  let t = null;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

function setupInputSubtabs() {
  const saved = inputModeLoad();
  INPUT_MODE_TABS.forEach((tab) => {
    const sec = $("tab-" + tab);
    if (!sec) return;
    sec.querySelectorAll(".input-subtab-btn").forEach((btn) => {
      btn.addEventListener("click", () => setInputMode(tab, btn.dataset.inputMode));
    });
    setInputMode(tab, INPUT_MODES.includes(saved[tab]) ? saved[tab] : "import");
  });

  // Bảng Số liệu đã lưu đi theo Trạm/Thiết bị đang gõ/chọn ở form (combo đổi giá trị bằng sự kiện input/change)
  const wire = (ids, fn) => {
    const run = debounceSaved(fn, 200);
    ids.forEach((id) => {
      if (!$(id)) return;
      $(id).addEventListener("input", run);
      $(id).addEventListener("change", run);
    });
  };
  wire(["f_tram", "f_thietbi"], renderNhapSavedTable);
  wire(["o_tram", "o_thietbi", "ot_tram", "ot_thietbi"], () => { renderOilSavedTable(); renderOltcSavedTable(); });
  wire(["tio_tram", "tio_thietbi"], () => { _tioSavedSource = "tio"; renderTioSavedTable(); });
  wire(["t3_tram", "t3_thietbi"], () => { _tioSavedSource = "t3"; renderTioSavedTable(); });
}

/** Vẽ lại mọi bảng Số liệu đã lưu — gọi sau khi form được điền bằng code (sửa bản ghi, đọc BBTN, xóa form):
 *  gán .value không phát sự kiện input/change nên các listener ở setupInputSubtabs() không tự chạy. */
function refreshSavedTables() {
  renderNhapSavedTable();
  renderOilSavedTable();
  renderOltcSavedTable();
  renderTioSavedTable();
}

/** Mở 1 bản ghi đã lưu lên form (Sửa/Xem từ "Lịch sử đo", "Cảnh báo" hoặc bảng Số liệu đã lưu): chuyển về tab con
 *  "Nhập BBTN cũ" — nơi có bảng Số liệu đã lưu của thiết bị đó — rồi vẽ lại bảng theo thiết bị vừa nạp. */
function inputOpenRecord(tab) {
  setInputMode(tab, "import", { persist: false });
  refreshSavedTables();
}
