/* ui-standards.js — Danh mục Trạm + Tiêu chuẩn riêng theo Nhà sản xuất (tab "Tiêu
   chuẩn"): CRUD tiêu chuẩn, các hàm chuyển đổi bản ghi Storage <-> định dạng
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
// DẦU (standard_type = "dau"), không lẫn với tiêu chuẩn khí ở trên. Dùng chung
// cho cả dầu chính MBA (#o_nsx) và dầu OLTC (#ot_nsx — chỉ áp dụng khi Dầu mới,
// xem evaluateOltcOilTest(): "vận hành" luôn dùng Bảng 49, không có ưu tiên NSX).
function refreshOilManufacturerOptions() {
  const names = Array.from(new Set(_allStandards.filter(isOilStandardRecord).map((s) => s.manufacturer).filter(Boolean)));
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

// Tiêu chuẩn dầu NSX (dùng cho DGA.evaluateOilTest ở tab "Dầu cách điện") — mỗi
// bản ghi ứng với 1 tổ hợp (manufacturer, cấp điện áp, trạng thái dầu) cụ thể.
function toOilStandardsForLogic(list) {
  return list.filter(isOilStandardRecord).map((rec) => ({
    manufacturer: rec.manufacturer,
    voltageClass: rec.oil_voltage_class,
    oilState: rec.oil_state === "new" ? "new" : "inservice",
    moisture: rec.oil_moisture_ppm,
    tgd90: rec.oil_tgd_90c_percent,
    bdv: rec.oil_bdv_kv,
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
  $("s_equipmenttype_wrap").classList.toggle("hidden", isOil);
}

async function refreshStandardsUI() {
  _allStandards = await Storage.listStandards();
  refreshManufacturerOptions();
  refreshOilManufacturerOptions();

  const tbody = $("standardsTable");
  tbody.innerHTML = "";
  $("standardsEmpty").classList.toggle("hidden", _allStandards.length > 0);
  _allStandards.forEach((rec) => {
    const isOil = isOilStandardRecord(rec);
    let appliesTo, thresholdText;
    if (isOil) {
      appliesTo = `${oilVoltageClassLabel(rec.oil_voltage_class)} — ${rec.oil_state === "new" ? "Dầu mới" : "Dầu vận hành"}`;
      const parts = [];
      if (rec.oil_moisture_ppm !== undefined && rec.oil_moisture_ppm !== null && rec.oil_moisture_ppm !== "") parts.push(`Độ ẩm=${rec.oil_moisture_ppm}ppm`);
      if (rec.oil_tgd_90c_percent !== undefined && rec.oil_tgd_90c_percent !== null && rec.oil_tgd_90c_percent !== "") parts.push(`tgδ=${rec.oil_tgd_90c_percent}%`);
      if (rec.oil_bdv_kv !== undefined && rec.oil_bdv_kv !== null && rec.oil_bdv_kv !== "") parts.push(`BDV=${rec.oil_bdv_kv}kV`);
      thresholdText = parts.length > 0 ? parts.join(", ") : "—";
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
      <td style="white-space:nowrap;">${canWrite() ? `<button class="btn ghost" data-action="edit" style="padding:5px 10px; font-size:12px;">Sửa</button> <button class="btn danger" data-action="del">Xóa</button>` : ""}</td>
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
          alert(storageErrorMessage(err));
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
  if (isOil) {
    $("s_oil_voltage_class").value = rec.oil_voltage_class || "";
    $("s_oil_state").value = rec.oil_state === "new" ? "new" : "inservice";
    $("s_oil_moisture").value = rec.oil_moisture_ppm ?? "";
    $("s_oil_tgd90").value = rec.oil_tgd_90c_percent ?? "";
    $("s_oil_bdv").value = rec.oil_bdv_kv ?? "";
  } else {
    $("s_equipmenttype").value = rec.equipment_type || rec.equipmentType || "";
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
  ["s_manufacturer", "s_source", "s_oil_moisture", "s_oil_tgd90", "s_oil_bdv"].forEach((id) => ($(id).value = ""));
  DGA.GASES.forEach((g) => { $("s_" + g).value = ""; $("s_loaibo_" + g).value = ""; });
  $("s_standard_type").value = "khi";
  toggleStandardTypeFields();
  $("editingStandardNote").classList.add("hidden");
  $("btnCancelEditStandard").classList.add("hidden");
  $("btnSaveStandard").textContent = "Lưu tiêu chuẩn";
}

async function onSaveStandard() {
  if (!canWrite()) { alert("Chỉ Admin mới lưu được tiêu chuẩn."); return; }
  const manufacturer = $("s_manufacturer").value.trim();
  if (!manufacturer) { alert("Vui lòng nhập tên nhà sản xuất."); return; }
  const standardType = $("s_standard_type").value === "dau" ? "dau" : "khi";
  const source = $("s_source").value.trim();

  let rec;
  if (standardType === "dau") {
    const moisture = $("s_oil_moisture").value;
    const tgd90 = $("s_oil_tgd90").value;
    const bdv = $("s_oil_bdv").value;
    if (moisture === "" && tgd90 === "" && bdv === "") {
      alert("Vui lòng nhập ít nhất 1 trong 3 ngưỡng: Độ ẩm dầu, tgδ ở 90°C, hoặc Điện áp chọc thủng.");
      return;
    }
    rec = {
      manufacturer, source, standard_type: "dau",
      equipment_type: DGA.EQUIPMENT_TYPES.MBA,
      oil_voltage_class: $("s_oil_voltage_class").value,
      oil_state: $("s_oil_state").value,
      oil_moisture_ppm: moisture === "" ? null : Number(moisture),
      oil_tgd_90c_percent: tgd90 === "" ? null : Number(tgd90),
      oil_bdv_kv: bdv === "" ? null : Number(bdv),
    };
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
  }
  if (_editingStandardId) rec.id = _editingStandardId;

  const wasEditing = !!_editingStandardId;
  try {
    await Storage.saveStandard(rec);
    resetStandardForm();
    await refreshStandardsUI();
    alert((wasEditing ? "Đã cập nhật tiêu chuẩn cho " : "Đã lưu tiêu chuẩn cho ") + manufacturer + ".");
  } catch (err) {
    alert(storageErrorMessage(err));
  }
}

// ---------------------------------------------------------------------
// Tab "Quản trị" — chỉ Admin thấy được tab này (xem toggle navQuanTri trong
// initApp). Cho phép nâng/hạ quyền Admin ↔ User cho từng email đã đăng ký.
// ---------------------------------------------------------------------
