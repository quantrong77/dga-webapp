/* ui-oltc.js — Thí nghiệm dầu OLTC (bộ đổi nấc có tải), phần dưới của tab "Dầu cách
   điện". Tách từ app.js — xem ui-auth.js đầu file đó để biết quy ước chia sẻ scope
   giữa các file ui-*.js. */

function populateOltcOptions() {
  $("ot_samplepoint").innerHTML = DGA.OLTC_SAMPLE_POINTS.map(
    (p) => `<option value="${p.value}">${escapeHtml(p.label)}</option>`
  ).join("");
  $("ot_voltage_class").innerHTML = DGA.OIL_VOLTAGE_CLASSES.map(
    (c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`
  ).join("");
}

// Pha (A/B/C) chỉ có ý nghĩa khi OLTC lấy mẫu kiểu "pharieng" (mỗi pha 1 khoang/mẫu
// riêng) — "trungtinh" là 1 mẫu chung cho cả 3 pha nên ẩn hẳn ô chọn Pha.
function toggleOltcPhaseField() {
  $("ot_phase_wrap").classList.toggle("hidden", $("ot_samplepoint").value !== "pharieng");
}

// Giống toggleOilMembraneField() ở dầu chính — chỉ có ý nghĩa khi dầu OLTC MỚI LẮP
// (lúc đó áp dụng tiêu chuẩn dầu chính MBA, Bảng 58 có phân biệt có/không màng ở
// 1 số cấp điện áp); dầu OLTC vận hành dùng Bảng 49 riêng, không có khái niệm này.
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

// _editingOltcOilTestId: id của thí nghiệm dầu OLTC đang SỬA (null = đang nhập MỚI).
let _editingOltcOilTestId = null;

function clearOltcOilForm() {
  ["ot_tram", "ot_thietbi", "ot_ghichu", "ot_moisture", "ot_tgd90", "ot_bdv"].forEach((id) => ($(id).value = ""));
  $("ot_membrane").checked = false;
  $("ot_nsx").value = "";
  $("oltcOilResultsPanel").classList.add("hidden");
  resetOltcOilTestEditState();
}

function resetOltcOilTestEditState() {
  _editingOltcOilTestId = null;
  $("editingOltcOilTestNote").classList.add("hidden");
  $("btnCancelEditOltcOilTest").classList.add("hidden");
  $("btnAnalyzeOltcOil").textContent = "Đánh giá & Lưu";
}

/** Nạp 1 thí nghiệm dầu OLTC đã lưu lên form để sửa — xem onEditMeasurement() ở trên. */
function onEditOltcOilTest(rec) {
  if (!canEditRecord(rec)) return;
  _editingOltcOilTestId = rec.id;
  $("ot_tram").value = rec.tram || "";
  $("ot_thietbi").value = rec.thiet_bi || "";
  $("ot_samplepoint").value = rec.oltc_sample_point || "";
  toggleOltcPhaseField();
  if (rec.oltc_sample_point === "pharieng") $("ot_phase").value = rec.phase || "A";
  $("ot_voltage_class").value = rec.voltage_class || "";
  toggleOltcMembraneField();
  $("ot_oilstate").value = rec.oil_state || "inservice";
  $("ot_nsx").value = rec.manufacturer || "";
  $("ot_membrane").checked = !!rec.has_membrane_n2;
  $("ot_ngay").value = DGA.formatSampleDate(rec.sample_date) || "";
  $("ot_moisture").value = rec.moisture_ppm ?? "";
  $("ot_tgd90").value = rec.tgd_90c_percent ?? "";
  $("ot_bdv").value = rec.bdv_kv ?? "";
  $("ot_ghichu").value = rec.ghi_chu || "";
  $("editingOltcOilTestNote").classList.remove("hidden");
  $("btnCancelEditOltcOilTest").classList.remove("hidden");
  $("btnAnalyzeOltcOil").textContent = "Cập nhật & Lưu";
  // Đảm bảo khối "Dầu MBA chính"/OLTC đang HIỆN (không bị #dau_equipmenttype ẩn đi vì
  // đang để ở loại khác) trước khi cuộn tới — xem toggleDauEquipmentType(), app-core.js.
  $("dau_equipmenttype").value = DGA.EQUIPMENT_TYPES.MBA;
  toggleDauEquipmentType();
  document.querySelector('button.tab-btn[data-tab="dau"]').click();
  $("ot_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function onAnalyzeOltcOil() {
  const oltcSamplePoint = $("ot_samplepoint").value;
  const phase = oltcSamplePoint === "pharieng" ? $("ot_phase").value : "";
  const voltageClass = $("ot_voltage_class").value;
  const oilState = $("ot_oilstate").value;
  const hasMembraneN2 = !$("ot_membrane_wrap").classList.contains("hidden") && $("ot_membrane").checked;
  const manufacturer = $("ot_nsx").value || null;

  const oltcOilTest = {
    id: _editingOltcOilTestId || undefined,
    tram: $("ot_tram").value.trim(),
    thiet_bi: $("ot_thietbi").value.trim(),
    oltc_sample_point: oltcSamplePoint,
    phase,
    voltage_class: voltageClass,
    oil_state: oilState,
    has_membrane_n2: hasMembraneN2,
    manufacturer,
    sample_date: $("ot_ngay").value,
    moisture_ppm: $("ot_moisture").value === "" ? null : Number($("ot_moisture").value),
    tgd_90c_percent: $("ot_tgd90").value === "" ? null : Number($("ot_tgd90").value),
    bdv_kv: $("ot_bdv").value === "" ? null : Number($("ot_bdv").value),
    ghi_chu: $("ot_ghichu").value.trim(),
  };

  if (!oltcOilTest.thiet_bi || !oltcOilTest.sample_date) {
    notifyError("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
    return;
  }
  if (oltcOilTest.moisture_ppm === null && oltcOilTest.tgd_90c_percent === null && oltcOilTest.bdv_kv === null) {
    notifyError("Vui lòng nhập ít nhất 1 trong 3 giá trị: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng dầu.");
    return;
  }
  if (alertIfNegative([
    { label: "Độ ẩm dầu OLTC", value: oltcOilTest.moisture_ppm },
    { label: "tgδ ở 90°C", value: oltcOilTest.tgd_90c_percent },
    { label: "Điện áp chọc thủng", value: oltcOilTest.bdv_kv },
  ])) return;

  const evalResult = DGA.evaluateOltcOilTest({
    oltcSamplePoint, voltageClass, oilState, hasMembraneN2, manufacturer,
    manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
    moisture: oltcOilTest.moisture_ppm, tgd90: oltcOilTest.tgd_90c_percent, bdv: oltcOilTest.bdv_kv,
  });
  renderOltcOilResults(evalResult);

  if (!canSaveEntry()) return;
  const wasEditing = !!_editingOltcOilTestId;

  try {
    await Storage.addOltcOilTest(oltcOilTest);
    await registerStationIfNew(oltcOilTest.tram);
    resetOltcOilTestEditState();
    await refreshOltcOilTestsUI();
    if (wasEditing) showToast("Đã cập nhật thí nghiệm dầu OLTC.");
  } catch (err) {
    notifyError("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + storageErrorMessage(err));
  }
}

function renderOltcOilResults(evalResult) {
  $("oltcOilResultsPanel").classList.remove("hidden");
  $("ot_overall").innerHTML =
    evalResult.overall === "Đạt" ? `<span class="pill ok">Đạt</span>`
    : evalResult.overall === "Chưa đủ dữ liệu" ? `<span class="pill muted">Chưa đủ dữ liệu</span>`
    : `<span class="pill bad">Không đạt</span>`;
  $("ot_resultTable").innerHTML = evalResult.rows.map((r) => `
    <tr>
      <td>${r.label}</td><td>${r.value}</td>
      <td>${r.limit === null ? "—" : (r.direction === "ge" ? "≥ " : "≤ ") + r.limit}</td>
      <td>${r.unit}</td><td>${verdictPill(r.verdict)}</td>
      <td style="font-size:12px;">${r.ref}</td>
    </tr>
  `).join("");
  if (typeof $("oltcOilResultsPanel").scrollIntoView === "function") {
    $("oltcOilResultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/** Vẽ danh sách dòng thí nghiệm dầu OLTC vào 1 bảng bất kỳ — DÙNG CHUNG cho bảng
 *  "gốc" ở tab "Dầu cách điện" (#oltcOilHistoryTable) LẪN bảng mirror chỉ-để-xem ở tab
 *  "Lịch sử đo" (#lichsuOltcHistoryTable, xem refreshLichSuOltcTable() ở ui-history.js)
 *  — xem chú thích y hệt ở renderOilTestRows() (ui-oil.js). */
function renderOltcOilTestRows(tbodyId, emptyId, sortedRecords) {
  const tbody = $(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  const emptyEl = $(emptyId);
  if (emptyEl) emptyEl.classList.toggle("hidden", sortedRecords.length > 0);

  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);
  sortedRecords.forEach((rec) => {
    const evalResult = DGA.evaluateOltcOilTest({
      oltcSamplePoint: rec.oltc_sample_point, voltageClass: rec.voltage_class, oilState: rec.oil_state,
      hasMembraneN2: rec.has_membrane_n2, manufacturer: rec.manufacturer || null,
      manufacturerOilStandards: oilStandardsForLogic,
      moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
    });
    const overallPill =
      evalResult.overall === "Đạt" ? verdictPill("Đạt")
      : evalResult.overall === "Chưa đủ dữ liệu" ? `<span class="pill muted">Chưa đủ dữ liệu</span>`
      : verdictPill("Không đạt");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${DGA.formatSampleDate(rec.sample_date)}</td>
      <td>${escapeHtml(rec.tram || "—")}</td>
      <td>${escapeHtml(rec.thiet_bi)}</td>
      <td>${escapeHtml(oltcSamplePointLabel(rec.oltc_sample_point))}</td>
      <td>${rec.phase ? escapeHtml(rec.phase) : "—"}</td>
      <td>${escapeHtml(oilVoltageClassLabel(rec.voltage_class))}</td>
      <td>${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${rec.moisture_ppm ?? "—"}</td>
      <td>${rec.bdv_kv ?? "—"}</td>
      <td>${overallPill}</td>
      <td>${ownerCellHtml(rec)}</td>
      <td class="actions-cell"><div class="btn-row">
        ${canEditRecord(rec) ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button>` : ""}
        ${canWrite() ? `<button class="btn danger" data-action="del" style="padding:5px 10px; font-size:12px;">Xóa</button>` : ""}
      </div></td>
    `;
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
