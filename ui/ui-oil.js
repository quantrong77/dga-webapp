/* ui-oil.js — Tab "Dầu cách điện": thí nghiệm dầu chính MBA/Kháng dầu (độ ẩm, tgδ
   90°C, điện áp chọc thủng — Bảng 58/55/54 QĐ1901). Tách từ app.js — xem ui-auth.js
   đầu file đó để biết quy ước chia sẻ scope giữa các file ui-*.js. */

// ---------------------------------------------------------------------
// Tab "Dầu cách điện" — Độ ẩm dầu (ppm), tgδ ở 90°C (%), Điện áp chọc thủng
// dầu (kV), theo Bảng 58/55/54 QĐ1901 (Điều 50/47/46), phân theo cấp điện áp
// MBA. Chỉ áp dụng MBA/Kháng dầu. IEC 60599:1999 không tự quy định 3 hạng mục
// này (thuộc phạm vi IEC 60422) nên chỉ đối chiếu theo đúng bảng của QĐ1901 —
// xem DGA.evaluateOilTest() trong dga-logic.js.
// ---------------------------------------------------------------------
function populateOilVoltageClasses() {
  const optionsHtml = DGA.OIL_VOLTAGE_CLASSES.map(
    (c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`
  ).join("");
  $("o_voltage_class").innerHTML = optionsHtml;
  $("s_oil_voltage_class").innerHTML = optionsHtml;
  $("o_samplepoint").innerHTML = DGA.OIL_SAMPLE_POINTS.map(
    (p) => `<option value="${p.value}">${escapeHtml(p.label)}</option>`
  ).join("");
}

// Pha (A/B/C) chỉ có ý nghĩa khi MBA/Kháng lấy mẫu kiểu "pharieng" (3 pha rời, mỗi
// pha 1 thùng dầu/1 mẫu riêng, thường gặp ở 500kV) — "chung" là 1 mẫu đại diện cho
// cả 3 pha nên ẩn hẳn ô chọn Pha, giống hệt toggleOltcPhaseField() ở dầu OLTC.
function toggleOilPhaseField() {
  $("o_phase_wrap").classList.toggle("hidden", $("o_samplepoint").value !== "pharieng");
}

function oilSamplePointLabel(sp) {
  const found = DGA.OIL_SAMPLE_POINTS.find((p) => p.value === sp);
  return found ? found.label : sp || "—";
}

// "Có bảo vệ màng/nitơ" chỉ có ý nghĩa với các cấp điện áp mà Bảng 58 phân biệt
// 2 mức (có/không màng) — suy ra trực tiếp từ DGA.bang58WaterLimits() thay vì
// lặp lại danh sách cấp điện áp ở đây, để luôn khớp với dga-logic.js.
function toggleOilMembraneField() {
  const vc = $("o_voltage_class").value;
  const withMembrane = DGA.bang58WaterLimits(vc, true);
  const withoutMembrane = DGA.bang58WaterLimits(vc, false);
  const applicable = withMembrane.new !== withoutMembrane.new || withMembrane.inservice !== withoutMembrane.inservice;
  $("o_membrane_wrap").classList.toggle("hidden", !applicable);
  if (!applicable) $("o_membrane").checked = false;
}

// _editingOilTestId: id của thí nghiệm dầu MBA đang SỬA (null = đang nhập MỚI).
let _editingOilTestId = null;

function clearOilForm() {
  ["o_tram", "o_thietbi", "o_ghichu", "o_moisture", "o_tgd90", "o_bdv"].forEach((id) => ($(id).value = ""));
  $("o_membrane").checked = false;
  $("o_nsx").value = "";
  $("o_samplepoint").value = "chung";
  toggleOilPhaseField();
  $("oilResultsPanel").classList.add("hidden");
  resetOilTestEditState();
}

function resetOilTestEditState() {
  _editingOilTestId = null;
  $("editingOilTestNote").classList.add("hidden");
  $("btnCancelEditOilTest").classList.add("hidden");
  $("btnAnalyzeOil").textContent = "Đánh giá & Lưu";
}

/** Nạp 1 thí nghiệm dầu MBA đã lưu lên form để sửa — xem onEditMeasurement() ở trên. */
function onEditOilTest(rec) {
  if (!canEditRecord(rec)) return;
  _editingOilTestId = rec.id;
  $("o_tram").value = rec.tram || "";
  $("o_thietbi").value = rec.thiet_bi || "";
  $("o_samplepoint").value = rec.oil_sample_point || "chung";
  toggleOilPhaseField();
  if (rec.oil_sample_point === "pharieng") $("o_phase").value = rec.phase || "A";
  $("o_voltage_class").value = rec.voltage_class || "";
  toggleOilMembraneField();
  $("o_oilstate").value = rec.oil_state || "inservice";
  $("o_nsx").value = rec.manufacturer || "";
  $("o_membrane").checked = !!rec.has_membrane_n2;
  $("o_ngay").value = DGA.formatSampleDate(rec.sample_date) || "";
  $("o_moisture").value = rec.moisture_ppm ?? "";
  $("o_tgd90").value = rec.tgd_90c_percent ?? "";
  $("o_bdv").value = rec.bdv_kv ?? "";
  $("o_ghichu").value = rec.ghi_chu || "";
  $("editingOilTestNote").classList.remove("hidden");
  $("btnCancelEditOilTest").classList.remove("hidden");
  $("btnAnalyzeOil").textContent = "Cập nhật & Lưu";
  // Đảm bảo khối "Dầu MBA chính" đang HIỆN (không bị #dau_equipmenttype ẩn đi vì đang
  // để ở loại khác) trước khi cuộn tới — xem toggleDauEquipmentType(), app-core.js.
  $("dau_equipmenttype").value = DGA.EQUIPMENT_TYPES.MBA;
  toggleDauEquipmentType();
  document.querySelector('button.tab-btn[data-tab="dau"]').click();
  $("o_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function onAnalyzeOil() {
  const oilSamplePoint = $("o_samplepoint").value || "chung";
  const phase = oilSamplePoint === "pharieng" ? $("o_phase").value : "";
  const voltageClass = $("o_voltage_class").value;
  const oilState = $("o_oilstate").value;
  const hasMembraneN2 = !$("o_membrane_wrap").classList.contains("hidden") && $("o_membrane").checked;
  const manufacturer = $("o_nsx").value || null;

  const oilTest = {
    id: _editingOilTestId || undefined,
    tram: $("o_tram").value.trim(),
    thiet_bi: $("o_thietbi").value.trim(),
    oil_sample_point: oilSamplePoint,
    phase,
    voltage_class: voltageClass,
    oil_state: oilState,
    has_membrane_n2: hasMembraneN2,
    manufacturer,
    sample_date: $("o_ngay").value,
    moisture_ppm: $("o_moisture").value === "" ? null : Number($("o_moisture").value),
    tgd_90c_percent: $("o_tgd90").value === "" ? null : Number($("o_tgd90").value),
    bdv_kv: $("o_bdv").value === "" ? null : Number($("o_bdv").value),
    ghi_chu: $("o_ghichu").value.trim(),
  };

  if (!oilTest.thiet_bi || !oilTest.sample_date) {
    alert("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
    return;
  }
  if (oilTest.moisture_ppm === null && oilTest.tgd_90c_percent === null && oilTest.bdv_kv === null) {
    alert("Vui lòng nhập ít nhất 1 trong 3 giá trị: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng dầu.");
    return;
  }
  if (alertIfNegative([
    { label: "Độ ẩm dầu", value: oilTest.moisture_ppm },
    { label: "tgδ ở 90°C", value: oilTest.tgd_90c_percent },
    { label: "Điện áp chọc thủng", value: oilTest.bdv_kv },
  ])) return;

  const evalResult = DGA.evaluateOilTest({
    voltageClass, oilState, hasMembraneN2, manufacturer,
    manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
    moisture: oilTest.moisture_ppm, tgd90: oilTest.tgd_90c_percent, bdv: oilTest.bdv_kv,
  });
  renderOilResults(evalResult);

  // Lưu vào lịch sử — mọi user đã đăng nhập đều lưu được, y hệt onAnalyze().
  if (!canSaveEntry()) return;
  const wasEditing = !!_editingOilTestId;

  try {
    await Storage.addOilTest(oilTest);
    await registerStationIfNew(oilTest.tram);
    resetOilTestEditState();
    await refreshOilTestsUI();
    if (wasEditing) showToast("Đã cập nhật thí nghiệm dầu.");
  } catch (err) {
    alert("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + storageErrorMessage(err));
  }
}

function renderOilResults(evalResult) {
  $("oilResultsPanel").classList.remove("hidden");
  $("o_overall").innerHTML =
    evalResult.overall === "Đạt" ? `<span class="pill ok">Đạt</span>`
    : evalResult.overall === "Chưa đủ dữ liệu" ? `<span class="pill muted">Chưa đủ dữ liệu</span>`
    : `<span class="pill bad">Không đạt</span>`;
  $("o_resultTable").innerHTML = evalResult.rows.map((r) => `
    <tr>
      <td>${r.label}</td><td>${r.value}</td>
      <td>${r.direction === "ge" ? "≥ " : "≤ "}${r.limit}</td>
      <td>${r.unit}</td><td>${verdictPill(r.verdict)}</td>
      <td style="font-size:12px;">${r.ref}</td>
    </tr>
  `).join("");
  if (typeof $("oilResultsPanel").scrollIntoView === "function") {
    $("oilResultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/** Vẽ danh sách dòng thí nghiệm dầu MBA chính vào 1 bảng bất kỳ (tbody/emptyId truyền
 *  vào) — tách riêng khỏi refreshOilTestsUI() để DÙNG CHUNG cho cả bảng "gốc" ở tab
 *  "Dầu cách điện" (#oilHistoryTable) LẪN bảng mirror chỉ-để-xem ở tab "Lịch sử đo"
 *  (#lichsuOilHistoryTable, xem refreshLichSuOilTable() ở ui-history.js) — tránh lặp
 *  lại y hệt logic tính evalResult/dựng HTML ở 2 nơi rồi dễ lệch nhau về sau. Nút "Sửa"
 *  LUÔN nhảy sang tab "Dầu cách điện" (onEditOilTest() đã tự làm việc này) — bảng mirror
 *  không có form nhập liệu riêng nên không thể sửa tại chỗ. */
function renderOilTestRows(tbodyId, emptyId, sortedRecords) {
  const tbody = $(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  const emptyEl = $(emptyId);
  if (emptyEl) emptyEl.classList.toggle("hidden", sortedRecords.length > 0);

  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);
  sortedRecords.forEach((rec) => {
    const evalResult = DGA.evaluateOilTest({
      voltageClass: rec.voltage_class, oilState: rec.oil_state, hasMembraneN2: rec.has_membrane_n2,
      manufacturer: rec.manufacturer || null, manufacturerOilStandards: oilStandardsForLogic,
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
      <td>${escapeHtml(oilSamplePointLabel(rec.oil_sample_point || "chung"))}</td>
      <td>${rec.phase ? escapeHtml(rec.phase) : "—"}</td>
      <td>${escapeHtml(oilVoltageClassLabel(rec.voltage_class))}</td>
      <td>${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}</td>
      <td>${rec.moisture_ppm ?? "—"}</td>
      <td>${rec.tgd_90c_percent ?? "—"}</td>
      <td>${rec.bdv_kv ?? "—"}</td>
      <td>${overallPill}</td>
      <td>${ownerCellHtml(rec)}</td>
      <td class="actions-cell"><div class="btn-row">
        ${canEditRecord(rec) ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button>` : ""}
        ${canWrite() ? `<button class="btn danger" data-action="del" style="padding:5px 10px; font-size:12px;">Xóa</button>` : ""}
      </div></td>
    `;
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
            alert(storageErrorMessage(err));
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
  const sorted = all.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  renderOilTestRows("oilHistoryTable", "oilHistoryEmpty", sorted);
  // Mirror ở tab "Lịch sử đo" (xem ui-history.js) — có thể chưa tải xong lúc hàm này
  // chạy lần đầu (thứ tự <script> tag), nhưng vì initApp() chỉ GỌI hàm này (không
  // định nghĩa) sau khi mọi script đã tải xong nên luôn tồn tại tới lúc chạy thật.
  if (typeof refreshLichSuOilTable === "function") refreshLichSuOilTable();

  refreshTrendDeviceOptions();
  refreshAlertsUI();
}

// ---------------------------------------------------------------------
// Dầu khoang điều áp dưới tải (OLTC) — Điều 37/Bảng 49 QĐ1901
// ---------------------------------------------------------------------
