/* ui-oil.js — Tab "Lý-Hóa dầu": thí nghiệm dầu chính MBA/Kháng dầu — 3 chỉ tiêu cơ bản (độ ẩm, tgδ 90°C,
   điện áp chọc thủng — Bảng 58/55/54 QĐ1901) + các chỉ tiêu lý-hóa BỔ SUNG (Điều 48–56 QĐ1901, IEC 60422:2024
   — xem src/domain/dga-logic-oil-extended.js). Nhập mới hoặc nhập lại BBTN lịch sử (đọc PDF — src/data/io/mba-oil-bbtn.js);
   thùng dầu chung (1 cột) hoặc riêng từng pha (3 cột A/B/C, lưu thành 3 bản ghi cùng bbtn_group_id).
   Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước chia sẻ scope giữa các file ui-*.js. */

function populateOilVoltageClasses() {
  const optionsHtml = DGA.OIL_VOLTAGE_CLASSES.map(
    (c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`
  ).join("");
  $("o_voltage_class").innerHTML = optionsHtml;
  $("s_oil_voltage_class").innerHTML = optionsHtml;
  $("o_samplepoint").innerHTML = DGA.OIL_SAMPLE_POINTS.map(
    (p) => `<option value="${p.value}">${escapeHtml(p.label)}</option>`
  ).join("");
  if ($("o_oxmethod")) {
    $("o_oxmethod").innerHTML = '<option value="">— Không thử —</option>' + Object.entries(DGA.BANG60_62_OXIDATION)
      .map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join("");
  }
  renderOilParamTable(false);
}

// ---------------------------------------------------------------------
// Bảng nhập chỉ tiêu (1 cột "Kết quả" hoặc 3 cột Pha A/B/C) — DÙNG CHUNG cho form dầu thùng chính
// (tiền tố "o") và form dầu OLTC (tiền tố "ot"). OLTC chỉ có nhóm cơ bản + QĐ1901 + chỉ tiêu khác
// (Điều 37: dầu OLTC mới đánh giá như dầu thùng chính; vận hành theo Bảng 49).
// ---------------------------------------------------------------------
const OIL_PARAM_FORMS = {
  o: { groups: ["base", "qd1901", "iec", "other", "oxidation"] },
  ot: { groups: ["base", "qd1901", "other"] },
};
function oilFormCols(p = "o") {
  return $(`${p}_samplepoint`).value === "pharieng" ? ["A", "B", "C"] : ["X"];
}
function oilColLabel(col) {
  return col === "X" ? "Kết quả" : "Pha " + col;
}
function oilInputId(field, col, p = "o") {
  return `${p}_p_${field}_${col}`;
}

/** Đọc toàn bộ ô nhập hiện có: { col: { field: value } } (chỉ ô có giá trị). */
function readOilParamValues(p = "o") {
  const out = {};
  ["X", "A", "B", "C"].forEach((col) => {
    DGA.OIL_PARAM_DEFS.forEach((d) => {
      const el = $(oilInputId(d.field, col, p));
      if (!el || el.value === "") return;
      out[col] = out[col] || {};
      out[col][d.field] = d.type === "select" ? el.value : Number(el.value);
    });
  });
  return out;
}

/** Vẽ lại bảng nhập theo điểm lấy mẫu; preserve: giữ số đã gõ (chuyển chung <-> pha riêng: cột "Kết quả"
 *  <-> "Pha A"). */
function renderOilParamTable(preserve = true, p = "o") {
  const wrap = $(`${p}_paramTableWrap`);
  if (!wrap) return;
  const cols = oilFormCols(p);
  const old = preserve ? readOilParamValues(p) : {};
  if (cols.length === 3 && old.X && !old.A) old.A = old.X;
  if (cols.length === 1 && !old.X && old.A) old.X = old.A;

  wrap.innerHTML = OIL_PARAM_FORMS[p].groups.map((g) => {
    const defs = DGA.OIL_PARAM_DEFS.filter((d) => d.group === g);
    const rows = defs.map((d) => {
      const cells = cols.map((col) => {
        const id = oilInputId(d.field, col, p);
        const aria = `${d.label}${col === "X" ? "" : " pha " + col}`;
        if (d.type === "select") {
          return `<td><select id="${id}" aria-label="${escapeHtml(aria)}"><option value="">—</option>${d.options
            .map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join("")}</select></td>`;
        }
        return `<td><input id="${id}" type="number" step="${d.step || "any"}" aria-label="${escapeHtml(aria)}" /></td>`;
      }).join("");
      return `<tr><td>${escapeHtml(d.label)}${d.unit ? ` <span class="oil-unit">(${escapeHtml(d.unit)})</span>` : ""}</td>${cells}</tr>`;
    }).join("");
    return `<details class="oil-param-group" data-group="${g}"${g === "base" ? " open" : ""}>
      <summary>${escapeHtml(DGA.OIL_GROUP_LABELS[g])}<span class="oil-group-count" data-count-for="${g}"></span></summary>
      <div class="table-scroll"><table class="oil-param-table"><thead><tr><th>Chỉ tiêu</th>${cols
        .map((c) => `<th>${c === "X" ? "" : `<span class="phase-dot ${c.toLowerCase()}"></span>`}${oilColLabel(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody></table></div></details>`;
  }).join("");

  Object.entries(old).forEach(([col, vals]) => {
    if (!cols.includes(col)) return;
    Object.entries(vals).forEach(([field, v]) => { const el = $(oilInputId(field, col, p)); if (el) el.value = v; });
  });
  const upd = () => updateOilGroupCounts(false, p);
  wrap.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", upd));
  wrap.querySelectorAll("select").forEach((el) => el.addEventListener("change", upd));
  updateOilGroupCounts(true, p);
}

/** Số chỉ tiêu đã nhập của từng nhóm (hiện cạnh tiêu đề nhóm); openFilled: mở sẵn nhóm có số liệu. */
function updateOilGroupCounts(openFilled, p = "o") {
  const wrap = $(`${p}_paramTableWrap`);
  if (!wrap) return;
  const vals = readOilParamValues(p);
  OIL_PARAM_FORMS[p].groups.forEach((g) => {
    const fields = new Set();
    Object.values(vals).forEach((v) => Object.keys(v).forEach((f) => {
      const d = DGA.oilParamDef(f);
      if (d && d.group === g) fields.add(f);
    }));
    const badge = wrap.querySelector(`[data-count-for="${g}"]`);
    if (badge) badge.textContent = fields.size ? ` — đã nhập ${fields.size} chỉ tiêu` : "";
    if (openFilled === true && fields.size) {
      const det = wrap.querySelector(`.oil-param-group[data-group="${g}"]`);
      if (det) det.open = true;
    }
  });
}

/** Điền giá trị đã đọc (BBTN) vào bảng nhập; col "X" sang bảng 3 pha thì vào đúng phase (nếu có) hoặc A. */
function oilFillParamValues(values, p = "o", phaseForX = "") {
  const cols = oilFormCols(p);
  Object.entries(values || {}).forEach(([col, vals]) => {
    const target = cols.length === 3 && col === "X" ? (phaseForX || "A") : col;
    Object.entries(vals).forEach(([field, v]) => { const el = $(oilInputId(field, target, p)); if (el) el.value = v; });
  });
  updateOilGroupCounts(true, p);
}

// Pha giờ chọn bằng CỘT trong bảng nhập (#o_phase_wrap luôn ẩn, giữ trong DOM cho tương thích).
function toggleOilPhaseField() {
  $("o_phase_wrap").classList.add("hidden");
  renderOilParamTable(true);
}

function oilSamplePointLabel(sp) {
  const found = DGA.OIL_SAMPLE_POINTS.find((p) => p.value === sp);
  return found ? found.label : sp || "—";
}

// "Có bảo vệ màng/nitơ" chỉ có ý nghĩa với các cấp điện áp mà Bảng 58 phân biệt 2 mức (có/không màng).
function toggleOilMembraneField() {
  const vc = $("o_voltage_class").value;
  const withMembrane = DGA.bang58WaterLimits(vc, true);
  const withoutMembrane = DGA.bang58WaterLimits(vc, false);
  const applicable = withMembrane.new !== withoutMembrane.new || withMembrane.inservice !== withoutMembrane.inservice;
  $("o_membrane_wrap").classList.toggle("hidden", !applicable);
  if (!applicable) $("o_membrane").checked = false;
}

// _editingOilRecords: { col: bản ghi } đang SỬA (rỗng = nhập MỚI) — mở 1 bản ghi pha riêng sẽ nạp cả các
// pha cùng biên bản (cùng bbtn_group_id, hoặc cùng thiết bị + ngày lấy mẫu).
let _editingOilRecords = {};

// Ô thông số kỹ thuật thiết bị ở form dầu MBA ↔ khóa trong cột device_info (src/data/io/device-specs.js OIL_DEVICE_INFO_KEYS)
const OIL_DEVICE_INFO_IDS = {
  hang_sx: "ob_hangsx", nam_sx: "ob_namsx", dien_ap_dm: "ob_dienapdm", cong_suat: "ob_congsuat",
  so_che_tao: "ob_sochetao", nam_van_hanh: "ob_namvanhanh", loai_dau: "ob_loaidau",
};
function oilDeviceInfoRead() {
  const o = {};
  Object.entries(OIL_DEVICE_INFO_IDS).forEach(([k, id]) => { const v = $(id) ? $(id).value.trim() : ""; if (v) o[k] = v; });
  return Object.keys(o).length ? JSON.stringify(o) : "";
}
/** Điền khối thông số kỹ thuật từ device_info đã lưu (chuỗi JSON / object); null → xóa trống. */
function oilDeviceInfoFill(info) {
  let o = {};
  if (info) { try { o = typeof info === "string" ? JSON.parse(info) : info; } catch (_) { o = {}; } }
  Object.entries(OIL_DEVICE_INFO_IDS).forEach(([k, id]) => {
    if (!$(id)) return;
    $(id).value = o && o[k] !== undefined && o[k] !== null ? String(o[k]) : "";
    delete $(id).dataset.auto;
    delete $(id).dataset.specAuto;
    delete $(id).dataset.exportAuto;
  });
}

function clearOilForm() {
  ["o_tram", "o_thietbi", "o_ghichu"].forEach((id) => ($(id).value = ""));
  $("o_membrane").checked = false;
  $("o_nsx").value = "";
  $("o_inhibited").value = "";
  $("o_oxmethod").value = "";
  $("o_samplepoint").value = "chung";
  oilDeviceInfoFill(null);
  oilBbtnClearImport();
  $("oImportNote").classList.add("hidden");
  $("o_phase_wrap").classList.add("hidden");
  renderOilParamTable(false);
  $("oilResultsPanel").classList.add("hidden");
  $("oilIec60422Panel").classList.add("hidden");
  resetOilTestEditState();
  hideOilPreview();
  if (typeof syncOltcFromMain === "function") syncOltcFromMain();
  if (typeof refreshSavedTables === "function") refreshSavedTables();
}

function resetOilTestEditState() {
  _editingOilRecords = {};
  $("editingOilTestNote").classList.add("hidden");
  $("btnCancelEditOilTest").classList.add("hidden");
  $("btnAnalyzeOil").textContent = "Đánh giá & Lưu";
}

/** Các bản ghi CÙNG biên bản với rec (pha riêng): cùng bbtn_group_id, hoặc cùng Trạm+Thiết bị+ngày. */
function oilSameReportRecords(rec) {
  if (rec.oil_sample_point !== "pharieng") return [rec];
  const day = (r) => DGA.formatSampleDate(r.sample_date);
  return _allOilTests.filter((r) => r.oil_sample_point === "pharieng" && (rec.bbtn_group_id
    ? r.bbtn_group_id === rec.bbtn_group_id
    : !r.bbtn_group_id && r.tram === rec.tram && r.thiet_bi === rec.thiet_bi && day(r) === day(rec)));
}

/** Nạp thí nghiệm dầu MBA đã lưu lên form để sửa (kèm các pha cùng biên bản). */
function onEditOilTest(rec) {
  if (!canEditRecord(rec)) return;
  const group = oilSameReportRecords(rec).filter((r) => canEditRecord(r));
  $("o_tram").value = rec.tram || "";
  $("o_thietbi").value = rec.thiet_bi || "";
  $("o_samplepoint").value = rec.oil_sample_point || "chung";
  ensureOilVoltageOption("o_voltage_class", rec.voltage_class);
  $("o_voltage_class").value = rec.voltage_class || "";
  toggleOilMembraneField();
  $("o_oilstate").value = rec.oil_state || "inservice";
  $("o_nsx").value = rec.manufacturer || "";
  $("o_membrane").checked = !!rec.has_membrane_n2;
  $("o_inhibited").value = rec.oil_inhibited || "";
  $("o_oxmethod").value = rec.ox_method || "";
  $("o_ngay").value = DGA.formatSampleDate(rec.sample_date) || "";
  $("o_ghichu").value = rec.ghi_chu || "";
  oilDeviceInfoFill(rec.device_info);
  renderOilParamTable(false);
  _editingOilRecords = {};
  group.forEach((r) => {
    const col = rec.oil_sample_point === "pharieng" ? (r.phase || "A") : "X";
    _editingOilRecords[col] = r;
    DGA.OIL_PARAM_DEFS.forEach((d) => {
      const el = $(oilInputId(d.field, col));
      if (el && r[d.field] !== null && r[d.field] !== undefined && r[d.field] !== "") el.value = r[d.field];
    });
  });
  updateOilGroupCounts(true);
  if (typeof syncOltcFromMain === "function") syncOltcFromMain();
  $("editingOilTestNote").classList.remove("hidden");
  $("btnCancelEditOilTest").classList.remove("hidden");
  $("btnAnalyzeOil").textContent = "Cập nhật & Lưu";
  // Đảm bảo khối "Dầu MBA chính" đang HIỆN trước khi cuộn tới — xem toggleDauEquipmentType(), app-core.js.
  $("dau_equipmenttype").value = DGA.EQUIPMENT_TYPES.MBA;
  toggleDauEquipmentType();
  if (typeof inputOpenRecord === "function") inputOpenRecord("dau");
  document.querySelector('button.tab-btn[data-tab="dau"]').click();
  $("o_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Bản ghi đã lưu cùng thiết bị + ngày + pha (để không tạo dòng trùng khi nhập lại cùng 1 biên bản). */
function oilFindExisting(rec) {
  const day = DGA.formatSampleDate(rec.sample_date);
  const key = DGA.oilSeriesKey(rec);
  return _allOilTests.find((r) => DGA.oilSeriesKey(r) === key && DGA.formatSampleDate(r.sample_date) === day &&
    (r.oil_sample_point || "chung") === (rec.oil_sample_point || "chung")) || null;
}

async function onAnalyzeOil() {
  const oilSamplePoint = $("o_samplepoint").value || "chung";
  const voltageClass = $("o_voltage_class").value;
  const oilState = $("o_oilstate").value;
  const hasMembraneN2 = !$("o_membrane_wrap").classList.contains("hidden") && $("o_membrane").checked;
  const manufacturer = $("o_nsx").value || null;
  const header = {
    tram: $("o_tram").value.trim(),
    thiet_bi: $("o_thietbi").value.trim(),
    oil_sample_point: oilSamplePoint,
    voltage_class: voltageClass,
    oil_state: oilState,
    has_membrane_n2: hasMembraneN2,
    manufacturer,
    sample_date: $("o_ngay").value,
    ghi_chu: $("o_ghichu").value.trim(),
    oil_inhibited: $("o_inhibited").value || "",
    ox_method: $("o_oxmethod").value || "",
    // Thông số kỹ thuật thiết bị (khối "Thông số kỹ thuật thiết bị" ở form) — chuỗi JSON, "" khi không nhập gì
    device_info: oilDeviceInfoRead(),
  };
  if (!header.thiet_bi || !header.sample_date) {
    notifyError("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
    return;
  }
  const vals = readOilParamValues();
  const cols = oilFormCols().filter((c) => vals[c] && Object.keys(vals[c]).length > 0);
  if (cols.length === 0) {
    notifyError(oilSamplePoint === "pharieng"
      ? "Vui lòng nhập kết quả cho ít nhất 1 pha (A, B hoặc C)."
      : "Vui lòng nhập ít nhất 1 chỉ tiêu thí nghiệm.");
    return;
  }
  const negatives = [];
  cols.forEach((c) => Object.entries(vals[c]).forEach(([f, v]) => {
    const d = DGA.oilParamDef(f);
    if (d && d.type !== "select") negatives.push({ label: d.label + (c === "X" ? "" : ` (pha ${c})`), value: v });
  }));
  if (alertIfNegative(negatives)) return;

  const records = cols.map((col) => {
    const rec = { ...header, phase: col === "X" ? "" : col };
    DGA.OIL_PARAM_DEFS.forEach((d) => { rec[d.field] = vals[col][d.field] ?? null; });
    const editing = _editingOilRecords[col] || null;
    const existing = editing || oilFindExisting(rec);
    if (existing) {
      rec.id = existing.id;
      rec.created_at = existing.created_at;
      rec.bbtn_group_id = existing.bbtn_group_id || "";
      rec.bbtn_file_id = existing.bbtn_file_id;
      rec.bbtn_url = existing.bbtn_url;
      rec.bbtn_name = existing.bbtn_name;
      rec._overwrite = !editing;
    }
    return rec;
  });
  const overwrite = records.filter((r) => r._overwrite);
  records.forEach((r) => delete r._overwrite);

  // Hiện kết quả đánh giá TRƯỚC (kể cả khi người dùng chọn không ghi đè bản ghi cũ)
  const stds = toOilStandardsForLogic(_allStandards);
  const all = _allOilTests || [];
  const results = records.map((rec) => ({
    col: rec.phase || "X", rec,
    qd: DGA.evaluateOilRecord(rec, stds, all),
    iec: DGA.evaluateIec60422OilRecord(rec, all),
  }));
  renderOilResults(results);
  renderOilIec60422Results(results);
  if (typeof oilBbtnExportSetMain === "function") oilBbtnExportSetMain(header, results);

  if (!canSaveEntry()) return;
  if (overwrite.length) {
    const what = overwrite.some((r) => r.phase) ? `của ${overwrite.map((r) => "pha " + r.phase).join(", ")} ` : "";
    if ((typeof _oilBatchSaving === "undefined" || !_oilBatchSaving) && !confirm(`Đã có thí nghiệm dầu ${what}của thiết bị này cùng ngày lấy mẫu. Ghi đè bằng số liệu mới?`)) return;
  }
  const wasEditing = Object.keys(_editingOilRecords).length > 0;
  const file = oilBbtnPendingFile();
  const groupId = records.find((r) => r.bbtn_group_id)?.bbtn_group_id || oilBbtnGroupId() ||
    (records.length > 1 || file ? Storage.newId() : "");
  records.forEach((r) => { if (groupId) r.bbtn_group_id = groupId; });

  const btn = $("btnAnalyzeOil");
  btn.disabled = true;
  try {
    if (file) {
      try {
        const attachment = await oilBbtnUpload(groupId);
        records.forEach((rec) => Object.assign(rec, attachment));
      } catch (err) {
        notifyError("Đã hiển thị kết quả, nhưng CHƯA LƯU vì không tải được file BBTN lên: " + storageErrorMessage(err));
        return;
      }
    }
    const saved = [];
    try {
      for (const rec of records) {
        await Storage.addOilTest(rec);
        saved.push(rec.phase ? "pha " + rec.phase : "mẫu chung");
      }
    } catch (err) {
      notifyError(`Đã hiển thị kết quả đánh giá; đã lưu ${saved.length ? saved.join(", ") : "0 bản ghi"}, phần còn lại LƯU THẤT BẠI: ${storageErrorMessage(err)}`);
      await refreshOilTestsUI();
      return;
    }
    await registerStationIfNew(header.tram);
    resetOilTestEditState();
    // Biên bản đọc từ file: GIỮ file + bbtn_group_id để phần OLTC cùng biên bản đính kèm đúng file đó
    if (!_oilBbtnImport && $("o_bbtn_file")) { $("o_bbtn_file").value = ""; oilRenderFileLabel(); }
    await refreshOilTestsUI();
    showToast(`${wasEditing ? "Đã cập nhật" : "Đã lưu"} thí nghiệm dầu thùng chính: ${saved.join(", ")}.`);
    return true;
  } finally {
    btn.disabled = false;
  }
}

function oilOverallPill(overall) {
  return overall === "Đạt" ? `<span class="pill ok">Đạt</span>`
    : overall === "Chưa đủ dữ liệu" ? `<span class="pill muted">Chưa đủ dữ liệu</span>`
    : overall === "Cảnh báo" ? `<span class="pill warn">Cảnh báo</span>`
    : `<span class="pill bad">Không đạt</span>`;
}

function oilRowValue(r) {
  return escapeHtml(typeof r.value === "number" ? String(r.value) : r.value ?? "—");
}

/** Kết quả QĐ1901 — 1 hoặc nhiều cột (pha); results: [{ col, qd, iec }]. */
function renderOilResults(results) {
  $("oilResultsPanel").classList.remove("hidden");
  const multi = results.length > 1 || results[0].col !== "X";
  $("o_overall").innerHTML = results.map((x) => (multi ? `<span style="margin-right:6px; font-size:14px; font-weight:600;">${oilColLabel(x.col)}:</span>` : "") +
    oilOverallPill(x.qd.overall)).join('<span style="margin:0 10px; color:var(--text-tertiary);">|</span>');
  $("o_resultTable").innerHTML = results.map((x) => {
    const head = multi ? `<tr class="oil-result-phase-head"><td colspan="6"><span class="phase-dot ${x.col.toLowerCase()}"></span><strong>${oilColLabel(x.col)}</strong> — ${oilOverallPill(x.qd.overall)}</td></tr>` : "";
    return head + x.qd.rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.label)}</td><td>${oilRowValue(r)}</td>
      <td>${escapeHtml(r.limitText ?? "—")}</td>
      <td>${escapeHtml(r.unit || "")}</td><td>${verdictPill(r.verdict)}</td>
      <td style="font-size:12px;">${escapeHtml(r.ref || "")}</td>
    </tr>`).join("");
  }).join("");
  if (typeof $("oilResultsPanel").scrollIntoView === "function") {
    $("oilResultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/** Khối "Tham khảo — IEC 60422:2024" (Bảng 3 dầu mới / Bảng 5 dầu vận hành) — panel RIÊNG với QĐ1901. */
function renderOilIec60422Results(results) {
  $("oilIec60422Panel").classList.remove("hidden");
  const multi = results.length > 1 || results[0].col !== "X";
  $("o_iec_overall").innerHTML = results.map((x) => (multi ? `<span style="margin-right:6px; font-size:14px; font-weight:600;">${oilColLabel(x.col)}:</span>` : "") +
    tioVerdictPill(x.iec.overall)).join('<span style="margin:0 10px; color:var(--text-tertiary);">|</span>');
  $("o_iec_resultTable").innerHTML = results.map((x) => {
    const head = multi ? `<tr class="oil-result-phase-head"><td colspan="6"><span class="phase-dot ${x.col.toLowerCase()}"></span><strong>${oilColLabel(x.col)}</strong> — ${tioVerdictPill(x.iec.overall)}</td></tr>` : "";
    return head + x.iec.rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.label)}</td><td>${oilRowValue(r)}</td>
      <td>${escapeHtml(r.limit ?? "—")}</td>
      <td>${escapeHtml(r.unit || "")}</td><td>${tioVerdictPill(r.verdict)}</td>
      <td style="font-size:12px;">${escapeHtml(r.ref || "")}</td>
    </tr>`).join("");
  }).join("");
}

/** Ô "Chỉ tiêu bổ sung" ở bảng lịch sử: số chỉ tiêu đã nhập + các chỉ tiêu Không đạt. */
function oilExtraSummaryHtml(rec, evalResult) {
  const n = Object.keys(DGA.oilExtraFromRecord(rec)).length;
  if (!n) return "—";
  const baseKeys = new Set(["moisture", "tgd90", "bdv"]);
  const bad = evalResult.rows.filter((r) => !baseKeys.has(r.key) && r.verdict === "Không đạt").map((r) => r.label);
  return `<span title="${escapeHtml(Object.keys(DGA.oilExtraFromRecord(rec)).map((f) => (DGA.oilParamDef(f) || {}).label || f).join(", "))}">${n} chỉ tiêu</span>` +
    (bad.length ? `<div style="font-size:11px; color:var(--bad);">Không đạt: ${escapeHtml(bad.join(", "))}</div>` : "");
}

/** Vẽ danh sách dòng thí nghiệm dầu MBA chính vào 1 bảng bất kỳ — dùng CHUNG cho bảng ở tab "Lý-Hóa dầu"
 *  (#oilHistoryTable) và bảng chỉ-để-xem ở tab "Lịch sử đo" (#lichsuOilHistoryTable). */
function renderOilTestRows(tbodyId, emptyId, sortedRecords) {
  const tbody = $(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  const emptyEl = $(emptyId);
  if (emptyEl) emptyEl.classList.toggle("hidden", sortedRecords.length > 0);

  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);
  sortedRecords.forEach((rec) => {
    const evalResult = DGA.evaluateOilRecord(rec, oilStandardsForLogic, _allOilTests);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="nowrap-cell">${escapeHtml(fmtDateVN(rec.sample_date))}</td>
      <td>${escapeHtml(rec.tram || "—")}</td>
      <td>${escapeHtml(rec.thiet_bi)}</td>
      <td>${escapeHtml(oilSamplePointLabel(rec.oil_sample_point || "chung"))}</td>
      <td>${rec.phase ? escapeHtml(rec.phase) : "—"}</td>
      <td>${escapeHtml(oilVoltageClassLabel(rec.voltage_class))}</td>
      <td>${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${escapeHtml(rec.moisture_ppm ?? "—")}</td>
      <td>${escapeHtml(rec.tgd_90c_percent ?? "—")}</td>
      <td>${escapeHtml(rec.bdv_kv ?? "—")}</td>
      <td style="font-size:12px;">${oilExtraSummaryHtml(rec, evalResult)}</td>
      <td>${oilOverallPill(evalResult.overall)}</td>
      <td>${ownerCellHtml(rec)}</td>
      <td class="actions-cell">${rowActionsHtml([
        rowActionBtn("view", "eye",
          rec.bbtn_url ? "Xem biên bản thí nghiệm đã đính kèm" : "Xem chi tiết thí nghiệm dầu",
          { cls: "btn-action-hist" }),
        canEditRecord(rec) && rowActionBtn("edit", "edit", "Sửa kết quả thí nghiệm dầu này", { cls: "btn-action-hist" }),
        canWrite() && rowActionBtn("del", "trash", "Xóa kết quả thí nghiệm dầu này", { danger: true, cls: "btn-action-hist" }),
      ])}</td>
    `;
    const viewBtn = tr.querySelector('[data-action="view"]');
    if (viewBtn) {
      viewBtn.addEventListener("click", () => {
        if (rec.bbtn_url && typeof viewBbtn === "function") {
          viewBbtn({ bbtn_url: rec.bbtn_url, bbtn_name: rec.bbtn_name });
        } else {
          onEditOilTest(rec);
        }
      });
    }
    const editBtn = tr.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener("click", () => onEditOilTest(rec));
    const delBtn = tr.querySelector('[data-action="del"]');
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (confirm("Xóa thí nghiệm dầu này khỏi lịch sử?")) {
          try {
            await Storage.deleteOilTest(rec.id);
            await refreshOilTestsUI();
          } catch (err) {
            notifyError(storageErrorMessage(err));
          }
        }
      });
    }
    tbody.appendChild(tr);
  });
}

async function refreshOilTestsUI() {
  const all = await Storage.listOilTests();
  _allOilTests = all;
  // Bảng ở tab Lý-Hóa dầu chỉ hiện số liệu đã lưu của THIẾT BỊ ĐANG CHỌN (ui-input-subtabs.js); toàn bộ ở tab Lịch sử đo
  if (typeof renderOilSavedTable === "function") renderOilSavedTable();
  else renderOilTestRows("oilHistoryTable", "oilHistoryEmpty", all.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date)));
  if (typeof refreshLichSuOilTable === "function") refreshLichSuOilTable();

  refreshTrendDeviceOptions();
  refreshAlertsUI();
}

// ---------------------------------------------------------------------
// Đọc BBTN dầu MBA (PDF hoặc DOCX) — nhập biên bản mới hoặc lịch sử. 1 biên bản PTC3 gồm phần dầu THÙNG
// CHÍNH và phần dầu OLTC → điền cả 2 form, dùng CHUNG 1 file đính kèm + 1 bbtn_group_id.
//   - MBA 1 pha ("Vị trí lấy mẫu: ... pha C"): thùng chính + OLTC đều là cột pha C ("riêng từng pha").
//   - MBA 3 pha: thùng chính 1 cột (thùng chung); OLTC tách 3 bảng con pha A/B/C → OLTC "một pha" 3 cột.
// ---------------------------------------------------------------------

// Biên bản đang mở từ file: { file, groupId, attachment|null, fileName }
let _oilBbtnImport = null;

/** File BBTN sẽ đính kèm khi lưu (đọc từ ô chọn file, hoặc file của biên bản đang mở). */
function oilBbtnPendingFile() {
  if (_oilBbtnImport && _oilBbtnImport.file) return _oilBbtnImport.file;
  const input = $("o_bbtn_file");
  return (input && input.files && input.files[0]) || null;
}
function oilBbtnGroupId() {
  return _oilBbtnImport ? _oilBbtnImport.groupId : "";
}
/** Tải file BBTN lên 1 LẦN cho cả biên bản (thùng chính + OLTC), các lần lưu sau dùng lại. */
async function oilBbtnUpload(groupId) {
  const file = oilBbtnPendingFile();
  if (!file) return {};
  if (_oilBbtnImport && _oilBbtnImport.attachment) return _oilBbtnImport.attachment;
  const att = await Storage.uploadAttachment(groupId, file);
  if (_oilBbtnImport) _oilBbtnImport.attachment = att;
  return att;
}
function oilBbtnClearImport() {
  _oilBbtnImport = null;
  if ($("o_bbtn_file")) $("o_bbtn_file").value = "";
  oilRenderFileLabel();
  // Giữ khung đối chiếu đang mở (người dùng tự ẩn khi xong); chỉ ẩn nút bật lại khi không còn file
  if ($("oPreviewCol") && $("oPreviewCol").classList.contains("hidden")) hideOilPreview();
  if ($("btnSaveOilBbtnAll")) $("btnSaveOilBbtnAll").classList.add("hidden");
  if (typeof renderDeviceSpecAttachNotes === "function") renderDeviceSpecAttachNotes();
}

function oilRenderFileLabel() {
  const input = $("o_bbtn_file");
  const label = $("oDropzoneText");
  if (!input || !label) return;
  const file = (input.files && input.files[0]) || (_oilBbtnImport && _oilBbtnImport.file) || null;
  $("oDropzone").classList.toggle("has-file", !!file);
  label.innerHTML = file
    ? `Đã chọn: <strong>${escapeHtml(file.name)}</strong> — file sẽ được đính kèm khi lưu (cả phần thùng chính và OLTC). <span class="file-dropzone-link">Chọn file khác</span>`
    : 'Kéo thả file BBTN dầu MBA (PDF hoặc Word .docx — mới hoặc lịch sử) để tự điền, hoặc <span class="file-dropzone-link">bấm để chọn file</span>';
}

/** Điền form THÙNG CHÍNH từ kết quả MbaOilBbtn.parseMbaOilBbtnLines() — chỉ ghi đè ô ĐỌC ĐƯỢC. */
function oilFillFromParsed(parsed) {
  const h = parsed.header || {};
  // Biên bản của thiết bị KHÁC thiết bị đang ở form → bỏ thông số kỹ thuật cũ (không lưu nhầm sang thiết bị mới)
  const norm = (v) => String(v || "").trim();
  if ((h.thietBi && norm(h.thietBi) !== norm($("o_thietbi").value)) || (h.tram && norm(h.tram) !== norm($("o_tram").value))) {
    oilDeviceInfoFill(null);
  }
  if (h.tram) $("o_tram").value = h.tram;
  if (h.thietBi) $("o_thietbi").value = h.thietBi;
  if (h.ngay) $("o_ngay").value = h.ngay;
  if (h.voltageClass) { $("o_voltage_class").value = h.voltageClass; toggleOilMembraneField(); }
  if (h.oilState) $("o_oilstate").value = h.oilState;
  if (h.ghiChu && !$("o_ghichu").value.trim()) $("o_ghichu").value = h.ghiChu;
  // Thông số kỹ thuật ghi trên biên bản — chỉ ghi đè ô đọc được
  const hs = { hang_sx: h.hangSx, nam_sx: h.namSx, dien_ap_dm: h.dienApDm, cong_suat: h.congSuat, so_che_tao: h.serial, nam_van_hanh: h.namVanHanh, loai_dau: h.loaiDau };
  Object.entries(hs).forEach(([k, v]) => { if (v && $(OIL_DEVICE_INFO_IDS[k])) $(OIL_DEVICE_INFO_IDS[k]).value = v; });
  // MBA 1 pha (biên bản ghi 1 pha cụ thể) hoặc bảng có 3 cột pha → thùng dầu riêng từng pha
  $("o_samplepoint").value = h.phase || parsed.threePhase ? "pharieng" : "chung";
  renderOilParamTable(false);
  oilFillParamValues(parsed.values, "o", h.phase);
  if (typeof refreshSavedTables === "function") refreshSavedTables();
}

/** Điền form OLTC từ phần OLTC của biên bản. */
function oltcFillFromParsed(parsed) {
  const h = parsed.header || {};
  const o = parsed.oltc;
  if (!o) return false;
  if (h.tram) $("ot_tram").value = h.tram;
  if (h.thietBi) $("ot_thietbi").value = h.thietBi;
  if (h.ngay) $("ot_ngay").value = h.ngay;
  if (h.voltageClass) { $("ot_voltage_class").value = h.voltageClass; toggleOltcMembraneField(); }
  if (h.oilState) $("ot_oilstate").value = h.oilState;
  if (h.ghiChu && !$("ot_ghichu").value.trim()) $("ot_ghichu").value = h.ghiChu;
  // OLTC từng pha (MBA 3 pha tách bảng A/B/C, hoặc MBA 1 pha) → "Một pha / điểm không trung tính"
  $("ot_samplepoint").value = o.threePhase || h.phase ? "pharieng" : "trungtinh";
  resetOltcOilTestEditState();
  renderOilParamTable(false, "ot");
  oilFillParamValues(o.values, "ot", h.phase);
  return true;
}

/** Đọc file thành dòng chữ: .docx đọc thẳng word/document.xml (PizZip), PDF qua BbtnImport.readLines(). */
async function oilBbtnReadLines(file, onProgress) {
  if (/\.docx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (typeof PizZip === "undefined") throw new Error("Thư viện đọc Word (PizZip) chưa tải xong");
    const zip = new PizZip(await file.arrayBuffer());
    const doc = zip.file("word/document.xml");
    if (!doc) throw new Error("File Word không hợp lệ");
    return { lines: window.MbaOilBbtn.mbaOilDocxXmlToLines(doc.asText()), viaOCR: false };
  }
  if (!window.BbtnImport || !window.BbtnImport.readLines) throw new Error(importModuleUnavailableMessage("Bộ đọc PDF chưa tải xong — thử lại sau vài giây"));
  return window.BbtnImport.readLines(file, onProgress);
}

async function onOilBbtnFileSelected() {
  const file = $("o_bbtn_file").files && $("o_bbtn_file").files[0];
  _oilBbtnImport = null;
  oilRenderFileLabel();
  if (!file) { hideOilPreview(); return; }
  showOilPreview(file, "Đang đọc BBTN...");
  const note = $("oImportNote");
  note.classList.remove("hidden");
  if (!window.MbaOilBbtn) {
    note.textContent = "Bộ đọc BBTN chưa tải xong hoặc tải lỗi — vui lòng thử lại sau vài giây, hoặc nhập tay.";
    return;
  }
  note.textContent = "Đang đọc biên bản...";
  let parsed;
  let viaOCR; // chỉ đọc sau khi đọc file thành công (nhánh lỗi đã return)
  try {
    const read = await oilBbtnReadLines(file, (m) => {
      if (m && m.status === "recognizing text") {
        note.textContent = "File là ảnh scan — đang nhận diện chữ (OCR)" + (typeof m.progress === "number" ? ` (${Math.round(m.progress * 100)}%)` : "") + "...";
      }
    });
    viaOCR = read.viaOCR;
    parsed = window.MbaOilBbtn.parseMbaOilBbtnLines(read.lines);
  } catch (err) {
    note.textContent = "Không đọc được file này — vui lòng nhập tay. (" + ((err && err.message) || err) + ")";
    return;
  }
  if (!parsed.matched.length && !parsed.oltc) {
    note.textContent = "Không nhận ra chỉ tiêu dầu nào trong file này — vui lòng nhập tay (file vẫn được đính kèm khi lưu).";
    return;
  }
  // Biên bản mới = nhập mới (bỏ liên kết với bản ghi đang sửa nếu có); 1 file + 1 nhóm cho cả biên bản
  resetOilTestEditState();
  _oilBbtnImport = { file, groupId: Storage.newId(), attachment: null };
  if (typeof _oilBbtnLastHeader !== "undefined") _oilBbtnLastHeader = parsed.header || null;
  oilFillFromParsed(parsed);
  const hasOltc = oltcFillFromParsed(parsed);
  if (typeof syncOltcFromMain === "function") syncOltcFromMain();
  if (typeof refreshSavedTables === "function") refreshSavedTables();
  const h = parsed.header;
  const lbl = (fields) => fields.map((f) => (DGA.oilParamDef(f) || {}).label || f).join(", ");
  const parts = [];
  parts.push(`Thùng dầu chính${h.phase ? ` (pha ${h.phase})` : parsed.threePhase ? " (3 pha A/B/C)" : ""}: ${parsed.matched.length ? lbl(parsed.matched) : "không có số liệu"}`);
  if (hasOltc) parts.push(`OLTC${parsed.oltc.threePhase ? ` (pha ${(parsed.oltc.phases || ["A", "B", "C"]).join(", ")})` : h.phase ? ` (pha ${h.phase})` : ""}: ${lbl(parsed.oltc.matched)}`);
  const warn = [];
  if (viaOCR) warn.push("file là ảnh scan, số liệu đọc bằng OCR nên cần so kỹ từng ô");
  if (!h.ngay) warn.push("chưa đọc được Ngày lấy mẫu");
  if (!h.thietBi) warn.push("chưa đọc được tên Thiết bị");
  if (!h.voltageClass) warn.push("chưa đọc được Điện áp định mức — chọn Cấp điện áp");
  if ([parsed.values, parsed.oltc && parsed.oltc.values].some((v) => v && Object.values(v).some((x) => x.acid_mgkoh === 0))) {
    warn.push("trị số axit ghi \"Không có\" được nhập là 0");
  }
  note.textContent = `Đã đọc biên bản ${file.name} — ${parts.join(" · ")}. ` + (warn.length ? `Lưu ý: ${warn.join("; ")}. ` : "") +
    (hasOltc ? "Đối chiếu lại rồi bấm \"Đánh giá & Lưu cả biên bản\" (hoặc lưu từng phần ở mỗi khối)." : "Đối chiếu lại với biên bản rồi bấm \"Đánh giá & Lưu\".");
  if ($("btnSaveOilBbtnAll")) $("btnSaveOilBbtnAll").classList.toggle("hidden", !hasOltc);
  if ($("oPreviewBadge")) $("oPreviewBadge").textContent = "Đã đọc biên bản";
}

/** Lưu cả biên bản: phần thùng chính rồi phần OLTC (cùng file đính kèm, cùng bbtn_group_id). */
async function onSaveOilBbtnAll() {
  const hasMain = Object.keys(readOilParamValues("o")).length > 0;
  const hasOltc = Object.keys(readOilParamValues("ot")).length > 0;
  let ok = true;
  if (hasMain) ok = (await onAnalyzeOil()) === true;
  if (ok && hasOltc) ok = (await onAnalyzeOltcOil()) === true;
  if (ok && (hasMain || hasOltc)) {
    oilBbtnClearImport();
    showToast("Đã lưu cả biên bản (thùng dầu chính và OLTC).");
  }
  return ok && (hasMain || hasOltc); // nhập hàng loạt (ui-oil-batch-import.js) cần biết đã lưu được chưa
}

// ---------------------------------------------------------------------
// Khung đối chiếu BBTN song song với form (giống tab Khí hòa tan): PDF hiện thẳng trong iframe; .docx
// chuyển word/document.xml sang HTML (MbaOilBbtn.mbaOilDocxXmlToHtml) rồi hiện bằng blob URL.
// ---------------------------------------------------------------------
let _oilPreviewUrl = null;

function oilPreviewRevoke() {
  if (_oilPreviewUrl) {
    try { URL.revokeObjectURL(_oilPreviewUrl); } catch (_) {}
    _oilPreviewUrl = null;
  }
}

async function oilPreviewBlob(file) {
  if (!/\.docx$/i.test(file.name || "")) return file;
  if (typeof PizZip === "undefined" || !window.MbaOilBbtn || !window.MbaOilBbtn.mbaOilDocxXmlToHtml) return null;
  const zip = new PizZip(await file.arrayBuffer());
  const doc = zip.file("word/document.xml");
  if (!doc) return null;
  const html = window.MbaOilBbtn.mbaOilDocxHtmlPage(window.MbaOilBbtn.mbaOilDocxXmlToHtml(doc.asText()), file.name);
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

async function showOilPreview(file, badgeText) {
  const col = $("oPreviewCol");
  const layout = $("oSplitLayout");
  const frame = $("oPreviewFrame");
  if (!col || !layout || !frame || !file) return;
  let blob = null;
  try {
    blob = await oilPreviewBlob(file);
  } catch (err) {
    console.warn("Không dựng được bản xem BBTN:", err);
  }
  if (!blob) return;
  oilPreviewRevoke();
  _oilPreviewUrl = URL.createObjectURL(blob);
  frame.src = _oilPreviewUrl;
  $("oPreviewFileName").textContent = file.name;
  $("oPreviewFileName").title = file.name;
  if (badgeText) $("oPreviewBadge").textContent = badgeText;
  layout.classList.add("has-preview");
  col.classList.remove("hidden");
  $("btnToggleOilPreview").classList.remove("hidden");
  $("btnToggleOilPreviewText").textContent = "Ẩn BBTN đối chiếu";
}

function hideOilPreview() {
  const col = $("oPreviewCol");
  if (!col) return;
  col.classList.add("hidden");
  $("oSplitLayout").classList.remove("has-preview");
  $("oPreviewFrame").src = "about:blank";
  oilPreviewRevoke();
  const hasFile = !!oilBbtnPendingFile();
  $("btnToggleOilPreview").classList.toggle("hidden", !hasFile);
  $("btnToggleOilPreviewText").textContent = "Hiện BBTN đối chiếu";
}

function toggleOilPreview() {
  if ($("oPreviewCol").classList.contains("hidden")) {
    const file = oilBbtnPendingFile();
    if (file) showOilPreview(file, "Đã nạp file");
  } else {
    hideOilPreview();
  }
}

const OIL_BBTN_ACCEPT_RE = /\.(pdf|docx)$/i;

function setupOilBbtnImport() {
  const input = $("o_bbtn_file");
  const zone = $("oDropzone");
  if (!input || !zone) return;
  input.addEventListener("change", onOilBbtnFileSelected);
  if ($("btnToggleOilPreview")) $("btnToggleOilPreview").addEventListener("click", toggleOilPreview);
  if ($("btnCloseOilPreview")) $("btnCloseOilPreview").addEventListener("click", hideOilPreview);
  if ($("btnOilPreviewNewTab")) {
    $("btnOilPreviewNewTab").addEventListener("click", () => {
      const src = $("oPreviewFrame").src;
      if (src && src !== "about:blank") window.open(src, "_blank", "noopener");
    });
  }
  if ($("btnSaveOilBbtnAll")) $("btnSaveOilBbtnAll").addEventListener("click", onSaveOilBbtnAll);
  ["dragenter", "dragover"].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add("dragover"); }));
  ["dragleave", "dragend"].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove("dragover"); }));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (!OIL_BBTN_ACCEPT_RE.test(file.name)) {
      const note = $("oImportNote");
      note.textContent = `Chỉ nhận file PDF hoặc Word (.docx) — "${file.name}" không đúng định dạng.`;
      note.classList.remove("hidden");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// ---------------------------------------------------------------------
// Dầu khoang điều áp dưới tải (OLTC) — Điều 37/Bảng 49 QĐ1901
// ---------------------------------------------------------------------
