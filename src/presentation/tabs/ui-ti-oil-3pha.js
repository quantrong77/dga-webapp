/* ui-ti-oil-3pha.js — Khối "BBTN dầu 3 pha" ở tab "Dầu cách điện" (TI/TU): đọc PDF hoặc nhập tay
   số liệu 3 pha chung 1 biên bản, đánh giá từng pha, tách thành các bản ghi instrument_oil_tests,
   xuất BBTN theo assets/template/template-bbtn-dau-3pha.docx. Xử lý số liệu nằm ở src/data/io/oil-bbtn.js, file
   này chỉ lo giao diện. Xem ui-auth.js đầu file đó để biết quy ước chia sẻ scope giữa các file. */

const TIO3_TEMPLATE_URL = "assets/template/template-bbtn-dau-3pha.docx";

let _currentT3BlobUrl = null;

function showT3Preview(fileOrUrl, fileName, badgeText) {
  const col = $("t3PreviewCol");
  const layout = $("t3SplitLayout");
  const frame = $("t3PreviewFrame");
  const nameEl = $("t3PreviewFileName");
  const badgeEl = $("t3PreviewBadge");
  const toggleBtn = $("btnToggleT3Preview");
  const toggleBtnText = $("btnToggleT3PreviewText");
  if (!col || !layout || !frame) return;

  if (_currentT3BlobUrl) {
    try { URL.revokeObjectURL(_currentT3BlobUrl); } catch (_) {}
    _currentT3BlobUrl = null;
  }

  let srcUrl = "";
  let name = fileName || "";

  if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
    name = name || fileOrUrl.name || "BBTN_3pha.pdf";
    try {
      _currentT3BlobUrl = URL.createObjectURL(fileOrUrl);
      srcUrl = _currentT3BlobUrl;
    } catch (e) {
      console.warn("Không tạo được blob URL cho T3:", e);
    }
  } else if (typeof fileOrUrl === "string" && fileOrUrl) {
    srcUrl = fileOrUrl;
    name = name || "BBTN_3pha.pdf";
  }

  if (srcUrl) {
    frame.src = srcUrl;
    if (nameEl) {
      nameEl.textContent = name;
      nameEl.title = name;
    }
    if (badgeEl && badgeText) badgeEl.textContent = badgeText;
    layout.classList.add("has-preview");
    col.classList.remove("hidden");
    if (toggleBtn) {
      toggleBtn.classList.remove("hidden");
      if (toggleBtnText) toggleBtnText.textContent = "Ẩn BBTN đối chiếu";
    }
  }
}

function hideT3Preview() {
  const col = $("t3PreviewCol");
  const layout = $("t3SplitLayout");
  const frame = $("t3PreviewFrame");
  const toggleBtn = $("btnToggleT3Preview");
  const toggleBtnText = $("btnToggleT3PreviewText");
  if (col) col.classList.add("hidden");
  if (layout) layout.classList.remove("has-preview");
  if (frame) frame.src = "about:blank";
  if (_currentT3BlobUrl) {
    try { URL.revokeObjectURL(_currentT3BlobUrl); } catch (_) {}
    _currentT3BlobUrl = null;
  }
  const hasFile = $("t3_file") && $("t3_file").files && $("t3_file").files[0];
  if (toggleBtn) {
    if (hasFile) {
      toggleBtn.classList.remove("hidden");
      if (toggleBtnText) toggleBtnText.textContent = "Hiện BBTN đối chiếu";
    } else {
      toggleBtn.classList.add("hidden");
    }
  }
}

function toggleT3Preview() {
  const col = $("t3PreviewCol");
  if (!col) return;
  if (col.classList.contains("hidden")) {
    const file = $("t3_file") && $("t3_file").files && $("t3_file").files[0];
    if (file) {
      showT3Preview(file, file.name, "Đã nạp file");
    }
  } else {
    hideT3Preview();
  }
}

const TIO3_TEXT_FIELDS = {
  tram: "t3_tram", thietBi: "t3_thietbi", hangSx: "t3_hangsx", viTriLayMau: "t3_vitrilaymau", uDm: "t3_udm",
  congSuat: "t3_congsuat", namSx: "t3_namsx", namVanHanh: "t3_namvanhanh", loaiDau: "t3_loaidau",
  ngayLayMau: "t3_ngay", lyDo: "t3_lydo", nhietDo: "t3_nhietdo", doAm: "t3_doam", ghiChu: "t3_ghichu", ketLuan: "t3_ketluan",
};

// Các bản ghi đang mở lại từ lịch sử — khi lưu sẽ cập nhật đúng các dòng này thay vì tạo mới.
let _tio3LoadedRecords = [];
// Đánh giá in sẵn trên PDF vừa đọc, để đối chiếu với kết quả app tính lại.
let _tio3Printed = {};
let _tio3SoBbtn = "";
// Kết luận do app tự viết lần gần nhất — nếu ô còn đúng nội dung này thì lần đánh giá sau được viết
// lại theo số liệu mới; người thí nghiệm đã sửa tay thì giữ nguyên.
let _tio3AutoKetLuan = "";

function tio3EquipmentType() {
  return $("dau_equipmenttype").value;
}

function tio3ManufacturerNames(forType) {
  const type = forType || tio3EquipmentType();
  return Array.from(new Set(
    _allStandards
      .filter((s) => isOilStandardRecord(s) && (s.equipment_type || s.equipmentType) === type)
      .map((s) => s.manufacturer).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, "vi"));
}

function refreshTio3ManufacturerOptions() {
  const sel = $("t3_nsx");
  if (!sel) return;
  const current = sel.value;
  const names = tio3ManufacturerNames();
  sel.innerHTML = '<option value="">— Chọn nhà sản xuất —</option>';
  names.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  });
  if (names.includes(current)) sel.value = current;
}

function tio3ReadForm() {
  const form = { equipmentType: tio3EquipmentType(), manufacturer: $("t3_nsx").value || null, soBbtn: _tio3SoBbtn, phases: {}, soCheTao: {} };
  Object.entries(TIO3_TEXT_FIELDS).forEach(([key, id]) => { form[key] = $(id).value.trim(); });
  OilBbtn.PHASES.forEach((ph) => {
    form.soCheTao[ph] = $(`t3_serial_${ph}`).value.trim();
    form.phases[ph] = {};
    OilBbtn.ITEMS.forEach((k) => {
      const raw = $(`t3_${k}_${ph}`).value;
      form.phases[ph][k] = raw === "" ? null : Number(raw);
    });
  });
  return form;
}

function tio3FillForm(form) {
  if (typeof _tioSavedSource !== "undefined") _tioSavedSource = "t3";
  Object.entries(TIO3_TEXT_FIELDS).forEach(([key, id]) => {
    if (form[key] !== undefined && form[key] !== null) $(id).value = form[key];
  });
  OilBbtn.PHASES.forEach((ph) => {
    $(`t3_serial_${ph}`).value = (form.soCheTao && form.soCheTao[ph]) || "";
    OilBbtn.ITEMS.forEach((k) => {
      const v = (form.phases[ph] || {})[k];
      $(`t3_${k}_${ph}`).value = v === null || v === undefined ? "" : v;
    });
  });
  if (typeof refreshSavedTables === "function") refreshSavedTables();
}

function tio3SetEquipmentType(type) {
  if (!type || tio3EquipmentType() === type) return;
  $("dau_equipmenttype").value = type;
  toggleDauEquipmentType();
  refreshTio3ManufacturerOptions();
}

function tio3Evaluate(form) {
  return OilBbtn.evaluateOilBbtn(DGA, {
    equipmentType: form.equipmentType, manufacturer: form.manufacturer,
    standards: toOilStandardsForLogic(_allStandards), umKv: form.uDm, phases: form.phases,
  });
}

function tio3Render(form, evaluation) {
  $("t3ResultWrap").classList.remove("hidden");
  $("t3Overall").innerHTML = tioVerdictPill(evaluation.overall);
  const mismatches = [];
  $("t3ResultTable").innerHTML = OilBbtn.ITEMS.filter((k) => evaluation.items[k]).map((k) => {
    const item = evaluation.items[k];
    const { name, unit } = OilBbtn.ITEM_LABELS[k];
    const cells = OilBbtn.PHASES.map((ph) => {
      const v = form.phases[ph][k];
      if (v === null) return "<td>—</td>";
      return `<td>${escapeHtml(v)}${item.verdicts[ph] && item.verdicts[ph] !== item.verdict ? ` ${tioVerdictPill(item.verdicts[ph])}` : ""}</td>`;
    }).join("");
    const printed = _tio3Printed[k] || "";
    if (printed && printed !== item.verdict) mismatches.push(`${name}: BBTN ghi "${printed}", app đánh giá "${item.verdict}"`);
    return `<tr><td>${escapeHtml(name)} (${escapeHtml(unit)})</td>${cells}
      <td style="font-size:12px;">${item.limit === null ? "—" : escapeHtml(item.limit)}</td>
      <td>${tioVerdictPill(item.verdict)}</td><td>${escapeHtml(printed || "—")}</td></tr>`;
  }).join("");
  const note = $("t3MismatchNote");
  note.textContent = mismatches.length ? `Khác với đánh giá trên biên bản — ${mismatches.join("; ")}. Kiểm tra lại tiêu chuẩn đã cấu hình hoặc số liệu.` : "";
  note.classList.toggle("hidden", mismatches.length === 0);
}

/** Tự viết Kết luận nếu ô đang trống hoặc vẫn là bản app viết lần trước. */
function tio3RefreshConclusion(form, evaluation) {
  const box = $("t3_ketluan");
  if (box.value.trim() && box.value.trim() !== _tio3AutoKetLuan) return;
  _tio3AutoKetLuan = OilBbtn.buildOilBbtnConclusion(evaluation, form.phases, form.manufacturer);
  box.value = _tio3AutoKetLuan;
  form.ketLuan = _tio3AutoKetLuan;
}

/** Bản ghi đã có của cùng trạm + thiết bị + pha + ngày lấy mẫu (nhập lại đúng biên bản cũ). */
function tio3FindExisting(rec) {
  const same = (a, b) => String(a || "").trim() === String(b || "").trim();
  return _allTioOilTests.find((r) => same(r.tram, rec.tram) && same(r.thiet_bi, rec.thiet_bi) && r.phase === rec.phase
    && String(DGA.formatSampleDate(r.sample_date) || "").slice(0, 10) === rec.sample_date) || null;
}

async function onTio3Analyze() {
  return tio3AnalyzeAndSave({});
}

/** Đánh giá + lưu BBTN 3 pha đang ở form. opts.file: file đính kèm (mặc định file đang chọn ở #t3_file);
 *  opts.batch: nhập hàng loạt (ui-oil-batch-import.js) — không hỏi "Ghi đè?" (người dùng đã tick chọn).
 *  Trả về true khi đã lưu. */
async function tio3AnalyzeAndSave(opts) {
  opts = opts || {};
  const form = tio3ReadForm();
  const hasData = OilBbtn.PHASES.some((ph) => OilBbtn.ITEMS.some((k) => form.phases[ph][k] !== null));
  if (!form.thietBi || !form.ngayLayMau) {
    notifyError("Vui lòng nhập ít nhất Vị trí lắp đặt (thiết bị) và Ngày lấy mẫu.");
    return;
  }
  if (!hasData) {
    notifyError("Vui lòng nhập số liệu thí nghiệm của ít nhất 1 pha.");
    return;
  }
  if (!form.manufacturer) {
    notifyError("QĐ1901 không có bảng số mặc định cho dầu TI/TU/Sứ xuyên (theo quy định nhà sản xuất) — vui lòng chọn Nhà sản xuất đã cấu hình tiêu chuẩn ở tab \"Cấu hình\" — mục \"Tiêu chuẩn\".");
    return;
  }
  const negativeCheck = [];
  OilBbtn.PHASES.forEach((ph) => OilBbtn.ITEMS.forEach((k) => {
    negativeCheck.push({ label: `${OilBbtn.ITEM_LABELS[k].name} pha ${ph}`, value: form.phases[ph][k] });
  }));
  if (alertIfNegative(negativeCheck)) return;

  const evaluation = tio3Evaluate(form);
  tio3RefreshConclusion(form, evaluation);
  tio3Render(form, evaluation);
  if (!canSaveEntry()) return;

  const groupId = (_tio3LoadedRecords[0] && _tio3LoadedRecords[0].bbtn_group_id) || Storage.newId();
  const records = OilBbtn.buildOilBbtnRecords(form, groupId);
  const toOverwrite = [];
  records.forEach((rec) => {
    const loaded = _tio3LoadedRecords.find((r) => r.phase === rec.phase);
    const existing = loaded || tio3FindExisting(rec);
    if (!existing) return;
    rec.id = existing.id;
    rec.created_at = existing.created_at;
    // Không chọn file mới thì giữ file đã đính kèm của bản ghi cũ.
    rec.bbtn_file_id = existing.bbtn_file_id;
    rec.bbtn_url = existing.bbtn_url;
    rec.bbtn_name = existing.bbtn_name;
    if (!loaded) toOverwrite.push(rec.phase);
  });
  if (toOverwrite.length && !opts.batch && !confirm(`Đã có số liệu pha ${toOverwrite.join(", ")} của thiết bị này cùng ngày lấy mẫu. Ghi đè bằng số liệu mới?`)) return;

  const file = "file" in opts ? opts.file : ($("t3_file").files && $("t3_file").files[0]);
  const btn = $("btnT3Analyze");
  btn.disabled = true;
  try {
    if (file) {
      try {
        const attachment = await Storage.uploadAttachment(groupId, file);
        records.forEach((rec) => Object.assign(rec, attachment));
      } catch (err) {
        notifyError("Chưa lưu vì không tải được file PDF lên: " + storageErrorMessage(err));
        return;
      }
    }
    const saved = [];
    try {
      // Tuần tự từng pha: lỗi giữa chừng thì báo đúng pha đã lưu; bấm lại không tạo dòng trùng vì
      // tio3FindExisting() khớp lại các pha vừa lưu.
      for (const rec of records) {
        await Storage.addInstrumentOilTest(rec);
        saved.push(rec.phase);
      }
    } catch (err) {
      notifyError(`Đã lưu ${saved.length ? "pha " + saved.join(", ") : "0 pha"}, phần còn lại LƯU THẤT BẠI: ${storageErrorMessage(err)}`);
      await refreshTioOilTestsUI();
      return;
    }
    await registerStationIfNew(form.tram);
    await refreshTioOilTestsUI();
    _tio3LoadedRecords = _allTioOilTests.filter((r) => r.bbtn_group_id === groupId);
    $("t3EditingNote").classList.remove("hidden");
    showToast(`Đã lưu ${saved.length} bản ghi: pha ${saved.join(", ")}.`);
    return true;
  } finally {
    btn.disabled = false;
  }
}

async function onTio3Export() {
  const form = tio3ReadForm();
  if (!OilBbtn.PHASES.some((ph) => OilBbtn.ITEMS.some((k) => form.phases[ph][k] !== null))) {
    notifyError("Chưa có số liệu để xuất BBTN.");
    return;
  }
  const evaluation = tio3Evaluate(form);
  tio3RefreshConclusion(form, evaluation);
  tio3Render(form, evaluation);

  const btn = $("btnT3Export");
  btn.disabled = true;
  try {
    const res = await fetch(TIO3_TEMPLATE_URL);
    if (!res.ok) throw new Error(`Không tải được mẫu BBTN (${TIO3_TEMPLATE_URL}) — mã lỗi ${res.status}`);
    const Ctor = typeof window.docxtemplater === "function" ? window.docxtemplater : window.docxtemplater.default;
    const doc = new Ctor(new window.PizZip(await res.arrayBuffer()), { paragraphLoop: true, linebreaks: true });
    doc.render(OilBbtn.buildOilBbtnExportData(form, evaluation));
    const blob = doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const namePart = [form.thietBi, form.ngayLayMau].filter(Boolean).join("_").replace(/[\\/:*?"<>|\s]+/g, "-");
    downloadBlob(blob, `BBTN_Dau_3pha${namePart ? "_" + namePart : ""}.docx`);
    showToast("Đã xuất BBTN. Bổ sung Phụ lục và ký trong Word trước khi ban hành.");
  } catch (err) {
    notifyError("Không xuất được BBTN: " + ((err && err.message) || err));
  } finally {
    btn.disabled = false;
  }
}

function tio3ClearForm() {
  hideT3Preview();
  Object.values(TIO3_TEXT_FIELDS).forEach((id) => { $(id).value = ""; });
  $("t3_vitrilaymau").value = "Van lấy mẫu";
  $("t3_nsx").value = "";
  OilBbtn.PHASES.forEach((ph) => {
    $(`t3_serial_${ph}`).value = "";
    OilBbtn.ITEMS.forEach((k) => { $(`t3_${k}_${ph}`).value = ""; });
  });
  $("t3_file").value = "";
  tio3RenderFileLabel();
  $("t3ImportNote").classList.add("hidden");
  $("t3EditingNote").classList.add("hidden");
  $("t3ResultWrap").classList.add("hidden");
  _tio3LoadedRecords = [];
  _tio3Printed = {};
  _tio3SoBbtn = "";
  _tio3AutoKetLuan = "";
  if (typeof refreshSavedTables === "function") refreshSavedTables();
}

function tio3RenderFileLabel() {
  const file = $("t3_file").files && $("t3_file").files[0];
  const label = $("t3DropzoneText");
  $("t3Dropzone").classList.toggle("has-file", !!file);
  if (file) label.textContent = file.name;
  else label.innerHTML = 'Kéo thả file PDF BBTN 3 pha vào đây, hoặc <span class="file-dropzone-link">bấm để chọn file</span>';
}

/** Đọc file PDF vừa chọn và điền form — người thí nghiệm kiểm tra lại rồi mới bấm lưu. */
async function onTio3FileSelected() {
  tio3RenderFileLabel();
  const file = $("t3_file").files && $("t3_file").files[0];
  if (!file) {
    hideT3Preview();
    return;
  }
  showT3Preview(file, file.name, "Đang đọc BBTN...");
  const note = $("t3ImportNote");
  note.classList.remove("hidden");
  if (!window.BbtnImport || !window.BbtnImport.readLines) {
    note.textContent = "Bộ đọc PDF chưa tải xong hoặc tải lỗi — vui lòng thử lại sau vài giây, hoặc nhập tay.";
    return;
  }
  note.textContent = "Đang đọc biên bản...";
  let parsed;
  let viaOCR = false;
  try {
    const read = await window.BbtnImport.readLines(file, (m) => {
      if (m && m.status === "recognizing text") {
        note.textContent = "File là ảnh scan — đang nhận diện chữ (OCR)" + (typeof m.progress === "number" ? ` (${Math.round(m.progress * 100)}%)` : "") + "...";
      }
    });
    viaOCR = read.viaOCR;
    parsed = OilBbtn.parseOilBbtnLines(read.lines);
  } catch (err) {
    note.textContent = "Không đọc được file này — vui lòng nhập tay. (" + ((err && err.message) || err) + ")";
    return;
  }
  if (!parsed.isThreePhase) {
    note.textContent = "Không tìm thấy bảng kết quả 3 pha (A, B, C) trong file này — vui lòng kiểm tra đúng mẫu BBTN dầu PTC3/BM.14, hoặc nhập tay.";
    return;
  }

  tio3ClearLoadedStateForImport();
  tio3SetEquipmentType(parsed.equipmentType);
  tio3FillForm(parsed);
  _tio3Printed = parsed.printed;
  _tio3SoBbtn = parsed.soBbtn;
  const nsx = OilBbtn.matchOilBbtnManufacturer(parsed.hangSx, tio3ManufacturerNames());
  $("t3_nsx").value = nsx || "";

  const warnings = [];
  if (viaOCR) warnings.push("file là ảnh scan, số liệu đọc bằng OCR nên cần so kỹ từng ô");
  if (!parsed.equipmentType) warnings.push(`không nhận ra "${parsed.thietBi}" là TI hay TU — đang để theo loại thiết bị đã chọn ở đầu tab`);
  if (!nsx) warnings.push(`"${parsed.hangSx || "hãng sản xuất"}" chưa khớp tiêu chuẩn nào đã cấu hình — vui lòng chọn Nhà sản xuất`);
  const missing = OilBbtn.ITEMS.filter((k) => k !== "tgd20" && parsed.phases.A[k] === undefined).map((k) => OilBbtn.ITEM_LABELS[k].name);
  if (missing.length) warnings.push(`chưa đọc được: ${missing.join(", ")}`);
  note.textContent = `Đã đọc ${parsed.rowCount} hạng mục cho 3 pha${parsed.soBbtn ? ` — biên bản số ${parsed.soBbtn}` : ""}. ` +
    (warnings.length ? `Lưu ý: ${warnings.join("; ")}. ` : "") + "Kiểm tra lại rồi bấm \"Đánh giá & Lưu 3 pha\".";
}

/** PDF mới là 1 biên bản mới: bỏ liên kết với biên bản đang mở và kết quả đánh giá cũ. */
function tio3ClearLoadedStateForImport() {
  _tio3LoadedRecords = [];
  _tio3AutoKetLuan = "";
  $("t3EditingNote").classList.add("hidden");
  $("t3ResultWrap").classList.add("hidden");
}

/** Nút "BBTN 3 pha" ở bảng lịch sử: mở các pha cùng biên bản. Bản ghi nhập từng pha lẻ (chưa có
 *  bbtn_group_id) thì gom theo cùng trạm + thiết bị + ngày lấy mẫu. */
function openTio3FromRecord(rec) {
  const day = (r) => String(DGA.formatSampleDate(r.sample_date) || "").slice(0, 10);
  const inSameReport = (r) => (rec.bbtn_group_id
    ? r.bbtn_group_id === rec.bbtn_group_id
    : !r.bbtn_group_id && r.tram === rec.tram && r.thiet_bi === rec.thiet_bi && day(r) === day(rec));
  const records = _allTioOilTests.filter((r) => inSameReport(r) && OilBbtn.PHASES.includes(r.phase));
  if (!records.length) return;
  tio3ClearForm();
  const form = OilBbtn.oilBbtnFormFromRecords(records);
  tio3SetEquipmentType(form.equipmentType);
  refreshTio3ManufacturerOptions();
  tio3FillForm(form);
  $("t3_vitrilaymau").value = form.viTriLayMau || "Van lấy mẫu";
  $("t3_nsx").value = form.manufacturer;
  _tio3SoBbtn = form.soBbtn;
  _tio3LoadedRecords = records;
  $("t3EditingNote").classList.remove("hidden");
  if (typeof inputOpenRecord === "function") inputOpenRecord("dau");
  document.querySelector('button.tab-btn[data-tab="dau"]').click();
  tio3Render(form, tio3Evaluate(form));
  $("tio3Panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Nối sự kiện 1 lần lúc khởi động app — xem initApp(), app-core.js. */
function setupTio3Phase() {
  setupCombo({
    input: $("t3_tram"),
    toggleBtn: $("t3_tram_toggle"),
    listEl: $("t3_tram_list"),
    getOptions: () => _allStations
      .slice()
      .sort((a, b) => (a.ten_tram || "").localeCompare(b.ten_tram || "", "vi"))
      .map((s) => ({ value: s.ten_tram, label: (s.ma_tram ? s.ma_tram + " — " : "") + s.ten_tram })),
  });
  $("btnT3Analyze").addEventListener("click", onTio3Analyze);
  $("btnT3Export").addEventListener("click", onTio3Export);
  $("btnT3Clear").addEventListener("click", tio3ClearForm);
  if ($("btnT3NewTab")) {
    $("btnT3NewTab").addEventListener("click", () => {
      const frame = $("t3PreviewFrame");
      if (frame && frame.src && frame.src !== "about:blank") {
        window.open(frame.src, "_blank", "noopener");
      }
    });
  }
  if ($("btnCloseT3Preview")) {
    $("btnCloseT3Preview").addEventListener("click", hideT3Preview);
  }
  if ($("btnToggleT3Preview")) {
    $("btnToggleT3Preview").addEventListener("click", toggleT3Preview);
  }
  $("t3_file").addEventListener("change", onTio3FileSelected);
  $("dau_equipmenttype").addEventListener("change", refreshTio3ManufacturerOptions);

  const zone = $("t3Dropzone");
  ["dragenter", "dragover"].forEach((evt) => zone.addEventListener(evt, (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  }));
  ["dragleave", "dragend"].forEach((evt) => zone.addEventListener(evt, (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
  }));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      const note = $("t3ImportNote");
      note.textContent = `Chỉ nhận file PDF — "${file.name}" không phải PDF.`;
      note.classList.remove("hidden");
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    $("t3_file").files = dt.files;
    $("t3_file").dispatchEvent(new Event("change", { bubbles: true }));
  });
}
