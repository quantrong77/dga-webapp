// dga-logic.js — File LẮP RÁP (assembler) cho lớp logic nghiệp vụ DGA.
//
// Kể từ đợt tái cấu trúc này, toàn bộ logic đã được tách thành 6 file theo
// miền nghiệp vụ, đặt trong thư mục logic/:
//   - src/domain/dga-logic-core.js               : hằng số dùng chung + hàm lõi (GASES, EQUIPMENT_TYPES,
//                                              các bảng ngưỡng khí thô QĐ1901/IEC, hằng số dầu/OLTC, REGULATION_CITATIONS...)
//   - src/domain/dga-logic-gas.js                 : đánh giá khí hòa tan (TCG, tỷ lệ, Duval, tốc độ tăng, khuyến cáo...)
//   - src/domain/dga-logic-oil.js                 : thí nghiệm dầu MBA + dầu OLTC
//   - src/domain/dga-logic-instrument-oil.js      : thí nghiệm dầu TI/TU
//   - src/domain/dga-logic-iec60422-2024.js       : đánh giá THAM KHẢO dầu MBA + TI/TU theo IEC 60422:2024 (Bảng 5/7)
//   - src/domain/dga-logic-forecast.js            : dự báo xu hướng khí
//   - src/domain/dga-logic-regulation-config.js   : cơ chế cấu hình quy định (ghi đè ngưỡng tại chỗ)
//
// dga-logic-core.js là "hub" duy nhất: 5 file còn lại chỉ phụ thuộc vào core,
// không phụ thuộc lẫn nhau (dga-logic-forecast.js không phụ thuộc file nào).
//
// File này (src/domain/dga-logic.js) nằm CÙNG thư mục với các file logic; index.html
// tham chiếu <script src="src/domain/dga-logic.js">. Nhiệm vụ duy nhất của nó là LẮP RÁP:
//   - Trên trình duyệt: 6 file src/domain/dga-logic-*.js được nạp bằng thẻ <script>
//     THÔNG THƯỜNG (không phải module) ngay TRƯỚC thẻ <script src="src/domain/dga-logic.js">
//     trong index.html, nên mọi const/function khai báo ở top-level của chúng
//     đã có sẵn trong global scope khi đoạn code dưới đây chạy — file này chỉ
//     cần gom lại thành object DGA và gán window.DGA.
//   - Trên Node (dùng cho các script kiểm thử ad-hoc qua require()): dùng
//     module "vm" built-in để nạp và chạy 6 file trên trong MỘT sandbox context
//     dùng chung (mô phỏng đúng ngữ nghĩa "chia sẻ global scope giữa nhiều thẻ
//     <script>" của trình duyệt), sau đó trích xuất object DGA từ context đó.
//
// Không chỉnh sửa logic nghiệp vụ trong file này — mọi logic đã nằm trong
// 6 file con ở thư mục logic/. File này chỉ lắp ráp + export.

if (typeof module !== "undefined" && module.exports) {
  // ---------------------------------------------------------------------------
  // Nhánh Node: dùng vm để nạp 6 file logic con vào một sandbox context dùng chung
  // ---------------------------------------------------------------------------
  const vm = require("vm");
  const fs = require("fs");
  const path = require("path");

  const LOGIC_DIR = __dirname;
  const LOGIC_FILES = [
    "dga-logic-core.js", // phải nạp đầu tiên — là hub mà các file còn lại phụ thuộc vào
    "dga-logic-gas.js",
    "dga-logic-oil.js",
    "dga-logic-instrument-oil.js",
    "dga-logic-iec60422-2024.js", // phụ thuộc verdictTwoTierOil() (instrument-oil.js) — nạp SAU file đó
    "dga-logic-oil-extended.js", // chỉ tiêu lý-hóa dầu bổ sung — SAU iec60422, TRƯỚC regulation-config
    "dga-logic-forecast.js",
    "dga-logic-regulation-config.js",
    "dga-logic-peer.js",
    "dga-logic-case.js",
  ];

  const sandbox = {
    console,
    Math,
    JSON,
    Date,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    isNaN,
    parseFloat,
    parseInt,
  };
  const context = vm.createContext(sandbox);

  for (const fileName of LOGIC_FILES) {
    const filePath = path.join(LOGIC_DIR, fileName);
    const source = fs.readFileSync(filePath, "utf8");
    vm.runInContext(source, context, { filename: filePath });
  }

  // Trích xuất object DGA từ sandbox — danh sách khóa GIỐNG HỆT nhánh trình duyệt bên dưới.
  const DGA = vm.runInContext(
    `({
      GASES, EQUIPMENT_TYPES, PHA_OPTIONS, PHA_CHUNG_3_PHA, phaLabel, phaLabelWithPrefix, formatSampleDate,
      MBA_SUBTYPES, INSTRUMENT_SUBTYPES,
      QD1901_BANG12_TI, QD1901_BANG64_MBA, QD1901_BANG65_RATE, DEFAULT_PD_THRESHOLD,
      IEC_A2_POWER_TRANSFORMER, IEC_A8_INSTRUMENT_MAX, IEC_A7_INSTRUMENT_TYPICAL, IEC_A11_BUSHING,
      pdThresholdForType, typicalReferenceStandard, resolveCondemningLimits,
      defaultAbsoluteStandard, resolveStandard, computeTCG, evaluateAbsolute, overallVerdict,
      evaluateCondemning, condemningExceededRows,
      countExceedTypical, computeRatios, diagnoseRatios, diagnoseBushingRatios, diagnoseGasFault,
      BUSHING_CODE_LABELS, NO_DIAGNOSIS, ratioApplicability, computeRateOfChange,
      diagnoseSimplifiedPDT, oltcContaminationCheck, gasesBelowTypicalLow, QD1901_BANG64_MBA_LOW,
      QD1901_BANG66_TABLE1, QD1901_BANG66_PDT, IEC_A10_BUSHING_RATIOS, QD1901_BANG67_DUVAL,
      DIEU54_OLTC_C2H2_H2, DIEU54_ADDITIONAL_RATIOS, PD_THRESHOLD_BY_TYPE,
      computeTcgRateOfChange,
      normalizeDuval, classifyDuval1, duvalPlotXY, diagnoseDuval1,
      QD1901_BANG63_TDGC, computeTotalDissolvedGasPercent, evaluateBang63, diagnoseAdditionalRatios,
      dieu54AdvisoryMessages, dieu54ActionMessages, dieu54AdditionalFlags, dieu54Applies, buildRecommendations, computeOverallStatus,
      OIL_VOLTAGE_CLASSES, OIL_VOLTAGE_CLASS_LEGACY_LABELS, oilVoltageClassName, BANG54_BDV, BANG55_TGD90, bang58WaterLimits, resolveOilLimits, evaluateOilTest,
      evaluateInstrumentOilTest,
      IEC60422_2024_TABLE5_MBA, IEC60422_2024_TABLE7_TITU, IEC60422_2024_CATEGORY_LABEL_MBA,
      IEC60422_2024_CATEGORY_LABEL_TITU, mapOilVoltageClassToIec60422Category, resolveIec60422TituCategory,
      evaluateIec60422MbaOilTest, evaluateIec60422TituOilTest,
      OIL_PARAM_DEFS, OIL_EXT_FIELDS, OIL_GROUP_LABELS, oilParamDef, oilSelectLabel, oilOverallFromRows, oilLimitText,
      evaluateOilExtendedQd1901, evaluateIec60422ExtendedMba, evaluateIec60422NewOilBase,
      oilExtraFromRecord, oilSeriesKey, findPreviousOilFlashPoint, evaluateOilRecord, evaluateIec60422OilRecord, evaluateOltcRecord,
      BANG59_ACID, DIEU51_FLASH, BANG56_MECH, BANG57_PARTICLES, DIEU55_FURFURAL, BANG70_RESISTIVITY, BANG60_62_OXIDATION,
      IEC60422_2024_TABLE3_NEW, IEC60422_2024_TABLE5_EXTRA,
      OLTC_SAMPLE_POINTS, BANG49_OLTC, evaluateOltcOilTest, OIL_SAMPLE_POINTS,
      linearRegression, theilSenSlope, consecutiveAverageSlope, FORECAST_METHOD_LABELS, forecastGasTrend,
      REGULATION_CITATIONS, BANG58_WATER, getRegulationConfigRegistry, applyRegulationConfigOverride,
      resetRegulationConfigItem, regulationConfigDefaultCitation, getRegulationConfigCurrentValues, validateRegulationConfigValues, applyRegulationTerms, regulationTermsActive,
      getValueAtPath, setValueAtPath,
      PEER_MIN_SAMPLES, PEER_Z_WARN, PEER_Z_ALERT, PEER_IF_WARN, PEER_IF_ALERT, evaluatePeerAnomaly,
      CASE_TOP_N, CASE_MIN_SIMILARITY, findSimilarCases,
    })`,
    context
  );

  module.exports = DGA;
} else if (typeof window !== "undefined") {
  // ---------------------------------------------------------------------------
  // Nhánh trình duyệt: 6 file src/domain/dga-logic-*.js đã được nạp bằng <script> thường
  // NGAY TRƯỚC file này (xem index.html), nên mọi tên bên dưới đã có sẵn trong
  // global scope của trang — chỉ cần gom lại thành object DGA.
  // ---------------------------------------------------------------------------
  const DGA = {
    GASES, EQUIPMENT_TYPES, PHA_OPTIONS, PHA_CHUNG_3_PHA, phaLabel, phaLabelWithPrefix, formatSampleDate,
    MBA_SUBTYPES, INSTRUMENT_SUBTYPES,
    QD1901_BANG12_TI, QD1901_BANG64_MBA, QD1901_BANG65_RATE, DEFAULT_PD_THRESHOLD,
    IEC_A2_POWER_TRANSFORMER, IEC_A8_INSTRUMENT_MAX, IEC_A7_INSTRUMENT_TYPICAL, IEC_A11_BUSHING,
    pdThresholdForType, typicalReferenceStandard, resolveCondemningLimits,
    defaultAbsoluteStandard, resolveStandard, computeTCG, evaluateAbsolute, overallVerdict,
    evaluateCondemning, condemningExceededRows,
    countExceedTypical, computeRatios, diagnoseRatios, diagnoseBushingRatios, diagnoseGasFault,
    BUSHING_CODE_LABELS, NO_DIAGNOSIS, ratioApplicability, computeRateOfChange,
      diagnoseSimplifiedPDT, oltcContaminationCheck, gasesBelowTypicalLow, QD1901_BANG64_MBA_LOW,
      QD1901_BANG66_TABLE1, QD1901_BANG66_PDT, IEC_A10_BUSHING_RATIOS, QD1901_BANG67_DUVAL,
      DIEU54_OLTC_C2H2_H2, DIEU54_ADDITIONAL_RATIOS, PD_THRESHOLD_BY_TYPE,
    computeTcgRateOfChange,
    normalizeDuval, classifyDuval1, duvalPlotXY, diagnoseDuval1,
    QD1901_BANG63_TDGC, computeTotalDissolvedGasPercent, evaluateBang63, diagnoseAdditionalRatios,
    dieu54AdvisoryMessages, dieu54ActionMessages, dieu54AdditionalFlags, dieu54Applies, buildRecommendations, computeOverallStatus,
    OIL_VOLTAGE_CLASSES, OIL_VOLTAGE_CLASS_LEGACY_LABELS, oilVoltageClassName, BANG54_BDV, BANG55_TGD90, bang58WaterLimits, resolveOilLimits, evaluateOilTest,
    evaluateInstrumentOilTest,
    IEC60422_2024_TABLE5_MBA, IEC60422_2024_TABLE7_TITU, IEC60422_2024_CATEGORY_LABEL_MBA,
    IEC60422_2024_CATEGORY_LABEL_TITU, mapOilVoltageClassToIec60422Category, resolveIec60422TituCategory,
    evaluateIec60422MbaOilTest, evaluateIec60422TituOilTest,
      OIL_PARAM_DEFS, OIL_EXT_FIELDS, OIL_GROUP_LABELS, oilParamDef, oilSelectLabel, oilOverallFromRows, oilLimitText,
      evaluateOilExtendedQd1901, evaluateIec60422ExtendedMba, evaluateIec60422NewOilBase,
      oilExtraFromRecord, oilSeriesKey, findPreviousOilFlashPoint, evaluateOilRecord, evaluateIec60422OilRecord, evaluateOltcRecord,
      BANG59_ACID, DIEU51_FLASH, BANG56_MECH, BANG57_PARTICLES, DIEU55_FURFURAL, BANG70_RESISTIVITY, BANG60_62_OXIDATION,
      IEC60422_2024_TABLE3_NEW, IEC60422_2024_TABLE5_EXTRA,
    OLTC_SAMPLE_POINTS, BANG49_OLTC, evaluateOltcOilTest, OIL_SAMPLE_POINTS,
    linearRegression, theilSenSlope, consecutiveAverageSlope, FORECAST_METHOD_LABELS, forecastGasTrend,
    REGULATION_CITATIONS, BANG58_WATER, getRegulationConfigRegistry, applyRegulationConfigOverride,
    resetRegulationConfigItem, regulationConfigDefaultCitation, getRegulationConfigCurrentValues, validateRegulationConfigValues, applyRegulationTerms, regulationTermsActive,
    getValueAtPath, setValueAtPath,
    PEER_MIN_SAMPLES, PEER_Z_WARN, PEER_Z_ALERT, PEER_IF_WARN, PEER_IF_ALERT, evaluatePeerAnomaly,
    CASE_TOP_N, CASE_MIN_SIMILARITY, findSimilarCases,
  };

  window.DGA = DGA;
}
