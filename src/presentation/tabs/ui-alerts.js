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

/** Thống kê cảnh báo THEO THIẾT BỊ (Trạm + Thiết bị + Pha định danh) — 1 thiết bị có thể có nhiều dòng cảnh báo,
 *  mỗi dòng 1 nguồn dữ liệu (khí hòa tan / dầu MBA chính / dầu OLTC / dầu TI-TU). Trước đây thẻ "Mức Cảnh báo"/"Mức
 *  Báo động" đếm SỐ DÒNG còn thẻ "Thiết bị đang có cảnh báo" đếm SỐ THIẾT BỊ → 37 + 3 = 40 nhưng chỉ 39 thiết bị (1
 *  thiết bị cảnh báo ở 2 nguồn). Nay mỗi thiết bị tính ĐÚNG 1 LẦN ở mức NẶNG NHẤT của nó (Báo động > Cảnh báo >
 *  Bình thường) nên alarmDevices + alertDevices = số thiết bị đang có cảnh báo. Vẫn trả số dòng để hiện kèm.
 *  Hàm thuần — dùng chung cho thẻ KPI tab Cảnh báo, file Excel và chuông ở header (có test). */
function alertLevelSummary(rows) {
  const rank = { alarm: 2, alert: 1, normal: 0 };
  const byDevice = new Map();
  const sources = new Map();
  const rowsBy = { alarm: 0, alert: 0, normal: 0 };
  (rows || []).forEach((a) => {
    const lvl = rank[a.level] === undefined ? "normal" : a.level;
    rowsBy[lvl]++;
    const k = deviceIdentityKey(a.tram, a.deviceName, a.identityPhase);
    if (!byDevice.has(k) || rank[lvl] > rank[byDevice.get(k)]) byDevice.set(k, lvl);
    if (lvl !== "normal") {
      if (!sources.has(k)) sources.set(k, new Set());
      sources.get(k).add(a.source || "");
    }
  });
  const levels = Array.from(byDevice.values());
  return {
    devices: byDevice.size,
    warnDevices: levels.filter((l) => l !== "normal").length,
    alarmDevices: levels.filter((l) => l === "alarm").length,
    alertDevices: levels.filter((l) => l === "alert").length,
    normalDevices: levels.filter((l) => l === "normal").length,
    alarmRows: rowsBy.alarm,
    alertRows: rowsBy.alert,
    normalRows: rowsBy.normal,
    multiSourceDevices: Array.from(sources.values()).filter((s) => s.size > 1).length,
    deviceLevels: byDevice,
  };
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
function totalTrackedDeviceCount(station, device) {
  const keys = new Set();
  const matchesStation = (r) =>
    (!station || (r.tram || "").trim() === station) && (!device || (r.thiet_bi || "").trim() === device);
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
  const allAlerts = collectAllAlerts();
  const names = new Set();
  allAlerts.forEach((a) => { const n = (a.tram || "").trim(); if (n) names.add(n); });
  return Array.from(names)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((name) => ({ value: name, label: name }));
}

/** Bộ lọc đang áp dụng ở tab "Cảnh báo": Trạm (#al_stationFilter) và Thiết bị (#al_deviceFilter). */
function alertFilters() {
  return {
    station: $("al_stationFilter") ? $("al_stationFilter").value.trim() : "",
    device: $("al_deviceFilter") ? $("al_deviceFilter").value.trim() : "",
    // "Loại cảnh báo" (#al_typeFilter): "level:alarm|alert", "src:gas|oil|oltc|tio" hoặc "cat:<hạng mục>"
    type: $("al_typeFilter") ? $("al_typeFilter").value : "",
    // "Số liệu" (#al_dataFilter): "" tất cả | "latest" chỉ số liệu mới nhất | "stale" chỉ cảnh báo cũ
    data: $("al_dataFilter") ? $("al_dataFilter").value : "",
  };
}

/** Khớp 1 cảnh báo với giá trị ô "Loại cảnh báo" (xem alertFilters()). */
function alertMatchesType(a, type) {
  if (!type) return true;
  const [kind, val] = type.split(":");
  if (kind === "level") return a.level === val;
  if (kind === "src") return a.source === val;
  if (kind === "cat") return (a.categories || []).includes(val);
  return true;
}

function filterAlertsBy(alerts, { station, device, type, data }) {
  return alerts.filter((a) =>
    (!station || (a.tram || "").trim() === station) && (!device || (a.deviceName || "").trim() === device) &&
    alertMatchesType(a, type) &&
    (!data || (data === "latest" ? a.isLatest !== false : a.isLatest === false)));
}

/** Chuẩn hóa tên Trạm/Thiết bị để so "cùng thiết bị" khi xét số liệu mới nhất: bỏ khoảng trắng
 *  thừa, không phân biệt hoa/thường (VD "AT1 " và "at1" là cùng 1 máy nhập lệch tên). */
function alertNameKey(s) {
  return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Vị trí của bản ghi đang được cảnh báo ("latest" của nhóm) trong TOÀN BỘ chuỗi số liệu cùng thiết bị
 *  (cùng nguồn dữ liệu, cùng Trạm+Thiết bị đã chuẩn hóa tên, Pha tương thích — trùng Pha, hoặc 1 trong 2
 *  không tách pha). Trả về thứ tự lần đo (k/n theo thời gian) và có phải SỐ LIỆU MỚI NHẤT trong database
 *  không — nếu đã có bản ghi mới hơn (VD nhập lệch Pha/tên thiết bị nên rơi sang nhóm khác) thì cảnh báo
 *  này là của QUÁ KHỨ: newerRecord = bản ghi mới nhất đó. */
function alertSeriesContext(latest, records, phaseIdOf) {
  const tram = alertNameKey(latest.tram), dev = alertNameKey(latest.thiet_bi), ph = phaseIdOf(latest);
  const series = (records || []).filter((r) => {
    if (alertNameKey(r.tram) !== tram || alertNameKey(r.thiet_bi) !== dev) return false;
    const p = phaseIdOf(r);
    return p === ph || p === "" || ph === "";
  });
  const desc = alertSortRecordsDescending(series);
  const idx = desc.indexOf(latest);
  const stale = idx > 0;
  return {
    ordinal: idx < 0 ? null : series.length - idx,
    total: series.length,
    isLatest: !stale,
    newerRecord: stale ? desc[0] : null,
  };
}

/** Gộp cảnh báo của cả 4 nguồn; với cảnh báo cũ (đã có số liệu mới hơn) đánh dấu số liệu mới nhất CÒN
 *  cảnh báo hay KHÔNG (newerStillAlert) — bản ghi mới nhất luôn là "latest" của nhóm của nó nên chỉ cần
 *  tra xem có cảnh báo nào gắn với đúng bản ghi đó. */
function collectAllAlerts(opts = {}) {
  const all = [...computeGasAlerts(opts), ...computeOilAlerts(opts), ...computeOltcOilAlerts(opts), ...computeInstrumentOilAlerts(opts)];
  const byRecord = new Map();
  all.forEach((a) => { if (a.record) byRecord.set(a.record, a); });
  all.forEach((a) => {
    if (a.isLatest === false && a.newerRecord) {
      const n = byRecord.get(a.newerRecord);
      a.newerStillAlert = !!n;
      a.newerLevelLabel = n ? n.levelLabel : null;
    }
  });
  return all;
}

/** Ô "Lần đo": số Lần đo (khí hòa tan), thứ tự k/n trong chuỗi số liệu, nhãn số liệu mới nhất / cảnh báo cũ. */
function alertLanDoHtml(a) {
  const parts = [];
  if (a.lanDo !== undefined && a.lanDo !== null && a.lanDo !== "—" && a.lanDo !== "") parts.push(`<div><b>Lần ${escapeHtml(a.lanDo)}</b></div>`);
  if (a.ordinal) parts.push(`<div style="font-size:11px; color:var(--text-tertiary);">thứ ${a.ordinal}/${a.total} lần đo</div>`);
  if (a.isLatest === false && a.newerRecord) {
    const nr = a.newerRecord;
    const nrLan = nr.lan_do !== undefined && nr.lan_do !== null && nr.lan_do !== "" ? `, Lần ${nr.lan_do}` : "";
    const nrPha = nr.pha || nr.phase;
    const after = a.newerStillAlert ? `vẫn ${a.newerLevelLabel || "cảnh báo"}` : "đã KHÔNG còn cảnh báo";
    parts.push(`<span class="pill warn" style="margin-top:3px; font-size:10px;" title="Đã có số liệu mới hơn trong database (ngày ${escapeHtml(nr.sample_date || "?")}${escapeHtml(nrLan)}) — cảnh báo này là của lần đo trước. Kiểm tra Pha/tên thiết bị của các bản ghi nếu cần.">⚠ Cảnh báo cũ</span>`);
    parts.push(`<div style="font-size:11px; margin-top:2px;">Số liệu mới nhất: ${escapeHtml(nr.sample_date || "?")}${escapeHtml(nrLan)}${nrPha ? ` (${escapeHtml(DGA.phaLabelWithPrefix(nrPha))})` : ""} — ${escapeHtml(after)}</div>`);
  } else if (a.isLatest) {
    parts.push(`<span class="pill ok" style="margin-top:3px; font-size:10px;" title="Đây là số liệu mới nhất của thiết bị trong database">✓ Mới nhất</span>`);
  }
  return parts.join("") || "—";
}

/** Gợi ý cho ô "Thiết bị" (#al_deviceFilter) — CHỈ các thiết bị đang có Cảnh báo/Báo động và
 *  THUỘC trạm đang chọn ở #al_stationFilter (đọc lại mỗi lần mở/gõ, nên luôn theo đúng trạm hiện
 *  tại). Để trống Trạm: gợi ý thiết bị của mọi trạm, kèm tên trạm để phân biệt (giống
 *  trendDeviceOptions() ở ui-trend.js). Mỗi tên thiết bị gom mọi Pha/loại đo của nó. */
function alertDeviceOptions() {
  const { station } = alertFilters();
  const allAlerts = collectAllAlerts();
  const byName = new Map();
  filterAlertsBy(allAlerts, { station, device: "" }).forEach((a) => {
    const name = (a.deviceName || "").trim();
    if (!name) return;
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name).add((a.tram || "").trim());
  });
  return Array.from(byName.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "vi", { numeric: true }))
    .map(([name, trams]) => ({ value: name, label: station || trams.size === 0 ? name : `${name} — ${Array.from(trams).join(", ")}` }));
}

/** Sắp xếp bản ghi theo thứ tự thời gian giảm dần:
 *  1) Ngày lấy mẫu (sample_date) mới nhất lên trước
 *  2) Nếu cùng ngày lấy mẫu: Lần đo (lan_do) lớn hơn lên trước
 *  3) Nếu vẫn trùng: Thời điểm tạo/id mới hơn lên trước */
function alertSortRecordsDescending(records) {
  return records.slice().sort((a, b) => {
    const dt = new Date(b.sample_date) - new Date(a.sample_date);
    if (!isNaN(dt) && dt !== 0) return dt;
    const lanA = Number(a.lan_do) || 0;
    const lanB = Number(b.lan_do) || 0;
    if (lanA !== lanB) return lanB - lanA;
    return String(b.created_at || b.id || "").localeCompare(String(a.created_at || a.id || ""));
  });
}

/** Rà soát khí hòa tan (đo DGA) — gộp theo ĐÚNG khóa thiết bị Trạm+Thiết bị+Pha đang
 *  dùng ở tab Lịch sử đo (deviceKey(), xem ui-history.js), lấy lần đo GẦN NHẤT của mỗi
 *  nhóm làm "hiện tại", lần đo liền trước (nếu có) để tính tốc độ sinh khí/đổi loại sự
 *  cố — giống HỆT quy trình DGA.computeOverallStatus() đang chạy khi phân tích 1 lần đo
 *  ở tab "DGA" (xem onAnalyze(), ui-dga.js), chỉ khác là chạy tự động cho MỌI thiết bị
 *  thay vì 1 lần đo người dùng vừa nhập. */
function computeGasAlerts(opts = {}) {
  const groups = new Map();
  _allMeasurements.forEach((r) => {
    const tram = (r.tram || "").trim();
    const thietbi = (r.thiet_bi || "").trim();
    // Pha ĐÃ CHUẨN HÓA (gasPhaseIdentity): "" (để trống) và "chung3pha" là CÙNG 1 thiết bị không tách pha —
    // gộp theo Pha thô sẽ thành 2 nhóm, nhóm bản ghi cũ để trống Pha bị coi là "lần đo gần nhất" và hiện
    // cảnh báo CŨ dù số liệu mới (Pha "Chung 3 pha") đã hết cảnh báo.
    const pha = gasPhaseIdentity((r.pha || "").trim());
    const key = `${tram}|||${thietbi}|||${pha}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const results = [];
  const manufacturerStandards = toManufacturerStandardsForLogic(_allStandards);

  groups.forEach((records) => {
    const sorted = alertSortRecordsDescending(records);
    const latest = sorted[0];
    // Lần đo liền trước = lần GẦN NHẤT có ngày lấy mẫu NHỎ HƠN HẲN lần đo hiện tại — y hệt
    // cách onAnalyze() (ui-dga.js) chọn `prior`. KHÔNG lấy sorted[1]: khi có 2 bản ghi CÙNG
    // ngày (VD bản nhập sai + bản nhập lại cho đúng), sorted[1] chính là bản nhập sai, khiến
    // "loại sự cố đổi khác" bị so với số liệu sai -> Báo động dù lần đo hiện tại đã Đạt.
    const latestTime = new Date(latest.sample_date).getTime();
    const prior = sorted.find((r) => new Date(r.sample_date).getTime() < latestTime) || null;

    const mbaSubtype = latest.mba_subtype ?? latest.mbaSubtype ?? null;
    const logicMeasurement = { equipmentType: latest.equipment_type, manufacturer: latest.manufacturer, mbaSubtype };
    const standard = DGA.resolveStandard(logicMeasurement, manufacturerStandards);

    const gases = recordGases(latest);
    // Khí KPH (lưu = 0) — cùng quy ước chế độ "Xem" lần đo (ui-dga.js) và onAnalyze(): KPH
    // làm tỷ số khí mất hiệu lực chẩn đoán (Điều 54 QĐ1901 & IEC 60599 mục 6.1(c)). Thiếu
    // bước này, tab "Cảnh báo" tự suy ra mã sự cố từ các tỷ số 0/x và báo "đổi loại sự cố"
    // (Báo động) cho thiết bị mà tab "Khí hòa tan" đánh giá là Bình thường.
    const kphOf = (g) => {
      const out = {};
      for (const name of DGA.GASES) if (g[name] === 0) out[name] = true;
      return out;
    };
    const kphGases = kphOf(gases);
    const evalRows = DGA.evaluateAbsolute(gases, standard.limits, kphGases);
    const overall = DGA.overallVerdict(evalRows);
    const exceedCount = DGA.countExceedTypical(gases, latest.equipment_type, logicMeasurement);
    // DGA.diagnoseGasFault() tự chọn đúng bảng theo loại thiết bị (Table A.10 cho sứ
    // xuyên, Table 1/Bảng 66 cho các loại còn lại) — xem chú thích đầy đủ ở onAnalyze()
    // (ui-dga.js), phải dùng giống hệt ở đây để tab "Cảnh báo" ra kết quả nhất quán.
    const diagnosis = DGA.diagnoseGasFault(gases, latest.equipment_type, standard.pdThreshold, kphGases);
    const condemningRows = DGA.evaluateCondemning(gases, standard.condemning);

    let rateRows = null;
    let priorDiagnosis = null;
    if (prior) {
      // Chuẩn hóa khí lần đo trước về chữ HOA giống recordGases() — cùng lưu ý đã ghi ở
      // onAnalyze() (ui-dga.js)/renderRateTable() (ui-history.js): dữ liệu đọc từ Storage
      // lưu khí chữ thường, không chuẩn hóa lại sẽ làm sai lệch toàn bộ tốc độ sinh khí.
      const priorGases = recordGases(prior);
      const deltaDays = Math.round((new Date(latest.sample_date) - new Date(prior.sample_date)) / 86400000);
      rateRows = DGA.computeRateOfChange(priorGases, gases, deltaDays, standard.rate, latest.equipment_type, kphGases);
      priorDiagnosis = DGA.diagnoseGasFault(priorGases, latest.equipment_type, standard.pdThreshold, kphOf(priorGases));
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
    // Điều 54 chỉ áp cho MBA/Kháng dầu (dieu54Applies()) — TI/TU, sứ xuyên không xét tỷ lệ bổ sung/Bảng 63.
    const dieu54On = DGA.dieu54Applies(latest.equipment_type);
    const dieu54Msgs = DGA.dieu54AdvisoryMessages({ additionalRatios, bang63, equipmentType: latest.equipment_type });
    // Khuyến cáo hành động RIÊNG theo đúng điều kiện đã kích hoạt (CO2/CO thấp/cao, O2/N2, Bảng 63)
    const dieu54Acts = DGA.dieu54ActionMessages({ additionalRatios, bang63, equipmentType: latest.equipment_type });
    const addFlags = dieu54On ? DGA.dieu54AdditionalFlags(additionalRatios) : { co2co: false, o2n2: false };
    const bang63Bad = dieu54On && bang63 && bang63.verdict === "Không đạt";

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
            action: dieu54Acts.map((t) => "• " + t).join("\n"),
          }
        : {
            ...overallStatus,
            reasons: [...overallStatus.reasons, ...dieu54Msgs],
            // Giữ khuyến cáo của mức Cảnh báo/Báo động hiện có, nối thêm khuyến cáo Điều 54 tương ứng
            action: [overallStatus.action, ...dieu54Acts.map((t) => "• " + t)].filter(Boolean).join("\n"),
          };
    }
    if (effectiveStatus.level === "normal" && !opts.includeNormal) return;

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
    // + chỉ tiêu Điều 54 (MBA/Kháng): tỷ lệ bổ sung CO2/CO, O2/N2 và Bảng 63 — trước đây cảnh báo CHỈ do
    //   các tỷ lệ này thì cột "Chỉ tiêu vượt ngưỡng" để trống "—".
    const dieu54Items = [
      ...(addFlags.co2co ? ["CO2/CO"] : []),
      ...(addFlags.o2n2 ? ["O2/N2"] : []),
      ...(bang63Bad ? ["Tổng khí hòa tan (Bảng 63)"] : []),
    ];
    const exceededItems = Array.from(new Set([...failingGases, ...condemnGases, ...rateGases, ...dieu54Items]));
    // Khóa thông số dùng để TỰ TICK đúng đường khí này ở tab "Xu hướng" khi bấm "Xem xu
    // hướng" (xem TREND_PARAM_DEFS/goToTrendForDevice) — cùng định dạng "gas:<TÊN KHÍ>"
    // (vd "gas:H2") mà ui-trend.js đang dùng cho checkbox thông số khí. Điều 54: tự tick
    // thêm đúng đường N2/O2/Bảng 63 tương ứng với ĐÚNG lý do đã kích hoạt cảnh báo này.
    const exceededKeys = Array.from(new Set([
      ...[...failingGases, ...condemnGases, ...rateGases].map((g) => "gas:" + g),
      ...(addFlags.co2co ? ["gas:CO", "gas:CO2"] : []),
      ...(addFlags.o2n2 ? ["gas:N2", "gas:O2"] : []),
      ...(bang63Bad ? ["gas:BANG63"] : []),
    ]));

    const statusText = (overall === "Đạt" ? "Đạt" : "Không đạt") + (condemnBad ? " (Vượt ngưỡng loại bỏ)" : "");
    // Hạng mục (ô lọc "Loại cảnh báo") — theo đúng các điều kiện của computeOverallStatus()/Điều 54
    const faultChanged = overallStatus.reasons.some((r) => r.startsWith("Loại sự cố"));
    const categories = [
      ...(condemnBad ? ["condemn"] : []),
      ...(overall !== "Đạt" ? ["absolute"] : []),
      ...(faultChanged ? ["fault"] : []),
      ...(exceedCount > 0 ? ["typical"] : []),
      ...(rateGases.length > 0 ? ["rate"] : []),
      ...(addFlags.co2co ? ["co2co"] : []),
      ...(addFlags.o2n2 ? ["o2n2"] : []),
      ...(bang63Bad ? ["bang63"] : []),
    ];
    const ctx = alertSeriesContext(latest, _allMeasurements, (r) => gasPhaseIdentity((r.pha || "").trim()));

    results.push({
      source: "gas",
      sourceLabel: "Khí hòa tan (DGA)",
      record: latest,
      tram: (latest.tram || "").trim(),
      deviceName: (latest.thiet_bi || "").trim(),
      thietBiLabel: (latest.thiet_bi || "?").trim() + (latest.pha ? ` — ${DGA.phaLabelWithPrefix(latest.pha)}` : ""),
      level: effectiveStatus.level,
      levelLabel: effectiveStatus.label,
      statusHtml: (overall === "Đạt" ? verdictPill("Đạt") : verdictPill("Không đạt")) +
        (condemnBad ? ' <span class="pill bad">⚠ Loại bỏ</span>' : ""),
      statusText,
      exceededItems,
      exceededKeys,
      phase: latest.pha || null,
      identityPhase: gasPhaseIdentity(latest.pha),
      reasons: effectiveStatus.reasons,
      action: effectiveStatus.action,
      lanDo: latest.lan_do ?? "—",
      categories,
      ...ctx,
      sampleDate: latest.sample_date,
      isEdited: Boolean(latest.edited_fields || latest.edit_log || latest.edited_at),
      editLog: latest.edit_log || "",
      editedAt: latest.edited_at || null,
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
function computeOilAlerts(opts = {}) {
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
    const sorted = alertSortRecordsDescending(records);
    const latest = sorted[0];
    // Gồm cả chỉ tiêu lý-hóa bổ sung (axit, chớp cháy, tạp chất...) — DGA.evaluateOilRecord() (dga-logic-oil-extended.js)
    const evalResult = DGA.evaluateOilRecord(latest, oilStandardsForLogic, _allOilTests);
    if (evalResult.overall !== "Không đạt") { // "Đạt"/"Chưa đủ dữ liệu": chỉ liệt kê khi xuất kèm thiết bị không cảnh báo
      if (opts.includeNormal) {
        results.push(normalAlertRow({
          source: "oil", sourceLabel: "Dầu MBA chính", latest, overall: evalResult.overall,
          thietBiLabel: (latest.thiet_bi || "?") + (latest.oil_sample_point === "pharieng" && latest.phase ? ` — Pha ${latest.phase}` : ""),
          phase: latest.oil_sample_point === "pharieng" ? (latest.phase || null) : null,
          identityPhase: oilPhaseIdentity(latest.oil_sample_point, latest.phase),
          ctx: alertSeriesContext(latest, _allOilTests, (r) => oilPhaseIdentity(r.oil_sample_point, r.phase)),
        }));
      }
      return;
    }

    const failing = evalResult.rows.filter((r) => r.verdict === "Không đạt");
    const phaSuffix = latest.oil_sample_point === "pharieng" && latest.phase ? ` — Pha ${latest.phase}` : "";
    results.push({
      source: "oil",
      sourceLabel: "Dầu MBA chính",
      record: latest,
      tram: (latest.tram || "").trim(),
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
        `${r.label}: ${r.value}${r.unit ? " " + r.unit : ""} (giới hạn ${r.limitText ?? `${r.direction === "ge" ? "≥" : "≤"} ${r.limit}`}${r.unit && r.limit !== null && r.limit !== undefined ? " " + r.unit : ""}, ${r.ref}).`
      ),
      action: "Lấy mẫu dầu bổ sung xác nhận; xem xét lọc/sấy chân không hoặc thay dầu theo hướng dẫn nhà sản xuất; " +
        "đối chiếu thêm kết quả phân tích khí hòa tan (DGA) cùng thời điểm nếu có; báo cáo cấp có thẩm quyền theo " +
        "Điều 6 QĐ1901.",
      lanDo: "—",
      categories: ["oilq"],
      ...alertSeriesContext(latest, _allOilTests, (r) => oilPhaseIdentity(r.oil_sample_point, r.phase)),
      sampleDate: latest.sample_date,
      isEdited: Boolean(latest.edited_fields || latest.edit_log || latest.edited_at),
      editLog: latest.edit_log || "",
      editedAt: latest.edited_at || null,
    });
  });

  return results;
}

/** Rà soát dầu OLTC — gộp theo Trạm+Thiết bị+điểm lấy mẫu (mẫu chung 3 pha "chung",
 *  hoặc riêng từng pha "pha:A/B/C" khi oltc_sample_point = "pharieng"), lấy thí nghiệm
 *  GẦN NHẤT của mỗi nhóm, đối chiếu DGA.evaluateOltcOilTest() (Điều 37/Bảng 49 QĐ1901,
 *  hoặc Bảng 58/55/54 nếu là dầu MỚI) y hệt refreshOltcOilTestsUI() (ui-oltc.js). */
function computeOltcOilAlerts(opts = {}) {
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
    const sorted = alertSortRecordsDescending(records);
    const latest = sorted[0];
    // Gồm cả chỉ tiêu bổ sung (dầu OLTC mới — Điều 37) — DGA.evaluateOltcRecord() (dga-logic-oil-extended.js)
    const evalResult = DGA.evaluateOltcRecord(latest, oilStandardsForLogic, _allOltcOilTests);
    if (evalResult.overall !== "Không đạt") {
      if (opts.includeNormal) {
        const ph = latest.oltc_sample_point === "pharieng" && latest.phase ? ` — Pha ${latest.phase}` : "";
        results.push(normalAlertRow({
          source: "oltc", sourceLabel: "Dầu OLTC", latest, overall: evalResult.overall,
          thietBiLabel: `${latest.thiet_bi || "?"} (OLTC${ph})`,
          phase: latest.oltc_sample_point === "pharieng" ? (latest.phase || null) : null,
          identityPhase: oltcPhaseIdentity(latest.oltc_sample_point, latest.phase),
          ctx: alertSeriesContext(latest, _allOltcOilTests, (r) => oltcPhaseIdentity(r.oltc_sample_point, r.phase)),
        }));
      }
      return;
    }

    const failing = evalResult.rows.filter((r) => r.verdict === "Không đạt");
    const phaSuffix = latest.oltc_sample_point === "pharieng" && latest.phase ? ` — Pha ${latest.phase}` : "";
    results.push({
      source: "oltc",
      sourceLabel: "Dầu OLTC",
      record: latest,
      tram: (latest.tram || "").trim(),
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
        `${r.label}: ${r.value}${r.unit ? " " + r.unit : ""}${r.limit === null || r.limit === undefined ? (r.limitText && r.limitText !== "—" ? ` (giới hạn ${r.limitText})` : "") : ` (giới hạn ${r.direction === "ge" ? "≥" : "≤"} ${r.limit} ${r.unit})`}, ${r.ref}.`
      ),
      action: "Lấy mẫu dầu OLTC bổ sung xác nhận; kiểm tra tiếp điểm/hồ quang khoang đổi nấc, xem xét lọc/thay dầu " +
        "OLTC theo hướng dẫn nhà sản xuất; báo cáo cấp có thẩm quyền theo Điều 6 QĐ1901.",
      lanDo: "—",
      categories: ["oilq"],
      ...alertSeriesContext(latest, _allOltcOilTests, (r) => oltcPhaseIdentity(r.oltc_sample_point, r.phase)),
      sampleDate: latest.sample_date,
      isEdited: Boolean(latest.edited_fields || latest.edit_log || latest.edited_at),
      editLog: latest.edit_log || "",
      editedAt: latest.edited_at || null,
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
function computeInstrumentOilAlerts(opts = {}) {
  const groups = new Map();
  (_allTioOilTests || []).forEach((r) => {
    const key = `${r.tram || ""}|||${r.thiet_bi || ""}|||${tioPhaseIdentity(r.phase)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const results = [];
  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);

  groups.forEach((records) => {
    const sorted = alertSortRecordsDescending(records);
    const latest = sorted[0];
    const equipmentType = latest.equipment_type || DGA.EQUIPMENT_TYPES.TI;
    const evalResult = DGA.evaluateInstrumentOilTest({
      equipmentType, manufacturer: latest.manufacturer || null, manufacturerOilStandards: oilStandardsForLogic,
      moisture: latest.moisture_ppm, tgd90: latest.tgd_90c_percent,
      tgd20: latest.tgd_20c_percent, bdv: latest.bdv_kv, umKv: latest.um_kv,
    });
    if (evalResult.overall !== "Không đạt" && evalResult.overall !== "Cảnh báo") {
      if (opts.includeNormal) {
        results.push(normalAlertRow({
          source: "tio", sourceLabel: `Dầu ${tioEquipmentTypeShort(equipmentType)}`, latest, overall: evalResult.overall,
          thietBiLabel: (latest.thiet_bi || "?") + (latest.phase && latest.phase !== DGA.PHA_CHUNG_3_PHA ? ` — ${DGA.phaLabelWithPrefix(latest.phase)}` : ""),
          phase: latest.phase && latest.phase !== DGA.PHA_CHUNG_3_PHA ? latest.phase : null,
          identityPhase: tioPhaseIdentity(latest.phase),
          ctx: alertSeriesContext(latest, _allTioOilTests || [], (r) => tioPhaseIdentity(r.phase)),
        }));
      }
      return;
    }

    const level = evalResult.overall === "Không đạt" ? "alarm" : "alert";
    // Chỉ liệt vào "Chỉ tiêu vượt ngưỡng" đúng những hạng mục cùng mức verdict với
    // overall vừa xác định ở trên (VD overall="Cảnh báo" thì KHÔNG lẫn hạng mục đã
    // "Không đạt" — dù trường hợp đó overall đã là "Không đạt" nên không tới đây).
    const failing = evalResult.rows.filter((r) => r.verdict === evalResult.overall);
    const phaSuffix = latest.phase && latest.phase !== DGA.PHA_CHUNG_3_PHA ? ` — ${DGA.phaLabelWithPrefix(latest.phase)}` : "";
    results.push({
      source: "tio",
      sourceLabel: `Dầu ${tioEquipmentTypeShort(equipmentType)}`,
      record: latest,
      tram: (latest.tram || "").trim(),
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
      categories: ["oilq"],
      ...alertSeriesContext(latest, _allTioOilTests || [], (r) => tioPhaseIdentity(r.phase)),
      sampleDate: latest.sample_date,
      isEdited: Boolean(latest.edited_fields || latest.edit_log || latest.edited_at),
      editLog: latest.edit_log || "",
      editedAt: latest.edited_at || null,
    });
  });

  return results;
}

/** Dòng "không có cảnh báo" (chỉ dùng khi xuất Excel kèm thiết bị bình thường) — cùng khuôn với dòng cảnh báo. */
function normalAlertRow({ source, sourceLabel, latest, overall, thietBiLabel, phase, identityPhase, ctx }) {
  const noData = overall !== "Đạt";
  return {
    source, sourceLabel, record: latest,
    tram: (latest.tram || "").trim(),
    deviceName: (latest.thiet_bi || "").trim(),
    thietBiLabel,
    level: "normal",
    levelLabel: noData ? "CHƯA ĐỦ DỮ LIỆU" : "BÌNH THƯỜNG",
    statusHtml: "", statusText: overall || "—",
    exceededItems: [], exceededKeys: [], phase, identityPhase,
    reasons: [], action: noData ? "Bổ sung số liệu còn thiếu để đánh giá." : "Tiếp tục giám sát định kỳ theo chu kỳ quy định.",
    lanDo: "—", categories: [],
    ...ctx,
    sampleDate: latest.sample_date,
    isEdited: Boolean(latest.edited_fields || latest.edit_log || latest.edited_at),
    editLog: latest.edit_log || "", editedAt: latest.edited_at || null,
  };
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
  // Nhớ làm ngữ cảnh xem chung (ui-view-context.js): sang Lịch sử đo / Cảnh báo vẫn đúng thiết bị này.
  if (typeof setViewContext === "function") setViewContext(tram, thietBi);
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

// Bộ đếm id dòng chi tiết (aria-controls của nút "Chi tiết") — chỉ cần duy nhất trong trang.
let alertRowSeq = 0;

/** Thẻ KPI "Mức Cảnh báo"/"Mức Báo động" (.stat-card-filter) bấm để lọc nhanh theo mức — đặt ô "Loại cảnh báo" rồi vẽ
 *  lại; bấm lại thẻ đang lọc thì bỏ lọc. Gọi 1 lần lúc khởi động (bindHistoryTrendAlertEvents(), app-core.js). */
function setupAlertKpiFilters() {
  document.querySelectorAll(".stat-card-filter").forEach((card) => {
    card.addEventListener("click", () => {
      const sel = $("al_typeFilter");
      if (!sel) return;
      sel.value = sel.value === card.dataset.alertFilter ? "" : card.dataset.alertFilter;
      refreshAlertsUI();
    });
  });
}

// Cache kết quả lần refreshAlertsUI() gần nhất (danh sách cảnh báo đang hiển thị trên bảng).
let _lastAlerts = [];

function refreshAlertsUI() {
  const tbody = $("alertsTable");
  if (!tbody) return; // phòng khi gọi trước khi DOM có tab này (không nên xảy ra)

  // Lọc theo Trạm biến áp (#al_stationFilter, combo tự gõ-tìm — xem alertStationOptions()
  // ở trên) — để trống = xem TẤT CẢ trạm đang có cảnh báo (mặc định, không đổi hành vi cũ).
  // + lọc theo Thiết bị thuộc trạm (#al_deviceFilter, xem alertDeviceOptions()).
  const { station, device, type, data } = alertFilters();
  const allAlerts = collectAllAlerts();
  if (typeof updateHeaderAlerts === "function") updateHeaderAlerts(allAlerts); // chuông ở header: không theo bộ lọc tab này
  const alerts = filterAlertsBy(allAlerts, { station, device, type, data });
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
    emptyEl.textContent = (type || data)
      ? 'Không có cảnh báo nào khớp bộ lọc "Loại cảnh báo"/"Số liệu" đang chọn.'
      : device
      ? `Thiết bị "${device}"${station ? ` (trạm "${station}")` : ""} hiện không ở mức Cảnh báo/Báo động (theo lần đo gần nhất).`
      : station
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
          `<span class="pill bad alert-exceed-pill">${a.source === "gas" && DGA.GASES.includes(g) ? gasLabelIcon(g) : ""}${escapeHtml(g)}</span>`
        ).join("");
    const editBadge = (typeof editLogBadgeHtml === "function" && a.record) ? editLogBadgeHtml(a.record) : "";
    const editedPill = a.isEdited ? `<span class="pill muted alert-edited-pill" title="${escapeHtml(a.editLog ? 'Log chỉnh sửa:\n' + a.editLog : 'Đã hiệu chỉnh số liệu')}">✎ Đã hiệu chỉnh</span>` : "";

    if (a.isLatest === false) tr.classList.add("alert-row-stale");
    tr.classList.add("alert-row");
    // Bước 4b: 5 cột gọn. Trạm/Loại đo gộp dưới tên thiết bị; ngày gộp vào cột Lần đo; "Hạng mục cảnh báo" + "Khuyến
    // cáo" (chữ dài, trước làm mỗi dòng cao ~250px) chuyển xuống dòng chi tiết, mở bằng nút "Chi tiết".
    const detailId = `alertDetail${alertRowSeq++}`;
    const missing = (v, text) => (String(v || "").trim() && !/^[-–—?]$/.test(String(v).trim()) ? escapeHtml(v) : `<span class="alert-missing">${text}</span>`);
    tr.innerHTML = `
      <td class="alert-device-cell">
        <div class="alert-device-name">${missing(a.thietBiLabel && !/^[?]/.test(a.thietBiLabel) ? a.thietBiLabel : "", "(chưa ghi tên thiết bị)")}</div>
        <div class="alert-device-meta">${missing(a.tram, "(chưa ghi trạm)")} · ${sourceIcon(a.source)}${escapeHtml(a.sourceLabel)}</div>
      </td>
      <td class="alert-level-cell">${alertLevelPill(a.level, a.levelLabel)}<div class="alert-status-line">${a.statusHtml}${editedPill}</div></td>
      <td class="alert-exceed-cell">${exceededHtml}</td>
      <td class="alert-lando-cell">${alertLanDoHtml(a)}<div class="alert-date">${escapeHtml(fmtDateVN(a.sampleDate))}</div>${editBadge ? `<div class="alert-editbadge">${editBadge}</div>` : ""}</td>
      <td class="actions-cell">
        <button type="button" class="btn xs ghost alert-detail-toggle" aria-expanded="false" aria-controls="${detailId}">Chi tiết</button>
        ${rowActionsHtml([
        a.record && rowActionBtn("view", "eye",
          a.record.bbtn_url && a.source !== "gas" ? "Xem biên bản thí nghiệm (BBTN) đã đính kèm"
            : a.record.bbtn_url ? "Xem số liệu cạnh BBTN đính kèm để đối chiếu" : "Xem chi tiết số liệu và chẩn đoán lần đo này",
          { cls: "btn-action-alert" }),
        a.record && typeof canEditRecord === "function" && canEditRecord(a.record) &&
          rowActionBtn("edit", "edit", "Hiệu chỉnh số liệu lần đo này", { cls: "btn-action-alert" }),
        rowActionBtn("trend", "trend", "Xem xu hướng của thiết bị này", { cls: "btn-action-alert" }),
      ])}</td>
    `;
    const detailTr = document.createElement("tr");
    detailTr.className = "alert-detail-row hidden";
    detailTr.id = detailId;
    detailTr.innerHTML = `<td colspan="5"><div class="alert-detail">
      <div><p class="alert-detail-title">Hạng mục cảnh báo</p><div class="alert-detail-text">${a.reasons.map((r) => escapeHtml(r)).join("<br>") || "—"}</div></div>
      <div><p class="alert-detail-title">Khuyến cáo</p><div class="alert-detail-text alert-detail-action">${escapeHtml(a.action || "—")}</div></div>
    </div></td>`;
    const toggle = tr.querySelector(".alert-detail-toggle");
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Thu gọn" : "Chi tiết";
      detailTr.classList.toggle("hidden", !open);
      tr.classList.toggle("alert-row-open", open);
    });
    const viewBtn = tr.querySelector('[data-action="view"]');
    if (viewBtn && a.record) {
      viewBtn.addEventListener("click", () => {
        if (a.source === "gas" && typeof onViewMeasurement === "function") {
          onViewMeasurement(a.record); // số liệu + BBTN đính kèm cạnh nhau
        } else if (a.record.bbtn_url && typeof viewBbtn === "function") {
          viewBbtn({ bbtn_url: a.record.bbtn_url, bbtn_name: a.record.bbtn_name });
        } else if (a.source === "oil" && typeof onEditOilTest === "function") {
          onEditOilTest(a.record);
        } else if (a.source === "oltc" && typeof onEditOltcOilTest === "function") {
          onEditOltcOilTest(a.record);
        } else if (a.source === "tio" && typeof onEditTioOilTest === "function") {
          onEditTioOilTest(a.record);
        } else if (typeof viewBbtn === "function") {
          viewBbtn({ bbtn_url: a.record.bbtn_url, bbtn_name: a.record.bbtn_name });
        }
      });
    }
    const trendBtn = tr.querySelector('[data-action="trend"]');
    if (trendBtn) trendBtn.addEventListener("click", () => goToTrendForDevice(a.tram, a.deviceName, a.exceededKeys, a.phase));
    const editBtn = tr.querySelector('[data-action="edit"]');
    if (editBtn && a.record) {
      editBtn.addEventListener("click", () => {
        if (a.source === "gas" && typeof onEditMeasurement === "function") {
          onEditMeasurement(a.record);
        } else if (a.source === "oil" && typeof onEditOilTest === "function") {
          onEditOilTest(a.record);
        } else if (a.source === "oltc" && typeof onEditOltcOilTest === "function") {
          onEditOltcOilTest(a.record);
        } else if (a.source === "tio" && typeof onEditTioOilTest === "function") {
          onEditTioOilTest(a.record);
        }
      });
    }
    tbody.appendChild(tr);
    tbody.appendChild(detailTr);
  });
  // Thẻ KPI lọc theo mức: đang lọc đúng mức đó thì sáng lên.
  const typeVal = $("al_typeFilter") ? $("al_typeFilter").value : "";
  document.querySelectorAll(".stat-card-filter").forEach((c) => c.setAttribute("aria-pressed", c.dataset.alertFilter === typeVal ? "true" : "false"));

  const totalDevices = totalTrackedDeviceCount(station, device);
  // deviceIdentityKey() gồm cả Pha — nếu chỉ dùng Trạm+Thiết bị, cảnh báo ở TI 174 pha B
  // và TI 174 pha C (2 thiết bị vật lý khác nhau, cùng tên "thiet_bi") sẽ bị đếm gộp
  // thành 1, làm số "Thiết bị đang có cảnh báo" thấp hơn thực tế.
  // Đếm THEO THIẾT BỊ, mỗi thiết bị 1 lần ở mức nặng nhất (alertLevelSummary()) → Cảnh báo + Báo động = số thiết bị
  // đang có cảnh báo. Số DÒNG (1 dòng / nguồn dữ liệu) hiện kèm khi khác số thiết bị.
  const sum = alertLevelSummary(alerts);
  const setText = (id, v) => { if ($(id)) $(id).textContent = v; };
  setText("al_totalDevices", String(totalDevices));
  setText("al_warnDevices", `${sum.warnDevices} / ${totalDevices}`);
  setText("al_alertCount", String(sum.alertDevices));
  setText("al_alarmCount", String(sum.alarmDevices));
  setText("al_warnDevicesSub", sum.multiSourceDevices ? `${sum.multiSourceDevices} thiết bị cảnh báo ở ≥ 2 nguồn` : "");
  // Dòng mức Cảnh báo thuộc thiết bị đã tính vào Báo động (vì có nguồn khác ở mức Báo động).
  const alertRowsOfAlarmDevices = alerts.filter((a) => a.level === "alert" &&
    sum.deviceLevels.get(deviceIdentityKey(a.tram, a.deviceName, a.identityPhase)) === "alarm").length;
  setText("al_alertRowsSub", alertRowsOfAlarmDevices ? `+${alertRowsOfAlarmDevices} dòng ở thiết bị đã tính Báo động` : sum.alertRows !== sum.alertDevices ? `${sum.alertRows} dòng` : "");
  setText("al_alarmRowsSub", sum.alarmRows !== sum.alarmDevices ? `${sum.alarmRows} dòng báo động` : "");
  const staleNote = $("alertsStaleNote");
  if (staleNote) {
    const staleN = alerts.filter((a) => a.isLatest === false).length;
    staleNote.classList.toggle("hidden", staleN === 0);
    staleNote.textContent = staleN === 0 ? "" :
      `⚠ ${staleN} cảnh báo KHÔNG phải của số liệu mới nhất (đã có lần đo mới hơn trong database — thường do bản ghi ` +
      `nhập lệch Pha hoặc lệch tên thiết bị). Xem cột "Lần đo"; chọn "Số liệu" = "Chỉ số liệu mới nhất" để ẩn các dòng này.`;
  }
}

// ===================== Xuất Excel theo tùy chọn (#alertsExportOverlay, index.html) =====================
// Phạm vi Trạm ▸ Thiết bị ▸ Pha (bậc thang như bộ chọn ở form nhập liệu) + Loại cảnh báo, hoặc "Tất cả (kể cả
// thiết bị không có cảnh báo)". User chỉ xuất được các Trạm Admin gán cho mình (Auth.current.stations); Admin hoặc
// khi tắt đăng nhập xuất được tất cả; Viewer không xuất được (nút cũng bị ẩn — CSS .role-viewer).
// Toàn bộ xử lý trong trình duyệt — không gửi dữ liệu đi đâu.

let _alertsExportRows = [];

/** Máy chủ đã hỗ trợ "Trạm phụ trách" chưa — Apps Script (Code.gs) bản cũ không trả trường stations ở "me". */
function exportStationsSupported() {
  return !!(Auth.current && Array.isArray(Auth.current.stations));
}

/** null = được xuất mọi trạm; mảng = chỉ các trạm này (có thể rỗng = chưa được gán trạm nào).
 *  Máy chủ chưa nâng cấp (chưa có trường stations) → tạm cho xuất mọi trạm như trước, kèm ghi chú. */
function exportAllowedStations() {
  if (typeof Auth === "undefined" || !Auth.enabled) return null;
  if (Auth.isAdmin()) return null;
  return exportStationsSupported() ? Auth.current.stations : null;
}

function exportPhaseLabel(identityPhase) {
  return identityPhase ? `Pha ${identityPhase}` : "Chung / không tách pha";
}

function exportOptionsHtml(values, allLabel, labelOf) {
  return [`<option value="">${escapeHtml(allLabel)}</option>`]
    .concat(values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(labelOf ? labelOf(v) : v)}</option>`))
    .join("");
}

/** Các dòng khớp phạm vi + loại đang chọn trong hộp thoại. */
function alertsExportSelection() {
  const st = $("xl_station").value;
  const dev = $("xl_device").value;
  const ph = $("xl_phase").value;
  const type = $("xl_type").value;
  const latestOnly = $("xl_latestOnly").checked;
  return _alertsExportRows.filter((a) => {
    if (st && locationKey(a.tram) !== st) return false;
    if (dev && locationKey(a.deviceName) !== dev) return false;
    if (ph && (a.identityPhase || "") !== (ph === "-" ? "" : ph)) return false;
    if (latestOnly && a.isLatest === false) return false;
    if (type === "all") return true;
    if (type === "normal") return a.level === "normal";
    if (a.level === "normal") return false;
    return type === "alerts" || alertMatchesType(a, type);
  });
}

/** Cập nhật ô Thiết bị theo Trạm, ô Pha theo Thiết bị (giữ lựa chọn cũ nếu còn hợp lệ) và dòng xem trước. */
function refreshAlertsExportCascade(level) {
  const rows = _alertsExportRows;
  const st = $("xl_station").value;
  if (level <= 1) {
    const devs = new Map();
    rows.filter((a) => !st || locationKey(a.tram) === st).forEach((a) => {
      const k = locationKey(a.deviceName);
      if (k && !devs.has(k)) devs.set(k, a.deviceName + (st ? "" : ` — ${a.tram || "?"}`));
    });
    const keep = $("xl_device").value;
    const keys = Array.from(devs.keys()).sort((a, b) => devs.get(a).localeCompare(devs.get(b), "vi"));
    $("xl_device").innerHTML = exportOptionsHtml(keys, `Tất cả thiết bị (${keys.length})`, (k) => devs.get(k));
    if (keys.includes(keep)) $("xl_device").value = keep;
  }
  if (level <= 2) {
    const dev = $("xl_device").value;
    const phases = new Set();
    rows.filter((a) => (!st || locationKey(a.tram) === st) && (!dev || locationKey(a.deviceName) === dev))
      .forEach((a) => phases.add(a.identityPhase ? a.identityPhase : "-"));
    const keep = $("xl_phase").value;
    const list = Array.from(phases).sort((a, b) => (a === "-") - (b === "-") || a.localeCompare(b));
    $("xl_phase").innerHTML = exportOptionsHtml(list, "Tất cả pha", (p) => exportPhaseLabel(p === "-" ? "" : p));
    if (list.includes(keep)) $("xl_phase").value = keep;
  }
  const sel = alertsExportSelection();
  const warn = sel.filter((a) => a.level !== "normal").length;
  $("alertsExportPreview").textContent = `Sẽ xuất ${sel.length} dòng (${warn} có cảnh báo/báo động, ${sel.length - warn} không có cảnh báo).`;
  $("btnDoAlertsExport").disabled = sel.length === 0;
}

async function openAlertsExportDialog() {
  if (typeof Auth !== "undefined" && Auth.enabled && Auth.isViewer()) {
    notifyError("Tài khoản Viewer (chỉ xem) không xuất được Excel.");
    return;
  }
  // Lấy lại danh sách trạm phụ trách mới nhất (Admin có thể vừa gán) — mất mạng thì giữ phiên đã lưu.
  if (typeof Auth !== "undefined" && Auth.enabled && !Auth.isAdmin()) {
    try { await Auth.refresh(); } catch (e) { /* giữ phiên cục bộ */ }
  }
  const allowed = exportAllowedStations();
  const allowedKeys = allowed ? new Set(allowed.map(locationKey)) : null;
  const all = collectAllAlerts({ includeNormal: true });
  _alertsExportRows = allowedKeys ? all.filter((a) => allowedKeys.has(locationKey(a.tram))) : all;

  $("alertsExportError").classList.add("hidden");
  if (allowed && allowed.length === 0) {
    $("alertsExportScope").innerHTML = "Tài khoản của bạn <strong>chưa được Admin gán trạm phụ trách</strong> nên chưa xuất được dữ liệu. Liên hệ Admin (tab Quản trị → Người dùng → Gán trạm).";
  } else if (allowed) {
    $("alertsExportScope").innerHTML = `Bạn được xuất dữ liệu của <strong>${allowed.length} trạm</strong> phụ trách: ${allowed.map(escapeHtml).join(", ")}.`;
  } else if (typeof Auth !== "undefined" && Auth.enabled && !Auth.isAdmin() && !exportStationsSupported()) {
    $("alertsExportScope").textContent = "Máy chủ chưa hỗ trợ giới hạn theo trạm phụ trách (cần triển khai lại Apps Script) — tạm xuất được tất cả các trạm.";
  } else {
    $("alertsExportScope").textContent = "Xuất được dữ liệu của tất cả các trạm.";
  }

  const stations = new Map();
  _alertsExportRows.forEach((a) => { const k = locationKey(a.tram); if (!stations.has(k)) stations.set(k, a.tram || "(chưa ghi trạm)"); });
  const stKeys = Array.from(stations.keys()).sort((a, b) => stations.get(a).localeCompare(stations.get(b), "vi"));
  $("xl_station").innerHTML = exportOptionsHtml(stKeys, `Tất cả trạm (${stKeys.length})`, (k) => stations.get(k));
  $("xl_device").innerHTML = "";
  $("xl_phase").innerHTML = "";

  // Loại cảnh báo: thêm "Tất cả (kể cả không có cảnh báo)" / "Chỉ thiết bị không có cảnh báo" vào các nhóm của ô
  // lọc "Loại cảnh báo" ở tab Cảnh báo (#al_typeFilter) — dùng chung giá trị, khỏi định nghĩa lại.
  const src = $("al_typeFilter");
  const groups = src ? Array.from(src.querySelectorAll("optgroup")).map((g) => g.outerHTML).join("") : "";
  $("xl_type").innerHTML =
    '<option value="all">Tất cả (kể cả thiết bị không có cảnh báo)</option>' +
    '<option value="alerts">Tất cả cảnh báo (Cảnh báo + Báo động)</option>' +
    '<option value="normal">Chỉ thiết bị không có cảnh báo</option>' + groups;

  // Mặc định theo bộ lọc đang dùng trên bảng Cảnh báo.
  const f = alertFilters();
  if (f.station && stations.has(locationKey(f.station))) $("xl_station").value = locationKey(f.station);
  refreshAlertsExportCascade(1);
  if (f.device) {
    const dk = locationKey(f.device);
    if (Array.from($("xl_device").options).some((o) => o.value === dk)) $("xl_device").value = dk;
  }
  $("xl_type").value = f.type || "alerts";
  $("xl_latestOnly").checked = f.data !== "stale";
  refreshAlertsExportCascade(2);
  $("alertsExportOverlay").classList.remove("hidden");
}

function setupAlertsExportDialog() {
  const close = () => $("alertsExportOverlay").classList.add("hidden");
  $("btnCloseAlertsExport").addEventListener("click", close);
  $("xl_station").addEventListener("change", () => refreshAlertsExportCascade(1));
  $("xl_device").addEventListener("change", () => refreshAlertsExportCascade(2));
  ["xl_phase", "xl_type", "xl_latestOnly"].forEach((id) => $(id).addEventListener("change", () => refreshAlertsExportCascade(3)));
  $("btnDoAlertsExport").addEventListener("click", async () => {
    try {
      await onExportAlertsExcel(alertsExportSelection());
      close();
    } catch (err) {
      $("alertsExportError").textContent = "Xuất thất bại: " + ((err && err.message) || err);
      $("alertsExportError").classList.remove("hidden");
    }
  });
}

/** Ghi file Excel (.xlsx) cho các dòng đã chọn ở hộp thoại xuất. Thư viện SheetJS chỉ tải khi cần (loadScriptOnce). */
async function onExportAlertsExcel(rows) {
  if (!rows || rows.length === 0) {
    notifyError("Không có dòng nào khớp phạm vi/loại đã chọn để xuất.");
    return;
  }
  if (typeof XLSX === "undefined" && typeof loadScriptOnce === "function") {
    try {
      await loadScriptOnce("vendor/xlsx/xlsx.full.min.js");
    } catch (e) { /* báo lỗi ngay dưới */ }
  }
  if (typeof XLSX === "undefined") {
    throw new Error("Không tải được thư viện xuất Excel (có thể do mất mạng) — kiểm tra kết nối rồi thử lại.");
  }

  const order = { alarm: 0, alert: 1, normal: 2 };
  const sorted = rows.slice().sort((a, b) =>
    (a.tram || "").localeCompare(b.tram || "", "vi") ||
    (a.deviceName || "").localeCompare(b.deviceName || "", "vi") ||
    (a.identityPhase || "").localeCompare(b.identityPhase || "") ||
    (order[a.level] ?? 3) - (order[b.level] ?? 3));

  const now = new Date();
  const optText = (id) => { const el = $(id); return el && el.selectedIndex >= 0 ? el.options[el.selectedIndex].textContent : ""; };
  // Thống kê theo THIẾT BỊ (mức nặng nhất) — cộng lại đúng bằng "Số thiết bị"; số dòng ghi kèm nếu khác.
  const sum = alertLevelSummary(sorted);
  const withRows = (devices, rowsN) => (rowsN !== devices ? `${devices} thiết bị (${rowsN} dòng)` : `${devices} thiết bị`);

  const HEADER = [
    "Trạm", "Thiết bị", "Pha", "Loại đo", "Mức cảnh báo", "Tình trạng", "Chỉ tiêu vượt ngưỡng",
    "Hạng mục cảnh báo", "Khuyến cáo", "Lần đo", "Thứ tự lần đo", "Số liệu mới nhất?", "Ngày thí nghiệm",
    "Trạng thái hiệu chỉnh",
  ];
  const aoa = [
    ["BÁO CÁO TÌNH TRẠNG THIẾT BỊ — Đánh giá Dầu cách điện (QĐ1901/EVNNPT)"],
    [`Ngày xuất: ${now.toLocaleString("vi-VN")}  |  Trạm: ${optText("xl_station")}  |  Thiết bị: ${optText("xl_device")}  |  Pha: ${optText("xl_phase")}  |  Loại: ${optText("xl_type")}`],
    [
      `Số thiết bị: ${sum.devices}`,
      `Báo động (ALARM): ${withRows(sum.alarmDevices, sum.alarmRows)}`,
      `Cảnh báo (ALERT): ${withRows(sum.alertDevices, sum.alertRows)}`,
      `Không có cảnh báo: ${sum.normalDevices} thiết bị`,
    ],
    [],
    HEADER,
    ...sorted.map((a) => [
      a.tram || "—",
      a.thietBiLabel,
      exportPhaseLabel(a.identityPhase),
      a.sourceLabel,
      a.levelLabel,
      a.statusText || "",
      (a.exceededItems || []).join(", ") || "—",
      (a.reasons || []).join("\n"),
      a.action || "",
      a.lanDo,
      a.ordinal ? `${a.ordinal}/${a.total}` : "—",
      a.isLatest === false
        ? `Không — số liệu mới nhất ngày ${(a.newerRecord && a.newerRecord.sample_date) || "?"}${a.newerStillAlert ? " (vẫn cảnh báo)" : " (đã hết cảnh báo)"}`
        : "Có",
      a.sampleDate,
      a.isEdited ? `Đã hiệu chỉnh (${(a.editLog || "").replace(/\n/g, "; ")})` : "Nguyên bản",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 55 }, { wch: 45 }, { wch: 8 }, { wch: 10 }, { wch: 30 }, { wch: 14 }, { wch: 20 },
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADER.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: HEADER.length - 1 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tình trạng thiết bị");
  XLSX.writeFile(wb, `Tinh_trang_thiet_bi_${now.toISOString().slice(0, 10)}.xlsx`);
}
