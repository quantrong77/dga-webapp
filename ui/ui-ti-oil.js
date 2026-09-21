/* ui-ti-oil.js — Thí nghiệm dầu cách điện TI/TU (biến dòng điện/biến điện áp kiểu kín,
   cách điện dầu), phần cuối của tab "Dầu cách điện". QĐ1901 Điều 10/11 (xem chú thích
   Bảng 9 mục 12 / Bảng 14 mục 11) không đưa ra bảng số mặc định cho hạng mục này — CHỈ
   đánh giá được khi đã chọn 1 nhà sản xuất có cấu hình tiêu chuẩn dầu TI/TU ở tab "Tiêu
   chuẩn" (xem DGA.evaluateInstrumentOilTest() ở dga-logic.js). Tách theo đúng quy ước
   chia sẻ scope giữa các file ui-*.js — xem ui-auth.js đầu file đó. */

function tioVerdictPill(v) {
  if (v === "Đạt") return `<span class="pill ok">Đạt</span>`;
  if (v === "Cảnh báo") return `<span class="pill warn">Cảnh báo</span>`;
  if (v === "Chưa có tiêu chuẩn nhà sản xuất") return `<span class="pill muted">Chưa có tiêu chuẩn NSX</span>`;
  if (v === "Chưa đủ dữ liệu") return `<span class="pill muted">Chưa đủ dữ liệu</span>`;
  return `<span class="pill bad">Không đạt</span>`;
}

// _editingTioOilTestId: id của thí nghiệm dầu TI/TU đang SỬA (null = đang nhập MỚI).
let _editingTioOilTestId = null;
let _allTioOilTests = [];

function tioEquipmentTypeShort(equipmentType) {
  return equipmentType === DGA.EQUIPMENT_TYPES.TU ? "TU" : "TI";
}

function onTioEquipmentTypeChange() {
  refreshInstrumentOilManufacturerOptions($("tio_equipmenttype").value);
}

function clearTioOilForm() {
  ["tio_tram", "tio_thietbi", "tio_ghichu", "tio_moisture", "tio_tgd90", "tio_bdv"].forEach((id) => ($(id).value = ""));
  $("tio_nsx").value = "";
  $("tioOilResultsPanel").classList.add("hidden");
  resetTioOilTestEditState();
}

function resetTioOilTestEditState() {
  _editingTioOilTestId = null;
  $("editingTioOilTestNote").classList.add("hidden");
  $("btnCancelEditTioOilTest").classList.add("hidden");
  $("btnAnalyzeTioOil").textContent = "Đánh giá & Lưu";
}

/** Nạp 1 thí nghiệm dầu TI/TU đã lưu lên form để sửa — xem onEditMeasurement() ở ui-dga.js. */
function onEditTioOilTest(rec) {
  if (!canEditRecord(rec)) return;
  _editingTioOilTestId = rec.id;
  $("tio_equipmenttype").value = rec.equipment_type || DGA.EQUIPMENT_TYPES.TI;
  refreshInstrumentOilManufacturerOptions($("tio_equipmenttype").value);
  $("tio_tram").value = rec.tram || "";
  $("tio_thietbi").value = rec.thiet_bi || "";
  $("tio_phase").value = rec.phase || "chung3pha";
  $("tio_nsx").value = rec.manufacturer || "";
  $("tio_ngay").value = DGA.formatSampleDate(rec.sample_date) || "";
  $("tio_moisture").value = rec.moisture_ppm ?? "";
  $("tio_tgd90").value = rec.tgd_90c_percent ?? "";
  $("tio_bdv").value = rec.bdv_kv ?? "";
  $("tio_ghichu").value = rec.ghi_chu || "";
  $("editingTioOilTestNote").classList.remove("hidden");
  $("btnCancelEditTioOilTest").classList.remove("hidden");
  $("btnAnalyzeTioOil").textContent = "Cập nhật & Lưu";
  // Đảm bảo khối "Dầu cách điện TI/TU" đang HIỆN (không bị #dau_equipmenttype ẩn đi vì
  // đang để ở loại khác) trước khi cuộn tới — xem toggleDauEquipmentType(), app-core.js.
  $("dau_equipmenttype").value = rec.equipment_type || DGA.EQUIPMENT_TYPES.TI;
  toggleDauEquipmentType();
  document.querySelector('button.tab-btn[data-tab="dau"]').click();
  $("tio_tram").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function onAnalyzeTioOil() {
  const equipmentType = $("tio_equipmenttype").value;
  const manufacturer = $("tio_nsx").value || null;

  const tioOilTest = {
    id: _editingTioOilTestId || undefined,
    equipment_type: equipmentType,
    tram: $("tio_tram").value.trim(),
    thiet_bi: $("tio_thietbi").value.trim(),
    phase: $("tio_phase").value,
    manufacturer,
    sample_date: $("tio_ngay").value,
    moisture_ppm: $("tio_moisture").value === "" ? null : Number($("tio_moisture").value),
    tgd_90c_percent: $("tio_tgd90").value === "" ? null : Number($("tio_tgd90").value),
    bdv_kv: $("tio_bdv").value === "" ? null : Number($("tio_bdv").value),
    ghi_chu: $("tio_ghichu").value.trim(),
  };

  if (!tioOilTest.thiet_bi || !tioOilTest.sample_date) {
    notifyError("Vui lòng nhập ít nhất Thiết bị và Ngày lấy mẫu.");
    return;
  }
  if (tioOilTest.moisture_ppm === null && tioOilTest.tgd_90c_percent === null && tioOilTest.bdv_kv === null) {
    notifyError("Vui lòng nhập ít nhất 1 trong 3 giá trị: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng dầu.");
    return;
  }
  if (!manufacturer) {
    notifyError("QĐ1901 Điều 10/11 không có bảng số mặc định cho dầu TI/TU — vui lòng chọn Nhà sản xuất đã cấu hình tiêu chuẩn ở tab \"Cấu hình\" — mục \"Tiêu chuẩn\" trước.");
    return;
  }
  if (alertIfNegative([
    { label: "Độ ẩm dầu", value: tioOilTest.moisture_ppm },
    { label: "tgδ ở 90°C", value: tioOilTest.tgd_90c_percent },
    { label: "Điện áp chọc thủng", value: tioOilTest.bdv_kv },
  ])) return;

  const evalResult = DGA.evaluateInstrumentOilTest({
    equipmentType, manufacturer,
    manufacturerOilStandards: toOilStandardsForLogic(_allStandards),
    moisture: tioOilTest.moisture_ppm, tgd90: tioOilTest.tgd_90c_percent, bdv: tioOilTest.bdv_kv,
  });
  renderTioOilResults(evalResult);

  if (!canSaveEntry()) return;
  const wasEditing = !!_editingTioOilTestId;

  try {
    await Storage.addInstrumentOilTest(tioOilTest);
    await registerStationIfNew(tioOilTest.tram);
    resetTioOilTestEditState();
    await refreshTioOilTestsUI();
    if (wasEditing) showToast("Đã cập nhật thí nghiệm dầu TI/TU.");
  } catch (err) {
    notifyError("Đã hiển thị kết quả đánh giá, nhưng LƯU THẤT BẠI: " + storageErrorMessage(err));
  }
}

function renderTioOilResults(evalResult) {
  $("tioOilResultsPanel").classList.remove("hidden");
  $("tio_overall").innerHTML = tioVerdictPill(evalResult.overall);
  $("tio_resultTable").innerHTML = evalResult.rows.map((r) => `
    <tr>
      <td>${r.label}</td><td>${r.value}</td>
      <td>${r.limit === null ? "—" : escapeHtml(r.limit)}</td>
      <td>${r.unit}</td><td>${tioVerdictPill(r.verdict)}</td>
      <td style="font-size:12px;">${escapeHtml(r.ref)}</td>
    </tr>
  `).join("");
  if (typeof $("tioOilResultsPanel").scrollIntoView === "function") {
    $("tioOilResultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderTioOilTestRows(tbodyId, emptyId, sortedRecords) {
  const tbody = $(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  const emptyEl = $(emptyId);
  if (emptyEl) emptyEl.classList.toggle("hidden", sortedRecords.length > 0);

  const oilStandardsForLogic = toOilStandardsForLogic(_allStandards);
  sortedRecords.forEach((rec) => {
    const equipmentType = rec.equipment_type || DGA.EQUIPMENT_TYPES.TI;
    const evalResult = DGA.evaluateInstrumentOilTest({
      equipmentType, manufacturer: rec.manufacturer || null,
      manufacturerOilStandards: oilStandardsForLogic,
      moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
    });

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${DGA.formatSampleDate(rec.sample_date)}</td>
      <td>${escapeHtml(rec.tram || "—")}</td>
      <td>${escapeHtml(rec.thiet_bi)}</td>
      <td>${tioEquipmentTypeShort(equipmentType)}</td>
      <td>${rec.phase ? escapeHtml(DGA.phaLabelWithPrefix(rec.phase)) : "—"}</td>
      <td>${escapeHtml(rec.manufacturer || "—")}</td>
      <td>${rec.moisture_ppm ?? "—"}</td>
      <td>${rec.tgd_90c_percent ?? "—"}</td>
      <td>${rec.bdv_kv ?? "—"}</td>
      <td>${tioVerdictPill(evalResult.overall)}</td>
      <td>${ownerCellHtml(rec)}</td>
      <td class="actions-cell"><div class="btn-row">
        ${canEditRecord(rec) ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button>` : ""}
        ${canWrite() ? `<button class="btn danger" data-action="del" style="padding:5px 10px; font-size:12px;">Xóa</button>` : ""}
      </div></td>
    `;
    const editBtn = tr.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener("click", () => onEditTioOilTest(rec));
    const delBtn = tr.querySelector('[data-action="del"]');
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (confirm("Xóa thí nghiệm dầu TI/TU này khỏi lịch sử?")) {
          try {
            await Storage.deleteInstrumentOilTest(rec.id);
            await refreshTioOilTestsUI();
          } catch (err) {
            notifyError(storageErrorMessage(err));
          }
        }
      });
    }
    tbody.appendChild(tr);
  });
}

async function refreshTioOilTestsUI() {
  const all = await Storage.listInstrumentOilTests();
  _allTioOilTests = all;
  const sorted = all.slice().sort((a, b) => new Date(b.sample_date) - new Date(a.sample_date));
  renderTioOilTestRows("tioOilHistoryTable", "tioOilHistoryEmpty", sorted);
  // Mirror ở tab "Lịch sử đo" (bảng con #lichsuInstrumentOilHistoryTable, xem
  // refreshLichSuInstrumentOilTable() ở ui-history.js) — cùng lý do/quy ước đã áp dụng
  // cho refreshOilTestsUI()/refreshOltcOilTestsUI() (ui-oil.js/ui-oltc.js).
  if (typeof refreshLichSuInstrumentOilTable === "function") refreshLichSuInstrumentOilTable();

  // QUAN TRỌNG: trước đây hàm này THIẾU dòng gọi refreshAlertsUI() (khác hẳn 3 hàm
  // refreshHistoryUI()/refreshOilTestsUI()/refreshOltcOilTestsUI() đều có gọi ở cuối) —
  // khiến tab "Cảnh báo" (ui-alerts.js) không CHẮC CHẮN phản ánh đúng dữ liệu dầu TI/TU
  // mới nhất. Trong initApp() (app-core.js), refreshTioOilTestsUI() là hàm CUỐI CÙNG
  // trong chuỗi 4 nguồn dữ liệu được await tuần tự — nếu không tự gọi refreshAlertsUI()
  // ở đây, bảng "Cảnh báo" lúc mới mở app CHỈ đúng một cách TÌNH CỜ (khi
  // setupLichSuViewToggle() gọi lại xuống refreshHistoryUI() ở cuối initApp() — CHỈ xảy
  // ra khi view "Lịch sử đo" đã lưu là "gas"; nếu người dùng đang để view "Dầu" thì
  // KHÔNG có lệnh gọi refreshAlertsUI() nào chạy SAU KHI _allTioOilTests đã nạp xong,
  // nên cảnh báo dầu TI/TU bị "biến mất" — đúng lỗi người dùng báo cáo: "TI174 pha A
  // không đạt hạng mục độ ẩm dầu nhưng tab Cảnh báo chưa hiển thị"). Gọi thẳng ở đây để
  // LUÔN chắc chắn, không phụ thuộc lựa chọn view nào khác.
  refreshAlertsUI();
}
