/* ui-oltc.js — Thí nghiệm dầu OLTC (bộ điều áp dưới tải), phần dưới của tab "Lý-Hóa dầu". Cùng cách nhập
   với dầu thùng chính (ui-oil.js): bảng chỉ tiêu theo nhóm (renderOilParamTable(..., "ot")) — 1 cột "Kết quả"
   khi lấy mẫu ở điểm cuối trung tính, 3 cột Pha A/B/C khi "Một pha / điểm không trung tính" (MBA 3 pha có
   OLTC riêng từng pha, hoặc MBA 1 pha). Đánh giá theo Điều 37 QĐ1901: dầu OLTC MỚI như dầu thùng chính (đủ
   chỉ tiêu bổ sung), dầu VẬN HÀNH theo Bảng 49 (BDV, độ ẩm) — xem DGA.evaluateOltcRecord().
   Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước chia sẻ scope giữa các file ui-*.js. */

function populateOltcOptions() {
  $("ot_samplepoint").innerHTML = DGA.OLTC_SAMPLE_POINTS.map(
    (p) => `<option value="${p.value}">${escapeHtml(p.label)}</option>`
  ).join("");
  $("ot_voltage_class").innerHTML = DGA.OIL_VOLTAGE_CLASSES.map(
    (c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`
  ).join("");
  renderOilParamTable(false, "ot");
}

// Pha giờ chọn bằng CỘT trong bảng nhập (#ot_phase_wrap luôn ẩn, giữ trong DOM cho tương thích).
function toggleOltcPhaseField() {
  $("ot_phase_wrap").classList.add("hidden");
  renderOilParamTable(true, "ot");
}

// Giống toggleOilMembraneField() ở dầu chính — chỉ có ý nghĩa khi dầu OLTC MỚI LẮP.
function toggleOltcMembraneField() {
  const vc = $("ot_voltage_class").value;
  const withMembrane = DGA.bang58WaterLimits(vc, true);
  const withoutMembrane = DGA.bang58WaterLimits(vc, false);
  const applicable = withMembrane.new !== withoutMembrane.new || withMembrane.inservice !== withoutMembrane.inservice;
  $("ot_membrane_wrap").classList.toggle("hidden", !applicable);
  if (!applicable) $("ot_membrane").checked = false;
}

function oltcSamplePointLabel(sp) {
  const found = DGA.OLTC_SAMPLE_POINTS.find((p) => p.value === sp);
  return found ? found.label : sp || "—";
}

// _editingOltcRecords: { col: bản ghi } đang SỬA (rỗng = nhập MỚI).
let _editingOltcRecords = {};

function clearOltcOilForm() {
  ["ot_tram", "ot_thietbi", "ot_ghichu"].forEach((id) => ($(id).value = ""));
  $("ot_membrane").checked = false;
  $("ot_nsx").value = "";
  $("ot_phase_wrap").classList.add("hidden");
  renderOilParamTable(false, "ot");
  $("oltcOilResultsPanel").classList.add("hidden");
  resetOltcOilTestEditState();
}

function resetOltcOilTestEditState() {
  _editingOltcRecords = {};
  $("editingOltcOilTestNote").classList.add("hidden");
  $("btnCancelEditOltcOilTest").classList.add("hidden");
  $("btnAnalyzeOltcOil").textContent = "Đánh giá & Lưu";
}

/** Các bản ghi OLTC cùng biên bản (pha riêng): cùng bbtn_group_id, hoặc cùng Trạm+Thiết bị+ngày. */
function oltcSameReportRecords(rec) {
  if (rec.oltc_sample_point !== "pharieng") return [rec];
  const day = (r) => DGA.formatSampleDate(r.sample_date);
  return _allOltcOilTests.filter((r) => r.oltc_sample_point === "pharieng" && (rec.bbtn_group_id
    ? r.bbtn_group_id === rec.bbtn_group_id
    : !r.bbtn_group_id && r.tram === rec.tram && r.thiet_bi === rec.thiet_bi && day(r) === day(rec)));
}

/** Nạp thí nghiệm dầu OLTC đã lưu lên form để sửa (kèm các pha cùng biên bản). */
function onEditOltcOilTest(rec) {
  if (!canEditRecord(rec)) return;
  const group = oltcSameReportRecords(rec).filter((r) => canEditRecord(r));
  $("ot_tram").value = rec.tram || "";
  $("ot_thietbi").value = rec.thiet_bi || "";
  $("ot_samplepoint").value = rec.oltc_sample_point || "trungtinh";
  ensureOilVoltageOption("ot_voltage_class", rec.voltage_class);
  $("ot_voltage_class").value = rec.voltage_class || "";
  toggleOltcMembraneField();
  $("ot_oilstate").value = rec.oil_state || "inservice";
  $("ot_nsx").value = rec.manufacturer || "";
  $("ot_membrane").checked = !!rec.has_membrane_n2;
  $("ot_ngay").value = DGA.formatSampleDate(rec.sample_date) || "";
  $("ot_ghichu").value = rec.ghi_chu || "";
  renderOilParamTable(false, "ot");
  _editingOltcRecords = {};
  group.forEach((r) => {
    const col = rec.oltc_sample_point === "pharieng" ? (r.phase || "A") : "X";
    _editingOltcRecords[col] = r;
    DGA.OIL_PARAM_DEFS.forEach((d) => {
      const el = $(oilInputId(d.field, col, "ot"));
      if (el && r[d.field] !== null && r[d.field] !== undefined && r[d.field] !== "") el.value = r[d.field];
    });
  });
  updateOilGroupCounts(true, "ot");
  $("editingOltcOilTestNote").classList.remove("hidden");
  $("btnCancelEditOltcOilTest").classList.remove("hidden");
  $("btnAnalyzeOltcOil").textContent = "Cập nhật & Lưu";
  // Đảm bảo khối "Dầu MBA chính"/OLTC đang HIỆN trước khi cuộn tới — xem toggleDauEquipmentType(), app-core.js.
  $("dau_equipmenttype").value = DGA.EQUIPMENT_TYPES.MBA;
  toggleDauEquipmentType();
  document.querySelector('button.tab-btn[data-tab="dau"]').click();
  $("ot_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}

/** Bản ghi OLTC đã lưu cùng thiết bị + ngày + điểm lấy mẫu + pha. */
function oltcFindExisting(rec) {
  const day = DGA.formatSampleDate(rec.sample_date);
  const key = DGA.oilSeriesKey(rec);
  return _allOltcOilTests.find((r) => DGA.oilSeriesKey(r) === key && DGA.formatSampleDate(r.sample_date) === day &&
    (r.oltc_sample_point || "trungtinh") === (rec.oltc_sample_point || "trungtinh")) || null;
}

async function onAnalyzeOltcOil() {
  const oltcSamplePoint = $("ot_samplepoint").value || "trungtinh";
  const header = {
    tram: $("ot_tram").value.trim(),
    thiet_bi: $("ot_thietbi").value.trim(),
    oltc_sample_point: oltcSamplePoint,
    voltage_class: $("ot_voltage_class").value,
    oil_state: $("ot_oilstate").value,
    has_membrane_n2: !$("ot_membrane_wrap").classList.contains("hidden") && $("ot_membrane").checked,
    manufacturer: $("ot_nsx").value || null,
    sample_date: $("ot_ngay").value,
    ghi_chu: $("ot_ghichu").value.trim(),
  };
  if (!header.thiet_bi || !header.sample_date) {
    notifyError("Dầu OLTC: vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
    return;
  }
  const vals = readOilParamValues("ot");
  const cols = oilFormCols("ot").filter((c) => vals[c] && Object.keys(vals[c]).length > 0);
  if (cols.length === 0) {
    notifyError(oltcSamplePoint === "pharieng"
      ? "Dầu OLTC: vui lòng nhập kết quả cho ít nhất 1 pha (A, B hoặc C)."
      : "Dầu OLTC: vui lòng nhập ít nhất 1 chỉ tiêu thí nghiệm.");
    return;
  }
  const negatives = [];
  cols.forEach((c) => Object.entries(vals[c]).forEach(([f, v]) => {
    const d = DGA.oilParamDef(f);
    if (d && d.type !== "select") negatives.push({ label: d.label + " OLTC" + (c === "X" ? "" : ` (pha ${c})`), value: v });
  }));
  if (alertIfNegative(negatives)) return;

  const records = cols.map((col) => {
    const rec = { ...header, phase: col === "X" ? "" : col };
    DGA.OIL_PARAM_DEFS.forEach((d) => { if (OIL_PARAM_FORMS.ot.groups.includes(d.group)) rec[d.field] = vals[col][d.field] ?? null; });
    const editing = _editingOltcRecords[col] || null;
    const existing = editing || oltcFindExisting(rec);
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

  const stds = toOilStandardsForLogic(_allStandards);
  const results = records.map((rec) => ({ col: rec.phase || "X", rec, qd: DGA.evaluateOltcRecord(rec, stds, _allOltcOilTests || []) }));
  renderOltcOilResults(results);
  if (typeof oilBbtnExportSetOltc === "function") oilBbtnExportSetOltc(header, results);

  if (!canSaveEntry()) return;
  if (overwrite.length) {
    const what = overwrite.some((r) => r.phase) ? `của ${overwrite.map((r) => "pha " + r.phase).join(", ")} ` : "";
    if (!confirm(`Đã có thí nghiệm dầu OLTC ${what}của thiết bị này cùng ngày lấy mẫu. Ghi đè bằng số liệu mới?`)) return;
  }
  const wasEditing = Object.keys(_editingOltcRecords).length > 0;
  // Cùng biên bản với phần thùng chính (BBTN đọc từ file) → dùng chung file + bbtn_group_id (ui-oil.js)
  const file = typeof oilBbtnPendingFile === "function" ? oilBbtnPendingFile() : null;
  const groupId = records.find((r) => r.bbtn_group_id)?.bbtn_group_id || (typeof oilBbtnGroupId === "function" ? oilBbtnGroupId() : "") ||
    (records.length > 1 || file ? Storage.newId() : "");
  records.forEach((r) => { if (groupId) r.bbtn_group_id = groupId; });

  const btn = $("btnAnalyzeOltcOil");
  btn.disabled = true;
  try {
    if (file) {
      try {
        const attachment = await oilBbtnUpload(groupId);
        records.forEach((rec) => Object.assign(rec, attachment));
      } catch (err) {
        notifyError("Dầu OLTC: đã hiển thị kết quả, nhưng CHƯA LƯU vì không tải được file BBTN lên: " + storageErrorMessage(err));
        return;
      }
    }
    const saved = [];
    try {
      for (const rec of records) {
        await Storage.addOltcOilTest(rec);
        saved.push(rec.phase ? "pha " + rec.phase : "mẫu chung");
      }
    } catch (err) {
      notifyError(`Dầu OLTC: đã lưu ${saved.length ? saved.join(", ") : "0 bản ghi"}, phần còn lại LƯU THẤT BẠI: ${storageErrorMessage(err)}`);
      await refreshOltcOilTestsUI();
      return;
    }
    await registerStationIfNew(header.tram);
    resetOltcOilTestEditState();
    await refreshOltcOilTestsUI();
    showToast(`${wasEditing ? "Đã cập nhật" : "Đã lưu"} thí nghiệm dầu OLTC: ${saved.join(", ")}.`);
    return true;
  } finally {
    btn.disabled = false;
  }
}

/** Kết quả đánh giá dầu OLTC — 1 hoặc nhiều cột (pha); results: [{ col, qd }]. */
function renderOltcOilResults(results) {
  $("oltcOilResultsPanel").classList.remove("hidden");
  const multi = results.length > 1 || results[0].col !== "X";
  $("ot_overall").innerHTML = results.map((x) => (multi ? `<span style="margin-right:6px; font-size:14px; font-weight:600;">${oilColLabel(x.col)}:</span>` : "") +
    oilOverallPill(x.qd.overall)).join('<span style="margin:0 10px; color:var(--text-tertiary);">|</span>');
  $("ot_resultTable").innerHTML = results.map((x) => {
    const head = multi ? `<tr class="oil-result-phase-head"><td colspan="6"><span class="phase-dot ${x.col.toLowerCase()}"></span><strong>${oilColLabel(x.col)}</strong> — ${oilOverallPill(x.qd.overall)}</td></tr>` : "";
    return head + x.qd.rows.map((r) => `
    <tr>
      <td>${escapeHtml(r.label)}</td><td>${oilRowValue(r)}</td>
      <td>${escapeHtml(r.limitText ?? (r.limit === null ? "—" : (r.direction === "ge" ? "≥ " : "≤ ") + r.limit))}</td>
      <td>${escapeHtml(r.unit || "")}</td><td>${verdictPill(r.verdict)}</td>
      <td style="font-size:12px;">${escapeHtml(r.ref || "")}</td>
    </tr>`).join("");
  }).join("");
  if (typeof $("oltcOilResultsPanel").scrollIntoView === "function") {
    $("oltcOilResultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/** Vẽ danh sách dòng thí nghiệm dầu OLTC vào 1 bảng bất kỳ — DÙNG CHUNG cho bảng ở tab "Lý-Hóa dầu"
 *  (#oltcOilHistoryTable) và bảng chỉ-để-xem ở tab "Lịch sử đo" (#lichsuOltcHistoryTable). */
function renderOltcOilTestRows(tbodyId, emptyId, sortedRecords) {
  const tbody = $(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  const emptyEl = $(emptyId);
  if (emptyEl) emptyEl.classList.toggle("hidden", sortedRecords.length > 0);

  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);
  sortedRecords.forEach((rec) => {
    const evalResult = DGA.evaluateOltcRecord(rec, oilStandardsForLogic, _allOltcOilTests);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(DGA.formatSampleDate(rec.sample_date))}</td>
      <td>${escapeHtml(rec.tram || "—")}</td>
      <td>${escapeHtml(rec.thiet_bi)}</td>
      <td>${escapeHtml(oltcSamplePointLabel(rec.oltc_sample_point))}</td>
      <td>${rec.phase ? escapeHtml(rec.phase) : "—"}</td>
      <td>${escapeHtml(oilVoltageClassLabel(rec.voltage_class))}</td>
      <td>${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${escapeHtml(rec.moisture_ppm ?? "—")}</td>
      <td>${escapeHtml(rec.bdv_kv ?? "—")}</td>
      <td style="font-size:12px;">${oilExtraSummaryHtml(rec, evalResult)}</td>
      <td>${oilOverallPill(evalResult.overall)}</td>
      <td>${ownerCellHtml(rec)}</td>
      <td class="actions-cell">${rowActionsHtml([
        rowActionBtn("view", "eye",
          rec.bbtn_url ? "Xem biên bản thí nghiệm đã đính kèm" : "Xem chi tiết thí nghiệm dầu OLTC",
          { cls: "btn-action-hist" }),
        canEditRecord(rec) && rowActionBtn("edit", "edit", "Sửa kết quả thí nghiệm dầu OLTC này", { cls: "btn-action-hist" }),
        canWrite() && rowActionBtn("del", "trash", "Xóa kết quả thí nghiệm dầu OLTC này", { danger: true, cls: "btn-action-hist" }),
      ])}</td>
    `;
    const viewBtn = tr.querySelector('[data-action="view"]');
    if (viewBtn) {
      viewBtn.addEventListener("click", () => {
        if (rec.bbtn_url && typeof viewBbtn === "function") {
          viewBbtn({ bbtn_url: rec.bbtn_url, bbtn_name: rec.bbtn_name });
        } else {
          onEditOltcOilTest(rec);
        }
      });
    }
    const editBtn = tr.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener("click", () => onEditOltcOilTest(rec));
    const delBtn = tr.querySelector('[data-action="del"]');
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (confirm("Xóa thí nghiệm dầu OLTC này khỏi lịch sử?")) {
          try {
            await Storage.deleteOltcOilTest(rec.id);
            await refreshOltcOilTestsUI();
          } catch (err) {
            notifyError(storageErrorMessage(err));
          }
        }
      });
    }
    tbody.appendChild(tr);
  });
}

async function refreshOltcOilTestsUI() {
  const all = await Storage.listOltcOilTests();
  _allOltcOilTests = all;
  const sorted = all.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  renderOltcOilTestRows("oltcOilHistoryTable", "oltcOilHistoryEmpty", sorted);
  if (typeof refreshLichSuOltcTable === "function") refreshLichSuOltcTable();

  refreshTrendDeviceOptions();
  refreshAlertsUI();
}
