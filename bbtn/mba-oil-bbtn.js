/* mba-oil-bbtn.js — Đọc số liệu BBTN (biên bản thí nghiệm) DẦU CÁCH ĐIỆN MBA/KHÁNG từ danh sách dòng chữ
   (PDF: BbtnImport.readLines(), bbtn/bbtn-import.js; DOCX: mbaOilDocxXmlToLines() bên dưới) để TỰ ĐIỀN tab
   "Lý-Hóa dầu" — dùng cho cả nhập biên bản MỚI lẫn nhập lại BBTN LỊCH SỬ để theo dõi xu hướng.

   Mẫu tham chiếu: "BIÊN BẢN THÍ NGHIỆM DẦU CÁCH ĐIỆN" của PTC3 (template/Ly-hoa.docx) — 1 biên bản gồm
   2 bảng kết quả: "Dầu cách điện trong thùng dầu chính (main tank)" và "Dầu cách điện trong bộ OLTC".
   - MBA 1 pha (VD 500 kV): "Vị trí lấy mẫu: Thân máy và bộ OLTC pha C" → cả 2 phần là của pha C.
   - MBA 3 pha chung thùng: phần thùng chính 1 cột, phần OLTC có thể tách riêng từng pha A/B/C.
   Không gắn cứng vị trí ô: dò từng dòng theo NHÃN chỉ tiêu rồi lấy các số đứng SAU nhãn — 1 số → 1 cột;
   ≥3 số khi phần đó có cột Pha A/B/C → 3 pha. Bỏ qua số của cột giới hạn (sau ≤ ≥ < > max min "không quá"),
   số hiệu tiêu chuẩn (IEC/ASTM/ISO/TCVN/GOST...), đơn vị có chữ số (/1ml, mgKOH/1g, 0C). Kết quả ghi bằng
   chữ: "Không thấy" (tạp chất quan sát), "Không có" (axit → 0; axit–kiềm hòa tan → Không có), "Không ăn mòn".
   Người dùng LUÔN phải đối chiếu lại với biên bản trước khi lưu.

   Hàm thuần (không đụng DOM/mạng) để kiểm thử bằng Jest (tests/oil-extended.test.js). */

function mbaOilFold(s) {
  return Array.from(String(s || "").normalize("NFC"), (ch) => {
    if (ch === "đ") return "d";
    if (ch === "Đ") return "D";
    const base = ch.normalize("NFD")[0];
    return base.length === ch.length ? base : ch;
  }).join("").toLowerCase();
}

// Thứ tự QUAN TRỌNG: nhãn cụ thể trước nhãn chung (VD "axit sau oxi hoa", "axit – kiem" trước "axit";
// "> 14 um" trước "> 6 um"; đếm hạt trước "tạp chất cơ học").
const MBA_OIL_BBTN_LABELS = [
  { field: "ox_sludge_percent", re: /(khoi luong )?can sau (o|oxy|oxi|o-xi)\s*hoa|sludge after oxidation/ },
  { field: "ox_acid_mgkoh", re: /(tri so |ham luong )?a\s*x\s*i\s*t sau (o|oxy|oxi|o-xi)\s*hoa|acid(ity)? after oxidation/ },
  { field: "ox_tgd", re: /(tg\s*\S?\s*|ton (that|hao) dien moi )sau (o|oxy|oxi|o-xi)\s*hoa|dissipation factor after oxidation/ },
  { field: "acid_base_soluble", re: /a\s*x\s*i\s*t\s*[-–—]?\s*(va )?kiem|acid\s*-\s*base|water[-\s]soluble acid/, kind: "yesno" },
  { field: "bdv_kv", re: /dien ap (choc|danh) thung|breakdown voltage|\bbdv\b/ },
  { field: "tgd_90c_percent", re: /(tg\s*\S{0,2}|tan\s*delta|ton (hao|that) dien moi|dissipation factor|\bddf\b)[^0-9]{0,30}9\s*0\s*[°ºo⁰]?\s*c?/ },
  { field: "moisture_ppm", re: /ham luong (nuoc|am)|do am (trong )?dau|water content|moisture/ },
  { field: "acid_mgkoh", re: /(tri so|ham luong|chi so) a\s*x\s*i\s*t|acidity|acid (number|value)|neutrali[sz]ation value/, zeroWords: true },
  { field: "flash_point_c", re: /(nhiet do )?chop chay|flash point/ },
  { field: "particles_14um", re: /(hat|particle)[^0-9]{0,40}>?\s*14\s*(μm|µm|um|micro)/ },
  { field: "particles_6um", re: /(hat|particle)[^0-9]{0,40}>?\s*6\s*(μm|µm|um|micro)/ },
  { field: "mech_visual", re: /quan sat bang mat|visual(ly)? (inspection|observ)/, kind: "visual" },
  { field: "mech_impurity_percent", re: /(ham luong )?tap chat co hoc|mechanical impurit/ },
  { field: "resistivity_90c_e12", re: /dien tro suat|resistivity/ },
  { field: "furfural_ppm", re: /furfural|2\s*-?\s*fal\b|hop chat furan|furanic/ },
  // "Màu sắc và độ trong (Appearance)": kết quả là chữ (trong/đục...) → Ngoại quan; có số thì là màu ISO 2049
  { field: "appearance", re: /mau sac (va|,) do trong|do trong|ngoai quan|appearance/, kind: "appearance" },
  { field: "color_iso2049", re: /mau sac|\bcolou?r\b/ },
  { field: "ift_mnm", re: /(suc|sut) cang be mat|interfacial tension|\bift\b/ },
  { field: "pcb_mgkg", re: /\bpcbs?\b/, zeroWords: true },
  { field: "corrosive_sulfur", re: /luu huynh|sul(ph|f)ur/, kind: "sulfur" },
  { field: "sludge_percent", re: /\bbun\b|\bsludge\b/, zeroWords: true },
  { field: "sediment_percent", re: /(ham luong )?\bcan\b(?! sau)|\bsediment\b/, zeroWords: true },
  { field: "inhibitor_pct_original", re: /chat (uc che|chong o\s*x\s*i hoa)|inhibitor content/ },
  { field: "passivator_mgkg", re: /(chat )?thu dong|passivator/ },
];

const MBA_OIL_ZERO_WORDS = /^[\s|:/]*(khong co|khong phat hien|kph|not detected|nil|none)\b/;

/** Số trong 1 đoạn: "0,012", "1.5", "2,5x10^12" / "2,5.10^12" / "2.5E+12" (→ bội số ×10¹² nếu wantE12). */
function mbaOilNumbers(text, wantE12) {
  const out = [];
  const re = /(-?\d+(?:[.,]\d+)?)(?:\s*(?:[x×*.]\s*10\s*\^?\s*([+-]?\d+)|e\s*([+-]?\d+)))?/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    let v = Number(m[1].replace(",", "."));
    const exp = m[2] !== undefined ? Number(m[2]) : m[3] !== undefined ? Number(m[3]) : null;
    if (exp !== null && Number.isFinite(exp)) v = wantE12 ? v * Math.pow(10, exp - 12) : v * Math.pow(10, exp);
    if (Number.isFinite(v)) out.push(Math.round(v * 1e9) / 1e9);
  }
  return out;
}

/** Bỏ phần không phải KẾT QUẢ (chạy trên chuỗi ĐÃ BỎ DẤU, chữ thường). */
function mbaOilStripNonResults(text, field) {
  const t = field === "flash_point_c"
    ? String(text).replace(/(o|tai|at)\s*\d+\s*[°º⁰]\s*c\b/g, " ")
    : String(text).replace(/\d+\s*[°º⁰]\s*c\b/g, " ");
  return t
    .replace(/(^|\s|\|)0\s*c(?=\s|$|\/|\|)/g, " ") // đơn vị "0C" gõ thay cho °C
    .replace(/\b(iec|astm|iso|tcvn|gost|en|din|bs|pmcc)\s*[a-z]?\s*\d+(?:[-:]\d+)*/g, " ")
    .replace(/(≤|≥|<=|>=|<|>|\bmax\.?|\bmin\.?|khong (lon|nho|thap|cao) hon|khong qua|toi (da|thieu))\s*-?\d+(?:[.,]\d+)?(?:\s*[x×*.]\s*10\s*\^?\s*[+-]?\d+)?/g, " ")
    .replace(/mg\s*koh\s*\/\s*1?\s*g/g, " ")
    .replace(/\/\s*1\s*(ml|g|l)\b/g, " ")
    .replace(/\(\s*[x×]\s*10\s*\^?\s*\d+\s*[^)]*\)/g, " ")
    .replace(/[Ωω]\s*[.·]?\s*cm/g, " ");
}

function mbaOilParseDate(folded) {
  const m = /ngay\s*(lay mau|thi nghiem|thu nghiem)?[^0-9]{0,24}(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})/.exec(folded);
  return m ? `${m[4]}-${m[3].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "";
}

/** Cấp điện áp (OIL_VOLTAGE_CLASSES) từ số kV đọc được. */
function mbaOilVoltageClass(kv) {
  if (!Number.isFinite(kv)) return "";
  if (kv >= 400) return "500";
  if (kv >= 200) return "220";
  if (kv >= 100) return "110";
  if (kv > 35) return ""; // không còn cấp điện áp nào giữa 35 và 110 kV (cấp 66 kV cũ đã bỏ) — để người dùng chọn
  if (kv >= 15) return "15den35";
  return "duoi15";
}

/** Phần của biên bản mà 1 dòng mở đầu: "oltc" | "main" | null (không phải tiêu đề phần). */
function mbaOilSectionOf(folded) {
  const heading = /(dau cach dien trong|insulation oil (of|in)|dau (trong )?(khoang|bo) (dieu ap|oltc|doi nac))/.test(folded);
  if (!heading) return null;
  if (/(oltc|on\s*-?\s*load|dieu ap duoi tai|doi nac|tap[\s-]*changer)/.test(folded)) return "oltc";
  if (/(thung dau chinh|main tank|than may|thung chinh)/.test(folded)) return "main";
  return null;
}

/** Đọc chỉ tiêu từ các dòng (đã bỏ dấu) của MỘT phần biên bản. */
function mbaOilParseSection(folded) {
  const threePhase = folded.some((l) => /pha\s*a\b.*pha\s*b\b.*pha\s*c\b/.test(l) || /phase\s*a\b.*phase\s*b\b.*phase\s*c\b/.test(l));
  const cols = threePhase ? ["A", "B", "C"] : ["X"];
  const values = {};
  cols.forEach((c) => { values[c] = {}; });
  const matched = [];
  const setAll = (field, v) => { cols.forEach((c) => { values[c][field] = v; }); matched.push(field); };

  folded.forEach((f) => {
    for (const def of MBA_OIL_BBTN_LABELS) {
      if (matched.includes(def.field)) continue;
      const m = def.re.exec(f);
      if (!m) continue;
      // phần sau nhãn; bỏ chú thích tiếng Anh ngay sau nhãn ("/ (Flash point PMCC)", "(Particles content)")
      const after = f.slice(m.index + m[0].length).replace(/^[\s/]*\([^)]*\)/, " ");
      if (def.kind === "sulfur") {
        const v = /khong an mon|non[-\s]?corrosive|khong co kha nang/.test(after) ? "khong" : /an mon|corrosive/.test(after) ? "co" : null;
        if (v) setAll(def.field, v);
        break;
      }
      if (def.kind === "appearance") {
        // ô kết quả ĐẦU TIÊN (bỏ ô đơn vị "/") — tránh lấy nhầm chữ ở cột Tiêu chuẩn
        const cells = after.includes("|") ? after.split("|").slice(1).map((c) => c.trim()).filter((c) => c && c !== "/") : [after];
        const first = cells[0] || "";
        const v = /duc|turbid|dull|van duc|co can/.test(first) ? "duc" : /trong|clear|sach/.test(first) ? "trong" : null;
        if (v) setAll(def.field, v);
        break;
      }
      if (def.kind === "visual") {
        const v = /khong (thay|phat hien|co)|not (seen|visible|detected)|none/.test(after) ? "khong"
          : /(co|thay) tap chat|visible|detected/.test(after) ? "co" : null;
        if (v) setAll(def.field, v);
        break;
      }
      if (def.kind === "yesno") {
        // Kết quả là ô ĐẦU TIÊN (sau ô nhãn, bỏ ô đơn vị) — "| mgkoh/g dau | khong co | khong co | dat" → "Không có".
        // Không có dấu ô (PDF): lấy cụm "không có"/"có" xuất hiện đầu tiên sau nhãn.
        const isUnit = (c) => !c || /^(\/|mg\s*koh\s*\/\s*1?\s*g( dau)?|-)$/.test(c);
        const cells = after.includes("|") ? after.split("|").slice(1).map((c) => c.trim()).filter((c) => !isUnit(c)) : [];
        const first = cells.length ? cells[0] : (/(khong co|khong phat hien|am tinh|negative|\bco\b|duong tinh|positive)/.exec(after) || [""])[0];
        const v = /^(khong co|khong|khong phat hien|am tinh|negative|none|nil)\b/.test(first) ? "khong"
          : /^(co|duong tinh|positive|present)\b/.test(first) ? "co" : null;
        if (v) setAll(def.field, v);
        break;
      }
      const nums = mbaOilNumbers(mbaOilStripNonResults(after, def.field), def.field === "resistivity_90c_e12");
      if (nums.length === 0) {
        // "Không có" / "KPH" (dưới giới hạn phát hiện) → 0 cho các chỉ tiêu đo hàm lượng
        const rest = after.replace(/\([^)]*\)/g, " ").replace(/mg\s*koh\s*\/\s*1?\s*g( dau)?|mg\s*\/\s*kg|ppm|%/g, " ");
        if (def.zeroWords && MBA_OIL_ZERO_WORDS.test(rest)) setAll(def.field, 0);
        break;
      }
      if (threePhase && nums.length >= 3) {
        ["A", "B", "C"].forEach((c, k) => { values[c][def.field] = nums[k]; });
        matched.push(def.field);
      } else {
        setAll(def.field, nums[0]);
      }
      break; // mỗi dòng 1 chỉ tiêu
    }
  });
  return { threePhase, values, matched };
}

/**
 * @param {string[]} lines dòng chữ của biên bản (ô của 1 hàng bảng nối bằng " | ")
 * @returns {{ threePhase:boolean, values:Object, matched:string[],         // phần THÙNG DẦU CHÍNH
 *   oltc: null | { threePhase:boolean, values:Object, matched:string[] }, // phần OLTC (nếu biên bản có)
 *   header:{ tram, thietBi, ngay, voltageClass, oilState, phase, hangSx, serial, loaiDau, ghiChu } }}
 */
function parseMbaOilBbtnLines(lines) {
  const raw = (lines || []).map((l) => String(l || "").normalize("NFC"));
  const folded = raw.map(mbaOilFold);

  // Chia phần: trước tiêu đề "OLTC" là thùng dầu chính (mặc định); dừng ở mục "Thiết bị thí nghiệm".
  const idx = { main: [], oltc: [] };
  let cur = "main";
  let sawOltc = false;
  folded.forEach((f, i) => {
    const sec = mbaOilSectionOf(f);
    if (sec) { cur = sec; if (sec === "oltc") sawOltc = true; return; }
    if (/^(thiet bi thi nghiem|testing instruments)/.test(f.trim())) cur = "none";
    if (cur !== "none") idx[cur].push(i);
  });
  const main = mbaOilParseSection(idx.main.map((i) => folded[i]));
  let oltc = null;
  if (sawOltc) {
    // MBA 3 pha: phần OLTC tách thành các bảng con "+ OLTC pha A", "+ OLTC pha B", "+ OLTC pha C" (mỗi bảng 1 cột)
    const sub = { A: [], B: [], C: [] };
    let curPh = null;
    const rest = [];
    idx.oltc.forEach((i) => {
      const ph = /^[\s+\-–•]*(?:(?:bo\s+)?oltc\s+)?pha\s*([abc])\s*:?\s*$/.exec(folded[i]);
      if (ph) { curPh = ph[1].toUpperCase(); return; }
      (curPh ? sub[curPh] : rest).push(folded[i]);
    });
    const phases = ["A", "B", "C"].filter((p) => sub[p].length);
    if (phases.length) {
      oltc = { threePhase: true, values: {}, matched: [], phases };
      phases.forEach((p) => {
        const r = mbaOilParseSection(sub[p]);
        oltc.values[p] = r.values.X || {};
        r.matched.forEach((f) => { if (!oltc.matched.includes(f)) oltc.matched.push(f); });
      });
    } else {
      oltc = mbaOilParseSection(rest);
    }
    if (!oltc.matched.length) oltc = null;
  }

  const header = { tram: "", thietBi: "", ngay: "", voltageClass: "", oilState: "", phase: "", hangSx: "", serial: "", loaiDau: "", ghiChu: "" };
  // Giá trị sau nhãn (lấy trên chuỗi GỐC có dấu; cắt ở ô kế tiếp " | ")
  const valueAfter = (i, m) => raw[i].slice(m.index + m[0].length).split(/\s*\|\s*/)[0].trim();
  const LBL = (words) => new RegExp(`(?:^|\\s|\\|)(?:${words})\\s*(?:\\([^)]*\\))?\\s*[:\\-–]\\s*`);
  for (let i = 0; i < folded.length; i++) {
    const f = folded[i];
    if (!header.ngay) header.ngay = mbaOilParseDate(f);
    let m;
    if (!header.tram && (m = LBL("ten du an\\s*\\/\\s*ten tram|ten tram|tram bien ap|tram").exec(f))) {
      const v = valueAfter(i, m);
      const tba = /(TBA|Trạm biến áp)\s.+$/i.exec(v);
      header.tram = (tba ? tba[0] : v).trim();
    }
    if (!header.thietBi && (m = LBL("vi tri lap dat|ten thiet bi|thiet bi").exec(f))) header.thietBi = valueAfter(i, m);
    if (!header.hangSx && (m = LBL("hang san xuat|nha san xuat").exec(f))) header.hangSx = valueAfter(i, m);
    if (!header.serial && (m = LBL("so che tao").exec(f))) header.serial = valueAfter(i, m);
    if (!header.loaiDau && (m = LBL("loai dau").exec(f))) header.loaiDau = valueAfter(i, m);
    if (!header.ghiChu && (m = LBL("ghi chu").exec(f))) header.ghiChu = valueAfter(i, m);
    // "Thân máy và bộ OLTC pha C" → MBA 1 pha, pha C. "van OLTC pha A,B,C" → cả 3 pha (không gán 1 pha).
    if (!header.phase && /vi tri lay mau/.test(f)) {
      const ph = /pha\s*([abc])\b(?!\s*(?:[,;&/]|va\b|and\b)\s*[abc]\b)/.exec(f);
      const multi = /pha\s*[abc]\s*(?:[,;&/]|va\b|and\b)\s*[abc]\b/.test(f);
      if (ph && !multi) header.phase = ph[1].toUpperCase();
    }
    // Điện áp định mức: lấy cấp CAO nhất ghi trên dòng — "500 kV", "(225/√3±8x1,25%)/115/√3/23 (kV)" → 225.
    if (!header.voltageClass && /(dien ap dinh muc|cap dien ap|rated voltage|\budm\b)/.test(f) && /kv/.test(f)) {
      const part = f.replace(/^.*?(dien ap dinh muc|cap dien ap|rated voltage|\budm\b)[^:]*:?/, "").split("|")[0];
      const nums = (part.match(/\d+(?:[.,]\d+)?/g) || []).map((s) => Number(s.replace(",", "."))).filter((n) => n >= 6 && n <= 800);
      if (nums.length) header.voltageClass = mbaOilVoltageClass(Math.max(...nums));
    }
    if (!header.oilState && /(ly do|muc dich|purpose)/.test(f)) {
      if (/(lap dat|lap moi|sau sua chua|nghiem thu|dau moi|truoc khi dong dien)/.test(f)) header.oilState = "new";
      else if (/(dinh ky|van hanh|bat thuong)/.test(f)) header.oilState = "inservice";
    }
  }
  return { threePhase: main.threePhase, values: main.values, matched: main.matched, oltc, header };
}

/** word/document.xml (DOCX) → dòng chữ: mỗi đoạn văn ngoài bảng 1 dòng; mỗi HÀNG bảng 1 dòng (các ô nối
 *  bằng " | ", các đoạn trong 1 ô nối bằng dấu cách). Không cần DOMParser (dùng được cả trong Node). */
function mbaOilDocxXmlToLines(xml) {
  const lines = [];
  const tblStack = []; // mỗi bảng đang mở: { cells: [], cell: [] | null }
  let para = null;
  let inText = false;
  const re = /<(\/?)w:(tbl|tr|tc|p|t|tab|br)(?=[\s>/])([^>]*?)(\/?)>|([^<]+)/g;
  const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  let m;
  while ((m = re.exec(String(xml || ""))) !== null) {
    if (m[5] !== undefined) { if (inText && para !== null) para += decode(m[5]); continue; }
    const closing = m[1] === "/";
    const tag = m[2];
    const selfClose = m[4] === "/";
    const top = tblStack[tblStack.length - 1];
    if (tag === "t") { inText = !closing && !selfClose; continue; }
    if (tag === "tab" || tag === "br") { if (para !== null) para += " "; continue; }
    if (tag === "p") {
      if (!closing && !selfClose) para = "";
      else if (closing) {
        const text = (para || "").replace(/\s+/g, " ").trim();
        if (top && top.cell) { if (text) top.cell.push(text); } else if (text) lines.push(text);
        para = null;
      }
      continue;
    }
    if (tag === "tbl") { if (!closing) tblStack.push({ cells: [], cell: null }); else tblStack.pop(); continue; }
    if (!top) continue;
    if (tag === "tr") {
      if (!closing) top.cells = [];
      else { const t = top.cells.filter(Boolean).join(" | ").trim(); if (t) lines.push(t); top.cells = []; }
      continue;
    }
    if (tag === "tc") {
      if (!closing) top.cell = [];
      else { top.cells.push((top.cell || []).join(" ")); top.cell = null; }
    }
  }
  return lines;
}

/** word/document.xml → HTML đơn giản (đoạn văn, bảng có gộp ô, đậm/nghiêng, căn giữa) để XEM ĐỐI CHIẾU file
 *  .docx ở khung bên cạnh form (trình duyệt không tự hiển thị được .docx trong iframe). Bỏ qua ảnh và
 *  khung chữ (text box). Chỉ dùng để xem, không dùng để đọc số liệu (đọc số liệu: mbaOilDocxXmlToLines). */
function mbaOilDocxXmlToHtml(xml) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const val = (attrs) => { const m = /w:val="([^"]*)"/.exec(attrs || ""); return m ? m[1] : null; };
  const re = /<(\/?)w:(tbl|tr|tc|p|r|t|tab|br|b|i|jc|gridSpan|vMerge|txbxContent)(?=[\s>/])([^>]*?)(\/?)>|([^<]+)/g;
  const out = [];
  const tables = []; // { rows: [[cell]], row: [cell] | null, cell: { span, vmerge, html: [] } | null }
  let para = null; // { align, html }
  let run = null; // { b, i }
  let inText = false;
  let txbx = 0;
  const renderTable = (t) => {
    // Gộp ô dọc (vMerge): ô "restart" nhận rowspan = số ô "continue" ngay dưới cùng cột lưới
    const grid = t.rows.map((cells) => { let col = 0; return cells.map((c) => { const at = col; col += c.span; return { ...c, col: at }; }); });
    grid.forEach((cells, ri) => cells.forEach((c) => {
      if (c.vmerge !== "restart") return;
      let n = 1;
      for (let k = ri + 1; k < grid.length; k++) {
        const below = grid[k].find((x) => x.col === c.col);
        if (!below || below.vmerge !== "continue") break;
        n++;
      }
      c.rowspan = n;
    }));
    return "<table>" + grid.map((cells) => "<tr>" + cells.filter((c) => c.vmerge !== "continue").map((c) =>
      `<td${c.span > 1 ? ` colspan="${c.span}"` : ""}${c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : ""}>${c.html.join("") || "&nbsp;"}</td>`).join("") + "</tr>").join("") + "</table>";
  };
  const emit = (html) => {
    const t = tables[tables.length - 1];
    if (t && t.cell) t.cell.html.push(html); else out.push(html);
  };
  let m;
  while ((m = re.exec(String(xml || ""))) !== null) {
    if (m[5] !== undefined) {
      if (!txbx && inText && para) {
        let s = esc(decode(m[5]));
        if (run && run.i) s = `<i>${s}</i>`;
        if (run && run.b) s = `<b>${s}</b>`;
        para.html += s;
      }
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2];
    const selfClose = m[4] === "/";
    if (tag === "txbxContent") { if (!selfClose) txbx += closing ? -1 : 1; continue; }
    if (txbx) continue;
    const top = tables[tables.length - 1];
    switch (tag) {
      case "t": inText = !closing && !selfClose; break;
      case "tab": if (para && !closing) para.html += "&emsp;"; break;
      case "br": if (para && !closing) para.html += "<br>"; break;
      case "r": run = closing || selfClose ? null : { b: false, i: false }; break;
      case "b": case "i": if (run && !closing) run[tag] = val(m[3]) !== "0" && val(m[3]) !== "false"; break;
      case "jc": if (para && !closing) para.align = val(m[3]); break;
      case "p":
        if (!closing && !selfClose) para = { align: null, html: "" };
        else {
          const p = para || { align: null, html: "" };
          const align = p.align === "center" ? "center" : p.align === "right" || p.align === "end" ? "right" : p.align === "both" ? "justify" : "";
          emit(`<p${align ? ` style="text-align:${align}"` : ""}>${p.html || "&nbsp;"}</p>`);
          para = null;
        }
        break;
      case "tbl":
        if (!closing) tables.push({ rows: [], row: null, cell: null });
        else { const t = tables.pop(); if (t) emit(renderTable(t)); }
        break;
      case "tr":
        if (!top) break;
        if (!closing) top.row = [];
        else { if (top.row) top.rows.push(top.row); top.row = null; }
        break;
      case "tc":
        if (!top) break;
        if (!closing) top.cell = { span: 1, vmerge: null, html: [] };
        else { if (top.row && top.cell) top.row.push(top.cell); top.cell = null; }
        break;
      case "gridSpan": if (top && top.cell) top.cell.span = Math.max(1, parseInt(val(m[3]), 10) || 1); break;
      case "vMerge": if (top && top.cell) top.cell.vmerge = val(m[3]) === "restart" ? "restart" : "continue"; break;
      default: break;
    }
  }
  return out.join("\n");
}

/** Bọc HTML thân thành trang hoàn chỉnh (kiểu dáng giống trang in BBTN) để hiện trong iframe. */
function mbaOilDocxHtmlPage(bodyHtml, title) {
  const t = String(title || "BBTN").replace(/[<>&"]/g, "");
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${t}</title><style>
body{font-family:"Times New Roman",Times,serif;font-size:13.5px;color:#111;margin:0;padding:18px 22px;background:#fff;}
p{margin:2px 0;line-height:1.35;}
table{border-collapse:collapse;width:100%;margin:6px 0 10px;}
td{border:1px solid #9ca3af;padding:3px 6px;vertical-align:top;}
td p{margin:0;}
.note{font-family:system-ui,sans-serif;font-size:11.5px;color:#64748b;border-bottom:1px dashed #cbd5e1;padding-bottom:6px;margin-bottom:10px;}
</style></head><body><p class="note">Bản xem nhanh nội dung file Word (bỏ qua hình ảnh, định dạng có thể khác bản gốc) — mở file gốc bằng Word nếu cần.</p>
${bodyHtml}</body></html>`;
}

const MbaOilBbtn = { parseMbaOilBbtnLines, mbaOilDocxXmlToLines, mbaOilDocxXmlToHtml, mbaOilDocxHtmlPage, mbaOilFold, mbaOilNumbers, mbaOilVoltageClass, LABELS: MBA_OIL_BBTN_LABELS };
if (typeof window !== "undefined") window.MbaOilBbtn = MbaOilBbtn;
if (typeof module !== "undefined" && module.exports) module.exports = MbaOilBbtn;
