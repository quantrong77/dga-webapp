/* mba-oil-bbtn.js — Đọc số liệu BBTN (biên bản thí nghiệm) DẦU MBA/KHÁNG từ danh sách dòng chữ của PDF
   (BbtnImport.readLines(), bbtn/bbtn-import.js) để TỰ ĐIỀN form tab "Lý-Hóa dầu" — dùng cho cả nhập biên bản
   MỚI lẫn nhập lại BBTN LỊCH SỬ (các năm trước) để theo dõi xu hướng.

   Không gắn với 1 mẫu biên bản cố định: dò từng dòng theo NHÃN chỉ tiêu (điện áp chọc thủng, tgδ, hàm lượng
   nước, trị số axit, chớp cháy, tạp chất, đếm hạt, điện trở suất, 2-FAL, màu sắc, IFT, PCB...) rồi lấy các số
   đứng SAU nhãn: 1 số → mẫu chung; ≥3 số trên biên bản có cột Pha A/B/C → 3 pha. Bỏ qua số của cột giới hạn
   (đứng sau ≤ ≥ < > max min "không lớn/nhỏ hơn") và số hiệu tiêu chuẩn (IEC/ASTM/ISO/TCVN/GOST xxxx).
   Người dùng LUÔN phải đối chiếu lại với biên bản trước khi lưu.

   Hàm thuần (không đụng DOM/mạng) để kiểm thử bằng Jest (tests/mba-oil-bbtn.test.js). */

function mbaOilFold(s) {
  return Array.from(String(s || "").normalize("NFC"), (ch) => {
    if (ch === "đ") return "d";
    if (ch === "Đ") return "D";
    const base = ch.normalize("NFD")[0];
    return base.length === ch.length ? base : ch;
  }).join("").toLowerCase();
}

// Thứ tự QUAN TRỌNG: nhãn cụ thể trước nhãn chung (VD "axit sau oxi hoa" trước "axit", "> 14 um" trước "> 6 um").
const MBA_OIL_BBTN_LABELS = [
  { field: "ox_sludge_percent", re: /(khoi luong )?can sau (o|oxy|oxi|o-xi|ô-xi)\s*hoa|sludge after oxidation/ },
  { field: "ox_acid_mgkoh", re: /(tri so |ham luong )?a\s*x\s*i\s*t sau (o|oxy|oxi|o-xi)\s*hoa|acid(ity)? after oxidation/ },
  { field: "ox_tgd", re: /(tg\s*\S?\s*|ton (that|hao) dien moi )sau (o|oxy|oxi|o-xi)\s*hoa|dissipation factor after oxidation/ },
  { field: "bdv_kv", re: /dien ap (choc|danh|danh) thung|breakdown voltage|\bbdv\b/ },
  { field: "tgd_90c_percent", re: /(tg\s*\S{0,2}|tan\s*delta|ton (hao|that) dien moi|dissipation factor|\bddf\b)[^0-9]{0,30}9\s*0\s*[°ºo⁰]?\s*c?/ },
  { field: "moisture_ppm", re: /ham luong (nuoc|am)|do am (trong )?dau|water content|moisture/ },
  { field: "acid_mgkoh", re: /(tri so|ham luong|chi so) a\s*x\s*i\s*t|acidity|neutrali[sz]ation value|acid (number|value)/ },
  { field: "flash_point_c", re: /(nhiet do )?chop chay|flash point/ },
  { field: "particles_14um", re: /(hat|particle)[^0-9]{0,40}>?\s*14\s*(μm|µm|um|micro)/ },
  { field: "particles_6um", re: /(hat|particle)[^0-9]{0,40}>?\s*6\s*(μm|µm|um|micro)/ },
  { field: "mech_impurity_percent", re: /(ham luong )?tap chat co hoc|mechanical impurit/ },
  { field: "resistivity_90c_e12", re: /dien tro suat|resistivity/ },
  { field: "furfural_ppm", re: /furfural|2\s*-?\s*fal\b|hop chat furan|furanic/ },
  { field: "color_iso2049", re: /mau sac|\bcolou?r\b/ },
  { field: "ift_mnm", re: /(suc|sut) cang be mat|interfacial tension|\bift\b/ },
  { field: "pcb_mgkg", re: /\bpcbs?\b/ },
  { field: "corrosive_sulfur", re: /luu huynh|sul(ph|f)ur/, kind: "sulfur" },
  { field: "appearance", re: /ngoai quan|appearance/, kind: "appearance" },
  { field: "sludge_percent", re: /\bbun\b|\bsludge\b/ },
  { field: "sediment_percent", re: /(ham luong )?\bcan\b(?! sau)|\bsediment\b/ },
  { field: "inhibitor_pct_original", re: /chat (uc che|chong o\s*x\s*i hoa)|inhibitor content/ },
  { field: "passivator_mgkg", re: /(chat )?thu dong|passivator/ },
];

/** Số trong 1 đoạn: "0,012", "1.5", "2,5x10^12" / "2,5.10^12" / "2.5E+12" (→ đổi về bội số ×10¹² nếu wantE12). */
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

/** Bỏ phần không phải KẾT QUẢ: số hiệu tiêu chuẩn, giới hạn (≤ 10, ≥ 55, max 0,1, không lớn hơn 20...),
 *  và đơn vị có chứa chữ số (mgKOH/1g, 10^12 đơn vị khi đứng sau "×10^12 Ω·cm" ở cột đơn vị). */
function mbaOilStripNonResults(text, field) {
  // Nhiệt độ đo ("ở 90°C", "at 20 °C") — trừ chính chỉ tiêu nhiệt độ chớp cháy (kết quả có thể là "146 °C").
  const t = field === "flash_point_c" ? String(text).replace(/(ở|tai|tại|at)\s*\d+\s*[°º⁰o]\s*c/gi, " ")
    : String(text).replace(/\d+\s*[°º⁰o]\s*c\b/gi, " ");
  return t
    .replace(/\b(iec|astm|iso|tcvn|gost|en|din|bs)\s*[a-z]?\s*\d+(?:[-:]\d+)*/gi, " ")
    .replace(/(≤|≥|<=|>=|<|>|\bmax\.?|\bmin\.?|khong (lon|nho|thap|cao) hon|khong qua|toi (da|thieu))\s*-?\d+(?:[.,]\d+)?(?:\s*[x×*.]\s*10\s*\^?\s*[+-]?\d+)?/gi, " ")
    .replace(/mg\s*koh\s*\/\s*1?\s*g/gi, " ")
    .replace(/\(\s*[x×]\s*10\s*\^?\s*\d+\s*[^)]*\)/gi, " ")
    .replace(/[Ωω]\s*[.·]?\s*cm/gi, " ");
}

function mbaOilParseDate(folded) {
  const m = /ngay\s*(lay mau|thi nghiem|thu nghiem)?[^0-9]{0,20}(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})/.exec(folded);
  return m ? `${m[4]}-${m[3].padStart(2, "0")}-${m[2].padStart(2, "0")}` : "";
}

/** Cấp điện áp (OIL_VOLTAGE_CLASSES) từ số kV đọc được. */
function mbaOilVoltageClass(kv) {
  if (!Number.isFinite(kv)) return "";
  if (kv >= 400) return "500";
  if (kv >= 200) return "220";
  if (kv >= 100) return "110";
  if (kv > 35) return "tren35duoi110";
  if (kv >= 15) return "15den35";
  return "duoi15";
}

/**
 * @param {string[]} lines dòng chữ của biên bản
 * @returns {{ threePhase:boolean, values:{X?:Object,A?:Object,B?:Object,C?:Object}, matched:string[],
 *   header:{ tram:string, thietBi:string, ngay:string, voltageClass:string, oilState:string } }}
 */
function parseMbaOilBbtnLines(lines) {
  const raw = (lines || []).map((l) => String(l || "").normalize("NFC"));
  const folded = raw.map(mbaOilFold);
  const threePhase = folded.some((l) => /pha\s*a\b.*pha\s*b\b.*pha\s*c\b/.test(l)) ||
    folded.some((l) => /(^|\s)a\s+b\s+c(\s|$)/.test(l) && /(pha|phase)/.test(l));
  const cols = threePhase ? ["A", "B", "C"] : ["X"];
  const values = {};
  cols.forEach((c) => { values[c] = {}; });
  const matched = [];

  folded.forEach((f, i) => {
    for (const def of MBA_OIL_BBTN_LABELS) {
      if (matched.includes(def.field)) continue;
      const m = def.re.exec(f);
      if (!m) continue;
      const after = raw[i].slice(m.index + m[0].length);
      const afterFolded = f.slice(m.index + m[0].length);
      if (def.kind === "sulfur") {
        const v = /khong an mon|non[-\s]?corrosive|khong co kha nang/.test(afterFolded) ? "khong"
          : /an mon|corrosive/.test(afterFolded) ? "co" : null;
        if (v) { cols.forEach((c) => { values[c][def.field] = v; }); matched.push(def.field); }
        break;
      }
      if (def.kind === "appearance") {
        const v = /trong|clear/.test(afterFolded) ? "trong" : /duc|turbid|dull|van/.test(afterFolded) ? "duc" : null;
        if (v) { cols.forEach((c) => { values[c][def.field] = v; }); matched.push(def.field); }
        break;
      }
      const nums = mbaOilNumbers(mbaOilStripNonResults(after, def.field), def.field === "resistivity_90c_e12");
      if (nums.length === 0) break;
      if (threePhase && nums.length >= 3) {
        ["A", "B", "C"].forEach((c, k) => { values[c][def.field] = nums[k]; });
      } else {
        cols.forEach((c) => { values[c][def.field] = nums[0]; });
      }
      matched.push(def.field);
      break; // mỗi dòng 1 chỉ tiêu
    }
  });

  // Quan sát tạp chất cơ học bằng mắt ("Không thấy") — đến 110 kV
  const mechLine = folded.find((l) => /tap chat co hoc/.test(l));
  if (mechLine && /khong (thay|phat hien)/.test(mechLine)) {
    cols.forEach((c) => { values[c].mech_visual = "khong"; });
    if (!matched.includes("mech_visual")) matched.push("mech_visual");
  }

  const header = { tram: "", thietBi: "", ngay: "", voltageClass: "", oilState: "" };
  for (let i = 0; i < folded.length; i++) {
    const f = folded[i];
    if (!header.ngay) header.ngay = mbaOilParseDate(f);
    if (!header.tram) {
      const m = /tram(?: bien ap)?(?: \d+\s*kv)?\s*[:\-–]\s*(.+)$/.exec(f);
      if (m) header.tram = raw[i].slice(raw[i].length - m[1].length).trim();
    }
    if (!header.thietBi) {
      const m = /(ten thiet bi|thiet bi|vi tri lap dat|ky hieu|may bien ap)\s*[:\-–]\s*(.+)$/.exec(f);
      if (m) header.thietBi = raw[i].slice(raw[i].length - m[2].length).trim();
    }
    if (!header.voltageClass && /(dien ap dinh muc|cap dien ap|udm|u dinh muc)/.test(f)) {
      const kv = /(\d{2,3})(?:[.,]\d+)?\s*(?:\/\s*\d+(?:[.,]\d+)?\s*)*kv/.exec(f);
      if (kv) header.voltageClass = mbaOilVoltageClass(Number(kv[1]));
    }
    if (!header.oilState && /(ly do|muc dich)/.test(f)) {
      if (/(lap dat|lap moi|sau sua chua|nghiem thu|dau moi)/.test(f)) header.oilState = "new";
      else if (/(dinh ky|van hanh|bat thuong)/.test(f)) header.oilState = "inservice";
    }
  }
  return { threePhase, values, matched, header };
}

const MbaOilBbtn = { parseMbaOilBbtnLines, mbaOilFold, mbaOilNumbers, mbaOilVoltageClass, LABELS: MBA_OIL_BBTN_LABELS };
if (typeof window !== "undefined") window.MbaOilBbtn = MbaOilBbtn;
if (typeof module !== "undefined" && module.exports) module.exports = MbaOilBbtn;
