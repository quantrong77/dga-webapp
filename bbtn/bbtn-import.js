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
function extractLabelValue(lines, labelRe, stopRe) {
  for (const line of lines) {
    const m = line.match(labelRe);
    if (!m) continue;
    let rest = line.slice(m.index + m[0].length).trim();
    if (stopRe) {
      const stopMatch = rest.match(stopRe);
      if (stopMatch) rest = rest.slice(0, stopMatch.index).trim();
    }
    if (rest) return rest;
  }
  return null;
}

function guessEquipmentType(fullText) {
  if (/biến dòng điện|current transformer/i.test(fullText)) return "TI (biến dòng điện)";
  if (/biến điện áp|voltage transformer|potential transformer/i.test(fullText)) return "TU (biến điện áp)";
  if (/máy biến áp|kháng dầu|kháng điện|power transformer|shunt reactor/i.test(fullText)) return "MBA/Kháng dầu";
  if (/sứ xuyên|bushing/i.test(fullText)) return "Sứ xuyên (Bushing)";
  return null;
}

function guessDeviceCode(siteText) {
  if (!siteText) return null;
  // Mã thiết bị kiểu "TI174", "TU172", "AT1", "T2"... — chữ hoa (có thể có Đ) rồi số,
  // có thể kèm "-số" (VD "DCL171-7"). Không khớp các cụm số-trước-chữ như "110kV".
  const m = siteText.match(/\b([A-ZĐ]{1,4}\d{2,4}(?:[-\/]\d+)?)\b/);
  return m ? m[1] : null;
}

function guessPhase(fullText) {
  const m = fullText.match(/\bpha\s*([ABC])\b/i);
  return m ? m[1].toUpperCase() : null;
}

function guessSampleDateISO(fullText) {
  const m = fullText.match(/Ngày lấy mẫu[^:]*:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// "Ngày thí nghiệm" nằm ở 1 đoạn văn riêng (không thuộc bảng thông tin chung), dạng
// "Ngày thí nghiệm: 30/08/2026 17:21:20" — CHỈ lấy phần ngày (giờ:phút:giây không dùng
// ở đâu trong app, xem bbtnFormatDateVN() ở bbtn-export.js chỉ định dạng dd/mm/yyyy).
// Khác "Ngày lấy mẫu" (guessSampleDateISO) vì 2 mốc có thể lệch nhau nếu gửi mẫu đi
// phân tích sau ngày lấy mẫu thực tế ngoài hiện trường.
function guessTestDateISO(fullText) {
  const m = fullText.match(/Ngày thí nghiệm[^:]*:\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// "Điều kiện môi trường (Ambient condition): t (Temp.) = 29 ºC , Độ ẩm (Humidity) = 78 %"
// — 2 giá trị số (nhiệt độ/độ ẩm) nằm chung 1 dòng, tách bằng 2 regex riêng dựa vào
// nhãn tiếng Anh trong ngoặc (ổn định hơn nhãn tiếng Việt vì không dấu/không viết tắt).
function guessNhietDo(fullText) {
  const m = fullText.match(/(?:t\s*\(Temp\.?\)|Nhiệt độ)\s*=\s*(-?\d+(?:[.,]\d+)?)\s*º?C/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function guessDoAm(fullText) {
  const m = fullText.match(/Độ ẩm[^=]*=\s*(\d+(?:[.,]\d+)?)\s*%/i);
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
//    doAm, gases, matchedCount } — mọi trường có thể null nếu không nhận diện được.
// ---------------------------------------------------------------------------
async function extract(file) {
  const lines = await pdfFileToLines(file);
  const fullText = lines.join("\n");

  const tram = extractLabelValue(lines, /Tên dự án\/tên trạm[^:]*:/i, /\s{2,}\S/);
  const viTri = extractLabelValue(lines, /Vị trí lắp đặt[^:]*:/i, /\s{2,}\S/);
  const hangSanXuat = extractLabelValue(lines, /Hãng sản xuất[^:]*:/i, /Năm sản xuất/i);
  const soCheTao = extractLabelValue(lines, /Số chế tạo[^:]*:/i, /Năm vận hành/i);
  const dienApDm = extractLabelValue(lines, /Điện áp định mức[^:]*:/i, /Công suất/i);
  const loaiDau = extractLabelValue(lines, /Loại dầu[^:]*:/i, /Ngày lấy mẫu/i);
  const namSx = extractYearAfterLabel(fullText, /Năm sản xuất[^:]*:\s*(\d{4})/i);
  const namVanHanh = extractYearAfterLabel(fullText, /Năm (?:vận hành|đưa vào vận hành)[^:]*:\s*(\d{4})/i);
  const lyDoThiNghiem = extractLabelValue(lines, /Lý do thí nghiệm[^:]*:/i, /\s{2,}\S/);
  const loai = guessEquipmentType(fullText);
  const thietbi = guessDeviceCode(viTri) || guessDeviceCode(fullText);
  const pha = guessPhase(fullText);
  const ngay = guessSampleDateISO(fullText);
  const ngayThiNghiem = guessTestDateISO(fullText);
  const nhietDo = guessNhietDo(fullText);
  const doAm = guessDoAm(fullText);
  const gases = extractGasValues(lines);

  const matchedCount =
    [tram, thietbi, loai, pha, ngay].filter(Boolean).length + Object.keys(gases).length;

  return {
    tram, thietbi, loai, pha, ngay, hangSanXuat, soCheTao, dienApDm, namSx, namVanHanh, loaiDau,
    ngayThiNghiem, lyDoThiNghiem, nhietDo, doAm, gases, matchedCount,
  };
}

window.BbtnImport = { extract };
window.dispatchEvent(new Event("bbtnimport:ready"));
