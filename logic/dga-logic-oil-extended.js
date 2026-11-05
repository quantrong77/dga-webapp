/* dga-logic-oil-extended.js — Các chỉ tiêu LÝ-HÓA dầu MBA/Kháng dầu BỔ SUNG ngoài 3 chỉ tiêu cơ bản
   (độ ẩm, tgδ 90°C, điện áp chọc thủng — dga-logic-oil.js), theo:
   - QĐ1901 Chương VI "Dầu MBA": Điều 48 (màu sắc), Điều 49 (tạp chất cơ học — Bảng 56, đếm hạt — Bảng 57),
     Điều 51 (nhiệt độ chớp cháy), Điều 52 (trị số axit — Bảng 59), Điều 53 (độ ổn định/kháng ôxi hóa —
     Bảng 60/61/62, khi pha trộn dầu), Điều 55 (2-furfural), Điều 56 (điện trở suất — Bảng 70).
   - IEC 60422:2024: Bảng 3 (dầu mới sau khi nạp, trước khi đóng điện) và các chỉ tiêu còn lại của Bảng 5
     (dầu vận hành: màu, ngoại quan, axit, điện trở suất, sức căng bề mặt, cặn/bùn, lưu huỳnh ăn mòn, PCB,
     chất ức chế, chất thụ động, nhiệt độ chớp cháy).
   Nạp SAU dga-logic-iec60422-2024.js (dùng verdictTwoTierOil()/mapOilVoltageClassToIec60422Category()) và
   TRƯỚC dga-logic-regulation-config.js (registry cấu hình tham chiếu trực tiếp các hằng số bên dưới).
   Mọi ngưỡng ở đây Admin chỉnh được (Cấu hình → Quy định). KHÔNG tự tạo ngưỡng ngoài văn bản: ô nào
   văn bản không có số liệu thì để null → đánh giá "Không có ngưỡng" (chỉ ghi nhận để theo dõi xu hướng). */

REGULATION_CITATIONS.DIEU48_COLOR = "Điều 48 QĐ1901";
REGULATION_CITATIONS.BANG56_MECH = "Bảng 56, Điều 49 QĐ1901";
REGULATION_CITATIONS.BANG57_PARTICLES = "Bảng 57, Điều 49 QĐ1901";
REGULATION_CITATIONS.DIEU51_FLASH = "Điều 51 QĐ1901";
REGULATION_CITATIONS.BANG59_ACID = "Bảng 59, Điều 52 QĐ1901";
REGULATION_CITATIONS.BANG60_62_OXIDATION = "Bảng 60–62, Điều 53 QĐ1901";
REGULATION_CITATIONS.DIEU55_FURFURAL = "Điều 55 QĐ1901";
REGULATION_CITATIONS.BANG70_RESISTIVITY = "Bảng 70, Điều 56 QĐ1901";
REGULATION_CITATIONS.IEC60422_2024_TABLE3_NEW = "IEC 60422:2024 Bảng 3 (Table 3) — dầu mới sau khi nạp vào thiết bị, trước khi đóng điện";

// ---------------------------------------------------------------------------
// 1) Ngưỡng QĐ1901
// ---------------------------------------------------------------------------

// Bảng 59 — Trị số axit (mgKOH/g dầu), KHÔNG LỚN HƠN. Dầu mới: 0,02 mọi cấp. Dầu vận hành: "Đến 35 kV" 0,25;
// "110 kV" 0,15; "220 đến 500 kV" 0,1 — đủ mọi cấp điện áp đang dùng (cấp 66 kV cũ đã bỏ).
const BANG59_ACID = {
  new: 0.02,
  inservice: { duoi15: 0.25, "15den35": 0.25, "110": 0.15, "220": 0.1, "500": 0.1 },
};

// Điều 51 — Nhiệt độ chớp cháy cốc kín (ASTM D93/ISO 2719): dầu mới KHÔNG THẤP HƠN 135°C; trong vận hành
// KHÔNG ĐƯỢC GIẢM QUÁ 5°C (so với lần thí nghiệm trước — app lấy lần thí nghiệm liền trước của cùng thiết bị).
const DIEU51_FLASH = { new_min: 135, max_drop: 5 };

// Bảng 56 — Tạp chất cơ học (% khối lượng), KHÔNG LỚN HƠN. Đến 110 kV: quan sát bằng mắt "Không thấy".
const BANG56_MECH = {
  "220": { new: 0.0016, inservice: 0.0017 },
  "500": { new: 0.0015, inservice: 0.0016 },
};

// Bảng 57 — Đếm hạt tạp chất (số hạt trong 1 ml dầu), KHÔNG LỚN HƠN. Đến 110 kV: quan sát "Không thấy".
const BANG57_PARTICLES = {
  "220": { p6: { new: 320, inservice: 1300 }, p14: { new: 40, inservice: 160 } },
  "500": { p6: { new: 80, inservice: 320 }, p14: { new: 10, inservice: 40 } },
};

// Điều 55 — Hàm lượng 2-furfural: "không quá 15 ppm" — thực hiện với MBA ≥110 kV.
const DIEU55_FURFURAL = { max_ppm: 15 };

// Bảng 70 — Điện trở suất khối ở 90°C (×10¹² Ω·cm), KHÔNG NHỎ HƠN. Bản trích QĐ1901 có 5 cột (≤15, 15÷35,
// 110, 220, 500 kV) nhưng hàng "Dầu mới" chỉ có 4 ô "- - 0,3×10¹² 1×10¹²" → app hiểu ô 1×10¹² gộp cho
// 220 và 500 kV; hàng "Dầu trong vận hành" KHÔNG có số liệu → null. Admin kiểm tra lại với văn bản gốc.
const BANG70_RESISTIVITY = {
  new: { "110": 0.3, "220": 1, "500": 1 },
  inservice: { "110": null, "220": null, "500": null },
};

// Bảng 60–62 — Độ ổn định ôxi hóa (kháng ôxi hóa) — CHỈ thí nghiệm khi PHA TRỘN dầu (Điều 53), dầu mới.
// sludge: khối lượng cặn sau ôxi hóa (%), acid: trị số axit sau ôxi hóa (mgKOH/g), tgd: tổn thất điện môi
// sau ôxi hóa ở 90°C (ghi đúng như văn bản, dạng phân số) — KHÔNG LỚN HƠN.
const BANG60_62_OXIDATION = {
  gost981: { label: "GOST 981 (Bảng 60)", sludge: 0.01, acid: 0.1, tgd: null },
  iec61125_A: { label: "IEC 61125 — Loại A, dầu ức chế 0,08–0,40%, 500h (Bảng 61)", sludge: 0.05, acid: 0.3, tgd: 0.05 },
  iec61125_B: { label: "IEC 61125 — Loại B (Bảng 61)", sludge: 0.8, acid: 1.2, tgd: 0.5 },
  astm_I_72: { label: "ASTM D2440 — Loại I, 72h (Bảng 62)", sludge: 0.15, acid: 0.5, tgd: null },
  astm_II_72: { label: "ASTM D2440 — Loại II, 72h (Bảng 62)", sludge: 0.1, acid: 0.3, tgd: null },
  astm_I_164: { label: "ASTM D2440 — Loại I, 164h (Bảng 62)", sludge: 0.3, acid: 0.6, tgd: null },
  astm_II_164: { label: "ASTM D2440 — Loại II, 164h (Bảng 62)", sludge: 0.2, acid: 0.4, tgd: null },
};

// ---------------------------------------------------------------------------
// 2) Ngưỡng IEC 60422:2024
// ---------------------------------------------------------------------------

// Bảng 3 — dầu mới sau khi nạp vào thiết bị, trước khi đóng điện. Category theo Um: C <72,5 / B 72,5–170 /
// A >170 kV. tgδ (DDF) bản gốc ghi dạng phân số (0,010/0,015) → quy đổi % (×100) cho khớp app.
const IEC60422_2024_TABLE3_NEW = {
  A: { bdv: 60, moisture: 10, tgd90: 1.0 },
  B: { bdv: 60, moisture: 10, tgd90: 1.5 },
  C: { bdv: 55, moisture: 20, tgd90: 1.5 },
  common: { color: 2.0, acid: 0.03, ift: 35, pcb: 2 },
};

// Bảng 5 — các chỉ tiêu dầu vận hành NGOÀI 3 chỉ tiêu cơ bản (good = biên "Tốt", poor = biên "Kém").
// Điện trở suất ở 90°C tính bằng GΩ·m (app nhập ×10¹² Ω·cm theo QĐ1901, 1×10¹² Ω·cm = 10 GΩ·m).
const IEC60422_2024_TABLE5_EXTRA = {
  color: { good: 2, poor: 6 },
  acid: { A: { good: 0.1, poor: 0.15 }, B: { good: 0.1, poor: 0.2 }, C: { good: 0.15, poor: 0.3 } },
  resistivity: { A: { good: 10, poor: 3 }, B: { good: 3, poor: 0.2 }, C: { good: 3, poor: 0.2 } },
  ift: { inhibited: { good: 28, poor: 22 }, uninhibited: { good: 25, poor: 20 } },
  inhibitor: { good: 60, poor: 40 },
  passivator: { good: 70, poor: 50 },
  sediment_max: 0.02,
  sludge_max: 0.02,
  flash_drop_pct: 10,
};

// ---------------------------------------------------------------------------
// 3) Danh mục chỉ tiêu (dùng chung cho form nhập, lưu trữ, đọc BBTN, xu hướng)
//    field = tên cột lưu trữ; group: "base" (3 chỉ tiêu cơ bản), "qd1901", "iec", "oxidation".
// ---------------------------------------------------------------------------
const OIL_PARAM_DEFS = [
  { field: "bdv_kv", key: "bdv", group: "base", label: "Điện áp chọc thủng", unit: "kV", step: "0.1" },
  { field: "tgd_90c_percent", key: "tgd90", group: "base", label: "Tổn hao điện môi tgδ ở 90°C", unit: "%", step: "0.001" },
  { field: "moisture_ppm", key: "moisture", group: "base", label: "Hàm lượng nước (độ ẩm)", unit: "ppm", step: "0.1" },
  { field: "acid_mgkoh", key: "acid", group: "qd1901", label: "Trị số axit", unit: "mgKOH/g", step: "0.001" },
  { field: "flash_point_c", key: "flash", group: "qd1901", label: "Nhiệt độ chớp cháy cốc kín", unit: "°C", step: "0.1" },
  { field: "mech_visual", key: "mechvis", group: "qd1901", label: "Tạp chất cơ học — quan sát bằng mắt", unit: "", type: "select",
    options: [{ value: "khong", label: "Không thấy" }, { value: "co", label: "Có tạp chất" }] },
  { field: "mech_impurity_percent", key: "mech", group: "qd1901", label: "Hàm lượng tạp chất cơ học", unit: "%", step: "0.0001" },
  { field: "particles_6um", key: "p6", group: "qd1901", label: "Số hạt tạp chất > 6 μm", unit: "hạt/ml", step: "1" },
  { field: "particles_14um", key: "p14", group: "qd1901", label: "Số hạt tạp chất > 14 μm", unit: "hạt/ml", step: "1" },
  { field: "resistivity_90c_e12", key: "resistivity", group: "qd1901", label: "Điện trở suất khối ở 90°C", unit: "×10¹² Ω·cm", step: "0.01" },
  { field: "furfural_ppm", key: "furfural", group: "qd1901", label: "Hàm lượng 2-furfural (2-FAL)", unit: "ppm", step: "0.01" },
  { field: "color_iso2049", key: "color", group: "qd1901", label: "Màu sắc (thang ISO 2049)", unit: "", step: "0.5" },
  { field: "appearance", key: "appearance", group: "iec", label: "Ngoại quan", unit: "", type: "select",
    options: [{ value: "trong", label: "Trong, không cặn/vẩn" }, { value: "duc", label: "Đục/vẩn đục" }] },
  { field: "ift_mnm", key: "ift", group: "iec", label: "Sức căng bề mặt (IFT)", unit: "mN/m", step: "0.1" },
  { field: "corrosive_sulfur", key: "sulfur", group: "iec", label: "Lưu huỳnh ăn mòn / có khả năng ăn mòn", unit: "", type: "select",
    options: [{ value: "khong", label: "Không ăn mòn" }, { value: "co", label: "Ăn mòn / có khả năng ăn mòn" }] },
  { field: "pcb_mgkg", key: "pcb", group: "iec", label: "Hàm lượng PCB", unit: "mg/kg", step: "0.1" },
  { field: "sediment_percent", key: "sediment", group: "iec", label: "Cặn (sediment)", unit: "%", step: "0.001" },
  { field: "sludge_percent", key: "sludge", group: "iec", label: "Bùn (sludge)", unit: "%", step: "0.001" },
  { field: "inhibitor_pct_original", key: "inhibitor", group: "iec", label: "Hàm lượng chất ức chế (so với ban đầu)", unit: "%", step: "1" },
  { field: "passivator_mgkg", key: "passivator", group: "iec", label: "Hàm lượng chất thụ động (passivator)", unit: "mg/kg", step: "1" },
  { field: "acid_base_soluble", key: "acidbase", group: "other", label: "Axit – kiềm hòa tan trong dầu (phản ứng axit-bazơ)", unit: "", type: "select",
    options: [{ value: "khong", label: "Không có" }, { value: "co", label: "Có" }] },
  { field: "ox_sludge_percent", key: "oxsludge", group: "oxidation", label: "Khối lượng cặn sau ôxi hóa", unit: "%", step: "0.001" },
  { field: "ox_acid_mgkoh", key: "oxacid", group: "oxidation", label: "Trị số axit sau ôxi hóa", unit: "mgKOH/g", step: "0.001" },
  { field: "ox_tgd", key: "oxtgd", group: "oxidation", label: "Tổn thất điện môi tgδ 90°C sau ôxi hóa", unit: "", step: "0.001" },
];

/** Các trường MỚI (ngoài moisture_ppm/tgd_90c_percent/bdv_kv) — dùng cho lưu trữ & kiểm tra đủ dữ liệu. */
const OIL_EXT_FIELDS = OIL_PARAM_DEFS.filter((d) => d.group !== "base").map((d) => d.field);

const OIL_GROUP_LABELS = {
  base: "Chỉ tiêu cơ bản (Bảng 54, 55, 58 QĐ1901)",
  qd1901: "Chỉ tiêu lý-hóa bổ sung theo QĐ1901 (Điều 48–56)",
  iec: "Chỉ tiêu bổ sung theo IEC 60422:2024 (QĐ1901 không quy định)",
  other: "Chỉ tiêu khác ghi trên BBTN (QĐ1901, IEC 60422 không quy định)",
  oxidation: "Độ ổn định ôxi hóa — chỉ khi pha trộn dầu (Điều 53, Bảng 60–62)",
};

function oilParamDef(field) {
  return OIL_PARAM_DEFS.find((d) => d.field === field) || null;
}

function oilSelectLabel(field, value) {
  const d = oilParamDef(field);
  const o = d && d.options ? d.options.find((x) => x.value === value) : null;
  return o ? o.label : value;
}

function oilExtNum(extra, field) {
  return extra && hasVal(extra[field]) && Number.isFinite(Number(extra[field])) ? Number(extra[field]) : null;
}

function oilVerdictLe(v, lim) {
  return lim === null || lim === undefined ? "Không có ngưỡng" : v <= lim ? "Đạt" : "Không đạt";
}
function oilVerdictGe(v, lim) {
  return lim === null || lim === undefined ? "Không có ngưỡng" : v >= lim ? "Đạt" : "Không đạt";
}
function oilLimitText(lim, direction) {
  return lim === null || lim === undefined ? "—" : (direction === "ge" ? "≥ " : "≤ ") + lim;
}

/**
 * Đánh giá các chỉ tiêu bổ sung theo QĐ1901 (Điều 48–56). Trả về mảng dòng cùng định dạng
 * evaluateOilTest() (key, label, value, limit, limitText, unit, direction, verdict, ref).
 * @param {{voltageClass:string, oilState:string, extra:Object, prevFlashPoint?:number|null, oxMethod?:string}} p
 */
function evaluateOilExtendedQd1901({ voltageClass, oilState, extra, prevFlashPoint, oxMethod }) {
  const state = oilState === "new" ? "new" : "inservice";
  const vc = voltageClass;
  const upTo110 = ["duoi15", "15den35", "tren35duoi110", "110"].includes(vc);
  const rows = [];
  const push = (r) => rows.push({ limitText: oilLimitText(r.limit, r.direction), ...r });

  const acid = oilExtNum(extra, "acid_mgkoh");
  if (acid !== null) {
    const lim = state === "new" ? BANG59_ACID.new : (BANG59_ACID.inservice[vc] ?? null);
    push({
      key: "acid", label: "Trị số axit", value: acid, limit: lim, unit: "mgKOH/g", direction: "le",
      verdict: oilVerdictLe(acid, lim),
      ref: REGULATION_CITATIONS.BANG59_ACID + (lim === null ? " — văn bản không có số liệu cho cấp điện áp này" : ""),
    });
  }

  const flash = oilExtNum(extra, "flash_point_c");
  if (flash !== null) {
    if (state === "new") {
      push({
        key: "flash", label: "Nhiệt độ chớp cháy cốc kín", value: flash, limit: DIEU51_FLASH.new_min, unit: "°C", direction: "ge",
        verdict: oilVerdictGe(flash, DIEU51_FLASH.new_min), ref: REGULATION_CITATIONS.DIEU51_FLASH + " — dầu mới",
      });
    } else if (prevFlashPoint !== null && prevFlashPoint !== undefined && Number.isFinite(Number(prevFlashPoint))) {
      const prev = Number(prevFlashPoint);
      const drop = Math.round((prev - flash) * 100) / 100;
      push({
        key: "flash", label: "Nhiệt độ chớp cháy cốc kín", value: flash, limit: null,
        limitText: `Giảm ≤ ${DIEU51_FLASH.max_drop}°C so với lần trước (${prev}°C)`, unit: "°C", direction: "ge",
        verdict: drop <= DIEU51_FLASH.max_drop ? "Đạt" : "Không đạt",
        ref: `${REGULATION_CITATIONS.DIEU51_FLASH} — dầu vận hành, ${drop > 0 ? `giảm ${drop}°C` : "không giảm"} so với lần thí nghiệm trước`,
      });
    } else {
      push({
        key: "flash", label: "Nhiệt độ chớp cháy cốc kín", value: flash, limit: null,
        limitText: `Giảm ≤ ${DIEU51_FLASH.max_drop}°C so với lần trước`, unit: "°C", direction: "ge", verdict: "Không có ngưỡng",
        ref: REGULATION_CITATIONS.DIEU51_FLASH + " — dầu vận hành: chưa có lần thí nghiệm trước của thiết bị để so sánh mức giảm",
      });
    }
  }

  const mechVis = extra && hasVal(extra.mech_visual) ? String(extra.mech_visual) : null;
  if (mechVis) {
    push({
      key: "mechvis", label: "Tạp chất cơ học (quan sát bằng mắt)", value: oilSelectLabel("mech_visual", mechVis), limit: null,
      limitText: "Không thấy", unit: "", direction: "le", verdict: mechVis === "co" ? "Không đạt" : "Đạt",
      ref: REGULATION_CITATIONS.BANG56_MECH + " / " + REGULATION_CITATIONS.BANG57_PARTICLES + " — quan sát bằng mắt phải \"Không thấy\"",
    });
  }
  const mech = oilExtNum(extra, "mech_impurity_percent");
  if (mech !== null) {
    const lim = BANG56_MECH[vc] ? BANG56_MECH[vc][state] : null;
    push({
      key: "mech", label: "Hàm lượng tạp chất cơ học", value: mech, limit: lim, unit: "%", direction: "le",
      verdict: oilVerdictLe(mech, lim),
      ref: REGULATION_CITATIONS.BANG56_MECH + (lim === null ? (upTo110 ? " — đến 110 kV đánh giá bằng quan sát (Không thấy)" : " — không có số liệu") : ""),
    });
  }
  [["particles_6um", "p6", "Số hạt tạp chất > 6 μm"], ["particles_14um", "p14", "Số hạt tạp chất > 14 μm"]].forEach(([field, k, label]) => {
    const v = oilExtNum(extra, field);
    if (v === null) return;
    const lim = BANG57_PARTICLES[vc] ? BANG57_PARTICLES[vc][k][state] : null;
    push({
      key: k, label, value: v, limit: lim, unit: "hạt/ml", direction: "le", verdict: oilVerdictLe(v, lim),
      ref: REGULATION_CITATIONS.BANG57_PARTICLES + (lim === null ? (upTo110 ? " — đến 110 kV đánh giá bằng quan sát (Không thấy)" : " — không có số liệu") : ""),
    });
  });

  const res = oilExtNum(extra, "resistivity_90c_e12");
  if (res !== null) {
    const lim = (BANG70_RESISTIVITY[state] || {})[vc] ?? null;
    push({
      key: "resistivity", label: "Điện trở suất khối ở 90°C", value: res, limit: lim, unit: "×10¹² Ω·cm", direction: "ge",
      verdict: oilVerdictGe(res, lim),
      ref: REGULATION_CITATIONS.BANG70_RESISTIVITY + (lim === null ? (state === "inservice" ? " — văn bản không có số liệu cho dầu vận hành, ghi nhận để theo dõi xu hướng" : " — không có số liệu cho cấp điện áp này") : ""),
    });
  }

  const fur = oilExtNum(extra, "furfural_ppm");
  if (fur !== null) {
    const applies = ["110", "220", "500"].includes(vc);
    const lim = applies ? DIEU55_FURFURAL.max_ppm : null;
    push({
      key: "furfural", label: "Hàm lượng 2-furfural (2-FAL)", value: fur, limit: lim, unit: "ppm", direction: "le",
      verdict: oilVerdictLe(fur, lim),
      ref: REGULATION_CITATIONS.DIEU55_FURFURAL + (applies ? "" : " — chỉ quy định cho MBA điện áp 110 kV trở lên"),
    });
  }

  const color = oilExtNum(extra, "color_iso2049");
  if (color !== null) {
    push({
      key: "color", label: "Màu sắc (thang ISO 2049)", value: color, limit: null, limitText: "—", unit: "", direction: "le",
      verdict: "Không có ngưỡng",
      ref: REGULATION_CITATIONS.DIEU48_COLOR + " — không bắt buộc, không có ngưỡng số: dầu mới màu tối = độ sạch không đạt; trong vận hành tối nhanh = dầu bị nóng hoặc tạo than",
    });
  }

  // Axit – kiềm hòa tan (water-soluble acids & bases): QĐ1901 KHÔNG quy định — chỉ đánh giá theo đúng giới hạn
  // "Không có" mà phòng thí nghiệm ghi trên BBTN (mẫu BBTN dầu cách điện PTC3).
  const acidBase = extra && hasVal(extra.acid_base_soluble) ? String(extra.acid_base_soluble) : null;
  if (acidBase) {
    push({
      key: "acidbase", label: "Axit – kiềm hòa tan trong dầu", value: oilSelectLabel("acid_base_soluble", acidBase), limit: null,
      limitText: "Không có", unit: "", direction: "le", verdict: acidBase === "co" ? "Không đạt" : "Đạt",
      ref: "Giới hạn ghi trên BBTN của phòng thí nghiệm — QĐ1901 không quy định chỉ tiêu này",
    });
  }

  const ox = BANG60_62_OXIDATION[oxMethod] || null;
  [["ox_sludge_percent", "oxsludge", "Khối lượng cặn sau ôxi hóa", "%", "sludge"],
    ["ox_acid_mgkoh", "oxacid", "Trị số axit sau ôxi hóa", "mgKOH/g", "acid"],
    ["ox_tgd", "oxtgd", "Tổn thất điện môi tgδ 90°C sau ôxi hóa", "", "tgd"]].forEach(([field, k, label, unit, limKey]) => {
    const v = oilExtNum(extra, field);
    if (v === null) return;
    const lim = ox ? ox[limKey] ?? null : null;
    push({
      key: k, label, value: v, limit: lim, unit, direction: "le", verdict: oilVerdictLe(v, lim),
      ref: REGULATION_CITATIONS.BANG60_62_OXIDATION + (ox ? " — " + ox.label : " — chưa chọn phương pháp thử nên chưa có ngưỡng"),
    });
  });

  return rows;
}

/** Đánh giá IEC 60422:2024 cho các chỉ tiêu bổ sung. oilState "new" → Bảng 3 (2 mức Đạt/Không đạt),
 *  ngược lại → Bảng 5 (3 mức Tốt/Cần theo dõi/Kém = Đạt/Cảnh báo/Không đạt). */
function evaluateIec60422ExtendedMba({ voltageClass, oilState, extra, prevFlashPoint, inhibited }) {
  const category = mapOilVoltageClassToIec60422Category(voltageClass);
  const rows = [];
  const isNew = oilState === "new";
  const ref3 = REGULATION_CITATIONS.IEC60422_2024_TABLE3_NEW + " — Category " + category;
  const ref5 = REGULATION_CITATIONS.IEC60422_2024_TABLE5_MBA + " — Category " + category;
  const T3 = IEC60422_2024_TABLE3_NEW.common;
  const T5 = IEC60422_2024_TABLE5_EXTRA;
  const tier = (label, key, v, good, poor, dir, unit, extraRef) => rows.push({
    key, label, value: v, unit, direction: dir,
    limit: "Tốt " + (dir === "ge" ? "> " : "< ") + good + " · Kém " + (dir === "ge" ? "< " : "> ") + poor,
    verdict: verdictTwoTierOil(v, good, poor, dir), ref: ref5 + (extraRef || ""),
  });
  const pass = (label, key, v, lim, dir, unit, extraRef) => rows.push({
    key, label, value: v, unit, direction: dir, limit: (dir === "ge" ? "≥ " : "≤ ") + lim,
    verdict: dir === "ge" ? (v >= lim ? "Đạt" : "Không đạt") : (v <= lim ? "Đạt" : "Không đạt"), ref: ref3 + (extraRef || ""),
  });

  const color = oilExtNum(extra, "color_iso2049");
  if (color !== null) {
    if (isNew) pass("Màu sắc (ISO 2049)", "color", color, T3.color, "le", "");
    else tier("Màu sắc (ISO 2049)", "color", color, T5.color.good, T5.color.poor, "le", "", " — chỉ tham khảo, IEC khuyến cáo không hành động chỉ dựa vào màu");
  }
  const app = extra && hasVal(extra.appearance) ? String(extra.appearance) : null;
  if (app) {
    rows.push({
      key: "appearance", label: "Ngoại quan", value: oilSelectLabel("appearance", app), unit: "", direction: "le",
      limit: "Trong, không cặn/vẩn", verdict: app === "duc" ? (isNew ? "Không đạt" : "Cảnh báo") : "Đạt", ref: isNew ? ref3 : ref5,
    });
  }
  const acid = oilExtNum(extra, "acid_mgkoh");
  if (acid !== null) {
    if (isNew) pass("Trị số axit", "acid", acid, T3.acid, "le", "mgKOH/g");
    else tier("Trị số axit", "acid", acid, T5.acid[category].good, T5.acid[category].poor, "le", "mgKOH/g");
  }
  const res = oilExtNum(extra, "resistivity_90c_e12");
  if (res !== null && !isNew) {
    const gohm = Math.round(res * 10 * 1000) / 1000; // 1×10¹² Ω·cm = 10 GΩ·m
    tier("Điện trở suất ở 90°C", "resistivity", gohm, T5.resistivity[category].good, T5.resistivity[category].poor, "ge", "GΩ·m",
      ` — quy đổi từ ${res}×10¹² Ω·cm`);
  }
  const ift = oilExtNum(extra, "ift_mnm");
  if (ift !== null) {
    if (isNew) pass("Sức căng bề mặt (IFT)", "ift", ift, T3.ift, "ge", "mN/m");
    else {
      const t = inhibited === "uninhibited" ? T5.ift.uninhibited : T5.ift.inhibited;
      tier("Sức căng bề mặt (IFT)", "ift", ift, t.good, t.poor, "ge", "mN/m",
        inhibited === "uninhibited" ? " — dầu không ức chế" : inhibited === "inhibited" ? " — dầu có ức chế" : " — chưa chọn loại dầu, tạm dùng ngưỡng dầu có ức chế");
    }
  }
  const sulfur = extra && hasVal(extra.corrosive_sulfur) ? String(extra.corrosive_sulfur) : null;
  if (sulfur) {
    rows.push({
      key: "sulfur", label: "Lưu huỳnh ăn mòn", value: oilSelectLabel("corrosive_sulfur", sulfur), unit: "", direction: "le",
      limit: "Không ăn mòn", verdict: sulfur === "co" ? "Không đạt" : "Đạt", ref: isNew ? ref3 : ref5,
    });
  }
  const pcb = oilExtNum(extra, "pcb_mgkg");
  if (pcb !== null) {
    rows.push({
      key: "pcb", label: "Hàm lượng PCB", value: pcb, unit: "mg/kg", direction: "le", limit: "Không phát hiện (< " + T3.pcb + " mg/kg)",
      verdict: pcb < T3.pcb ? "Đạt" : "Không đạt", ref: (isNew ? ref3 : ref5) + " — có thể chịu quy định pháp luật về môi trường",
    });
  }
  if (!isNew) {
    [["sediment_percent", "sediment", "Cặn (sediment)", T5.sediment_max], ["sludge_percent", "sludge", "Bùn (sludge)", T5.sludge_max]].forEach(([f, k, label, max]) => {
      const v = oilExtNum(extra, f);
      if (v === null) return;
      rows.push({ key: k, label, value: v, unit: "%", direction: "le", limit: `< ${max}% (bỏ qua)`,
        verdict: v < max ? "Đạt" : "Không đạt", ref: ref5 + " — không phải thí nghiệm định kỳ" });
    });
    const inh = oilExtNum(extra, "inhibitor_pct_original");
    if (inh !== null) tier("Hàm lượng chất ức chế (so với ban đầu)", "inhibitor", inh, T5.inhibitor.good, T5.inhibitor.poor, "ge", "%", " — chỉ áp dụng dầu có ức chế");
    const pas = oilExtNum(extra, "passivator_mgkg");
    if (pas !== null) tier("Hàm lượng chất thụ động", "passivator", pas, T5.passivator.good, T5.passivator.poor, "ge", "mg/kg");
    const flash = oilExtNum(extra, "flash_point_c");
    if (flash !== null && prevFlashPoint !== null && prevFlashPoint !== undefined && Number(prevFlashPoint) > 0) {
      const dropPct = Math.round(((Number(prevFlashPoint) - flash) / Number(prevFlashPoint)) * 1000) / 10;
      rows.push({ key: "flash", label: "Nhiệt độ chớp cháy (mức giảm)", value: flash, unit: "°C", direction: "ge",
        limit: `Giảm < ${T5.flash_drop_pct}% so với lần trước (${prevFlashPoint}°C)`,
        verdict: dropPct < T5.flash_drop_pct ? "Đạt" : "Không đạt", ref: ref5 + ` — giảm ${dropPct > 0 ? dropPct : 0}%` });
    }
  }
  return rows;
}

/** Bảng 3 IEC 60422:2024 cho 3 chỉ tiêu cơ bản (dầu mới). */
function evaluateIec60422NewOilBase({ voltageClass, moisture, tgd90, bdv }) {
  const category = mapOilVoltageClassToIec60422Category(voltageClass);
  const L = IEC60422_2024_TABLE3_NEW[category];
  const ref = REGULATION_CITATIONS.IEC60422_2024_TABLE3_NEW + " — Category " + category;
  const rows = [];
  if (hasVal(moisture)) rows.push({ key: "moisture", label: "Độ ẩm dầu", value: Number(moisture), unit: "mg/kg (≈ppm)", direction: "le", limit: "≤ " + L.moisture, verdict: Number(moisture) <= L.moisture ? "Đạt" : "Không đạt", ref });
  if (hasVal(tgd90)) rows.push({ key: "tgd90", label: "Tổn hao điện môi tgδ (90°C)", value: Number(tgd90), unit: "%", direction: "le", limit: "≤ " + L.tgd90, verdict: Number(tgd90) <= L.tgd90 ? "Đạt" : "Không đạt", ref });
  if (hasVal(bdv)) rows.push({ key: "bdv", label: "Điện áp chọc thủng dầu", value: Number(bdv), unit: "kV", direction: "ge", limit: "≥ " + L.bdv, verdict: Number(bdv) >= L.bdv ? "Đạt" : "Không đạt", ref });
  return rows;
}

// ---------------------------------------------------------------------------
// 4) Tiện ích theo BẢN GHI đã lưu (dùng chung tab Lý-Hóa dầu, Lịch sử, Cảnh báo)
// ---------------------------------------------------------------------------

/** Các chỉ tiêu bổ sung đang có giá trị trên 1 bản ghi oil_tests. */
function oilExtraFromRecord(rec) {
  const o = {};
  OIL_EXT_FIELDS.forEach((f) => { if (rec && hasVal(rec[f])) o[f] = rec[f]; });
  return o;
}

/** Khóa chuỗi số liệu CÙNG 1 thùng dầu: Trạm + Thiết bị (bỏ khoảng trắng thừa, không phân biệt hoa/thường)
 *  + Pha (chỉ khi lấy mẫu riêng từng pha). */
function oilSeriesKey(rec) {
  const n = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  const sp = rec ? rec.oil_sample_point || rec.oltc_sample_point : "";
  const phase = sp === "pharieng" ? String(rec.phase || "").trim() : "";
  return `${n(rec && rec.tram)}|${n(rec && rec.thiet_bi)}|${phase}`;
}

/** Đánh giá 1 bản ghi dầu OLTC (oltc_oil_tests) — Điều 37: dầu MỚI như dầu thùng chính (đủ chỉ tiêu bổ sung),
 *  dầu VẬN HÀNH theo Bảng 49 (BDV, độ ẩm); chỉ tiêu bổ sung khi vận hành chỉ ghi nhận (xem evaluateOltcOilTest()). */
function evaluateOltcRecord(rec, manufacturerOilStandards, allRecords) {
  return evaluateOltcOilTest({
    oltcSamplePoint: rec.oltc_sample_point, voltageClass: rec.voltage_class, oilState: rec.oil_state,
    hasMembraneN2: rec.has_membrane_n2, manufacturer: rec.manufacturer || null, manufacturerOilStandards,
    moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
    extra: oilExtraFromRecord(rec), prevFlashPoint: findPreviousOilFlashPoint(allRecords, rec), oxMethod: rec.ox_method || "",
  });
}

/** Nhiệt độ chớp cháy của lần thí nghiệm LIỀN TRƯỚC (ngày lấy mẫu nhỏ hơn hẳn) cùng thùng dầu — Điều 51
 *  ("trong vận hành không được giảm quá 5°C"). null nếu chưa có. */
function findPreviousOilFlashPoint(records, rec) {
  if (!rec || !rec.sample_date) return null;
  const key = oilSeriesKey(rec);
  const t = new Date(rec.sample_date).getTime();
  let best = null;
  (records || []).forEach((r) => {
    if (r === rec || (rec.id && r.id === rec.id)) return;
    if (!hasVal(r.flash_point_c) || oilSeriesKey(r) !== key) return;
    const rt = new Date(r.sample_date).getTime();
    if (!(rt < t)) return;
    if (!best || rt > best.t) best = { t: rt, v: Number(r.flash_point_c) };
  });
  return best ? best.v : null;
}

/** Đánh giá QĐ1901 cho 1 bản ghi oil_tests (3 chỉ tiêu cơ bản + chỉ tiêu bổ sung). */
function evaluateOilRecord(rec, manufacturerOilStandards, allRecords) {
  return evaluateOilTest({
    voltageClass: rec.voltage_class, oilState: rec.oil_state, hasMembraneN2: rec.has_membrane_n2,
    manufacturer: rec.manufacturer || null, manufacturerOilStandards,
    moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
    extra: oilExtraFromRecord(rec), prevFlashPoint: findPreviousOilFlashPoint(allRecords, rec), oxMethod: rec.ox_method || "",
  });
}

/** Đánh giá tham khảo IEC 60422:2024 cho 1 bản ghi oil_tests. */
function evaluateIec60422OilRecord(rec, allRecords) {
  return evaluateIec60422MbaOilTest({
    voltageClass: rec.voltage_class, oilState: rec.oil_state,
    moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
    extra: oilExtraFromRecord(rec), prevFlashPoint: findPreviousOilFlashPoint(allRecords, rec), inhibited: rec.oil_inhibited || "",
  });
}

/** Kết luận chung từ danh sách dòng: bỏ qua dòng "Không có ngưỡng"; xấu nhất thắng. */
function oilOverallFromRows(rows) {
  const judged = rows.filter((r) => r.verdict === "Đạt" || r.verdict === "Không đạt" || r.verdict === "Cảnh báo");
  if (judged.length === 0) return "Chưa đủ dữ liệu";
  if (judged.some((r) => r.verdict === "Không đạt")) return "Không đạt";
  if (judged.some((r) => r.verdict === "Cảnh báo")) return "Cảnh báo";
  return "Đạt";
}
