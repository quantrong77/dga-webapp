/* ui-dga.js — Tab "DGA": form "1. Thông tin lần đo" (đính kèm BBTN, tự động điền
   từ bbtn-import.js), phân tích & lưu (onAnalyze), hiển thị kết quả (renderResults),
   và vẽ Tam giác Duval. Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước
   chia sẻ scope giữa các file ui-*.js. */


// _editingMeasurementId: id của lần đo đang SỬA (null = đang nhập MỚI). Cùng cơ chế
// với _editingStandardId (xem onEditStandard/resetStandardForm bên dưới).
let _editingMeasurementId = null;
// _editingOriginalRecord: bản ghi GỐC (trước khi sửa), gán ở onEditMeasurement() —
// dùng để SO SÁNH với giá trị vừa nhập lúc bấm "Cập nhật & Lưu" (xem onAnalyze()), phát
// hiện đúng những khí/N2/O2 đã bị chỉnh sửa để tô nền đỏ cảnh báo + ghi log kèm timestamp
// ở tab "Lịch sử đo" (xem diffTrackedGasFields() ở app-core.js, refreshHistoryUI() ở
// ui-history.js). null khi đang nhập MỚI (không có gì để so sánh).
let _editingOriginalRecord = null;
// _editingMeasurementAttachment: { bbtn_url, bbtn_name, bbtn_file_id } của BBTN đã lưu
// trên bản ghi đang sửa (null = chưa có/đang nhập mới) — giữ nguyên khi lưu lại NẾU
// người dùng không chọn file mới và không bấm "Bỏ file" (xem onAnalyze()).
let _editingMeasurementAttachment = null;
// _removeBbtnOnSave: true khi người dùng bấm "Bỏ file" trong lúc sửa — lần lưu kế
// tiếp sẽ xóa bbtn_url/bbtn_name/bbtn_file_id khỏi bản ghi thay vì giữ nguyên.
let _removeBbtnOnSave = false;
// _lastAnalysis: toàn bộ dữ liệu + kết quả tính toán của lần "Phân tích & Lưu" gần nhất
// (gán ở cuối onAnalyze(), ngay trước khi gọi renderResults() — cùng 1 nguồn dữ liệu
// với những gì đang hiển thị trên màn hình) — dùng để xuất BBTN (docx), xem
// onExportBbtn() bên dưới và bbtn-export.js. null khi chưa phân tích lần nào trong
// phiên làm việc này (bấm "Xuất BBTN" lúc đó sẽ báo yêu cầu phân tích trước).
let _lastAnalysis = null;

// f_kieumay..f_hientrangvanhanh: 8 trường "thông số kỹ thuật thiết bị" (nameplate) —
// không dùng để tính toán DGA, chỉ lưu kèm bản ghi để điền vào Báo cáo phân tích kỹ
// thuật (docx), xem tech-report-export.js.
const TECH_SPEC_FIELD_IDS = [
  "f_kieumay", "f_namsx", "f_namvanhanh", "f_dienapdm",
  "f_sochetao", "f_loaidau", "f_ketcaucachdien", "f_hientrangvanhanh",
];

// f_ngaythinghiem..f_doam: 4 trường "thông tin thí nghiệm bổ sung" — cũng không dùng
// để tính toán DGA, chỉ lưu kèm bản ghi để điền vào BBTN (docx) khi xuất, xem
// bbtn-export.js. Khác TECH_SPEC_FIELD_IDS ở chỗ đây là thông tin của TỪNG LẦN đo
// (có thể khác nhau giữa các lần đo cùng thiết bị), không phải nameplate cố định.
const BBTN_EXTRA_FIELD_IDS = ["f_ngaythinghiem", "f_lydothinghiem", "f_nhietdo", "f_doam"];

function clearForm() {
  ["f_tram", "f_thietbi", "f_ghichu"].forEach((id) => ($(id).value = ""));
  TECH_SPEC_FIELD_IDS.forEach((id) => ($(id).value = ""));
  BBTN_EXTRA_FIELD_IDS.forEach((id) => ($(id).value = ""));
  // Checkbox "Ngăn OLTC (thông dầu/khí với thùng chính?)" — về mặc định KHÔNG tick.
  $("f_mbasubtype").checked = false;
  DGA.GASES.forEach((g) => ($("g_" + g).value = ""));
  // N2, O2 (tùy chọn) + điều kiện áp dụng Bảng 63 — KHÔNG thuộc DGA.GASES nên phải xóa
  // riêng (xem ghi chú "KHÍ BỔ SUNG N2, O2" ở index.html).
  $("g_N2").value = "";
  $("g_O2").value = "";
  $("f_bang63_voltage").value = "110-220";
  $("f_bang63_applicable").checked = false;
  $("f_landocount").value = 1;
  $("f_bbtn").value = "";
  renderBbtnDropzoneLabel();
  $("f_nameplate").value = "";
  renderNameplateDropzoneLabel();
  $("nameplateImportNote").classList.add("hidden");
  $("nameplateRawTextNote").classList.add("hidden");
  $("resultsPanel").classList.add("hidden");
  resetMeasurementEditState();
}

function resetMeasurementEditState() {
  _editingMeasurementId = null;
  _editingOriginalRecord = null;
  _editingMeasurementAttachment = null;
  _removeBbtnOnSave = false;
  $("f_bbtn").value = "";
  renderBbtnDropzoneLabel();
  $("editingMeasurementNote").classList.add("hidden");
  $("btnCancelEditMeasurement").classList.add("hidden");
  $("btnAnalyze").textContent = "Phân tích & Lưu";
  $("bbtnImportNote").classList.add("hidden");
  renderBbtnCurrent();
}

/** Gợi ý "Lần đo" kế tiếp — chạy khi Trạm/Thiết bị/Pha trên form đổi (xem
 *  addEventListener("change", ...) ở app-core.js initApp()) và sau khi lưu xong 1
 *  lần đo MỚI (xem onAnalyze()), để nếu người dùng nhập tiếp lần đo kế tiếp của
 *  CÙNG thiết bị (không xóa form, chỉ đổi ngày/số liệu) thì "Lần đo" tự nhảy lên.
 *  Khớp theo đúng Trạm + Thiết bị + Pha, giống hệt tiêu chí tìm "lần đo liền trước"
 *  để tính tốc độ sinh khí ở onAnalyze() (và deviceKey() ở ui-history.js). Không
 *  chạy khi đang SỬA 1 bản ghi có sẵn (_editingMeasurementId) — số "Lần đo" gốc của
 *  bản ghi đó phải giữ nguyên dù người dùng có sửa lại Trạm/Thiết bị/Pha hay không,
 *  xem onEditMeasurement(). Nếu chưa có lần đo lịch sử nào khớp, mặc định là 1. */
function updateLanDoSuggestion() {
  if (_editingMeasurementId) return;
  const tram = $("f_tram").value.trim();
  const thietbi = $("f_thietbi").value.trim();
  const pha = $("f_pha").value;
  if (!thietbi) {
    $("f_landocount").value = 1;
    return;
  }
  const matches = (_allMeasurements || []).filter(
    (r) => (r.tram || "").trim() === tram && (r.thiet_bi || "").trim() === thietbi && (r.pha || "") === pha
  );
  const maxLan = matches.reduce((max, r) => Math.max(max, Number(r.lan_do) || 0), 0);
  $("f_landocount").value = maxLan + 1;
}

/** Cập nhật nhãn hiển thị trong Ô KÉO-THẢ BBTN (#bbtnDropzone) — tên file NGƯỜI DÙNG
 *  VỪA CHỌN để tải lên (khác với renderBbtnCurrent(), hiển thị file ĐÃ LƯU trước đó
 *  của bản ghi đang sửa). Đọc trực tiếp từ $("f_bbtn").files nên dùng chung được cho cả
 *  2 cách chọn file: bấm chọn tay (input tự bắn "change") VÀ kéo-thả (gán file vào input
 *  rồi tự bắn "change", xem setupBbtnDropzone() ở app-core.js) — xem onBbtnFileSelected()
 *  bên dưới. Gọi lại mỗi khi $("f_bbtn").value bị xóa (clearForm(),
 *  resetMeasurementEditState()) để nhãn quay về chữ hướng dẫn mặc định. */
function renderBbtnDropzoneLabel() {
  const zone = $("bbtnDropzone");
  const label = $("bbtnDropzoneText");
  if (!zone || !label) return;
  const file = $("f_bbtn").files && $("f_bbtn").files[0];
  if (file) {
    label.textContent = file.name;
    zone.classList.add("has-file");
  } else {
    label.innerHTML = 'Kéo thả file PDF vào đây, hoặc <span class="file-dropzone-link">bấm để chọn file</span>';
    zone.classList.remove("has-file");
  }
}

/** Hiện/ẩn khối "đã đính kèm BBTN: <tên file>" bên dưới ô chọn file, theo
 *  _editingMeasurementAttachment hiện tại (xem onEditMeasurement()/onAnalyze()). */
function renderBbtnCurrent() {
  const wrap = $("bbtnCurrentWrap");
  if (_editingMeasurementAttachment && _editingMeasurementAttachment.bbtn_url) {
    $("bbtnCurrentName").textContent = _editingMeasurementAttachment.bbtn_name || "Biên bản thí nghiệm.pdf";
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
}

/** Mở BBTN (PDF) đã lưu ở tab mới — att = { bbtn_url, bbtn_name }. Chế độ Google
 *  Sheets/Supabase: bbtn_url là link thật, mở thẳng. Chế độ localStorage: bbtn_url có
 *  dạng "local:<measurementId>", chỉ là khóa tra lại qua Storage.getLocalAttachment()
 *  (file thật nằm trong localStorage, base64) — dựng lại thành Blob URL rồi mới mở. */
async function viewBbtn(att) {
  if (!att || !att.bbtn_url) {
    notifyError("Lần đo này chưa có Biên bản thí nghiệm đính kèm.");
    return;
  }
  const url = String(att.bbtn_url);
  if (!url.startsWith("local:")) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const measurementId = url.slice("local:".length);
  const local = Storage.getLocalAttachment(measurementId);
  if (!local) {
    notifyError("Không tìm thấy file đính kèm trong bộ nhớ trình duyệt này (file chỉ lưu được ở máy/trình duyệt đã tải lên).");
    return;
  }
  try {
    const res = await fetch(local.dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener");
  } catch (err) {
    notifyError("Không mở được file: " + ((err && err.message) || err));
  }
}

/** Khi người dùng CHỌN file BBTN (PDF) ở form "1. Thông tin lần đo" — thử đọc PDF
 *  ngay trong trình duyệt (bbtn-import.js, KHÔNG gửi file lên server nào để "đọc")
 *  và tự động điền Trạm/Thiết bị/Loại thiết bị/Pha/Ngày lấy mẫu/Nhà sản xuất/hàm
 *  lượng khí nếu nhận diện được — đỡ phải gõ tay lại khi nhập bổ sung các lần đo
 *  LỊCH SỬ đã có sẵn biên bản PDF (mẫu PTC3/BM.15). Chỉ là gợi ý điền sẵn: mọi
 *  trường vẫn xem/sửa tay được bình thường trước khi lưu, không có gì bị khóa. Việc
 *  lưu file đính kèm thật sự vẫn xảy ra riêng lúc bấm "Phân tích & Lưu" (onAnalyze()). */
async function onBbtnFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  renderBbtnDropzoneLabel();
  const note = $("bbtnImportNote");
  if (!file) {
    note.classList.add("hidden");
    return;
  }
  if (!window.BbtnImport) {
    note.textContent = "Không tự động đọc được BBTN (thư viện đọc PDF chưa tải xong) — vui lòng nhập tay các trường bên dưới.";
    note.classList.remove("hidden");
    return;
  }
  note.textContent = "Đang đọc Biên bản thí nghiệm để tự động điền form...";
  note.classList.remove("hidden");
  let data;
  try {
    data = await window.BbtnImport.extract(file, (m) => {
      // m = { status, progress } từ Tesseract.js — chỉ bắn khi file không có lớp text
      // thật và đang chạy OCR dự phòng (xem bbtn-import.js), nên phần lớn file BBTN
      // (có lớp text) sẽ KHÔNG bao giờ thấy thông báo này, chỉ thấy dòng ở trên.
      if (m && m.status === "recognizing text") {
        note.textContent =
          "File có vẻ là ảnh scan — đang nhận diện chữ (OCR), có thể mất vài chục giây" +
          (typeof m.progress === "number" ? " (" + Math.round(m.progress * 100) + "%)" : "") + "...";
      } else if (m && m.status) {
        note.textContent = "Đang chuẩn bị đọc ảnh scan (OCR)... (" + m.status + ")";
      }
    });
  } catch (err) {
    note.textContent =
      "Không đọc được nội dung file này để tự động điền — " +
      "vui lòng nhập tay các trường bên dưới. (" + ((err && err.message) || err) + ")";
    return;
  }
  if (!data || !data.matchedCount) {
    note.textContent = "Không nhận diện được thông tin nào từ file này (kể cả đã thử đọc bằng OCR nếu là ảnh scan) — vui lòng nhập tay các trường bên dưới.";
    return;
  }

  const filled = [];
  if (data.tram) {
    $("f_tram").value = data.tram;
    filled.push("Trạm");
  }
  if (data.thietbi) {
    $("f_thietbi").value = data.thietbi;
    filled.push("Thiết bị");
  }
  if (data.loai) {
    $("f_loai").value = data.loai;
    refreshManufacturerOptions();
    toggleMbaSubtypeField();
    filled.push("Loại thiết bị");
    if (data.hangSanXuat) {
      const match = Array.from($("f_nsx").options).find(
        (o) => o.value && o.value.toLowerCase().includes(data.hangSanXuat.toLowerCase())
      );
      if (match) {
        $("f_nsx").value = match.value;
        filled.push("Nhà sản xuất");
      }
    }
  }
  // Các trường "Thông số kỹ thuật thiết bị" (dùng khi xuất báo cáo phân tích kỹ thuật)
  // không phụ thuộc Loại thiết bị nên điền độc lập với khối data.loai ở trên — xem
  // bbtn-import.js để biết cách trích từng trường từ mẫu BBTN PTC3/BM.15.
  if (data.soCheTao) {
    $("f_sochetao").value = data.soCheTao;
    filled.push("Số chế tạo");
  }
  if (data.dienApDm) {
    $("f_dienapdm").value = data.dienApDm;
    filled.push("Điện áp định mức");
  }
  if (data.namSx) {
    $("f_namsx").value = data.namSx;
    filled.push("Năm sản xuất");
  }
  if (data.namVanHanh) {
    $("f_namvanhanh").value = data.namVanHanh;
    filled.push("Năm đưa vào vận hành");
  }
  if (data.loaiDau) {
    $("f_loaidau").value = data.loaiDau;
    filled.push("Loại dầu cách điện");
  }
  if (data.pha) {
    $("f_pha").value = data.pha;
    filled.push("Pha");
  }
  if (data.ngay) {
    $("f_ngay").value = data.ngay;
    filled.push("Ngày lấy mẫu");
  }
  // Thông tin thí nghiệm bổ sung (dùng khi xuất BBTN) — cũng tự đọc được từ BBTN như
  // các trường trên, xem BBTN_EXTRA_FIELD_IDS đầu file này.
  if (data.ngayThiNghiem) {
    $("f_ngaythinghiem").value = data.ngayThiNghiem;
    filled.push("Ngày thí nghiệm");
  }
  if (data.lyDoThiNghiem) {
    $("f_lydothinghiem").value = data.lyDoThiNghiem;
    filled.push("Lý do thí nghiệm");
  }
  if (data.nhietDo !== null && data.nhietDo !== undefined) {
    $("f_nhietdo").value = data.nhietDo;
    filled.push("Nhiệt độ môi trường");
  }
  if (data.doAm !== null && data.doAm !== undefined) {
    $("f_doam").value = data.doAm;
    filled.push("Độ ẩm môi trường");
  }
  const gasNames = [];
  Object.keys(data.gases || {}).forEach((g) => {
    const input = $("g_" + g);
    if (input) {
      input.value = data.gases[g];
      gasNames.push(g);
    }
  });
  if (gasNames.length) filled.push("Hàm lượng khí (" + gasNames.join(", ") + ")");

  // Trạm/Thiết bị/Pha vừa điền bằng JS (không bắn "change" tự nhiên như khi người
  // dùng gõ tay/chọn combo) — gọi lại thủ công để "Lần đo" cũng được gợi ý đúng theo
  // lịch sử đã lưu, đúng tinh thần của tính năng này (nhập bổ sung lần đo LỊCH SỬ).
  updateLanDoSuggestion();

  if (!filled.length) {
    note.textContent = "Không nhận diện được thông tin nào từ file này — vui lòng nhập tay các trường bên dưới.";
  } else if (data.viaOCR) {
    note.textContent =
      "Đã tự động điền từ BBTN qua OCR (ảnh scan): " + filled.join(", ") +
      " — đây là nhận diện chữ từ ảnh nên ĐỘ TIN CẬY THẤP HƠN đọc trực tiếp, vui lòng kiểm tra kỹ lại từng số liệu trước khi lưu.";
  } else {
    note.textContent = "Đã tự động điền từ BBTN: " + filled.join(", ") + " — vui lòng kiểm tra lại số liệu trước khi lưu.";
  }
}

/** Cập nhật nhãn hiển thị trong ô kéo-thả ảnh nameplate #nameplateDropzone — cùng cơ
 *  chế với renderBbtnDropzoneLabel() ở trên. */
function renderNameplateDropzoneLabel() {
  const zone = $("nameplateDropzone");
  const label = $("nameplateDropzoneText");
  if (!zone || !label) return;
  const file = $("f_nameplate").files && $("f_nameplate").files[0];
  if (file) {
    label.textContent = file.name;
    zone.classList.add("has-file");
  } else {
    label.innerHTML = 'Kéo thả ảnh chụp nhãn máy vào đây, hoặc <span class="file-dropzone-link">bấm để chọn ảnh</span>';
    zone.classList.remove("has-file");
  }
}

/** Khi người dùng CHỌN ảnh chụp TẤM NHÃN THIẾT BỊ (nameplate) ở khối "Thông số kỹ
 *  thuật thiết bị" — đọc bằng OCR (bbtn/nameplate-import.js, KHÔNG gửi ảnh lên server
 *  nào để "đọc") và gợi ý điền Kiểu máy/Số chế tạo/Năm sản xuất/Điện áp định mức/Loại
 *  dầu cách điện + Nhà sản xuất (khớp mờ với danh sách ở #f_nsx, cùng cách BBTN import
 *  đã làm với data.hangSanXuat — khác chỗ ở đây không có 1 chuỗi trích riêng nên kiểm
 *  tra trực tiếp trên toàn bộ chữ đã đọc được). KHÔNG có mẫu nhãn chung (mỗi hãng trình
 *  bày khác nhau) nên độ tin cậy THẤP HƠN đọc BBTN (xem nameplate-import.js) — luôn hiện
 *  kèm toàn bộ chữ OCR đọc được (#nameplateRawTextNote) để người dùng tự đối chiếu/gõ
 *  tay phần đọc sai hoặc không nhận diện được. Mọi trường vẫn xem/sửa tay bình thường
 *  trước khi lưu, không có gì bị khóa. */
async function onNameplateFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  renderNameplateDropzoneLabel();
  const note = $("nameplateImportNote");
  const rawNote = $("nameplateRawTextNote");
  rawNote.classList.add("hidden");
  if (!file) {
    note.classList.add("hidden");
    return;
  }
  if (!window.NameplateImport) {
    note.textContent = "Không tự động đọc được ảnh nhãn (thư viện OCR chưa tải xong) — vui lòng nhập tay các trường bên dưới.";
    note.classList.remove("hidden");
    return;
  }
  note.textContent = "Đang nhận diện chữ từ ảnh nhãn thiết bị (OCR), có thể mất vài chục giây...";
  note.classList.remove("hidden");
  let data;
  try {
    data = await window.NameplateImport.extract(file, (m) => {
      if (m && m.status) {
        note.textContent =
          "Đang nhận diện chữ từ ảnh nhãn thiết bị (OCR)... (" + m.status +
          (typeof m.progress === "number" ? " " + Math.round(m.progress * 100) + "%" : "") + ")";
      }
    });
  } catch (err) {
    note.textContent =
      "Không đọc được ảnh này — vui lòng thử ảnh rõ nét hơn hoặc nhập tay các trường bên dưới. (" +
      ((err && err.message) || err) + ")";
    return;
  }

  const filled = [];
  if (data.kieuMay) { $("f_kieumay").value = data.kieuMay; filled.push("Kiểu máy"); }
  if (data.soCheTao) { $("f_sochetao").value = data.soCheTao; filled.push("Số chế tạo"); }
  if (data.namSx) { $("f_namsx").value = data.namSx; filled.push("Năm sản xuất"); }
  if (data.dienApDm) { $("f_dienapdm").value = data.dienApDm; filled.push("Điện áp định mức"); }
  if (data.loaiDau) { $("f_loaidau").value = data.loaiDau; filled.push("Loại dầu cách điện"); }
  if (data.rawText) {
    const rawLower = data.rawText.toLowerCase();
    const match = Array.from($("f_nsx").options).find((o) => o.value && rawLower.includes(o.value.toLowerCase()));
    if (match) { $("f_nsx").value = match.value; filled.push("Nhà sản xuất"); }
  }

  // Luôn hiện toàn bộ chữ OCR đọc được — nameplate không có mẫu chung nên rất có thể bỏ
  // sót trường (VD nhãn hãng khác cách trình bày), người dùng cần xem trực tiếp để tự
  // gõ tay phần còn thiếu thay vì chỉ biết "không đọc được" mà không có gì đối chiếu.
  if (data.rawText) {
    rawNote.textContent = "Toàn bộ chữ đọc được từ ảnh (để đối chiếu/gõ tay phần còn thiếu):\n" + data.rawText;
    rawNote.classList.remove("hidden");
  }

  note.textContent = filled.length
    ? "Đã gợi ý điền từ ảnh nhãn thiết bị (OCR): " + filled.join(", ") +
      " — nhãn thiết bị không có mẫu chung nên ĐỘ TIN CẬY THẤP, vui lòng đối chiếu kỹ với ảnh gốc trước khi lưu. " +
      "\"Năm đưa vào vận hành\"/\"Kết cấu cách điện dầu\"/\"Hiện trạng vận hành\" là thông tin vận hành, không in trên nhãn máy — vẫn cần nhập tay."
    : "Không nhận diện được trường nào theo các nhãn thường gặp — xem phần chữ đọc được bên dưới để tự gõ tay.";
}

/** Nạp 1 lần đo đã lưu lên form tab "DGA" để sửa — bấm "Cập nhật & Lưu" sẽ
 *  ghi đè đúng bản ghi này (giữ nguyên id), thay vì tạo thêm 1 bản ghi mới. Chỉ gọi
 *  được khi canEditRecord(rec) đã xác nhận (nút "Sửa" chỉ hiện khi đủ quyền) — server
 *  (Code.gs) vẫn kiểm tra lại quyền này, đây chỉ là gợi ý hiển thị phía client. */
function onEditMeasurement(rec) {
  if (!canEditRecord(rec)) return;
  _editingMeasurementId = rec.id;
  _editingOriginalRecord = rec;
  _editingMeasurementAttachment = rec.bbtn_url
    ? { bbtn_url: rec.bbtn_url, bbtn_name: rec.bbtn_name, bbtn_file_id: rec.bbtn_file_id }
    : null;
  _removeBbtnOnSave = false;
  $("f_bbtn").value = "";
  renderBbtnDropzoneLabel();
  $("bbtnImportNote").classList.add("hidden");
  renderBbtnCurrent();
  $("f_tram").value = rec.tram || "";
  $("f_thietbi").value = rec.thiet_bi || "";
  $("f_loai").value = rec.equipment_type || "";
  refreshManufacturerOptions();
  toggleMbaSubtypeField();
  // Checkbox "Ngăn OLTC (thông dầu/khí với thùng chính?)" — chỉ tick nếu bản ghi lưu
  // ĐÚNG giá trị COMM_OLTC; bản ghi cũ/không có OLTC/không rõ đều mặc định bỏ tick
  // (NO_OLTC, chặt hơn — xem MBA_SUBTYPES ở dga-logic.js).
  $("f_mbasubtype").checked = rec.mba_subtype === DGA.MBA_SUBTYPES.COMM_OLTC;
  $("f_nsx").value = rec.manufacturer || "";
  $("f_pha").value = rec.pha || "";
  $("f_landocount").value = rec.lan_do ?? 1;
  // DGA.formatSampleDate(): phòng hờ bản ghi cũ còn dính lỗi Google Sheets trả về
  // datetime đầy đủ thay vì "yyyy-MM-dd" thuần (xem ghi chú đầy đủ ở dga-logic.js) — nếu
  // không format lại, <input type="date"> sẽ hiện TRỐNG vì giá trị sai định dạng.
  $("f_ngay").value = DGA.formatSampleDate(rec.sample_date) || "";
  $("f_ghichu").value = rec.ghi_chu || "";
  $("f_kieumay").value = rec.kieu_may || "";
  $("f_namsx").value = rec.nam_sx || "";
  $("f_namvanhanh").value = rec.nam_van_hanh || "";
  $("f_dienapdm").value = rec.dien_ap_dm || "";
  $("f_sochetao").value = rec.so_che_tao || "";
  $("f_loaidau").value = rec.loai_dau || "";
  $("f_ketcaucachdien").value = rec.ket_cau_cach_dien || "";
  $("f_hientrangvanhanh").value = rec.hien_trang_van_hanh || "";
  $("f_ngaythinghiem").value = rec.ngay_thi_nghiem || "";
  $("f_lydothinghiem").value = rec.ly_do_thi_nghiem || "";
  $("f_nhietdo").value = rec.nhiet_do ?? "";
  $("f_doam").value = rec.do_am ?? "";
  const gasesRec = recordGases(rec);
  DGA.GASES.forEach((g) => { $("g_" + g).value = gasesRec[g] ?? ""; });
  $("g_N2").value = rec.n2 ?? "";
  $("g_O2").value = rec.o2 ?? "";
  $("f_bang63_voltage").value = rec.bang63_voltage_class || "110-220";
  $("f_bang63_applicable").checked = !!rec.bang63_applicable;
  $("editingMeasurementNote").classList.remove("hidden");
  $("btnCancelEditMeasurement").classList.remove("hidden");
  $("btnAnalyze").textContent = "Cập nhật & Lưu";
  document.querySelector('button.tab-btn[data-tab="nhap"]').click();
  $("f_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------------------------------------------------------------------
// Tam giác Duval — vẽ khung tam giác + đường phân vùng (theo bảng "Limits of
// zones", Annex B, Figure B.3, IEC 60599:2022) và điểm chẩn đoán bằng SVG.
// Hệ tọa độ: đỉnh CH4 ở trên (50, 0 khi lật trục y), C2H2 dưới-trái (0, H),
// C2H4 dưới-phải (100, H), với H = 100*sqrt(3)/2 ≈ 86,6. viewBox lật trục y
// (y_svg = H - y_toan_hoc) để đỉnh CH4 hiển thị ở trên.
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

  // Viền tam giác chính
  s += `<polygon class="duval-tri-line" points="0,${h} 100,${h} 50,0" />`;

  // Lưới phần trăm (10% một nấc) song song 3 cạnh — chỉ vẽ nhẹ để tham khảo
  for (let k = 10; k < 100; k += 10) {
    // đường song song cạnh đáy (ứng với %CH4 = k)
    const y = duvalToSvgY((k / 100) * h);
    const xL = (k / 100) * 50;
    const xR = 100 - (k / 100) * 50;
    s += `<line class="duval-grid-line" x1="${xL}" y1="${y}" x2="${xR}" y2="${y}" />`;
  }

  // Đường phân vùng chính theo bảng "Limits of zones" gốc (Annex B, Figure B.3,
  // đối chiếu trực tiếp với IEC 60599-2022.pdf trang 37 do người dùng cung cấp):
  const P = (m, e, a) => duvalEdgePoint({ pctCH4: m, pctC2H4: e, pctC2H2: a });
  const zoneLines = [
    // PD: %CH4 = 98 (đường song song đáy gần đỉnh)
    [P(98, 2, 0), P(98, 0, 2)],
    // Dải T1/T2/T3 — biên ngoài %C2H2 = 4, từ %C2H4=0 đến %C2H4=50
    [P(96, 0, 4), P(46, 50, 4)],
    // T1/T2 biên %C2H4 = 20 (trong dải %C2H2<=4)
    [P(80, 20, 0), P(76, 20, 4)],
    // T2/T3 biên %C2H4 = 50 (trong dải %C2H2<=4)
    [P(50, 50, 0), P(46, 50, 4)],
    // D1/D2 biên %C2H2 = 13 (phần %C2H4 0-23), từ cạnh CH4-C2H2 tới góc (23,13)
    [P(87, 0, 13), P(64, 23, 13)],
    // D1/D2 biên %C2H4 = 23 (phần %C2H2 13-29), từ góc (23,13) tới góc (23,29)
    [P(64, 23, 13), P(48, 23, 29)],
    // D2/D+T biên %C2H2 = 13 (phần %C2H4 23-40), từ góc (23,13) tới góc (40,13)
    [P(64, 23, 13), P(47, 40, 13)],
    // D2/D+T biên %C2H4 = 40 (phần %C2H2 13-29), từ góc (40,13) tới góc (40,29)
    [P(47, 40, 13), P(31, 40, 29)],
    // D2/D+T biên %C2H2 = 29 (phần %C2H4 23-40), từ góc (23,29) tới góc (40,29)
    [P(48, 23, 29), P(31, 40, 29)],
    // T3(mở rộng)/D+T biên %C2H2 = 15 (từ %C2H4=50 tới cạnh đáy)
    [P(35, 50, 15), P(0, 85, 15)],
  ];
  zoneLines.forEach(([a, b]) => {
    s += `<line class="duval-zone-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
  });

  // Nhãn đỉnh
  s += `<text class="duval-label" x="50" y="-2" text-anchor="middle">CH4</text>`;
  s += `<text class="duval-label" x="-2" y="${h + 4}" text-anchor="start">C2H2</text>`;
  s += `<text class="duval-label" x="102" y="${h + 4}" text-anchor="end">C2H4</text>`;
  s += `<text class="duval-label" x="50" y="${h * 0.35}" text-anchor="middle">D1</text>`;
  s += `<text class="duval-label" x="30" y="${h * 0.6}" text-anchor="middle">D2</text>`;
  s += `<text class="duval-label" x="55" y="${duvalToSvgY(34)}" text-anchor="middle">D+T</text>`;
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

// ---------------------------------------------------------------------
// Phân tích & lưu 1 lần đo
// ---------------------------------------------------------------------
async function onAnalyze() {
  const gases = {};
  DGA.GASES.forEach((g) => (gases[g] = $("g_" + g).value === "" ? 0 : Number($("g_" + g).value)));
  // N2, O2 (tùy chọn) — KHÔNG thuộc DGA.GASES, giữ null khi để trống (khác 7 khí chính
  // luôn mặc định 0) vì computeTotalDissolvedGasPercent()/diagnoseAdditionalRatios()
  // (dga-logic.js) cần phân biệt "chưa nhập" với "đo được 0 ppm" để biết có tính được
  // tỷ lệ O2/N2 và Tổng hàm lượng khí hòa tan (Bảng 63) hay không.
  const n2 = $("g_N2").value === "" ? null : Number($("g_N2").value);
  const o2 = $("g_O2").value === "" ? null : Number($("g_O2").value);
  const bang63VoltageClass = $("f_bang63_voltage").value;
  const bang63Applicable = $("f_bang63_applicable").checked;

  const equipmentType = $("f_loai").value;
  // Checkbox tick = OLTC thông dầu/khí với thùng chính (COMM_OLTC, ngưỡng C2H2 tham
  // khảo nới hơn); bỏ tick (mặc định) = NO_OLTC — xem MBA_SUBTYPES ở dga-logic.js.
  const mbaSubtype = equipmentType === DGA.EQUIPMENT_TYPES.MBA
    ? ($("f_mbasubtype").checked ? DGA.MBA_SUBTYPES.COMM_OLTC : DGA.MBA_SUBTYPES.NO_OLTC)
    : null;

  const measurement = {
    id: _editingMeasurementId || undefined,
    tram: $("f_tram").value.trim(),
    thiet_bi: $("f_thietbi").value.trim(),
    equipment_type: equipmentType,
    mba_subtype: mbaSubtype,
    manufacturer: $("f_nsx").value || null,
    pha: $("f_pha").value,
    lan_do: Number($("f_landocount").value) || 1,
    sample_date: $("f_ngay").value,
    ghi_chu: $("f_ghichu").value.trim(),
    // Thông số kỹ thuật thiết bị (tùy chọn) — xem TECH_SPEC_FIELD_IDS ở clearForm().
    kieu_may: $("f_kieumay").value.trim(),
    nam_sx: $("f_namsx").value ? Number($("f_namsx").value) : null,
    nam_van_hanh: $("f_namvanhanh").value ? Number($("f_namvanhanh").value) : null,
    dien_ap_dm: $("f_dienapdm").value.trim(),
    so_che_tao: $("f_sochetao").value.trim(),
    loai_dau: $("f_loaidau").value.trim(),
    ket_cau_cach_dien: $("f_ketcaucachdien").value.trim(),
    hien_trang_van_hanh: $("f_hientrangvanhanh").value.trim(),
    // Thông tin thí nghiệm bổ sung (tùy chọn) — xem BBTN_EXTRA_FIELD_IDS ở clearForm();
    // tự đọc được từ BBTN (bbtn-import.js) hoặc nhập tay, dùng khi xuất BBTN (docx),
    // xem bbtn-export.js.
    ngay_thi_nghiem: $("f_ngaythinghiem").value || null,
    ly_do_thi_nghiem: $("f_lydothinghiem").value.trim(),
    nhiet_do: $("f_nhietdo").value !== "" ? Number($("f_nhietdo").value) : null,
    do_am: $("f_doam").value !== "" ? Number($("f_doam").value) : null,
    // N2, O2 (tùy chọn) + điều kiện áp dụng Bảng 63 — xem ghi chú ở đầu hàm này.
    n2, o2,
    bang63_voltage_class: bang63VoltageClass,
    bang63_applicable: bang63Applicable,
    ...gases,
  };

  // Lưu vết CHỈNH SỬA số liệu (edited_fields/edited_at/edit_log) — CHỈ áp dụng khi đang
  // SỬA 1 bản ghi có sẵn (_editingMeasurementId + _editingOriginalRecord, gán ở
  // onEditMeasurement()); bản ghi MỚI luôn để trống 3 trường này. Xem
  // diffTrackedGasFields() (app-core.js) — so sánh 7 khí chính + N2/O2 giữa bản ghi GỐC
  // và giá trị vừa nhập — và cách dùng ở refreshHistoryUI() (ui-history.js) để tô nền đỏ
  // đúng ô đã sửa + hiện log đầy đủ (kèm timestamp) khi hover.
  if (_editingMeasurementId && _editingOriginalRecord) {
    const diff = diffTrackedGasFields(_editingOriginalRecord, gases, n2, o2);
    if (diff.editedFields) {
      measurement.edited_fields = diff.editedFields;
      measurement.edited_at = new Date().toISOString();
      const priorLog = _editingOriginalRecord.edit_log || "";
      // Mới nhất lên ĐẦU log, để hover thấy ngay lần sửa gần nhất mà không cần cuộn.
      measurement.edit_log = priorLog ? `${diff.editLogEntry}\n${priorLog}` : diff.editLogEntry;
    } else {
      // Lần sửa này không đổi số liệu khí nào (vd chỉ sửa Ghi chú) — giữ nguyên dấu vết
      // lần sửa SỐ LIỆU gần nhất trước đó (nếu có), không xóa mất bằng chứng cũ.
      measurement.edited_fields = _editingOriginalRecord.edited_fields || "";
      measurement.edited_at = _editingOriginalRecord.edited_at || null;
      measurement.edit_log = _editingOriginalRecord.edit_log || "";
    }
  } else {
    measurement.edited_fields = "";
    measurement.edited_at = null;
    measurement.edit_log = "";
  }

  if (!measurement.thiet_bi || !measurement.sample_date) {
    notifyError("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
    return;
  }
  if (alertIfNegative([
    { label: "H2", value: gases.H2 },
    { label: "CH4", value: gases.CH4 },
    { label: "C2H6", value: gases.C2H6 },
    { label: "C2H4", value: gases.C2H4 },
    { label: "C2H2", value: gases.C2H2 },
    { label: "CO", value: gases.CO },
    { label: "CO2", value: gases.CO2 },
    { label: "N2", value: n2 },
    { label: "O2", value: o2 },
    { label: "Lần đo", value: measurement.lan_do },
    { label: "Năm sản xuất", value: measurement.nam_sx },
    { label: "Năm vận hành", value: measurement.nam_van_hanh },
    { label: "Nhiệt độ môi trường", value: measurement.nhiet_do },
    { label: "Độ ẩm môi trường", value: measurement.do_am },
  ])) return;
  // Cảnh báo (không chặn lưu) nếu để trống 1/nhiều trong 7 khí chính — xem ghi chú đầy đủ
  // ở warnIfEmptyMainGas() (app-core.js). Đặt SAU alertIfNegative (chặn lưu khi có lỗi rõ
  // ràng hơn) nhưng TRƯỚC khi tính toán/lưu, để người dùng kịp thấy cảnh báo dù vẫn lưu
  // bình thường ngay sau đó (không có return ở đây).
  warnIfEmptyMainGas();

  // 1) Xác định tiêu chuẩn áp dụng: NSX nếu có cấu hình đầy đủ; ngược lại, tiêu chuẩn
  //    CHẶT HƠN giữa QĐ1901 và bảng tham khảo tương ứng của IEC 60599:2022 Annex A
  //    (hoặc trực tiếp IEC Annex A khi QĐ1901 chưa có bảng riêng — sứ xuyên).
  const logicMeasurement = { equipmentType: measurement.equipment_type, manufacturer: measurement.manufacturer, mbaSubtype };
  const standard = DGA.resolveStandard(logicMeasurement, toManufacturerStandardsForLogic(_allStandards));

  // 2) TCG + đánh giá tuyệt đối
  const tcg = DGA.computeTCG(gases);
  const evalRows = DGA.evaluateAbsolute(gases, standard.limits);
  const overall = DGA.overallVerdict(evalRows);
  const exceedCount = DGA.countExceedTypical(gases, measurement.equipment_type, logicMeasurement);

  // 3) Ba/bốn tỷ số khí cơ bản + chẩn đoán mã khiếm khuyết — DGA.diagnoseGasFault() tự
  //    chọn ĐÚNG bảng theo loại thiết bị: sứ xuyên dùng Table A.10 (Annex A.5.3, ưu tiên,
  //    tự rơi về Table 1 nếu không mã nào khớp); MBA/TI/TU/Khác dùng thẳng Table 1/Bảng 66
  //    (với TI/TU, ngưỡng PD 0,2 theo Annex A.4.3 — standard.pdThreshold đã resolve sẵn).
  const ratios = DGA.computeRatios(gases);
  const diagnosis = DGA.diagnoseGasFault(gases, measurement.equipment_type, standard.pdThreshold);
  const bushingCodes = measurement.equipment_type === DGA.EQUIPMENT_TYPES.BUSHING
    ? DGA.diagnoseBushingRatios(ratios)
    : [];
  const applicability = DGA.ratioApplicability(exceedCount);

  // 3bis) Chẩn đoán Tam giác Duval 1 (Annex B, Figure B.3)
  const duval = DGA.diagnoseDuval1(gases);

  // 3ter) Ngưỡng LOẠI BỎ riêng của nhà sản xuất (nếu có cấu hình) — cảnh báo nghiêm
  //    trọng hơn mức "không đạt" thông thường, độc lập với ngưỡng tuyệt đối ở trên.
  const condemningRows = DGA.evaluateCondemning(gases, standard.condemning);

  // 3quat) "Đánh giá các tỷ lệ bổ sung" (Điều 54, ngay sau Bảng 66) + Tổng hàm lượng
  //    khí hòa tan (Bảng 63) — xem diagnoseAdditionalRatios()/computeTotalDissolvedGasPercent()/
  //    evaluateBang63() ở dga-logic.js. Cả 2 đều tùy chọn/tham khảo, không ảnh hưởng
  //    overallStatus (chỉ đưa vào recs khi rơi vào điều kiện cảnh báo, xem buildRecommendations()).
  const additionalRatios = DGA.diagnoseAdditionalRatios(gases, n2, o2);
  const bang63Percent = DGA.computeTotalDissolvedGasPercent(gases, n2, o2);
  const bang63 = DGA.evaluateBang63(bang63Percent, bang63VoltageClass, bang63Applicable);
  bang63.value = bang63Percent;

  // 4) Tốc độ sinh khí — tìm lần đo gần nhất trước đó cùng Trạm+Thiết bị+Pha
  let all;
  try {
    all = await Storage.listMeasurements();
  } catch (err) {
    notifyError(storageErrorMessage(err));
    return;
  }
  const prior = all
    .filter((r) => r.tram === measurement.tram && r.thiet_bi === measurement.thiet_bi && r.pha === measurement.pha)
    .filter((r) => new Date(r.sample_date) < new Date(measurement.sample_date))
    .sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date))[0];

  let rateRows = null;
  let priorDiagnosis = null;
  let tcgRate = null;
  if (prior) {
    // prior đọc từ Storage.listMeasurements() nên khí lưu key CHỮ THƯỜNG (h2, ch4...
    // xem normalizeGasKeys() ở storage.js) — phải chuẩn hóa lại về chữ HOA (H2, CH4...)
    // bằng recordGases() (ui-standards.js) trước khi đưa vào computeRateOfChange()/
    // computeRatios(), nếu không mọi giá trị "trước" sẽ luôn đọc ra 0 (khóa không khớp
    // "H2" != "h2"), làm sai lệch tốc độ sinh khí và cả priorDiagnosis bên dưới — cùng
    // cách chuẩn hóa đã dùng đúng ở ui-history.js (renderRateTable()).
    const priorGases = recordGases(prior);
    const deltaDays = Math.round((new Date(measurement.sample_date) - new Date(prior.sample_date)) / 86400000);
    rateRows = DGA.computeRateOfChange(priorGases, gases, deltaDays, standard.rate, measurement.equipment_type);
    // Chẩn đoán mã khiếm khuyết của lần đo liền trước — dùng để phát hiện "đổi loại lỗi"
    // (điều kiện ALARM riêng của lưu đồ IEC 60599, xem computeOverallStatus()) — PHẢI dùng
    // cùng diagnoseGasFault() (cùng bảng theo loại thiết bị) để so sánh cho đúng nghĩa,
    // không dùng lại diagnoseRatios() trần (sẽ luôn là Table 1 kể cả với sứ xuyên).
    priorDiagnosis = DGA.diagnoseGasFault(priorGases, measurement.equipment_type, standard.pdThreshold);
    // Tốc độ sinh khí (%/tháng) của TỔNG lượng khí cháy (TCG) — cùng công thức %/tháng
    // dùng cho từng khí ở trên nhưng KHÔNG có khoảng tham chiếu Bảng 65 riêng cho TCG
    // (chỉ tham khảo). Hiện ở stat-card TCG (renderResults()) và điền vào BBTN khi xuất
    // (tag {tcg_toc}, xem bbtn-export.js).
    tcgRate = DGA.computeTcgRateOfChange(DGA.computeTCG(priorGases), tcg, deltaDays);
  }

  // 4bis) "So với đàn" (đề xuất #2) — phát hiện thiết bị lệch khỏi số đông trong nhóm
  //    thiết bị TƯƠNG TỰ (cùng loại/cấp điện áp/hãng SX, nới dần nếu thiếu dữ liệu),
  //    dùng LẠI đúng `all` vừa gọi ở bước 4 (KHÔNG gọi thêm Storage lần nào nữa). Đây
  //    là THAM KHẢO THỐNG KÊ bổ sung — hoàn toàn tách biệt khỏi overallStatus/recs
  //    (không được lẫn với kết quả Đạt/Không đạt theo QĐ1901/IEC), xem giải thích đầy
  //    đủ ở evaluatePeerAnomaly() (logic/dga-logic-peer.js).
  const peerAnomaly = DGA.evaluatePeerAnomaly(measurement, gases, all);

  // 4ter) "Ca tương tự trong lịch sử đo" (đề xuất #3, case-based reasoning) — tìm trong
  //    TOÀN BỘ Lịch sử đo (không giới hạn cùng loại/hãng như 4bis ở trên) những lần đo
  //    có vector 7 khí gần giống nhất (cosine similarity, xem findSimilarCases() ở
  //    logic/dga-logic-case.js) — cũng dùng lại `all`, không gọi thêm Storage. Kết luận
  //    của từng ca tìm được sẽ được TÍNH LẠI ngay dưới đây (không lưu sẵn) bằng đúng
  //    logic đánh giá hiện có, theo tiêu chuẩn áp dụng cho CHÍNH thiết bị/hãng của ca đó.
  const similarCasesRaw = DGA.findSimilarCases(measurement, gases, all);
  const similarCases = {
    ...similarCasesRaw,
    cases: similarCasesRaw.cases.map(({ record, similarity }) => ({
      record,
      similarity,
      evaluation: evaluateHistoricalCase(record),
    })),
  };

  // 5) Khuyến cáo tổng hợp
  const recs = DGA.buildRecommendations({ overallOk: overall === "Đạt", exceedCount, diagnosis, duval, rateRows, condemningRows, additionalRatios, bang63, equipmentType: measurement.equipment_type, bushingCodes });

  // 5bis) Trạng thái tổng thể (Bình thường/Cảnh báo/Báo động) — số hóa lưu đồ Hình 1
  //    IEC 60599:2022; xem giải thích đầy đủ ở tab "Quy trình đánh giá".
  const overallStatus = DGA.computeOverallStatus({
    overallOk: overall === "Đạt", exceedCount, diagnosis, priorDiagnosis, rateRows, condemningRows,
  });

  _lastAnalysis = { measurement, tcg, evalRows, overall, diagnosis, bushingCodes, standard, ratios, applicability, duval, rateRows, tcgRate, prior, recs, condemningRows, overallStatus, additionalRatios, bang63, peerAnomaly, similarCases };
  renderResults({ tcg, evalRows, overall, diagnosis, bushingCodes, standard, ratios, applicability, duval, rateRows, tcgRate, prior, recs, condemningRows, overallStatus, additionalRatios, bang63, peerAnomaly, similarCases });

  // 6) Lưu vào lịch sử — mọi user đã đăng nhập đều lưu được (xem canSaveEntry()); khi
  //    đang SỬA 1 bản ghi có sẵn (_editingMeasurementId), server chỉ chấp nhận nếu là
  //    Admin hoặc đúng người đã nhập bản ghi đó (prepareOwnedRecord() ở Code.gs) — lỗi
  //    nếu có sẽ hiện nguyên văn ở khối catch bên dưới.
  if (!canSaveEntry()) return;
  const wasEditing = !!_editingMeasurementId;

  // 6bis) Biên bản thí nghiệm (BBTN, PDF) đính kèm — xem storage.js/uploadAttachment().
  // measurement.id phải cố định TRƯỚC khi tải file lên (đặc biệt ở chế độ localStorage,
  // nơi file được khóa theo measurementId) nên sinh id ở đây nếu là bản ghi MỚI, thay vì
  // để Storage.addMeasurement() tự sinh như trước.
  measurement.id = measurement.id || Storage.newId();
  const bbtnFile = $("f_bbtn").files[0] || null;
  if (bbtnFile) {
    const originalLabel = $("btnAnalyze").textContent;
    $("btnAnalyze").disabled = true;
    $("btnAnalyze").textContent = "Đang tải lên Biên bản...";
    try {
      const uploaded = await Storage.uploadAttachment(measurement.id, bbtnFile);
      Object.assign(measurement, uploaded);
    } catch (err) {
      notifyError(
        "Tải lên Biên bản thí nghiệm (PDF) thất bại: " + ((err && err.message) || err) +
        "\n\nLần đo vẫn sẽ được lưu, nhưng KHÔNG kèm file — bấm \"Sửa\" ở Lịch sử đo để đính kèm lại sau."
      );
    } finally {
      $("btnAnalyze").disabled = false;
      $("btnAnalyze").textContent = originalLabel;
    }
  } else if (wasEditing && _removeBbtnOnSave) {
    Object.assign(measurement, { bbtn_url: null, bbtn_name: null, bbtn_file_id: null });
  } else if (wasEditing && _editingMeasurementAttachment) {
    Object.assign(measurement, _editingMeasurementAttachment);
  }

  try {
    await Storage.addMeasurement(measurement);
    await registerStationIfNew(measurement.tram);
    resetMeasurementEditState();
    await refreshHistoryUI();
    // Form KHÔNG bị xóa Trạm/Thiết bị/Pha sau khi lưu (xem resetMeasurementEditState())
    // để nhập nhanh lần đo kế tiếp của cùng thiết bị — cập nhật lại gợi ý "Lần đo" cho
    // đúng với bản ghi vừa lưu (_allMeasurements đã có sẵn qua refreshHistoryUI() ở trên).
    updateLanDoSuggestion();
    if (wasEditing) showToast("Đã cập nhật lần đo.");
  } catch (err) {
    notifyError("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + storageErrorMessage(err));
  }
}

function storageErrorMessage(err) {
  const base = (err && err.message) || String(err);
  if (Storage.mode === "gsheet") {
    return "Lỗi kết nối Google Sheets: " + base +
      "\n\nKiểm tra: URL trong config.js đúng chưa, Apps Script đã Deploy > New deployment với " +
      "\"Who has access: Anyone\" chưa, và Google Sheet chưa bị xóa/đổi quyền.";
  }
  if (Storage.mode === "supabase") {
    return "Lỗi kết nối Supabase: " + base;
  }
  return "Lỗi lưu dữ liệu: " + base;
}

function verdictPill(v) {
  if (v === "Đạt") return `<span class="pill ok">Đạt</span>`;
  if (v === "Không có ngưỡng") return `<span class="pill muted">Không có ngưỡng</span>`;
  return `<span class="pill bad">Không đạt</span>`;
}

/** Tính lại (KHÔNG đọc từ dữ liệu lưu sẵn nào) kết luận Đạt/Không đạt + mã chẩn đoán
 *  của 1 BẢN GHI LỊCH SỬ — dùng cho khối "Ca tương tự trong lịch sử đo" (đề xuất #3) VÀ
 *  đúng kỹ thuật đã dùng cho `prior` (lần đo liền trước) ở onAnalyzeAndSave() phía trên:
 *  resolveStandard() theo ĐÚNG loại thiết bị/hãng/mba_subtype LƯU TRÊN CHÍNH bản ghi đó
 *  (không phải theo form đang nhập) rồi evaluateAbsolute()/overallVerdict()/
 *  diagnoseGasFault() như bình thường. Tính lại tại chỗ thay vì lưu sẵn 1 "kết luận"
 *  tĩnh vào bản ghi — kết luận luôn khớp đúng logic đánh giá hiện hành (kể cả khi sau
 *  này tiêu chuẩn/logic được cập nhật), không sợ đọc phải kết luận đã lỗi thời. */
function evaluateHistoricalCase(record) {
  const gases = recordGases(record);
  const logicMeasurement = {
    equipmentType: record.equipment_type,
    manufacturer: record.manufacturer,
    mbaSubtype: record.mba_subtype || null,
  };
  const standard = DGA.resolveStandard(logicMeasurement, toManufacturerStandardsForLogic(_allStandards));
  const tcg = DGA.computeTCG(gases);
  const evalRows = DGA.evaluateAbsolute(gases, standard.limits);
  const overall = DGA.overallVerdict(evalRows);
  const diagnosis = DGA.diagnoseGasFault(gases, record.equipment_type, standard.pdThreshold);
  return { gases, tcg, overall, diagnosis };
}

function renderResults({ tcg, evalRows, overall, diagnosis, standard, ratios, applicability, duval, rateRows, tcgRate, prior, recs, condemningRows, overallStatus, additionalRatios, bang63, peerAnomaly, similarCases }) {
  $("resultsPanel").classList.remove("hidden");

  if (overallStatus) {
    const STATUS_ICON = { normal: "check-circle", alert: "alert-triangle", alarm: "alert-octagon" };
    $("overallStatusBanner").className = "status-banner status-" + overallStatus.level;
    $("statusBadgeText").innerHTML =
      `<svg class="status-icon" aria-hidden="true"><use href="#icon-${STATUS_ICON[overallStatus.level] || "check-circle"}"></use></svg>` +
      escapeHtml(overallStatus.label);
    $("statusReasonsList").innerHTML = overallStatus.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    $("statusActionText").textContent = overallStatus.action;
    // Nút "Xuất báo cáo phân tích kỹ thuật" chỉ dành cho thiết bị CÓ BẤT THƯỜNG (mức
    // Cảnh báo/Báo động) — theo đúng yêu cầu tính năng ("đối với thiết bị có bất
    // thường"), tránh lạm dụng cho mọi lần đo Bình thường không cần báo cáo riêng.
    $("btnExportTechReport").classList.toggle("hidden", overallStatus.level === "normal");
  }

  $("r_tcg").textContent = tcg.toFixed(1) + " ppm";
  // Tốc độ sinh khí TCG (%/tháng, xem computeTcgRateOfChange() ở dga-logic.js) — chỉ
  // hiện khi có lần đo trước để so sánh (tcgRate != null) VÀ TCG lần trước > 0 (nếu
  // không, ratePerMonth = null vì chia cho 0, xem cùng lưu ý ở rateRows). Không có
  // khoảng tham chiếu Bảng 65 riêng cho TCG nên chỉ hiện số liệu để tham khảo, không
  // gắn "Đạt/Không đạt" — cùng số liệu được điền vào BBTN khi xuất (tag {tcg_toc}).
  const tcgRateNote = $("r_tcgRateNote");
  if (tcgRateNote) {
    if (tcgRate && tcgRate.ratePerMonth !== null) {
      const sign = tcgRate.ratePerMonth > 0 ? "+" : "";
      tcgRateNote.textContent = `${sign}${tcgRate.ratePerMonth}%/tháng so với lần đo trước`;
      tcgRateNote.classList.remove("hidden");
    } else {
      tcgRateNote.textContent = "";
      tcgRateNote.classList.add("hidden");
    }
  }
  $("r_overall").innerHTML = overall === "Đạt" ? `<span class="pill ok">Đạt</span>` : `<span class="pill bad">Không đạt</span>`;
  $("r_diag").textContent = diagnosis;
  $("r_duval").textContent = duval ? duval.zone : "—";
  $("r_standard").textContent = standard.sourceLabel;

  const condemnMap = {};
  (condemningRows || []).forEach((r) => (condemnMap[r.gas] = r));
  const condemnExceeded = DGA.condemningExceededRows(condemningRows);
  if (condemnExceeded.length > 0) {
    $("condemnBanner").classList.remove("hidden");
    $("condemnBanner").innerHTML =
      `⚠ CẢNH BÁO NGHIÊM TRỌNG — VƯỢT NGƯỠNG LOẠI BỎ (do nhà sản xuất quy định) ở ${condemnExceeded.length} khí: ` +
      condemnExceeded.map((r) => `${r.gas} (${r.value} &gt; ${r.limit} ppm)`).join(", ") +
      `. Đây là mức nghiêm trọng hơn "Không đạt" thông thường — khuyến cáo báo cáo ngay cấp có thẩm quyền.`;
  } else {
    $("condemnBanner").classList.add("hidden");
  }

  $("r_gasTable").innerHTML = evalRows.map((r) => {
    const c = condemnMap[r.gas];
    const condemnCell = !c ? "—" : c.exceeded ? `<strong style="color:var(--bad);">${c.limit} ⚠</strong>` : c.limit;
    return `<tr><td>${gasLabelIcon(r.gas)}${r.gas}</td><td>${r.value}</td><td>${r.limit ?? "—"}</td><td>${condemnCell}</td><td>${verdictPill(r.verdict)}</td></tr>`;
  }).join("");

  $("r_ratio1").textContent = ratios.c2h2_c2h4.toFixed(3);
  $("r_ratio2").textContent = ratios.ch4_h2.toFixed(3);
  $("r_ratio3").textContent = ratios.c2h4_c2h6.toFixed(3);
  $("r_pdthreshold").textContent = "< " + standard.pdThreshold;
  $("r_applicability").textContent = applicability;

  // "Đánh giá các tỷ lệ bổ sung" (Điều 54 QĐ1901) — chỉ mang tính tham khảo, không tra
  // mã PD/D1/D2/T1/T2/T3 (khác Ba tỷ số khí cơ bản ở trên) — xem diagnoseAdditionalRatios().
  if (additionalRatios) {
    $("r_co2co").textContent = additionalRatios.co2_co === null ? "—" : additionalRatios.co2_co;
    $("r_co2conote").textContent = additionalRatios.co2coNote;
    $("r_o2n2").textContent = additionalRatios.o2_n2 === null ? "—" : additionalRatios.o2_n2;
    $("r_o2n2note").textContent = additionalRatios.o2n2Note;
  }

  // Tổng hàm lượng khí hòa tan (Bảng 63) — xem computeTotalDissolvedGasPercent()/
  // evaluateBang63() ở dga-logic.js. Chỉ ra verdict Đạt/Không đạt khi bang63.applicable
  // (đã tick điều kiện áp dụng); còn lại chỉ hiển thị số liệu tham khảo, không tự kết luận.
  if (bang63) {
    $("r_bang63value").textContent = bang63.value === null || bang63.value === undefined ? "—" : bang63.value.toFixed(3) + "%";
    $("r_bang63limit").textContent = bang63.limit === null ? "—" : "< " + bang63.limit + "%";
    if (bang63.value === null || bang63.value === undefined) {
      $("r_bang63verdict").innerHTML = `<span class="pill muted">Chưa đủ dữ liệu — cần nhập N2, O2</span>`;
    } else if (!bang63.applicable) {
      $("r_bang63verdict").innerHTML = `<span class="pill muted">Tham khảo — chưa tick điều kiện áp dụng Bảng 63</span>`;
    } else {
      $("r_bang63verdict").innerHTML = verdictPill(bang63.verdict);
    }
  }

  if (duval) {
    $("r_pctch4").textContent = duval.pctCH4.toFixed(1) + "%";
    $("r_pctc2h4").textContent = duval.pctC2H4.toFixed(1) + "%";
    $("r_pctc2h2").textContent = duval.pctC2H2.toFixed(1) + "%";
    $("r_duvalzone").innerHTML = `<strong>${duval.zone}</strong> — ${duval.label}`;
    drawDuvalTriangleBase();
    drawDuvalPoint(duval.xy);
  } else {
    $("r_pctch4").textContent = $("r_pctc2h4").textContent = $("r_pctc2h2").textContent = "—";
    $("r_duvalzone").textContent = "Không đủ dữ liệu (cần CH4/C2H4/C2H2 > 0)";
    drawDuvalTriangleBase();
  }

  if (rateRows) {
    $("rateSection").classList.remove("hidden");
    $("rateNote").textContent = `So với lần đo trước (${DGA.formatSampleDate(prior.sample_date)}) — ` +
      (rateRows[0].officialForEquipment
        ? "Bảng 65 áp dụng CHÍNH THỨC cho MBA/Kháng dầu."
        : "Bảng 65 chỉ QĐ1901 quy định chính thức cho MBA — với loại thiết bị này chỉ dùng để THAM KHẢO.");
    $("r_rateTable").innerHTML = rateRows.map((r) => `
      <tr>
        <td>${gasLabelIcon(r.gas)}${r.gas}</td><td>${r.before}</td><td>${r.after}</td><td>${r.delta}</td>
        <td>${r.ratePerYear}</td><td>${r.rangeLo} – ${r.rangeHi}</td>
        <td>${r.verdict.startsWith("⚠") ? `<span class="pill warn">${r.verdict}</span>` : r.verdict}</td>
      </tr>
    `).join("");
  } else {
    $("rateSection").classList.add("hidden");
  }

  renderPeerAnomaly(peerAnomaly);
  renderSimilarCases(similarCases);

  $("r_recs").innerHTML = recs.map((r) => `<li>${r}</li>`).join("");
  if (typeof $("resultsPanel").scrollIntoView === "function") {
    $("resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/** Hiện khối "So sánh với nhóm thiết bị tương tự" (đề xuất #2, DGA.evaluatePeerAnomaly()
 *  ở logic/dga-logic-peer.js) — LUÔN gắn nhãn rõ đây là THAM KHẢO THỐNG KÊ, KHÔNG phải
 *  ngưỡng quy định QĐ1901/IEC, để không bị hiểu nhầm là 1 tiêu chí Đạt/Không đạt chính
 *  thức như các bảng ở trên. peerAnomaly có thể undefined nếu không tính được (VD lần
 *  đo chưa xác định Loại thiết bị). */
function renderPeerAnomaly(peerAnomaly) {
  const section = $("peerAnomalySection");
  if (!section) return;
  if (!peerAnomaly) {
    section.classList.add("hidden");
    return;
  }
  section.classList.remove("hidden");
  $("peerAnomalyIntro").textContent =
    "Đối chiếu lần đo này với các lần đo KHÁC (cùng thiết bị hoặc thiết bị khác) trong nhóm thiết bị " +
    "tương tự đã có trong Lịch sử đo — chỉ mang tính CẢNH BÁO SỚM tham khảo (thiết bị đang \"lệch khỏi số " +
    "đông\" dù chưa vượt ngưỡng), KHÔNG thay thế đánh giá theo Bảng 64/66/Annex A ở trên.";

  const peerLevelPill = (level) => {
    if (level === "alert") return `<span class="pill bad">Lệch rõ rệt</span>`;
    if (level === "warn") return `<span class="pill warn">Hơi lệch</span>`;
    return `<span class="pill ok">Bình thường</span>`;
  };

  if (!peerAnomaly.sufficient) {
    $("peerAnomalyInsufficient").style.display = "";
    $("peerAnomalyInsufficient").textContent = peerAnomaly.groupLabel
      ? `Chưa đủ dữ liệu để so sánh — nhóm "${peerAnomaly.groupLabel}" hiện chỉ có ${peerAnomaly.groupSize} lần đo khác ` +
        `trong Lịch sử đo (cần tối thiểu ${peerAnomaly.minSamples}). Sẽ tự tính lại khi có thêm dữ liệu.`
      : `Chưa đủ dữ liệu để so sánh — lần đo này chưa xác định được Loại thiết bị hoặc Lịch sử đo chưa có lần đo nào khác.`;
    $("peerAnomalyContent").classList.add("hidden");
    return;
  }
  $("peerAnomalyInsufficient").style.display = "none";
  $("peerAnomalyContent").classList.remove("hidden");

  $("r_peerZTable").innerHTML = peerAnomaly.gasRows.map((r) => `
    <tr>
      <td>${gasLabelIcon(r.gas)}${r.gas}</td>
      <td>${r.value}</td>
      <td>${r.peerMean.toFixed(2)}</td>
      <td>${r.z >= 0 ? "+" : ""}${r.z.toFixed(2)}</td>
      <td>${peerLevelPill(r.level)}</td>
    </tr>
  `).join("");

  const groupNote = `Nhóm so sánh: ${escapeHtml(peerAnomaly.groupLabel)} — ${peerAnomaly.groupSize} lần đo khác.`;
  if (peerAnomaly.isolationScore === null) {
    $("r_peerIsolation").innerHTML = `${groupNote} Không đủ dữ liệu để tính Isolation Forest.`;
  } else {
    $("r_peerIsolation").innerHTML =
      `${groupNote} Điểm: <strong>${peerAnomaly.isolationScore.toFixed(2)}</strong> (thang 0–1, càng gần 1 càng bất ` +
      `thường so với nhóm) — ${peerLevelPill(peerAnomaly.isolationLevel)}`;
  }
  if (peerAnomaly.flaggedGases.length) {
    $("r_peerIsolation").innerHTML += `<br>Khí lệch khỏi số đông theo z-score: ${peerAnomaly.flaggedGases.map((g) => escapeHtml(g)).join(", ")}.`;
  }
}

/** Hiện khối "Ca tương tự trong lịch sử đo" (đề xuất #3, DGA.findSimilarCases() ở
 *  logic/dga-logic-case.js + evaluateHistoricalCase() ở trên) — LUÔN gắn nhãn rõ đây
 *  là THAM KHẢO (kết luận hiện ra là của CHÍNH lần đo lịch sử đó, KHÔNG áp dụng cho lần
 *  đo đang phân tích). similarCases có thể undefined nếu không tính được. */
function renderSimilarCases(similarCases) {
  const section = $("caseSection");
  if (!section) return;
  if (!similarCases) {
    section.classList.add("hidden");
    return;
  }
  section.classList.remove("hidden");
  $("caseIntro").textContent =
    "Tìm trong TOÀN BỘ Lịch sử đo (không giới hạn cùng loại/hãng thiết bị như khối \"So sánh với nhóm thiết bị " +
    "tương tự\" ở trên) những lần đo có tỷ lệ 7 khí hòa tan GẦN GIỐNG NHẤT với lần đo này (cosine similarity) " +
    "— hiện lại kết luận CỦA CHÍNH lần đo lịch sử đó để tham khảo hỗ trợ ra quyết định, KHÔNG phải kết luận " +
    "áp dụng cho lần đo đang phân tích.";

  if (similarCases.insufficient || !similarCases.cases.length) {
    $("caseInsufficient").style.display = "";
    $("caseInsufficient").textContent =
      similarCases.insufficient && similarCases.reason === "empty-target"
        ? "Lần đo này chưa có số liệu khí nào để tìm ca tương tự."
        : "Chưa tìm thấy lần đo nào trong Lịch sử đo đủ giống lần đo này (tỷ lệ các khí khác biệt quá nhiều, hoặc Lịch sử đo còn ít dữ liệu).";
    $("caseCards").innerHTML = "";
    return;
  }
  $("caseInsufficient").style.display = "none";

  $("caseCards").innerHTML = similarCases.cases.map(({ record, similarity, evaluation }) => {
    const gasCells = DGA.GASES.map((g) => {
      const v = evaluation.gases[g];
      return `<span style="margin-right:12px; white-space:nowrap;">${gasLabelIcon(g)}${g}: <strong>${v ?? 0}</strong></span>`;
    }).join("");
    const phaText = record.pha ? " (pha " + escapeHtml(DGA.phaLabel(record.pha)) + ")" : "";
    return `
      <div class="stat-card" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px;">
          <div style="font-weight:700;">${escapeHtml(record.tram || "—")} — ${escapeHtml(record.thiet_bi || "—")}${phaText}</div>
          <div style="font-size:13px; color:var(--gray-600);">Độ giống: <strong>${(similarity * 100).toFixed(0)}%</strong> · ${escapeHtml(DGA.formatSampleDate(record.sample_date) || "—")}</div>
        </div>
        <div style="margin-top:4px; font-size:13px; color:var(--gray-600);">
          ${escapeHtml(record.equipment_type || "—")}${record.manufacturer ? " — hãng " + escapeHtml(record.manufacturer) : ""}
        </div>
        <div style="margin-top:8px; font-size:13px; line-height:1.9;">${gasCells}</div>
        <div style="margin-top:8px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; font-size:13px;">
          <span>TCG: <strong>${evaluation.tcg.toFixed(1)} ppm</strong></span>
          <span>Kết luận (tính lại theo tiêu chuẩn của chính ca này): ${verdictPill(evaluation.overall)}</span>
          <span>Mã chẩn đoán: <strong>${escapeHtml(evaluation.diagnosis)}</strong></span>
        </div>
        ${record.ghi_chu ? `<p class="note" style="margin-top:6px; margin-bottom:0;">Ghi chú đã nhập lúc đó: "${escapeHtml(record.ghi_chu)}"</p>` : ""}
      </div>
    `;
  }).join("");
}

// ---------------------------------------------------------------------
// Xuất Biên bản thí nghiệm (BBTN, .docx) đã điền sẵn số liệu — xem bbtn-export.js.
// Nút "Xuất BBTN (docx)" chỉ hiện trong #resultsPanel (đã ẩn cho tới khi phân tích lần
// đầu) nên về lý thuyết _lastAnalysis luôn có giá trị khi hàm này chạy được — vẫn kiểm
// tra lại cho chắc (phòng trường hợp DOM bị thao tác khác thường/lỗi khác).
// ---------------------------------------------------------------------
async function onExportBbtn() {
  if (!_lastAnalysis) {
    notifyError('Vui lòng bấm "Phân tích & Lưu" trước khi xuất Biên bản thí nghiệm.');
    return;
  }
  const btn = $("btnExportBbtn");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Đang tạo file...";
  try {
    await BbtnExport.exportBbtnDocx(_lastAnalysis);
  } catch (err) {
    notifyError("Xuất BBTN (docx) thất bại: " + ((err && err.message) || err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ---------------------------------------------------------------------
// Xuất Báo cáo phân tích kỹ thuật (docx) — cho thiết bị CÓ BẤT THƯỜNG, xem
// tech-report-export.js. Nút chỉ hiện khi overallStatus.level !== "normal" (xem
// renderResults() ở trên) nên _lastAnalysis luôn có giá trị khi hàm này chạy được —
// vẫn kiểm tra lại cho chắc, cùng cách làm với onExportBbtn().
// ---------------------------------------------------------------------
async function onExportTechReport() {
  if (!_lastAnalysis) {
    notifyError('Vui lòng bấm "Phân tích & Lưu" trước khi xuất Báo cáo phân tích kỹ thuật.');
    return;
  }
  const btn = $("btnExportTechReport");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Đang tạo file...";
  try {
    await TechReportExport.exportTechReportDocx(_lastAnalysis);
  } catch (err) {
    notifyError("Xuất báo cáo phân tích kỹ thuật (docx) thất bại: " + ((err && err.message) || err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}
