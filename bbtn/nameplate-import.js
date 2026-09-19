// nameplate-import.js — Đọc ẢNH CHỤP/SCAN TẤM NHÃN THIẾT BỊ (nameplate gắn trên vỏ máy,
// khác với BIÊN BẢN THÍ NGHIỆM PDF mà bbtn-import.js đọc) bằng OCR ngay trong trình
// duyệt, gợi ý điền vào khối "Thông số kỹ thuật thiết bị" (Kiểu máy/Năm sản xuất/Điện áp
// định mức/Số chế tạo/Loại dầu cách điện) và "Nhà sản xuất" ở form "1. Thông tin lần đo"
// — đỡ phải gõ tay lại khi đã có sẵn ảnh chụp nhãn máy ngoài hiện trường.
//
// KHÁC bbtn-import.js (đọc đúng 1 MẪU BIÊN BẢN CỐ ĐỊNH PTC3/BM.15, có thể dò theo nhãn
// tiếng Việt chính xác): tấm nhãn thiết bị KHÔNG có mẫu chung — mỗi hãng sản xuất
// (Haefely, ABB, Siemens, CG, Trench...) trình bày khác nhau, phần lớn bằng tiếng Anh
// theo quy ước IEC, và nhiều nhãn cũ/mờ/gỉ sét ngoài hiện trường khó đọc hơn hẳn 1 biên
// bản in rõ ràng. Vì vậy đây LUÔN LÀ GỢI Ý TỐT NHẤT CÓ THỂ (best-effort), độ tin cậy
// THẤP HƠN cả nhánh OCR của bbtn-import.js — chỉ dò theo các NHÃN THƯỜNG GẶP trên
// nameplate quốc tế, KHÔNG suy diễn khi không thấy nhãn, và bắt buộc người dùng xem lại
// toàn bộ trước khi lưu, không có trường nào bị khóa.
//
// 3 trường "Năm đưa vào vận hành", "Kết cấu cách điện dầu", "Hiện trạng vận hành" (nằm
// cùng khối "Thông số kỹ thuật thiết bị" ở index.html) KHÔNG được trích ở đây vì đó là
// THÔNG TIN VẬN HÀNH của đơn vị quản lý — không phải thông tin xuất xưởng in sẵn trên
// nhãn nhà sản xuất, luôn phải nhập tay.
//
// Chạy 100% phía client, dùng LẠI ĐÚNG Tesseract.js đã vendor sẵn cho bbtn-import.js
// (xem file đó để biết vì sao chọn Tesseract.js, vì sao vendor local thay vì CDN, và quy
// ước OEM.LSTM_ONLY/PSM.AUTO) — không tải thêm gì mới, không phụ thuộc CDN ngoài, không
// gửi ảnh lên bất kỳ server/API OCR nào.
import * as pdfjsLib from "../vendor/pdfjs/pdf.min.js";
import Tesseract from "../vendor/tesseract/tesseract.esm.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.js", import.meta.url).href;

const { createWorker, OEM, PSM } = Tesseract;

const TESS_WORKER_PATH = new URL("../vendor/tesseract/worker.min.js", import.meta.url).href;
const TESS_CORE_PATH = new URL("../vendor/tesseract/tesseract-core-lstm.wasm.js", import.meta.url).href;
const TESS_LANG_PATH = new URL("../vendor/tesseract/lang-data", import.meta.url).href;
// Chỉ dùng khi người dùng lỡ lưu ảnh chụp nhãn thành PDF (hiếm — thường là JPG/PNG chụp
// thẳng từ điện thoại, đưa vào worker.recognize() được luôn, không cần dựng trang).
const OCR_RENDER_SCALE = 3;

function isPdfFile(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}

async function pdfFileToImages(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const canvases = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

async function fileToOcrText(file, onProgress) {
  const worker = await createWorker("vie+eng", OEM.LSTM_ONLY, {
    workerPath: TESS_WORKER_PATH,
    corePath: TESS_CORE_PATH,
    langPath: TESS_LANG_PATH,
    gzip: true,
    logger: (m) => {
      if (typeof onProgress === "function") onProgress(m);
    },
  });
  // QUAN TRỌNG: xem giải thích đầy đủ ở pdfFileToLinesViaOCR() trong bbtn-import.js —
  // phải ép lại PSM.AUTO tường minh, nếu không engine không cư xử đúng mặc định thật.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  try {
    const images = isPdfFile(file) ? await pdfFileToImages(file) : [file];
    let text = "";
    for (const img of images) {
      const { data } = await worker.recognize(img);
      text += (data.text || "") + "\n";
    }
    return text;
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Bỏ dấu tiếng Việt (giữ nguyên độ dài chuỗi) — dùng để dò thêm biến thể nhãn tiếng Việt
// dù OCR đọc sai/mất dấu. Xem giải thích đầy đủ ở bbtn-import.js (cùng cơ chế).
// ---------------------------------------------------------------------------
const VN_DIACRITICS_RE =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/gi;
const VN_DIACRITICS_MAP = {
  a: "àáảãạăằắẳẵặâầấẩẫậ", e: "èéẻẽẹêềếểễệ", i: "ìíỉĩị", o: "òóỏõọôồốổỗộơờớởỡợ",
  u: "ùúủũụưừứửữự", y: "ỳýỷỹỵ", d: "đ",
};
const VN_DIACRITICS_REVERSE = {};
for (const [base, accented] of Object.entries(VN_DIACRITICS_MAP)) {
  for (const ch of accented) {
    VN_DIACRITICS_REVERSE[ch] = base;
    VN_DIACRITICS_REVERSE[ch.toUpperCase()] = base.toUpperCase();
  }
}
function stripVnDiacritics(s) {
  return s.replace(VN_DIACRITICS_RE, (c) => VN_DIACRITICS_REVERSE[c] || c);
}

// ---------------------------------------------------------------------------
// Trích trường best-effort — KHÔNG có mẫu cố định nên chỉ dò theo NHÃN THƯỜNG GẶP trên
// nameplate quốc tế (đa số tiếng Anh theo IEC) + biến thể tiếng Việt (khớp trên bản đã
// bỏ dấu, xem "combined" bên dưới). Nhãn nào không thấy trên ảnh thì để trống — KHÔNG
// suy diễn/đoán bừa khi thiếu căn cứ.
// ---------------------------------------------------------------------------
function firstMatch(combined, patterns) {
  for (const re of patterns) {
    const m = combined.match(re);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  return null;
}

function guessKieuMay(combined) {
  return firstMatch(combined, [
    /\b(?:Type|Model|Kieu(?: may)?)\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9 .\/-]{1,24})/i,
  ]);
}

function guessSoCheTao(combined) {
  return firstMatch(combined, [
    /\b(?:Serial\s*No\.?|Serial\s*Number|Ser\.?\s*No\.?|Works\s*No\.?|Fabrication\s*No\.?|So che tao|So se ri)\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9\/\-]{2,24})/i,
  ]);
}

function guessNamSx(combined) {
  const val = firstMatch(combined, [
    /\b(?:Year\s*of\s*Manufacture|Manufacturing\s*Year|Year\s*Mfg\.?|Mfg\.?\s*Year|Date\s*of\s*Manufacture|Nam san xuat|Ngay san xuat)\s*[:.\-]?\s*(\d{4})/i,
  ]);
  if (!val) return null;
  const year = parseInt(val, 10);
  const now = new Date().getFullYear();
  return year >= 1950 && year <= now + 1 ? String(year) : null;
}

function guessDienApDm(combined) {
  const labeled = firstMatch(combined, [
    /\b(?:Rated\s*(?:primary\s*)?[Vv]oltage|Um|Un|Dien ap dinh muc)\s*[:.\-]?\s*([\d.,]+\s*kV)/i,
  ]);
  if (labeled) return labeled;
  // Không thấy nhãn rõ ràng: lấy trị số đứng trước "kV" ĐẦU TIÊN xuất hiện trên toàn ảnh
  // — rủi ro nhầm với trị số kV khác trên nhãn (VD điện áp cách điện), nhưng vẫn là gợi
  // ý hữu ích hơn để trống hoàn toàn; người dùng luôn xem lại trước khi lưu.
  const m = combined.match(/\b(\d{1,4}(?:[.,]\d+)?)\s*kV\b/i);
  return m ? `${m[1]} kV` : null;
}

function guessLoaiDau(combined) {
  if (/mineral\s*oil|dau khoang/i.test(combined)) return "Dầu khoáng";
  if (/silicone\s*(?:oil|fluid)/i.test(combined)) return "Dầu Silicone";
  if (/ester(?:\s*oil)?|vegetable\s*oil|dau (?:ester|thuc vat)/i.test(combined)) return "Dầu ester (tổng hợp/thực vật)";
  return null;
}

// ---------------------------------------------------------------------------
// Hàm chính — trả về { kieuMay, soCheTao, namSx, dienApDm, loaiDau, rawText }. rawText
// LUÔN trả kèm (kể cả khi không trích được trường nào) để giao diện hiện toàn bộ chữ đã
// đọc được, cho người dùng tự đối chiếu/copy tay phần OCR đọc sai hoặc dò theo mẫu nhãn
// hãng không nằm trong danh sách nhãn thường gặp ở trên — xem onNameplateFileSelected()
// ở ui/ui-dga.js. onProgress (tuỳ chọn) nhận các sự kiện tiến trình OCR dạng { status,
// progress } (progress từ 0 đến 1) để hiển thị "Đang nhận diện chữ...".
// ---------------------------------------------------------------------------
async function extract(file, onProgress) {
  const rawText = await fileToOcrText(file, onProgress);
  const combined = rawText + "\n" + stripVnDiacritics(rawText);
  return {
    kieuMay: guessKieuMay(combined),
    soCheTao: guessSoCheTao(combined),
    namSx: guessNamSx(combined),
    dienApDm: guessDienApDm(combined),
    loaiDau: guessLoaiDau(combined),
    rawText: rawText.trim(),
  };
}

window.NameplateImport = { extract };
window.dispatchEvent(new Event("nameplateimport:ready"));
