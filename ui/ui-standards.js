/* ui-standards.js — Danh mục Trạm + Tiêu chuẩn riêng theo Nhà sản xuất (mục "Tiêu chuẩn"
   trong tab "Cấu hình" — 2 mục "Tiêu chuẩn"/"Quy định" gộp chung 1 tab, chọn bằng
   .cauhinh-subtab-btn, xem setupCauHinhSubtabs() ở app-core.js): CRUD tiêu chuẩn, các hàm
   chuyển đổi bản ghi Storage <-> định dạng
   DGA.evaluate*() cần (dga-logic.js). Tách từ app.js — xem ui-auth.js đầu file đó
   để biết quy ước chia sẻ scope giữa các file ui-*.js. */


// ---------------------------------------------------------------------
// Danh mục Trạm — ô "Trạm" dùng combo box tự viết (xem setupCombo ở trên)
// để vừa gõ-tìm (bỏ dấu), vừa chọn từ danh sách gợi ý qua nút ▼, vừa nhập
// tự do 1 trạm chưa có trong danh mục (không bắt buộc phải khớp 1 mục nào).
// ---------------------------------------------------------------------
let _allStations = [];

async function seedStationsIfNeeded() {
  const existing = await Storage.listStations();
  if (existing && existing.length > 0) return;
  for (const s of SEED_STATIONS) {
    try {
      await Storage.saveStation(s);
    } catch (err) {
      console.warn("Seed station thất bại:", s, err);
    }
  }
}

async function refreshStationsUI() {
  _allStations = await Storage.listStations();
}

// Nếu người dùng gõ tay 1 tên trạm chưa có trong danh mục, tự động thêm vào
// danh mục để lần sau xuất hiện như 1 gợi ý — không yêu cầu điền Mã trạm.
async function registerStationIfNew(tenTram) {
  const name = (tenTram || "").trim();
  if (!name) return;
  const already = _allStations.some((s) => (s.ten_tram || "").trim().toLowerCase() === name.toLowerCase());
  if (already) return;
  try {
    await Storage.saveStation({ ma_tram: "", ten_tram: name });
    await refreshStationsUI();
  } catch (err) {
    console.warn("Không thể tự thêm trạm mới vào danh mục:", err);
  }
}

// ---------------------------------------------------------------------
// Nhà sản xuất: nạp dropdown theo loại thiết bị đang chọn
// ---------------------------------------------------------------------
let _allStandards = [];

async function refreshManufacturerOptions() {
  const sel = $("f_nsx");
  const loai = $("f_loai").value;
  const options = _allStandards.filter(
    (s) => (s.equipment_type === loai || s.equipmentType === loai) && !isOilStandardRecord(s)
  );
  sel.innerHTML = '<option value="">— Không có / dùng QĐ1901 —</option>';
  options.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.manufacturer;
    opt.textContent = s.manufacturer;
    sel.appendChild(opt);
  });
}

// Dropdown "Nhà sản xuất" ở tab Dầu cách điện — chỉ liệt kê NSX có tiêu chuẩn
// DẦU (standard_type = "dau") CHO ĐÚNG MBA/Kháng dầu (loại trừ tiêu chuẩn dầu TI/TU —
// khác cấu trúc, không có voltage_class/oil_state để khớp, xem toOilStandardsForLogic()).
// Dùng chung cho cả dầu chính MBA (#o_nsx) và dầu OLTC (#ot_nsx — chỉ áp dụng khi Dầu
// mới, xem evaluateOltcOilTest(): "vận hành" luôn dùng Bảng 49, không có ưu tiên NSX).
function refreshOilManufacturerOptions() {
  const names = Array.from(new Set(
    _allStandards.filter((s) => isOilStandardRecord(s) && (s.equipment_type || s.equipmentType || DGA.EQUIPMENT_TYPES.MBA) === DGA.EQUIPMENT_TYPES.MBA)
      .map((s) => s.manufacturer).filter(Boolean)
  ));
  names.sort((a, b) => a.localeCompare(b, "vi"));
  ["o_nsx", "ot_nsx"].forEach((id) => {
    const sel = $(id);
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">— Không có / dùng QĐ1901 —</option>';
    names.forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      sel.appendChild(opt);
    });
    if (names.includes(currentVal)) sel.value = currentVal;
  });
}

// Dropdown "Nhà sản xuất" ở form "Dầu cách điện TI/TU" (#tio_nsx, xem ui-ti-oil.js) —
// chỉ liệt kê NSX đã cấu hình tiêu chuẩn dầu ĐÚNG loại thiết bị đang chọn (TI hoặc TU) —
// khác dầu MBA (bắt buộc có tiêu chuẩn mới đánh giá được, xem evaluateInstrumentOilTest()),
// nên KHÔNG có lựa chọn "— Không có / dùng QĐ1901 —" để tránh gây hiểu nhầm là vẫn có
// ngưỡng mặc định nào đó.
function refreshInstrumentOilManufacturerOptions(equipmentType) {
  const sel = $("tio_nsx");
  if (!sel) return;
  const names = Array.from(new Set(
    _allStandards.filter((s) => isOilStandardRecord(s) && (s.equipment_type || s.equipmentType) === equipmentType)
      .map((s) => s.manufacturer).filter(Boolean)
  ));
  names.sort((a, b) => a.localeCompare(b, "vi"));
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">— Chọn nhà sản xuất —</option>';
  names.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  });
  if (names.includes(currentVal)) sel.value = currentVal;
}

function standardRecordToLimits(rec) {
  return {
    H2: rec.h2 ?? rec.H2, CH4: rec.ch4 ?? rec.CH4, C2H6: rec.c2h6 ?? rec.C2H6,
    C2H4: rec.c2h4 ?? rec.C2H4, C2H2: rec.c2h2 ?? rec.C2H2, CO: rec.co ?? rec.CO, CO2: rec.co2 ?? rec.CO2,
  };
}

// Ngưỡng LOẠI BỎ (condemning) — độc lập với ngưỡng tuyệt đối ở trên, không bắt buộc
// đủ 7 khí. Trả về null nếu nhà sản xuất chưa cấu hình khí nào.
function standardRecordToCondemning(rec) {
  const out = {};
  let any = false;
  DGA.GASES.forEach((g) => {
    const v = rec["loaibo_" + g.toLowerCase()] ?? rec["loaibo_" + g];
    if (v !== undefined && v !== null && v !== "") {
      out[g] = Number(v);
      any = true;
    }
  });
  return any ? out : null;
}

// Chuẩn hóa 1 bản ghi lần đo (từ Storage) về object khí viết HOA (H2, CH4, ...),
// chấp nhận cả 2 kiểu chữ hoa/thường tùy backend đã lưu.
function recordGases(rec) {
  return {
    H2: rec.H2 ?? rec.h2, CH4: rec.CH4 ?? rec.ch4, C2H6: rec.C2H6 ?? rec.c2h6,
    C2H4: rec.C2H4 ?? rec.c2h4, C2H2: rec.C2H2 ?? rec.c2h2, CO: rec.CO ?? rec.co, CO2: rec.CO2 ?? rec.co2,
  };
}

function standardRecordToRate(rec) {
  const pairs = [
    ["H2", "rate_h2_lo", "rate_h2_hi"], ["CH4", "rate_ch4_lo", "rate_ch4_hi"],
    ["C2H6", "rate_c2h6_lo", "rate_c2h6_hi"], ["C2H4", "rate_c2h4_lo", "rate_c2h4_hi"],
    ["C2H2", "rate_c2h2_lo", "rate_c2h2_hi"], ["CO", "rate_co_lo", "rate_co_hi"],
    ["CO2", "rate_co2_lo", "rate_co2_hi"],
  ];
  const rate = {};
  let any = false;
  pairs.forEach(([gas, loKey, hiKey]) => {
    if (rec[loKey] !== undefined && rec[loKey] !== null && rec[hiKey] !== undefined && rec[hiKey] !== null) {
      rate[gas] = [Number(rec[loKey]), Number(rec[hiKey])];
      any = true;
    }
  });
  return any ? rate : null;
}

// "Loại tiêu chuẩn" — record cũ (lưu từ trước khi có tính năng này) không có
// standard_type, coi như "khi" để tương thích ngược.
function isOilStandardRecord(rec) {
  return rec.standard_type === "dau";
}
function isGasStandardRecord(rec) {
  return !isOilStandardRecord(rec);
}

function toManufacturerStandardsForLogic(list) {
  return list.filter(isGasStandardRecord).map((rec) => ({
    manufacturer: rec.manufacturer,
    equipmentType: rec.equipment_type || rec.equipmentType,
    source: rec.source,
    limits: standardRecordToLimits(rec),
    rate: standardRecordToRate(rec),
    condemning: standardRecordToCondemning(rec),
  }));
}

// Tiêu chuẩn dầu NSX (dùng cho DGA.evaluateOilTest ở tab "Dầu cách điện", MBA/OLTC —
// so khớp theo manufacturer+voltageClass+oilState — VÀ DGA.evaluateInstrumentOilTest()
// ở tab "Dầu cách điện TI/TU" — so khớp theo manufacturer+equipmentType, xem
// resolveInstrumentOilLimits() ở dga-logic.js) — mỗi bản ghi ứng với 1 tổ hợp cụ thể.
function toOilStandardsForLogic(list) {
  return list.filter(isOilStandardRecord).map((rec) => ({
    manufacturer: rec.manufacturer,
    equipmentType: rec.equipment_type || rec.equipmentType || DGA.EQUIPMENT_TYPES.MBA,
    voltageClass: rec.oil_voltage_class,
    oilState: rec.oil_state === "new" ? "new" : "inservice",
    moisture: rec.oil_moisture_ppm,
    tgd90: rec.oil_tgd_90c_percent,
    // tgδ đo ở 20°C (tùy chọn) — chỉ TI/TU dùng, khác hẳn tgd90 (VD Arteche).
    tgd20: rec.oil_tgd_20c_percent,
    bdv: rec.oil_bdv_kv,
    // Ngưỡng loại bỏ (mức 2) — chỉ TI/TU dùng, xem evaluateInstrumentOilTest().
    moistureReject: rec.oil_moisture_loaibo_ppm,
    tgd90Reject: rec.oil_tgd_90c_loaibo_percent,
    tgd20Reject: rec.oil_tgd_20c_loaibo_percent,
    // Ngưỡng loại bỏ tgδ20°C RIÊNG cho thiết bị U.H.V (tùy chọn, VD Arteche) — áp dụng
    // khi Um của lần đo ≥ tgd20UhvUmKv, xem evaluateInstrumentOilTest() (dga-logic.js).
    tgd20RejectUhv: rec.oil_tgd_20c_loaibo_uhv_percent,
    tgd20UhvUmKv: rec.oil_tgd_20c_uhv_um_kv,
    bdvReject: rec.oil_bdv_loaibo_kv,
    source: rec.source,
  }));
}

function oilVoltageClassLabel(vc) {
  const found = DGA.OIL_VOLTAGE_CLASSES.find((c) => c.value === vc);
  return found ? found.label : vc || "—";
}

// id của tiêu chuẩn đang SỬA (null = đang ở chế độ "thêm mới"). Có id thì
// Storage.saveStandard() sẽ GHI ĐÈ đúng dòng đó thay vì tạo dòng mới (xem
// storage.js: saveStandard dùng record.id để upsert).
let _editingStandardId = null;

function toggleStandardTypeFields() {
  const isOil = $("s_standard_type").value === "dau";
  $("stdGasFields").classList.toggle("hidden", isOil);
  $("stdOilFields").classList.toggle("hidden", !isOil);
  // Trước đây tiêu chuẩn dầu ẩn hẳn ô "Loại thiết bị" (mặc định luôn là MBA/Kháng dầu).
  // Giờ dầu TI/TU cũng cần chọn loại thiết bị (không có bảng chung cho cả 3 loại như
  // dầu MBA đã có Bảng 54/55/58) nên LUÔN hiện ô này, kể cả ở chế độ "dau".
  $("s_equipmenttype_wrap").classList.remove("hidden");
  if (isOil) toggleOilStandardEquipmentFields();
}

// Trong tiêu chuẩn DẦU: MBA/Kháng dầu dùng Cấp điện áp + Trạng thái dầu (giống Bảng
// 54/55/58 QĐ1901); TI/TU KHÔNG có 2 trục đó (QĐ1901 Điều 10/11 không đưa ra cấu trúc
// nào để mô phỏng theo — chỉ dẫn chiếu "theo quy định nhà sản xuất") nên ẩn 2 ô đó đi
// và thay bằng khối "Ngưỡng loại bỏ" (mức 2, xem evaluateInstrumentOilTest() ở
// dga-logic.js) — dầu MBA không cần khối này vì đã có QĐ1901 làm mặc định/ngưỡng tuyệt
// đối duy nhất.
function toggleOilStandardEquipmentFields() {
  if ($("s_standard_type").value !== "dau") return;
  const isMba = $("s_equipmenttype").value === DGA.EQUIPMENT_TYPES.MBA;
  $("s_oil_mba_fields").classList.toggle("hidden", !isMba);
  $("s_oil_instrument_fields").classList.toggle("hidden", isMba);
  $("stdOilFieldsNoteMba").classList.toggle("hidden", !isMba);
  $("stdOilFieldsNoteInstrument").classList.toggle("hidden", isMba);
  $("s_oil_normal_title").textContent = isMba
    ? "Ngưỡng (bỏ trống hạng mục nào nếu không muốn ghi đè QĐ1901)"
    : "Ngưỡng bình thường (tùy chọn — có thể chỉ điền ngưỡng loại bỏ bên dưới)";
}

async function refreshStandardsUI() {
  _allStandards = await Storage.listStandards();
  refreshManufacturerOptions();
  refreshOilManufacturerOptions();
  if (typeof refreshInstrumentOilManufacturerOptions === "function" && $("tio_equipmenttype")) {
    refreshInstrumentOilManufacturerOptions($("tio_equipmenttype").value);
  }

  const tbody = $("standardsTable");
  tbody.innerHTML = "";
  $("standardsEmpty").classList.toggle("hidden", _allStandards.length > 0);
  _allStandards.forEach((rec) => {
    const isOil = isOilStandardRecord(rec);
    let appliesTo, thresholdText;
    if (isOil) {
      const equipmentType = rec.equipment_type || rec.equipmentType || DGA.EQUIPMENT_TYPES.MBA;
      const isMba = equipmentType === DGA.EQUIPMENT_TYPES.MBA;
      appliesTo = isMba
        ? `${equipmentType} — ${oilVoltageClassLabel(rec.oil_voltage_class)} — ${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}`
        : equipmentType;
      const hasV = (v) => v !== undefined && v !== null && v !== "";
      const parts = [];
      if (hasV(rec.oil_moisture_ppm)) parts.push(`Độ ẩm=${rec.oil_moisture_ppm}ppm`);
      if (hasV(rec.oil_tgd_90c_percent)) parts.push(`tgδ90°C=${rec.oil_tgd_90c_percent}%`);
      if (hasV(rec.oil_tgd_20c_percent)) parts.push(`tgδ20°C=${rec.oil_tgd_20c_percent}%`);
      if (hasV(rec.oil_bdv_kv)) parts.push(`BDV=${rec.oil_bdv_kv}kV`);
      const loaiboParts = [];
      if (hasV(rec.oil_moisture_loaibo_ppm)) loaiboParts.push(`Độ ẩm=${rec.oil_moisture_loaibo_ppm}ppm`);
      if (hasV(rec.oil_tgd_90c_loaibo_percent)) loaiboParts.push(`tgδ90°C=${rec.oil_tgd_90c_loaibo_percent}%`);
      if (hasV(rec.oil_tgd_20c_loaibo_percent)) loaiboParts.push(`tgδ20°C=${rec.oil_tgd_20c_loaibo_percent}%`);
      if (hasV(rec.oil_tgd_20c_loaibo_uhv_percent) && hasV(rec.oil_tgd_20c_uhv_um_kv)) {
        loaiboParts.push(`tgδ20°C(U.H.V,Um≥${rec.oil_tgd_20c_uhv_um_kv}kV)=${rec.oil_tgd_20c_loaibo_uhv_percent}%`);
      }
      if (hasV(rec.oil_bdv_loaibo_kv)) loaiboParts.push(`BDV=${rec.oil_bdv_loaibo_kv}kV`);
      const loaiboText = loaiboParts.length > 0 ? " | Loại bỏ: " + loaiboParts.join(", ") : "";
      thresholdText = (parts.length > 0 ? parts.join(", ") : "—") + loaiboText;
    } else {
      appliesTo = rec.equipment_type || rec.equipmentType;
      const limits = standardRecordToLimits(rec);
      const condemning = standardRecordToCondemning(rec);
      const condemningText = condemning
        ? " | Loại bỏ: " + DGA.GASES.filter((g) => condemning[g] !== undefined).map((g) => g + "=" + condemning[g]).join(", ")
        : "";
      thresholdText = DGA.GASES.map((g) => g + "=" + (limits[g] ?? "—")).join(", ") + condemningText;
    }
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(rec.manufacturer)}</strong></td>
      <td>${isOil ? '<span class="pill muted">Dầu</span>' : '<span class="pill muted">Khí</span>'}</td>
      <td>${escapeHtml(appliesTo || "—")}</td>
      <td style="font-size:12px;">${escapeHtml(thresholdText)}</td>
      <td>${escapeHtml(rec.source || "—")}</td>
      <td class="actions-cell"><div class="btn-row">${canWrite() ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button> <button class="btn danger" data-action="del">Xóa</button>` : ""}</div></td>
    `;
    const editBtn = tr.querySelector('[data-action="edit"]');
    const delBtn = tr.querySelector('[data-action="del"]');
    if (editBtn) editBtn.addEventListener("click", () => onEditStandard(rec));
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        if (_editingStandardId === rec.id) resetStandardForm();
        try {
          await Storage.deleteStandard(rec.id);
          await refreshStandardsUI();
        } catch (err) {
          notifyError(storageErrorMessage(err));
        }
      });
    }
    tbody.appendChild(tr);
  });
}

/** Nạp 1 tiêu chuẩn đã có lên form để sửa — bấm "Cập nhật tiêu chuẩn" sẽ ghi đè
 *  đúng dòng này (giữ nguyên id), thay vì tạo thêm 1 dòng mới. */
function onEditStandard(rec) {
  if (!canWrite()) return;
  _editingStandardId = rec.id;
  $("s_manufacturer").value = rec.manufacturer || "";
  $("s_source").value = rec.source || "";
  const isOil = isOilStandardRecord(rec);
  $("s_standard_type").value = isOil ? "dau" : "khi";
  toggleStandardTypeFields();
  $("s_equipmenttype").value = rec.equipment_type || rec.equipmentType || DGA.EQUIPMENT_TYPES.MBA;
  if (isOil) {
    $("s_oil_voltage_class").value = rec.oil_voltage_class || "";
    $("s_oil_state").value = rec.oil_state === "new" ? "new" : "inservice";
    $("s_oil_moisture").value = rec.oil_moisture_ppm ?? "";
    $("s_oil_tgd90").value = rec.oil_tgd_90c_percent ?? "";
    $("s_oil_bdv").value = rec.oil_bdv_kv ?? "";
    $("s_oil_moisture_loaibo").value = rec.oil_moisture_loaibo_ppm ?? "";
    $("s_oil_tgd90_loaibo").value = rec.oil_tgd_90c_loaibo_percent ?? "";
    $("s_oil_bdv_loaibo").value = rec.oil_bdv_loaibo_kv ?? "";
    $("s_oil_tgd20").value = rec.oil_tgd_20c_percent ?? "";
    $("s_oil_tgd20_loaibo").value = rec.oil_tgd_20c_loaibo_percent ?? "";
    $("s_oil_tgd20_uhv_loaibo").value = rec.oil_tgd_20c_loaibo_uhv_percent ?? "";
    $("s_oil_tgd20_uhv_um_kv").value = rec.oil_tgd_20c_uhv_um_kv ?? "";
    toggleOilStandardEquipmentFields();
  } else {
    DGA.GASES.forEach((g) => {
      const v = rec[g.toLowerCase()] ?? rec[g];
      $("s_" + g).value = v ?? "";
      const vLoaibo = rec["loaibo_" + g.toLowerCase()] ?? rec["loaibo_" + g];
      $("s_loaibo_" + g).value = vLoaibo ?? "";
    });
  }
  $("editingStandardNote").classList.remove("hidden");
  $("btnCancelEditStandard").classList.remove("hidden");
  $("btnSaveStandard").textContent = "Cập nhật tiêu chuẩn";
  $("s_manufacturer").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetStandardForm() {
  _editingStandardId = null;
  [
    "s_manufacturer", "s_source", "s_oil_moisture", "s_oil_tgd90", "s_oil_bdv",
    "s_oil_moisture_loaibo", "s_oil_tgd90_loaibo", "s_oil_bdv_loaibo",
    "s_oil_tgd20", "s_oil_tgd20_loaibo", "s_oil_tgd20_uhv_loaibo", "s_oil_tgd20_uhv_um_kv",
  ].forEach((id) => ($(id).value = ""));
  DGA.GASES.forEach((g) => { $("s_" + g).value = ""; $("s_loaibo_" + g).value = ""; });
  $("s_standard_type").value = "khi";
  $("s_equipmenttype").value = DGA.EQUIPMENT_TYPES.TI;
  toggleStandardTypeFields();
  $("editingStandardNote").classList.add("hidden");
  $("btnCancelEditStandard").classList.add("hidden");
  $("btnSaveStandard").textContent = "Lưu tiêu chuẩn";
}

async function onSaveStandard() {
  if (!canWrite()) { notifyError("Chỉ Admin mới lưu được tiêu chuẩn."); return; }
  const manufacturer = $("s_manufacturer").value.trim();
  if (!manufacturer) { notifyError("Vui lòng nhập tên nhà sản xuất."); return; }
  const standardType = $("s_standard_type").value === "dau" ? "dau" : "khi";
  const source = $("s_source").value.trim();

  let rec;
  if (standardType === "dau") {
    const equipmentType = $("s_equipmenttype").value;
    const isMba = equipmentType === DGA.EQUIPMENT_TYPES.MBA;
    const moisture = $("s_oil_moisture").value;
    const tgd90 = $("s_oil_tgd90").value;
    const bdv = $("s_oil_bdv").value;
    const moistureLoaibo = isMba ? "" : $("s_oil_moisture_loaibo").value;
    const tgd90Loaibo = isMba ? "" : $("s_oil_tgd90_loaibo").value;
    const bdvLoaibo = isMba ? "" : $("s_oil_bdv_loaibo").value;
    // tgδ ở 20°C — CHỈ TI/TU dùng (VD Arteche), MBA không có hạng mục này (Bảng 54/55/58
    // QĐ1901 không đo tgδ ở 20°C) nên luôn để trống khi isMba, giống 3 cột "loại bỏ" trên.
    const tgd20 = isMba ? "" : $("s_oil_tgd20").value;
    const tgd20Loaibo = isMba ? "" : $("s_oil_tgd20_loaibo").value;
    // Ngưỡng loại bỏ tgδ20°C RIÊNG cho U.H.V — TÙY CHỌN, không tính vào "phải nhập ít
    // nhất 1 hạng mục" bên dưới (xem ghi chú ở toOilStandardsForLogic()/evaluateInstrumentOilTest()).
    const tgd20UhvLoaibo = isMba ? "" : $("s_oil_tgd20_uhv_loaibo").value;
    const tgd20UhvUmKv = isMba ? "" : $("s_oil_tgd20_uhv_um_kv").value;
    if (!isMba && (tgd20UhvLoaibo === "") !== (tgd20UhvUmKv === "")) {
      notifyError('Cặp "tgδ20°C loại bỏ khi U.H.V" và "Mốc Um áp dụng U.H.V" phải nhập ĐỦ CẢ HAI hoặc để trống cả hai.');
      return;
    }
    if ([moisture, tgd90, bdv, moistureLoaibo, tgd90Loaibo, bdvLoaibo, tgd20, tgd20Loaibo].every((v) => v === "")) {
      notifyError(isMba
        ? "Vui lòng nhập ít nhất 1 trong 3 ngưỡng: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng."
        : "Vui lòng nhập ít nhất 1 ngưỡng (bình thường hoặc loại bỏ) cho 1 trong 4 hạng mục: Độ ẩm dầu, tgδ ở 90°C, tgδ ở 20°C, hoặc Điện áp chọc thủng.");
      return;
    }
    rec = {
      manufacturer, source, standard_type: "dau",
      equipment_type: equipmentType,
      // Cấp điện áp/trạng thái dầu CHỈ có ý nghĩa với MBA (Bảng 54/55/58 QĐ1901 phân
      // theo 2 trục đó) — TI/TU không có cấu trúc này (xem toggleOilStandardEquipmentFields()),
      // để trống để evaluateInstrumentOilTest() chỉ so khớp theo manufacturer+equipmentType.
      oil_voltage_class: isMba ? $("s_oil_voltage_class").value : "",
      oil_state: isMba ? $("s_oil_state").value : "",
      oil_moisture_ppm: moisture === "" ? null : Number(moisture),
      oil_tgd_90c_percent: tgd90 === "" ? null : Number(tgd90),
      oil_bdv_kv: bdv === "" ? null : Number(bdv),
      // Ngưỡng LOẠI BỎ — chỉ TI/TU dùng (xem evaluateInstrumentOilTest() ở dga-logic.js).
      oil_moisture_loaibo_ppm: moistureLoaibo === "" ? null : Number(moistureLoaibo),
      oil_tgd_90c_loaibo_percent: tgd90Loaibo === "" ? null : Number(tgd90Loaibo),
      oil_bdv_loaibo_kv: bdvLoaibo === "" ? null : Number(bdvLoaibo),
      // tgδ ở 20°C — CHỈ TI/TU dùng, xem ghi chú ở khai báo biến tgd20/tgd20Loaibo trên.
      oil_tgd_20c_percent: tgd20 === "" ? null : Number(tgd20),
      oil_tgd_20c_loaibo_percent: tgd20Loaibo === "" ? null : Number(tgd20Loaibo),
      // Ngưỡng loại bỏ tgδ20°C riêng cho U.H.V + mốc Um áp dụng — xem ghi chú ở khai
      // báo biến tgd20UhvLoaibo/tgd20UhvUmKv trên. Cả 2 null nếu NSX không có biệt lệ này.
      oil_tgd_20c_loaibo_uhv_percent: tgd20UhvLoaibo === "" ? null : Number(tgd20UhvLoaibo),
      oil_tgd_20c_uhv_um_kv: tgd20UhvUmKv === "" ? null : Number(tgd20UhvUmKv),
    };
    if (alertIfNegative([
      { label: "Độ ẩm dầu", value: rec.oil_moisture_ppm },
      { label: "tgδ ở 90°C", value: rec.oil_tgd_90c_percent },
      { label: "tgδ ở 20°C", value: rec.oil_tgd_20c_percent },
      { label: "Điện áp chọc thủng", value: rec.oil_bdv_kv },
      { label: "Độ ẩm dầu (loại bỏ)", value: rec.oil_moisture_loaibo_ppm },
      { label: "tgδ ở 90°C (loại bỏ)", value: rec.oil_tgd_90c_loaibo_percent },
      { label: "tgδ ở 20°C (loại bỏ)", value: rec.oil_tgd_20c_loaibo_percent },
      { label: "tgδ ở 20°C (loại bỏ khi U.H.V)", value: rec.oil_tgd_20c_loaibo_uhv_percent },
      { label: "Mốc Um áp dụng U.H.V", value: rec.oil_tgd_20c_uhv_um_kv },
      { label: "Điện áp chọc thủng (loại bỏ)", value: rec.oil_bdv_loaibo_kv },
    ])) return;
  } else {
    const equipmentType = $("s_equipmenttype").value;
    rec = {
      manufacturer, source, standard_type: "khi",
      equipment_type: equipmentType,
    };
    DGA.GASES.forEach((g) => {
      const v = $("s_" + g).value;
      rec[g.toLowerCase()] = v === "" ? null : Number(v);
      const vLoaibo = $("s_loaibo_" + g).value;
      rec["loaibo_" + g.toLowerCase()] = vLoaibo === "" ? null : Number(vLoaibo);
    });
    if (alertIfNegative(
      DGA.GASES.flatMap((g) => [
        { label: `Ngưỡng ${g}`, value: rec[g.toLowerCase()] },
        { label: `Ngưỡng loại bỏ ${g}`, value: rec["loaibo_" + g.toLowerCase()] },
      ])
    )) return;
  }
  if (_editingStandardId) rec.id = _editingStandardId;

  const wasEditing = !!_editingStandardId;
  try {
    await Storage.saveStandard(rec);
    resetStandardForm();
    await refreshStandardsUI();
    showToast((wasEditing ? "Đã cập nhật tiêu chuẩn cho " : "Đã lưu tiêu chuẩn cho ") + manufacturer + ".");
  } catch (err) {
    notifyError(storageErrorMessage(err));
  }
}

// ---------------------------------------------------------------------
// Tab "Quản trị" — chỉ Admin thấy được tab này (xem toggle navQuanTri trong
// initApp). Cho phép nâng/hạ quyền Admin ↔ User cho từng email đã đăng ký.
// ---------------------------------------------------------------------
