/* dga-logic-gas.js — Phần 2/6 của dga-logic.js sau khi tách theo miền (xem
   dga-logic.js). Toàn bộ pipeline đánh giá 1 lần đo khí hòa tan: chọn tiêu chuẩn áp
   dụng (resolveStandard), đánh giá giá trị tuyệt đối/ngưỡng loại bỏ, chẩn đoán tỷ số
   khí (Bảng 66 + Table A.10 sứ xuyên), Tam giác Duval 1, tốc độ tăng khí (Bảng 65),
   tỷ lệ bổ sung/Tổng hàm lượng khí hòa tan (Điều 54/Bảng 63), khuyến cáo tổng hợp, và
   trạng thái tổng thể (Bình thường/Cảnh báo/Báo động). Dùng các bảng hằng số từ
   dga-logic-core.js. */

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
    return { ...IEC_A7_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.CT] };
  }
  if (equipmentType === EQUIPMENT_TYPES.TU) {
    // Bù các khí VT không có số liệu riêng bằng số liệu CT (cùng Annex A.4.4)
    return { ...IEC_A7_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.CT], ...pickNonNull(IEC_A7_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.VT]) };
  }
  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    return { ...IEC_A11_BUSHING };
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
      sourceLabel: `Chặt hơn giữa ${REGULATION_CITATIONS.BANG64_MBA} và ${REGULATION_CITATIONS.IEC_A2} (${subtype})`,
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  if (equipmentType === EQUIPMENT_TYPES.TI || equipmentType === EQUIPMENT_TYPES.TU) {
    // QĐ1901 Bảng 12 và IEC Annex A.4.4 Table A.8 "maximum admissible values" trùng khớp
    // hoàn toàn cho cả CT và VT — không có gì để "chặt hơn", dùng chung một bộ.
    const blended = elementWiseMin(QD1901_BANG12_TI, IEC_A8_INSTRUMENT_MAX);
    return {
      limits: blended,
      rate: QD1901_BANG65_RATE,
      sourceLabel: `${REGULATION_CITATIONS.BANG12_TI} = ${REGULATION_CITATIONS.IEC_A8} (giá trị tối đa cho phép, máy biến áp đo lường kiểu kín)`,
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    return {
      limits: { ...IEC_A11_BUSHING },
      rate: QD1901_BANG65_RATE,
      sourceLabel: `${REGULATION_CITATIONS.IEC_A11_BUSHING} (khoảng giá trị điển hình 90%, sứ xuyên) — QĐ1901 chưa có bảng riêng cho sứ xuyên`,
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  return {
    limits: defaultAbsoluteStandard(equipmentType),
    rate: QD1901_BANG65_RATE,
    sourceLabel: `${REGULATION_CITATIONS.BANG12_TI} — mặc định do chưa xác định loại thiết bị/chưa có tiêu chuẩn nhà sản xuất`,
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
// 5) Tỷ lệ khí cơ bản & mã chẩn đoán (Bảng 66, QĐ1901/Điều 54 = Table 1, IEC 60599:2022 —
//    xem 5.4 "DGA interpretation table"; Table 2 IEC 60599:2022 chỉ là bảng đơn giản hóa
//    3 mã PD/D/T, KHÔNG khớp Bảng 66 vốn có đủ 6 mã PD/D1/D2/T1/T2/T3 theo 3 tỷ số khí)
// ---------------------------------------------------------------------------

function computeRatios(gases) {
  const c2h2 = num(gases.C2H2), c2h4 = num(gases.C2H4), c2h6 = num(gases.C2H6), h2 = num(gases.H2), ch4 = num(gases.CH4);
  const co = num(gases.CO), co2 = num(gases.CO2);
  const r1 = c2h4 === 0 ? (c2h2 === 0 ? 0 : 999) : c2h2 / c2h4; // C2H2/C2H4
  const r2 = h2 === 0 ? 999 : ch4 / h2; // CH4/H2
  const r3 = c2h6 === 0 ? 999 : c2h4 / c2h6; // C2H4/C2H6
  // CO2/CO — CHỈ dùng cho Table A.10 (sứ xuyên, Annex A.5.3), KHÁC với tỷ lệ CO2/CO đã có
  // sẵn ở diagnoseAdditionalRatios() (Điều 54 QĐ1901/mục 5.5, ngưỡng <3/>10, áp dụng chung
  // mọi thiết bị, chỉ mang tính khuyến cáo) — Table A.10 dùng ngưỡng RIÊNG <1/>20, là 1 MÃ
  // chẩn đoán chính thức trong bảng, không phải khuyến cáo phụ — không gộp chung 2 hàm.
  const r4 = co === 0 ? (co2 === 0 ? null : 999) : co2 / co; // CO2/CO
  return { c2h2_c2h4: r1, ch4_h2: r2, c2h4_c2h6: r3, co2_co: r4 };
}

// Chuỗi "không xác định" DÙNG CHUNG — nhiều nơi so sánh ĐÚNG BẰNG chuỗi này để biết chẩn
// đoán có kết luận rõ ràng hay không (diagnosisIsConclusive(), buildRecommendations()) —
// khai báo 1 lần ở đây để tránh gõ sai lệch chuỗi giữa các nơi.
const NO_DIAGNOSIS = "Không xác định (ngoài Bảng 66/hỗn hợp khiếm khuyết)";

/**
 * Tra mã khiếm khuyết theo Bảng 66 / Table 1 IEC 60599:2022 (mục 5.4).
 * @param {{c2h2_c2h4:number, ch4_h2:number, c2h4_c2h6:number}} ratios
 * @param {number} pdThreshold ngưỡng CH4/H2 cho PD — mặc định 0,1; dùng 0,2 cho TI/TU
 *   (Annex A.4.3, xác nhận lại tại Table 1 Note 3) hoặc 0,07 cho sứ xuyên (Annex
 *   A.5.3/Table A.10, xác nhận lại tại Table 1 Note 3) thay vì luôn cố định 0,1.
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
  return NO_DIAGNOSIS;
}

// ---------------------------------------------------------------------------
// 5bis) Sứ xuyên (bushing) — Table A.10 IEC 60599:2022, Annex A.5.3 "Simplified
//    interpretation scheme for bushings". KHÁC hẳn Table 1/Bảng 66 (6 mã LOẠI TRỪ
//    NHAU, phải khớp ĐỒNG THỜI cả 3 tỷ số): Table A.10 có 4 mã ĐỘC LẬP, mỗi mã chỉ
//    xét ĐÚNG 1 tỷ số — 1 lần đo có thể khớp 0, 1, hoặc nhiều mã cùng lúc:
//      PD — CH4/H2 < 0,07
//      D  — C2H2/C2H4 > 1        (gộp chung, không tách D1/D2 như Table 1)
//      T  — C2H4/C2H6 > 1        (gộp chung, không tách T1/T2/T3 như Table 1)
//      TP — CO2/CO < 1 hoặc > 20 (nghi liên quan cách điện giấy — bảng gốc IEC không
//           định nghĩa rõ chữ viết tắt "TP"; diễn giải hướng <1 hay >20 nên đối chiếu
//           thêm mục 5.5: CO2/CO<3 thường nghi carbon hóa giấy, CO2/CO>10 có thể là
//           quá nhiệt nhẹ (<160°C) giấy/oxy hóa dầu — Table A.10 dùng ngưỡng riêng,
//           nghiêm ngặt hơn <1/>20)
//    Nguyên văn ngay dưới Table A.10: "In cases where a single characteristic fault
//    cannot be attributed using this simplified table... the general Table 1 should
//    be used" — nên khi KHÔNG mã nào khớp, phải tự rơi về Table 1 (xem
//    diagnoseGasFault() bên dưới), đúng yêu cầu của bảng gốc, KHÔNG trả về rỗng.
// ---------------------------------------------------------------------------

function diagnoseBushingRatios(ratios) {
  const codes = [];
  if (ratios.ch4_h2 < 0.07) codes.push("PD");
  if (ratios.c2h2_c2h4 > 1) codes.push("D");
  if (ratios.c2h4_c2h6 > 1) codes.push("T");
  if (ratios.co2_co !== null && (ratios.co2_co < 1 || ratios.co2_co > 20)) codes.push("TP");
  return codes;
}

const BUSHING_CODE_LABELS = {
  PD: "PD (phóng điện cục bộ — CH4/H2 < 0,07)",
  D: "D (phóng điện — C2H2/C2H4 > 1)",
  T: "T (tăng nhiệt — C2H4/C2H6 > 1)",
  TP: "TP (nghi liên quan cách điện giấy — CO2/CO bất thường)",
};

/**
 * Điểm vào DUY NHẤT nên dùng để chẩn đoán mã khiếm khuyết theo tỷ lệ khí — thay cho gọi
 * thẳng diagnoseRatios(), vì tự chọn ĐÚNG bảng theo loại thiết bị:
 *  - Sứ xuyên: thử Table A.10 (Annex A.5.3) trước — có ≥1 mã khớp thì liệt kê ĐẦY ĐỦ các
 *    mã khớp (đúng bản chất 4 mã độc lập, không chỉ chọn 1 mã); KHÔNG mã nào khớp thì tự
 *    rơi về Table 1 (diagnoseRatios, ngưỡng PD 0,07) như bảng gốc yêu cầu — nếu Table 1
 *    cũng không kết luận được, trả nguyên NO_DIAGNOSIS (không bọc thêm chữ) để các nơi so
 *    sánh đúng-bằng-chuỗi (diagnosisIsConclusive()...) vẫn hoạt động đúng.
 *  - Các loại khác (MBA/TI/TU/Khác): dùng thẳng Table 1/Bảng 66 như trước nay — với TI/TU,
 *    đây CHÍNH LÀ điều Annex A.4.3 chỉ định (Table 1 + ngưỡng PD 0,2), không phải 1 bảng
 *    riêng khác — xem pdThresholdForType().
 * @param {object} gases {H2,CH4,C2H6,C2H4,C2H2,CO,CO2}
 * @param {string} equipmentType EQUIPMENT_TYPES.*
 * @param {number} pdThreshold ngưỡng CH4/H2 cho PD khi dùng/rơi về Table 1
 * @returns {string}
 */
function diagnoseGasFault(gases, equipmentType, pdThreshold) {
  const ratios = computeRatios(gases);
  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    const codes = diagnoseBushingRatios(ratios);
    if (codes.length > 0) {
      return `Bảng A.10 (sứ xuyên): ${codes.join(" + ")} — ${codes.map((c) => BUSHING_CODE_LABELS[c]).join("; ")}`;
    }
    const fallback = diagnoseRatios(ratios, pdThreshold);
    return fallback === NO_DIAGNOSIS ? NO_DIAGNOSIS : `${fallback} (rơi về Table 1 — không mã nào khớp Table A.10)`;
  }
  return diagnoseRatios(ratios, pdThreshold);
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
// 6) Tam giác Duval (Duval Triangle 1) — IEC 60599:2022 Annex B, Figure B.3 (số Annex B
//    và Figure B.3 không đổi giữa 2 bản 1999/2022 — chỉ Annex A bị dịch số)
//    Chẩn đoán dạng sự cố bằng %CH4, %C2H4, %C2H2 (quy về tổng = 100%).
//    Ranh giới vùng lấy đúng theo bảng "Limits of zones" gốc trong Annex B:
//      PD: %CH4 ≥ 98
//      D1: %C2H4 ≤ 23  và %C2H2 ≥ 13
//      D2: 23 < %C2H4 ≤ 38  và %C2H2 ≥ 13
//      T1: %C2H2 ≤ 4  và %C2H4 ≤ 10
//      T2: %C2H2 ≤ 4  và 10 < %C2H4 ≤ 50
//      T3: %C2H4 > 50 (khi %C2H2 ≤ 4); hoặc %C2H2 ≥ 13 và %C2H4 > 38
//    Phần diện tích còn lại (khoảng 4% < %C2H2 < 13%, không thuộc T3 nêu trên) là
//    vùng ranh giới "D+T" mà chính hình vẽ gốc IEC 60599:2022 (Figure B.3) cũng ghi
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
 * Phân vùng Tam giác Duval 1 theo bảng "Limits of zones", Annex B, Figure B.3, IEC 60599:2022.
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
    else if (ratePerYear > hi) verdict = `⚠ Vượt cận trên ${REGULATION_CITATIONS.BANG65_RATE} — nghi khiếm khuyết đang phát triển`;
    else if (ratePerYear < lo) verdict = `Dưới cận dưới ${REGULATION_CITATIONS.BANG65_RATE} — tốc độ thấp, bình thường`;
    else verdict = `Trong khoảng điển hình ${REGULATION_CITATIONS.BANG65_RATE}`;
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

/**
 * Tốc độ sinh khí (%/tháng) của TỔNG lượng khí cháy (TCG) giữa 2 lần đo — cùng công
 * thức ratePerMonth với computeRateOfChange() ở trên. Khác chỗ: Bảng 65 (Điều 54
 * QĐ1901) chỉ quy định khoảng tham chiếu ppm/năm cho TỪNG khí riêng lẻ, KHÔNG có
 * khoảng tham chiếu cho TCG — nên hàm này chỉ trả về số liệu %/tháng để tham khảo
 * (dùng khi xuất BBTN, xem tcg_toc ở bbtn-export.js), không có rangeLo/rangeHi/verdict
 * như computeRateOfChange().
 * @param {number} prevTcg, {number} currTcg  ppm (kết quả computeTCG())
 * @param {number} deltaDays  số ngày giữa 2 lần đo
 */
function computeTcgRateOfChange(prevTcg, currTcg, deltaDays) {
  if (!deltaDays || deltaDays <= 0) return null;
  const before = num(prevTcg);
  const after = num(currTcg);
  const delta = after - before;
  const ratePerMonth = before === 0 ? null : (delta / before) / (deltaDays / 30) * 100;
  return {
    before: round1(before),
    after: round1(after),
    delta: round1(delta),
    ratePerMonth: ratePerMonth === null ? null : round1(ratePerMonth),
  };
}


// ---------------------------------------------------------------------------
// 7bis) "Đánh giá các tỷ lệ bổ sung" (Điều 54 QĐ1901, ngay sau Bảng 66) + Tổng hàm
//   lượng khí hòa tan (Bảng 63) — CẢ HAI đều KHÁC bộ 3 tỷ lệ chính (computeRatios()/
//   diagnoseRatios() ở trên, dùng để tra mã khiếm khuyết Bảng 66): đây là 2 chỉ tiêu
//   PHỤ, chỉ mang tính tham khảo bổ sung, KHÔNG dùng để tra mã PD/D1/D2/T1/T2/T3.
// ---------------------------------------------------------------------------



/**
 * Tổng hàm lượng khí hòa tan (%) theo Bảng 63 — CỘNG DỒN CẢ N2, O2, khác hẳn TCG ở
 * computeTCG() (chỉ cộng 6 khí cháy, không có CO2 lẫn N2/O2). Quy đổi ppm -> %: 1% =
 * 10.000 ppm (cùng đơn vị nồng độ thể tích khí/dầu, μL/L). Bắt buộc có CẢ N2 LẪN O2 vì
 * N2 thường chiếm tỷ trọng lớn nhất trong tổng khí hòa tan (hàng chục nghìn ppm ở thiết
 * bị thở tự do với khí quyển) — thiếu 1 trong 2 sẽ làm tổng bị tính thấp giả tạo, không
 * dùng để so Bảng 63 được.
 * @param {object} gases 7 khí GASES (ppm)
 * @param {number|null} n2, {number|null} o2  ppm, hoặc null nếu chưa nhập
 * @returns {number|null} % (null nếu thiếu N2 hoặc O2)
 */
function computeTotalDissolvedGasPercent(gases, n2, o2) {
  if (n2 === null || n2 === undefined || o2 === null || o2 === undefined) return null;
  const sum = GASES.reduce((s, g) => s + num(gases[g]), 0) + num(n2) + num(o2);
  return sum / 10000;
}

/**
 * Đánh giá Bảng 63 — CHỈ trả verdict Đạt/Không đạt khi applicable=true (đúng điều kiện
 * áp dụng của Bảng 63: dầu mới/sau sửa chữa thay dầu hoặc lọc dầu). Khi applicable=false
 * (dầu đang vận hành định kỳ thông thường) vẫn trả limit để tham khảo nhưng verdict=null
 * — không tự kết luận đạt/không đạt cho trường hợp Bảng 63 không áp dụng chính thức.
 * @param {number|null} totalPercent kết quả computeTotalDissolvedGasPercent()
 * @param {"110-220"|"500"} voltageClass
 * @param {boolean} applicable
 */
function evaluateBang63(totalPercent, voltageClass, applicable) {
  const limit = QD1901_BANG63_TDGC[voltageClass] ?? null;
  if (totalPercent === null || limit === null) return { limit, verdict: null, applicable: !!applicable };
  const verdict = applicable ? (totalPercent < limit ? "Đạt" : "Không đạt") : null;
  return { limit, verdict, applicable: !!applicable };
}

/**
 * "Đánh giá các tỷ lệ bổ sung", Điều 54 QĐ1901 (đoạn ngay sau Bảng 66):
 *  - CO2/CO: luôn tính được (CO, CO2 là 2 trong 7 khí bắt buộc).
 *  - O2/N2: chỉ tính được khi có CẢ N2 VÀ O2 (tùy chọn — xem computeTotalDissolvedGasPercent()).
 * CHỈ dùng đúng các mốc/điều kiện QĐ1901 nêu rõ để kết luận; giá trị nằm ngoài các mốc
 * đó chỉ hiển thị con số kèm ghi chú giới hạn, không tự suy diễn thêm ngưỡng ngoài văn
 * bản gốc (văn bản chỉ cho 1 mốc tham khảo O2/N2 ~ 0,5 "bình thường", không có thang đầy đủ).
 * @param {object} gases 7 khí GASES (ppm)
 * @param {number|null} n2, {number|null} o2  ppm, hoặc null nếu chưa nhập
 */
function diagnoseAdditionalRatios(gases, n2, o2) {
  const co = num(gases.CO), co2 = num(gases.CO2);
  const co2_co = co === 0 ? (co2 === 0 ? null : 999) : co2 / co;
  let co2coNote;
  if (co2_co === null) {
    co2coNote = "Không đủ dữ liệu để tính (CO và CO2 đều bằng 0).";
  } else if (co2_co < 3 && co > 1000) {
    co2coNote = "CO2/CO < 3 và CO > 1000 ppm — có khả năng liên quan đến giấy cách điện bị carbon hóa, cần xác nhận bằng phân tích furanic hoặc đo độ trùng hợp giấy.";
  } else if (co2_co > 10 && co2 > 10000) {
    co2coNote = "CO2/CO > 10 và CO2 > 10.000 ppm — có thể do quá nhiệt nhẹ (<160°C) hoặc oxy hóa dầu, đặc biệt ở máy biến áp hở.";
  } else {
    co2coNote = "Không rơi vào 2 điều kiện cảnh báo bổ sung của Điều 54 (CO2/CO<3 và CO>1000 ppm; hoặc CO2/CO>10 và CO2>10.000 ppm).";
  }

  const hasN2O2 = n2 !== null && n2 !== undefined && o2 !== null && o2 !== undefined && num(n2) > 0;
  let o2_n2 = null;
  let o2n2Note = "Chưa nhập đủ N2/O2 — bỏ qua tỷ lệ O2/N2.";
  if (hasN2O2) {
    o2_n2 = num(o2) / num(n2);
    if (o2_n2 < 0.3) {
      o2n2Note = "O2/N2 < 0,3 — tiêu thụ oxy quá mức do oxy hóa dầu hoặc lão hóa giấy cách điện.";
    } else {
      o2n2Note = "QĐ1901 chỉ nêu mốc tham khảo O2/N2 ~ 0,5 là bình thường ở thiết bị có tiếp xúc với không khí; văn bản không có thang đầy đủ để phân loại chính xác các giá trị khác — cần đối chiếu thêm kết cấu bình dầu phụ (có màng ngăn hay không) và thực tế vận hành trước khi kết luận.";
    }
  }

  return {
    co2_co: co2_co === null ? null : round1(co2_co),
    co2coNote,
    o2_n2: o2_n2 === null ? null : round1(o2_n2),
    o2n2Note,
  };
}

// ---------------------------------------------------------------------------
// 8) Khuyến cáo tổng hợp — tổng hợp kết luận tuyệt đối + chẩn đoán tỷ lệ (Bảng 66) +
//    chẩn đoán Tam giác Duval + tốc độ sinh khí.
//    Chỉ mang tính hỗ trợ; không thay thế nguyên tắc đánh giá tổng thể tại Điều 3, QĐ1901.
// ---------------------------------------------------------------------------

/** Trích các cảnh báo THEO ĐIỀU KIỆN cụ thể mà Điều 54 QĐ1901 nêu rõ (Tỷ lệ bổ sung
 *  CO2/CO, O2/N2, và Tổng hàm lượng khí hòa tan Bảng 63) — tách riêng khỏi
 *  buildRecommendations() để dùng CHUNG cho khuyến cáo ở tab "DGA" VÀ rà soát tự động ở
 *  tab "Cảnh báo" (computeGasAlerts(), ui-alerts.js), tránh định nghĩa lại điều kiện ở
 *  2 nơi rồi lệch nhau. Chỉ trả về khi rơi vào điều kiện cảnh báo QĐ1901 nêu rõ (không
 *  lặp lại ghi chú "bình thường"/"chưa đủ dữ liệu" — những ghi chú đó đã hiển thị đầy đủ
 *  trong bảng kết quả riêng ở tab "DGA"). Trả về mảng chuỗi, rỗng nếu không có gì đáng
 *  cảnh báo. */
function dieu54AdvisoryMessages({ additionalRatios, bang63 }) {
  const msgs = [];
  if (additionalRatios) {
    if (additionalRatios.co2_co !== null && additionalRatios.co2coNote && additionalRatios.co2coNote.startsWith("CO2/CO")) {
      msgs.push(`Tỷ lệ bổ sung CO2/CO (Điều 54): ${additionalRatios.co2coNote}`);
    }
    if (additionalRatios.o2_n2 !== null && additionalRatios.o2_n2 < 0.3) {
      msgs.push(`Tỷ lệ bổ sung O2/N2 (Điều 54): ${additionalRatios.o2n2Note}`);
    }
  }
  if (bang63 && bang63.verdict === "Không đạt") {
    msgs.push(
      `⚠ Tổng hàm lượng khí hòa tan vượt ngưỡng ${REGULATION_CITATIONS.BANG63_TDGC} (cấp điện áp áp dụng: <${bang63.limit}%) — áp dụng cho dầu mới/sau ` +
      `sửa chữa có thay dầu hoặc lọc dầu; khuyến cáo kiểm tra lại quy trình xử lý dầu (chân không hóa/lọc khí) trước khi ` +
      `đưa thiết bị vào vận hành chính thức.`
    );
  }
  return msgs;
}

function buildRecommendations({ overallOk, exceedCount, diagnosis, duval, rateRows, condemningRows, additionalRatios, bang63, equipmentType, bushingCodes }) {
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
  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    // Sứ xuyên: khuyến cáo riêng theo TỪNG mã Table A.10 đã khớp (có thể nhiều mã cùng
    // lúc — xem diagnoseBushingRatios()/diagnoseGasFault()) — KHÔNG dùng logic PD/D1/D2/T
    // chung bên dưới (dành cho Table 1/Bảng 66, cấu trúc 6 mã loại trừ nhau khác hẳn).
    if (bushingCodes && bushingCodes.length > 0) {
      const bushingMsgs = {
        PD: "Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): PD — phóng điện cục bộ (CH4/H2 < 0,07) — khuyến cáo đo phóng điện cục bộ bổ sung nếu điều kiện cho phép.",
        D: "Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): D — phóng điện (C2H2/C2H4 > 1) — khuyến cáo kiểm tra cách điện, siết lại kết nối, xem xét thí nghiệm điện môi bổ sung.",
        T: "Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): T — tăng nhiệt (C2H4/C2H6 > 1) — khuyến cáo kiểm tra mối nối/tiếp xúc, tải vận hành, và nhiệt độ điểm nóng nếu có điều kiện đo.",
        TP: "Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): TP — CO2/CO bất thường (nghi liên quan cách điện giấy) — đối chiếu thêm mục 5.5 IEC60599:2022 (CO2/CO<3 thường nghi carbon hóa giấy, CO2/CO>10 có thể là quá nhiệt nhẹ giấy/oxy hóa dầu) và cân nhắc thử nghiệm furan nếu cần xác nhận thêm.",
      };
      bushingCodes.forEach((c) => { if (bushingMsgs[c]) recs.push(bushingMsgs[c]); });
    } else if (exceedCount > 0 && diagnosis && diagnosis !== NO_DIAGNOSIS) {
      recs.push(`Không mã nào khớp Bảng A.10 (sứ xuyên) — đã tự động dùng lại Table 1/Bảng 66 theo đúng chỉ dẫn của bảng gốc ("the general Table 1 should be used"): "${diagnosis}". Nên đối chiếu thêm ý kiến chuyên gia/nhà sản xuất sứ xuyên khi rơi vào trường hợp này (xem Note 5, Annex A.5.4 IEC60599:2022).`);
    }
  } else if (exceedCount > 0 && diagnosis && diagnosis !== NO_DIAGNOSIS) {
    if (diagnosis.startsWith("PD")) recs.push("Mã chẩn đoán Bảng 66: PD (phóng điện cục bộ) — khuyến cáo đo phóng điện cục bộ (PD) bổ sung nếu điều kiện cho phép.");
    else if (diagnosis.startsWith("D1") || diagnosis.startsWith("D2")) recs.push("Mã chẩn đoán Bảng 66: phóng điện (D1/D2) — khuyến cáo kiểm tra cách điện, siết lại kết nối, xem xét thí nghiệm điện môi bổ sung.");
    else if (diagnosis.startsWith("T")) recs.push("Mã chẩn đoán Bảng 66: tăng nhiệt (T1/T2/T3) — khuyến cáo kiểm tra mối nối/tiếp xúc, tải vận hành, và nhiệt độ điểm nóng nếu có điều kiện đo.");
  }
  if (duval && duval.zone) {
    if (duval.zone === "D+T") {
      recs.push("Tam giác Duval rơi vào vùng chồng lấn phóng điện/tăng nhiệt (D+T, ranh giới không phân định rõ trong hình gốc IEC60599 Annex B) — nên đối chiếu thêm với mã Bảng 66/Bảng A.10 và các pha/lần đo khác trước khi kết luận dạng sự cố.");
    } else if (equipmentType === EQUIPMENT_TYPES.BUSHING && bushingCodes && bushingCodes.length > 0) {
      // So khớp theo "họ" mã (Table A.10 gộp D1/D2 → "D", T1/T2/T3 → "T"; Duval Triangle 1
      // vẫn áp dụng nguyên cho sứ xuyên — Annex B: "Duval's triangle 1 for transformers,
      // bushings and cables" — nên chỉ cần khớp họ, không cần khớp đúng D1 hay D2...).
      const duvalFamily = duval.zone.startsWith("PD") ? "PD" : duval.zone.startsWith("D") ? "D" : duval.zone.startsWith("T") ? "T" : null;
      if (duvalFamily && bushingCodes.includes(duvalFamily)) {
        recs.push(`Tam giác Duval cho cùng họ kết quả với Bảng A.10 (mã ${duvalFamily}, Duval mã ${duval.zone}) — tăng độ tin cậy của chẩn đoán.`);
      } else {
        recs.push(`Lưu ý: Tam giác Duval cho mã ${duval.zone}, khác với các mã đã khớp Bảng A.10 (${bushingCodes.join(", ")}) ở trên — hai phương pháp có thể lệch nhau khi khí ở gần ranh giới vùng; nên đối chiếu thêm dữ liệu vận hành/pha khác trước khi kết luận.`);
      }
    } else if (diagnosis && diagnosis.startsWith(duval.zone)) {
      recs.push(`Tam giác Duval cho cùng kết quả với Bảng 66 (${duval.zone}) — tăng độ tin cậy của chẩn đoán.`);
    } else if (!diagnosis || !diagnosis.startsWith(duval.zone.split("/")[0])) {
      recs.push(`Lưu ý: Tam giác Duval cho mã ${duval.zone}, khác với mã tra theo Bảng 66/Ba tỷ số khí cơ bản ở trên — hai phương pháp có thể lệch nhau khi khí ở gần ranh giới vùng; nên đối chiếu thêm dữ liệu vận hành/pha khác trước khi kết luận.`);
    }
  }
  if (rateWarnings.length > 0) {
    recs.push(`Tốc độ sinh khí vượt ${REGULATION_CITATIONS.BANG65_RATE} ở ${rateWarnings.length} khí (${rateWarnings.map((r) => r.gas).join(", ")}) — nghi khiếm khuyết đang phát triển, khuyến cáo rút ngắn chu kỳ giám sát và lấy mẫu DGA lại sớm hơn dự kiến.`);
  }
  if (exceedCount === 0 && diagnosis) {
    recs.push("Chưa đủ điều kiện áp dụng chính thức tỷ lệ khí (chưa có khí vượt giá trị điển hình) — mã chẩn đoán Bảng 66/Bảng A.10/Tam giác Duval ở trên chỉ mang tính tham khảo.");
  }
  // Tỷ lệ bổ sung + Tổng hàm lượng khí hòa tan (Điều 54) — xem dieu54AdvisoryMessages().
  recs.push(...dieu54AdvisoryMessages({ additionalRatios, bang63 }));
  return recs;
}


// ---------------------------------------------------------------------------
// 8bis) Trạng thái tổng thể — số hóa lưu đồ đánh giá DGA (Hình 1, mục 6, IEC
//    60599:1999) thành 1 thuật toán 3 mức duy nhất, hiển thị nổi bật ở đầu kết quả
//    phân tích và giải thích chi tiết ở tab "Quy trình đánh giá":
//      - "normal" (Bình thường): tất cả khí dưới giá trị điển hình VÀ tốc độ tăng khí
//        bình thường — nhánh phải của lưu đồ gốc ("Report as typical DGA/healthy
//        equipment").
//      - "alert" (Cảnh báo — ALERT condition): có khí vượt giá trị điển hình hoặc tốc
//        độ tăng bất thường, nhưng CHƯA vượt ngưỡng tuyệt đối/loại bỏ và loại sự cố
//        (nếu xác định được) chưa đổi khác so với lần đo liền trước.
//      - "alarm" (Báo động — ALARM condition): vượt ngưỡng tuyệt đối (Không đạt
//        QĐ1901/IEC hoặc tiêu chuẩn nhà sản xuất), HOẶC vượt ngưỡng loại bỏ nhà sản
//        xuất, HOẶC loại sự cố theo Bảng 66 đổi khác so với lần đo liền trước — đúng
//        nhánh "Gas concentration above alarm values... or change in fault type" của
//        lưu đồ gốc.
//    CHỈ mang tính hỗ trợ tự động; KHÔNG thay thế nguyên tắc đánh giá tổng thể tại
//    Điều 3 QĐ1901 (so với pha khác/thiết bị cùng loại/giá trị xuất xưởng/hướng dẫn
//    nhà sản xuất/diễn biến vận hành thực tế — những yếu tố phần mềm không có đủ dữ
//    liệu để tự động hóa).
// ---------------------------------------------------------------------------

function diagnosisIsConclusive(diagnosis) {
  return !!diagnosis && diagnosis !== NO_DIAGNOSIS;
}

/**
 * @param {object} p
 * @param {boolean} p.overallOk kết quả overallVerdict() === "Đạt"
 * @param {number} p.exceedCount kết quả countExceedTypical()
 * @param {string} p.diagnosis kết quả diagnoseRatios() của lần đo hiện tại
 * @param {string|null} p.priorDiagnosis kết quả diagnoseRatios() của lần đo liền trước (nếu có)
 * @param {Array|null} p.rateRows kết quả computeRateOfChange() (nếu có lần đo trước)
 * @param {Array} p.condemningRows kết quả evaluateCondemning()
 * @returns {{level:"normal"|"alert"|"alarm", label:string, reasons:string[], action:string}}
 */
function computeOverallStatus({ overallOk, exceedCount, diagnosis, priorDiagnosis, rateRows, condemningRows }) {
  const condemnExceeded = condemningExceededRows(condemningRows);
  const rateWarnings = (rateRows || []).filter((r) => r.verdict && r.verdict.startsWith("⚠"));
  const faultTypeChanged =
    diagnosisIsConclusive(diagnosis) && diagnosisIsConclusive(priorDiagnosis) && diagnosis !== priorDiagnosis;

  const alarmReasons = [];
  if (condemnExceeded.length > 0) {
    alarmReasons.push(
      `Vượt ngưỡng LOẠI BỎ do nhà sản xuất quy định ở ${condemnExceeded.length} khí (${condemnExceeded.map((r) => r.gas).join(", ")}).`
    );
  }
  if (!overallOk) {
    alarmReasons.push('Có khí vượt ngưỡng tuyệt đối đang áp dụng ("Không đạt") — xem bảng "Đánh giá giá trị tuyệt đối từng khí".');
  }
  if (faultTypeChanged) {
    alarmReasons.push(`Loại sự cố theo Bảng 66 đổi khác so với lần đo liền trước: "${priorDiagnosis}" → "${diagnosis}".`);
  }
  if (alarmReasons.length > 0) {
    return {
      level: "alarm",
      label: "BÁO ĐỘNG (ALARM)",
      reasons: alarmReasons,
      action: "Hành động ngay: lấy mẫu bổ sung xác nhận, kiểm tra hiện trường, cân nhắc giám sát trực tuyến/sửa chữa, và báo cáo cấp có thẩm quyền theo Điều 6 QĐ1901.",
    };
  }

  const alertReasons = [];
  if (exceedCount > 0) {
    alertReasons.push(`Có ${exceedCount} khí vượt giá trị điển hình (Bảng 64 QĐ1901/Điều 54, hoặc Annex A IEC 60599:2022 theo loại thiết bị).`);
  }
  if (rateWarnings.length > 0) {
    alertReasons.push(`Tốc độ tăng khí vượt khoảng điển hình ${REGULATION_CITATIONS.BANG65_RATE} ở ${rateWarnings.length} khí (${rateWarnings.map((r) => r.gas).join(", ")}).`);
  }
  if (alertReasons.length > 0) {
    return {
      level: "alert",
      label: "CẢNH BÁO (ALERT)",
      reasons: alertReasons,
      action: "Tăng tần suất lấy mẫu, cân nhắc giám sát trực tuyến; đối chiếu mã chẩn đoán Bảng 66/Tam giác Duval để theo dõi sát diễn biến.",
    };
  }

  return {
    level: "normal",
    label: "BÌNH THƯỜNG",
    reasons: ["Tất cả khí dưới giá trị điển hình; tốc độ tăng khí (nếu có lần đo trước để so sánh) trong khoảng bình thường."],
    action: "Tiếp tục giám sát định kỳ theo chu kỳ quy định (Điều 3, 7 QĐ1901).",
  };
}

