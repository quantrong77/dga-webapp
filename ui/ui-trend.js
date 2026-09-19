/* ui-trend.js — Tab "Xu hướng": đồ thị Chart.js theo thời gian cho 1 thiết bị, lọc
   theo thông số/pha. Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước
   chia sẻ scope giữa các file ui-*.js. */

const TREND_COLORS = [
  "#2e75b6", "#c1121f", "#1a7f37", "#b45309", "#6f42c1", "#0891b2", "#be185d",
  "#4d7c0f", "#9333ea", "#0d9488", "#ca8a04", "#475569", "#db2777",
  "#0f766e", "#a21caf", "#65a30d", "#c2410c", "#1e40af", "#991b1b",
];

// Thứ tự ưu tiên hiển thị khi tách theo pha: A, B, C trước, các giá trị khác (hiếm gặp,
// vd người dùng gõ tự do pha khác) xếp sau theo alphabet.
const TREND_PHASE_ORDER = { A: 0, B: 1, C: 2 };

const TREND_PARAM_DEFS = Object.assign(
  {},
  ...DGA.GASES.map((g) => ({ ["gas:" + g]: { label: g, unit: "ppm", axis: "yGas", field: g } })),
  {
    // N2, O2 (khí bổ sung, tùy chọn — không thuộc DGA.GASES, xem ghi chú ở onAnalyze()
    // trong ui-dga.js) + 2 chỉ tiêu TỔNG HỢP tính từ 7 khí chính (và N2/O2 với Bảng 63):
    // TCG (Tổng lượng khí cháy — DGA.computeTCG(), không tính CO2) và Tổng hàm lượng khí
    // hòa tan (Bảng 63, Điều 54 QĐ1901 — DGA.computeTotalDissolvedGasPercent(), CẦN cả
    // N2 lẫn O2 mới tính được nên điểm dữ liệu sẽ trống ở các lần đo chưa nhập đủ 2 khí
    // này). Đọc giá trị qua gasTrendValue() (không nằm trong recordGases() 7 khí chính).
    "gas:N2": { label: "Nitơ N2", unit: "ppm", axis: "yGas", field: "N2" },
    "gas:O2": { label: "Oxy O2", unit: "ppm", axis: "yGas", field: "O2" },
    "gas:TCG": { label: "Tổng lượng khí cháy (TCG)", unit: "ppm", axis: "yGas", field: "TCG" },
    "gas:BANG63": { label: "Tổng hàm lượng khí hòa tan (Bảng 63)", unit: "%", axis: "yBang63", field: "BANG63" },
    "oil:moisture": { label: "Độ ẩm dầu chính", unit: "ppm", axis: "yMoisture", field: "moisture_ppm" },
    "oil:tgd90": { label: "tgδ 90°C dầu chính", unit: "%", axis: "yTgd", field: "tgd_90c_percent" },
    "oil:bdv": { label: "Điện áp chọc thủng dầu chính", unit: "kV", axis: "yBdv", field: "bdv_kv" },
    "oltc:moisture": { label: "Độ ẩm dầu OLTC", unit: "ppm", axis: "yMoisture", field: "moisture_ppm" },
    "oltc:tgd90": { label: "tgδ 90°C dầu OLTC", unit: "%", axis: "yTgd", field: "tgd_90c_percent" },
    "oltc:bdv": { label: "Điện áp chọc thủng dầu OLTC", unit: "kV", axis: "yBdv", field: "bdv_kv" },
  }
);

// Được giữ nguyên khi đổi thiết bị, để người dùng không phải chọn lại các thông số
// quen dùng (vd: luôn xem H2/CH4) mỗi lần chuyển sang thiết bị khác.
let _trendSelectedParams = new Set();
// Mặc định tick sẵn cả 3 pha phổ biến — thiết bị nào chỉ có 1 pha thì ô lọc pha tự ẩn
// (xem renderTrendPhaseFilter), không ảnh hưởng gì đến các thiết bị đó.
let _trendSelectedPhases = new Set(["A", "B", "C"]);
let _trendChart = null;

function trendDeviceName(rec) {
  return (rec.thiet_bi || "").trim();
}

function trendStationName(rec) {
  return (rec.tram || "").trim();
}

/** Danh sách gợi ý cho ô combo "Trạm biến áp" (#tr_station — ô nhập text tự gõ-tìm,
 *  xem setupCombo()/setupTrendCombos() ở app-core.js) — chỉ liệt kê các trạm THỰC
 *  SỰ có ít nhất 1 bản ghi (khí hòa tan/dầu MBA/dầu OLTC) đã lưu, KHÔNG lấy toàn bộ
 *  danh mục Trạm (_allStations) như ô "Trạm" ở tab DGA/Dầu cách điện đang làm —
 *  tránh gợi ý trạm chưa có dữ liệu gì để xem xu hướng, dẫn vào ngõ cụt. setupCombo()
 *  tự gọi lại hàm này mỗi lần mở/gõ vào ô nên danh sách luôn tự động theo dữ liệu
 *  mới nhất, không cần nạp lại thủ công như <select> trước đây. */
function trendStationOptions() {
  const names = new Set();
  _allMeasurements.forEach((r) => { const n = trendStationName(r); if (n) names.add(n); });
  _allOilTests.forEach((r) => { const n = trendStationName(r); if (n) names.add(n); });
  _allOltcOilTests.forEach((r) => { const n = trendStationName(r); if (n) names.add(n); });
  return Array.from(names)
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((name) => ({ value: name, label: name }));
}

// Gộp chung pha của cả khí hòa tan (trường "pha") lẫn dầu OLTC lấy mẫu riêng từng pha
// (trường "phase", chỉ có khi oltc_sample_point = "pharieng") — cùng 1 thiết bị thì pha
// A/B/C phải là cùng ý nghĩa vật lý cho mọi loại số liệu, nên dùng chung 1 bộ lọc.
function trendDistinctPhases(gasRecords, oltcRecords) {
  const set = new Set();
  gasRecords.forEach((r) => { const p = (r.pha || "").trim(); if (p) set.add(p); });
  oltcRecords.forEach((r) => {
    if (r.oltc_sample_point !== "pharieng") return;
    const p = (r.phase || "").trim();
    if (p) set.add(p);
  });
  return Array.from(set).sort((a, b) => (TREND_PHASE_ORDER[a] ?? 99) - (TREND_PHASE_ORDER[b] ?? 99) || a.localeCompare(b));
}

/** Danh sách gợi ý cho ô combo "Thiết bị" (#tr_device) — khi #tr_station đang có giá
 *  trị, CHỈ gợi ý các thiết bị THUỘC đúng trạm đó (đọc trực tiếp $("tr_station").value
 *  mỗi lần setupCombo() mở/gõ vào ô, nên luôn theo đúng giá trị Trạm hiện tại, kể cả
 *  vừa đổi trạm xong chưa nạp lại gì khác — đây là RÀNG BUỘC lọc theo trạm mà tính
 *  năng yêu cầu). Để trống Trạm thì gợi ý thiết bị của TẤT CẢ các trạm, kèm tên trạm
 *  trong nhãn hiển thị để phân biệt (giống ô "Thiết bị" ở tab Dầu cách điện, xem
 *  setupCombo() cho #o_thietbi/#ot_thietbi ở app-core.js). Vẫn cho gõ tự do tên chưa
 *  có trong gợi ý (setupCombo() không ép buộc chọn từ danh sách). */
function trendDeviceOptions() {
  const station = $("tr_station") ? $("tr_station").value.trim() : "";
  const matchesStation = (r) => !station || trendStationName(r) === station;

  const byName = new Map();
  const add = (r) => {
    const name = trendDeviceName(r);
    if (!name || byName.has(name)) return;
    byName.set(name, trendStationName(r));
  };
  _allMeasurements.filter(matchesStation).forEach(add);
  _allOilTests.filter(matchesStation).forEach(add);
  _allOltcOilTests.filter(matchesStation).forEach(add);

  return Array.from(byName.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "vi"))
    .map(([name, tram]) => ({ value: name, label: station || !tram ? name : `${name} — ${tram}` }));
}

/** Cập nhật thông báo "Chưa có dữ liệu..." (#trEmpty) — hiện khi Trạm đang gõ/chọn
 *  (hoặc toàn bộ app, nếu để trống Trạm) chưa có bất kỳ thiết bị nào có dữ liệu để vẽ
 *  xu hướng. Gọi lại mỗi khi gõ/đổi Trạm (xem setupTrendCombos() ở app-core.js) và mỗi
 *  khi dữ liệu đo/thí nghiệm thay đổi (refreshTrendDeviceOptions() ngay dưới đây). */
function updateTrendEmptyNote() {
  const station = $("tr_station") ? $("tr_station").value.trim() : "";
  const hasAny = trendDeviceOptions().length > 0;
  $("trEmpty").classList.toggle("hidden", hasAny);
  $("trEmpty").textContent = station
    ? `Trạm "${station}" chưa có dữ liệu nào được lưu (khí hòa tan / dầu MBA / dầu OLTC) để vẽ xu hướng.`
    : "Chưa có dữ liệu nào được lưu (khí hòa tan / dầu MBA / dầu OLTC) để vẽ xu hướng.";
}

/** Gọi lại sau mỗi lần nạp/lưu/xóa dữ liệu ở 3 tab kia (xem refreshHistoryUI() ở
 *  ui-history.js, refreshOilTestsUI() ở ui-oil.js, refreshOltcOilTestsUI() ở
 *  ui-oltc.js) — giữ NGUYÊN tên hàm để 3 nơi đó không cần sửa gì thêm. KHÔNG còn cần
 *  nạp lại option cho #tr_station/#tr_device như hồi còn là <select> (2 ô nay là combo
 *  tự gõ-tìm, setupCombo() tự đọc dữ liệu mới nhất mỗi lần mở/gõ — xem
 *  trendStationOptions()/trendDeviceOptions() ở trên) — chỉ cần cập nhật thông báo
 *  "Chưa có dữ liệu" và vẽ lại biểu đồ/bảng lịch sử nếu thiết bị đang xem có thêm dữ
 *  liệu mới. */
function refreshTrendDeviceOptions() {
  updateTrendEmptyNote();
  onTrendDeviceChange();
}

/** BUG ĐÃ SỬA: trước đây hàm này chỉ lọc theo TÊN thiết bị, bỏ qua hẳn ô "Trạm biến áp"
 *  (#tr_station) — dù người dùng đã gõ/chọn Trạm để lọc. Vì tên thiết bị kiểu "MBA T1",
 *  "MBA T2"... rất hay bị TRÙNG giữa nhiều trạm khác nhau, việc này khiến đồ thị xu hướng
 *  âm thầm GỘP chung số liệu của các trạm khác vào — ví dụ 1 khí trống ở BBTN của trạm
 *  đang xem vẫn hiện giá trị trên đồ thị, vì thực ra điểm đó lấy từ thiết bị TRÙNG TÊN ở
 *  1 trạm khác. Nay lọc thêm theo Trạm (matchesStation, giống hệt logic trendDeviceOptions()
 *  ở trên) mỗi khi ô Trạm đang có giá trị — khớp đúng cặp (Trạm, Thiết bị) như quy ước khóa
 *  idx_measurements_key (tram, thiet_bi, pha) ở supabase-schema.sql. */
function trendRecordsForDevice(device) {
  const station = $("tr_station") ? $("tr_station").value.trim() : "";
  const matchesStation = (r) => !station || trendStationName(r) === station;
  const gasRecords = _allMeasurements
    .filter((r) => trendDeviceName(r) === device && matchesStation(r))
    .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
  const oilRecords = _allOilTests
    .filter((r) => trendDeviceName(r) === device && matchesStation(r))
    .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
  const oltcRecords = _allOltcOilTests
    .filter((r) => trendDeviceName(r) === device && matchesStation(r))
    .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
  return { gasRecords, oilRecords, oltcRecords };
}

/** Khi Trạm đang để TRỐNG (xem toàn bộ thiết bị của mọi trạm — xem ghi chú ở
 *  trendDeviceOptions()), tên thiết bị vẫn có thể trùng giữa ≥2 trạm khác nhau. Hàm này
 *  trả về danh sách trạm KHÁC NHAU thực sự có mặt trong 1 bộ bản ghi của 1 thiết bị, để
 *  cảnh báo người dùng nếu bị trùng tên (xem trDeviceAmbiguousNote ở onTrendDeviceChange). */
function trendDistinctStationsIn(gasRecords, oilRecords, oltcRecords) {
  const set = new Set();
  [...gasRecords, ...oilRecords, ...oltcRecords].forEach((r) => {
    const s = trendStationName(r);
    if (s) set.add(s);
  });
  return Array.from(set);
}

function onTrendDeviceChange() {
  const device = $("tr_device").value;
  ["trHistGasWrap", "trHistOilWrap", "trHistOltcWrap"].forEach((id) => $(id).classList.add("hidden"));

  if (!device) {
    $("trContentWrap").classList.add("hidden");
    destroyTrendChart();
    return;
  }
  $("trContentWrap").classList.remove("hidden");

  const { gasRecords, oilRecords, oltcRecords } = trendRecordsForDevice(device);

  // Cảnh báo trùng tên thiết bị giữa nhiều trạm — chỉ có thể xảy ra khi ô Trạm đang để
  // trống (matchesStation() ở trendRecordsForDevice() không lọc gì trong trường hợp đó).
  // Xem ghi chú đầy đủ ở trendDistinctStationsIn()/trendRecordsForDevice() phía trên.
  const stationVal = $("tr_station") ? $("tr_station").value.trim() : "";
  const ambiguousNote = $("trDeviceAmbiguousNote");
  if (ambiguousNote) {
    const distinctStations = stationVal ? [] : trendDistinctStationsIn(gasRecords, oilRecords, oltcRecords);
    if (distinctStations.length >= 2) {
      ambiguousNote.textContent =
        `⚠ Thiết bị "${device}" trùng tên giữa ${distinctStations.length} trạm khác nhau (${distinctStations.join(", ")}) ` +
        `— đồ thị bên dưới đang GỘP CHUNG số liệu của cả ${distinctStations.length} trạm này. Hãy chọn đúng 1 Trạm biến áp ở ô trên để chỉ xem đúng thiết bị của trạm đó.`;
      ambiguousNote.classList.remove("hidden");
    } else {
      ambiguousNote.classList.add("hidden");
    }
  }

  renderTrendPhaseFilter(gasRecords, oilRecords, oltcRecords);
  renderTrendParamCheckboxes(gasRecords, oilRecords, oltcRecords);
  renderTrendHistoryTables(gasRecords, oilRecords, oltcRecords);
  renderTrendChart(gasRecords, oilRecords, oltcRecords);
}

// Chỉ hiện ô lọc pha khi thiết bị thực sự có từ 2 pha trở lên trong dữ liệu đã lưu —
// thiết bị 1 pha (đa số dầu MBA chính, hoặc TI/TU chỉ nhập 1 pha) thì ẩn hẳn, giữ nguyên
// hành vi gộp đơn giản như trước (không thêm hậu tố " - Pha X" vào tên đường trong chú giải).
function renderTrendPhaseFilter(gasRecords, oilRecords, oltcRecords) {
  const phases = trendDistinctPhases(gasRecords, oltcRecords);
  const wrap = $("trPhaseWrap");
  if (phases.length < 2) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const el = $("trPhaseChecks");
  el.innerHTML = phases.map((p) => {
    const checked = _trendSelectedPhases.has(p) ? "checked" : "";
    return `<label class="chk"><input type="checkbox" data-trend-phase="${escapeHtml(p)}" ${checked} /> ${escapeHtml(DGA.phaLabelWithPrefix(p))}</label>`;
  }).join("");
  el.querySelectorAll("input[data-trend-phase]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) _trendSelectedPhases.add(cb.dataset.trendPhase);
      else _trendSelectedPhases.delete(cb.dataset.trendPhase);
      renderTrendChart(gasRecords, oilRecords, oltcRecords);
    });
  });
}

function renderTrendParamCheckboxes(gasRecords, oilRecords, oltcRecords) {
  const hasGas = gasRecords.length > 0;
  const hasOil = oilRecords.length > 0;
  const hasOltc = oltcRecords.length > 0;
  $("trParamsGasWrap").classList.toggle("hidden", !hasGas);
  $("trParamsOilWrap").classList.toggle("hidden", !hasOil);
  $("trParamsOltcWrap").classList.toggle("hidden", !hasOltc);

  const buildChecks = (containerId, keys) => {
    const el = $(containerId);
    el.innerHTML = keys.map((key) => {
      const def = TREND_PARAM_DEFS[key];
      const checked = _trendSelectedParams.has(key) ? "checked" : "";
      // Icon cạnh tên khí CHỈ áp dụng cho 7 khí chính trong DGA.GASES — N2/O2/TCG/Bảng 63
      // (cùng nhóm "gas:..." vì đọc từ gasRecords, nhưng không phải khí phân hủy đơn lẻ)
      // và nhóm "oil:"/"oltc:" (nhãn mô tả, vd "Độ ẩm dầu chính") không có icon.
      const icon = key.startsWith("gas:") && DGA.GASES.includes(key.slice(4)) ? gasLabelIcon(key.slice(4)) : "";
      return `<label class="chk"><input type="checkbox" data-trend-key="${key}" ${checked} /> ${icon}${escapeHtml(def.label)}</label>`;
    }).join("");
    el.querySelectorAll("input[data-trend-key]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) _trendSelectedParams.add(cb.dataset.trendKey);
        else _trendSelectedParams.delete(cb.dataset.trendKey);
        renderTrendChart(gasRecords, oilRecords, oltcRecords);
      });
    });
  };

  if (hasGas) buildChecks("trParamsGas", [...DGA.GASES.map((g) => "gas:" + g), "gas:N2", "gas:O2", "gas:TCG", "gas:BANG63"]);
  if (hasOil) buildChecks("trParamsOil", ["oil:moisture", "oil:tgd90", "oil:bdv"]);
  if (hasOltc) buildChecks("trParamsOltc", ["oltc:moisture", "oltc:tgd90", "oltc:bdv"]);
}

function renderTrendHistoryTables(gasRecords, oilRecords, oltcRecords) {
  $("trHistGasWrap").classList.toggle("hidden", gasRecords.length === 0);
  $("trHistOilWrap").classList.toggle("hidden", oilRecords.length === 0);
  $("trHistOltcWrap").classList.toggle("hidden", oltcRecords.length === 0);

  $("trHistGasTable").innerHTML = gasRecords.slice().reverse().map((r) => `
    <tr>
      <td>${DGA.formatSampleDate(r.sample_date)}</td><td>${escapeHtml(DGA.phaLabel(r.pha) || "—")}</td><td>${r.lan_do ?? "—"}</td>
      ${DGA.GASES.map((g) => `<td>${recordGases(r)[g] ?? "—"}</td>`).join("")}
    </tr>
  `).join("");

  $("trHistOilTable").innerHTML = oilRecords.slice().reverse().map((r) => `
    <tr>
      <td>${DGA.formatSampleDate(r.sample_date)}</td>
      <td>${r.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${r.moisture_ppm ?? "—"}</td><td>${r.tgd_90c_percent ?? "—"}</td><td>${r.bdv_kv ?? "—"}</td>
    </tr>
  `).join("");

  $("trHistOltcTable").innerHTML = oltcRecords.slice().reverse().map((r) => `
    <tr>
      <td>${DGA.formatSampleDate(r.sample_date)}</td>
      <td>${escapeHtml(oltcSamplePointLabel(r.oltc_sample_point))}</td>
      <td>${r.phase ? escapeHtml(r.phase) : "—"}</td>
      <td>${r.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${r.moisture_ppm ?? "—"}</td><td>${r.tgd_90c_percent ?? "—"}</td><td>${r.bdv_kv ?? "—"}</td>
    </tr>
  `).join("");
}

function destroyTrendChart() {
  if (_trendChart) {
    _trendChart.destroy();
    _trendChart = null;
  }
}

const TREND_AXIS_DEFS = {
  yGas: { title: "Nồng độ khí (ppm)", position: "left" },
  yTgd: { title: "tgδ 90°C (%)", position: "left" },
  yMoisture: { title: "Độ ẩm dầu (ppm)", position: "right" },
  yBdv: { title: "Điện áp chọc thủng (kV)", position: "right" },
  yBang63: { title: "Tổng hàm lượng khí hòa tan (%)", position: "right" },
};

/** Đọc giá trị 1 điểm dữ liệu cho nhóm "gas:..." ở biểu đồ Xu hướng — 7 khí chính đọc
 *  qua recordGases() (chấp nhận cả 2 kiểu hoa/thường) như cũ; N2/O2 là trường riêng
 *  trên bản ghi (KHÔNG thuộc recordGases()); TCG và Tổng hàm lượng khí hòa tan (Bảng 63)
 *  là 2 chỉ tiêu TÍNH TOÁN từ các khí + N2/O2 của CHÍNH bản ghi đó (không đọc từ DB) —
 *  xem computeTCG()/computeTotalDissolvedGasPercent() ở dga-logic.js. Bảng 63 trả về
 *  null (bỏ qua điểm) nếu lần đo đó chưa nhập đủ CẢ N2 lẫn O2, đúng ràng buộc đã áp dụng
 *  ở tab DGA (xem onAnalyze() ở ui-dga.js) — không tự suy diễn khi thiếu dữ liệu. */
function gasTrendValue(r, field) {
  if (field === "N2") return r.n2 ?? r.N2;
  if (field === "O2") return r.o2 ?? r.O2;
  const gases = recordGases(r);
  if (field === "TCG") return DGA.computeTCG(gases);
  if (field === "BANG63") {
    const n2 = r.n2 ?? r.N2;
    const o2 = r.o2 ?? r.O2;
    if (n2 === null || n2 === undefined || o2 === null || o2 === undefined) return null;
    return DGA.computeTotalDissolvedGasPercent(gases, n2, o2);
  }
  return gases[field];
}

// Lọc + gom điểm dữ liệu hợp lệ (bỏ qua giá trị rỗng/null) thành mảng {x,y} cho Chart.js.
function trendPoints(records, valueOf) {
  return records
    .filter((r) => valueOf(r) !== undefined && valueOf(r) !== null && valueOf(r) !== "")
    .map((r) => ({ x: new Date(r.sample_date).getTime(), y: Number(valueOf(r)) }));
}

function renderTrendChart(gasRecords, oilRecords, oltcRecords) {
  const canvas = $("trendChart");
  // Bảng "Dự báo xu hướng" (renderTrendForecastTable()) chỉ cần các hàm tính toán thuần ở
  // dga-logic.js (forecastGasTrend()) và DOM bảng — KHÔNG phụ thuộc Chart.js — nên vẫn phải
  // tính/hiện được ngay cả khi thư viện vẽ đồ thị chưa tải xong/bị chặn mạng (chartLibAvailable
  // = false): chỉ riêng phần VẼ đồ thị (canvas, `new Chart(...)`) mới cần gate theo điều kiện
  // này, gate ở CUỐI hàm (return sớm ngay trước đoạn dựng Chart). Trước đây gate này nằm ở
  // ĐẦU hàm nên lỗi mạng/CDN chặn Chart.js sẽ vô tình làm mất luôn cả bảng dự báo, dù bảng đó
  // không cần Chart.js.
  const chartLibAvailable = typeof Chart !== "undefined";
  $("trChartNoLib").classList.toggle("hidden", chartLibAvailable);

  const hasGas = gasRecords.length > 0;
  const hasOil = oilRecords.length > 0;
  const hasOltc = oltcRecords.length > 0;
  const sourceOk = { gas: hasGas, oil: hasOil, oltc: hasOltc };

  const selectedKeys = Array.from(_trendSelectedParams)
    .filter((k) => TREND_PARAM_DEFS[k])
    .filter((k) => sourceOk[k.split(":")[0]]);

  destroyTrendChart();

  // Khí hòa tan: Storage.addMeasurement() hạ chữ thường các key khí (H2 -> h2, xem
  // normalizeGasKeys trong storage.js) trước khi lưu — gasTrendValue() tự đọc đúng cả 2
  // kiểu hoa/thường (qua recordGases()), đồng thời xử lý riêng N2/O2 (trường ngoài
  // recordGases()) và tính TCG/Bảng 63 tại chỗ — xem chú thích đầy đủ ở gasTrendValue().
  const gasValueOf = (r, field) => gasTrendValue(r, field);

  const phases = trendDistinctPhases(gasRecords, oltcRecords);
  const phaseFilterActive = phases.length >= 2;
  const tickedPhases = phases.filter((p) => _trendSelectedPhases.has(p));
  const recordsBySource = { gas: gasRecords, oil: oilRecords, oltc: oltcRecords };

  // Mỗi khóa đã chọn ("gas:H2", "oltc:moisture"...) có thể sinh ra 1 ĐƯỜNG (gộp toàn bộ
  // pha, như trước) hoặc NHIỀU đường (1 đường/pha đã tick) khi thiết bị có ≥2 pha.
  const seriesSpecs = [];
  selectedKeys.forEach((key) => {
    const def = TREND_PARAM_DEFS[key];
    const source = key.split(":")[0];

    // gasField: chỉ gắn cho 1 trong 7 khí chính (DGA.GASES) — dùng để tra ngưỡng đang áp
    // dụng (resolveStandard().limits) và tính dự báo xu hướng bên dưới (renderTrendChart()
    // tiếp tục ở phần build "datasets"). TCG/N2/O2/Bảng 63 KHÔNG có ngưỡng tuyệt đối theo
    // cùng cách này nên không đưa vào dự báo đạt-ngưỡng (xem ghi chú ở forecastGasTrend(),
    // dga-logic.js) — vẫn vẽ đường xu hướng bình thường, chỉ không có phần ngoại suy.
    const gasField = source === "gas" && DGA.GASES.includes(def.field) ? def.field : null;

    if (source === "gas" && phaseFilterActive) {
      tickedPhases.forEach((p) => {
        const recs = gasRecords.filter((r) => (r.pha || "").trim() === p);
        seriesSpecs.push({
          label: `${def.label} - ${DGA.phaLabelWithPrefix(p)} (${def.unit})`,
          axis: def.axis,
          points: trendPoints(recs, (r) => gasValueOf(r, def.field)),
          gasField,
          gasLabel: def.label,
        });
      });
      return;
    }

    if (source === "oltc" && phaseFilterActive) {
      // Mẫu "Điểm cuối trung tính" (3 pha dùng chung) không gắn với 1 pha cụ thể nào —
      // luôn hiện, không bị lọc theo pha đã tick.
      const trungtinhRecs = oltcRecords.filter((r) => r.oltc_sample_point !== "pharieng");
      const trungtinhPoints = trendPoints(trungtinhRecs, (r) => r[def.field]);
      if (trungtinhPoints.length > 0) {
        seriesSpecs.push({ label: `${def.label} (${def.unit})`, axis: def.axis, points: trungtinhPoints });
      }
      tickedPhases.forEach((p) => {
        const recs = oltcRecords.filter((r) => r.oltc_sample_point === "pharieng" && (r.phase || "").trim() === p);
        const points = trendPoints(recs, (r) => r[def.field]);
        if (points.length > 0) {
          seriesSpecs.push({ label: `${def.label} - ${DGA.phaLabelWithPrefix(p)} (${def.unit})`, axis: def.axis, points });
        }
      });
      return;
    }

    // Không tách theo pha (thiết bị không có ≥2 pha, hoặc là dầu MBA chính — không có
    // khái niệm pha): gộp toàn bộ bản ghi của nguồn dữ liệu này thành 1 đường như trước.
    const valueOf = source === "gas" ? (r) => gasValueOf(r, def.field) : (r) => r[def.field];
    seriesSpecs.push({
      label: `${def.label} (${def.unit})`,
      axis: def.axis,
      points: trendPoints(recordsBySource[source], valueOf),
      gasField,
      gasLabel: def.label,
    });
  });

  if (seriesSpecs.length === 0) {
    if (chartLibAvailable) {
      $("trChartEmpty").classList.remove("hidden");
      canvas.classList.add("hidden");
    }
    renderTrendForecastTable([], 0);
    return;
  }
  if (chartLibAvailable) {
    $("trChartEmpty").classList.add("hidden");
    canvas.classList.remove("hidden");
  }

  const datasets = seriesSpecs.map((spec, idx) => {
    const color = TREND_COLORS[idx % TREND_COLORS.length];
    return {
      label: spec.label,
      data: spec.points,
      borderColor: color,
      backgroundColor: color,
      yAxisID: spec.axis,
      spanGaps: true,
      tension: 0.15,
      pointRadius: 3,
      pointHoverRadius: 5,
    };
  });

  // Dự báo xu hướng (ngoại suy tuyến tính, xem forecastGasTrend() ở dga-logic.js) — chỉ
  // áp dụng cho các đường ứng với 1 trong 7 khí chính (spec.gasField, gắn ở phần build
  // seriesSpecs phía trên). Thêm 1 ĐƯỜNG NÉT ĐỨT (cùng màu, nhạt hơn) nối từ điểm đo GẦN
  // NHẤT tới điểm dự báo ở cuối khoảng "Số năm dự báo" (#tr_forecastYears) đang chọn, và
  // gom kết quả (tốc độ/giá trị dự báo/ngưỡng/mốc đạt ngưỡng) vào bảng bên dưới đồ thị
  // (renderTrendForecastTable()). Ngưỡng dùng để so là ngưỡng ĐANG ÁP DỤNG cho thiết bị
  // (resolveStandard() — NSX nếu có cấu hình đủ 7 khí, ngược lại QĐ1901/IEC theo loại
  // thiết bị), lấy theo lần đo GẦN NHẤT của thiết bị (gasRecords đã sort tăng dần theo
  // ngày ở trendRecordsForDevice() — xem ui-trend.js phía trên).
  //
  // #tr_forecastEnabled (checkbox "Hiện dự báo xu hướng tương lai") cho phép TẮT HẲN cả
  // đường nét đứt lẫn bảng dự báo — hữu ích khi người dùng chỉ muốn xem SỐ LIỆU ĐÃ ĐO
  // thực tế, không muốn đồ thị/bảng bị thêm phần ngoại suy. Mặc định BẬT (checked trong
  // index.html) — trạng thái tick được nhớ qua localStorage (xem setupTrendForecastToggle()
  // ở app-core.js), không phải dữ liệu nghiệp vụ nên không lưu qua Storage.
  const forecastEnabled = !$("tr_forecastEnabled") || $("tr_forecastEnabled").checked;
  if (!forecastEnabled) {
    renderTrendForecastTable([], 0);
  } else {
    const forecastYearsInput = $("tr_forecastYears");
    const forecastYears = forecastYearsInput ? Math.max(1, Math.min(30, Number(forecastYearsInput.value) || 3)) : 3;
    const standard = gasRecords.length > 0
      ? DGA.resolveStandard(
          {
            equipmentType: gasRecords[gasRecords.length - 1].equipment_type,
            manufacturer: gasRecords[gasRecords.length - 1].manufacturer,
            mbaSubtype: gasRecords[gasRecords.length - 1].mba_subtype ?? gasRecords[gasRecords.length - 1].mbaSubtype ?? null,
          },
          toManufacturerStandardsForLogic(_allStandards)
        )
      : null;

    const forecastRows = [];
    seriesSpecs.forEach((spec, idx) => {
      if (!spec.gasField) return;
      const limit = standard ? standard.limits[spec.gasField] : null;
      const history = spec.points.map((p) => ({ date: new Date(p.x), value: p.y }));
      const forecast = DGA.forecastGasTrend(history, forecastYears, limit);
      forecastRows.push({ label: spec.label, gasLabel: spec.gasLabel, forecast });
      // Chỉ vẽ 1 đường nét đứt trên đồ thị — dùng kết quả "Trung bình 3 thuật toán"
      // (methods.average) làm đại diện, để đồ thị không bị rối khi có nhiều khí/pha đang
      // chọn cùng lúc. Chi tiết đầy đủ của TỪNG thuật toán (OLS/Theil-Sen/liền kề) xem ở
      // bảng "Dự báo xu hướng" bên dưới (renderTrendForecastTable()).
      if (!forecast.ok || !forecast.methods.average) return;
      const avg = forecast.methods.average;
      const lastPoint = spec.points[spec.points.length - 1];
      const color = TREND_COLORS[idx % TREND_COLORS.length];
      datasets.push({
        label: `${spec.label} — dự báo (TB 3 thuật toán)`,
        data: [
          { x: lastPoint.x, y: lastPoint.y },
          { x: new Date(avg.forecastDate).getTime(), y: avg.forecastValue },
        ],
        borderColor: color,
        backgroundColor: color,
        yAxisID: spec.axis,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: [0, 4],
        pointStyle: "rectRot",
        tension: 0,
      });
    });
    renderTrendForecastTable(forecastRows, forecastYears);
  }

  // Phần còn lại chỉ dựng ĐỒ THỊ (Chart.js) — bảng dự báo ở trên đã xong, không phụ thuộc
  // đoạn này, nên dừng ở đây nếu thư viện chưa sẵn sàng (xem ghi chú chartLibAvailable ở
  // đầu hàm).
  if (!chartLibAvailable) return;

  const usedAxes = new Set(datasets.map((d) => d.yAxisID));
  const scales = {
    x: {
      type: "linear",
      ticks: { callback: (val) => new Date(val).toLocaleDateString("vi-VN") },
      title: { display: true, text: "Ngày lấy mẫu" },
    },
  };
  let firstAxis = true;
  Object.entries(TREND_AXIS_DEFS).forEach(([id, cfg]) => {
    if (!usedAxes.has(id)) return;
    scales[id] = {
      type: "linear",
      position: cfg.position,
      title: { display: true, text: cfg.title },
      grid: { drawOnChartArea: firstAxis },
    };
    firstAxis = false;
  });

  _trendChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            title: (items) => (items.length ? new Date(items[0].parsed.x).toLocaleDateString("vi-VN") : ""),
          },
        },
      },
      scales,
    },
  });
}

/** Vẽ bảng "Dự báo xu hướng" (#trForecastBody) bên dưới đồ thị — 1 dòng cho mỗi đường
 *  khí (trong 7 khí chính) đang chọn trên đồ thị, xem forecastGasTrend()/renderTrendChart()
 *  ở trên. Ẩn hẳn khối #trForecastWrap khi không có dòng nào (không có khí chính nào
 *  đang chọn) để đỡ hiện 1 bảng trống gây rối mắt. */
/** Render 1 dòng <tr> cho 1 THUẬT TOÁN của 1 khí (dùng chung cho cả 3 thuật toán lẫn
 *  dòng "Trung bình") — tách riêng khỏi renderTrendForecastTable() vì cấu trúc lặp lại
 *  y hệt nhau, chỉ khác dữ liệu vào. isAverage=true tô đậm dòng để nổi bật kết quả tổng
 *  hợp so với 3 dòng thuật toán riêng lẻ phía trên nó. gasCellHtml=null nghĩa là dòng này
 *  KHÔNG mở đầu 1 khí mới (rowspan gộp từ dòng đầu tiên của khí đó — xem forecastYears ở
 *  renderTrendForecastTable()). */
function trendForecastMethodRowHtml(method, { forecastYears, gasCellHtml, isAverage }) {
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("vi-VN");
  const rateText = `${method.ratePerYear >= 0 ? "+" : ""}${method.ratePerYear.toFixed(2)} ppm/năm`;
  const r2Text = method.r2 === null ? "—" : method.r2.toFixed(3);
  let crossingHtml = `<span class="pill muted">Không có ngưỡng để so sánh</span>`;
  if (method.crossing) {
    if (method.crossing.status === "already_exceeded") {
      crossingHtml = `<span class="pill bad">Đã vượt ngưỡng ở lần đo gần nhất</span>`;
    } else if (method.crossing.status === "not_increasing") {
      crossingHtml = `<span class="pill ok">Ổn định/giảm — không dự báo vượt ngưỡng</span>`;
    } else {
      const withinNote = method.crossing.withinHorizon ? "" : ` (ngoài ${forecastYears} năm đã chọn)`;
      crossingHtml = `<span class="pill ${method.crossing.yearsFromLast <= forecastYears ? "bad" : "warn"}">` +
        `~${fmtDate(method.crossing.date)} (còn ~${method.crossing.yearsFromLast.toFixed(1)} năm)${withinNote}</span>`;
    }
  }
  return `<tr${isAverage ? ' style="background:var(--gray-50); font-weight:600;"' : ""}>
    ${gasCellHtml !== null ? gasCellHtml : ""}
    <td>${escapeHtml(method.label)}</td>
    <td>${rateText}</td>
    <td>${method.forecastValue.toFixed(1)} ppm</td>
    <td>${r2Text}</td>
    <td>${crossingHtml}</td>
  </tr>`;
}

/** Vẽ bảng "Dự báo xu hướng" (#trForecastBody) bên dưới đồ thị — mỗi khí (trong 7 khí
 *  chính) đang chọn trên đồ thị chiếm 4 dòng: 3 dòng ứng với 3 thuật toán độc lập (OLS,
 *  Theil-Sen, trung bình liền kề — xem forecastGasTrend()/FORECAST_METHOD_LABELS ở
 *  dga-logic.js) rồi 1 dòng "Trung bình 3 thuật toán" tô đậm để dễ so sánh nhanh — cột
 *  "Khí" và "Giá trị gần nhất" dùng rowspan gộp chung cho cả nhóm 4 dòng vì đó là dữ liệu
 *  ĐO ĐƯỢC, giống nhau cho mọi thuật toán, chỉ có "Tốc độ"/"Dự báo"/"R²"/"Đạt ngưỡng" là
 *  khác nhau theo thuật toán. Ẩn hẳn khối #trForecastWrap khi không có dòng nào (không có
 *  khí chính nào đang chọn) để đỡ hiện 1 bảng trống gây rối mắt. */
function renderTrendForecastTable(forecastRows, forecastYears) {
  const wrap = $("trForecastWrap");
  if (!wrap) return;
  if (!forecastRows || forecastRows.length === 0) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  $("trForecastYearsLabel").textContent = forecastYears;

  const rowsHtml = forecastRows.map(({ label, forecast }) => {
    if (!forecast.ok) {
      const reasonText = forecast.reason === "not_enough_data"
        ? `Chưa đủ dữ liệu (cần ≥ 2 lần đo, hiện có ${forecast.n})`
        : "Không tính được (các lần đo cùng 1 ngày)";
      return `<tr><td>${escapeHtml(label)}</td><td colspan="4" class="pill muted">${reasonText}</td></tr>`;
    }
    const methodKeys = ["ols", "theilsen", "consecutive", "average"];
    const gasHeaderCell = `<td rowspan="${methodKeys.length}">${escapeHtml(label)}<br /><span class="pill muted" ` +
      `style="margin-top:4px;">Gần nhất: ${forecast.lastValue} ppm • Ngưỡng: ${forecast.limit === null ? "—" : forecast.limit + " ppm"}</span></td>`;
    return methodKeys.map((key, i) => {
      const method = forecast.methods[key];
      if (!method) return "";
      return trendForecastMethodRowHtml(method, {
        forecastYears,
        gasCellHtml: i === 0 ? gasHeaderCell : null,
        isAverage: key === "average",
      });
    }).join("");
  }).join("");

  $("trForecastBody").innerHTML = rowsHtml;
}
