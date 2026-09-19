// bbtn-import.js — Đọc file PDF "Biên bản thí nghiệm" (BBTN) mẫu PTC3/BM.15 (phân
// tích khí hòa tan trong dầu cách điện) ngay trong trình duyệt và tự động nhận diện
// Trạm / Thiết bị / Loại thiết bị / Pha / Ngày lấy mẫu / Nhà sản xuất / Số chế tạo /
// Điện áp định mức / Năm sản xuất / Năm đưa vào vận hành / Loại dầu cách điện / Ngày
// thí nghiệm / Lý do thí nghiệm / Điều kiện môi trường (nhiệt độ, độ ẩm) / hàm lượng
// 7 khí, để điền sẵn vào form "1. Thông tin lần đo" (kể cả khối "Thông số kỹ thuật
// thiết bị" dùng cho xuất báo cáo phân tích kỹ thuật, và khối "Thông tin thí nghiệm
// bổ sung" dùng khi xuất BBTN) khi người dùng đính kèm BBTN của một lần đo LỊCH SỬ
// (đỡ phải gõ tay lại số liệu đã có sẵn trong biên bản giấy/PDF).
//
// Chạy 100% phía client (không gửi file lên server nào để "đọc" nội dung — file vẫn
// chỉ được tải lên nơi lưu trữ đính kèm như bình thường qua Storage.uploadAttachment
// khi người dùng bấm "Phân tích & Lưu", xem app.js). Dùng thư viện pdf.js (Mozilla,
// Apache-2.0) được đóng gói sẵn trong vendor/pdfjs/ — không phụ thuộc CDN ngoài, nên
// vẫn hoạt động cả khi máy/mạng của người dùng chặn CDN hoặc chạy offline (chế độ lưu
// cục bộ localStorage).
//
// Đây là suy đoán "tốt nhất có thể" (best-effort) dựa trên cấu trúc mẫu biên bản
// PTC3/BM.15 hiện tại — nếu biên bản dùng mẫu khác/khác định dạng, có thể chỉ nhận
// được một phần hoặc không nhận được trường nào; người dùng luôn xem lại và có thể
// sửa tay mọi trường trước khi lưu, KHÔNG có trường nào bị khóa bởi việc tự động điền.
// LƯU Ý: dùng đuôi ".js" (không phải ".mjs") cho 2 file thư viện dưới đây — dù nội
// dung vẫn y hệt bản ES module gốc của pdf.js. Một số server/host tĩnh (kể cả một số
// server chạy trên Windows) không có sẵn ánh xạ MIME type cho đuôi ".mjs" và trả về
// "text/plain" thay vì JavaScript — trình duyệt áp dụng "strict MIME type checking"
// cho <script type="module"> nên sẽ CHẶN, không chạy file, và lỗi này chỉ hiện trong
// Console (F12) chứ không có thông báo gì trên giao diện. Đuôi ".js" thì hầu như mọi
// server đều tự nhận đúng loại JavaScript nên không gặp lỗi này.
import * as pdfjsLib from "../vendor/pdfjs/pdf.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.js", import.meta.url).href;

// OCR (nhận diện chữ từ ảnh) cho trường hợp BBTN là ảnh scan/chụp — không có lớp text
// nào để pdf.js đọc trực tiếp (pdfFileToLines() ở dưới trả về rỗng/gần rỗng). Dùng
// Tesseract.js (Apache-2.0, WASM, chạy 100% trong trình duyệt qua Web Worker riêng —
// KHÔNG gửi ảnh lên bất kỳ server/API OCR nào, giữ đúng nguyên tắc "100% phía client"
// nêu ở đầu file) được vendor sẵn trong vendor/tesseract/ (core LSTM-only + dữ liệu
// ngôn ngữ Việt/Anh bản "best_int" đã nén gzip, ~8MB tổng — không phụ thuộc CDN ngoài,
// giống hệt cách pdf.js đã được đóng gói sẵn ở trên) — hoạt động cả khi mạng của người
// dùng chặn CDN hoặc chạy offline. Đây là hướng đọc DỰ PHÒNG (chỉ chạy khi đọc trực
// tiếp thất bại) và kết quả kém tin cậy hơn đọc trực tiếp từ lớp text thật của PDF, nên
// mọi kết quả qua OCR đều được đánh dấu viaOCR=true để giao diện nhắc người dùng kiểm
// tra kỹ hơn — xem onBbtnFileSelected() ở ui/ui-dga.js.
// Bản ESM của Tesseract.js chỉ có 1 export mặc định (gói nguyên module.exports kiểu
// CommonJS gốc thành 1 object) — không có named export createWorker/OEM riêng.
import Tesseract from "../vendor/tesseract/tesseract.esm.min.js";
const { createWorker, OEM, PSM } = Tesseract;

const TESS_WORKER_PATH = new URL("../vendor/tesseract/worker.min.js", import.meta.url).href;
const TESS_CORE_PATH = new URL("../vendor/tesseract/tesseract-core-lstm.wasm.js", import.meta.url).href;
const TESS_LANG_PATH = new URL("../vendor/tesseract/lang-data", import.meta.url).href;
// Dưới ngưỡng này (ký tự), coi như pdf.js không đọc được lớp text thật (file toàn ảnh,
// hoặc chỉ có vài ký tự rác như số trang) — đủ thấp để không bỏ sót biên bản thật (BBTN
// PTC3/BM.15 điền đủ luôn có hàng nghìn ký tự), đủ cao để không kích hoạt OCR (chậm hơn
// đọc trực tiếp nhiều lần) một cách không cần thiết.
const MIN_TEXT_LEN_FOR_DIRECT_READ = 40;
// Độ phân giải dựng trang PDF thành ảnh trước khi đưa qua OCR — chữ trong biên bản scan
// thường nhỏ (bảng số liệu), cần phóng to hơn kích thước gốc (scale 1 ≈ 72 DPI) để
// Tesseract nhận diện chính xác hơn, đổi lại chậm hơn — chấp nhận được vì đây là đường
// dự phòng, không chạy cho mọi file.
const OCR_RENDER_SCALE = 3;

// ---------------------------------------------------------------------------
// 0) Dự phòng OCR: dựng từng trang PDF thành ảnh (canvas) rồi nhận diện chữ bằng
//    Tesseract.js, trả về danh sách "dòng" cùng định dạng với pdfFileToLines() để tái
//    sử dụng nguyên vẹn toàn bộ các hàm trích trường/khí ở dưới (chỉ khác nguồn chữ).
// ---------------------------------------------------------------------------
async function pdfFileToLinesViaOCR(file, onProgress) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const worker = await createWorker("vie+eng", OEM.LSTM_ONLY, {
    workerPath: TESS_WORKER_PATH,
    corePath: TESS_CORE_PATH,
    langPath: TESS_LANG_PATH,
    gzip: true,
    logger: (m) => {
      if (typeof onProgress === "function") onProgress(m);
    },
  });
  // QUAN TRỌNG: ép lại PSM.AUTO (phân đoạn trang tự động — vốn dĩ ĐÃ LÀ giá trị mặc
  // định theo tài liệu Tesseract) một cách TƯỜNG MINH ngay sau khi tạo worker. Đã kiểm
  // chứng thực tế: nếu KHÔNG gọi dòng này, engine cư xử khác với "mặc định" thật của nó
  // — với biên bản dạng bảng (nhiều ô kẻ khung dọc+ngang như khối thông tin chung ở đầu
  // BBTN), toàn bộ khối đó bị BỎ QUA hoàn toàn (không lỗi, không cảnh báo, chỉ đơn giản
  // là mất trắng đoạn văn bản đó) — trong khi ép lại đúng giá trị PSM.AUTO này thì đọc
  // đúng/đủ. Rất có thể là quirk/bug của tesseract.js — nhưng dòng này rẻ, an toàn, và
  // khắc phục triệt để nên cứ gọi tường minh thay vì trông chờ vào mặc định ngầm.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  try {
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      (data.text || "")
        .split("\n")
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .forEach((s) => lines.push(s));
    }
    return lines;
  } finally {
    await worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// 1) PDF -> danh sách "dòng" văn bản theo đúng thứ tự trình bày (trên->dưới,
//    trái->phải), gộp các mảnh text cùng một hàng dựa vào tọa độ y — mô phỏng lại
//    kiểu output của `pdftotext -layout`, vì pdf.js chỉ trả về từng mảnh text rời rạc
//    theo thứ tự vẽ trong file PDF (không đảm bảo đúng thứ tự đọc theo hàng/cột).
// ---------------------------------------------------------------------------
async function pdfFileToLines(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = [];
    for (const item of content.items) {
      const str = item.str;
      if (!str || !str.trim()) continue;
      const y = item.transform[5];
      const x = item.transform[4];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, str });
    }
    // Trục y của PDF tăng dần từ DƯỚI lên trên -> hàng đầu trang có y lớn nhất.
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      lines.push(row.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim());
    }
  }
  return lines.filter(Boolean);
}

// ---------------------------------------------------------------------------
// 2) Trích các trường thông tin chung (trạm, vị trí lắp đặt, pha, ngày, NSX...)
// ---------------------------------------------------------------------------
// Bỏ dấu tiếng Việt (không đổi độ dài chuỗi — thay TỪNG KÝ TỰ có dấu bằng đúng 1 ký tự
// không dấu, khác NFD decompose vốn TÁCH 1 ký tự có dấu thành 2 ký tự nên sẽ làm lệch
// vị trí match). Dùng để so khớp nhãn "chịu được" lỗi OCR (mất dấu, đọc nhầm dấu, hoặc
// — ít gặp hơn nhưng vẫn xảy ra thực tế — rụng mất 1 ký tự đầu nhãn do nét chữ dính vào
// đường kẻ khung bảng) MÀ VẪN CẮT ĐÚNG VỊ TRÍ trên dòng gốc (giữ nguyên dấu) để lấy value
// hiển thị cho người dùng xem lại — không hiển thị bản đã bỏ dấu ra form.
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

// labelRe/stopRe của MỌI hàm bên dưới đây từ nay viết bằng bản KHÔNG DẤU (VD "Ten du
// an" thay vì "Tên dự án") và luôn so khớp với BẢN ĐÃ BỎ DẤU của dòng/văn bản (foldedLine/
// foldedFullText) — vì OCR (Tesseract.js, xem pdfFileToLinesViaOCR ở trên) thường đọc sai
// hoặc mất hẳn dấu tiếng Việt (ví dụ "Hãng sản xuất" → "Hang sản xuất"/"ang sản xuất").
// Việc này AN TOÀN cho cả nhánh đọc trực tiếp (pdf.js, dấu chuẩn xác) vì bỏ dấu 1 chuỗi
// đã chuẩn rồi so khớp bản không dấu vẫn tìm đúng, chỉ RỘNG RÃI hơn — không có rủi ro
// nhận nhầm vì các nhãn này đủ đặc trưng ngay cả khi không dấu.
function extractLabelValue(lines, foldedLines, labelRe, stopRe) {
  for (let i = 0; i < lines.length; i++) {
    const m = foldedLines[i].match(labelRe);
    if (!m) continue;
    let rest = lines[i].slice(m.index + m[0].length).trim();
    if (stopRe) {
      const stopMatch = stripVnDiacritics(rest).match(stopRe);
      if (stopMatch) rest = rest.slice(0, stopMatch.index).trim();
    }
    if (rest) return rest;
  }
  return null;
}

function guessEquipmentType(foldedFullText) {
  if (/bien dong dien|current transformer/i.test(foldedFullText)) return "TI (biến dòng điện)";
  if (/bien dien ap|voltage transformer|potential transformer/i.test(foldedFullText)) return "TU (biến điện áp)";
  if (/may bien ap|khang dau|khang dien|power transformer|shunt reactor/i.test(foldedFullText)) return "MBA/Kháng dầu";
  if (/su xuyen|bushing/i.test(foldedFullText)) return "Sứ xuyên (Bushing)";
  return null;
}

function guessDeviceCode(siteText) {
  if (!siteText) return null;
  // Mã thiết bị kiểu "TI174", "TU172", "AT1", "T2"... — chữ hoa (có thể có Đ) rồi số,
  // có thể kèm "-số" (VD "DCL171-7"). Không khớp các cụm số-trước-chữ như "110kV".
  const m = siteText.match(/\b([A-ZĐ]{1,4}\d{2,4}(?:[-\/]\d+)?)\b/);
  return m ? m[1] : null;
}

function guessPhase(foldedFullText) {
  const m = foldedFullText.match(/\bpha\s*([ABC])\b/i);
  return m ? m[1].toUpperCase() : null;
}

function guessSampleDateISO(foldedFullText) {
  const m = foldedFullText.match(/Ngay lay mau[^:]*:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// "Ngày thí nghiệm" nằm ở 1 đoạn văn riêng (không thuộc bảng thông tin chung), dạng
// "Ngày thí nghiệm: 30/08/2026 17:21:20" — CHỈ lấy phần ngày (giờ:phút:giây không dùng
// ở đâu trong app, xem bbtnFormatDateVN() ở bbtn-export.js chỉ định dạng dd/mm/yyyy).
// Khác "Ngày lấy mẫu" (guessSampleDateISO) vì 2 mốc có thể lệch nhau nếu gửi mẫu đi
// phân tích sau ngày lấy mẫu thực tế ngoài hiện trường.
function guessTestDateISO(foldedFullText) {
  const m = foldedFullText.match(/Ngay thi nghiem[^:]*:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// "Điều kiện môi trường (Ambient condition): t (Temp.) = 29 ºC , Độ ẩm (Humidity) = 78 %"
// — 2 giá trị số (nhiệt độ/độ ẩm) nằm chung 1 dòng, tách bằng 2 regex riêng dựa vào
// nhãn tiếng Anh trong ngoặc (ổn định hơn nhãn tiếng Việt vì không dấu/không viết tắt).
function guessNhietDo(foldedFullText) {
  // Chấp nhận cả "º" (ordinal masculine — ký tự đúng trong font PDF gốc) lẫn "°" (dấu độ
  // Unicode chuẩn — Tesseract OCR luôn chuẩn hóa về ký tự này bất kể font gốc dùng gì).
  const m = foldedFullText.match(/(?:t\s*\(Temp\.?\)|Nhiet do)\s*=\s*(-?\d+(?:[.,]\d+)?)\s*[º°]?C/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function guessDoAm(foldedFullText) {
  const m = foldedFullText.match(/Do am[^=]*=\s*(\d+(?:[.,]\d+)?)\s*%/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

// ---------------------------------------------------------------------------
// 3) Trích 7 giá trị khí hòa tan (ppm) từ bảng "KẾT QUẢ THÍ NGHIỆM" — tìm dòng có
//    tên khí, rồi lấy SỐ ĐẦU TIÊN xuất hiện sau tên khí trên chính dòng đó, sau khi
//    đã loại bỏ các cụm "< số" (đó là cột "Tiêu chuẩn/Limits", không phải kết quả đo).
// ---------------------------------------------------------------------------
const GAS_LINE_PATTERNS = [
  { id: "H2", re: /Hydrogen\s*H\s*2/i },
  { id: "CH4", re: /Methane\s*CH\s*4/i },
  { id: "C2H6", re: /Ethan\s*C\s*2\s*H\s*6/i },
  { id: "C2H4", re: /Ethylen\s*C\s*2\s*H\s*4/i },
  { id: "C2H2", re: /Acetylen\s*C\s*2\s*H\s*2/i },
  { id: "CO", re: /CarbonMonoxit\s*CO(?!\s*2)/i },
  { id: "CO2", re: /Carbondioxit\s*CO\s*2/i },
];

function extractGasValues(lines) {
  const values = {};
  for (const gas of GAS_LINE_PATTERNS) {
    let found = null;
    for (const line of lines) {
      const m = line.match(gas.re);
      if (!m) continue;
      const rest = line.slice(m.index + m[0].length);
      const cleaned = rest.replace(/<\s*[\d.,]+/g, "");
      const nums = cleaned.match(/-?\d+(?:[.,]\d+)?/g);
      if (nums && nums.length) {
        found = parseFloat(nums[0].replace(",", "."));
        break;
      }
    }
    if (found !== null && !Number.isNaN(found)) values[gas.id] = found;
  }
  return values;
}

// Các trường "Thông số kỹ thuật thiết bị" (dùng khi xuất báo cáo phân tích kỹ thuật)
// nằm chung 1 hàng theo cặp trong mẫu PTC3/BM.15 — VD "Hãng sản xuất (Manufacturer):
// HAEFELY    Năm sản xuất: 2000" — nên dùng đúng cơ chế stopRe (dừng trước nhãn kế
// tiếp trên cùng hàng) như hangSanXuat đã làm, cho Số chế tạo/Điện áp định mức/Loại
// dầu; riêng 2 trường "năm" (Năm sản xuất/Năm vận hành) chỉ lấy đúng 4 chữ số ngay
// sau nhãn vì bản thân chúng đã là nhãn-2 trên hàng, không cần stopRe.
function extractYearAfterLabel(fullText, labelRe) {
  const m = fullText.match(labelRe);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// 4) Hàm chính — trả về { tram, thietbi, loai, pha, ngay, hangSanXuat, soCheTao,
//    dienApDm, namSx, namVanHanh, loaiDau, ngayThiNghiem, lyDoThiNghiem, nhietDo,
//    doAm, gases, matchedCount, viaOCR } — mọi trường có thể null nếu không nhận diện
//    được. viaOCR=true nghĩa là dữ liệu đến từ đường dự phòng OCR (file không có lớp
//    text thật, ví dụ ảnh scan/chụp) — độ tin cậy thấp hơn đọc trực tiếp, người gọi
//    (ui/ui-dga.js, bbtn-batch-import.js) nên nhắc người dùng kiểm tra kỹ hơn.
//    onProgress (tuỳ chọn) nhận các sự kiện tiến trình OCR dạng { status, progress }
//    (progress từ 0 đến 1) để hiển thị "Đang nhận diện chữ..." — chỉ được gọi khi thật
//    sự có chạy OCR (file đọc trực tiếp được thì không có gì để báo tiến trình).
// ---------------------------------------------------------------------------
async function extract(file, onProgress) {
  let lines = await pdfFileToLines(file);
  let viaOCR = false;
  if (lines.join("\n").trim().length < MIN_TEXT_LEN_FOR_DIRECT_READ) {
    // Không đọc được lớp text thật (nhiều khả năng là ảnh scan/chụp) — thử OCR. Nếu
    // OCR cũng không ra dòng nào (ảnh quá mờ, hoặc lỗi tải thư viện/dữ liệu ngôn ngữ),
    // GIỮ NGUYÊN kết quả rỗng từ pdf.js thay vì ném lỗi — extract() vẫn trả về bình
    // thường với matchedCount=0, để người gọi hiện đúng thông báo "không nhận diện
    // được" thay vì lỗi kỹ thuật khó hiểu.
    try {
      const ocrLines = await pdfFileToLinesViaOCR(file, onProgress);
      if (ocrLines.length) {
        lines = ocrLines;
        viaOCR = true;
      }
    } catch (err) {
      // Bỏ qua lỗi OCR (VD trình duyệt quá cũ không hỗ trợ WASM) — coi như không đọc
      // được, KHÔNG làm hỏng luồng đọc trực tiếp (lines rỗng từ pdf.js vẫn được dùng).
    }
  }
  const fullText = lines.join("\n");
  const foldedLines = lines.map(stripVnDiacritics);
  const foldedFullText = foldedLines.join("\n");

  // Chữ cái ĐẦU mỗi nhãn để "?" (tuỳ chọn) vì thực tế đã kiểm chứng: khi đọc bằng OCR,
  // ký tự đầu tiên của 1 ô bảng (sát viền kẻ khung bên trái) thỉnh thoảng bị rụng mất
  // HOÀN TOÀN (không phải lỗi dấu — mất hẳn 1 ký tự, VD "Tên dự án" → "ên dự án", "Điện
  // áp" → "iện áp") — tuỳ dòng, không phải lúc nào cũng xảy ra. Không ảnh hưởng nhánh đọc
  // trực tiếp (pdf.js không rụng ký tự) vì "?" vẫn khớp bình thường khi ký tự đó CÓ mặt.
  const tram = extractLabelValue(lines, foldedLines, /T?en du an\/t?en tram[^:]*:/i, /\s{2,}\S/);
  const viTri = extractLabelValue(lines, foldedLines, /V?i tri lap dat[^:]*:/i, /\s{2,}\S/);
  const hangSanXuat = extractLabelValue(lines, foldedLines, /H?ang san xuat[^:]*:/i, /Nam san xuat/i);
  const soCheTao = extractLabelValue(lines, foldedLines, /S?o che tao[^:]*:/i, /Nam van hanh/i);
  const dienApDm = extractLabelValue(lines, foldedLines, /D?ien ap dinh muc[^:]*:/i, /Cong suat/i);
  const loaiDau = extractLabelValue(lines, foldedLines, /L?oai dau[^:]*:/i, /Ngay lay mau/i);
  const namSx = extractYearAfterLabel(foldedFullText, /Nam san xuat[^:]*:\s*(\d{4})/i);
  const namVanHanh = extractYearAfterLabel(foldedFullText, /Nam (?:van hanh|dua vao van hanh)[^:]*:\s*(\d{4})/i);
  const lyDoThiNghiem = extractLabelValue(lines, foldedLines, /L?y do thi nghiem[^:]*:/i, /\s{2,}\S/);
  const loai = guessEquipmentType(foldedFullText);
  const thietbi = guessDeviceCode(viTri) || guessDeviceCode(fullText);
  const pha = guessPhase(foldedFullText);
  const ngay = guessSampleDateISO(foldedFullText);
  const ngayThiNghiem = guessTestDateISO(foldedFullText);
  const nhietDo = guessNhietDo(foldedFullText);
  const doAm = guessDoAm(foldedFullText);
  const gases = extractGasValues(lines);

  const matchedCount =
    [tram, thietbi, loai, pha, ngay].filter(Boolean).length + Object.keys(gases).length;

  return {
    tram, thietbi, loai, pha, ngay, hangSanXuat, soCheTao, dienApDm, namSx, namVanHanh, loaiDau,
    ngayThiNghiem, lyDoThiNghiem, nhietDo, doAm, gases, matchedCount, viaOCR,
  };
}

window.BbtnImport = { extract };
window.dispatchEvent(new Event("bbtnimport:ready"));
