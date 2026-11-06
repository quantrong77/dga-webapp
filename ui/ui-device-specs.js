/* ui-device-specs.js — Thông số kỹ thuật thiết bị ở tab con "Lập BBTN" (tab Khí hòa tan + Lý-Hóa dầu):
     - Chọn/gõ Trạm + Thiết bị (sự kiện change) → tự điền thông số kỹ thuật từ dữ liệu đã lưu của thiết bị đó
       (DeviceSpecs.deviceSpecsCollect, bbtn/device-specs.js). Chỉ điền ô CÒN TRỐNG (hoặc ô app tự điền trước đó,
       người dùng chưa sửa — đổi sang thiết bị khác thì các ô này được thay theo thiết bị mới). Ô người dùng đã gõ
       không bị ghi đè. Thiết bị chưa có dữ liệu → người dùng nhập tay.
     - Vùng kéo thả "Nhập thông số kỹ thuật từ file" (PDF/Word cũ): CHỈ lấy thông số (DeviceSpecs.
       deviceSpecsFromHeader), không đọc số liệu đo, không đính kèm file, không mở khung đối chiếu. Thông số đọc
       được ghi đè ô tương ứng (người dùng chủ động chọn file).
     - Dòng "Biên bản đính kèm khi lưu" ở Lập BBTN: file đã chọn ở "Nhập BBTN cũ" vẫn sẽ được lưu kèm — hiện tên
       file + nút Bỏ file để không lưu nhầm mà không biết.
   Tab "Nhập BBTN cũ" KHÔNG tự điền (thông số lấy từ chính biên bản đang đọc). */

const DEVICE_SPEC_LABELS = {
  hang_sx: "Hãng sản xuất", kieu_may: "Kiểu máy", nam_sx: "Năm sản xuất", nam_van_hanh: "Năm vận hành",
  dien_ap_dm: "Điện áp định mức", cong_suat: "Công suất", so_che_tao: "Số chế tạo", so_che_tao_pha: "Số chế tạo từng pha",
  loai_dau: "Loại dầu", ket_cau_cach_dien: "Kết cấu cách điện", voltage_class: "Cấp điện áp", um_kv: "Um (kV)",
  oil_inhibited: "Loại dầu (chất ức chế)", manufacturer_dga: "Nhà sản xuất", manufacturer_oil: "Nhà sản xuất",
  manufacturer_instrument: "Nhà sản xuất",
};

// Ánh xạ khóa thông số chuẩn → id ô nhập của từng form. Mảng = ô theo pha A/B/C (giá trị là object {A,B,C}).
const DEVICE_SPEC_FORMS = {
  f: {
    tab: "nhap", tram: "f_tram", device: "f_thietbi", note: "f_specNote", file: "f_spec_file", zone: "fSpecDropzone",
    fields: {
      manufacturer_dga: "f_nsx", kieu_may: "f_kieumay", nam_sx: "f_namsx", nam_van_hanh: "f_namvanhanh",
      dien_ap_dm: "f_dienapdm", so_che_tao: "f_sochetao", loai_dau: "f_loaidau", ket_cau_cach_dien: "f_ketcaucachdien",
    },
    after: () => { if (typeof syncDienApDmToBang63Voltage === "function") syncDienApDmToBang63Voltage(); },
  },
  o: {
    tab: "dau", tram: "o_tram", device: "o_thietbi", note: "o_specNote", file: "o_spec_file", zone: "oSpecDropzone",
    fields: {
      voltage_class: "o_voltage_class", manufacturer_oil: "o_nsx", oil_inhibited: "o_inhibited",
      hang_sx: "ob_hangsx", nam_sx: "ob_namsx", dien_ap_dm: "ob_dienapdm", cong_suat: "ob_congsuat",
      so_che_tao: "ob_sochetao", nam_van_hanh: "ob_namvanhanh", loai_dau: "ob_loaidau",
    },
    after: () => {
      if (typeof toggleOilMembraneField === "function") toggleOilMembraneField();
      if (typeof syncOltcFromMain === "function") syncOltcFromMain();
    },
  },
  t3: {
    tab: "dau", tram: "t3_tram", device: "t3_thietbi", note: "t3_specNote", file: "t3_spec_file", zone: "t3SpecDropzone",
    fields: {
      manufacturer_instrument: "t3_nsx", hang_sx: "t3_hangsx", um_kv: "t3_udm", cong_suat: "t3_congsuat",
      nam_sx: "t3_namsx", nam_van_hanh: "t3_namvanhanh", loai_dau: "t3_loaidau",
      so_che_tao_pha: ["t3_serial_A", "t3_serial_B", "t3_serial_C"],
    },
  },
  tio: {
    tab: "dau", tram: "tio_tram", device: "tio_thietbi", note: "tio_specNote",
    fields: { manufacturer_instrument: "tio_nsx", um_kv: "tio_um_kv" },
  },
};

function deviceSpecFieldEls(F) {
  const ids = [];
  Object.values(F.fields).forEach((v) => (Array.isArray(v) ? ids.push(...v) : ids.push(v)));
  return ids.map((id) => $(id)).filter(Boolean);
}

/** Bổ sung thông số suy ra được: cấp điện áp / Um từ chuỗi điện áp định mức. */
function deviceSpecDerive(values) {
  const v = { ...values };
  const kv = v.dien_ap_dm !== undefined ? DeviceSpecs.deviceSpecMaxKv(v.dien_ap_dm) : null;
  if (v.voltage_class === undefined && kv && window.MbaOilBbtn && MbaOilBbtn.mbaOilVoltageClass) {
    const vc = MbaOilBbtn.mbaOilVoltageClass(kv);
    if (vc) v.voltage_class = vc;
  }
  if (v.um_kv === undefined && kv) v.um_kv = kv;
  return v;
}

// Ô số chỉ nhận NĂM (4 chữ số) / chỉ nhận kV — tránh "05/2019" → 5
const DEVICE_SPEC_YEAR_IDS = ["f_namsx", "f_namvanhanh", "t3_namsx", "t3_namvanhanh"];
const DEVICE_SPEC_KV_IDS = ["t3_udm", "tio_um_kv"];

/** Ô đang giữ đúng giá trị app đã tự điền (dataset.specAuto = giá trị đã ghi). Mọi lần ghi khác — người dùng gõ,
 *  sửa bản ghi, đọc BBTN — làm giá trị lệch đi nên tự hết là "tự điền", không cần gỡ cờ ở từng nơi gọi. */
function deviceSpecIsAuto(el) {
  if (!el) return false;
  return (el.dataset.specAuto !== undefined && el.value === el.dataset.specAuto) ||
    // gợi ý của khối Xuất BBTN dầu (oilBbtnPrefill, ui-oil-bbtn-export.js) — cũng là giá trị app tự điền
    (el.dataset.exportAuto !== undefined && el.value === el.dataset.exportAuto);
}

function deviceSpecNormalize(el, value) {
  const v = String(value).trim();
  if (DEVICE_SPEC_YEAR_IDS.includes(el.id)) return (/\b(19|20)\d{2}\b/.exec(v) || [null])[0];
  if (DEVICE_SPEC_KV_IDS.includes(el.id)) {
    const n = Number(v.replace(",", "."));
    const kv = Number.isFinite(n) ? n : DeviceSpecs.deviceSpecMaxKv(v);
    return kv === null ? null : String(kv);
  }
  if (el.type === "number") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? String(n) : null;
  }
  return v;
}

/** Ghi 1 giá trị vào 1 ô. mode "saved": chỉ ô trống / ô app tự điền / ô chọn người dùng chưa đổi (ô chọn nhớ giá
 *  trị trước đó để trả lại khi đổi thiết bị); mode "file": luôn ghi (người dùng chủ động chọn file).
 *  Trả về true nếu giá trị ô thay đổi. */
function deviceSpecSet(el, value, mode) {
  if (!el || !DeviceSpecs.deviceSpecHasValue(value)) return false;
  const v = deviceSpecNormalize(el, value);
  if (v === null || v === "") return false;
  const isSelect = el.tagName === "SELECT";
  if (isSelect) {
    if (el.id === "o_voltage_class" && typeof ensureOilVoltageOption === "function") ensureOilVoltageOption(el.id, v);
    if (!Array.from(el.options).some((o) => o.value === v)) return false;
  }
  if (mode === "saved") {
    const auto = deviceSpecIsAuto(el);
    const free = isSelect ? auto || el.dataset.specTouched !== "1" : !el.value || auto;
    if (!free) return false;
    if (isSelect && !auto) el.dataset.specPrev = el.value;
    const changed = el.value !== v;
    el.value = v;
    el.dataset.specAuto = v;
    delete el.dataset.exportAuto;
    return changed;
  }
  delete el.dataset.specAuto;
  delete el.dataset.specPrev;
  delete el.dataset.exportAuto;
  if (el.value === v) return false;
  el.value = v;
  return true;
}

/** Bỏ các giá trị app đã tự điền (cho thiết bị trước): ô chữ/số → trống, ô chọn → giá trị trước khi tự điền. */
function deviceSpecClearAuto(F) {
  let changed = false;
  deviceSpecFieldEls(F).forEach((el) => {
    if (deviceSpecIsAuto(el)) {
      const back = el.tagName === "SELECT" ? el.dataset.specPrev : "";
      if (back !== undefined && el.value !== back) { el.value = back; changed = true; }
    }
    delete el.dataset.specAuto;
    delete el.dataset.specPrev;
    delete el.dataset.exportAuto;
  });
  return changed;
}

/** Ghi bộ thông số vào form; trả về danh sách nhãn thông số đã ghi (người gọi chạy F.after()). */
function deviceSpecApply(F, values, mode) {
  const filled = [];
  Object.entries(F.fields).forEach(([key, target]) => {
    const entry = values[key]; // { value, date?, source? }
    if (!entry) return;
    const value = entry.value;
    let ok = false;
    if (Array.isArray(target)) {
      // ô theo pha A/B/C: chỉ nhận giá trị dạng { A, B, C }
      if (value && typeof value === "object") {
        ["A", "B", "C"].forEach((ph, k) => { if (deviceSpecSet($(target[k]), value[ph], mode)) ok = true; });
      }
    } else {
      ok = deviceSpecSet($(target), value, mode);
    }
    if (ok && !filled.includes(DEVICE_SPEC_LABELS[key])) filled.push(DEVICE_SPEC_LABELS[key]);
  });
  return filled;
}

function deviceSpecNote(F, text, tone) {
  const el = $(F.note);
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
  el.style.color = tone === "warn" ? "var(--warn)" : "";
}

function deviceSpecDateVN(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Chọn/gõ xong Trạm + Thiết bị ở tab con Lập BBTN → tự điền thông số đã lưu của thiết bị. */
function deviceSpecAutoFill(key) {
  const F = DEVICE_SPEC_FORMS[key];
  if (!F || typeof getInputMode !== "function" || getInputMode(F.tab) !== "lap" || !window.DeviceSpecs) return;
  // Bỏ thông số app đã tự điền cho thiết bị trước
  const cleared = deviceSpecClearAuto(F);
  const done = (filledAny) => { if ((filledAny || cleared) && F.after) F.after(); };
  const tb = $(F.device) ? $(F.device).value.trim() : "";
  const tram = $(F.tram) ? $(F.tram).value.trim() : "";
  if (!tb) { deviceSpecNote(F, ""); done(false); return; }
  const r = DeviceSpecs.deviceSpecsCollect({
    measurements: typeof _allMeasurements !== "undefined" ? _allMeasurements : [],
    oilTests: typeof _allOilTests !== "undefined" ? _allOilTests : [],
    oltcTests: typeof _allOltcOilTests !== "undefined" ? _allOltcOilTests : [],
    instrumentTests: typeof _allTioOilTests !== "undefined" ? _allTioOilTests : [],
  }, tram, tb);
  if (r.ambiguous) {
    deviceSpecNote(F, `"${tb}" có ở ${r.stations.length} trạm (${r.stations.join(", ")}) — chọn Trạm để app điền đúng thông số của thiết bị.`, "warn");
    done(false);
    return;
  }
  if (!r.found) {
    deviceSpecNote(F, `"${tb}" chưa có dữ liệu đã lưu — nhập tay thông số kỹ thuật` +
      (F.zone ? ", hoặc kéo thả file PDF/Word cũ có ghi thông số vào ô phía trên." : "."));
    done(false);
    return;
  }
  const derived = deviceSpecDerive(Object.fromEntries(Object.entries(r.values).map(([k, e]) => [k, e.value])));
  const values = {};
  Object.entries(derived).forEach(([k, v]) => { values[k] = r.values[k] || { value: v }; });
  const filled = deviceSpecApply(F, values, "saved");
  done(filled.length > 0);
  const latest = Object.values(r.values).filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (filled.length) {
    deviceSpecNote(F, `Đã điền ${filled.length} thông số từ dữ liệu đã lưu của thiết bị` +
      (latest ? ` (mới nhất: ${latest.source} ${deviceSpecDateVN(latest.date)})` : "") + `: ${filled.join(", ")}. Kiểm tra lại trước khi lưu.`);
  } else {
    deviceSpecNote(F, Object.keys(r.values).length
      ? "Thiết bị đã có dữ liệu đã lưu; các ô thông số kỹ thuật đã có giá trị nên không điền đè."
      : "Thiết bị đã có dữ liệu đo nhưng chưa lưu thông số kỹ thuật — nhập tay hoặc kéo thả file để lấy thông số.");
  }
}

/** Tiện ích "Nhập thông số kỹ thuật từ file" (PDF/Word): chỉ lấy thông số, không đọc số liệu đo. */
async function onDeviceSpecFile(key) {
  const F = DEVICE_SPEC_FORMS[key];
  const input = $(F.file);
  const file = input && input.files && input.files[0];
  if (!file) return;
  if (!/\.(pdf|docx)$/i.test(file.name)) {
    deviceSpecNote(F, `Chỉ nhận file PDF hoặc Word (.docx) — "${file.name}" không hợp lệ.`, "warn");
    input.value = "";
    return;
  }
  deviceSpecNote(F, `Đang đọc thông số kỹ thuật từ "${file.name}"...`);
  try {
    const read = await oilBbtnReadLines(file, (m) => deviceSpecNote(F, `Đang đọc "${file.name}"... ${m || ""}`));
    const h = MbaOilBbtn.parseMbaOilBbtnLines(read.lines || []).header;
    const specs = {};
    Object.entries(deviceSpecDerive(DeviceSpecs.deviceSpecsFromHeader(h))).forEach(([k, v]) => { specs[k] = { value: v }; });
    const extra = [];
    if (h.tram && $(F.tram) && !$(F.tram).value.trim()) { $(F.tram).value = h.tram; extra.push("Trạm"); }
    if (h.thietBi && $(F.device) && !$(F.device).value.trim()) { $(F.device).value = h.thietBi; extra.push("Thiết bị"); }
    // phát change như khi người dùng chọn (gợi ý Lần đo, tự điền phần thông số file không có từ dữ liệu đã lưu)
    if (extra.length) [F.tram, F.device].forEach((id) => { if ($(id)) $(id).dispatchEvent(new Event("change", { bubbles: true })); });
    const fromFile = deviceSpecApply(F, specs, "file");
    if (fromFile.length && F.after) F.after();
    const filled = extra.concat(fromFile);
    deviceSpecNote(F, filled.length
      ? `Đã lấy ${filled.length} thông số từ "${file.name}": ${filled.join(", ")}. Kiểm tra lại trước khi lưu.`
      : `Không tìm thấy thông số kỹ thuật nào trong "${file.name}" — nhập tay các ô thông số.`, filled.length ? "" : "warn");
    if (typeof refreshSavedTables === "function") refreshSavedTables();
  } catch (err) {
    deviceSpecNote(F, `Không đọc được "${file.name}": ${err && err.message ? err.message : err}`, "warn");
  } finally {
    input.value = ""; // không giữ / không đính kèm file này
  }
}

// ---------------------------------------------------------------------
// Dòng "Biên bản đính kèm khi lưu" ở tab con Lập BBTN
// ---------------------------------------------------------------------
function deviceSpecAttachInfo(key) {
  if (key === "f") {
    const f = $("f_bbtn") && $("f_bbtn").files && $("f_bbtn").files[0];
    if (f) return { name: f.name, clear: () => { $("f_bbtn").value = ""; $("f_bbtn").dispatchEvent(new Event("change", { bubbles: true })); } };
    const att = typeof _editingMeasurementAttachment !== "undefined" ? _editingMeasurementAttachment : null;
    if (att && att.bbtn_url && $("btnRemoveBbtn")) return { name: att.bbtn_name || "Biên bản thí nghiệm.pdf", clear: () => $("btnRemoveBbtn").click() };
    return null;
  }
  if (key === "o") {
    const f = typeof oilBbtnPendingFile === "function" ? oilBbtnPendingFile() : null;
    return f ? { name: f.name, clear: () => oilBbtnClearImport() } : null;
  }
  if (key === "t3") {
    const f = $("t3_file") && $("t3_file").files && $("t3_file").files[0];
    return f ? { name: f.name, clear: () => { $("t3_file").value = ""; $("t3_file").dispatchEvent(new Event("change", { bubbles: true })); } } : null;
  }
  return null;
}

function renderDeviceSpecAttachNotes() {
  ["f", "o", "t3"].forEach((key) => {
    const el = $(key + "_attachNote");
    if (!el) return;
    const info = deviceSpecAttachInfo(key);
    el.classList.toggle("hidden", !info);
    el.innerHTML = "";
    if (!info) return;
    el.append("📎 Biên bản đính kèm khi lưu: ");
    const b = document.createElement("strong");
    b.textContent = info.name;
    el.append(b, " (chọn ở tab Nhập BBTN cũ) ");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost";
    btn.style.cssText = "padding:2px 8px; font-size:11.5px;";
    btn.textContent = "Bỏ file";
    btn.addEventListener("click", () => { info.clear(); setTimeout(renderDeviceSpecAttachNotes, 50); });
    el.append(btn);
  });
}

let _deviceSpecsBound = false;
function setupDeviceSpecs() {
  if (_deviceSpecsBound) return; // initApp() có thể chạy lại (đăng nhập lại) — không gắn listener 2 lần
  _deviceSpecsBound = true;
  Object.entries(DEVICE_SPEC_FORMS).forEach(([key, F]) => {
    [F.tram, F.device].forEach((id) => { if ($(id)) $(id).addEventListener("change", () => deviceSpecAutoFill(key)); });
    // Người dùng tự sửa ô thông số → không còn là "app tự điền" (không bị thay khi đổi thiết bị)
    deviceSpecFieldEls(F).forEach((el) => {
      ["input", "change"].forEach((evt) => el.addEventListener(evt, (e) => {
        if (!e.isTrusted) return;
        delete el.dataset.specAuto;
        delete el.dataset.specPrev;
        if (el.tagName === "SELECT") el.dataset.specTouched = "1";
      }));
    });
    if (F.file && $(F.file)) {
      $(F.file).addEventListener("change", () => onDeviceSpecFile(key));
      const zone = $(F.zone);
      if (zone) {
        ["dragenter", "dragover"].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.add("dragover"); }));
        ["dragleave", "dragend"].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.remove("dragover"); }));
        zone.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          zone.classList.remove("dragover");
          const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (!file) return;
          const dt = new DataTransfer();
          dt.items.add(file);
          $(F.file).files = dt.files;
          $(F.file).dispatchEvent(new Event("change", { bubbles: true }));
        });
      }
    }
  });
  // Xóa form / đọc BBTN đầy đủ (Nhập BBTN cũ) → bỏ dòng báo thông số của form đó (không còn đúng nữa)
  const resetOn = { f: ["btnClearForm", "f_bbtn"], o: ["btnClearOilForm", "o_bbtn_file"], t3: ["btnT3Clear", "t3_file"], tio: ["btnClearTioOilForm"] };
  Object.entries(resetOn).forEach(([key, ids]) => ids.forEach((id) => {
    if (!$(id)) return;
    const isFile = $(id).tagName === "INPUT";
    $(id).addEventListener(isFile ? "change" : "click", () => {
      if (isFile && !($(id).files && $(id).files[0])) return; // "Bỏ file" — giữ nguyên trạng thái tự điền
      deviceSpecNote(DEVICE_SPEC_FORMS[key], "");
      deviceSpecFieldEls(DEVICE_SPEC_FORMS[key]).forEach((el) => { delete el.dataset.specAuto; delete el.dataset.specPrev; delete el.dataset.specTouched; });
    });
  }));
  ["f_bbtn", "o_bbtn_file", "t3_file"].forEach((id) => { if ($(id)) $(id).addEventListener("change", () => setTimeout(renderDeviceSpecAttachNotes, 0)); });
  renderDeviceSpecAttachNotes();
}
