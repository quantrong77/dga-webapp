/* ui-alerts.js — Tab "Cảnh báo": tự động rà soát LẦN ĐO GẦN NHẤT của TỪNG thiết bị
   (khí hòa tan/dầu MBA chính/dầu OLTC/dầu TI-TU) và liệt kê thiết bị đang ở mức Cảnh
   báo/Báo động — tái dùng NGUYÊN các hàm đánh giá đã có (DGA.computeOverallStatus()/
   DGA.evaluateOilTest()/DGA.evaluateOltcOilTest()/DGA.evaluateInstrumentOilTest()),
   KHÔNG tự đặt thêm ngưỡng nào mới, để luôn nhất quán với kết quả hiện ở tab "DGA"/
   "Dầu cách điện". Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước chia
   sẻ scope giữa các file ui-*.js. Đọc _allMeasurements/_allOilTests/_allOltcOilTests
   (ui-history.js), _allTioOilTests (ui-ti-oil.js) và _allStandards (ui-standards.js)
   — chỉ TÍNH LẠI (không gọi Storage), nên gọi được ngay sau bất kỳ lần nạp/lưu/xóa
   nào ở 4 tab kia (xem refreshHistoryUI()/refreshOilTestsUI()/refreshOltcOilTestsUI()/
   refreshTioOilTestsUI()). */

/** Hiện/ẩn thông báo "Vui lòng chờ! Đang nạp dữ liệu..." (#alertsLoadingHint) —
 *  chỉ trong lúc nạp LẦN ĐẦU cả 3 nguồn dữ liệu lúc mở app (xem initApp() ở
 *  app-core.js); tránh hiện "Chưa phát hiện thiết bị nào..." gây hiểu lầm là mọi
 *  thứ đều bình thường trong khi dữ liệu thật vẫn đang trên đường về. */
function setAlertsLoading(isLoading) {
  const hint = $("alertsLoadingHint");
  if (!hint) return;
  hint.classList.toggle("hidden", !isLoading);
}

/** Khóa ĐỊNH DANH THIẾT BỊ dùng CHUNG cho cả totalTrackedDeviceCount() và các bộ đếm
 *  "Thiết bị đang có cảnh báo" bên dưới. "normalizedPhase" TRUYỀN VÀO ĐÂY phải đã
 *  được 1 trong 3 hàm gasPhaseIdentity()/oilPhaseIdentity()/oltcPhaseIdentity() bên
 *  dưới chuẩn hóa trước — "" nghĩa là bản ghi này KHÔNG tách riêng theo pha (TI/TU/Sứ
 *  xuyên phần lớn tách riêng theo pha vật lý nên hiếm khi rỗng; MBA/Kháng thì tùy kết
 *  cấu: đa số dùng CHUNG 1 thùng dầu 3 pha — nhất là ≤220kV — nên thường rỗng, nhưng
 *  MBA/Kháng 500kV thường 3 PHA RỜI (mỗi pha 1 máy/1 thùng dầu vật lý riêng — cả dầu
 *  chính LẪN dầu OLTC đều có thể lấy mẫu riêng từng pha, xem OIL_SAMPLE_POINTS/
 *  OLTC_SAMPLE_POINTS ở dga-logic.js) nên khi đó "A"/"B"/"C" là pha THẬT, ghép đúng
 *  giữa khí hòa tan + dầu chính + dầu OLTC của CÙNG 1 pha thành CÙNG 1 thiết bị. */
function deviceIdentityKey(tram, deviceName, normalizedPhase) {
  return `${(tram || "").trim()}|||${(deviceName || "").trim()}|||${(normalizedPhase || "").trim()}`;
}

/** Chuẩn hóa Pha của 1 bản ghi KHÍ HÒA TAN (_allMeasurements, trường "pha") thành
 *  Pha ĐỊNH DANH THIẾT BỊ — "chung3pha" (PHA_CHUNG_3_PHA, xem PHA_OPTIONS ở dga-
 *  logic.js) nghĩa là "không tách riêng theo pha" nên quy về "", còn "A"/"B"/"C" giữ
 *  nguyên vì đó là pha vật lý thật (TI/TU/Sứ xuyên gần như luôn vậy; MBA/Kháng 3 pha
 *  rời thì cũng vậy). */
function gasPhaseIdentity(pha) {
  return pha === DGA.PHA_CHUNG_3_PHA ? "" : (pha || "").trim();
}

/** Chuẩn hóa Pha của 1 bản ghi DẦU CÁCH ĐIỆN MBA CHÍNH (_allOilTests) — chỉ có Pha
 *  thật khi oil_sample_point="pharieng" (MBA/Kháng 3 pha rời, mỗi pha 1 thùng dầu
 *  riêng — xem OIL_SAMPLE_POINTS/ui-oil.js); "chung" (mặc định, đa số MBA/Kháng
 *  ≤220kV dùng 1 thùng dầu chung) quy về "". */
function oilPhaseIdentity(oilSamplePoint, phase) {
  return oilSamplePoint === "pharieng" ? (phase || "").trim() : "";
}

/** Chuẩn hóa Pha của 1 bản ghi DẦU OLTC (_allOltcOilTests) — chỉ có Pha thật khi
 *  oltc_sample_point="pharieng" (lấy mẫu riêng từng pha); "trungtinh" (điểm cuối
 *  trung tính, dùng chung 1 mẫu) quy về "". */
function oltcPhaseIdentity(oltcSamplePoint, phase) {
  return oltcSamplePoint === "pharieng" ? (phase || "").trim() : "";
}

/** Chuẩn hóa Pha của 1 bản ghi DẦU TI/TU (_allTioOilTests, trường "phase") — đa số
 *  TI/TU tách riêng từng pha theo kết cấu vật lý nên "A"/"B"/"C" là pha THẬT (giữ
 *  nguyên); "chung3pha" (PHA_CHUNG_3_PHA, hiếm gặp hơn với TI/TU — xem ghi chú
 *  PHA_OPTIONS ở dga-logic.js) nghĩa là không tách riêng theo pha nên quy về "". */
function tioPhaseIdentity(phase) {
  return phase === DGA.PHA_CHUNG_3_PHA ? "" : (phase || "").trim();
}

/** Tổng số thiết bị (Trạm+Thiết bị+Pha đã chuẩn hóa) THỰC SỰ có ít nhất 1 bản ghi ở
 *  1 trong 3 nguồn dữ liệu — dùng làm mẫu số cho thống kê "Thiết bị đang có cảnh
 *  báo". Có thể giới hạn về đúng 1 Trạm (tham số "station") để khớp với bộ lọc
 *  #al_stationFilter — để trống/không truyền = đếm TẤT CẢ trạm như trước. */
function totalTrackedDeviceCount(station) {
  const keys = new Set();
  const matchesStation = (r) => !station || (r.tram || "").trim() === station;
  _allMeasurements.forEach((r) => {
    if (!matchesStation(r)) return;
    keys.add(deviceIdentityKey(r.tram, r.thiet_bi, gasPhaseIdentity(r.pha)));
  });
  _allOilTests.forEach((r) => {
    if (!matchesStation(r)) return;
    keys.add(deviceIdentityKey(r.tram, r.thiet_bi, oilPhaseIdentity(r.oil_sample_point, r.phase)));
  });
  _allOltcOilTests.forEach((r) => {
    if (!matchesStation(r)) return;
    keys.add(deviceIdentityKey(r.tram, r.thiet_bi, oltcPhaseIdentity(r.oltc_sample_point, r.phase)));
  });
  (_allTioOilTests || []).forEach((r) => {
    if (!matchesStation(r)) return;
    keys.add(deviceIdentityKey(r.tram, r.thiet_bi, tioPhaseIdentity(r.phase)));
  });
  return keys.size;
}

/** Danh sách gợi ý cho ô combo lọc "Trạm biến áp" (#al_stationFilter) — CHỈ liệt kê
 *  các trạm THỰC SỰ đang có ít nhất 1 thiết bị ở mức Cảnh báo/Báo động (tính lại từ 3
 *  hàm compute*Alerts() bên dưới), KHÔNG lấy toàn bộ danh mục Trạm (_allStations) —
 *  tránh gợi ý trạm không có cảnh báo nào, dẫn vào ngõ cụt giống lý do đã áp dụng cho
 *  trendStationOptions() ở ui-trend.js. setupCombo() tự gọi lại hàm này mỗi lần mở/gõ
 *  nên danh sách luôn theo đúng dữ liệu mới nhất. */
function alertStationOptions() {
  const allAlerts = [...computeGasAlerts(), ...computeOilAlerts(), ...computeOltcOilAlerts(), ...computeInstrumentOilAlerts()];
  const names = new Set();
  allAlerts.forEach((a) => { const n = (a.tram || "").trim(); if (n) names.add(n); });
  return Array.from(names)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((name) => ({ value: name, label: name }));
}

/** Rà soát khí hòa tan (đo DGA) — gộp theo ĐÚNG khóa thiết bị Trạm+Thiết bị+Pha đang
 *  dùng ở tab Lịch sử đo (deviceKey(), xem ui-history.js), lấy lần đo GẦN NHẤT của mỗi
 *  nhóm làm "hiện tại", lần đo liền trước (nếu có) để tính tốc độ sinh khí/đổi loại sự
 *  cố — giống HỆT quy trình DGA.computeOverallStatus() đang chạy khi phân tích 1 lần đo
 *  ở tab "DGA" (xem onAnalyze(), ui-dga.js), chỉ khác là chạy tự động cho MỌI thiết bị
 *  thay vì 1 lần đo người dùng vừa nhập. */
function computeGasAlerts() {
  const groups = new Map();
  _allMeasurements.forEach((r) => {
    const key = deviceKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const results = [];
  const manufacturerStandards = toManufacturerStandardsForLogic(_allStandards);

  groups.forEach((records) => {
    const sorted = records.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
    const latest = sorted[0];
    const prior = sorted[1] || null;

    const mbaSubtype = latest.mba_subtype ?? latest.mbaSubtype ?? null;
    const logicMeasurement = { equipmentType: latest.equipment_type, manufacturer: latest.manufacturer, mbaSubtype };
    const standard = DGA.resolveStandard(logicMeasurement, manufacturerStandards);

    const gases = recordGases(latest);
    const evalRows = DGA.evaluateAbsolute(gases, standard.limits);
    const overall = DGA.overallVerdict(evalRows);
    const exceedCount = DGA.countExceedTypical(gases, latest.equipment_type, logicMeasurement);
    const ratios = DGA.computeRatios(gases);
    // DGA.diagnoseGasFault() tự chọn đúng bảng theo loại thiết bị (Table A.10 cho sứ
    // xuyên, Table 1/Bảng 66 cho các loại còn lại) — xem chú thích đầy đủ ở onAnalyze()
    // (ui-dga.js), phải dùng giống hệt ở đây để tab "Cảnh báo" ra kết quả nhất quán.
    const diagnosis = DGA.diagnoseGasFault(gases, latest.equipment_type, standard.pdThreshold);
    const condemningRows = DGA.evaluateCondemning(gases, standard.condemning);

    let rateRows = null;
    let priorDiagnosis = null;
    if (prior) {
      // Chuẩn hóa khí lần đo trước về chữ HOA giống recordGases() — cùng lưu ý đã ghi ở
      // onAnalyze() (ui-dga.js)/renderRateTable() (ui-history.js): dữ liệu đọc từ Storage
      // lưu khí chữ thường, không chuẩn hóa lại sẽ làm sai lệch toàn bộ tốc độ sinh khí.
      const priorGases = recordGases(prior);
      const deltaDays = Math.round((new Date(latest.sample_date) - new Date(prior.sample_date)) / 86400000);
      rateRows = DGA.computeRateOfChange(priorGases, gases, deltaDays, standard.rate, latest.equipment_type);
      priorDiagnosis = DGA.diagnoseGasFault(priorGases, latest.equipment_type, standard.pdThreshold);
    }

    const overallStatus = DGA.computeOverallStatus({
      overallOk: overall === "Đạt", exceedCount, diagnosis, priorDiagnosis, rateRows, condemningRows,
    });

    // Tỷ lệ bổ sung (CO2/CO, O2/N2) + Tổng hàm lượng khí hòa tan (Bảng 63) — Điều 54
    // QĐ1901 — TÍNH LẠI y hệt onAnalyze() (ui-dga.js: additionalRatios/bang63), dùng
    // dieu54AdvisoryMessages() (dga-logic.js) để lấy ĐÚNG cùng điều kiện/câu chữ đang
    // hiện ở khối khuyến cáo của tab "DGA" — không tự định nghĩa lại ngưỡng ở đây. N2/O2
    // là tùy chọn nên có thể null (chưa nhập) — khi đó additionalRatios/bang63 tự báo
    // "chưa đủ dữ liệu" và dieu54Msgs rỗng, không ảnh hưởng gì.
    const n2 = latest.n2 ?? latest.N2 ?? null;
    const o2 = latest.o2 ?? latest.O2 ?? null;
    const additionalRatios = DGA.diagnoseAdditionalRatios(gases, n2, o2);
    const bang63Percent = DGA.computeTotalDissolvedGasPercent(gases, n2, o2);
    const bang63 = DGA.evaluateBang63(bang63Percent, latest.bang63_voltage_class || "110-220", !!latest.bang63_applicable);
    const dieu54Msgs = DGA.dieu54AdvisoryMessages({ additionalRatios, bang63 });

    // Cả 2 chỉ tiêu Điều 54 này VỐN không ảnh hưởng overallStatus ở tab "DGA" (chỉ tham
    // khảo/khuyến cáo thêm — xem dga-logic.js) — nhưng ở tab "Cảnh báo" (rà soát tự
    // động), một thiết bị CHỈ có vấn đề Điều 54 (các khí chính khác vẫn bình thường) vẫn
    // cần được liệt kê, không thể bỏ qua chỉ vì overallStatus đang "normal". Khi đó xếp
    // vào mức Cảnh báo (ALERT) — advisory, chưa tới mức Báo động. Nếu thiết bị ĐÃ Cảnh
    // báo/Báo động vì lý do khác, GIỮ NGUYÊN mức đó (không hạ cấp) và CHỈ nối thêm lý do
    // Điều 54 vào danh sách "reasons" để người dùng thấy đủ trong cùng 1 dòng.
    let effectiveStatus = overallStatus;
    if (dieu54Msgs.length > 0) {
      effectiveStatus = overallStatus.level === "normal"
        ? {
            level: "alert",
            label: "CẢNH BÁO (ALERT)",
            reasons: dieu54Msgs,
            action: "Đối chiếu Điều 54 QĐ1901 (tỷ lệ bổ sung CO2/CO, O2/N2, Tổng hàm lượng khí hòa tan Bảng 63) ở tab " +
              "\"DGA\"; xem xét phân tích furanic/đo độ trùng hợp giấy nếu nghi carbon hóa giấy cách điện, hoặc kiểm " +
              "tra lại quy trình xử lý dầu nếu vượt ngưỡng Bảng 63.",
          }
        : { ...overallStatus, reasons: [...overallStatus.reasons, ...dieu54Msgs] };
    }
    if (effectiveStatus.level === "normal") return;

    const condemnExceeded = DGA.condemningExceededRows(condemningRows);
    const condemnBad = condemnExceeded.length > 0;

    // Danh sách KHÍ cụ thể đã vượt ngưỡng (cột "Chỉ tiêu vượt ngưỡng") — gộp từ 3 nguồn
    // độc lập có thể khiến overallStatus báo Cảnh báo/Báo động: vượt ngưỡng tuyệt đối
    // đang áp dụng, vượt ngưỡng LOẠI BỎ riêng của NSX, và tốc độ tăng vượt Bảng 65. Có
    // thể rỗng nếu lý do DUY NHẤT là đổi loại sự cố (Bảng 66) giữa 2 lần đo liền kề —
    // khi đó không quy được về 1 khí cụ thể, xem cột "Hạng mục cảnh báo" để rõ lý do.
    const failingGases = evalRows.filter((r) => r.verdict === "Không đạt").map((r) => r.gas);
    const condemnGases = condemnExceeded.map((r) => r.gas);
    const rateGases = (rateRows || []).filter((r) => r.verdict && r.verdict.startsWith("⚠")).map((r) => r.gas);
    const exceededItems = Array.from(new Set([...failingGases, ...condemnGases, ...rateGases]));
    // Khóa thông số dùng để TỰ TICK đúng đường khí này ở tab "Xu hướng" khi bấm "Xem xu
    // hướng" (xem TREND_PARAM_DEFS/goToTrendForDevice) — cùng định dạng "gas:<TÊN KHÍ>"
    // (vd "gas:H2") mà ui-trend.js đang dùng cho checkbox thông số khí. Điều 54: tự tick
    // thêm đúng đường N2/O2/Bảng 63 tương ứng với ĐÚNG lý do đã kích hoạt cảnh báo này.
    const exceededKeys = exceededItems.map((g) => "gas:" + g);
    if (additionalRatios && additionalRatios.o2_n2 !== null && additionalRatios.o2_n2 < 0.3) {
      exceededKeys.push("gas:N2", "gas:O2");
    }
    if (bang63 && bang63.verdict === "Không đạt") {
      exceededKeys.push("gas:BANG63");
    }

    const statusText = (overall === "Đạt" ? "Đạt" : "Không đạt") + (condemnBad ? " (Vượt ngưỡng loại bỏ)" : "");

    results.push({
      source: "gas",
      sourceLabel: "Khí hòa tan (DGA)",
      tram: latest.tram || "",
      deviceName: latest.thiet_bi || "",
      thietBiLabel: (latest.thiet_bi || "?") + (latest.pha ? ` — ${DGA.phaLabelWithPrefix(latest.pha)}` : ""),
      level: effectiveStatus.level,
      levelLabel: effectiveStatus.label,
      statusHtml: (overall === "Đạt" ? verdictPill("Đạt") : verdictPill("Không đạt")) +
        (condemnBad ? ' <span class="pill bad">⚠ Loại bỏ</span>' : ""),
      statusText,
      exceededItems,
      exceededKeys,
      // Mỗi dòng cảnh báo khí hòa tan gắn với ĐÚNG 1 pha cụ thể (gộp theo deviceKey()
      // tram+thiet_bi+pha, xem groups ở trên) — dùng để CHỈ tick đúng pha này ở tab "Xu
      // hướng" khi bấm "Xem xu hướng" (xem goToTrendForDevice()), thay vì mặc định tick
      // sẵn cả A/B/C. Rỗng/không có nếu thiết bị không phân pha (vd 1 số MBA nhập gộp).
      phase: latest.pha || null,
      // Pha ĐỊNH DANH THIẾT BỊ đã chuẩn hóa (xem gasPhaseIdentity() phía trên file) —
      // dùng ở deviceIdentityKey() cho thống kê "Thiết bị đang theo dõi/cảnh báo".
      identityPhase: gasPhaseIdentity(latest.pha),
      reasons: effectiveStatus.reasons,
      action: effectiveStatus.action,
      lanDo: latest.lan_do ?? "—",
      sampleDate: latest.sample_date,
    });
  });

  return results;
}

/** Rà soát dầu MBA chính — gộp theo Trạm+Thiết bị (dầu MBA không có khái niệm Pha
 *  riêng), lấy thí nghiệm GẦN NHẤT của mỗi thiết bị, đối chiếu DGA.evaluateOilTest()
 *  (Bảng 58/55/54 QĐ1901) y hệt refreshOilTestsUI() (ui-oil.js). Không có khái niệm
 *  "Cảnh báo" trung gian cho dầu (chỉ Đạt/Không đạt/Chưa đủ dữ liệu) nên "Không đạt"
 *  được xếp thẳng vào mức Báo động (ALARM) — tương đương "vượt ngưỡng tuyệt đối" bên
 *  khí hòa tan. */
function computeOilAlerts() {
  const groups = new Map();
  _allOilTests.forEach((r) => {
    // Gộp theo Trạm+Thiết bị+điểm lấy mẫu — MBA/Kháng 3 pha rời (oil_sample_point=
    // "pharieng", thường gặp ở 500kV) có 3 chuỗi lịch sử dầu ĐỘC LẬP theo từng pha,
    // không được gộp lẫn khi tìm "lần thí nghiệm gần nhất" (y hệt lý do computeOltcOilAlerts()
    // gộp theo "sub" bên dưới).
    const sub = r.oil_sample_point === "pharieng" ? `pha:${r.phase || ""}` : "chung";
    const key = `${r.tram || ""}|||${r.thiet_bi || ""}|||${sub}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const results = [];
  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);

  groups.forEach((records) => {
    const latest = records.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date))[0];
    const evalResult = DGA.evaluateOilTest({
      voltageClass: latest.voltage_class, oilState: latest.oil_state, hasMembraneN2: latest.has_membrane_n2,
      manufacturer: latest.manufacturer || null, manufacturerOilStandards: oilStandardsForLogic,
      moisture: latest.moisture_ppm, tgd90: latest.tgd_90c_percent, bdv: latest.bdv_kv,
    });
    if (evalResult.overall !== "Không đạt") return; // bỏ qua "Đạt"/"Chưa đủ dữ liệu"

    const failing = evalResult.rows.filter((r) => r.verdict === "Không đạt");
    const phaSuffix = latest.oil_sample_point === "pharieng" && latest.phase ? ` — Pha ${latest.phase}` : "";
    results.push({
      source: "oil",
      sourceLabel: "Dầu MBA chính",
      tram: latest.tram || "",
      deviceName: latest.thiet_bi || "",
      thietBiLabel: (latest.thiet_bi || "?") + phaSuffix,
      level: "alarm",
      levelLabel: "BÁO ĐỘNG (ALARM)",
      statusHtml: verdictPill("Không đạt"),
      statusText: "Không đạt",
      exceededItems: failing.map((r) => r.label),
      // "oil:<key>" khớp đúng TREND_PARAM_DEFS ở ui-trend.js (r.key: "moisture"/"tgd90"/
      // "bdv", xem DGA.evaluateOilTest()) — dùng để tự tick đúng thông số dầu đã vượt
      // ngưỡng khi bấm "Xem xu hướng".
      exceededKeys: failing.map((r) => "oil:" + r.key),
      // Chỉ có 1 PHA cụ thể khi lấy mẫu riêng từng pha (oil_sample_point = "pharieng",
      // MBA/Kháng 3 pha rời) — mẫu "chung" đại diện cả 3 pha nên không giới hạn pha nào
      // ở tab "Xu hướng".
      phase: latest.oil_sample_point === "pharieng" ? (latest.phase || null) : null,
      // Pha ĐỊNH DANH THIẾT BỊ đã chuẩn hóa (xem oilPhaseIdentity() phía trên file).
      identityPhase: oilPhaseIdentity(latest.oil_sample_point, latest.phase),
      reasons: failing.map((r) =>
        `${r.label}: ${r.value} ${r.unit} (giới hạn ${r.direction === "ge" ? "≥" : "≤"} ${r.limit} ${r.unit}, ${r.ref}).`
      ),
      action: "Lấy mẫu dầu bổ sung xác nhận; xem xét lọc/sấy chân không hoặc thay dầu theo hướng dẫn nhà sản xuất; " +
        "đối chiếu thêm kết quả phân tích khí hòa tan (DGA) cùng thời điểm nếu có; báo cáo cấp có thẩm quyền theo " +
        "Điều 6 QĐ1901.",
      lanDo: "—",
      sampleDate: latest.sample_date,
    });
  });

  return results;
}

/** Rà soát dầu OLTC — gộp theo Trạm+Thiết bị+điểm lấy mẫu (mẫu chung 3 pha "chung",
 *  hoặc riêng từng pha "pha:A/B/C" khi oltc_sample_point = "pharieng"), lấy thí nghiệm
 *  GẦN NHẤT của mỗi nhóm, đối chiếu DGA.evaluateOltcOilTest() (Điều 37/Bảng 49 QĐ1901,
 *  hoặc Bảng 58/55/54 nếu là dầu MỚI) y hệt refreshOltcOilTestsUI() (ui-oltc.js). */
function computeOltcOilAlerts() {
  const groups = new Map();
  _allOltcOilTests.forEach((r) => {
    const sub = r.oltc_sample_point === "pharieng" ? `pha:${r.phase || ""}` : "chung";
    const key = `${r.tram || ""}|||${r.thiet_bi || ""}|||${sub}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const results = [];
  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);

  groups.forEach((records) => {
    const latest = records.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date))[0];
    const evalResult = DGA.evaluateOltcOilTest({
      oltcSamplePoint: latest.oltc_sample_point, voltageClass: latest.voltage_class, oilState: latest.oil_state,
      hasMembraneN2: latest.has_membrane_n2, manufacturer: latest.manufacturer || null,
      manufacturerOilStandards: oilStandardsForLogic,
      moisture: latest.moisture_ppm, tgd90: latest.tgd_90c_percent, bdv: latest.bdv_kv,
    });
    if (evalResult.overall !== "Không đạt") return;

    const failing = evalResult.rows.filter((r) => r.verdict === "Không đạt");
    const phaSuffix = latest.oltc_sample_point === "pharieng" && latest.phase ? ` — Pha ${latest.phase}` : "";
    results.push({
      source: "oltc",
      sourceLabel: "Dầu OLTC",
      tram: latest.tram || "",
      deviceName: latest.thiet_bi || "",
      thietBiLabel: `${latest.thiet_bi || "?"} (OLTC${phaSuffix})`,
      level: "alarm",
      levelLabel: "BÁO ĐỘNG (ALARM)",
      statusHtml: verdictPill("Không đạt"),
      statusText: "Không đạt",
      exceededItems: failing.map((r) => r.label),
      // "oltc:<key>" khớp đúng TREND_PARAM_DEFS ở ui-trend.js — dùng để tự tick đúng
      // thông số dầu OLTC đã vượt ngưỡng khi bấm "Xem xu hướng".
      exceededKeys: failing.map((r) => "oltc:" + r.key),
      // Chỉ có 1 PHA cụ thể khi lấy mẫu riêng từng pha (oltc_sample_point = "pharieng")
      // — mẫu "chung" đại diện cả 3 pha nên không giới hạn pha nào ở tab "Xu hướng".
      phase: latest.oltc_sample_point === "pharieng" ? (latest.phase || null) : null,
      // Pha ĐỊNH DANH THIẾT BỊ đã chuẩn hóa (xem oltcPhaseIdentity() phía trên file) —
      // ghép đúng với pha tương ứng của khí hòa tan/dầu chính khi MBA/Kháng 3 pha rời.
      identityPhase: oltcPhaseIdentity(latest.oltc_sample_point, latest.phase),
      reasons: failing.map((r) =>
        `${r.label}: ${r.value} ${r.unit}${r.limit === null ? "" : ` (giới hạn ${r.direction === "ge" ? "≥" : "≤"} ${r.limit} ${r.unit})`}, ${r.ref}.`
      ),
      action: "Lấy mẫu dầu OLTC bổ sung xác nhận; kiểm tra tiếp điểm/hồ quang khoang đổi nấc, xem xét lọc/thay dầu " +
        "OLTC theo hướng dẫn nhà sản xuất; báo cáo cấp có thẩm quyền theo Điều 6 QĐ1901.",
      lanDo: "—",
      sampleDate: latest.sample_date,
    });
  });

  return results;
}

/** Rà soát dầu TI/TU (_allTioOilTests, nạp bởi refreshTioOilTestsUI() ở ui-ti-oil.js)
 *  — gộp theo Trạm+Thiết bị+Pha (TI/TU hầu hết lấy mẫu riêng từng pha, xem
 *  tioPhaseIdentity() phía trên), lấy thí nghiệm GẦN NHẤT của mỗi nhóm, đối chiếu
 *  DGA.evaluateInstrumentOilTest() y hệt renderTioOilTestRows() (ui-ti-oil.js). KHÁC
 *  dầu MBA/OLTC (computeOilAlerts()/computeOltcOilAlerts() — nhị phân Đạt/Không đạt,
 *  "Không đạt" luôn xếp thẳng vào Báo động): dầu TI/TU có mức "Cảnh báo" TRUNG GIAN
 *  thật sự (2 ngưỡng Bình thường/Loại bỏ của nhà sản xuất, xem
 *  DGA.evaluateInstrumentOilTest()/verdictTwoTierOil() ở dga-logic.js) nên map
 *  "Cảnh báo" -> mức "alert", "Không đạt" -> mức "alarm" — giống cách khí hòa tan
 *  (computeGasAlerts()) có 2 mức. Bỏ qua "Đạt"/"Chưa đủ dữ liệu"/"Chưa có tiêu chuẩn
 *  nhà sản xuất" (thiết bị CHƯA cấu hình NSX ở tab "Cấu hình" — mục "Tiêu chuẩn" — không
 *  phải lỗi thiết bị, không nên liệt vào Cảnh báo). */
function computeInstrumentOilAlerts() {
  const groups = new Map();
  (_allTioOilTests || []).forEach((r) => {
    const key = `${r.tram || ""}|||${r.thiet_bi || ""}|||${tioPhaseIdentity(r.phase)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const results = [];
  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);

  groups.forEach((records) => {
    const latest = records.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date))[0];
    const equipmentType = latest.equipment_type || DGA.EQUIPMENT_TYPES.TI;
    const evalResult = DGA.evaluateInstrumentOilTest({
      equipmentType, manufacturer: latest.manufacturer || null, manufacturerOilStandards: oilStandardsForLogic,
      moisture: latest.moisture_ppm, tgd90: latest.tgd_90c_percent,
      tgd20: latest.tgd_20c_percent, bdv: latest.bdv_kv, umKv: latest.um_kv,
    });
    if (evalResult.overall !== "Không đạt" && evalResult.overall !== "Cảnh báo") return;

    const level = evalResult.overall === "Không đạt" ? "alarm" : "alert";
    // Chỉ liệt vào "Chỉ tiêu vượt ngưỡng" đúng những hạng mục cùng mức verdict với
    // overall vừa xác định ở trên (VD overall="Cảnh báo" thì KHÔNG lẫn hạng mục đã
    // "Không đạt" — dù trường hợp đó overall đã là "Không đạt" nên không tới đây).
    const failing = evalResult.rows.filter((r) => r.verdict === evalResult.overall);
    const phaSuffix = latest.phase && latest.phase !== DGA.PHA_CHUNG_3_PHA ? ` — ${DGA.phaLabelWithPrefix(latest.phase)}` : "";
    results.push({
      source: "tio",
      sourceLabel: `Dầu ${tioEquipmentTypeShort(equipmentType)}`,
      tram: latest.tram || "",
      deviceName: latest.thiet_bi || "",
      thietBiLabel: (latest.thiet_bi || "?") + phaSuffix,
      level,
      levelLabel: level === "alarm" ? "BÁO ĐỘNG (ALARM)" : "CẢNH BÁO (ALERT)",
      statusHtml: tioVerdictPill(evalResult.overall),
      statusText: evalResult.overall,
      exceededItems: failing.map((r) => r.label),
      // Tab "Xu hướng" (TREND_PARAM_DEFS, ui-trend.js) CHƯA hỗ trợ theo dõi dầu TI/TU
      // theo thời gian — để rỗng, nút "Xem xu hướng" vẫn chuyển đúng Trạm/Thiết bị
      // nhưng chưa tự tick được thông số nào (khác gas/oil/oltc).
      exceededKeys: [],
      phase: latest.phase && latest.phase !== DGA.PHA_CHUNG_3_PHA ? latest.phase : null,
      identityPhase: tioPhaseIdentity(latest.phase),
      reasons: failing.map((r) =>
        `${r.label}: ${r.value} ${r.unit}${r.limit ? ` (${r.limit})` : ""}. ${r.ref}.`
      ),
      action: "Lấy mẫu dầu bổ sung xác nhận; đối chiếu hướng dẫn nhà sản xuất (QĐ1901 Điều 10/11 không quy định " +
        "ngưỡng số mặc định cho dầu TI/TU, chỉ dẫn chiếu \"theo quy định nhà sản xuất\" — bổ sung/kiểm tra lại cấu " +
        "hình tiêu chuẩn ở tab \"Cấu hình\" — mục \"Tiêu chuẩn\" nếu cần); báo cáo cấp có thẩm quyền theo Điều 6 QĐ1901.",
      lanDo: "—",
      sampleDate: latest.sample_date,
    });
  });

  return results;
}

function alertLevelPill(level, label) {
  // Cùng quy ước icon theo cấp độ đã dùng ở STATUS_ICON (ui-dga.js)/.status-badge
  // (index.html, banner kết quả phân tích) — alert: tam giác, alarm: bát giác.
  const icon = level === "alarm" ? "alert-octagon" : "alert-triangle";
  return `<span class="status-pill status-${level}"><svg class="icon-svg" aria-hidden="true"><use href="#icon-${icon}"></use></svg>${escapeHtml(label)}</span>`;
}

/** Icon nhỏ trước tên "Loại đo" (cột trong bảng) để phân biệt nhanh khí hòa tan
 *  (icon-flask, giống tab "DGA") với dầu MBA/OLTC (icon-droplet, giống tab "Dầu
 *  cách điện") — không thêm khái niệm mới, chỉ tái dùng đúng icon nav đã có. */
function sourceIcon(source) {
  const icon = source === "gas" ? "flask" : "droplet";
  return `<svg class="icon-svg" aria-hidden="true" style="width:15px; height:15px; margin-right:6px; vertical-align:-2px;"><use href="#icon-${icon}"></use></svg>`;
}

/** Chuyển sang tab "Xu hướng" và MỞ HẲN biểu đồ/lịch sử của đúng Trạm+Thiết bị của
 *  dòng cảnh báo vừa bấm — set giá trị 2 ô combo #tr_station/#tr_device (để lần sau
 *  mở lại combo vẫn thấy đúng giá trị đã chọn) RỒI GỌI THẲNG updateTrendEmptyNote()/
 *  onTrendDeviceChange() (xem ui-trend.js) thay vì chỉ bắn sự kiện "change" và hy
 *  vọng listener xử lý kịp — đảm bảo biểu đồ hiện ra NGAY, người dùng không cần
 *  chọn/gõ lại gì thêm ở 2 ô đó. */
function goToTrendForDevice(tram, thietBi, exceededKeys, phase) {
  const tabBtn = document.querySelector('button.tab-btn[data-tab="xuhuong"]');
  if (tabBtn) tabBtn.click();
  const stationSel = $("tr_station");
  const deviceSel = $("tr_device");
  if (stationSel) stationSel.value = tram || "";
  if (deviceSel) deviceSel.value = thietBi || "";
  // Tự TICK sẵn đúng (các) thông số đã khiến thiết bị này bị liệt vào danh sách Cảnh
  // báo (vd "gas:H2", "oil:moisture" — xem exceededKeys ở computeGasAlerts()/
  // computeOilAlerts()/computeOltcOilAlerts() trên) — _trendSelectedParams (ui-trend.js)
  // vốn được GIỮ NGUYÊN qua các lần đổi thiết bị để khỏi phải chọn lại, nên nếu người
  // dùng chưa từng mở tab "Xu hướng" trước đó thì Set này đang RỖNG và biểu đồ sẽ
  // trống trơn — phải chủ động thêm vào đây thì đồ thị mới hiện NGAY thông số đã cảnh
  // báo, đúng yêu cầu "không phải lọc chọn lại". Dùng "thêm vào" (không xóa các thông
  // số đang tick sẵn) để không làm mất lựa chọn khác người dùng đang xem.
  if (Array.isArray(exceededKeys) && typeof TREND_PARAM_DEFS !== "undefined") {
    exceededKeys.forEach((k) => { if (TREND_PARAM_DEFS[k]) _trendSelectedParams.add(k); });
  }
  // Nếu dòng cảnh báo vừa bấm gắn với ĐÚNG 1 PHA cụ thể (khí hòa tan theo pha, hoặc dầu
  // OLTC lấy mẫu riêng từng pha — xem trường "phase" ở computeGasAlerts()/
  // computeOltcOilAlerts() trên), THAY THẾ (không cộng dồn) bộ lọc pha ở tab "Xu hướng"
  // bằng đúng 1 pha đó — mặc định _trendSelectedPhases (ui-trend.js) đang tick sẵn cả
  // A/B/C, nếu không thay thế thì bấm cảnh báo của riêng Pha C vẫn hiện cả 3 pha, gây
  // hiểu lầm/rối biểu đồ. Không đụng gì nếu thiết bị không phân pha (phase rỗng/null).
  if (phase && typeof _trendSelectedPhases !== "undefined") {
    _trendSelectedPhases = new Set([phase]);
  }
  if (typeof updateTrendEmptyNote === "function") updateTrendEmptyNote();
  if (typeof onTrendDeviceChange === "function") onTrendDeviceChange();
}

// Cache kết quả lần refreshAlertsUI() gần nhất — dùng cho onExportAlertsExcel() để
// xuất ĐÚNG những gì đang hiển thị trên bảng, khỏi phải tính lại (và khỏi lệch nhau
// nếu 2 nơi tính theo 2 cách khác nhau).
let _lastAlerts = [];

function refreshAlertsUI() {
  const tbody = $("alertsTable");
  if (!tbody) return; // phòng khi gọi trước khi DOM có tab này (không nên xảy ra)

  // Lọc theo Trạm biến áp (#al_stationFilter, combo tự gõ-tìm — xem alertStationOptions()
  // ở trên) — để trống = xem TẤT CẢ trạm đang có cảnh báo (mặc định, không đổi hành vi cũ).
  const station = $("al_stationFilter") ? $("al_stationFilter").value.trim() : "";
  const allAlerts = [...computeGasAlerts(), ...computeOilAlerts(), ...computeOltcOilAlerts(), ...computeInstrumentOilAlerts()];
  const alerts = station ? allAlerts.filter((a) => (a.tram || "").trim() === station) : allAlerts;
  // Báo động (ALARM) lên trước Cảnh báo (ALERT); trong cùng mức, mới nhất lên trước.
  alerts.sort((a, b) => {
    if (a.level !== b.level) return a.level === "alarm" ? -1 : 1;
    return new Date(b.sampleDate) - new Date(a.sampleDate);
  });
  _lastAlerts = alerts;

  tbody.innerHTML = "";
  const emptyEl = $("alertsEmpty");
  emptyEl.classList.toggle("hidden", alerts.length > 0);
  if (alerts.length === 0) {
    emptyEl.textContent = station
      ? `Trạm "${station}" hiện không có thiết bị nào đang ở mức Cảnh báo/Báo động (theo lần đo gần nhất của từng thiết bị).`
      : "Chưa phát hiện thiết bị nào đang ở mức Cảnh báo/Báo động — tất cả thiết bị đã có dữ liệu đều đang ở mức " +
        "Bình thường (theo lần đo gần nhất của từng thiết bị).";
  }

  alerts.forEach((a) => {
    const tr = document.createElement("tr");
    // Icon cạnh tên khí CHỈ áp dụng khi nguồn là "gas" (khí hòa tan) — nguồn "oil"/
    // "oltc" liệt kê nhãn mô tả (vd "Độ ẩm dầu"), không phải tên 1 khí cụ thể.
    const exceededHtml = (a.exceededItems || []).length === 0
      ? "—"
      : a.exceededItems.map((g) =>
          `<span class="pill bad" style="margin:0 3px 3px 0;">${a.source === "gas" ? gasLabelIcon(g) : ""}${escapeHtml(g)}</span>`
        ).join("");
    tr.innerHTML = `
      <td>${escapeHtml(a.tram || "—")}</td>
      <td>${escapeHtml(a.thietBiLabel)}</td>
      <td>${sourceIcon(a.source)}${escapeHtml(a.sourceLabel)}</td>
      <td>${alertLevelPill(a.level, a.levelLabel)}</td>
      <td>${a.statusHtml}</td>
      <td style="max-width:160px;">${exceededHtml}</td>
      <td style="font-size:12px; max-width:320px;">${a.reasons.map((r) => escapeHtml(r)).join("<br>")}</td>
      <td style="font-size:12px; max-width:280px;">${escapeHtml(a.action)}</td>
      <td>${a.lanDo}</td>
      <td>${a.sampleDate}</td>
      <td class="actions-cell"><div class="btn-row">
        <button class="btn ghost icon-only" data-action="trend" title="Xem xu hướng" aria-label="Xem xu hướng của thiết bị này">
          <svg class="icon-svg" aria-hidden="true"><use href="#icon-trend"></use></svg>
        </button>
      </div></td>
    `;
    const trendBtn = tr.querySelector('[data-action="trend"]');
    if (trendBtn) trendBtn.addEventListener("click", () => goToTrendForDevice(a.tram, a.deviceName, a.exceededKeys, a.phase));
    tbody.appendChild(tr);
  });

  const totalDevices = totalTrackedDeviceCount(station);
  // deviceIdentityKey() gồm cả Pha — nếu chỉ dùng Trạm+Thiết bị, cảnh báo ở TI 174 pha B
  // và TI 174 pha C (2 thiết bị vật lý khác nhau, cùng tên "thiet_bi") sẽ bị đếm gộp
  // thành 1, làm số "Thiết bị đang có cảnh báo" thấp hơn thực tế.
  const warnDeviceKeys = new Set(alerts.map((a) => deviceIdentityKey(a.tram, a.deviceName, a.identityPhase)));
  const alarmCount = alerts.filter((a) => a.level === "alarm").length;
  const alertCount = alerts.filter((a) => a.level === "alert").length;
  if ($("al_totalDevices")) $("al_totalDevices").textContent = String(totalDevices);
  if ($("al_warnDevices")) $("al_warnDevices").textContent = `${warnDeviceKeys.size} / ${totalDevices}`;
  if ($("al_alertCount")) $("al_alertCount").textContent = String(alertCount);
  if ($("al_alarmCount")) $("al_alarmCount").textContent = String(alarmCount);
  if ($("btnExportAlertsExcel")) $("btnExportAlertsExcel").disabled = alerts.length === 0;
}

/** Xuất danh sách cảnh báo đang hiển thị (_lastAlerts, xem refreshAlertsUI() ở trên)
 *  ra file Excel (.xlsx) — dùng thư viện SheetJS (biến toàn cục "XLSX", tải qua CDN ở
 *  index.html, xem cùng cách tải/kiểm tra Chart.js: nếu mất mạng/CDN lỗi thì báo lỗi
 *  rõ ràng thay vì im lặng thất bại). Toàn bộ xử lý diễn ra ngay trong trình duyệt —
 *  không gửi dữ liệu lên server nào khác. */
function onExportAlertsExcel() {
  if (typeof XLSX === "undefined") {
    notifyError("Không tải được thư viện xuất Excel (có thể do mất mạng khi tải trang) — kiểm tra kết nối mạng rồi tải lại trang.");
    return;
  }
  if (_lastAlerts.length === 0) {
    notifyError("Chưa có thiết bị nào đang ở mức Cảnh báo/Báo động để xuất.");
    return;
  }

  const now = new Date();
  const exportedAt = now.toLocaleString("vi-VN");
  // Khớp đúng bộ lọc Trạm đang áp dụng trên bảng (#al_stationFilter) — xuất đúng những
  // gì đang hiển thị, kể cả khi đã lọc về 1 trạm cụ thể.
  const station = $("al_stationFilter") ? $("al_stationFilter").value.trim() : "";
  const totalDevices = totalTrackedDeviceCount(station);
  // Xem chú thích ở warnDeviceKeys trong refreshAlertsUI() — phải gồm cả Pha (deviceIdentityKey())
  // để không gộp nhầm các Pha khác nhau của cùng 1 TI thành 1 thiết bị.
  const warnDeviceKeys = new Set(_lastAlerts.map((a) => deviceIdentityKey(a.tram, a.deviceName, a.identityPhase)));
  const alarmCount = _lastAlerts.filter((a) => a.level === "alarm").length;
  const alertCount = _lastAlerts.filter((a) => a.level === "alert").length;

  const HEADER = [
    "Trạm", "Thiết bị", "Loại đo", "Mức cảnh báo", "Tình trạng", "Chỉ tiêu vượt ngưỡng",
    "Hạng mục cảnh báo", "Khuyến cáo", "Lần đo", "Ngày thí nghiệm",
  ];
  const aoa = [
    ["BÁO CÁO CẢNH BÁO THIẾT BỊ — Đánh giá Dầu cách điện (QĐ1901/EVNNPT)"],
    [station ? `Ngày xuất: ${exportedAt}  |  Trạm biến áp: ${station}` : `Ngày xuất: ${exportedAt}  |  Trạm biến áp: Tất cả`],
    [
      `Tổng thiết bị theo dõi: ${totalDevices}`,
      `Thiết bị đang có cảnh báo: ${warnDeviceKeys.size}/${totalDevices}`,
      `Mức Cảnh báo (ALERT): ${alertCount}`,
      `Mức Báo động (ALARM): ${alarmCount}`,
    ],
    [],
    HEADER,
    ..._lastAlerts.map((a) => [
      a.tram || "—",
      a.thietBiLabel,
      a.sourceLabel,
      a.levelLabel,
      a.statusText || "",
      (a.exceededItems || []).join(", ") || "—",
      (a.reasons || []).join("\n"),
      a.action || "",
      a.lanDo,
      a.sampleDate,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 18 },
    { wch: 55 }, { wch: 45 }, { wch: 8 }, { wch: 14 },
  ];
  // Gộp ô tiêu đề/dòng thống kê cho gọn (span hết bề rộng bảng, 10 cột).
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADER.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: HEADER.length - 1 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cảnh báo thiết bị");

  const fileDate = now.toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Canh_bao_thiet_bi_${fileDate}.xlsx`);
}
