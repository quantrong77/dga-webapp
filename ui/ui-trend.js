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

function trendRecordsForDevice(device) {
  const gasRecords = _allMeasurements
    .filter((r) => trendDeviceName(r) === device)
    .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
  const oilRecords = _allOilTests
    .filter((r) => trendDeviceName(r) === device)
    .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
  const oltcRecords = _allOltcOilTests
    .filter((r) => trendDeviceName(r) === device)
    .sort((a, b) => new Date(a.sample_date) - new Date(b.sample_date));
  return { gasRecords, oilRecords, oltcRecords };
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
      return `<label class="chk"><input type="checkbox" data-trend-key="${key}" ${checked} /> ${escapeHtml(def.label)}</label>`;
    }).join("");
    el.querySelectorAll("input[data-trend-key]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) _trendSelectedParams.add(cb.dataset.trendKey);
        else _trendSelectedParams.delete(cb.dataset.trendKey);
        renderTrendChart(gasRecords, oilRecords, oltcRecords);
      });
    });
  };

  if (hasGas) buildChecks("trParamsGas", DGA.GASES.map((g) => "gas:" + g));
  if (hasOil) buildChecks("trParamsOil", ["oil:moisture", "oil:tgd90", "oil:bdv"]);
  if (hasOltc) buildChecks("trParamsOltc", ["oltc:moisture", "oltc:tgd90", "oltc:bdv"]);
}

function renderTrendHistoryTables(gasRecords, oilRecords, oltcRecords) {
  $("trHistGasWrap").classList.toggle("hidden", gasRecords.length === 0);
  $("trHistOilWrap").classList.toggle("hidden", oilRecords.length === 0);
  $("trHistOltcWrap").classList.toggle("hidden", oltcRecords.length === 0);

  $("trHistGasTable").innerHTML = gasRecords.slice().reverse().map((r) => `
    <tr>
      <td>${r.sample_date}</td><td>${escapeHtml(DGA.phaLabel(r.pha) || "—")}</td><td>${r.lan_do ?? "—"}</td>
      ${DGA.GASES.map((g) => `<td>${recordGases(r)[g] ?? "—"}</td>`).join("")}
    </tr>
  `).join("");

  $("trHistOilTable").innerHTML = oilRecords.slice().reverse().map((r) => `
    <tr>
      <td>${r.sample_date}</td>
      <td>${r.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${r.moisture_ppm ?? "—"}</td><td>${r.tgd_90c_percent ?? "—"}</td><td>${r.bdv_kv ?? "—"}</td>
    </tr>
  `).join("");

  $("trHistOltcTable").innerHTML = oltcRecords.slice().reverse().map((r) => `
    <tr>
      <td>${r.sample_date}</td>
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
};

// Lọc + gom điểm dữ liệu hợp lệ (bỏ qua giá trị rỗng/null) thành mảng {x,y} cho Chart.js.
function trendPoints(records, valueOf) {
  return records
    .filter((r) => valueOf(r) !== undefined && valueOf(r) !== null && valueOf(r) !== "")
    .map((r) => ({ x: new Date(r.sample_date).getTime(), y: Number(valueOf(r)) }));
}

function renderTrendChart(gasRecords, oilRecords, oltcRecords) {
  const canvas = $("trendChart");
  if (typeof Chart === "undefined") {
    $("trChartNoLib").classList.remove("hidden");
    $("trChartEmpty").classList.add("hidden");
    canvas.classList.add("hidden");
    return;
  }
  $("trChartNoLib").classList.add("hidden");

  const hasGas = gasRecords.length > 0;
  const hasOil = oilRecords.length > 0;
  const hasOltc = oltcRecords.length > 0;
  const sourceOk = { gas: hasGas, oil: hasOil, oltc: hasOltc };

  const selectedKeys = Array.from(_trendSelectedParams)
    .filter((k) => TREND_PARAM_DEFS[k])
    .filter((k) => sourceOk[k.split(":")[0]]);

  destroyTrendChart();

  // Khí hòa tan: Storage.addMeasurement() hạ chữ thường các key khí (H2 -> h2, xem
  // normalizeGasKeys trong storage.js) trước khi lưu — dùng recordGases() để đọc lại
  // đúng như phần Lịch sử đo đang làm, thay vì đọc thẳng r[def.field] (viết hoa).
  const gasValueOf = (r, field) => recordGases(r)[field];

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

    if (source === "gas" && phaseFilterActive) {
      tickedPhases.forEach((p) => {
        const recs = gasRecords.filter((r) => (r.pha || "").trim() === p);
        seriesSpecs.push({
          label: `${def.label} - ${DGA.phaLabelWithPrefix(p)} (${def.unit})`,
          axis: def.axis,
          points: trendPoints(recs, (r) => gasValueOf(r, def.field)),
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
    seriesSpecs.push({ label: `${def.label} (${def.unit})`, axis: def.axis, points: trendPoints(recordsBySource[source], valueOf) });
  });

  if (seriesSpecs.length === 0) {
    $("trChartEmpty").classList.remove("hidden");
    canvas.classList.add("hidden");
    return;
  }
  $("trChartEmpty").classList.add("hidden");
  canvas.classList.remove("hidden");

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
