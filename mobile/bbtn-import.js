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
// LƯU Ý: dùng đuôi ".js" (không phải ".mjs") cho 2 file thư viện dưới đây — dù nội
// dung vẫn y hệt bản ES module gốc của pdf.js. Một số server/host tĩnh (kể cả một số
// server chạy trên Windows) không có sẵn ánh xạ MIME type cho đuôi ".mjs" và trả về
// "text/plain" thay vì JavaScript — trình duyệt áp dụng "strict MIME type checking"
// cho <script type="module"> nên sẽ CHẶN, không chạy file, và lỗi này chỉ hiện trong
// Console (F12) chứ không có thông báo gì trên giao diện. Đuôi ".js" thì hầu như mọi
// server đều tự nhận đúng loại JavaScript nên không gặp lỗi này.
import * as pdfjsLib from "./vendor/pdfjs/pdf.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.min.js", import.meta.url).href;

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

const VN_DIACRITICS_MAP = {
  a: "àáảãạăằắẳẵặâầấẩẫậ", e: "èéẻẽẹêềếểễệ", i: "ìíỉĩị", o: "òóỏõọôồốổỗộơờớởỡợ",
  u: "ùúủũụưừứửữự", y: "ỳýỷỹỵ", d: "đ",
  A: "ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ", E: "ÈÉẺẼẸÊỀẾỂỄỆ", I: "ÌÍỈĨỊ", O: "ÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ",
  U: "ÙÚỦŨỤƯỪỨỬỮỰ", Y: "ỲÝỶỸỴ", D: "Đ",
};
function stripVnDiacritics(str) {
  let out = String(str || "");
  Object.keys(VN_DIACRITICS_MAP).forEach((ascii) => {
    const chars = VN_DIACRITICS_MAP[ascii];
    for (let i = 0; i < chars.length; i++) {
      if (out.indexOf(chars[i]) !== -1) out = out.split(chars[i]).join(ascii);
    }
  });
  return out;
}

function extractSoCheTao(lines, foldedLines, pha) {
  for (let i = 0; i < lines.length; i++) {
    const m = foldedLines[i].match(/(?:S?o\s*che\s*tao|Serial\s*(?:N\s*o|Number)|So\s*may|So\s*se\s*ri|S\/N)\b[^:]*[:.]?/i);
    if (!m) continue;
    let rest = lines[i].slice(m.index + m[0].length).trim();
    const stopMatch = stripVnDiacritics(rest).match(
      /(?:Nam\s*(?:dua\s*vao\s*)?van\s*hanh|Year\s*of\s*operation|Nam\s*san\s*xuat|Year\s*of\s*(?:mfg|manufacture)|Cong\s*suat|Rated\s*power|Dien\s*ap|Rated\s*voltage|\s{2,}\S)/i
    );
    if (stopMatch) rest = rest.slice(0, stopMatch.index).trim();

    if (!rest && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const nextFolded = foldedLines[i + 1];
      if (!/(?:Loai\s*dau|Ngay|Ly\s*do|Dieu\s*kien|STT|Ket\s*qua|Hang\s*muc)/i.test(nextFolded)) {
        rest = nextLine;
      }
    }

    let combined = rest;
    if (i + 1 < lines.length && !/(?:Loai\s*dau|Ngay|Ly\s*do|Dieu\s*kien|STT|Ket\s*qua)/i.test(foldedLines[i + 1])) {
      combined += " " + lines[i + 1].trim();
    }

    combined = combined.replace(/p\s+ha\s+([ABC])/gi, "pha $1").replace(/(\d+)\s*\/\s*(\d+)/g, "$1/$2");

    const phaseMatch = {};
    const re = /pha\s*([ABC])\s*[:.\-]?\s*([^\s,;]+)/gi;
    let pm;
    while ((pm = re.exec(combined)) !== null) {
      phaseMatch[pm[1].toUpperCase()] = pm[2].trim();
    }

    if (pha && phaseMatch[pha.toUpperCase()]) {
      return phaseMatch[pha.toUpperCase()];
    }
    if (Object.keys(phaseMatch).length > 0) {
      return Object.entries(phaseMatch).map(([p, s]) => `Pha ${p}: ${s}`).join(", ");
    }

    if (rest) {
      return rest.replace(/^[:.\-\s]+|[,;.\-\s]+$/g, "").trim();
    }
  }
  return null;
}

function extractLoaiDau(lines, foldedLines) {
  for (let i = 0; i < lines.length; i++) {
    // Bỏ qua dòng tiêu đề biên bản (vd: "BIÊN BẢN THÍ NGHIỆM DẦU CÁCH ĐIỆN")
    if (/(?:Bien\s*ban|Bao\s*cao|BM\.\d+)/i.test(foldedLines[i])) continue;
    const m = foldedLines[i].match(/(?:L?oai\s*dau|Chung\s*loai\s*dau|Ten\s*dau|Oil\s*type|Type\s*of\s*oil|Dau\s*cach\s*dien\s*[:.-])\b[^:]*[:.]?/i);
    if (!m) continue;
    let rest = lines[i].slice(m.index + m[0].length).trim();
    const stopMatch = stripVnDiacritics(rest).match(
      /(?:Ngay\s*(?:lay\s*mau|thi\s*nghiem)|Date(?:\s*of\s*sampling)?|Khoi\s*luong|Volume|Weight|Ly\s*do|Purpose|Nhiet\s*do|Temp|Do\s*am|Humidity|\s{2,}\S)/i
    );
    if (stopMatch) rest = rest.slice(0, stopMatch.index).trim();

    // Nếu ô nhãn ở cuối dòng hoặc giá trị nằm ở hàng dưới
    if (!rest && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const nextFolded = foldedLines[i + 1];
      if (!/(?:Bien\s*ban|Ngay|Ly\s*do|Dieu\s*kien|STT|Ket\s*qua|Hang\s*muc)/i.test(nextFolded)) {
        rest = nextLine;
      }
    }

    if (rest) {
      return rest.replace(/^[:.\-\s]+|[,;.\-\s]+$/g, "").trim();
    }
  }

  const full = lines.join(" ");
  const mKnown = full.match(/\b(Nynas\s+Nytro(?:\s+[\w\d]+)?|Shell\s+Diala(?:\s+[\w\d\-]+)?|Apar(?:\s+[\w\d]+)?|Ergon(?:\s+Hyvolt(?:\s+[\w\d]+)?)?|Dầu khoáng|Mineral\s+oil|Dầu Silicone|Dầu ester)\b/i);
  if (mKnown) return mKnown[1].trim();

  return null;
}

// Trích "Điện áp định mức" từ thông tin kỹ thuật thiết bị (VD: "550 kV", "220 kV", "500/220/35 kV",
// hoặc OCR bị tách số "5 5 0 kV"). Dừng trước nhãn kế tiếp trên cùng hàng (Công suất, Năm sản xuất...).
function extractDienApDm(lines, foldedLines) {
  if (!lines || !lines.length) return null;
  const fLines = foldedLines || lines.map(stripVnDiacritics);

  for (let i = 0; i < lines.length; i++) {
    const folded = fLines[i];
    const m = folded.match(/(?:D?ien\s*ap\s*(?:dinh\s*muc)?|Rated\s*voltage|\bUm\b|\bUn\b)[^:.]*[:.]?/i);
    if (!m) continue;

    if (/(?:choc\s*thung|breakdown|chiu\s*dung|withstand|thu\s*nghiem|ket\s*qua|ket\s*luan)/i.test(folded)) continue;

    let rest = lines[i].slice(m.index + m[0].length).trim();
    const stopMatch = stripVnDiacritics(rest).match(
      /(?:Cong\s*suat|Rated\s*power|Nam\s*san\s*xuat|Year|Tan\s*so|Freq|Dong\s*dien|Current|Ti\s*so|Ratio|Cap\s*chinh\s*xac|So\s*che\s*tao|Serial|\s{2,}\S)/i
    );
    if (stopMatch) rest = rest.slice(0, stopMatch.index).trim();

    if (!rest && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const nextFolded = fLines[i + 1];
      if (!/(?:Bien\s*ban|Ngay|Ly\s*do|Dieu\s*kien|STT|Ket\s*qua|Hang\s*muc|Cong\s*suat|Nam)/i.test(nextFolded)) {
        if (/(\d+(?:\s*\d+)*\s*(?:kV|V)|\b\d{2,3}\b)/i.test(nextFolded)) {
          rest = nextLine;
        }
      }
    }

    if (rest) {
      rest = rest.replace(/^[:.\-\s]+|[,;.\-\s]+$/g, "").trim();
      rest = rest.replace(/(\d)\s+(?=\d)/g, "$1");
      rest = rest.replace(/\bk\s+V\b/gi, "kV");
      rest = rest.replace(/\s+/g, " ").trim();
      if (rest) return rest;
    }
  }

  const full = lines.join(" ").replace(/(\d)\s+(?=\d)/g, "$1");
  const mVolt = full.match(/\b(550|525|500|242|230|220|121|115|110|35|22|10)\s*kV\b/i);
  if (mVolt) return mVolt[0];

  return null;
}

// Ánh xạ "Điện áp định mức" (hoặc trạm/thiết bị) sang cấp điện áp Bảng 63 ("110-220" hoặc "500").
function mapVoltageToBang63Class(dienApText, tram, thietbi) {
  const norm = (s) => (s ? String(s).replace(/(\d)\s+(?=\d)/g, "$1").replace(/\s+/g, " ") : "");
  const vText = norm(dienApText);

  if (vText) {
    const nums = [];
    const re = /(\d+(?:[.,]\d+)?)\s*(?:kV|k\s*V)?/gi;
    let m;
    while ((m = re.exec(vText)) !== null) {
      const val = parseFloat(m[1].replace(",", "."));
      if (!isNaN(val)) nums.push(val);
    }
    if (nums.length > 0) {
      const maxV = Math.max(...nums);
      if (maxV >= 500) return "500";
      if (maxV >= 110) return "110-220";
      if (maxV > 0) return "110-220";
    }
    if (/500|525|550/i.test(vText)) return "500";
    if (/110|220|230/i.test(vText)) return "110-220";
  }

  const tText = norm(tram);
  if (tText) {
    if (/500\s*kV/i.test(tText)) return "500";
    if (/(?:220|110)\s*kV/i.test(tText)) return "110-220";
  }

  const tbText = norm(thietbi);
  if (tbText) {
    if (/500\s*kV|\b500\b|\b(?:TI|TU|CVT|MC|DCL|AT|T)?\s*5\d{2}\b/i.test(tbText)) return "500";
    if (/(?:220|110)\s*kV|\b(?:TI|TU|CVT|MC|DCL|AT|T)?\s*[12]\d{2}\b/i.test(tbText)) return "110-220";
  }

  return null;
}

// ---------------------------------------------------------------------------
// 3) Trích 7 giá trị khí hòa tan (ppm) từ bảng "KẾT QUẢ THÍ NGHIỆM" — tìm dòng có
//    tên khí, rồi lấy SỐ ĐẦU TIÊN xuất hiện sau tên khí trên chính dòng đó, sau khi
//    đã loại bỏ các cụm "< số" (đó là cột "Tiêu chuẩn/Limits", không phải kết quả đo).
// ---------------------------------------------------------------------------
const GAS_LINE_PATTERNS = [
  { id: "H2", re: /\b(?:Hydrogen|Hydro)\b(?:\s*\(?\s*H\s*2\s*\)?|\s*\/\s*H\s*2)?|(?<![A-Za-z0-9\/\\_–—-])H\s*2(?![A-Za-z0-9\/\\_–—-])/i },
  { id: "CH4", re: /\b(?:Methane|Metan)\b(?:\s*\(?\s*CH\s*4\s*\)?|\s*\/\s*CH\s*4)?|(?<![A-Za-z0-9\/\\_–—-])CH\s*4(?![A-Za-z0-9\/\\_–—-])/i },
  { id: "C2H6", re: /\b(?:Ethane?|Etan)\b(?:\s*\(?\s*C\s*2\s*H\s*6\s*\)?|\s*\/\s*C\s*2\s*H\s*6)?|(?<![A-Za-z0-9\/\\_–—-])C\s*2\s*H\s*6(?![A-Za-z0-9\/\\_–—-])/i },
  { id: "C2H4", re: /\b(?:Ethylene?|Etilen)\b(?:\s*\(?\s*C\s*2\s*H\s*4\s*\)?|\s*\/\s*C\s*2\s*H\s*4)?|(?<![A-Za-z0-9\/\\_–—-])C\s*2\s*H\s*4(?![A-Za-z0-9\/\\_–—-])/i },
  { id: "C2H2", re: /\b(?:Acetylene?|Axetilen)\b(?:\s*\(?\s*C\s*2\s*H\s*2\s*\)?|\s*\/\s*C\s*2\s*H\s*2)?|(?<![A-Za-z0-9\/\\_–—-])C\s*2\s*H\s*2(?![A-Za-z0-9\/\\_–—-])/i },
  { id: "CO", re: /\b(?:Carbon\s*Monoxit|Carbon\s*Monoxide|Cacbon\s*Monoxit)\b(?:\s*\(?\s*CO\s*\)?|\s*\/\s*CO)?|(?<![A-Za-z0-9\/\\_–—-])CO(?![A-Za-z0-9\/\\_–—-])/i },
  { id: "CO2", re: /\b(?:Carbon\s*Dioxit|Carbon\s*Dioxide|Cacbon\s*Dioxit)\b(?:\s*\(?\s*CO\s*2\s*\)?|\s*\/\s*CO\s*2)?|(?<![A-Za-z0-9\/\\_–—-])CO\s*2(?![A-Za-z0-9\/\\_–—-])/i },
  { id: "N2", re: /\b(?:Nitrogen|Nit[oơ])\b(?:\s*\(?\s*N\s*2\s*\)?|\s*\/\s*N\s*2)?|(?<![A-Za-z0-9\/\\_–—-])N\s*2(?![A-Za-z0-9\/\\_–—-])/i },
  { id: "O2", re: /\b(?:Oxygen|Oxy)\b(?:\s*\(?\s*O\s*2\s*\)?|\s*\/\s*O\s*2)?|(?<![A-Za-z0-9\/\\_–—-])O\s*2(?![A-Za-z0-9\/\\_–—-])/i },
];

const KPH_PATTERN =
  /(?:^|\s|[^\wÀ-ỹ])(?:KPH|K\.P\.H\.?|K\s*P\s*H|Kh[oô]ng\s*ph[aá]t\s*hi[eệ]n|<\s*LOD|<\s*LOQ|D[uư][oớ]i\s*ng[uư][oõ]ng(?:\s*ph[aá]t\s*hi[eệ]n)?|\bND\b|N\/D|N\.D\.?|BDL|None)(?:$|\s|[^\wÀ-ỹ])|(?:^|\s)[-–—](?:\s|$)/i;

function extractGasValues(lines) {
  const values = {};

  // 1. Giới hạn phạm vi quét vào vùng bảng "KẾT QUẢ THÍ NGHIỆM" nếu tìm thấy tiêu đề bảng.
  let searchLines = lines;
  const startIdx = lines.findIndex((l) =>
    /K[EÊ]T\s*QU[AẢ]\s*(?:TH[IÍ]|TH[UỬ])\s*NGHI[EỆ]M|TESTING\s*RESULTS|B[AẢ]NG\s*K[EÊ]T\s*QU[AẢ]/i.test(
      stripVnDiacritics(l)
    )
  );
  if (startIdx !== -1) {
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      const f = stripVnDiacritics(lines[i]);
      if (
        /(?:T[yỷ]\s*s[oố]\s*kh[ií]|Gas\s*ratio|Thi[eế]t\s*b[iị]\s*th[ií]\s*nghi[eệ]m|Testing\s*instruments?|Ghi\s*ch[uú]|Remark|K[eê]t\s*lu[aậ]n|Conclusion|TUQ\.|Nguoi\s*thi\s*nghiem|Truong\s*phong|Chroma|Agilent|GC\s*-\s*S\/N)/i.test(
          f
        )
      ) {
        endIdx = i;
        break;
      }
    }
    const candidate = lines.slice(startIdx, endIdx);
    if (
      candidate.some((l) =>
        /(?:Hydrogen|Hydro|Methane|Metan|Ethane|Etan|Ethylene|Etilen|Acetylene|Axetilen|Carbon|Cacbon|Nitrogen|Nit[oơ]|Oxygen|Oxy)\b/i.test(
          l
        )
      )
    ) {
      searchLines = candidate;
    }
  }

  // 2. Trích từng loại khí
  for (const gas of GAS_LINE_PATTERNS) {
    let found = null;
    for (let i = 0; i < searchLines.length; i++) {
      const line = searchLines[i];
      // Bỏ qua các dòng tỷ số khí (vd: CH4/H2: 1.0, C2H2/C2H4: 0.1)
      if (/(?:t[yỷ]\s*s[oố]|gas\s*ratio|\bCH4\s*\/\s*H2\b|\bC2H2\s*\/\s*C2H4\b|\bC2H4\s*\/\s*C2H6\b|\bCO2\s*\/\s*CO\b)/i.test(line)) {
        continue;
      }
      // Bỏ qua dòng thiết bị thí nghiệm (vd: Máy sắc ký GC S/N 1)
      if (/(?:thi[eế]t\s*b[iị]\s*th[ií]|testing\s*instruments?|m[aá]y\s*s[aắ]c\s*k[yý]|chromatograph)/i.test(line)) {
        continue;
      }

      const m = line.match(gas.re);
      if (!m) continue;

      let rest = line.slice(m.index + m[0].length).trim();

      // Nếu ô kết quả nằm ở dòng kế tiếp (bảng nhiều dòng do ngắt dòng PDF)
      if (!rest && i + 1 < searchLines.length) {
        const nextLine = searchLines[i + 1].trim();
        const isNextGas = GAS_LINE_PATTERNS.some((g) => g.id !== gas.id && g.re.test(nextLine));
        if (!isNextGas) {
          rest = nextLine;
        }
      }

      // 1) Nếu có từ khóa KPH:
      if (KPH_PATTERN.test(rest)) {
        found = "KPH";
        break;
      }

      // 2) Nếu trong kết quả có 2 dấu "<" liên tiếp (vd: "< 1 < 300" hoặc "< 0.1 < 1"):
      const ltMatches = [...rest.matchAll(/[<≤]\s*[\d.,]+/g)];
      if (ltMatches.length >= 2) {
        const beforeFirstLt = rest.slice(0, ltMatches[0].index);
        if (!/\d/.test(beforeFirstLt)) {
          found = "KPH";
          break;
        }
      }
      // 3) Nếu chỉ có 1 dấu "<" và trước nó không có số đo thực tế (vd: "< 1 Đạt" hoặc "< 0.1 Đạt"):
      if (ltMatches.length === 1) {
        const beforeLt = rest.slice(0, ltMatches[0].index);
        if (!/\d/.test(beforeLt)) {
          const afterLt = rest.slice(ltMatches[0].index + ltMatches[0][0].length).trim();
          const ltVal = parseFloat(ltMatches[0][0].replace(/[<≤\s]/g, "").replace(",", "."));
          const fAfterLt = stripVnDiacritics(afterLt);
          if (
            (ltVal <= 5 && /^(?:Dat|Pass|Phu\s*hop|$)/i.test(fAfterLt)) ||
            /<\s*(?:1|0\.1|0,1|0\.5|0,5|5)\s*(?:ppm)?\s*(?:[ĐD]at|Pass|$)/i.test(rest)
          ) {
            found = "KPH";
            break;
          }
        }
      }

      // 4) Lấy số đo thực tế
      const cleaned = rest
        .replace(/[<≤>≥]=?\s*[\d.,]+/g, "")
        .replace(/[+-]?\s*[\d.,]+\s*%/g, "");
      const nums = cleaned.match(/-?\d+(?:[.,]\d+)?/g);
      if (nums && nums.length) {
        found = parseFloat(nums[0].replace(",", "."));
        break;
      }
    }
    if (found !== null && found !== undefined) values[gas.id] = found;
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
  const foldedLines = lines.map(stripVnDiacritics);

  const tram = extractLabelValue(lines, /Tên dự án\/tên trạm[^:]*:/i, /\s{2,}\S/);
  const viTri = extractLabelValue(lines, /Vị trí lắp đặt[^:]*:/i, /\s{2,}\S/);
  const hangSanXuat = extractLabelValue(lines, /Hãng sản xuất[^:]*:/i, /Năm sản xuất/i);
  const dienApDm = extractDienApDm(lines, foldedLines);
  const loai = guessEquipmentType(fullText);
  const thietbi = guessDeviceCode(viTri) || guessDeviceCode(fullText);
  const bang63VoltageClass = mapVoltageToBang63Class(dienApDm, tram, thietbi);
  const pha = guessPhase(fullText);
  const soCheTao = extractSoCheTao(lines, foldedLines, pha);
  const loaiDau = extractLoaiDau(lines, foldedLines);
  const ngay = guessSampleDateISO(fullText);
  const gases = extractGasValues(lines);

  const matchedCount =
    [tram, thietbi, loai, pha, ngay, soCheTao, loaiDau, dienApDm].filter(Boolean).length + Object.keys(gases).length;

  return { tram, thietbi, loai, pha, ngay, hangSanXuat, soCheTao, dienApDm, bang63VoltageClass, loaiDau, gases, matchedCount };
}

const BbtnImport = { extract, extractGasValues, extractSoCheTao, extractLoaiDau, extractDienApDm, mapVoltageToBang63Class };
window.BbtnImport = BbtnImport;
if (typeof module !== "undefined" && module.exports) module.exports = BbtnImport;
window.dispatchEvent(new Event("bbtnimport:ready"));
