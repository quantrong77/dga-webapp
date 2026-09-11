// bbtn-import.js — Đọc file PDF "Biên bản thí nghiệm" (BBTN) mẫu PTC3/BM.15 (phân
// tích khí hòa tan trong dầu cách điện) ngay trong trình duyệt và tự động nhận diện
// Trạm / Thiết bị / Loại thiết bị / Pha / Ngày lấy mẫu / Nhà sản xuất / hàm lượng 7
// khí, để điền sẵn vào form "1. Thông tin lần đo" khi người dùng đính kèm BBTN của
// một lần đo LỊCH SỬ (đỡ phải gõ tay lại số liệu đã có sẵn trong biên bản giấy/PDF).
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
import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

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

// ---------------------------------------------------------------------------
// 4) Hàm chính — trả về { tram, thietbi, loai, pha, ngay, hangSanXuat, gases,
//    matchedCount } — mọi trường có thể null nếu không nhận diện được.
// ---------------------------------------------------------------------------
async function extract(file) {
  const lines = await pdfFileToLines(file);
  const fullText = lines.join("\n");

  const tram = extractLabelValue(lines, /Tên dự án\/tên trạm[^:]*:/i, /\s{2,}\S/);
  const viTri = extractLabelValue(lines, /Vị trí lắp đặt[^:]*:/i, /\s{2,}\S/);
  const hangSanXuat = extractLabelValue(lines, /Hãng sản xuất[^:]*:/i, /Năm sản xuất/i);
  const loai = guessEquipmentType(fullText);
  const thietbi = guessDeviceCode(viTri) || guessDeviceCode(fullText);
  const pha = guessPhase(fullText);
  const ngay = guessSampleDateISO(fullText);
  const gases = extractGasValues(lines);

  const matchedCount =
    [tram, thietbi, loai, pha, ngay].filter(Boolean).length + Object.keys(gases).length;

  return { tram, thietbi, loai, pha, ngay, hangSanXuat, gases, matchedCount };
}

window.BbtnImport = { extract };
window.dispatchEvent(new Event("bbtnimport:ready"));
