/* dga-logic-regulation-config.js — Phần 6/6 của dga-logic.js sau khi tách theo miền
   (xem dga-logic.js). Đăng ký + đọc/ghi đè các bảng ngưỡng "đơn giản" có thể cấu hình
   qua tab "Cấu hình" — mục "Quy định" (ui/ui-regulation-config.js), KHÔNG bao gồm
   logic rẽ nhánh (Bảng 66/Table A.10/Tam giác Duval — cố định theo văn bản gốc). Mỗi
   mục registry giữ tham chiếu TRỰC TIẾP tới 1 object hằng số khai báo ở
   dga-logic-core.js — sửa qua applyRegulationConfigOverride() là ghi đè property của
   CHÍNH object đó, mọi hàm ở các module khác tự động thấy giá trị mới mà không cần
   sửa lại bản thân các hàm đó. */

// ---------------------------------------------------------------------------
// 9) Cấu hình quy định (regulation config) — làm các bảng ngưỡng ĐƠN GIẢN ở trên (không
//    có logic rẽ nhánh phức tạp) có thể XEM/SỬA qua giao diện (mục "Quy định" trong tab
//    "Cấu hình", xem ui/ui-regulation-config.js), để khi QĐ1901/IEC 60599 có bản cập nhật trong
//    tương lai, người dùng KHÔNG cần sửa code — chỉ cần sửa số + tham chiếu nguồn qua
//    giao diện. Từ 11/2026 gồm cả NGƯỠNG SỐ của các logic rẽ nhánh: Bảng 66/Table 1
//    (diagnoseRatios()), bảng PD/D/T, Table A.10 sứ xuyên (diagnoseBushingRatios()), ranh giới
//    Tam giác Duval (classifyDuval1() — Bảng 67), C2H2/H2 nhiễm khí OLTC, tỷ lệ bổ sung CO2/CO,
//    O2/N2 — chỉ CON SỐ sửa được, cấu trúc rẽ nhánh/dấu so sánh giữ đúng văn bản gốc. Không
//    đưa vào: các enum thuần key/nhãn (EQUIPMENT_TYPES/MBA_SUBTYPES/INSTRUMENT_SUBTYPES).
//
// CƠ CHẾ: mỗi bảng hằng số ở các mục 2/2bis/7bis/8 phía trên VẪN LÀ nguồn "mặc định"
// (khai báo bằng const, nhưng object literal nên PROPERTY của nó vẫn sửa được —
// applyRegulationConfigOverride() bên dưới ghi đè trực tiếp lên property của chính các
// object đó, KHÔNG tạo bản sao mới) — nghĩa là mọi hàm ở các mục trên (resolveStandard(),
// computeRateOfChange(), evaluateOltcOilTest()...) tự động dùng số liệu đã ghi đè mà
// KHÔNG cần sửa lại bản thân các hàm đó. _regulationConfigDefaults chụp lại giá trị gốc
// NGAY LÚC file này được nạp (TRƯỚC khi áp dụng bất kỳ override nào từ Google Sheets/
// Supabase/localStorage) để phục vụ nút "Khôi phục mặc định" ở giao diện.
// ---------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/** Ghi đè property của target theo source — CHỈ đệ quy khi CẢ 2 phía đều là object
 *  thuần (không phải mảng/null); còn lại (kể cả khi target đang là null, ví dụ
 *  BANG49_OLTC.pharieng.tren35duoi110 — QĐ1901 hiện chưa có số liệu) thì GÁN THẲNG giá
 *  trị từ source — cho phép người dùng "điền vào chỗ trống" khi quy định có số liệu mới
 *  mà không cần sửa code. Bỏ qua key nào source không có (giữ nguyên mặc định/override cũ). */
function deepMergeInto(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return;
  Object.keys(source).forEach((k) => {
    if (source[k] === undefined) return;
    if (isPlainObject(source[k]) && isPlainObject(target[k])) {
      deepMergeInto(target[k], source[k]);
    } else {
      target[k] = deepClone(source[k]);
    }
  });
}

/** Đọc giá trị tại 1 "đường dẫn" (mảng key) trong object lồng nhau — trả về undefined
 *  an toàn nếu đi qua null/undefined giữa đường (vd tren35duoi110 hiện đang là null). */
function getValueAtPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Ghi giá trị tại 1 "đường dẫn" vào object — TỰ TẠO object rỗng ở các cấp trung gian
 *  còn thiếu (kể cả khi cấp đó hiện là null), dùng để build lại object override đầy đủ
 *  từ giá trị các ô nhập trên form (xem ui/ui-regulation-config.js). */
function setValueAtPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!isPlainObject(cur[key])) cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
}

function gasMapFields(unit) {
  return GASES.map((g) => ({ path: [g], label: g, unit, kind: "number" }));
}

function gasRangeFields(unit) {
  return GASES.map((g) => ({ path: [g], label: g, unit, kind: "range" }));
}

const OIL_STATE_LABELS = { new: "Mới/sau lắp đặt/sau sửa chữa", inservice: "Đang vận hành" };

function voltageStateFields(unit) {
  const fields = [];
  OIL_VOLTAGE_CLASSES.forEach((vc) => {
    ["new", "inservice"].forEach((state) => {
      fields.push({ path: [vc.value, state], label: `${vc.label} — ${OIL_STATE_LABELS[state]}`, unit, kind: "number" });
    });
  });
  return fields;
}

// ---------------------------------------------------------------------------
// 10) TÊN VĂN BẢN / ĐIỀU KHOẢN / BẢNG / PHỤ LỤC hiển thị — cấu hình được để khi quy định hoặc
//     tiêu chuẩn thay đổi (QĐ mới thay QĐ1901, IEC 60599 bản mới, đánh số lại điều/bảng...) Admin
//     cập nhật 1 lần, mọi nơi hiển thị đổi theo — KHÔNG phải sửa hàng trăm câu chữ trong code.
//
//     Cơ chế: applyRegulationTerms(text) thay các cụm MẶC ĐỊNH (VD "Bảng 66") bằng giá trị đang
//     cấu hình (VD "Bảng 70"), 1 lượt duy nhất, khớp đúng ranh giới từ ("Bảng 6" không ăn vào
//     "Bảng 66"). Chỉ áp dụng các mục ĐÃ ĐỔI khác mặc định -> chưa đổi gì thì văn bản giữ nguyên.
//     Áp dụng ở: giao diện (ui/ui-terms.js quét toàn trang + nội dung sinh động), file Word xuất ra.
// ---------------------------------------------------------------------------
const REGULATION_TERMS_DOCS = {
  QD_FULL: "QĐ1901/QĐ-EVNNPT",
  QD_SHORT: "QĐ1901",
  IEC60599_NAME: "IEC 60599",
  IEC60599_YEAR: "2022",
  IEC60422_NAME: "IEC 60422",
  IEC60422_YEAR: "2024",
  IEEE_C57104: "IEEE C57.104",
  QD_SAMPLING: "3856/QĐ-PTC3",
};

const REGULATION_TERMS_QD_ARTICLE_NUMS = [3, 6, 7, 10, 11, 37, 46, 47, 50, 54];
const REGULATION_TERMS_QD_TABLE_NUMS = [12, 49, 54, 55, 58, 63, 64, 65, 66, 67, 68, 69];
const REGULATION_TERMS_QD = {};
REGULATION_TERMS_QD_ARTICLE_NUMS.forEach((n) => { REGULATION_TERMS_QD["D" + n] = "Điều " + n; });
REGULATION_TERMS_QD_TABLE_NUMS.forEach((n) => { REGULATION_TERMS_QD["B" + n] = "Bảng " + n; });

const REGULATION_TERMS_IEC_DEFS = [
  ["T1", "Table 1", "IEC 60599 — Bảng diễn giải 3 tỷ số khí (= Bảng 66)"],
  ["T2", "Table 2", "IEC 60599 — Bảng đơn giản PD/D/T"],
  ["TA2", "Table A.2", "IEC 60599 — Khoảng điển hình MBA lực"],
  ["TA7", "Table A.7", "IEC 60599 — Khoảng điển hình CT/VT"],
  ["TA8", "Table A.8", "IEC 60599 — Giá trị tối đa máy biến áp đo lường"],
  ["TA10", "Table A.10", "IEC 60599 — Chẩn đoán sứ xuyên"],
  ["TA11", "Table A.11", "IEC 60599 — Khoảng điển hình sứ xuyên"],
  ["ANNEX_A", "Annex A", "IEC 60599 — Phụ lục A"],
  ["ANNEX_B", "Annex B", "IEC 60599 — Phụ lục B (Tam giác Duval)"],
  ["FIG_B3", "Figure B.3", "IEC 60599 — Hình Tam giác Duval 1"],
  ["FIG_1", "Hình 1", "IEC 60599 — Lưu đồ đánh giá (mục 9)"],
  ["T60422_5", "Bảng 5", "IEC 60422 — Dầu MBA/Kháng vận hành"],
  ["T60422_7", "Bảng 7", "IEC 60422 — Dầu TI/TU vận hành"],
];
const REGULATION_TERMS_IEC = {};
REGULATION_TERMS_IEC_DEFS.forEach(([k, v]) => { REGULATION_TERMS_IEC[k] = v; });

function termsEscapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
}

/** Danh sách luật thay thế: { pats: [cụm mặc định...], out: giá trị hiện hành, def: giá trị mặc định }. */
function regulationTermRules() {
  const D = REGULATION_TERMS_DOCS, Q = REGULATION_TERMS_QD, I = REGULATION_TERMS_IEC;
  const d0 = _regulationConfigDefaults.TERMS_DOCS.values;
  const rules = [
    { pats: ["QĐ1901/QĐ-EVNNPT", "QĐ 1901/QĐ-EVNNPT"], out: D.QD_FULL, def: d0.QD_FULL },
    { pats: ["QĐ1901", "QĐ 1901"], out: D.QD_SHORT, def: d0.QD_SHORT },
    { pats: [`IEC 60599:${d0.IEC60599_YEAR}`, `IEC60599:${d0.IEC60599_YEAR}`, `IEC 60599-${d0.IEC60599_YEAR}`, `IEC60599-${d0.IEC60599_YEAR}`],
      out: `${D.IEC60599_NAME}:${D.IEC60599_YEAR}`, def: `${d0.IEC60599_NAME}:${d0.IEC60599_YEAR}` },
    { pats: ["IEC 60599", "IEC60599"], out: D.IEC60599_NAME, def: d0.IEC60599_NAME },
    { pats: [`IEC 60422:${d0.IEC60422_YEAR}`, `IEC60422:${d0.IEC60422_YEAR}`],
      out: `${D.IEC60422_NAME}:${D.IEC60422_YEAR}`, def: `${d0.IEC60422_NAME}:${d0.IEC60422_YEAR}` },
    { pats: ["IEC 60422", "IEC60422"], out: D.IEC60422_NAME, def: d0.IEC60422_NAME },
    { pats: ["IEEE C57.104"], out: D.IEEE_C57104, def: d0.IEEE_C57104 },
    { pats: ["3856/QĐ-PTC3"], out: D.QD_SAMPLING, def: d0.QD_SAMPLING },
  ];
  const q0 = _regulationConfigDefaults.TERMS_QD_ARTICLES.values;
  Object.keys(q0).forEach((k) => rules.push({ pats: [q0[k]], out: Q[k], def: q0[k] }));
  const i0 = _regulationConfigDefaults.TERMS_IEC.values;
  Object.keys(i0).forEach((k) => rules.push({ pats: [i0[k]], out: I[k], def: i0[k] }));
  return rules;
}

let _termsCache = { sig: null, re: null, map: null };

/** Biên dịch (và lưu đệm) regex cho các luật ĐANG ĐỔI khác mặc định; null nếu không có gì đổi. */
function compiledRegulationTerms() {
  const active = regulationTermRules().filter((r) => typeof r.out === "string" && r.out.trim() !== "" && r.out !== r.def);
  const sig = JSON.stringify(active.map((r) => [r.pats, r.out]));
  if (_termsCache.sig === sig) return _termsCache;
  if (active.length === 0) {
    _termsCache = { sig, re: null, map: null };
    return _termsCache;
  }
  const entries = [];
  active.forEach((r) => r.pats.forEach((p) => entries.push({ p, out: r.out, test: new RegExp("^" + termsEscapeRe(p) + "$", "u") })));
  entries.sort((a, b) => b.p.length - a.p.length); // cụm dài khớp trước (VD "IEC 60599:2022" trước "IEC 60599")
  const tail = (p) => (/[\p{L}]$/u.test(p) ? "(?![\\p{L}\\p{N}])" : "(?!\\p{N})");
  const body = entries.map((e) => "(?<![\\p{L}\\p{N}])" + termsEscapeRe(e.p) + tail(e.p)).join("|");
  _termsCache = { sig, re: new RegExp(body, "gu"), map: entries };
  return _termsCache;
}

/** Thay tên văn bản/điều/bảng mặc định bằng giá trị Admin đã cấu hình. Không đổi gì -> trả nguyên văn. */
function applyRegulationTerms(text) {
  if (typeof text !== "string" || text === "") return text;
  const c = compiledRegulationTerms();
  if (!c.re) return text;
  return text.replace(c.re, (m) => {
    const e = c.map.find((x) => x.test.test(m));
    return e ? e.out : m;
  });
}

/** Có tên nào đang được đổi khác mặc định không (để giao diện bỏ qua việc quét khi không cần). */
function regulationTermsActive() {
  return !!compiledRegulationTerms().re;
}

/**
 * Đăng ký toàn bộ các bảng ngưỡng "đơn giản" có thể cấu hình qua tab "Cấu hình quy
 * định". Mỗi mục:
 *  - key: định danh DUY NHẤT, dùng làm "id" khi lưu xuống Google Sheets/Supabase/
 *    localStorage (xem storage.js: listRegulationConfig/saveRegulationConfig).
 *  - category: PHÂN LOẠI áp dụng — hiển thị để nhóm các bảng theo loại thiết bị/bối
 *    cảnh, đúng yêu cầu "có phân loại áp dụng trong giao diện cấu hình".
 *  - title: tên bảng hiển thị.
 *  - citationKey: key trong REGULATION_CITATIONS — chuỗi tham chiếu nguồn, CÓ THỂ SỬA.
 *  - target: tham chiếu TRỰC TIẾP tới object hằng số tương ứng ở các mục trên — sửa
 *    property của target = mọi nơi dùng hằng số đó tự động thấy giá trị mới.
 *  - fields: danh sách trường có thể sửa (path/label/unit/kind) — dùng để tự render
 *    form + đọc/ghi giá trị (generic, không cần code UI riêng cho từng bảng).
 */
function buildRegulationConfigRegistry() {
  return [
    {
      key: "BANG64_MBA", category: "MBA/Kháng dầu — Khí hòa tan (ngưỡng, phối hợp cùng IEC Annex A.2)",
      title: "QĐ1901 Bảng 64 — Cận trên khoảng giá trị điển hình khí hòa tan (MBA)",
      citationKey: "BANG64_MBA", target: QD1901_BANG64_MBA, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A2", category: "MBA/Kháng dầu — Khí hòa tan (ngưỡng, phối hợp cùng QĐ1901 Bảng 64)",
      title: "IEC 60599:2022 Annex A.2.4 Table A.2 — Khoảng giá trị điển hình 90% (MBA lực), theo loại OLTC",
      citationKey: "IEC_A2", target: IEC_A2_POWER_TRANSFORMER,
      fields: [MBA_SUBTYPES.NO_OLTC, MBA_SUBTYPES.COMM_OLTC].flatMap((subtype) =>
        GASES.map((g) => ({ path: [subtype, g], label: `${subtype.replace(/CPC/g, "OLTC")} — ${g}`, unit: "ppm", kind: "number" }))
      ),
    },
    {
      key: "BANG12_TI", category: "TI/TU — Khí hòa tan (giá trị tối đa cho phép)",
      title: "QĐ1901 Bảng 12 — Giá trị hàm lượng khí hòa tan cực đại (TI kiểu kín)",
      citationKey: "BANG12_TI", target: QD1901_BANG12_TI, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A8", category: "TI/TU — Khí hòa tan (giá trị tối đa cho phép)",
      title: "IEC 60599:2022 Annex A.4.4 Table A.8 — Giá trị tối đa cho phép (máy biến áp đo lường kiểu kín)",
      citationKey: "IEC_A8", target: IEC_A8_INSTRUMENT_MAX, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A7", category: "TI/TU — Khí hòa tan (khoảng điển hình tham khảo, CT/VT)",
      title: "IEC 60599:2022 Annex A.4.4 Table A.7 — Khoảng giá trị điển hình 90%, theo CT/VT",
      citationKey: "IEC_A7", target: IEC_A7_INSTRUMENT_TYPICAL,
      fields: [INSTRUMENT_SUBTYPES.CT, INSTRUMENT_SUBTYPES.VT].flatMap((subtype) =>
        GASES.map((g) => ({ path: [subtype, g], label: `${subtype} — ${g}`, unit: "ppm", kind: "number" }))
      ),
    },
    {
      key: "IEC_A11_BUSHING", category: "Sứ xuyên (Bushing) — Khí hòa tan (khoảng điển hình = ngưỡng áp dụng)",
      title: "IEC 60599:2022 Annex A.5.4 Table A.11 — Khoảng giá trị điển hình 90% (sứ xuyên)",
      citationKey: "IEC_A11_BUSHING", target: IEC_A11_BUSHING, fields: gasMapFields("ppm"),
    },
    {
      key: "BANG65_RATE", category: "MBA/Kháng dầu — Tốc độ tăng hàm lượng khí",
      title: "QĐ1901 Bảng 65 — Khoảng tốc độ tăng hàm lượng khí điển hình (ppm/năm)",
      citationKey: "BANG65_RATE", target: QD1901_BANG65_RATE, fields: gasRangeFields("ppm/năm"),
    },
    {
      key: "PD_THRESHOLD", category: "Ngưỡng tỷ lệ CH4/H2 cho mã PD (theo loại thiết bị) — dùng chung cho Bảng 66/Table A.10",
      title: "Ngưỡng CH4/H2 xác định mã Phóng điện cục bộ (PD), theo loại thiết bị",
      citationKey: "PD_THRESHOLD", target: PD_THRESHOLD_BY_TYPE,
      fields: Object.values(EQUIPMENT_TYPES).map((t) => ({ path: [t], label: t, unit: "", kind: "number" })),
    },
    {
      key: "BANG64_MBA_LOW", category: "MBA/Kháng dầu — Khí hòa tan (khoảng điển hình, lưu đồ Điều 54)",
      title: "QĐ1901 Bảng 64 — Cận DƯỚI khoảng giá trị điển hình (MBA): tất cả khí thấp hơn -> kiểm tra lỗi lấy mẫu/đo lường/xử lý dầu",
      citationKey: "BANG64_MBA_LOW", target: QD1901_BANG64_MBA_LOW, fields: gasMapFields("ppm"),
    },
    {
      key: "BANG66_TABLE1", category: "Chẩn đoán tỷ số khí — Bảng 66 (= Table 1 IEC 60599)",
      title: "QĐ1901 Bảng 66 / IEC 60599 Table 1 — Ngưỡng 3 tỷ số khí xác định mã PD, D1, D2, T1, T2, T3 (ngưỡng CH4/H2 của PD: xem bảng \"Ngưỡng CH4/H2 ... PD\")",
      citationKey: "BANG66_TABLE1", target: QD1901_BANG66_TABLE1,
      fields: [
        { path: ["PD", "i_max"], label: "PD — C2H4/C2H6 nhỏ hơn", unit: "", kind: "number" },
        { path: ["D1", "g_min"], label: "D1 — C2H2/C2H4 lớn hơn", unit: "", kind: "number" },
        { path: ["D1", "h_min"], label: "D1 — CH4/H2 từ", unit: "", kind: "number" },
        { path: ["D1", "h_max"], label: "D1 — CH4/H2 đến", unit: "", kind: "number" },
        { path: ["D1", "i_min"], label: "D1 — C2H4/C2H6 lớn hơn", unit: "", kind: "number" },
        { path: ["D2", "g_min"], label: "D2 — C2H2/C2H4 từ", unit: "", kind: "number" },
        { path: ["D2", "g_max"], label: "D2 — C2H2/C2H4 đến", unit: "", kind: "number" },
        { path: ["D2", "h_min"], label: "D2 — CH4/H2 từ", unit: "", kind: "number" },
        { path: ["D2", "h_max"], label: "D2 — CH4/H2 đến", unit: "", kind: "number" },
        { path: ["D2", "i_min"], label: "D2 — C2H4/C2H6 lớn hơn", unit: "", kind: "number" },
        { path: ["T1", "h_min"], label: "T1 — CH4/H2 lớn hơn", unit: "", kind: "number" },
        { path: ["T1", "i_max"], label: "T1 — C2H4/C2H6 nhỏ hơn", unit: "", kind: "number" },
        { path: ["T2", "g_max"], label: "T2 — C2H2/C2H4 nhỏ hơn", unit: "", kind: "number" },
        { path: ["T2", "h_min"], label: "T2 — CH4/H2 lớn hơn", unit: "", kind: "number" },
        { path: ["T2", "i_min"], label: "T2 — C2H4/C2H6 từ", unit: "", kind: "number" },
        { path: ["T2", "i_max"], label: "T2 — C2H4/C2H6 đến", unit: "", kind: "number" },
        { path: ["T3", "g_max"], label: "T3 — C2H2/C2H4 nhỏ hơn", unit: "", kind: "number" },
        { path: ["T3", "h_min"], label: "T3 — CH4/H2 lớn hơn", unit: "", kind: "number" },
        { path: ["T3", "i_min"], label: "T3 — C2H4/C2H6 lớn hơn", unit: "", kind: "number" },
      ],
    },
    {
      key: "BANG66_PDT", category: "Chẩn đoán tỷ số khí — Bảng 66 (= Table 1 IEC 60599)",
      title: "QĐ1901 Điều 54 — Bảng đơn giản PD / D / T (khi tỷ số không nằm trong giới hạn Bảng 66)",
      citationKey: "BANG66_PDT", target: QD1901_BANG66_PDT,
      fields: [
        { path: ["pd_h_max"], label: "PD — CH4/H2 nhỏ hơn", unit: "", kind: "number" },
        { path: ["dt_g"], label: "Ranh giới D / T — C2H2/C2H4 (lớn hơn: D, nhỏ hơn: T)", unit: "", kind: "number" },
      ],
    },
    {
      key: "IEC_A10_BUSHING", category: "Sứ xuyên (Bushing) — Chẩn đoán tỷ số khí",
      title: "IEC 60599:2022 Annex A.5.3 Table A.10 — Ngưỡng tỷ số khí chẩn đoán sứ xuyên",
      citationKey: "IEC_A10_BUSHING", target: IEC_A10_BUSHING_RATIOS,
      fields: [
        { path: ["pd_h_max"], label: "PD — CH4/H2 nhỏ hơn", unit: "", kind: "number" },
        { path: ["d_g_min"], label: "D — C2H2/C2H4 lớn hơn", unit: "", kind: "number" },
        { path: ["t_i_min"], label: "T — C2H4/C2H6 lớn hơn", unit: "", kind: "number" },
        { path: ["tp_low"], label: "TP — CO2/CO nhỏ hơn", unit: "", kind: "number" },
        { path: ["tp_high"], label: "TP — hoặc CO2/CO lớn hơn", unit: "", kind: "number" },
      ],
    },
    {
      key: "BANG67_DUVAL", category: "Chẩn đoán — Tam giác Duval 1 (Bảng 67)",
      title: "QĐ1901 Bảng 67 — Giới hạn các vùng lỗi Tam giác Duval 1 (% trên tổng CH4 + C2H4 + C2H2)",
      citationKey: "BANG67_DUVAL", target: QD1901_BANG67_DUVAL,
      fields: [
        { path: ["pd_ch4"], label: "PD — %CH4 từ", unit: "%", kind: "number" },
        { path: ["t_c2h2"], label: "T1, T2 — %C2H2 không quá", unit: "%", kind: "number" },
        { path: ["t1_c2h4"], label: "T1 / T2 — ranh giới %C2H4", unit: "%", kind: "number" },
        { path: ["t2_c2h4"], label: "T2 / T3 — ranh giới %C2H4", unit: "%", kind: "number" },
        { path: ["t3_c2h2"], label: "T3 — %C2H2 không quá", unit: "%", kind: "number" },
        { path: ["d_c2h2"], label: "D1, D2 — %C2H2 từ", unit: "%", kind: "number" },
        { path: ["d1_c2h4"], label: "D1 / D2 — ranh giới %C2H4", unit: "%", kind: "number" },
        { path: ["d2_c2h4"], label: "D2 / D+T — ranh giới %C2H4", unit: "%", kind: "number" },
        { path: ["d2_c2h2"], label: "D2 / D+T — ranh giới %C2H2", unit: "%", kind: "number" },
      ],
    },
    {
      key: "DIEU54_OLTC", category: "MBA/Kháng dầu — Kiểm tra nhiễm khí từ OLTC (lưu đồ Điều 54)",
      title: "QĐ1901 Điều 54 — Tỷ lệ C2H2/H2 nghi nhiễm khí từ OLTC (văn bản: \"> 2 - 3\")",
      citationKey: "DIEU54_OLTC", target: DIEU54_OLTC_C2H2_H2,
      fields: [
        { path: ["possible"], label: "C2H2/H2 lớn hơn — có thể nhiễm khí OLTC", unit: "", kind: "number" },
        { path: ["likely"], label: "C2H2/H2 lớn hơn — nghi ngờ rõ nhiễm khí OLTC", unit: "", kind: "number" },
      ],
    },
    {
      key: "DIEU54_ADDITIONAL", category: "Đánh giá các tỷ lệ bổ sung (Điều 54) — áp dụng cho mọi dầu",
      title: "QĐ1901 Điều 54 — Ngưỡng tỷ lệ bổ sung CO2/CO và O2/N2",
      citationKey: "DIEU54_ADDITIONAL", target: DIEU54_ADDITIONAL_RATIOS,
      fields: [
        { path: ["co2co_low"], label: "Carbon hóa giấy — CO2/CO nhỏ hơn", unit: "", kind: "number" },
        { path: ["co_min"], label: "Carbon hóa giấy — và CO lớn hơn", unit: "ppm", kind: "number" },
        { path: ["co2co_high"], label: "Quá nhiệt nhẹ / oxy hóa dầu — CO2/CO lớn hơn", unit: "", kind: "number" },
        { path: ["co2_min"], label: "Quá nhiệt nhẹ / oxy hóa dầu — và CO2 lớn hơn", unit: "ppm", kind: "number" },
        { path: ["o2n2_low"], label: "Tiêu thụ oxy quá mức — O2/N2 nhỏ hơn", unit: "", kind: "number" },
        { path: ["o2n2_normal"], label: "Mốc tham khảo bình thường — O2/N2 khoảng", unit: "", kind: "number" },
      ],
    },
    {
      key: "BANG63_TDGC", category: "MBA/Kháng dầu — Tổng hàm lượng khí hòa tan (dầu mới/sau xử lý)",
      title: "QĐ1901 Bảng 63 — Ngưỡng tổng hàm lượng khí hòa tan (%)",
      citationKey: "BANG63_TDGC", target: QD1901_BANG63_TDGC,
      fields: [
        { path: ["110-220"], label: "Cấp điện áp 110–220 kV", unit: "%", kind: "number" },
        { path: ["500"], label: "Cấp điện áp 500 kV", unit: "%", kind: "number" },
      ],
    },
    {
      key: "BANG54_BDV", category: "Dầu MBA — Điện áp chọc thủng",
      title: "QĐ1901 Bảng 54 — Điện áp chọc thủng dầu (kV, khe hở 2,5mm), không thấp hơn",
      citationKey: "BANG54_BDV", target: BANG54_BDV, fields: voltageStateFields("kV"),
    },
    {
      key: "BANG55_TGD90", category: "Dầu MBA — Tổn hao điện môi tgδ ở 90°C",
      title: "QĐ1901 Bảng 55 — Tổn hao điện môi tgδ dầu ở 90°C (%), không lớn hơn",
      citationKey: "BANG55_TGD90", target: BANG55_TGD90, fields: voltageStateFields("%"),
    },
    {
      key: "BANG58_WATER", category: "Dầu MBA — Hàm lượng nước",
      title: "QĐ1901 Bảng 58 — Hàm lượng nước trong dầu (ppm), không lớn hơn",
      citationKey: "BANG58_WATER", target: BANG58_WATER,
      fields: [
        { path: ["den110_comMangN2", "new"], label: "≤110kV, có màng/N2 — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["den110_comMangN2", "inservice"], label: "≤110kV, có màng/N2 — Đang vận hành", unit: "ppm", kind: "number" },
        { path: ["den110_khongMangN2", "new"], label: "≤110kV, không có màng/N2 — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["den110_khongMangN2", "inservice"], label: "≤110kV, không có màng/N2 — Đang vận hành", unit: "ppm", kind: "number" },
        { path: ["tren110", "new"], label: "220kV/500kV — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["tren110", "inservice"], label: "220kV/500kV — Đang vận hành", unit: "ppm", kind: "number" },
      ],
    },
    {
      key: "BANG49_OLTC", category: "Dầu OLTC (đang vận hành) — Độ ẩm & điện áp chọc thủng",
      title: "QĐ1901 Bảng 49 — Ngưỡng dầu khoang điều áp dưới tải (OLTC) khi đang vận hành",
      citationKey: "BANG49_OLTC", target: BANG49_OLTC,
      fields: [
        { path: ["trungtinh", "bdv"], label: "Điểm cuối trung tính — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["trungtinh", "moisture"], label: "Điểm cuối trung tính — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "duoi15", "bdv"], label: "Một pha/không trung tính, <15kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "duoi15", "moisture"], label: "Một pha/không trung tính, <15kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "15den35", "bdv"], label: "Một pha/không trung tính, 15–35kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "15den35", "moisture"], label: "Một pha/không trung tính, 15–35kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "tren35duoi110", "bdv"], label: "Một pha/không trung tính, >35–<110kV — Điện áp chọc thủng (QĐ1901 hiện chưa có số liệu)", unit: "kV", kind: "number" },
        { path: ["pharieng", "tren35duoi110", "moisture"], label: "Một pha/không trung tính, >35–<110kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "110", "bdv"], label: "Một pha/không trung tính, 110kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "110", "moisture"], label: "Một pha/không trung tính, 110kV — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "220", "bdv"], label: "Một pha/không trung tính, 220kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "220", "moisture"], label: "Một pha/không trung tính, 220kV — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "500", "bdv"], label: "Một pha/không trung tính, 500kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "500", "moisture"], label: "Một pha/không trung tính, 500kV — Hàm lượng nước", unit: "ppm", kind: "number" },
      ],
    },
    {
      key: "IEC60422_2024_TABLE5_MBA", category: "Dầu MBA/Kháng — IEC 60422:2024 (tham khảo, song song QĐ1901)",
      title: "IEC 60422:2024 Bảng 5 — Ngưỡng Tốt/Kém dầu MBA/Kháng vận hành, theo Category A/B/C",
      citationKey: "IEC60422_2024_TABLE5_MBA", target: IEC60422_2024_TABLE5_MBA,
      fields: ["A", "B", "C"].flatMap((cat) => [
        { path: [cat, "bdv", "good"], label: `Category ${cat} — Điện áp chọc thủng, biên "Tốt" (≥)`, unit: "kV", kind: "number" },
        { path: [cat, "bdv", "poor"], label: `Category ${cat} — Điện áp chọc thủng, biên "Kém" (<)`, unit: "kV", kind: "number" },
        { path: [cat, "moisture", "good"], label: `Category ${cat} — Độ ẩm dầu, biên "Tốt" (≤)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "moisture", "poor"], label: `Category ${cat} — Độ ẩm dầu, biên "Kém" (>)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "tgd90", "good"], label: `Category ${cat} — tgδ 90°C, biên "Tốt" (≤)`, unit: "%", kind: "number" },
        { path: [cat, "tgd90", "poor"], label: `Category ${cat} — tgδ 90°C, biên "Kém" (>)`, unit: "%", kind: "number" },
      ]),
    },
    {
      key: "IEC60422_2024_TABLE7_TITU", category: "Dầu TI/TU — IEC 60422:2024 (tham khảo, song song tiêu chuẩn NSX)",
      title: "IEC 60422:2024 Bảng 7 — Ngưỡng Tốt/Kém dầu TI/TU vận hành, theo Category D/E (Độ ẩm, tgδ 90°C — số liệu tường minh)",
      citationKey: "IEC60422_2024_TABLE7_TITU", target: IEC60422_2024_TABLE7_TITU,
      fields: ["D", "E"].flatMap((cat) => [
        { path: [cat, "moisture", "good"], label: `Category ${cat} — Độ ẩm dầu, biên "Tốt" (≤)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "moisture", "poor"], label: `Category ${cat} — Độ ẩm dầu, biên "Kém" (>)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "tgd90", "good"], label: `Category ${cat} — tgδ 90°C, biên "Tốt" (≤)`, unit: "%", kind: "number" },
        { path: [cat, "tgd90", "poor"], label: `Category ${cat} — tgδ 90°C, biên "Kém" (>)`, unit: "%", kind: "number" },
      ]),
    },
    // ---- Chỉ tiêu lý-hóa dầu MBA bổ sung (dga-logic-oil-extended.js) ----
    {
      key: "BANG59_ACID", category: "Dầu MBA — Trị số axit",
      title: "QĐ1901 Bảng 59 — Trị số axit của dầu MBA (mgKOH/g), không lớn hơn",
      citationKey: "BANG59_ACID", target: BANG59_ACID,
      fields: [
        { path: ["new"], label: "Dầu mới — mọi cấp điện áp", unit: "mgKOH/g", kind: "number" },
        ...OIL_VOLTAGE_CLASSES.map((vc) => ({ path: ["inservice", vc.value], label: `${vc.label} — Đang vận hành`, unit: "mgKOH/g", kind: "number" })),
      ],
    },
    {
      key: "DIEU51_FLASH", category: "Dầu MBA — Nhiệt độ chớp cháy",
      title: "QĐ1901 Điều 51 — Nhiệt độ chớp cháy cốc kín (°C)",
      citationKey: "DIEU51_FLASH", target: DIEU51_FLASH,
      fields: [
        { path: ["new_min"], label: "Dầu mới — không thấp hơn", unit: "°C", kind: "number" },
        { path: ["max_drop"], label: "Dầu vận hành — mức giảm tối đa so với lần thí nghiệm trước", unit: "°C", kind: "number" },
      ],
    },
    {
      key: "BANG56_MECH", category: "Dầu MBA — Tạp chất cơ học",
      title: "QĐ1901 Bảng 56 — Hàm lượng tạp chất cơ học (%), không lớn hơn (đến 110 kV: quan sát bằng mắt)",
      citationKey: "BANG56_MECH", target: BANG56_MECH,
      fields: ["220", "500"].flatMap((vc) => ["new", "inservice"].map((st) => ({ path: [vc, st], label: `${vc} kV — ${OIL_STATE_LABELS[st]}`, unit: "%", kind: "number" }))),
    },
    {
      key: "BANG57_PARTICLES", category: "Dầu MBA — Đếm hạt tạp chất",
      title: "QĐ1901 Bảng 57 — Số lượng hạt tạp chất trong 1 ml dầu, không lớn hơn",
      citationKey: "BANG57_PARTICLES", target: BANG57_PARTICLES,
      fields: ["220", "500"].flatMap((vc) => [["p6", "> 6 μm"], ["p14", "> 14 μm"]].flatMap(([k, lb]) =>
        ["new", "inservice"].map((st) => ({ path: [vc, k, st], label: `${vc} kV — hạt ${lb} — ${OIL_STATE_LABELS[st]}`, unit: "hạt/ml", kind: "number" })))),
    },
    {
      key: "BANG70_RESISTIVITY", category: "Dầu MBA — Điện trở suất",
      title: "QĐ1901 Bảng 70 — Điện trở suất khối ở 90°C (×10¹² Ω·cm), không nhỏ hơn (để trống = không có số liệu)",
      citationKey: "BANG70_RESISTIVITY", target: BANG70_RESISTIVITY,
      fields: ["new", "inservice"].flatMap((st) => ["110", "220", "500"].map((vc) => ({ path: [st, vc], label: `${vc} kV — ${OIL_STATE_LABELS[st]}`, unit: "×10¹² Ω·cm", kind: "number" }))),
    },
    {
      key: "DIEU55_FURFURAL", category: "Dầu MBA — 2-furfural",
      title: "QĐ1901 Điều 55 — Hàm lượng 2-furfural (MBA ≥110 kV), không quá",
      citationKey: "DIEU55_FURFURAL", target: DIEU55_FURFURAL,
      fields: [{ path: ["max_ppm"], label: "Giá trị cho phép", unit: "ppm", kind: "number" }],
    },
    {
      key: "BANG60_62_OXIDATION", category: "Dầu MBA — Độ ổn định ôxi hóa (khi pha trộn dầu)",
      title: "QĐ1901 Bảng 60–62 — Cặn và trị số axit sau ôxi hóa, tgδ sau ôxi hóa — không lớn hơn",
      citationKey: "BANG60_62_OXIDATION", target: BANG60_62_OXIDATION,
      fields: Object.keys(BANG60_62_OXIDATION).flatMap((m) => [
        { path: [m, "sludge"], label: `${BANG60_62_OXIDATION[m].label} — Khối lượng cặn`, unit: "%", kind: "number" },
        { path: [m, "acid"], label: `${BANG60_62_OXIDATION[m].label} — Trị số axit`, unit: "mgKOH/g", kind: "number" },
        { path: [m, "tgd"], label: `${BANG60_62_OXIDATION[m].label} — tgδ 90°C (để trống = không quy định)`, unit: "", kind: "number" },
      ]),
    },
    {
      key: "IEC60422_2024_TABLE3_NEW", category: "Dầu MBA/Kháng — IEC 60422:2024 (tham khảo, song song QĐ1901)",
      title: "IEC 60422:2024 Bảng 3 — Dầu mới sau khi nạp vào thiết bị, trước khi đóng điện",
      citationKey: "IEC60422_2024_TABLE3_NEW", target: IEC60422_2024_TABLE3_NEW,
      fields: [
        ...["A", "B", "C"].flatMap((cat) => [
          { path: [cat, "bdv"], label: `Category ${cat} — Điện áp chọc thủng, tối thiểu`, unit: "kV", kind: "number" },
          { path: [cat, "moisture"], label: `Category ${cat} — Độ ẩm, tối đa`, unit: "mg/kg", kind: "number" },
          { path: [cat, "tgd90"], label: `Category ${cat} — tgδ 90°C, tối đa`, unit: "%", kind: "number" },
        ]),
        { path: ["common", "color"], label: "Màu sắc ISO 2049, tối đa", unit: "", kind: "number" },
        { path: ["common", "acid"], label: "Trị số axit, tối đa", unit: "mgKOH/g", kind: "number" },
        { path: ["common", "ift"], label: "Sức căng bề mặt, tối thiểu", unit: "mN/m", kind: "number" },
        { path: ["common", "pcb"], label: "PCB — ngưỡng phát hiện", unit: "mg/kg", kind: "number" },
      ],
    },
    {
      key: "IEC60422_2024_TABLE5_EXTRA", category: "Dầu MBA/Kháng — IEC 60422:2024 (tham khảo, song song QĐ1901)",
      title: "IEC 60422:2024 Bảng 5 — Chỉ tiêu bổ sung dầu vận hành (biên Tốt/Kém)",
      citationKey: "IEC60422_2024_TABLE5_MBA", target: IEC60422_2024_TABLE5_EXTRA,
      fields: [
        { path: ["color", "good"], label: "Màu sắc — biên Tốt (<)", unit: "", kind: "number" },
        { path: ["color", "poor"], label: "Màu sắc — biên Kém (>)", unit: "", kind: "number" },
        ...["A", "B", "C"].flatMap((cat) => [
          { path: ["acid", cat, "good"], label: `Category ${cat} — Trị số axit, biên Tốt (<)`, unit: "mgKOH/g", kind: "number" },
          { path: ["acid", cat, "poor"], label: `Category ${cat} — Trị số axit, biên Kém (>)`, unit: "mgKOH/g", kind: "number" },
          { path: ["resistivity", cat, "good"], label: `Category ${cat} — Điện trở suất 90°C, biên Tốt (>)`, unit: "GΩ·m", kind: "number" },
          { path: ["resistivity", cat, "poor"], label: `Category ${cat} — Điện trở suất 90°C, biên Kém (<)`, unit: "GΩ·m", kind: "number" },
        ]),
        { path: ["ift", "inhibited", "good"], label: "IFT dầu có ức chế — biên Tốt (>)", unit: "mN/m", kind: "number" },
        { path: ["ift", "inhibited", "poor"], label: "IFT dầu có ức chế — biên Kém (<)", unit: "mN/m", kind: "number" },
        { path: ["ift", "uninhibited", "good"], label: "IFT dầu không ức chế — biên Tốt (>)", unit: "mN/m", kind: "number" },
        { path: ["ift", "uninhibited", "poor"], label: "IFT dầu không ức chế — biên Kém (<)", unit: "mN/m", kind: "number" },
        { path: ["inhibitor", "good"], label: "Chất ức chế — biên Tốt (> % ban đầu)", unit: "%", kind: "number" },
        { path: ["inhibitor", "poor"], label: "Chất ức chế — biên Kém (< % ban đầu)", unit: "%", kind: "number" },
        { path: ["passivator", "good"], label: "Chất thụ động — biên Tốt (>)", unit: "mg/kg", kind: "number" },
        { path: ["passivator", "poor"], label: "Chất thụ động — biên Kém (<)", unit: "mg/kg", kind: "number" },
        { path: ["sediment_max"], label: "Cặn — bỏ qua nếu nhỏ hơn", unit: "%", kind: "number" },
        { path: ["sludge_max"], label: "Bùn — bỏ qua nếu nhỏ hơn", unit: "%", kind: "number" },
        { path: ["flash_drop_pct"], label: "Nhiệt độ chớp cháy — mức giảm tối đa", unit: "%", kind: "number" },
      ],
    },
    {
      key: "TERMS_DOCS", category: "Tên văn bản, điều khoản, bảng, phụ lục (hiển thị)",
      title: "Tên văn bản quy định / tiêu chuẩn và phiên bản — đổi ở đây, mọi nơi hiển thị cập nhật theo",
      citationKey: "TERMS_DOCS", target: REGULATION_TERMS_DOCS,
      fields: [
        { path: ["QD_FULL"], label: "Quy định — tên đầy đủ (mặc định QĐ1901/QĐ-EVNNPT)", unit: "", kind: "text" },
        { path: ["QD_SHORT"], label: "Quy định — tên viết tắt (mặc định QĐ1901)", unit: "", kind: "text" },
        { path: ["IEC60599_NAME"], label: "Tiêu chuẩn DGA — tên (mặc định IEC 60599)", unit: "", kind: "text" },
        { path: ["IEC60599_YEAR"], label: "Tiêu chuẩn DGA — phiên bản/năm (mặc định 2022)", unit: "", kind: "text" },
        { path: ["IEC60422_NAME"], label: "Tiêu chuẩn dầu — tên (mặc định IEC 60422)", unit: "", kind: "text" },
        { path: ["IEC60422_YEAR"], label: "Tiêu chuẩn dầu — phiên bản/năm (mặc định 2024)", unit: "", kind: "text" },
        { path: ["IEEE_C57104"], label: "Hướng dẫn IEEE (mặc định IEEE C57.104)", unit: "", kind: "text" },
        { path: ["QD_SAMPLING"], label: "Quy trình lấy mẫu dầu (mặc định 3856/QĐ-PTC3)", unit: "", kind: "text" },
      ],
    },
    {
      key: "TERMS_QD_ARTICLES", category: "Tên văn bản, điều khoản, bảng, phụ lục (hiển thị)",
      title: "Số hiệu điều khoản và bảng của quy định — khi quy định mới đánh số lại",
      citationKey: "TERMS_QD_ARTICLES", target: REGULATION_TERMS_QD,
      fields: [
        ...REGULATION_TERMS_QD_ARTICLE_NUMS.map((n) => ({ path: ["D" + n], label: `Điều ${n} (mặc định)`, unit: "", kind: "text" })),
        ...REGULATION_TERMS_QD_TABLE_NUMS.map((n) => ({ path: ["B" + n], label: `Bảng ${n} (mặc định)`, unit: "", kind: "text" })),
      ],
    },
    {
      key: "TERMS_IEC", category: "Tên văn bản, điều khoản, bảng, phụ lục (hiển thị)",
      title: "Số hiệu bảng, phụ lục, hình của tiêu chuẩn IEC — khi IEC ra bản mới đánh số lại",
      citationKey: "TERMS_IEC", target: REGULATION_TERMS_IEC,
      fields: REGULATION_TERMS_IEC_DEFS.map(([k, v, desc]) => ({ path: [k], label: `${v} — ${desc}`, unit: "", kind: "text" })),
    },
  ];
}

const REGULATION_CONFIG_REGISTRY = buildRegulationConfigRegistry();

// Chụp lại NGAY LÚC nạp file (trước khi bất kỳ override nào từ storage được áp dụng) để
// phục vụ resetRegulationConfigItem() ("Khôi phục mặc định"). Registry được build 1 LẦN
// DUY NHẤT ở trên nên target luôn đúng là hằng số gốc tại thời điểm chụp này.
const _regulationConfigDefaults = {};
REGULATION_CONFIG_REGISTRY.forEach((item) => {
  _regulationConfigDefaults[item.key] = {
    citation: REGULATION_CITATIONS[item.citationKey],
    values: deepClone(item.target),
  };
});

// ---------------------------------------------------------------------------
// Kiểm tra THỨ TỰ HỢP LÝ giữa các ngưỡng của cùng 1 bảng (ngoài kiểm tra "không âm" chung ở
// giao diện) — tránh Admin nhập số làm logic rẽ nhánh/hình vẽ sai (VD "CH4/H2 từ 0,5 đến 0,1",
// ranh giới Duval chồng chéo). Trả về mảng thông báo lỗi tiếng Việt, rỗng nếu hợp lệ.
// ---------------------------------------------------------------------------
function rcRequireOrder(problems, pairs) {
  pairs.forEach(([a, b, msg, strict]) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    if (strict === false ? a > b : a >= b) problems.push(msg);
  });
  return problems;
}

const rcNonEmptyText = (v) => Object.keys(v).filter((k) => typeof v[k] !== "string" || v[k].trim() === "").map((k) => `Ô "${k}" không được để trống`);

const REGULATION_CONFIG_VALIDATORS = {
  TERMS_DOCS: rcNonEmptyText,
  TERMS_QD_ARTICLES: rcNonEmptyText,
  TERMS_IEC: rcNonEmptyText,
  BANG66_TABLE1: (v) => rcRequireOrder([], [
    [v.D1.h_min, v.D1.h_max, "D1: CH4/H2 \"từ\" phải nhỏ hơn \"đến\""],
    [v.D2.g_min, v.D2.g_max, "D2: C2H2/C2H4 \"từ\" phải nhỏ hơn \"đến\""],
    [v.D2.h_min, v.D2.h_max, "D2: CH4/H2 \"từ\" phải nhỏ hơn \"đến\""],
    [v.T2.i_min, v.T2.i_max, "T2: C2H4/C2H6 \"từ\" phải nhỏ hơn \"đến\""],
    [v.T2.i_max, v.T3.i_min, "T3: C2H4/C2H6 \"lớn hơn\" không được nhỏ hơn T2 \"đến\"", false],
    [v.T2.g_max, v.T3.g_max, "T3: C2H2/C2H4 \"nhỏ hơn\" không được nhỏ hơn của T2", false],
  ]),
  DIEU54_OLTC: (v) => rcRequireOrder([], [[v.possible, v.likely, "Ngưỡng \"nghi ngờ rõ\" không được nhỏ hơn ngưỡng \"có thể\"", false]]),
  DIEU54_ADDITIONAL: (v) => rcRequireOrder([], [[v.co2co_low, v.co2co_high, "CO2/CO: ngưỡng carbon hóa giấy phải nhỏ hơn ngưỡng quá nhiệt nhẹ"]]),
  IEC_A10_BUSHING: (v) => rcRequireOrder([], [[v.tp_low, v.tp_high, "TP: CO2/CO \"nhỏ hơn\" phải nhỏ hơn \"hoặc lớn hơn\""]]),
  BANG67_DUVAL: (v) => {
    const p = rcRequireOrder([], [
      [50, v.pd_ch4, "PD: %CH4 phải lớn hơn 50%"],
      [v.pd_ch4, 100, "PD: %CH4 phải nhỏ hơn 100%"],
      [100 - v.pd_ch4, v.t_c2h2, "Vùng PD phải nhỏ hơn dải T1/T2 (100 − %CH4 của PD < %C2H2 của T1, T2)"],
      [100 - v.pd_ch4, v.t1_c2h4, "Vùng PD phải nhỏ hơn T1 (100 − %CH4 của PD < ranh giới T1/T2)"],
      [v.t1_c2h4, v.t2_c2h4, "Ranh giới T1/T2 phải nhỏ hơn T2/T3 (%C2H4)"],
      [v.t_c2h2, v.d_c2h2, "%C2H2 của T1, T2 phải nhỏ hơn %C2H2 của D1, D2"],
      [v.t_c2h2, v.t3_c2h2, "%C2H2 của T1, T2 phải nhỏ hơn %C2H2 của T3"],
      [v.d_c2h2, v.d2_c2h2, "%C2H2 của D1, D2 phải nhỏ hơn ranh giới D2 / D+T (%C2H2)"],
      [v.t3_c2h2, v.d2_c2h2, "%C2H2 của T3 phải nhỏ hơn ranh giới D2 / D+T (%C2H2)"],
      [v.d1_c2h4, v.d2_c2h4, "Ranh giới D1/D2 phải nhỏ hơn D2 / D+T (%C2H4)"],
      [v.d2_c2h4, v.t2_c2h4, "Ranh giới D2 / D+T (%C2H4) không được lớn hơn T2/T3", false],
      [v.d_c2h2 + v.d1_c2h4, 100, "%C2H2 của D1 + ranh giới D1/D2 phải nhỏ hơn 100%"],
      [v.d2_c2h2 + v.d2_c2h4, 100, "%C2H2 + %C2H4 của ranh giới D2 / D+T phải nhỏ hơn 100%"],
    ]);
    return p;
  },
};

/** Lỗi thứ tự của 1 bảng (values = object đầy đủ của bảng, VD lấy từ form). [] nếu không có luật riêng. */
function validateRegulationConfigValues(key, values) {
  const fn = REGULATION_CONFIG_VALIDATORS[key];
  if (!fn || !values) return [];
  try {
    return fn(values);
  } catch (e) {
    return ["Thiếu giá trị — vui lòng điền đủ các ô của bảng"];
  }
}

function getRegulationConfigRegistry() {
  return REGULATION_CONFIG_REGISTRY;
}

function findRegulationConfigItem(key) {
  return REGULATION_CONFIG_REGISTRY.find((it) => it.key === key) || null;
}

/**
 * Áp dụng 1 bản ghi cấu hình đã lưu (Storage.listRegulationConfig()) lên đúng object
 * hằng số target — gọi 1 lần lúc khởi động app (initApp(), xem ui/ui-regulation-
 * config.js: applyAllRegulationConfigOverrides()) SAU KHI đã tải xong danh sách từ
 * storage. Ghi đè CẢ citation (REGULATION_CITATIONS[item.citationKey]) lẫn giá trị số
 * (deep-merge vào item.target — xem deepMergeInto()).
 * @param {string} key
 * @param {{citation?: string, values?: object}} override
 */
function applyRegulationConfigOverride(key, override) {
  const item = findRegulationConfigItem(key);
  if (!item || !override) return;
  if (override.citation) REGULATION_CITATIONS[item.citationKey] = override.citation;
  if (override.values) deepMergeInto(item.target, override.values);
}

/** Khôi phục 1 bảng về ĐÚNG giá trị/citation mặc định gốc (lúc app khởi động). */
function resetRegulationConfigItem(key) {
  const item = findRegulationConfigItem(key);
  const snap = _regulationConfigDefaults[key];
  if (!item || !snap) return;
  REGULATION_CITATIONS[item.citationKey] = snap.citation;
  // Xóa hết property hiện có trên target rồi gán lại nguyên bản snapshot — deepMergeInto()
  // không tự XÓA property (chỉ ghi đè/thêm), nên cần xóa sạch trước để không sót lại phần
  // ghi đè cũ khi khôi phục mặc định.
  Object.keys(item.target).forEach((k) => delete item.target[k]);
  Object.assign(item.target, deepClone(snap.values));
}

function regulationConfigDefaultCitation(key) {
  const snap = _regulationConfigDefaults[key];
  return snap ? snap.citation : null;
}

/** Trạng thái HIỆN TẠI (đã áp dụng override, nếu có) của 1 bảng — dùng để hiển thị lên
 *  form khi mở mục "Quy định" trong tab "Cấu hình". */
function getRegulationConfigCurrentValues(key) {
  const item = findRegulationConfigItem(key);
  if (!item) return null;
  return { citation: REGULATION_CITATIONS[item.citationKey], values: deepClone(item.target) };
}

// Export cho cả trình duyệt (global) lẫn Node (module.exports, dùng để test)
