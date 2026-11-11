/* ui-trend.js — Tab "Xu hướng": đồ thị Chart.js theo thời gian cho 1 thiết bị, lọc
   theo thông số/pha. Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước
   chia sẻ scope giữa các file ui-*.js. */

// 8 màu đã kiểm tra phân biệt được cả với người mù màu, riêng cho từng nền (sáng/tối). Từ đường thứ 9
// dùng lại màu nhưng đổi hình điểm để vẫn phân biệt được.
const TREND_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};
const TREND_POINT_STYLES = ["circle", "rect", "triangle"];
// Mỗi đường giữ nguyên ô màu trong suốt phiên, để bật/tắt thông số khác không đổi màu đường đang xem.
const _trendSeriesSlots = new Map();
let _trendLastArgs = null;

function trendSeriesStyle(label) {
  if (!_trendSeriesSlots.has(label)) _trendSeriesSlots.set(label, _trendSeriesSlots.size);
  const slot = _trendSeriesSlots.get(label);
  const colors = TREND_COLORS[document.documentElement.dataset.theme === "dark" ? "dark" : "light"];
  return {
    color: colors[slot % colors.length],
    pointStyle: TREND_POINT_STYLES[Math.floor(slot / colors.length) % TREND_POINT_STYLES.length],
  };
}

// Đổi giao diện: vẽ lại đồ thị đang hiện bằng màu của giao diện mới.
document.addEventListener("dga:themechange", () => {
  if (_trendChart && _trendLastArgs) renderTrendChart(..._trendLastArgs);
});

// Thứ tự ưu tiên hiển thị khi tách theo pha: A, B, C trước, các giá trị khác (hiếm gặp,
// vd người dùng gõ tự do pha khác) xếp sau theo alphabet.
const TREND_PHASE_ORDER = { A: 0, B: 1, C: 2 };

/** Chỉ tiêu dầu bổ sung dạng SỐ (bỏ ô chọn và nhóm ôxi hóa — chỉ thử khi pha trộn dầu). */
function TREND_OIL_EXT_DEFS() {
  return (DGA.OIL_PARAM_DEFS || []).filter((d) => (d.group === "qd1901" || d.group === "iec") && d.type !== "select");
}

// Ký hiệu NGẮN của chỉ tiêu dầu bổ sung — in cạnh đường trên đồ thị (xem trendLineLabelsPlugin).
const TREND_OIL_EXT_SHORT = {
  acid: "Axit", flash: "Chớp cháy", mech: "Tạp chất", p6: ">6µm", p14: ">14µm", resistivity: "ρ90",
  furfural: "2-FAL", color: "Màu", ift: "IFT", pcb: "PCB", sediment: "Cặn", sludge: "Bùn",
  inhibitor: "Ức chế", passivator: "Thụ động",
};

// short = ký hiệu ngắn in cạnh đường (H2, CH4, Ẩm, BDV...) để nhận ra đường khi nhiều đường sát/chồng nhau.
const TREND_PARAM_DEFS = Object.assign(
  {},
  ...DGA.GASES.map((g) => ({ ["gas:" + g]: { label: g, short: g, unit: "ppm", axis: "yGas", field: g } })),
  {
    // N2, O2 (khí bổ sung, tùy chọn — không thuộc DGA.GASES, xem ghi chú ở onAnalyze()
    // trong ui-dga.js) + 2 chỉ tiêu TỔNG HỢP tính từ 7 khí chính (và N2/O2 với Bảng 63):
    // TCG (Tổng lượng khí cháy — DGA.computeTCG(), không tính CO2) và Tổng hàm lượng khí
    // hòa tan (Bảng 63, Điều 54 QĐ1901 — DGA.computeTotalDissolvedGasPercent(), CẦN cả
    // N2 lẫn O2 mới tính được nên điểm dữ liệu sẽ trống ở các lần đo chưa nhập đủ 2 khí
    // này). Đọc giá trị qua gasTrendValue() (không nằm trong recordGases() 7 khí chính).
    "gas:N2": { label: "Nitơ N2", short: "N2", unit: "ppm", axis: "yGas", field: "N2" },
    "gas:O2": { label: "Oxy O2", short: "O2", unit: "ppm", axis: "yGas", field: "O2" },
    "gas:TCG": { label: "Tổng lượng khí cháy (TCG)", short: "TCG", unit: "ppm", axis: "yGas", field: "TCG" },
    "gas:BANG63": { label: "Tổng hàm lượng khí hòa tan (Bảng 63)", short: "Bảng 63", unit: "%", axis: "yBang63", field: "BANG63" },
    "oil:moisture": { label: "Độ ẩm dầu chính", short: "Ẩm", unit: "ppm", axis: "yMoisture", field: "moisture_ppm" },
    "oil:tgd90": { label: "tgδ 90°C dầu chính", short: "tgδ", unit: "%", axis: "yTgd", field: "tgd_90c_percent" },
    "oil:bdv": { label: "Điện áp chọc thủng dầu chính", short: "BDV", unit: "kV", axis: "yBdv", field: "bdv_kv" },
    "oltc:moisture": { label: "Độ ẩm dầu OLTC", short: "Ẩm OLTC", unit: "ppm", axis: "yMoisture", field: "moisture_ppm" },
    "oltc:tgd90": { label: "tgδ 90°C dầu OLTC", short: "tgδ OLTC", unit: "%", axis: "yTgd", field: "tgd_90c_percent" },
    "oltc:bdv": { label: "Điện áp chọc thủng dầu OLTC", short: "BDV OLTC", unit: "kV", axis: "yBdv", field: "bdv_kv" },
  },
  // Chỉ tiêu lý-hóa BỔ SUNG của dầu chính (số) — DGA.OIL_PARAM_DEFS nhóm qd1901/iec, mỗi chỉ tiêu 1 trục riêng
  // (đơn vị khác hẳn nhau). Trục chỉ hiện khi chỉ tiêu đó đang được chọn (xem usedAxes ở renderTrendChart()).
  ...TREND_OIL_EXT_DEFS().map((d) => ({ ["oil:" + d.key]: { label: d.label, short: TREND_OIL_EXT_SHORT[d.key] || d.key, unit: d.unit, axis: "yOil_" + d.key, field: d.field } })),
  ...TREND_OIL_EXT_DEFS().filter((d) => d.group === "qd1901")
    .map((d) => ({ ["oltc:" + d.key]: { label: d.label + " OLTC", short: (TREND_OIL_EXT_SHORT[d.key] || d.key) + " OLTC", unit: d.unit, axis: "yOil_" + d.key, field: d.field } }))
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
  ["trHistGasWrap", "trHistOilWrap", "trHistOltcWrap", "trFaultWrap"].forEach((id) => $(id).classList.add("hidden"));

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
  renderTrendOilTreatment(gasRecords);
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
  // Chỉ liệt kê chỉ tiêu bổ sung mà thiết bị này THỰC SỰ có số liệu (tránh danh sách dài toàn ô trống)
  const oilExtKeys = TREND_OIL_EXT_DEFS().filter((d) => oilRecords.some((r) => r[d.field] !== null && r[d.field] !== undefined && r[d.field] !== ""))
    .map((d) => "oil:" + d.key);
  if (hasOil) buildChecks("trParamsOil", ["oil:moisture", "oil:tgd90", "oil:bdv", ...oilExtKeys]);
  const oltcExtKeys = TREND_OIL_EXT_DEFS().filter((d) => d.group === "qd1901" &&
    oltcRecords.some((r) => r[d.field] !== null && r[d.field] !== undefined && r[d.field] !== "")).map((d) => "oltc:" + d.key);
  if (hasOltc) buildChecks("trParamsOltc", ["oltc:moisture", "oltc:tgd90", "oltc:bdv", ...oltcExtKeys]);
}

function renderTrendHistoryTables(gasRecords, oilRecords, oltcRecords) {
  $("trHistGasWrap").classList.toggle("hidden", gasRecords.length === 0);
  $("trHistOilWrap").classList.toggle("hidden", oilRecords.length === 0);
  $("trHistOltcWrap").classList.toggle("hidden", oltcRecords.length === 0);

  $("trHistGasTable").innerHTML = gasRecords.slice().reverse().map((r) => `
    <tr>
      <td>${escapeHtml(DGA.formatSampleDate(r.sample_date))}</td><td>${escapeHtml(DGA.phaLabel(r.pha) || "—")}</td><td>${escapeHtml(r.lan_do ?? "—")}</td>
      ${DGA.GASES.map((g) => `<td>${escapeHtml(recordGases(r)[g] ?? "—")}</td>`).join("")}
    </tr>
  `).join("");

  $("trHistOilTable").innerHTML = oilRecords.slice().reverse().map((r) => `
    <tr>
      <td>${escapeHtml(DGA.formatSampleDate(r.sample_date))}</td>
      <td>${r.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${escapeHtml(r.moisture_ppm ?? "—")}</td><td>${escapeHtml(r.tgd_90c_percent ?? "—")}</td><td>${escapeHtml(r.bdv_kv ?? "—")}</td>
    </tr>
  `).join("");

  $("trHistOltcTable").innerHTML = oltcRecords.slice().reverse().map((r) => `
    <tr>
      <td>${escapeHtml(DGA.formatSampleDate(r.sample_date))}</td>
      <td>${escapeHtml(oltcSamplePointLabel(r.oltc_sample_point))}</td>
      <td>${r.phase ? escapeHtml(r.phase) : "—"}</td>
      <td>${r.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${escapeHtml(r.moisture_ppm ?? "—")}</td><td>${escapeHtml(r.tgd_90c_percent ?? "—")}</td><td>${escapeHtml(r.bdv_kv ?? "—")}</td>
    </tr>
  `).join("");
}

// ===================== Nhãn ký hiệu cạnh đường (H2, CH4, C2H2...) =====================
// Nhiều đường thường sát nhau, thậm chí chồng lên nhau → khó biết đường nào là thông số nào.
// - Tự in ký hiệu ngắn ở CUỐI mỗi đường khi còn chỗ (nhãn nào đè lên nhãn đã in thì bỏ qua).
// - Chạm/click vào 1 đường: chọn đường đó (các đường khác mờ đi) và in ký hiệu ngay tại chỗ chạm.
//   Nhiều đường chồng nhau tại chỗ chạm → chạm lại cùng chỗ để chuyển lần lượt sang đường kế tiếp.
//   Chạm vào vùng trống → bỏ chọn.
const TREND_LABEL_FONT = '600 11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TREND_LABEL_H = 16;
const TREND_LABEL_PAD_X = 4;
const TREND_LABEL_GAP = 6;
const TREND_LABEL_PAD_RIGHT = 48;
// px — chạm cách mọi đường xa hơn mức này coi như chạm vùng trống (bỏ chọn).
const TREND_PICK_RADIUS = 18;
// px — các đường cách điểm chạm chênh nhau không quá mức này coi như "chồng nhau" (chạm lại để chuyển).
const TREND_PICK_TIE = 6;

// Đường đang chọn: { datasetIndex, xVal, yVal } — lưu tọa độ DỮ LIỆU (không phải pixel) để nhãn vẫn
// đúng chỗ khi đồ thị đổi kích thước. Vẽ lại đồ thị (renderTrendChart) thì bỏ chọn.
let _trendSelected = null;

/** Ký hiệu ngắn kèm pha khi tách đường theo pha: "H2·A", "Ẩm OLTC·B", "CH4·Chung". */
function trendPhaseShort(short, p) {
  return `${short}·${p === DGA.PHA_CHUNG_3_PHA ? "Chung" : p}`;
}

/** Chữ trắng hay chữ gần đen trên nền màu của đường — chọn bên có độ tương phản cao hơn (WCAG). */
function trendLabelTextColor(hex) {
  const m = /^#([0-9a-f]{6})/i.exec(hex || "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const ch = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
  // #111 có độ chói ≈ 0,0056.
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.0556 ? "#fff" : "#111";
}

function trendLabelBox(ctx, text, anchorX, anchorY, side) {
  const w = Math.ceil(ctx.measureText(text).width) + TREND_LABEL_PAD_X * 2;
  const x = side === "left" ? anchorX - TREND_LABEL_GAP - w : anchorX + TREND_LABEL_GAP;
  return { x, y: anchorY - TREND_LABEL_H / 2, w, h: TREND_LABEL_H, text };
}

function trendDrawLabel(ctx, box, color, strong) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(box.x, box.y, box.w, box.h, 4);
  else ctx.rect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = color;
  ctx.fill();
  if (strong) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = document.documentElement.dataset.theme === "dark" ? "#000" : "#fff";
    ctx.stroke();
  }
  ctx.fillStyle = trendLabelTextColor(color);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(box.text, box.x + TREND_LABEL_PAD_X, box.y + box.h / 2 + 0.5);
}

function trendHasRightAxis(chart) {
  return Object.values(chart.scales).some((s) => s.axis === "y" && s.position === "right");
}

/** Các điểm vẽ được (bỏ điểm trống) của 1 đường, theo pixel. */
function trendDrawnPoints(chart, datasetIndex) {
  return chart.getDatasetMeta(datasetIndex).data.filter((p) => p && !p.skip && Number.isFinite(p.x) && Number.isFinite(p.y));
}

const trendLineLabelsPlugin = {
  id: "trendLineLabels",
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: area } = chart;
    const rightLimit = trendHasRightAxis(chart) ? area.right : chart.width - 2;
    const placed = [];
    const blocked = (b) =>
      b.y < area.top - 4 || b.y + b.h > area.bottom + 4 || b.x < area.left || b.x + b.w > rightLimit ||
      placed.some((p) => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y);

    ctx.save();
    ctx.font = TREND_LABEL_FONT;

    // Nhãn của đường đang chọn — đặt trước để luôn có chỗ, vẽ sau cùng để nằm trên.
    let selDraw = null;
    const sel = _trendSelected;
    if (sel && chart.isDatasetVisible(sel.datasetIndex)) {
      const ds = chart.data.datasets[sel.datasetIndex];
      const yScale = ds && chart.scales[ds.yAxisID];
      if (yScale) {
        const px = chart.scales.x.getPixelForValue(sel.xVal);
        const py = yScale.getPixelForValue(sel.yVal);
        const anchorY = Math.max(TREND_LABEL_H / 2, py - TREND_LABEL_H);
        let box = trendLabelBox(ctx, ds.shortLabel, px, anchorY, "right");
        if (box.x + box.w > chart.width - 2) box = trendLabelBox(ctx, ds.shortLabel, px, anchorY, "left");
        selDraw = { box, color: ds.trendColor, px, py };
        placed.push(box);
      }
    }

    // Nhãn ở cuối mỗi đường đo (không in cho đường dự báo nét đứt) — chỉ in khi còn chỗ.
    ctx.globalAlpha = selDraw ? 0.35 : 1;
    chart.data.datasets.forEach((ds, i) => {
      if (ds.isForecast || !ds.shortLabel || !chart.isDatasetVisible(i)) return;
      if (selDraw && sel.datasetIndex === i) return;
      const pts = trendDrawnPoints(chart, i);
      const last = pts[pts.length - 1];
      if (!last) return;
      for (const side of ["right", "left"]) {
        for (const dy of [0, -TREND_LABEL_H * 0.6, TREND_LABEL_H * 0.6]) {
          const box = trendLabelBox(ctx, ds.shortLabel, last.x, last.y + dy, side);
          if (!blocked(box)) {
            placed.push(box);
            trendDrawLabel(ctx, box, ds.trendColor, false);
            return;
          }
        }
      }
    });
    ctx.globalAlpha = 1;

    if (selDraw) {
      ctx.beginPath();
      ctx.arc(selDraw.px, selDraw.py, 5, 0, Math.PI * 2);
      ctx.fillStyle = selDraw.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = document.documentElement.dataset.theme === "dark" ? "#000" : "#fff";
      ctx.stroke();
      trendDrawLabel(ctx, selDraw.box, selDraw.color, true);
    }
    ctx.restore();
  },
};

/** Màu điểm đo = màu đường hiện tại (kể cả khi bị làm mờ). Phải là HÀM: Chart.js lưu đệm màu điểm dạng
 *  chuỗi cố định, đổi dataset.borderColor rồi update() không làm điểm đổi màu theo. */
function trendPointColor(ctx) {
  return ctx.dataset.borderColor;
}

/** Khoảng cách từ điểm (px, py) tới đoạn thẳng a–b, kèm điểm gần nhất trên đoạn. */
function trendDistToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return { d: Math.hypot(px - x, py - y), x, y };
}

/** Chọn/bỏ chọn 1 đường: đường được chọn (và đường dự báo của nó) đậm lên, các đường khác mờ đi. */
function setTrendSelection(chart, sel) {
  _trendSelected = sel;
  const selKey = sel ? chart.data.datasets[sel.datasetIndex].seriesKey : null;
  chart.data.datasets.forEach((ds) => {
    if (!ds.trendColor) return;
    const faded = selKey !== null && ds.seriesKey !== selKey;
    const color = faded ? ds.trendColor + "40" : ds.trendColor;
    ds.borderColor = color;
    ds.backgroundColor = color;
    const baseWidth = ds.isForecast ? 1.5 : 2;
    ds.borderWidth = selKey !== null && !faded ? baseWidth + 1 : baseWidth;
  });
  chart.update("none");
}

function onTrendChartClick(evt, chart) {
  const ex = evt.x;
  const ey = evt.y;
  if (!Number.isFinite(ex) || !Number.isFinite(ey)) return;
  const cands = [];
  chart.data.datasets.forEach((ds, i) => {
    if (!chart.isDatasetVisible(i)) return;
    const pts = trendDrawnPoints(chart, i);
    let best = pts.length === 1 ? { d: Math.hypot(ex - pts[0].x, ey - pts[0].y), x: pts[0].x, y: pts[0].y } : null;
    for (let k = 0; k + 1 < pts.length; k++) {
      const r = trendDistToSegment(ex, ey, pts[k], pts[k + 1]);
      if (!best || r.d < best.d) best = r;
    }
    if (best && best.d <= TREND_PICK_RADIUS) cands.push({ i, ...best });
  });
  if (cands.length === 0) {
    if (_trendSelected) setTrendSelection(chart, null);
    return;
  }
  cands.sort((a, b) => a.d - b.d);
  const near = cands.filter((c) => c.d <= cands[0].d + TREND_PICK_TIE);
  let pick = near[0];
  // Nhiều đường chồng nhau và đang chọn 1 trong số đó → chuyển sang đường kế tiếp.
  if (_trendSelected && near.length > 1) {
    const cur = near.findIndex((c) => c.i === _trendSelected.datasetIndex);
    if (cur >= 0) pick = near[(cur + 1) % near.length];
  }
  const ds = chart.data.datasets[pick.i];
  setTrendSelection(chart, {
    datasetIndex: pick.i,
    xVal: chart.scales.x.getValueForPixel(pick.x),
    yVal: chart.scales[ds.yAxisID].getValueForPixel(pick.y),
  });
}


// ===================== Diễn biến LOẠI khiếm khuyết (Bảng 66 + tam giác Duval) =====================
// Số liệu: DGA.buildFaultEvolution() (dga-logic-gas.js). Phần này độc lập với các thông số đang tick ở
// trên: luôn dựa trên khí hòa tan của thiết bị (1 pha mỗi lần khi thiết bị có nhiều pha).
// Bảng từng lần đo không cần Chart.js; biểu đồ tỷ số cần Chart.js; tam giác Duval vẽ bằng SVG thuần.

const TREND_RATIO_META = [
  { key: "c2h2_c2h4", axis: "yR1", title: "C2H2/C2H4" },
  { key: "ch4_h2", axis: "yR2", title: "CH4/H2" },
  { key: "c2h4_c2h6", axis: "yR3", title: "C2H4/C2H6" },
];

let _trendRatioChart = null;
let _trendFaultPhase = null;
// Lựa chọn thang trục tung của đồ thị 3 tỷ số (log / tuyến tính) — sở thích giao diện, nhớ theo trình duyệt.
const TREND_RATIO_SCALE_STORAGE_KEY = "dga_trend_ratio_scale";
// Lần đo bị BỎ TICK ở bảng chi tiết (khóa = trendFaultRowKey()) — không vẽ lên biểu đồ tỷ số và tam giác Duval.
// Mặc định tick hết; đổi thiết bị/pha thì tick lại hết.
const _trendFaultUnticked = new Set();
let _trendFaultScope = null;
// Kết quả tính của lần vẽ gần nhất — đổi tick chỉ vẽ lại biểu đồ, không tính lại.
let _trendFaultView = null;

function trendFaultRowKey(r) {
  return `${r.prevDate ?? ""}>${r.date}`;
}

// Ý nghĩa mã khiếm khuyết (Bảng 66/67 Điều 54 QĐ1901 = Table 1 & Annex B IEC 60599; ví dụ theo Table 3 IEC 60599).
const TREND_FAULT_CODE_NOTES = [
  { code: "PD", key: "PD", text: "Phóng điện cục bộ dạng corona (plasma lạnh): bọt khí, khoang rỗng trong cách điện ngâm dầu." },
  { code: "D1", key: "D1", text: "Phóng điện năng lượng thấp: tia lửa, phóng điện bề mặt (tracking), lỗ châm/vết cháy nhỏ trên giấy, chập chờn tiếp xúc." },
  { code: "D2", key: "D2", text: "Phóng điện năng lượng cao: hồ quang, phóng điện xuyên thủng, ngắn mạch vòng dây — vết cháy, nóng chảy kim loại." },
  { code: "T1", key: "T1", text: "Quá nhiệt t < 300 °C: quá tải, giấy cách điện bị nung nóng (thường kèm CO, CO2 tăng)." },
  { code: "T2", key: "T2", text: "Quá nhiệt 300–700 °C: tiếp xúc xấu ở mối nối/bộ chuyển nấc, dòng xoáy, giấy hóa than." },
  { code: "T3", key: "T3", text: "Quá nhiệt t > 700 °C: dòng tuần hoàn trong lõi/vỏ thùng, chạm lõi nhiều điểm, dầu bị cracking (C2H4 cao, có thể có C2H2)." },
  { code: "D+T", key: "DT", text: "Hỗn hợp phóng điện và quá nhiệt — ranh giới không phân định rõ trên tam giác Duval gốc (IEC 60599 Annex B)." },
];

function trendFmtRatio(v) {
  return Number(v).toLocaleString("vi-VN", { maximumSignificantDigits: 3 });
}

function trendFmtDate(ms) {
  return new Date(ms).toLocaleDateString("vi-VN");
}

function trendRatioCellText(p) {
  if (!p) return "—";
  return p.censored ? "< 0,01" : trendFmtRatio(p.value);
}

function trendSurfaceColor() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  return v || (document.documentElement.dataset.theme === "dark" ? "#0f172a" : "#fff");
}

function trendFaultTheme() {
  if (typeof d54Theme === "function") return d54Theme();
  const dark = document.documentElement.dataset.theme === "dark";
  return { dark, text: dark ? "#e2e8f0" : "#0f172a", muted: dark ? "#94a3b8" : "#475569", point: dark ? "#38bdf8" : "#0369a1", zone: null };
}

function renderTrendFaultEvolution(gasRecords) {
  const wrap = $("trFaultWrap");
  if (!wrap) return;
  if (_trendRatioChart) {
    _trendRatioChart.destroy();
    _trendRatioChart = null;
  }
  if (!gasRecords || gasRecords.length === 0) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");

  // Nhiều pha: xem từng pha một (quỹ đạo Duval của nhiều pha chồng lên nhau sẽ không đọc được).
  const phases = trendDistinctPhases(gasRecords, []);
  let recs = gasRecords;
  if (phases.length >= 2) {
    if (!phases.includes(_trendFaultPhase)) _trendFaultPhase = phases[0];
    $("tr_faultPhase").innerHTML = phases
      .map((p) => `<option value="${escapeHtml(p)}"${p === _trendFaultPhase ? " selected" : ""}>${escapeHtml(DGA.phaLabelWithPrefix(p))}</option>`)
      .join("");
    $("trFaultPhaseWrap").classList.remove("hidden");
    recs = gasRecords.filter((r) => (r.pha || "").trim() === _trendFaultPhase);
  } else {
    $("trFaultPhaseWrap").classList.add("hidden");
  }
  const scope = `${$("tr_device") ? $("tr_device").value : ""}|${phases.length >= 2 ? _trendFaultPhase : ""}`;
  if (scope !== _trendFaultScope) {
    _trendFaultScope = scope;
    _trendFaultUnticked.clear();
  }

  const basis = $("tr_faultBasis").value === "delta" ? "delta" : "abs";
  $("trFaultDeltaNote").classList.toggle("hidden", basis !== "delta");

  const logicOf = (r) => ({ equipmentType: r.equipment_type, manufacturer: r.manufacturer, mbaSubtype: r.mba_subtype ?? r.mbaSubtype ?? null });
  const latest = recs[recs.length - 1];
  const standard = latest ? DGA.resolveStandard(logicOf(latest), toManufacturerStandardsForLogic(_allStandards)) : null;
  const pdThreshold = standard && standard.pdThreshold !== undefined ? standard.pdThreshold : DGA.DEFAULT_PD_THRESHOLD;

  // recsOk[i] ứng đúng series[i] (row.index) — phiếu đối chiếu cần bản ghi gốc (N2/O2, lần đo trước...).
  const recsOk = recs.filter((r) => Number.isFinite(new Date(r.sample_date).getTime()));
  const series = recsOk.map((r) => {
    const gases = recordGases(r);
    return {
      date: new Date(r.sample_date).getTime(),
      gases,
      treated: r.xu_ly_dau === "loc_dau" || r.xu_ly_dau === "thay_dau",
      exceedCount: DGA.countExceedTypical(gases, r.equipment_type, logicOf(r)),
    };
  });
  const rows = DGA.buildFaultEvolution(series, { basis, pdThreshold });
  // Số thứ tự cố định theo bảng — dùng chung cho bảng, tooltip, dải mã, nhãn điểm Duval và phiếu đối chiếu.
  rows.forEach((r, i) => { r.seq = i + 1; });
  _trendFaultView = { rows, recs: recsOk };
  const scaleSel = $("tr_faultScale");
  if (scaleSel) {
    if (!scaleSel.dataset.restored) {
      scaleSel.dataset.restored = "1";
      try {
        const saved = localStorage.getItem(TREND_RATIO_SCALE_STORAGE_KEY);
        if (saved === "log" || saved === "linear") scaleSel.value = saved;
      } catch (e) { /* bị chặn lưu trữ — dùng mặc định (log) */ }
    }
    scaleSel.onchange = () => {
      try { localStorage.setItem(TREND_RATIO_SCALE_STORAGE_KEY, scaleSel.value); } catch (e) { /* bị chặn lưu trữ — bỏ qua */ }
      drawTrendFaultCharts();
    };
  }

  $("trFaultEmpty").classList.toggle("hidden", rows.length > 0);
  $("trFaultCharts").classList.toggle("hidden", rows.length === 0);
  renderTrendFaultTable(rows);
  drawTrendFaultCharts();
  if (_trendFaultCardSeq !== null && rows.some((r) => r.seq === _trendFaultCardSeq)) openTrendFaultCard(_trendFaultCardSeq);
  else closeTrendFaultCard();
}

/** Vẽ biểu đồ tỷ số + quỹ đạo Duval chỉ với các lần đo đang được tick ở bảng. */
function drawTrendFaultCharts() {
  if (_trendRatioChart) {
    _trendRatioChart.destroy();
    _trendRatioChart = null;
  }
  const view = _trendFaultView;
  if (!view) return;
  const shown = view.rows.filter((r) => !_trendFaultUnticked.has(trendFaultRowKey(r)));
  $("trFaultNoneTicked").classList.toggle("hidden", !(view.rows.length > 0 && shown.length === 0));
  renderTrendDuval(shown);
  const chartOk = typeof Chart !== "undefined";
  $("trRatioChart").parentElement.classList.toggle("hidden", !chartOk);
  if (shown.length > 0 && chartOk) renderTrendRatioChart(shown);
  syncTrendFaultTickAll();
}

/** Ô tick ở tiêu đề: tick hết / bỏ hết; trạng thái lưng chừng khi chỉ tick một phần. */
function syncTrendFaultTickAll() {
  const all = $("trFaultTickAll");
  const view = _trendFaultView;
  if (!all || !view) return;
  const n = view.rows.length;
  const ticked = view.rows.filter((r) => !_trendFaultUnticked.has(trendFaultRowKey(r))).length;
  all.checked = n > 0 && ticked === n;
  all.indeterminate = ticked > 0 && ticked < n;
}

function onTrendFaultTickChange(e) {
  const box = e.target;
  if (!box || !box.classList || !box.classList.contains("tr-fault-tick")) return;
  const key = box.dataset.key;
  if (box.checked) _trendFaultUnticked.delete(key);
  else _trendFaultUnticked.add(key);
  const tr = box.closest("tr");
  if (tr) tr.classList.toggle("unticked-row", !box.checked);
  drawTrendFaultCharts();
}

function onTrendFaultTickAllChange(e) {
  const view = _trendFaultView;
  if (!view) return;
  _trendFaultUnticked.clear();
  if (!e.target.checked) view.rows.forEach((r) => _trendFaultUnticked.add(trendFaultRowKey(r)));
  renderTrendFaultTable(view.rows);
  drawTrendFaultCharts();
}

function renderTrendFaultTable(rows) {
  let prevCode = null;
  const body = $("trFaultBody");
  body.onchange = onTrendFaultTickChange;
  // Bấm vào 1 dòng (trừ ô tick) → mở phiếu đối chiếu lần đo đó.
  body.onclick = (e) => {
    if (e.target.closest(".tr-fault-tick")) return;
    const tr = e.target.closest("tr[data-seq]");
    if (tr) openTrendFaultCard(Number(tr.dataset.seq));
  };
  if ($("trFaultTickAll")) $("trFaultTickAll").onchange = onTrendFaultTickAllChange;
  body.innerHTML = rows
    .map((r) => {
      // Đánh dấu lần đo mà mã Bảng 66 khác lần đo ĐỦ ĐIỀU KIỆN trước đó (khiếm khuyết đổi bản chất).
      const changed = Boolean(r.applicable && r.code && prevCode && r.code !== prevCode);
      if (r.applicable && r.code) prevCode = r.code;
      const date = r.prevDate ? `${trendFmtDate(r.prevDate)} → ${trendFmtDate(r.date)}` : trendFmtDate(r.date);
      const code = r.code
        ? `<span title="${escapeHtml(r.codeLabel || "")}">${changed ? "<strong>" + escapeHtml(r.code) + " (đổi)</strong>" : escapeHtml(r.code)}</span>`
        : "—";
      const key = trendFaultRowKey(r);
      const ticked = !_trendFaultUnticked.has(key);
      const cls = [r.applicable ? "" : "muted-row", ticked ? "" : "unticked-row", r.seq === _trendFaultCardSeq ? "selected-row" : ""].filter(Boolean).join(" ");
      const code9 = r.code9 ? `<span title="${escapeHtml(r.code9.label)}">${escapeHtml(r.code9.short)}</span>` : "—";
      return `<tr data-seq="${r.seq}" title="Bấm để mở phiếu đối chiếu"${cls ? ` class="${cls}"` : ""}>
        <td><input type="checkbox" class="tr-fault-tick" data-key="${escapeHtml(key)}"${ticked ? " checked" : ""}
          aria-label="Hiện lần đo #${r.seq} trên biểu đồ và tam giác Duval" /></td>
        <td>${r.seq}</td><td>${date}</td>
        <td>${trendRatioCellText(r.ratios.c2h2_c2h4)}</td><td>${trendRatioCellText(r.ratios.ch4_h2)}</td>
        <td>${trendRatioCellText(r.ratios.c2h4_c2h6)}</td>
        <td>${code9}</td><td>${code}</td><td>${r.duval ? escapeHtml(r.duval.zone) : "—"}</td>
        <td>${r.applicable ? "Đủ điều kiện" : "Tham khảo"}</td></tr>`;
    })
    .join("");
}

// Vạch ngang tại các mốc phần 9 dòng của Bảng 66 (0,1 – 1 – 3), ghi rõ mốc đó dùng cho tỷ số nào.
const TREND_RATIO_MARK_USES = { 0.1: "C2H2/C2H4 · CH4/H2", 1: "CH4/H2 · C2H4/C2H6", 3: "C2H2/C2H4 · C2H4/C2H6" };

const trendRatioMarksPlugin = {
  id: "trendRatioMarks",
  beforeDatasetsDraw(chart, _args, opts) {
    const s = chart.scales.yR;
    if (!s || !opts) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.font = '10px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    let lastLabelY = null;
    // Vẽ từ mốc lớn xuống mốc nhỏ; nhãn nào sát nhãn trước (thang tuyến tính: 0,1 sát 1) thì chỉ kẻ vạch.
    [...DGA.BANG66_CODE9_MARKS].sort((a, b) => b - a).forEach((v) => {
      const y = s.getPixelForValue(v);
      if (!(y >= chartArea.top && y <= chartArea.bottom)) return;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = opts.lineColor;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      if (lastLabelY !== null && Math.abs(y - lastLabelY) < 14) return;
      lastLabelY = y;
      const text = `${trendFmtRatio(v)} — ${TREND_RATIO_MARK_USES[v] || ""}`;
      const w = ctx.measureText(text).width + 6;
      ctx.setLineDash([]);
      ctx.fillStyle = opts.labelBg;
      ctx.fillRect(chartArea.left + 2, y - 13, w, 12);
      ctx.fillStyle = opts.textColor;
      ctx.fillText(text, chartArea.left + 5, y - 2);
    });
    ctx.restore();
  },
};

// Nhóm màu cho dải mã: mã IEC/Duval dùng thẳng màu vùng Duval (D54_ZONE_COLORS), "N" = bình thường.
function trendFamilyOfCode(code) {
  if (!code) return null;
  if (code === "D+T") return "DT";
  if (code.startsWith("D1/D2")) return "D12";
  return ["PD", "D1", "D2", "T1", "T2", "T3"].includes(code) ? code : null;
}

function trendFamilyColor(family, th) {
  if (family === "N") return th.dark ? "#4ade80" : "#16a34a";
  if (family && th.zone && th.zone[family]) return th.zone[family];
  return th.dark ? "#475569" : "#cbd5e1";
}

const TREND_CODE_LANES = [
  { label: "9 dòng", get: (r) => (r.code9 ? { text: r.code9.short, family: r.code9.family } : null) },
  { label: "IEC", get: (r) => (r.code ? { text: r.code, family: trendFamilyOfCode(r.code) } : null) },
  { label: "Duval", get: (r) => (r.duval ? { text: r.duval.zone, family: trendFamilyOfCode(r.duval.zone) } : null) },
];
const TREND_LANE_H = 18;
const TREND_LANE_GAP = 3;

// Dải mã dưới trục thời gian: mỗi lần đo 1 ô màu ghi mã, 3 làn (Bảng 66 phần 9 dòng / phần IEC / Duval).
const trendCodeStripPlugin = {
  id: "trendCodeStrip",
  afterDraw(chart, _args, opts) {
    const rows = opts && opts.rows;
    if (!rows || rows.length === 0) return;
    const { ctx, chartArea } = chart;
    const x = chart.scales.x;
    const th = opts.theme;
    const xs = rows.map((r) => x.getPixelForValue(r.date));
    const top0 = x.bottom + 8;
    ctx.save();
    ctx.font = '600 10px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = "middle";
    TREND_CODE_LANES.forEach((lane, li) => {
      const y = top0 + li * (TREND_LANE_H + TREND_LANE_GAP);
      ctx.textAlign = "right";
      ctx.fillStyle = th.muted;
      ctx.fillText(lane.label, chartArea.left - 6, y + TREND_LANE_H / 2);
      rows.forEach((r, k) => {
        const v = lane.get(r);
        const left = k > 0 ? xs[k] - xs[k - 1] : Infinity;
        const right = k < xs.length - 1 ? xs[k + 1] - xs[k] : Infinity;
        const half = Math.max(4, Math.min(48, (Math.min(left, right) - 3) / 2));
        // Không cho ô tràn ra ngoài vùng đồ thị (đè lên nhãn làn bên trái).
        const bx = Math.max(chartArea.left, xs[k] - half);
        const w = Math.max(4, Math.min(chartArea.right, xs[k] + half) - bx);
        const color = trendFamilyColor(v ? v.family : null, th);
        ctx.globalAlpha = r.applicable ? 1 : 0.45;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, y, w, TREND_LANE_H, 3);
        else ctx.rect(bx, y, w, TREND_LANE_H);
        ctx.fill();
        const text = v ? v.text : "—";
        if (ctx.measureText(text).width + 6 <= w) {
          ctx.fillStyle = trendLabelTextColor(color.startsWith("#") ? color : "#888888");
          ctx.textAlign = "center";
          ctx.fillText(text, bx + w / 2, y + TREND_LANE_H / 2 + 0.5);
        }
        ctx.globalAlpha = 1;
      });
    });
    ctx.restore();
  },
};

function trendRatioScaleMode() {
  const sel = $("tr_faultScale");
  return sel && sel.value === "linear" ? "linear" : "log";
}

/** Đồ thị 3 tỷ số trên CÙNG 1 trục tung (log 0,01–10 hoặc tuyến tính 0–10), vạch mốc 0,1 – 1 – 3, dải mã bên dưới. */
function renderTrendRatioChart(rows) {
  const theme = trendFaultTheme();
  const colors = TREND_COLORS[theme.dark ? "dark" : "light"];
  const surface = trendSurfaceColor();
  const mode = trendRatioScaleMode();
  const TOP = 10;
  const SHOWN_LOG_TICKS = [0.01, 0.1, 1, 3, 10];
  const isShownLogTick = (v) => SHOWN_LOG_TICKS.some((t) => Math.abs(v - t) < t * 1e-6);

  const datasets = TREND_RATIO_META.map((m, k) => {
    const color = colors[k];
    return {
      label: m.title,
      yAxisID: "yR",
      data: rows.filter((r) => r.ratios[m.key]).map((r) => {
        const p = r.ratios[m.key];
        const over = p.raw > TOP;
        // Thang log: tỷ số < 0,01 (kể cả 0) vẽ ▽ ở đáy. Thang tuyến tính: vẽ đúng giá trị (sát 0).
        const under = mode === "log" && p.censored;
        const y = over ? TOP : under ? DGA.RATIO_TREND_FLOOR : p.raw;
        return { x: r.date, y, raw: p.raw, mark: over ? "over" : under ? "under" : null, row: r };
      }),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      tension: 0,
      pointRadius: 4.5,
      pointHoverRadius: 6.5,
      pointBorderWidth: 1.5,
      pointBorderColor: color,
      pointStyle: (ctx) => (ctx.raw && ctx.raw.mark ? "triangle" : "circle"),
      pointRotation: (ctx) => (ctx.raw && ctx.raw.mark === "under" ? 180 : 0),
      pointBackgroundColor: (ctx) => (ctx.raw && ctx.raw.row.applicable ? color : surface),
    };
  });

  const yScale = mode === "log"
    ? {
      type: "logarithmic",
      min: 0.007,
      max: 13,
      ticks: { autoSkip: false, callback: (v) => (isShownLogTick(v) ? trendFmtRatio(v) : "") },
      grid: { color: (ctx) => (ctx.tick && isShownLogTick(ctx.tick.value) ? (theme.dark ? "rgba(148,163,184,0.22)" : "rgba(15,23,42,0.08)") : "transparent") },
    }
    : {
      type: "linear",
      min: 0,
      max: 10.5,
      ticks: { stepSize: 1, callback: (v) => (v <= TOP ? trendFmtRatio(v) : "") },
    };
  yScale.title = { display: true, text: mode === "log" ? "Tỷ số (thang log)" : "Tỷ số" };

  _trendRatioChart = new Chart($("trRatioChart").getContext("2d"), {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { bottom: TREND_CODE_LANES.length * (TREND_LANE_H + TREND_LANE_GAP) + 10 } },
      interaction: { mode: "nearest", axis: "x", intersect: false },
      onClick: (evt, _els, chart) => {
        const hit = chart.getElementsAtEventForMode(evt, "nearest", { axis: "x", intersect: false }, true)[0];
        if (!hit) return;
        const raw = chart.data.datasets[hit.datasetIndex].data[hit.index];
        if (raw && raw.row) openTrendFaultCard(raw.row.seq);
      },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 14 } },
        trendRatioMarks: { lineColor: theme.dark ? "rgba(148,163,184,0.6)" : "rgba(71,85,105,0.5)", textColor: theme.muted, labelBg: theme.dark ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.85)" },
        trendCodeStrip: { rows, theme },
        tooltip: {
          callbacks: {
            title: (items) => {
              if (!items.length) return "";
              const row = items[0].raw.row;
              return `#${row.seq} ` + (row.prevDate ? `Δ ${trendFmtDate(row.prevDate)} → ${trendFmtDate(row.date)}` : trendFmtDate(row.date));
            },
            label: (item) => `${item.dataset.label}: ${trendFmtRatio(item.raw.raw)}${item.raw.mark === "over" ? " (> 10)" : ""}`,
            afterBody: (items) => {
              if (!items.length) return [];
              const row = items[0].raw.row;
              return [
                `Bảng 66 (9 dòng): ${row.code9 ? row.code9.short : "—"}`,
                `Bảng 66 (IEC): ${row.code || "—"}`,
                `Duval: ${row.duval ? row.duval.zone : "—"}`,
                row.applicable ? "Đủ điều kiện chẩn đoán" : "Chỉ tham khảo (chưa khí nào vượt giá trị điển hình)",
                "Bấm để mở phiếu đối chiếu",
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          ticks: { callback: (val) => trendFmtDate(val) },
          title: { display: true, text: "Ngày lấy mẫu" },
        },
        yR: yScale,
      },
    },
    plugins: [trendRatioMarksPlugin, trendCodeStripPlugin],
  });
}

// ===================== Phiếu đối chiếu 1 lần đo với Điều 54 QĐ1901 =====================

// Bảng 68 Điều 54 QĐ1901 — các lỗi điển hình trong máy biến áp lực.
const QD1901_BANG68 = {
  PD: "Phóng điện xảy ra trong các khoang chứa khí do tẩm cách điện không hoàn toàn, độ ẩm cao trong giấy cách điện, dầu bão hòa quá mức hoặc do hiện tượng xâm thực, và dẫn đến sự hình thành X-wax.",
  D1: "Tia lửa hoặc hồ quang xảy ra do các kết nối kém giữa các phần có điện thế khác nhau hoặc bị hở mạch (không nối đất), giữa vòng chắn, lõi từ, các đĩa hoặc dây dẫn cuộn dây liền kề, mối hàn bị đứt hoặc các vòng kín trong lõi từ. Phóng điện giữa các phần ép chặt, giữa sứ và vỏ máy, giữa điện áp cao và đất bên trong cuộn dây, trên thành máy. Phóng dẫn trong các khối gỗ, keo dán thanh cách điện, thanh đệm cuộn dây. Phá vỡ dầu cách điện, dòng cắt khi chuyển nấc.",
  D2: "Hồ quang, đánh thủng điện, hoặc phóng dẫn có năng lượng cao, có thể kèm theo dòng điện tiếp tục chảy. Ngắn mạch giữa điện áp thấp và đất, đầu nối, cuộn dây, sứ và vỏ máy, thanh đồng và vỏ máy, cuộn dây và lõi, trong ống dẫn dầu, trong tháp đầu nối. Vòng kín giữa hai dây dẫn gần nhau quanh từ thông chính, bu-lông lõi được cách điện, vòng kim loại giữ lõi thép.",
  T1: "Quá tải máy biến áp trong các tình huống khẩn cấp. Vật cản làm cản trở dòng dầu chảy qua cuộn dây. Từ thông rò trong các thanh ép chặt của mạch từ.",
  T2: "Tiếp điểm lỗi giữa các mối nối bu-lông (đặc biệt là với thanh dẫn nhôm), tiếp điểm trượt, tiếp điểm trong bộ chuyển nấc (do hình thành carbon nhiệt phân), đầu nối từ cáp và thanh sứ. Dòng điện xoáy giữa các kẹp mạch từ và bu-lông, giữa bu-lông và lõi từ, trong dây nối đất, các mối hàn lỗi hoặc kẹp lỗi trong các lớp chắn từ. Cách điện bị mài mòn giữa các dây dẫn song song liền kề trong cuộn dây.",
  T3: "Dòng điện cảm ứng lớn trong máy và lõi từ. Dòng điện cảm ứng nhỏ trong thành máy do từ trường không được bù hợp lý. Ngắn mạch các liên kết trong lá tôn lõi thép.",
};

// Bảng 69 Điều 54 QĐ1901 — dạng hư hỏng theo khí thành phần cơ bản (khí chính).
const QD1901_BANG69 = [
  { gas: "C2H4", kind: "Quá nhiệt dẫn tới phân hủy dầu", text: "Tạo thành khí Ethylene, Methane cùng với lượng nhỏ hydrogen và Ethane. Khí chính: Ethylene." },
  { gas: "CO", kind: "Quá nhiệt dẫn tới phân hủy giấy cách điện", text: "Tạo thành khí carbon monoxide cùng với Methane và Ethylene do phân hủy dầu. Khí chính: Carbon monoxide." },
  { gas: "H2", kind: "Phóng điện với năng lượng thấp", text: "Tạo thành hydrogen và Methane cùng với một lượng nhỏ Ethane và Ethylene; có CO, CO2 nếu phóng điện qua giấy cách điện. Khí chính: Hydrogen." },
  { gas: "C2H2", kind: "Phóng hồ quang điện trong dầu", text: "Tạo thành lượng lớn hydrogen và acetylene cùng lượng đáng kể Methane và Ethylene; có CO, CO2 nếu hồ quang qua giấy cách điện. Khí chính: Acetylene." },
];

let _trendFaultCardSeq = null;

function openTrendFaultCard(seq) {
  _trendFaultCardSeq = seq;
  renderTrendFaultCard();
  document.querySelectorAll("#trFaultBody tr").forEach((tr) => tr.classList.toggle("selected-row", Number(tr.dataset.seq) === seq));
  const card = $("trFaultCard");
  if (card && !card.classList.contains("hidden") && typeof card.scrollIntoView === "function") {
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function closeTrendFaultCard() {
  _trendFaultCardSeq = null;
  const card = $("trFaultCard");
  if (card) card.classList.add("hidden");
  document.querySelectorAll("#trFaultBody tr.selected-row").forEach((tr) => tr.classList.remove("selected-row"));
}

/** Thước log 0,01–10 chia theo mốc 0,1 – 1 – 3 (phần 9 dòng Bảng 66), mũi chỉ vị trí tỷ số. */
function trendRatioRulerHtml(title, p) {
  const lo = Math.log10(0.01);
  const span = Math.log10(10) - lo;
  const pos = (v) => ((Math.log10(Math.min(10, Math.max(0.01, v))) - lo) / span) * 100;
  const segs = [[0.01, 0.1, "< 0,1"], [0.1, 1, "0,1–1"], [1, 3, "1–3"], [3, 10, "> 3"]];
  const segHtml = segs.map(([a, b, t]) => `<span class="ratio-seg" style="width:${(pos(b) - pos(a)).toFixed(2)}%">${t}</span>`).join("");
  const marker = p ? `<span class="ratio-marker" style="left:${pos(p.raw).toFixed(2)}%" title="${escapeHtml(trendFmtRatio(p.raw))}"></span>` : "";
  const value = p ? (p.raw < 0.01 ? "< 0,01" : trendFmtRatio(p.raw)) + (p.raw > 10 ? " (> 10)" : "") : "không tính (mẫu số = 0 hoặc giảm)";
  return `<div class="ratio-ruler"><div class="ratio-ruler-head"><strong>${escapeHtml(title)}</strong> = ${escapeHtml(value)}</div>
    <div class="ratio-track">${segHtml}${marker}</div></div>`;
}

function trendCheckCell(c) {
  if (c.ns) return `<td class="chk-ns" title="Không xét (NS)">NS</td>`;
  return `<td class="${c.ok ? "chk-ok" : "chk-no"}">${c.ok ? "✓ " : ""}${escapeHtml(c.text)}</td>`;
}

function renderTrendFaultCard() {
  const card = $("trFaultCard");
  const view = _trendFaultView;
  if (!card) return;
  const row = view && view.rows.find((r) => r.seq === _trendFaultCardSeq);
  if (!row) {
    card.classList.add("hidden");
    return;
  }
  const rec = view.recs[row.index];
  const prevRec = row.index > 0 ? view.recs[row.index - 1] : null;
  const gases = recordGases(rec);
  const type = rec.equipment_type;
  const logic = { equipmentType: type, manufacturer: rec.manufacturer, mbaSubtype: rec.mba_subtype ?? rec.mbaSubtype ?? null };
  const standard = DGA.resolveStandard(logic, toManufacturerStandardsForLogic(_allStandards));
  const isMba = type === DGA.EQUIPMENT_TYPES.MBA;
  const fmtPpm = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("vi-VN"));
  const raw = {
    c2h2_c2h4: row.ratios.c2h2_c2h4 ? row.ratios.c2h2_c2h4.raw : NaN,
    ch4_h2: row.ratios.ch4_h2 ? row.ratios.ch4_h2.raw : NaN,
    c2h4_c2h6: row.ratios.c2h4_c2h6 ? row.ratios.c2h4_c2h6.raw : NaN,
  };
  const basisNote = row.prevDate
    ? `Tỷ số tính trên <strong>phần tăng (Δ)</strong> từ ${trendFmtDate(row.prevDate)} đến ${trendFmtDate(row.date)}; các bước kiểm tra nồng độ dưới đây dùng giá trị đo ngày ${trendFmtDate(row.date)}.`
    : "Tỷ số tính trên giá trị đo.";

  // (1) Bảng 64 — giá trị điển hình
  const typical = DGA.typicalReferenceStandard(type, logic);
  const exceed = DGA.GASES.filter((g) => typical[g] !== null && typical[g] !== undefined && Number(gases[g]) > typical[g]);
  const step1 = exceed.length
    ? `Vượt giá trị điển hình: ${exceed.map((g) => `<strong>${g}</strong> ${fmtPpm(gases[g])} ppm (&gt; ${fmtPpm(typical[g])})`).join(", ")}. Tỷ số khí đủ điều kiện chẩn đoán.`
    : DGA.gasesBelowTypicalLow(gases, type)
      ? "Tất cả khí thấp hơn khoảng điển hình — kiểm tra lỗi lấy mẫu, đo lường hoặc do xử lý dầu gần đây; tiếp tục theo dõi định kỳ. Tỷ số chỉ để tham khảo."
      : "Tất cả khí trong khoảng điển hình — chưa có dấu hiệu bất thường; tỷ số chỉ để tham khảo.";

  // (2) Bảng 65 — tốc độ tăng so với lần đo trước
  let step2 = "Chưa có lần đo trước để tính tốc độ tăng.";
  if (prevRec) {
    const days = (new Date(rec.sample_date) - new Date(prevRec.sample_date)) / 86400000;
    const rates = DGA.computeRateOfChange(recordGases(prevRec), gases, days, standard.rate, type);
    if (rates) {
      const high = rates.filter((x) => x.ratePerYear > x.rangeHi);
      step2 = high.length
        ? `So với ${trendFmtDate(new Date(prevRec.sample_date).getTime())}: vượt cận trên tốc độ tăng điển hình — ${high.map((x) => `<strong>${x.gas}</strong> ${trendFmtRatio(x.ratePerYear)} ppm/năm (&gt; ${fmtPpm(x.rangeHi)})`).join(", ")}.`
        : `So với ${trendFmtDate(new Date(prevRec.sample_date).getTime())}: không khí nào vượt cận trên tốc độ tăng điển hình.`;
    }
  }

  // (3) Nhiễm khí từ OLTC
  const oltc = DGA.oltcContaminationCheck(gases);
  const step3 = oltc.ratio === null
    ? "Không tính được C2H2/H2 (H2 = 0)."
    : `C2H2/H2 = ${trendFmtRatio(oltc.ratio)} — ${oltc.level === "likely" ? "<strong>nghi ngờ rõ nhiễm khí từ OLTC</strong> (&gt; 3): lấy mẫu khoang OLTC để so sánh, trừ khí nền" : oltc.level === "possible" ? "<strong>có thể nhiễm khí từ OLTC</strong> (2–3): lấy mẫu khoang OLTC để so sánh" : "không nghi nhiễm khí từ OLTC (≤ 2)"}.`;

  // (4) Bảng 66 — 2 phần + bảng sơ bộ
  const c9 = DGA.diagnoseBang66Code9(raw);
  const iec = DGA.bang66IecCells(raw, standard.pdThreshold);
  const table9 = c9
    ? `<div class="table-scroll"><table class="fault-check-table"><thead><tr><th>STT</th><th>Dạng khiếm khuyết dự đoán</th><th>C2H2/C2H4</th><th>CH4/H2</th><th>C2H4/C2H6</th><th>Ví dụ điển hình</th></tr></thead><tbody>
      ${c9.rows.map((r) => `<tr class="${r.match ? "match-row" : ""}"><td>${r.id}</td><td>${escapeHtml(r.label)}${r.match ? " <strong>← khớp</strong>" : ""}</td>${trendCheckCell(r.cells.g)}${trendCheckCell(r.cells.h)}${trendCheckCell(r.cells.i)}<td class="example-cell">${escapeHtml(r.example)}</td></tr>`).join("")}
      </tbody></table></div>${c9.match ? "" : '<p class="note">Không khớp dòng nào của phần 9 dòng.</p>'}`
    : '<p class="note">Thiếu tỷ số — không tra được.</p>';
  const iecMatch = iec ? iec.filter((r) => r.match) : [];
  const simplified = iec && iecMatch.length === 0 ? DGA.diagnoseSimplifiedPDT(raw) : null;
  const tableIec = iec
    ? `<div class="table-scroll"><table class="fault-check-table"><thead><tr><th>Mã</th><th>Sự cố đặc trưng</th><th>C2H2/C2H4</th><th>CH4/H2</th><th>C2H4/C2H6</th></tr></thead><tbody>
      ${iec.map((r) => `<tr class="${r.match ? "match-row" : ""}"><td><strong>${r.code}</strong></td><td>${escapeHtml(r.label)}${r.match ? " <strong>← khớp</strong>" : ""}</td>${trendCheckCell(r.cells.g)}${trendCheckCell(r.cells.h)}${trendCheckCell(r.cells.i)}</tr>`).join("")}
      </tbody></table></div>
      ${iecMatch.length ? "" : `<p class="note">Không khớp mã nào — theo Điều 54 dùng bảng sơ bộ: <strong>${escapeHtml(simplified ? simplified.label || simplified.text : "không xác định")}</strong>.</p>`}`
    : "";

  // (5) Duval
  const duv = row.duval;
  const step5 = duv
    ? `Vùng <strong>${escapeHtml(duv.zone)}</strong> — CH4 ${duv.pctCH4.toFixed(0)}%, C2H4 ${duv.pctC2H4.toFixed(0)}%, C2H2 ${duv.pctC2H2.toFixed(0)}% (Bảng 67).`
    : "Không tính được (CH4 + C2H4 + C2H2 = 0 hoặc phần tăng âm).";

  // (6) Tỷ lệ bổ sung
  const add = DGA.diagnoseAdditionalRatios(gases, rec.n2 ?? rec.N2 ?? null, rec.o2 ?? rec.O2 ?? null);
  const step6 = `CO2/CO = ${add.co2_co === null ? "—" : trendFmtRatio(add.co2_co)}: ${escapeHtml(add.co2coNote)}<br>O2/N2 = ${add.o2_n2 === null ? "—" : trendFmtRatio(add.o2_n2)}: ${escapeHtml(add.o2n2Note)}`;

  // (7) Bảng 68 — lỗi điển hình theo mã tìm được (ưu tiên mã IEC, không có thì theo Duval)
  const code68 = (iecMatch[0] && iecMatch[0].code) || (duv && QD1901_BANG68[duv.zone] ? duv.zone : null);
  const step7 = code68
    ? `<strong>${code68}</strong>${iecMatch[0] ? " (Bảng 66)" : " (Duval)"}: ${escapeHtml(QD1901_BANG68[code68])}`
    : "Chưa xác định được mã PD/D1/D2/T1/T2/T3 để tra.";

  // (8) Bảng 69 — gợi ý theo khí vượt điển hình nhiều nhất (tỷ lệ giá trị đo / cận trên Bảng 64)
  const factor = (g) => (typical[g] ? Number(gases[g]) / typical[g] : 0);
  const top69 = QD1901_BANG69.filter((r) => factor(r.gas) > 1).sort((a, b) => factor(b.gas) - factor(a.gas))[0] || null;
  const step8 = `<ul class="bang69-list">${QD1901_BANG69.map((r) => `<li class="${top69 && r.gas === top69.gas ? "match-row" : ""}"><strong>${escapeHtml(r.kind)}</strong> — ${escapeHtml(r.text)}${top69 && r.gas === top69.gas ? ` <em>← gợi ý: ${r.gas} vượt điển hình nhiều nhất (${trendFmtRatio(factor(r.gas))} lần)</em>` : ""}</li>`).join("")}</ul>`;

  const steps = [
    [`Giá trị điển hình (${isMba ? "Bảng 64" : "giá trị điển hình áp dụng cho loại thiết bị"})`, step1],
    ["Tốc độ tăng hàm lượng khí (Bảng 65)", step2],
    ["Kiểm tra nhiễm khí từ OLTC (C2H2/H2)", step3],
    ["Tam giác Duval 1 (Biểu đồ 3)", step5],
    ["Tỷ lệ bổ sung (CO2/CO, O2/N2)", step6],
    ["Lỗi điển hình (Bảng 68)", step7],
    ["Dạng hư hỏng theo khí chính (Bảng 69, gợi ý)", step8],
  ];

  card.innerHTML = `
    <div class="fault-card-head">
      <h3>Phiếu đối chiếu lần đo #${row.seq} — ${trendFmtDate(row.date)}${row.applicable ? "" : ' <span class="badge-muted">tham khảo</span>'}</h3>
      <button type="button" class="btn sm ghost" id="trFaultCardClose">Đóng</button>
    </div>
    <p class="note">${basisNote} Khí (ppm): ${DGA.GASES.map((g) => `${g} ${fmtPpm(gases[g])}`).join(" · ")}.</p>
    <div class="ratio-rulers">
      ${trendRatioRulerHtml("C2H2/C2H4", row.ratios.c2h2_c2h4)}
      ${trendRatioRulerHtml("CH4/H2", row.ratios.ch4_h2)}
      ${trendRatioRulerHtml("C2H4/C2H6", row.ratios.c2h4_c2h6)}
    </div>
    <h4>Bảng 66 — phần 9 dòng (mốc 0,1 – 1 – 3)</h4>
    ${table9}
    <h4>Bảng 66 — phần PD/D1/D2/T1/T2/T3 (Table 1 IEC 60599)</h4>
    ${tableIec}
    <h4>Các bước khác của Điều 54</h4>
    <ol class="dieu54-steps">${steps.map(([t, b]) => `<li><strong>${t}:</strong> ${b}</li>`).join("")}</ol>
    <p class="note">Ô xanh ✓ = tỷ số nằm trong khoảng của ô; ô xám = không nằm trong; NS = không xét. Quy ước biên phần 9 dòng:
      cận dưới tính vào, cận trên không tính. Phiếu chỉ hỗ trợ đối chiếu — kết luận theo đánh giá tổng hợp (Điều 3 QĐ1901).</p>`;
  card.classList.remove("hidden");
  $("trFaultCardClose").onclick = closeTrendFaultCard;
}

function trendSvg(tag, attrs, text) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, String(v)));
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Chú giải ý nghĩa mã khiếm khuyết (dùng chung cho cột Bảng 66 và vùng Duval), ô màu theo màu vùng Duval. */
function renderTrendFaultCodeLegend(th) {
  const box = $("trFaultCodeLegend");
  if (!box) return;
  box.innerHTML = TREND_FAULT_CODE_NOTES.map((n) => {
    const color = th.zone ? th.zone[n.key] : "transparent";
    return `<li><span class="fault-code-swatch" style="background:${escapeHtml(color)}"></span><strong>${escapeHtml(n.code)}</strong> — ${escapeHtml(n.text)}</li>`;
  }).join("") + '<li><span class="fault-code-swatch"></span><strong>Ngoài bảng</strong> — (chỉ cột Bảng 66) tổ hợp 3 tỷ số không khớp mã nào của Bảng 66; xem vùng Duval.</li>';
}

/** Tam giác Duval 1 phẳng (2D) + quỹ đạo các lần đo theo thời gian. Vùng lấy từ d54DuvalZones() (Bảng 67 hiện hành). */
function renderTrendDuval(rows) {
  const svg = $("trDuvalSvg");
  if (!svg) return;
  svg.replaceChildren();
  const th = trendFaultTheme();
  renderTrendFaultCodeLegend(th);
  const surface = trendSurfaceColor();
  const H = 50 * Math.sqrt(3);
  // (a = %C2H2, e = %C2H4) -> tọa độ SVG (y hướng xuống). Đỉnh CH4 trên, C2H2 dưới-trái, C2H4 dưới-phải.
  const P = (a, e) => {
    const { x, y } = DGA.duvalPlotXY({ pctCH4: 100 - a - e, pctC2H4: e, pctC2H2: a });
    return [x, H - y];
  };
  svg.setAttribute("viewBox", `-12 -10 124 ${H + 22}`);
  svg.setAttribute("font-family", 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif');

  if (typeof d54DuvalZones === "function" && th.zone) {
    d54DuvalZones().forEach((z) => {
      const color = th.zone[z.key];
      const pts = z.poly.map(([a, e]) => P(a, e).map((n) => n.toFixed(2)).join(",")).join(" ");
      svg.appendChild(trendSvg("polygon", { points: pts, fill: color, "fill-opacity": 0.3, stroke: color, "stroke-opacity": 0.7, "stroke-width": 0.3 }));
      const [la, le] = z.label || [1, 1];
      // PD: vùng rất nhỏ sát đỉnh CH4 — ghi nhãn lệch sang phải đỉnh.
      const [lx, ly] = z.label ? P(la, le) : [P(0, 0)[0] + 3, P(0, 0)[1] + 2];
      svg.appendChild(trendSvg("text", { x: lx, y: ly, "font-size": 4, "font-weight": 700, fill: th.text, "fill-opacity": 0.75, "text-anchor": z.label ? "middle" : "start", "dominant-baseline": "middle" }, z.code));
    });
  }
  const cCH4 = P(0, 0), cC2H4 = P(0, 100), cC2H2 = P(100, 0);
  svg.appendChild(trendSvg("polygon", { points: [cCH4, cC2H4, cC2H2].map((p) => p.join(",")).join(" "), fill: "none", stroke: th.muted, "stroke-width": 0.4 }));
  const corner = (p, text, dx, dy, anchor) => svg.appendChild(trendSvg("text", { x: p[0] + dx, y: p[1] + dy, "font-size": 4, "font-weight": 600, fill: th.text, "text-anchor": anchor }, text));
  corner(cCH4, "CH4", 0, -3, "middle");
  corner(cC2H2, "C2H2", -1, 6, "start");
  corner(cC2H4, "C2H4", 1, 6, "end");

  const pts = rows.filter((r) => r.duval).map((r) => ({ r, n: r.seq }));
  if (pts.length === 0) return;
  const xy = (p) => P(p.r.duval.pctC2H2, p.r.duval.pctC2H4);
  if (pts.length > 1) {
    svg.appendChild(trendSvg("polyline", {
      points: pts.map((p) => xy(p).map((n) => n.toFixed(2)).join(",")).join(" "),
      fill: "none", stroke: th.text, "stroke-opacity": 0.6, "stroke-width": 0.5, "stroke-linejoin": "round",
    }));
  }
  const showAllNumbers = pts.length <= 15;
  pts.forEach((p, k) => {
    const [x, y] = xy(p);
    const last = k === pts.length - 1;
    const g = trendSvg("g", {});
    g.appendChild(trendSvg("title", {}, `#${p.n} ${p.r.prevDate ? "Δ " + trendFmtDate(p.r.prevDate) + " → " : ""}${trendFmtDate(p.r.date)} — Duval ${p.r.duval.zone}` +
      ` (CH4 ${p.r.duval.pctCH4.toFixed(0)}%, C2H4 ${p.r.duval.pctC2H4.toFixed(0)}%, C2H2 ${p.r.duval.pctC2H2.toFixed(0)}%)${p.r.applicable ? "" : " — tham khảo"}`));
    g.appendChild(trendSvg("circle", {
      cx: x, cy: y, r: last ? 2.2 : 1.5,
      fill: p.r.applicable ? th.point : surface, stroke: last ? th.text : th.point, "stroke-width": last ? 0.8 : 0.5,
    }));
    if (showAllNumbers || k === 0 || last) {
      g.appendChild(trendSvg("text", { x: x + 2.4, y: y - 1.6, "font-size": 3.4, "font-weight": last ? 700 : 500, fill: th.text }, String(p.n)));
    }
    svg.appendChild(g);
  });
}

function destroyTrendChart() {
  if (_trendChart) {
    _trendChart.destroy();
    _trendChart = null;
  }
}

const TREND_AXIS_DEFS = Object.assign({
  yGas: { title: "Nồng độ khí (ppm)", position: "left" },
  yTgd: { title: "tgδ 90°C (%)", position: "left" },
  yMoisture: { title: "Độ ẩm dầu (ppm)", position: "right" },
  yBdv: { title: "Điện áp chọc thủng (kV)", position: "right" },
  yBang63: { title: "Tổng hàm lượng khí hòa tan (%)", position: "right" },
}, ...TREND_OIL_EXT_DEFS().map((d) => ({ ["yOil_" + d.key]: { title: d.label + (d.unit ? ` (${d.unit})` : ""), position: "right" } })));

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
  _trendLastArgs = [gasRecords, oilRecords, oltcRecords];
  // Phần diễn biến loại khiếm khuyết (Bảng 66/Duval) — độc lập với thông số đang tick, không cần Chart.js cho bảng.
  renderTrendFaultEvolution(gasRecords);
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
  _trendSelected = null;
  // Dòng hướng dẫn nhãn/chạm chọn đường chỉ hiện khi đồ thị thực sự được vẽ (bật lại ngay trước new Chart).
  $("trChartHint")?.classList.add("hidden");

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
          short: trendPhaseShort(def.short, p),
          axis: def.axis,
          points: trendPoints(recs, (r) => gasValueOf(r, def.field)),
          gasField,
          gasLabel: def.label,
          sinceDate: DGA.lastOilTreatmentDate(recs),
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
        seriesSpecs.push({ label: `${def.label} (${def.unit})`, short: def.short, axis: def.axis, points: trungtinhPoints });
      }
      tickedPhases.forEach((p) => {
        const recs = oltcRecords.filter((r) => r.oltc_sample_point === "pharieng" && (r.phase || "").trim() === p);
        const points = trendPoints(recs, (r) => r[def.field]);
        if (points.length > 0) {
          seriesSpecs.push({ label: `${def.label} - ${DGA.phaLabelWithPrefix(p)} (${def.unit})`, short: trendPhaseShort(def.short, p), axis: def.axis, points });
        }
      });
      return;
    }

    // Không tách theo pha (thiết bị không có ≥2 pha, hoặc là dầu MBA chính — không có
    // khái niệm pha): gộp toàn bộ bản ghi của nguồn dữ liệu này thành 1 đường như trước.
    const valueOf = source === "gas" ? (r) => gasValueOf(r, def.field) : (r) => r[def.field];
    seriesSpecs.push({
      label: `${def.label} (${def.unit})`,
      short: def.short,
      axis: def.axis,
      points: trendPoints(recordsBySource[source], valueOf),
      gasField,
      gasLabel: def.label,
      sinceDate: source === "gas" ? DGA.lastOilTreatmentDate(gasRecords) : null,
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

  const datasets = seriesSpecs.map((spec) => {
    const { color, pointStyle } = trendSeriesStyle(spec.label);
    return {
      label: spec.label,
      shortLabel: spec.short || spec.label,
      seriesKey: spec.label,
      trendColor: color,
      data: spec.points,
      borderColor: color,
      backgroundColor: color,
      pointBorderColor: trendPointColor,
      pointBackgroundColor: trendPointColor,
      pointStyle,
      borderWidth: 2,
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
      // Đã xác nhận lọc/thay dầu: chỉ dự báo trên số liệu từ lần xử lý dầu gần nhất (spec.sinceDate).
      const forecast = DGA.forecastGasTrend(history, forecastYears, limit, { sinceDate: spec.sinceDate });
      forecastRows.push({ label: spec.label, gasLabel: spec.gasLabel, forecast });
      // Chỉ vẽ 1 đường nét đứt trên đồ thị cho mỗi khí — dùng đường Sen (bền với lần đo bất
      // thường, đi cùng kiểm định Mann–Kendall), thiếu thì OLS — từ giá trị của mô hình tại lần
      // đo gần nhất tới giá trị dự báo (đã cắt tại 0). Chi tiết từng phương pháp, khoảng dự báo
      // và p-value xem ở bảng "Dự báo xu hướng" (renderTrendForecastTable()).
      const rep = forecast.ok ? (forecast.methods.sen || forecast.methods.ols) : null;
      if (!rep) return;
      const lastPoint = spec.points[spec.points.length - 1];
      const { color } = trendSeriesStyle(spec.label);
      datasets.push({
        label: `${spec.label} — dự báo (${rep === forecast.methods.sen ? "Sen" : "OLS"})`,
        shortLabel: `${spec.short || spec.label} (dự báo)`,
        seriesKey: spec.label,
        trendColor: color,
        isForecast: true,
        data: [
          { x: lastPoint.x, y: rep.fittedAtLast },
          { x: new Date(rep.forecastDate).getTime(), y: rep.forecastValue },
        ],
        borderColor: color,
        backgroundColor: color,
        pointBorderColor: trendPointColor,
        pointBackgroundColor: trendPointColor,
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
      // Mọi thông số vẽ ở tab này (nồng độ khí ppm, chỉ tiêu dầu) đều không âm — cố định trục từ 0
      // để Chart.js không tự mở rộng xuống giá trị âm vô nghĩa.
      min: 0,
      position: cfg.position,
      title: { display: true, text: cfg.title },
      grid: { drawOnChartArea: firstAxis },
    };
    firstAxis = false;
  });

  $("trChartHint")?.classList.remove("hidden");
  _trendChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      // Chừa chỗ bên phải cho nhãn ký hiệu ở cuối đường (trendLineLabelsPlugin).
      layout: { padding: { right: TREND_LABEL_PAD_RIGHT } },
      onClick: (evt, _els, chart) => onTrendChartClick(evt, chart),
      plugins: {
        legend: {
          position: "bottom",
          // Ẩn đường đang được chọn qua chú giải → bỏ chọn (để các đường khác không bị làm mờ).
          onClick(evt, item, legend) {
            Chart.defaults.plugins.legend.onClick.call(this, evt, item, legend);
            const chart = legend.chart;
            if (_trendSelected && !chart.isDatasetVisible(_trendSelected.datasetIndex)) setTrendSelection(chart, null);
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => (items.length ? new Date(items[0].parsed.x).toLocaleDateString("vi-VN") : ""),
          },
        },
      },
      scales,
    },
    plugins: [trendLineLabelsPlugin],
  });
}

/** Render 1 dòng <tr> cho 1 PHƯƠNG PHÁP dự báo của 1 khí. gasCellHtml=null nghĩa là dòng này không
 *  mở đầu 1 khí mới (cột "Khí" gộp bằng rowspan từ dòng đầu). */
function trendForecastMethodRowHtml(method, key, { gasCellHtml, recentWindow = null }) {
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("vi-VN");
  const fmtP = (p) => (p < 0.001 ? "< 0,001" : "= " + p.toFixed(3).replace(".", ","));
  const num = (v, d = 2) => v.toFixed(d).replace(".", ",");
  const rateText = `${method.ratePerYear >= 0 ? "+" : ""}${num(method.ratePerYear)} ppm/năm`;
  let forecastText = `${num(method.forecastValue, 1)} ppm${method.clamped ? " (cắt tại 0)" : ""}`;
  if (key === "ols" && method.interval) {
    forecastText += `<br /><span class="note">KDB 95%: ${num(method.interval.lower, 1)} – ${num(method.interval.upper, 1)} ppm</span>`;
  }
  let statHtml;
  if (key === "ols") {
    statHtml = `R² = ${num(method.r2, 3)}` + (method.pValue === null ? "" : `<br />p (độ dốc) ${fmtP(method.pValue)}`);
  } else if (key === "latest") {
    statHtml = `<span class="note">Không kiểm định (2 điểm) — đối chiếu Bảng 65</span>`;
  } else {
    statHtml = method.pValue === null ? "Mann–Kendall: cần ≥ 4 lần đo" : `Mann–Kendall p ${fmtP(method.pValue)}`;
    if (method.interval) statHtml += `<br /><span class="note">KTC 95% tốc độ: ${num(method.interval.lower)} – ${num(method.interval.upper)} ppm/năm</span>`;
  }
  if (method.significant === true) statHtml += ` <span class="pill ok">có ý nghĩa</span>`;
  else if (method.significant === false) statHtml += ` <span class="pill muted">chưa có ý nghĩa</span>`;
  return `<tr>
    ${gasCellHtml !== null ? gasCellHtml : ""}
    <td>${escapeHtml(method.label)}${key === "recent" && recentWindow
    ? `<br /><span class="note">${recentWindow.n} lần đo từ ${fmtDate(recentWindow.fromDate)}</span>` : ""}</td>
    <td>${rateText}</td>
    <td>${forecastText}</td>
    <td>${statHtml}</td>
  </tr>`;
}

/** Vẽ bảng "Dự báo xu hướng" (#trForecastBody): mỗi khí chính đang chọn chiếm tối đa 4 dòng (OLS, Sen +
 *  Mann–Kendall toàn chuỗi, Sen + Mann–Kendall giai đoạn gần đây, tốc độ 2 lần đo gần nhất — xem
 *  forecastGasTrend() ở dga-logic-forecast.js). Cột "Khí" gộp rowspan, kèm giá trị gần nhất, ngưỡng, kết luận xu hướng
 *  Mann–Kendall và so sánh tốc độ giai đoạn gần với toàn chuỗi. Ẩn khối khi không có dòng. */
function renderTrendForecastTable(forecastRows, forecastYears) {
  const wrap = $("trForecastWrap");
  if (!wrap) return;
  if (!forecastRows || forecastRows.length === 0) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  $("trForecastYearsLabel").textContent = forecastYears;

  const trendText = {
    increasing: '<span class="pill bad">Xu hướng TĂNG (Mann–Kendall, p &lt; 0,05)</span>',
    decreasing: '<span class="pill ok">Xu hướng GIẢM (Mann–Kendall, p &lt; 0,05)</span>',
    none: '<span class="pill muted">Chưa phát hiện xu hướng có ý nghĩa thống kê</span>',
    insufficient: '<span class="pill muted">Chưa đủ lần đo để kiểm định xu hướng (cần ≥ 4)</span>',
  };
  const rateChangeText = {
    faster: '<span class="pill bad">Giai đoạn gần tăng NHANH hơn toàn chuỗi (ngoài KTC 95%)</span>',
    slower: '<span class="pill ok">Giai đoạn gần tăng CHẬM hơn toàn chuỗi (ngoài KTC 95%)</span>',
    consistent: '<span class="pill muted">Tốc độ giai đoạn gần phù hợp toàn chuỗi</span>',
  };
  const fmtDate = (iso) => new Date(iso).toLocaleDateString("vi-VN");
  // Dấu thập phân kiểu Việt Nam (23,649 — không phải 23.649, dễ đọc thành hai mươi ba nghìn).
  const fmtPpm = (v) => Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
  const sinceNote = (f) => (f.sinceDate
    ? `<br /><span class="pill warn" style="margin-top:4px;">Từ ${fmtDate(f.sinceDate)} (sau lọc/thay dầu)` +
      `${f.nBefore ? ` — bỏ ${f.nBefore} lần đo trước` : ""}</span>`
    : "");
  // Cảnh báo vượt giá trị điển hình — CHỈ khi xu hướng tăng có ý nghĩa thống kê và mốc nằm trong số năm dự báo
  // đã chọn (xem DGA.forecastLimitWarning()); thay cho cột "Dự kiến đạt ngưỡng" cũ (mốc ngoại suy xa hàng chục năm
  // không dùng được để ra quyết định).
  const limitWarningHtml = (w) => {
    if (!w) return "";
    if (w.status === "exceeded") {
      return '<br /><span class="pill bad">Lần đo gần nhất đã vượt giá trị điển hình</span>';
    }
    const d = new Date(w.date);
    const when = String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
    const p = w.pValue < 0.001 ? "p < 0,001" : "p = " + w.pValue.toFixed(3).replace(".", ",");
    return `<br /><span class="pill bad">⚠ Có thể vượt giá trị điển hình ~${when} (${w.method === "sen" ? "Sen" : "OLS"}, ${p})` +
      " — xem xét tăng cường theo dõi</span>";
  };
  const rowsHtml = forecastRows.map(({ label, forecast }) => {
    if (!forecast.ok) {
      const reasonText = forecast.reason === "not_enough_data"
        ? `Chưa đủ dữ liệu (cần ≥ 2 lần đo${forecast.sinceDate ? " sau lần lọc/thay dầu" : ""}, hiện có ${forecast.n})`
        : "Không tính được (các lần đo cùng 1 ngày)";
      return `<tr><td>${escapeHtml(label)}${sinceNote(forecast)}</td><td colspan="4" class="pill muted">${reasonText}</td></tr>`;
    }
    const keys = ["ols", "sen", "recent", "latest"].filter((k) => forecast.methods[k]);
    const gasHeaderCell = `<td rowspan="${keys.length}">${escapeHtml(label)}<br /><span class="pill muted" ` +
      `style="margin-top:4px;">Gần nhất: ${fmtPpm(forecast.lastValue)} ppm • Ngưỡng: ${forecast.limit === null ? "—" : fmtPpm(forecast.limit) + " ppm"}</span>` +
      sinceNote(forecast) +
      `<br />${trendText[forecast.trend.direction]}` +
      (forecast.rateChange ? `<br />${rateChangeText[forecast.rateChange]}` : "") +
      limitWarningHtml(DGA.forecastLimitWarning(forecast)) + "</td>";
    return keys.map((key, i) => trendForecastMethodRowHtml(forecast.methods[key], key, {
      gasCellHtml: i === 0 ? gasHeaderCell : null,
      recentWindow: forecast.recentWindow,
    })).join("");
  }).join("");

  $("trForecastBody").innerHTML = rowsHtml;
}

// ---------------------------------------------------------------------------
// Lọc / thay dầu: lần đo có khí giảm đột ngột so với lần liền trước (DGA.findGasDrops()) được hỏi xác
// nhận; kết quả lưu ở trường xu_ly_dau của CHÍNH lần đo đó ("loc_dau" | "thay_dau" | "khong"). Dự báo
// xu hướng chỉ dùng số liệu từ lần xử lý dầu gần nhất (DGA.lastOilTreatmentDate()). Dùng chung cho tab
// Xu hướng (renderTrendOilTreatment()) và khối kết quả tab DGA sau khi lưu (ui-dga.js).
// ---------------------------------------------------------------------------

/** HTML khối hỏi xác nhận cho 1 lần đo giảm đột ngột. phaseLabel: "" nếu thiết bị chỉ có 1 pha. */
function oilTreatmentPromptHtml(item, phaseLabel) {
  const fmtDate = (d) => new Date(d).toLocaleDateString("vi-VN");
  const num = (v) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  const d = item.drop;
  const buttons = canEditRecord(item.record)
    ? ["loc_dau", "thay_dau", "khong"].map((v) =>
      `<button type="button" class="btn sm ${v === "khong" ? "ghost" : "primary"}" data-oil-treat-id="${escapeHtml(item.record.id)}" ` +
      `data-oil-treat-value="${v}">${v === "khong" ? "Không xử lý dầu" : "Đã " + DGA.OIL_TREATMENT_LABELS[v].toLowerCase()}</button>`).join(" ")
    : `<span class="note">Chỉ Admin hoặc người đã nhập lần đo này mới xác nhận được.</span>`;
  return `<div class="status-banner status-alert" style="margin-bottom:12px;">
    <strong>Khí giảm đột ngột</strong> — lần đo ${fmtDate(item.record.sample_date)}${phaseLabel ? " (" + escapeHtml(phaseLabel) + ")" : ""}:
    tổng khí cháy TDCG giảm ${num(d.dropPct)}% so với lần đo ${fmtDate(item.prev.sample_date)}
    (${num(d.prevTdcg)} → ${num(d.tdcg)} ppm; ${d.gases.join(", ")} cùng giảm ≥ 50%).
    <br />Giữa 2 lần đo này có <strong>lọc dầu</strong> hoặc <strong>thay dầu</strong> không? Nếu có, dự báo xu hướng sẽ chỉ
    dùng số liệu từ lần đo này trở đi.
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">${buttons}</div>
  </div>`;
}

/** Gắn sự kiện cho các nút [data-oil-treat-id] trong container. */
function bindOilTreatmentButtons(container) {
  container.querySelectorAll("button[data-oil-treat-id]").forEach((btn) => {
    btn.addEventListener("click", () => setOilTreatment(btn.dataset.oilTreatId, btn.dataset.oilTreatValue, btn));
  });
}

/** Lưu xu_ly_dau cho 1 lần đo (upsert nguyên bản ghi — quyền sửa kiểm lại ở máy chủ), rồi vẽ lại. */
async function setOilTreatment(id, value, btn) {
  const rec = _allMeasurements.find((r) => r.id === id);
  if (!rec) return;
  if (btn) btn.disabled = true;
  try {
    await Storage.addMeasurement({ ...rec, xu_ly_dau: value });
    await refreshHistoryUI();
    const dgaPrompt = $("dgaOilTreatPrompt");
    if (dgaPrompt) { dgaPrompt.innerHTML = ""; dgaPrompt.classList.add("hidden"); }
    if ($("tr_device") && $("tr_device").value) onTrendDeviceChange();
    let msg = "Đã bỏ xác nhận xử lý dầu của lần đo này.";
    if (value === "khong") msg = "Đã ghi nhận: không xử lý dầu — chuỗi số liệu giữ nguyên.";
    else if (DGA.OIL_TREATMENT_LABELS[value]) {
      msg = `Đã ghi nhận: ${DGA.OIL_TREATMENT_LABELS[value].toLowerCase()} — dự báo dùng số liệu từ lần đo này.`;
    }
    showToast(msg);
  } catch (err) {
    if (btn) btn.disabled = false;
    notifyError("Không lưu được xác nhận xử lý dầu: " + storageErrorMessage(err));
  }
}

/** Nhóm bản ghi khí theo pha ("" = không ghi pha). */
function trendGasRecordsByPhase(gasRecords) {
  const groups = new Map();
  gasRecords.forEach((r) => {
    const p = (r.pha || "").trim();
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(r);
  });
  return groups;
}

/** Tab Xu hướng: hỏi xác nhận các lần giảm đột ngột chưa xác nhận + liệt kê các lần xử lý dầu đã ghi nhận. */
function renderTrendOilTreatment(gasRecords) {
  const wrap = $("trOilTreatWrap");
  if (!wrap) return;
  const groups = trendGasRecordsByPhase(gasRecords);
  const multiPhase = groups.size >= 2;
  const fmtDate = (d) => new Date(d).toLocaleDateString("vi-VN");
  const prompts = [];
  const confirmed = [];
  groups.forEach((recs, pha) => {
    const phaseLabel = multiPhase && pha ? DGA.phaLabelWithPrefix(pha) : "";
    DGA.findGasDrops(recs, recordGases).forEach((item) => {
      if (!item.status) prompts.push(oilTreatmentPromptHtml(item, phaseLabel));
    });
    recs.filter((r) => r.xu_ly_dau && DGA.OIL_TREATMENT_LABELS[r.xu_ly_dau]).forEach((r) => {
      const change = canEditRecord(r)
        ? ` <button type="button" class="btn sm ghost" data-oil-treat-id="${escapeHtml(r.id)}" data-oil-treat-value="">Đổi</button>`
        : "";
      confirmed.push(`<li>${DGA.OIL_TREATMENT_LABELS[r.xu_ly_dau]} trước lần đo ${fmtDate(r.sample_date)}` +
        `${phaseLabel ? " (" + escapeHtml(phaseLabel) + ")" : ""}${change}</li>`);
    });
  });
  if (prompts.length === 0 && confirmed.length === 0) {
    wrap.innerHTML = "";
    wrap.classList.add("hidden");
    return;
  }
  wrap.innerHTML = prompts.join("") + (confirmed.length
    ? `<div class="note" style="margin-bottom:12px;"><strong>Xử lý dầu đã ghi nhận</strong> (dự báo chỉ dùng số liệu từ lần lọc/thay dầu gần nhất):<ul style="margin:4px 0 0 18px;">${confirmed.join("")}</ul></div>`
    : "");
  wrap.classList.remove("hidden");
  bindOilTreatmentButtons(wrap);
}
