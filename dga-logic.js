/*
 * dga-logic.js
 * Toàn bộ công thức đánh giá DGA (Dissolved Gas Analysis) dùng chung cho web app.
 * Căn cứ:
 *  - Quyết định 1901/QĐ-EVNNPT ngày 29/9/2025 (Điều 10 - TI, Bảng 12;
 *    Điều 54 - phân tích khí hòa tan dầu MBA, Bảng 63-66).
 *  - IEC 60599:1999 (Table 2 = Bảng 66; mục 5.3/6.1(c); mục 8.4 = tốc độ sinh khí;
 *    Annex A (informative) — A.1 Máy biến áp lực, A.3 Máy biến áp đo lường (TI/TU),
 *    A.4 Sứ xuyên (Bushing) — các bảng nồng độ khí điển hình/tối đa theo từng loại
 *    thiết bị; Annex B (informative), Figure B.3 — Tam giác Duval (Duval's triangle),
 *    bảng "Limits of zones" gốc).
 *
 * Không phụ thuộc DOM / framework — dùng được cả trong app.js (trình duyệt)
 * lẫn trong Node (unit test).
 */

const GASES = ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2"];

// ---------------------------------------------------------------------------
// 1) Loại thiết bị
// ---------------------------------------------------------------------------

const EQUIPMENT_TYPES = {
  TI: "TI (biến dòng điện)",
  TU: "TU (biến điện áp)",
  MBA: "MBA/Kháng dầu",
  BUSHING: "Sứ xuyên (Bushing)",
  OTHER: "Khác",
};

// Phân loại MBA theo cấu trúc OLTC (bộ đổi nấc có tải / CPC) — quyết định bảng
// IEC Annex A.1.4 (Table A.2) nào áp dụng khi tính "tiêu chuẩn chặt hơn".
const MBA_SUBTYPES = {
  NO_OLTC: "Không có CPC (hoặc CPC không thông dầu/khí với thùng chính)",
  COMM_OLTC: "CPC có thông dầu/khí với thùng chính",
};

// Phân loại máy biến áp đo lường — quyết định bảng IEC Annex A.3 (Table A.6) áp dụng
// (chỉ ảnh hưởng khoảng "điển hình" tham khảo, KHÔNG ảnh hưởng ngưỡng tuyệt đối vì
// bảng "giá trị tối đa cho phép" của IEC trùng với QĐ1901 Bảng 12 cho cả CT lẫn VT).
const INSTRUMENT_SUBTYPES = {
  CT: "CT / TI (biến dòng điện)",
  VT: "VT / TU (biến điện áp)",
};

// ---------------------------------------------------------------------------
// 2) Tiêu chuẩn mặc định QĐ1901/EVNNPT
// ---------------------------------------------------------------------------

// Bảng 12, Điều 10 — TI kiểu kín, giá trị hàm lượng khí hòa tan CỰC ĐẠI (đạt/không đạt chính thức).
// Bảng này trùng khớp hoàn toàn với "maximum admissible values for sealed instrument
// transformers" của IEC 60599:1999, Annex A.3.4 — áp dụng chung cho cả TI (CT) và TU (VT).
const QD1901_BANG12_TI = { H2: 300, CH4: 30, C2H6: 50, C2H4: 10, C2H2: 2, CO: 300, CO2: 900 };

// Bảng 64, Điều 54 — MBA, cận trên khoảng giá trị hàm lượng khí ĐIỂN HÌNH (sàng lọc/tham khảo, không phải giới hạn bắt buộc)
const QD1901_BANG64_MBA = { H2: 150, CH4: 130, C2H6: 90, C2H4: 280, C2H2: 20, CO: 600, CO2: 14000 };

// Bảng 65, Điều 54 — MBA, khoảng tốc độ tăng hàm lượng khí điển hình (ppm/năm)
const QD1901_BANG65_RATE = {
  H2: [35, 132], CH4: [10, 120], C2H6: [5, 90], C2H4: [32, 146],
  C2H2: [0, 4], CO: [260, 1060], CO2: [1700, 10000],
};

// Ngưỡng CH4/H2 cho mã Phóng điện cục bộ (PD) — Bảng 66 / Table 2 IEC60599 mục 5.3.
// IEC 60599:1999 quy định ngưỡng này KHÁC NHAU theo loại thiết bị:
//  - Mặc định (MBA lực và các loại khác): < 0,1  (mục 5.3, Table 2)
//  - Máy biến áp đo lường (TI/TU), mục A.3.3: < 0,2 thay vì < 0,1
//  - Sứ xuyên (Bushing), mục A.4.3/Table A.8:  < 0,07
const DEFAULT_PD_THRESHOLD = 0.1;
const PD_THRESHOLD_BY_TYPE = {
  [EQUIPMENT_TYPES.TI]: 0.2,
  [EQUIPMENT_TYPES.TU]: 0.2,
  [EQUIPMENT_TYPES.MBA]: DEFAULT_PD_THRESHOLD,
  [EQUIPMENT_TYPES.BUSHING]: 0.07,
  [EQUIPMENT_TYPES.OTHER]: DEFAULT_PD_THRESHOLD,
};

function pdThresholdForType(equipmentType) {
  return PD_THRESHOLD_BY_TYPE[equipmentType] ?? DEFAULT_PD_THRESHOLD;
}

// ---------------------------------------------------------------------------
// 2bis) IEC 60599:1999 Annex A — bảng nồng độ khí tham khảo theo TỪNG LOẠI THIẾT BỊ
//       (dùng để: (a) tính "tiêu chuẩn chặt hơn" so với QĐ1901 khi có thể so sánh,
//       (b) làm ngưỡng riêng khi QĐ1901 không có bảng tương ứng — sứ xuyên,
//       (c) làm khoảng "điển hình" tham khảo chính xác hơn theo phân nhóm thiết bị).
// ---------------------------------------------------------------------------

// Annex A.1.4, Table A.2 — Máy biến áp lực, khoảng giá trị điển hình 90% (µl/l), cận trên dùng làm ngưỡng so sánh
const IEC_A2_POWER_TRANSFORMER = {
  [MBA_SUBTYPES.NO_OLTC]: { H2: 150, CO: 900, CO2: 13000, CH4: 110, C2H6: 90, C2H4: 280, C2H2: 50 },
  [MBA_SUBTYPES.COMM_OLTC]: { H2: 150, CO: 850, CO2: 12000, CH4: 130, C2H6: 70, C2H4: 250, C2H2: 270 },
};

// Annex A.3.4 — "maximum admissible values for sealed instrument transformers" — trùng QĐ1901 Bảng 12
const IEC_A6_INSTRUMENT_MAX = { H2: 300, CO: 300, CO2: 900, CH4: 30, C2H6: 50, C2H4: 10, C2H2: 2 };

// Annex A.3.4, Table A.6 — khoảng giá trị điển hình 90% theo phân nhóm CT/VT (µl/l), cận trên
const IEC_A6_INSTRUMENT_TYPICAL = {
  [INSTRUMENT_SUBTYPES.CT]: { H2: 300, CO: 1100, CO2: 4000, CH4: 120, C2H6: 130, C2H4: 40, C2H2: 5 },
  // VT: bảng gốc chỉ công bố H2/C2H4/C2H2; các khí còn lại không có số liệu riêng cho VT trong Annex A.3.4
  [INSTRUMENT_SUBTYPES.VT]: { H2: 1000, CO: null, CO2: null, CH4: null, C2H6: null, C2H4: 30, C2H2: 16 },
};

// Annex A.4.4, Table A.9 — Sứ xuyên (bushing), giá trị điển hình 95% (µl/l) — KHÔNG có bảng QĐ1901 tương ứng
const IEC_A9_BUSHING = { H2: 140, CO: 1000, CO2: 3400, CH4: 40, C2H6: 70, C2H4: 30, C2H2: 2 };

function elementWiseMin(a, b) {
  const out = {};
  GASES.forEach((g) => {
    const av = a ? a[g] : undefined;
    const bv = b ? b[g] : undefined;
    const hasA = av !== undefined && av !== null;
    const hasB = bv !== undefined && bv !== null;
    if (hasA && hasB) out[g] = Math.min(av, bv);
    else if (hasA) out[g] = av;
    else if (hasB) out[g] = bv;
    else out[g] = null;
  });
  return out;
}

function defaultAbsoluteStandard(equipmentType) {
  return equipmentType === EQUIPMENT_TYPES.MBA
    ? { ...QD1901_BANG64_MBA }
    : { ...QD1901_BANG12_TI };
}

/**
 * Ngưỡng "điển hình" tham khảo chính xác nhất hiện có theo loại thiết bị/phân nhóm —
 * dùng cho countExceedTypical() (điều kiện áp dụng tỷ lệ khí, Điều 54 QĐ1901/6.1(c) IEC60599).
 */
function typicalReferenceStandard(equipmentType, subtype) {
  if (equipmentType === EQUIPMENT_TYPES.MBA) {
    return { ...QD1901_BANG64_MBA };
  }
  if (equipmentType === EQUIPMENT_TYPES.TI) {
    return { ...IEC_A6_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.CT] };
  }
  if (equipmentType === EQUIPMENT_TYPES.TU) {
    // Bù các khí VT không có số liệu riêng bằng số liệu CT (cùng Annex A.3.4)
    return { ...IEC_A6_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.CT], ...pickNonNull(IEC_A6_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.VT]) };
  }
  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    return { ...IEC_A9_BUSHING };
  }
  return { ...QD1901_BANG12_TI };
}

function pickNonNull(obj) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    if (obj[k] !== null && obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

// ---------------------------------------------------------------------------
// 3) Chọn tiêu chuẩn áp dụng: ưu tiên tiêu chuẩn nhà sản xuất (nếu có cấu hình đầy
//    đủ cho loại thiết bị đó); nếu không, áp dụng tiêu chuẩn CHẶT HƠN giữa QĐ1901
//    và bảng tham khảo tương ứng của IEC 60599 Annex A (theo yêu cầu người dùng);
//    nếu QĐ1901 không có bảng tương ứng (sứ xuyên), dùng trực tiếp IEC Annex A.
// ---------------------------------------------------------------------------

/**
 * Ngưỡng LOẠI BỎ (condemning limit) — khác với ngưỡng tuyệt đối "Đạt/Không đạt" ở trên:
 * đây là ngưỡng nghiêm trọng hơn, do TỪNG NHÀ SẢN XUẤT tự quy định riêng (QĐ1901/IEC
 * không có khái niệm này), dùng để cảnh báo mức nguy hiểm cao hơn mức "không đạt" thông
 * thường (ví dụ: khuyến cáo ngừng vận hành/loại bỏ dầu hoặc thiết bị). Không bắt buộc
 * cấu hình đủ 7 khí — nhà sản xuất có thể chỉ đặt ngưỡng loại bỏ cho 1 vài khí quan
 * trọng (thường là C2H2, H2), các khí còn lại để trống sẽ không bị kiểm tra.
 * Độc lập với việc ngưỡng tuyệt đối của NSX có được cấu hình đủ 7 khí hay không.
 */
function resolveCondemningLimits(measurement, manufacturerStandards) {
  const match = (manufacturerStandards || []).find(
    (s) => s.manufacturer === measurement.manufacturer && s.equipmentType === measurement.equipmentType
  );
  if (!match || !match.condemning) return null;
  const hasAny = GASES.some((g) => match.condemning[g] !== undefined && match.condemning[g] !== null && match.condemning[g] !== "");
  return hasAny ? match.condemning : null;
}

/**
 * @param {object} measurement { equipmentType, manufacturer, mbaSubtype?, instrumentSubtype? }
 * @param {Array}  manufacturerStandards danh sách { manufacturer, equipmentType, limits, rate, condemning, source } do người dùng cấu hình
 * @returns {{ limits: object, rate: object, sourceLabel: string, isManufacturer: boolean, pdThreshold: number, typical: object, condemning: object|null }}
 */
function resolveStandard(measurement, manufacturerStandards) {
  const equipmentType = measurement.equipmentType;
  const pdThreshold = pdThresholdForType(equipmentType);
  const typical = typicalReferenceStandard(equipmentType, measurement);
  const condemning = resolveCondemningLimits(measurement, manufacturerStandards);

  const match = (manufacturerStandards || []).find(
    (s) => s.manufacturer === measurement.manufacturer && s.equipmentType === equipmentType
  );
  if (match && match.limits && GASES.every((g) => match.limits[g] !== undefined && match.limits[g] !== null && match.limits[g] !== "")) {
    return {
      limits: match.limits,
      rate: match.rate && GASES.every((g) => match.rate[g]) ? match.rate : QD1901_BANG65_RATE,
      sourceLabel: `Tiêu chuẩn nhà sản xuất: ${match.manufacturer}${match.source ? " (" + match.source + ")" : ""}`,
      isManufacturer: true,
      pdThreshold,
      typical,
      condemning,
    };
  }

  if (equipmentType === EQUIPMENT_TYPES.MBA) {
    const subtype = measurement.mbaSubtype || MBA_SUBTYPES.NO_OLTC;
    const iecTable = IEC_A2_POWER_TRANSFORMER[subtype] || IEC_A2_POWER_TRANSFORMER[MBA_SUBTYPES.NO_OLTC];
    const blended = elementWiseMin(QD1901_BANG64_MBA, iecTable);
    return {
      limits: blended,
      rate: QD1901_BANG65_RATE,
      sourceLabel: `Chặt hơn giữa QĐ1901 Bảng 64 (Điều 54) và IEC 60599:1999 Annex A.1 Table A.2 (${subtype})`,
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  if (equipmentType === EQUIPMENT_TYPES.TI || equipmentType === EQUIPMENT_TYPES.TU) {
    // QĐ1901 Bảng 12 và IEC Annex A.3.4 "maximum admissible values" trùng khớp hoàn toàn
    // cho cả CT và VT — không có gì để "chặt hơn", dùng chung một bộ.
    const blended = elementWiseMin(QD1901_BANG12_TI, IEC_A6_INSTRUMENT_MAX);
    return {
      limits: blended,
      rate: QD1901_BANG65_RATE,
      sourceLabel: "QĐ1901 Bảng 12 (Điều 10) = IEC 60599:1999 Annex A.3.4 (giá trị tối đa cho phép, máy biến áp đo lường kiểu kín)",
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    return {
      limits: { ...IEC_A9_BUSHING },
      rate: QD1901_BANG65_RATE,
      sourceLabel: "IEC 60599:1999 Annex A.4.4 Table A.9 (giá trị điển hình 95%, sứ xuyên) — QĐ1901 chưa có bảng riêng cho sứ xuyên",
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  return {
    limits: defaultAbsoluteStandard(equipmentType),
    rate: QD1901_BANG65_RATE,
    sourceLabel: "QĐ1901 Bảng 12 (Điều 10) — mặc định do chưa xác định loại thiết bị/chưa có tiêu chuẩn nhà sản xuất",
    isManufacturer: false,
    pdThreshold,
    typical,
    condemning,
  };
}

// ---------------------------------------------------------------------------
// 4) Tổng khí cháy (TCG) & đánh giá giá trị tuyệt đối
// ---------------------------------------------------------------------------

function computeTCG(gases) {
  return (
    num(gases.H2) + num(gases.CH4) + num(gases.C2H6) + num(gases.C2H4) + num(gases.C2H2) + num(gases.CO)
  ); // TCG không tính CO2
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Đánh giá từng khí so với ngưỡng áp dụng (limits).
 * @returns {Array<{gas, value, limit, verdict}>}
 */
function evaluateAbsolute(gases, limits) {
  return GASES.map((gas) => {
    const value = num(gases[gas]);
    const limit = limits[gas];
    const hasLimit = limit !== undefined && limit !== null && limit !== "";
    const verdict = !hasLimit ? "Không có ngưỡng" : value <= limit ? "Đạt" : "Không đạt";
    return { gas, value, limit: hasLimit ? limit : null, verdict };
  });
}

function overallVerdict(evalRows) {
  const failing = evalRows.filter((r) => r.verdict === "Không đạt");
  if (failing.length === 0) return "Đạt";
  return "Không đạt: " + failing.map((r) => r.gas).join(", ");
}

/**
 * Đánh giá theo ngưỡng LOẠI BỎ (condemning limit) của nhà sản xuất — chỉ kiểm tra
 * các khí mà nhà sản xuất có cấu hình (bỏ qua khí không cấu hình, khác với
 * evaluateAbsolute() vốn duyệt đủ 7 khí).
 * @param {object} gases
 * @param {object|null} condemningLimits { gas: value, ... } — kết quả từ resolveStandard().condemning
 * @returns {Array<{gas, value, limit, exceeded}>}
 */
function evaluateCondemning(gases, condemningLimits) {
  if (!condemningLimits) return [];
  return GASES.filter((g) => condemningLimits[g] !== undefined && condemningLimits[g] !== null && condemningLimits[g] !== "").map((g) => {
    const value = num(gases[g]);
    const limit = condemningLimits[g];
    return { gas: g, value, limit, exceeded: value > limit };
  });
}

function condemningExceededRows(condemningRows) {
  return (condemningRows || []).filter((r) => r.exceeded);
}

// Số khí vượt giá trị ĐIỂN HÌNH theo loại thiết bị/phân nhóm (dùng để xét điều kiện áp
// dụng tỷ lệ khí), tách biệt với ngưỡng áp dụng đã chọn (có thể là NSX/chặt hơn) — theo
// đúng nguyên tắc "điển hình" của Điều 54 QĐ1901 / mục 6.1(c) IEC60599.
function countExceedTypical(gases, equipmentType, subtypeOrMeasurement) {
  const measurement = typeof subtypeOrMeasurement === "object" && subtypeOrMeasurement !== null
    ? subtypeOrMeasurement
    : {};
  const typical = typicalReferenceStandard(equipmentType, measurement);
  return GASES.filter((g) => typical[g] !== null && typical[g] !== undefined && num(gases[g]) > typical[g]).length;
}

// ---------------------------------------------------------------------------
// 5) Tỷ lệ khí cơ bản & mã chẩn đoán (Bảng 66, QĐ1901/Điều 54 = Table 2, IEC 60599:1999)
// ---------------------------------------------------------------------------

function computeRatios(gases) {
  const c2h2 = num(gases.C2H2), c2h4 = num(gases.C2H4), c2h6 = num(gases.C2H6), h2 = num(gases.H2), ch4 = num(gases.CH4);
  const r1 = c2h4 === 0 ? (c2h2 === 0 ? 0 : 999) : c2h2 / c2h4; // C2H2/C2H4
  const r2 = h2 === 0 ? 999 : ch4 / h2; // CH4/H2
  const r3 = c2h6 === 0 ? 999 : c2h4 / c2h6; // C2H4/C2H6
  return { c2h2_c2h4: r1, ch4_h2: r2, c2h4_c2h6: r3 };
}

/**
 * Tra mã khiếm khuyết theo Bảng 66 / Table 2 IEC 60599:1999.
 * @param {{c2h2_c2h4:number, ch4_h2:number, c2h4_c2h6:number}} ratios
 * @param {number} pdThreshold ngưỡng CH4/H2 cho PD — mặc định 0,1; dùng 0,2 cho TI/TU
 *   (Annex A.3.3) hoặc 0,07 cho sứ xuyên (Annex A.4.3/Table A.8) thay vì luôn cố định 0,1.
 */
function diagnoseRatios(ratios, pdThreshold) {
  const g = ratios.c2h2_c2h4, h = ratios.ch4_h2, i = ratios.c2h4_c2h6;
  const pd = pdThreshold === undefined || pdThreshold === null ? DEFAULT_PD_THRESHOLD : pdThreshold;
  if (h < pd && i < 0.2) return "PD - Phóng điện cục bộ";
  if (g > 1 && h >= 0.1 && h <= 0.5 && i > 1 && g >= 0.6 && g <= 2.5 && h <= 1) return "D1/D2 - Phóng điện (vùng chồng lấn)";
  if (g > 1 && h >= 0.1 && h <= 0.5 && i > 1) return "D1 - Phóng điện năng lượng thấp";
  if (g >= 0.6 && g <= 2.5 && h >= 0.1 && h <= 1 && i > 2) return "D2 - Phóng điện năng lượng cao";
  if (h > 1 && i < 1) return "T1 - Tăng nhiệt, t<300°C";
  if (g < 0.1 && h > 1 && i >= 1 && i <= 4) return "T2 - Tăng nhiệt, 300-700°C";
  if (g < 0.2 && h > 1 && i > 4) return "T3 - Tăng nhiệt, t>700°C";
  return "Không xác định (ngoài Bảng 66/hỗn hợp khiếm khuyết)";
}

/**
 * Điều kiện áp dụng tỷ lệ khí theo Điều 54 QĐ1901 / mục 6.1(c) IEC60599:
 * tỷ lệ chỉ có ý nghĩa chẩn đoán khi có ít nhất 1 khí vượt giá trị điển hình.
 */
function ratioApplicability(exceedCount) {
  return exceedCount > 0
    ? "Đủ điều kiện – có khí vượt giá trị điển hình"
    : "Chưa đủ điều kiện chính thức – tỷ lệ chỉ mang tính tham khảo (Điều 54 QĐ1901/mục 6.1(c) IEC60599)";
}

// ---------------------------------------------------------------------------
// 6) Tam giác Duval (Duval Triangle 1) — IEC 60599:1999 Annex B, Figure B.3
//    Chẩn đoán dạng sự cố bằng %CH4, %C2H4, %C2H2 (quy về tổng = 100%).
//    Ranh giới vùng lấy đúng theo bảng "Limits of zones" gốc trong Annex B:
//      PD: %CH4 ≥ 98
//      D1: %C2H4 ≤ 23  và %C2H2 ≥ 13
//      D2: 23 < %C2H4 ≤ 38  và %C2H2 ≥ 13
//      T1: %C2H2 ≤ 4  và %C2H4 ≤ 10
//      T2: %C2H2 ≤ 4  và 10 < %C2H4 ≤ 50
//      T3: %C2H4 > 50 (khi %C2H2 ≤ 4); hoặc %C2H2 ≥ 13 và %C2H4 > 38
//    Phần diện tích còn lại (khoảng 4% < %C2H2 < 13%, không thuộc T3 nêu trên) là
//    vùng ranh giới "D+T" mà chính hình vẽ gốc IEC 60599:1999 (Figure B.3) cũng ghi
//    chú là chồng lấn/không phân định rõ giữa phóng điện và tăng nhiệt — công cụ trả
//    về nhãn riêng cho vùng này thay vì gán cứng vào D2 hoặc T3.
// ---------------------------------------------------------------------------

/**
 * Quy đổi 3 khí về % trên tổng (CH4 + C2H4 + C2H2) = 100%.
 * @returns {{ pctCH4:number, pctC2H4:number, pctC2H2:number } | null} null nếu tổng = 0
 */
function normalizeDuval(gases) {
  const ch4 = num(gases.CH4), c2h4 = num(gases.C2H4), c2h2 = num(gases.C2H2);
  const sum = ch4 + c2h4 + c2h2;
  if (sum <= 0) return null;
  return {
    pctCH4: (ch4 / sum) * 100,
    pctC2H4: (c2h4 / sum) * 100,
    pctC2H2: (c2h2 / sum) * 100,
  };
}

/**
 * Phân vùng Tam giác Duval 1 theo bảng "Limits of zones", Annex B, Figure B.3, IEC 60599:1999.
 * @param {{pctCH4:number, pctC2H4:number, pctC2H2:number}} pct
 * @returns {{ zone: string, label: string }}
 */
function classifyDuval1(pct) {
  const { pctCH4: m, pctC2H4: e, pctC2H2: a } = pct;

  if (m >= 98) return { zone: "PD", label: "PD - Phóng điện cục bộ (Tam giác Duval)" };

  if (a <= 4) {
    if (e <= 10) return { zone: "T1", label: "T1 - Tăng nhiệt, t<300°C (Tam giác Duval)" };
    if (e <= 50) return { zone: "T2", label: "T2 - Tăng nhiệt, 300-700°C (Tam giác Duval)" };
    return { zone: "T3", label: "T3 - Tăng nhiệt, t>700°C (Tam giác Duval)" };
  }

  if (a >= 13) {
    if (e <= 23) return { zone: "D1", label: "D1 - Phóng điện năng lượng thấp (Tam giác Duval)" };
    if (e <= 38) return { zone: "D2", label: "D2 - Phóng điện năng lượng cao (Tam giác Duval)" };
    return { zone: "T3", label: "T3 - Tăng nhiệt, t>700°C (Tam giác Duval, vùng %C2H4 cao)" };
  }

  if (e > 50) return { zone: "T3", label: "T3 - Tăng nhiệt, t>700°C (Tam giác Duval)" };

  return {
    zone: "D+T",
    label: "D+T - Vùng chồng lấn phóng điện/tăng nhiệt (ranh giới không phân định rõ trong Tam giác Duval gốc IEC60599 Annex B)",
  };
}

/**
 * Tọa độ (x,y) để vẽ điểm trên tam giác đều (đỉnh CH4 ở trên, C2H2 dưới-trái, C2H4 dưới-phải),
 * cạnh đáy = 100 đơn vị, chiều cao = 100*sqrt(3)/2 ≈ 86,6 đơn vị.
 */
function duvalPlotXY(pct) {
  const h = 50 * Math.sqrt(3);
  const x = (pct.pctCH4 / 100) * 50 + (pct.pctC2H4 / 100) * 100;
  const y = (pct.pctCH4 / 100) * h;
  return { x, y };
}

/**
 * Hàm tiện ích tổng hợp: từ 1 bộ khí -> % chuẩn hóa + phân vùng (hoặc null nếu không đủ dữ liệu).
 */
function diagnoseDuval1(gases) {
  const pct = normalizeDuval(gases);
  if (!pct) return null;
  const result = classifyDuval1(pct);
  return { ...pct, ...result, xy: duvalPlotXY(pct) };
}

// ---------------------------------------------------------------------------
// 7) Tốc độ tăng hàm lượng khí giữa 2 lần đo (ppm/năm, Bảng 65, Điều 54 QĐ1901)
// ---------------------------------------------------------------------------

/**
 * @param {object} prevGases, {object} currGases  cùng đơn vị ppm
 * @param {number} deltaDays  số ngày giữa 2 lần đo
 * @param {object} rateRanges { gas: [lo, hi] } ppm/năm — mặc định Bảng 65 hoặc NSX nếu có cấu hình
 * @param {string} equipmentType dùng để ghi chú áp dụng chính thức (MBA) hay tham khảo (khác)
 */
function computeRateOfChange(prevGases, currGases, deltaDays, rateRanges, equipmentType) {
  if (!deltaDays || deltaDays <= 0) return null;
  const official = equipmentType === EQUIPMENT_TYPES.MBA;
  return GASES.map((gas) => {
    const before = num(prevGases[gas]);
    const after = num(currGases[gas]);
    const delta = after - before;
    const ratePerYear = (delta / deltaDays) * 365;
    const ratePerMonth = before === 0 ? null : (delta / before) / (deltaDays / 30) * 100;
    const [lo, hi] = rateRanges[gas] || QD1901_BANG65_RATE[gas];
    let verdict;
    if (delta < 0) verdict = "Giảm — có thể do lọc/xử lý/thay dầu, hoặc khiếm khuyết cũ ngừng phát triển";
    else if (ratePerYear > hi) verdict = "⚠ Vượt cận trên Bảng 65 — nghi khiếm khuyết đang phát triển";
    else if (ratePerYear < lo) verdict = "Dưới cận dưới Bảng 65 — tốc độ thấp, bình thường";
    else verdict = "Trong khoảng điển hình Bảng 65";
    return {
      gas, before, after, delta,
      ratePerYear: round1(ratePerYear),
      ratePerMonth: ratePerMonth === null ? null : round1(ratePerMonth),
      rangeLo: lo, rangeHi: hi, verdict,
      officialForEquipment: official,
    };
  });
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// 8) Khuyến cáo tổng hợp — tổng hợp kết luận tuyệt đối + chẩn đoán tỷ lệ (Bảng 66) +
//    chẩn đoán Tam giác Duval + tốc độ sinh khí.
//    Chỉ mang tính hỗ trợ; không thay thế nguyên tắc đánh giá tổng thể tại Điều 3, QĐ1901.
// ---------------------------------------------------------------------------

function buildRecommendations({ overallOk, exceedCount, diagnosis, duval, rateRows, condemningRows }) {
  const recs = [];
  const rateWarnings = (rateRows || []).filter((r) => r.verdict && r.verdict.startsWith("⚠"));
  const condemnExceeded = condemningExceededRows(condemningRows);

  if (condemnExceeded.length > 0) {
    recs.push(
      `⚠ CẢNH BÁO NGHIÊM TRỌNG — VƯỢT NGƯỠNG LOẠI BỎ do nhà sản xuất quy định ở ${condemnExceeded.length} khí ` +
      `(${condemnExceeded.map((r) => `${r.gas}: ${r.value} > ${r.limit}`).join("; ")}) — đây là ngưỡng nghiêm trọng ` +
      `hơn mức "không đạt" thông thường; khuyến cáo báo cáo ngay cấp có thẩm quyền và xem xét ngừng vận hành/xử lý ` +
      `khẩn cấp theo quy trình nội bộ, không chờ đến chu kỳ giám sát tiếp theo.`
    );
  }
  if (overallOk && exceedCount === 0 && rateWarnings.length === 0 && condemnExceeded.length === 0) {
    recs.push("Kết quả trong giới hạn/khoảng điển hình — tiếp tục giám sát định kỳ theo chu kỳ quy định (Điều 3, 7, QĐ1901).");
  }
  if (!overallOk) {
    recs.push("Có khí vượt ngưỡng đạt/không đạt — đề nghị lấy mẫu bổ sung xác nhận (điện áp đánh thủng, tgδ, hàm lượng nước) và báo cáo cấp có thẩm quyền theo Điều 6, QĐ1901.");
  }
  if (exceedCount > 0 && diagnosis && diagnosis !== "Không xác định (ngoài Bảng 66/hỗn hợp khiếm khuyết)") {
    if (diagnosis.startsWith("PD")) recs.push("Mã chẩn đoán Bảng 66: PD (phóng điện cục bộ) — khuyến cáo đo phóng điện cục bộ (PD) bổ sung nếu điều kiện cho phép.");
    else if (diagnosis.startsWith("D1") || diagnosis.startsWith("D2")) recs.push("Mã chẩn đoán Bảng 66: phóng điện (D1/D2) — khuyến cáo kiểm tra cách điện, siết lại kết nối, xem xét thí nghiệm điện môi bổ sung.");
    else if (diagnosis.startsWith("T")) recs.push("Mã chẩn đoán Bảng 66: tăng nhiệt (T1/T2/T3) — khuyến cáo kiểm tra mối nối/tiếp xúc, tải vận hành, và nhiệt độ điểm nóng nếu có điều kiện đo.");
  }
  if (duval && duval.zone) {
    if (duval.zone === "D+T") {
      recs.push("Tam giác Duval rơi vào vùng chồng lấn phóng điện/tăng nhiệt (D+T, ranh giới không phân định rõ trong hình gốc IEC60599 Annex B) — nên đối chiếu thêm với mã Bảng 66 và các pha/lần đo khác trước khi kết luận dạng sự cố.");
    } else if (diagnosis && diagnosis.startsWith(duval.zone)) {
      recs.push(`Tam giác Duval cho cùng kết quả với Bảng 66 (${duval.zone}) — tăng độ tin cậy của chẩn đoán.`);
    } else if (!diagnosis || !diagnosis.startsWith(duval.zone.split("/")[0])) {
      recs.push(`Lưu ý: Tam giác Duval cho mã ${duval.zone}, khác với mã tra theo Bảng 66/Ba tỷ số khí cơ bản ở trên — hai phương pháp có thể lệch nhau khi khí ở gần ranh giới vùng; nên đối chiếu thêm dữ liệu vận hành/pha khác trước khi kết luận.`);
    }
  }
  if (rateWarnings.length > 0) {
    recs.push(`Tốc độ sinh khí vượt Bảng 65 ở ${rateWarnings.length} khí (${rateWarnings.map((r) => r.gas).join(", ")}) — nghi khiếm khuyết đang phát triển, khuyến cáo rút ngắn chu kỳ giám sát và lấy mẫu DGA lại sớm hơn dự kiến.`);
  }
  if (exceedCount === 0 && diagnosis) {
    recs.push("Chưa đủ điều kiện áp dụng chính thức tỷ lệ khí (chưa có khí vượt giá trị điển hình) — mã chẩn đoán Bảng 66/Tam giác Duval ở trên chỉ mang tính tham khảo.");
  }
  return recs;
}

// ---------------------------------------------------------------------------
// Thí nghiệm dầu MBA: Độ ẩm (Điều 50/Bảng 58), Tổn hao điện môi tgδ ở 90°C
// (Điều 47/Bảng 55), Điện áp chọc thủng (Điều 46/Bảng 54) — theo QĐ1901.
//
// LƯU Ý: 3 bảng này CHỈ áp dụng cho dầu MBA/Kháng dầu theo đúng QĐ1901 (Điều
// 45–56 "dầu MBA"). QĐ1901 không quy định bảng số liệu riêng cho dầu TI/TU —
// với TI/TU, Điều 10/11 ghi rõ "thí nghiệm dầu cách điện theo quy định nhà sản
// xuất". IEC 60599:1999 (đã dùng ở các hạng mục DGA khác trong công cụ này)
// KHÔNG quy định giới hạn độ ẩm/tgδ/điện áp chọc thủng — đó là phạm vi của
// IEC 60422 (hướng dẫn bảo dưỡng dầu), không phải IEC 60599. Vì vậy 3 hạng
// mục này chỉ đánh giá theo đúng bảng số của QĐ1901, không tự suy diễn thêm
// ngưỡng IEC 60422 chưa được người dùng cung cấp số liệu xác nhận.
// ---------------------------------------------------------------------------

const OIL_VOLTAGE_CLASSES = [
  { value: "duoi15", label: "< 15 kV" },
  { value: "15den35", label: "15 – 35 kV" },
  { value: "tren35duoi110", label: "> 35 kV và < 110 kV" },
  { value: "110", label: "110 kV" },
  { value: "220", label: "220 kV" },
  { value: "500", label: "500 kV" },
];

// Bảng 54 (Điều 46) — Điện áp chọc thủng dầu (kV, khe hở 2,5mm), KHÔNG THẤP HƠN.
// "110 đến 220 kV" trong bảng gốc là 1 bậc gộp chung — áp dụng chung cho cả 110kV và 220kV.
const BANG54_BDV = {
  duoi15: { new: 30, inservice: 25 },
  "15den35": { new: 35, inservice: 30 },
  tren35duoi110: { new: 45, inservice: 40 },
  "110": { new: 60, inservice: 55 },
  "220": { new: 60, inservice: 55 },
  "500": { new: 70, inservice: 60 },
};

// Bảng 55 (Điều 47) — Tổn hao điện môi tgδ dầu ở 90°C (%), KHÔNG LỚN HƠN.
// Bảng gốc chỉ có 2 bậc: "Đến 110kV" và "220kV đến 500kV".
const BANG55_TGD90 = {
  duoi15: { new: 1.5, inservice: 10 },
  "15den35": { new: 1.5, inservice: 10 },
  tren35duoi110: { new: 1.5, inservice: 10 },
  "110": { new: 1.5, inservice: 10 },
  "220": { new: 1.0, inservice: 10 },
  "500": { new: 1.0, inservice: 10 },
};

/** Bảng 58 (Điều 50) — Hàm lượng nước trong dầu (ppm), KHÔNG LỚN HƠN. Riêng bậc
 *  ≤110kV có 2 trường hợp tùy có/không bảo vệ bằng màng chất dẻo hoặc nitơ. */
function bang58WaterLimits(voltageClass, hasMembraneN2) {
  const isDen110 = ["duoi15", "15den35", "tren35duoi110", "110"].includes(voltageClass);
  if (isDen110) {
    return hasMembraneN2 ? { new: 10, inservice: 25 } : { new: 20, inservice: 25 };
  }
  return { new: 10, inservice: 20 }; // 220kV và 500kV — cùng trị số trong Bảng 58
}

function hasVal(v) {
  return v !== null && v !== undefined && v !== "";
}

// ---------------------------------------------------------------------------
// Dầu khoang điều áp dưới tải (OLTC) — Điều 37, Bảng 49 QĐ1901.
//
// Khi dầu OLTC MỚI LẮP: Điều 37 mục 3 quy định dùng CHUNG tiêu chuẩn với dầu
// thùng dầu chính MBA (Bảng 54/55/58, CÓ tgδ) — xem evaluateOltcOilTest() bên
// dưới, tái dùng nguyên evaluateOilTest(), KHÔNG dùng bảng này cho "mới lắp".
//
// Khi dầu OLTC ĐANG VẬN HÀNH: dùng Bảng 49 — CHỈ có độ ẩm + điện áp chọc thủng,
// KHÔNG có tiêu chí tgδ. 2 kiểu điểm lấy mẫu có ngưỡng khác nhau:
//  - "trungtinh": OLTC đặt ở điểm cuối trung tính — 3 pha dùng CHUNG 1 khoang/
//    1 mẫu dầu duy nhất, ngưỡng CỐ ĐỊNH, không phân theo cấp điện áp MBA.
//  - "pharieng": OLTC 1 pha (MBA 1 pha) hoặc đặt ở điểm KHÔNG trung tính (MBA 3
//    pha có OLTC riêng từng pha) — mỗi pha A/B/C có khoang/mẫu RIÊNG, ngưỡng
//    phân theo cấp điện áp MBA.
// Bảng gốc CHỈ có 3 bậc cho "pharieng": ≤35kV / 110÷220kV / 500kV — KHÔNG có số
// liệu riêng cho bậc "35kV-110kV" (khác Bảng 54/55/58 dầu chính có đủ 5 bậc).
// Với bậc đó (và với hàm lượng nước ở bậc ≤35kV — bảng gốc để trống "-"),
// evaluateOltcOilTest() trả verdict "Không có ngưỡng" thay vì tự suy diễn số liệu.
// ---------------------------------------------------------------------------

const OLTC_SAMPLE_POINTS = [
  { value: "trungtinh", label: "Điểm cuối trung tính (3 pha dùng chung 1 mẫu)" },
  { value: "pharieng", label: "Một pha / điểm không trung tính (mỗi pha 1 mẫu riêng)" },
];

const BANG49_OLTC = {
  trungtinh: { bdv: 40, moisture: 30 },
  pharieng: {
    duoi15: { bdv: 35, moisture: null },
    "15den35": { bdv: 35, moisture: null },
    tren35duoi110: null, // QĐ1901 Bảng 49 không có số liệu cho bậc này
    "110": { bdv: 50, moisture: 25 },
    "220": { bdv: 50, moisture: 25 },
    "500": { bdv: 60, moisture: 20 },
  },
};

/**
 * Đánh giá 1 lần thử nghiệm dầu khoang điều áp dưới tải (OLTC) theo Điều 37 QĐ1901.
 * oltcSamplePoint: "trungtinh" hoặc "pharieng" (xem OLTC_SAMPLE_POINTS ở trên).
 * oilState: "new" (dầu mới, sau lắp đặt/sau sửa chữa) hoặc "inservice" (dầu vận hành).
 *  - "new": tái dùng NGUYÊN evaluateOilTest() (Bảng 54/55/58, kể cả ưu tiên tiêu
 *    chuẩn nhà sản xuất nếu có cấu hình khớp) — đúng theo Điều 37 mục 3.
 *  - "inservice": dùng Bảng 49 (chỉ độ ẩm + BDV) — KHÔNG áp dụng tiêu chuẩn nhà
 *    sản xuất riêng cho dầu OLTC vận hành (QĐ1901 không có cơ chế đó); tgδ vẫn
 *    cho nhập để theo dõi xu hướng nhưng luôn "Không có ngưỡng" ở trạng thái này.
 */
function evaluateOltcOilTest({ oltcSamplePoint, voltageClass, oilState, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards }) {
  const state = oilState === "new" ? "new" : "inservice";

  if (state === "new") {
    const result = evaluateOilTest({ voltageClass, oilState: state, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards });
    return {
      overall: result.overall,
      rows: result.rows.map((r) => ({
        ...r,
        label: r.label + " (OLTC)",
        ref: r.ref + " — dầu OLTC mới lắp áp dụng như dầu chính MBA (Điều 37 QĐ1901)",
      })),
    };
  }

  const point = oltcSamplePoint === "pharieng" ? "pharieng" : "trungtinh";
  const limits = point === "trungtinh" ? BANG49_OLTC.trungtinh : BANG49_OLTC.pharieng[voltageClass];
  const refBase = "Bảng 49 QĐ1901 (Điều 37)" + (point === "trungtinh" ? " — điểm cuối trung tính" : " — một pha/điểm không trung tính");
  const noDataRef = "QĐ1901 Bảng 49 không có số liệu cho cấp điện áp này — chưa đủ căn cứ, cần tham khảo hướng dẫn nhà sản xuất";

  const rows = [];
  if (hasVal(moisture)) {
    const v = Number(moisture);
    const lim = limits && hasVal(limits.moisture) ? limits.moisture : null;
    rows.push({
      key: "moisture", label: "Độ ẩm dầu OLTC", value: v, limit: lim, unit: "ppm", direction: "le",
      verdict: lim === null ? "Không có ngưỡng" : v <= lim ? "Đạt" : "Không đạt",
      ref: limits === null ? noDataRef : lim === null ? refBase + " — không quy định ngưỡng độ ẩm ở bậc này" : refBase,
    });
  }
  if (hasVal(tgd90)) {
    const v = Number(tgd90);
    rows.push({
      key: "tgd90", label: "Tổn hao điện môi tgδ (90°C) OLTC", value: v, limit: null, unit: "%", direction: "le",
      verdict: "Không có ngưỡng",
      ref: "QĐ1901 Bảng 49 không quy định ngưỡng tgδ cho dầu OLTC khi vận hành — chỉ ghi nhận để theo dõi xu hướng",
    });
  }
  if (hasVal(bdv)) {
    const v = Number(bdv);
    const lim = limits && hasVal(limits.bdv) ? limits.bdv : null;
    rows.push({
      key: "bdv", label: "Điện áp chọc thủng dầu OLTC", value: v, limit: lim, unit: "kV", direction: "ge",
      verdict: lim === null ? "Không có ngưỡng" : v >= lim ? "Đạt" : "Không đạt",
      ref: limits === null ? noDataRef : refBase,
    });
  }

  const overall = rows.length === 0 ? "Chưa đủ dữ liệu" : rows.some((r) => r.verdict === "Không đạt") ? "Không đạt" : "Đạt";
  return { rows, overall };
}

/**
 * Chọn ngưỡng áp dụng cho 3 hạng mục dầu — ưu tiên tiêu chuẩn NHÀ SẢN XUẤT nếu có
 * cấu hình khớp đúng (manufacturer + cấp điện áp + trạng thái dầu), ngược lại dùng
 * bảng QĐ1901 mặc định. Cho phép ghi đè TỪNG hạng mục riêng lẻ (khác với tiêu chuẩn
 * khí — vốn yêu cầu đủ 7 khí mới coi là "tiêu chuẩn nhà sản xuất") vì 1 lần thử
 * nghiệm dầu có thể chỉ đo 1-2 trong 3 hạng mục.
 * @param {object} manufacturerOilStandards { manufacturer, voltageClass, oilState, moisture, tgd90, bdv, source }
 */
function resolveOilLimits({ voltageClass, oilState, hasMembraneN2, manufacturer }, manufacturerOilStandards) {
  const state = oilState === "new" ? "new" : "inservice";
  const bdvDefault = (BANG54_BDV[voltageClass] || BANG54_BDV["220"])[state];
  const tgdDefault = (BANG55_TGD90[voltageClass] || BANG55_TGD90["220"])[state];
  const waterDefault = bang58WaterLimits(voltageClass, !!hasMembraneN2)[state];

  const match = (manufacturerOilStandards || []).find(
    (s) => s.manufacturer === manufacturer && s.voltageClass === voltageClass && s.oilState === state
  );

  function pick(manufVal, defaultVal, defaultRef) {
    if (match && hasVal(manufVal)) {
      return {
        limit: Number(manufVal),
        ref: `Tiêu chuẩn nhà sản xuất: ${match.manufacturer}${match.source ? " (" + match.source + ")" : ""}`,
        isManufacturer: true,
      };
    }
    return { limit: defaultVal, ref: defaultRef, isManufacturer: false };
  }

  return {
    moisture: pick(match && match.moisture, waterDefault, "Bảng 58 QĐ1901 (Điều 50)"),
    tgd90: pick(match && match.tgd90, tgdDefault, "Bảng 55 QĐ1901 (Điều 47)"),
    bdv: pick(match && match.bdv, bdvDefault, "Bảng 54 QĐ1901 (Điều 46)"),
  };
}

/**
 * Đánh giá 1 lần thử nghiệm dầu MBA theo QĐ1901 (hoặc tiêu chuẩn nhà sản xuất nếu
 * có cấu hình khớp — xem resolveOilLimits()). Chỉ đánh giá các hạng mục có nhập giá
 * trị (moisture/tgd90/bdv có thể để trống nếu chưa đo hạng mục đó).
 * oilState: "new" (dầu mới, sau lắp đặt/sau sửa chữa) hoặc "inservice" (dầu vận hành).
 * manufacturer/manufacturerOilStandards: tùy chọn — bỏ qua thì luôn dùng QĐ1901.
 */
function evaluateOilTest({ voltageClass, oilState, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards }) {
  const state = oilState === "new" ? "new" : "inservice";
  const resolved = resolveOilLimits({ voltageClass, oilState: state, hasMembraneN2, manufacturer }, manufacturerOilStandards);

  const rows = [];
  if (hasVal(moisture)) {
    const v = Number(moisture);
    const { limit, ref, isManufacturer } = resolved.moisture;
    rows.push({
      key: "moisture", label: "Độ ẩm dầu", value: v, limit, unit: "ppm",
      verdict: v <= limit ? "Đạt" : "Không đạt", direction: "le", ref, isManufacturer,
    });
  }
  if (hasVal(tgd90)) {
    const v = Number(tgd90);
    const { limit, ref, isManufacturer } = resolved.tgd90;
    rows.push({
      key: "tgd90", label: "Tổn hao điện môi tgδ (90°C)", value: v, limit, unit: "%",
      verdict: v <= limit ? "Đạt" : "Không đạt", direction: "le", ref, isManufacturer,
    });
  }
  if (hasVal(bdv)) {
    const v = Number(bdv);
    const { limit, ref, isManufacturer } = resolved.bdv;
    rows.push({
      key: "bdv", label: "Điện áp chọc thủng dầu", value: v, limit, unit: "kV",
      // Ngược hướng với 2 hạng mục trên: BDV càng CAO càng tốt, đạt khi >= giới hạn.
      verdict: v >= limit ? "Đạt" : "Không đạt", direction: "ge", ref, isManufacturer,
    });
  }

  const overall = rows.length === 0 ? "Chưa đủ dữ liệu" : rows.every((r) => r.verdict === "Đạt") ? "Đạt" : "Không đạt";
  return { rows, overall };
}

// Export cho cả trình duyệt (global) lẫn Node (module.exports, dùng để test)
const DGA = {
  GASES, EQUIPMENT_TYPES, MBA_SUBTYPES, INSTRUMENT_SUBTYPES,
  QD1901_BANG12_TI, QD1901_BANG64_MBA, QD1901_BANG65_RATE, DEFAULT_PD_THRESHOLD,
  IEC_A2_POWER_TRANSFORMER, IEC_A6_INSTRUMENT_MAX, IEC_A6_INSTRUMENT_TYPICAL, IEC_A9_BUSHING,
  pdThresholdForType, typicalReferenceStandard, resolveCondemningLimits,
  defaultAbsoluteStandard, resolveStandard, computeTCG, evaluateAbsolute, overallVerdict,
  evaluateCondemning, condemningExceededRows,
  countExceedTypical, computeRatios, diagnoseRatios, ratioApplicability, computeRateOfChange,
  normalizeDuval, classifyDuval1, duvalPlotXY, diagnoseDuval1,
  buildRecommendations,
  OIL_VOLTAGE_CLASSES, BANG54_BDV, BANG55_TGD90, bang58WaterLimits, resolveOilLimits, evaluateOilTest,
  OLTC_SAMPLE_POINTS, BANG49_OLTC, evaluateOltcOilTest,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = DGA;
}
if (typeof window !== "undefined") {
  window.DGA = DGA;
}
