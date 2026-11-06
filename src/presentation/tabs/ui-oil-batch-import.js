/* ui-oil-batch-import.js — Nhập HÀNG LOẠT nhiều BBTN dầu (hoặc cả thư mục) ở tab "Lý-Hóa dầu" (tab con "Nhập BBTN
   cũ") — cùng cách làm với "Nhập hàng loạt" của tab Khí hòa tan (ui-batch-import.js): chọn nhiều file / cả thư mục →
   đọc tuần tự, xem trước từng biên bản → tick chọn → lưu.
   1 bộ khung dùng chung (createOilBatch) cho 2 loại biên bản:
     - "o"  dầu MBA/Kháng dầu (PDF / Word .docx): mỗi file = thùng dầu chính + OLTC nếu có, lưu như "Đánh giá & Lưu
            cả biên bản" (oilFillFromParsed/oltcFillFromParsed + onSaveOilBbtnAll, ui-oil.js).
     - "t3" BBTN dầu 3 pha TI/TU/Sứ xuyên (PDF): lưu như "Đánh giá & Lưu 3 pha" (tio3FillForm + tio3AnalyzeAndSave,
            ui-ti-oil-3pha.js).
   Mỗi file được điền vào đúng form rồi lưu qua đúng hàm của nhập từng file — cùng cách đánh giá, cùng file đính kèm
   + bbtn_group_id, cùng kiểm tra trùng. Trạm / Thiết bị lấy theo form nếu đã nhập (cả đợt cùng 1 thiết bị, như tab
   Khí hòa tan), để trống thì theo từng biên bản. */

// Đang lưu hàng loạt: các hàm lưu không hỏi "Ghi đè?" từng file (người dùng đã chủ động tick chọn dòng "đã có biên
// bản ngày này" ở bảng xem trước) — xem onAnalyzeOil()/onAnalyzeOltcOil()/tio3AnalyzeAndSave().
let _oilBatchSaving = false;

function oilBatchNorm(v) {
  return String(v === null || v === undefined ? "" : v).trim();
}

/**
 * @param {object} cfg
 *   prefix: tiền tố id ("o" → #oBatchDropzone, #oBatchFiles, #oBatchTable...)
 *   fileRe: RegExp tên file nhận
 *   baseDevice(): { tram, thietBi } đang nhập ở form (rỗng = theo từng biên bản)
 *   read(file): Promise<{ parsed, ngay, tram, thietBi, error?, warn?: string[] }>
 *   cells(row): mảng HTML các cột thêm (sau cột Ngày lấy mẫu)
 *   recordKeys(row, dev): khóa các bản ghi SẼ lưu, tính đúng như lúc lưu (để phát hiện trùng giữa các file trong đợt)
 *   isDuplicate(row, dev): có bản ghi đã lưu trùng — dùng ĐÚNG hàm tìm trùng của lúc lưu (oilFindExisting...),
 *                          vì khi lưu hàng loạt không hỏi "Ghi đè?" nữa
 *   saveRow(row, ctx): Promise<boolean>; beginSave(): ctx; endSave(ctx)
 *   noun: "biên bản dầu MBA"
 */
function createOilBatch(cfg) {
  const P = cfg.prefix;
  const id = (s) => $(P + s);
  let rows = [];
  let busy = false; // đang đọc / đang lưu — không nhận đợt file mới giữa chừng

  const rowDevice = (row) => {
    if (row.lockedDevice) return row.lockedDevice; // đã chốt khi lưu (xem save())
    const base = cfg.baseDevice();
    return { tram: base.tram || oilBatchNorm(row.tram), thietBi: base.thietBi || oilBatchNorm(row.thietBi) };
  };

  function recompute(row) {
    if (row.statusKind === "pending" || row.saved) return;
    if (row.error) { row.statusKind = "bad"; row.status = row.error; row.include = false; return; }
    const dev = rowDevice(row);
    if (!dev.thietBi) { row.statusKind = "bad"; row.status = "Chưa có Thiết bị — nhập ở form bên dưới"; row.include = false; return; }
    if (!row.ngay) { row.statusKind = "bad"; row.status = "Chưa có Ngày lấy mẫu — nhập ở cột Ngày"; row.include = false; return; }
    const saved = cfg.isDuplicate(row, dev);
    const idx = rows.indexOf(row);
    const keys = cfg.recordKeys(row, dev);
    const dupInBatch = rows.slice(0, idx).some((o) => !o.error && !o.saved && cfg.recordKeys(o, rowDevice(o)).some((k) => keys.includes(k)));
    const warn = (row.warn || []).filter(Boolean);
    if (saved || dupInBatch) {
      row.statusKind = "warn";
      row.status = (saved ? "Đã có biên bản thiết bị này cùng ngày — tick để ghi đè"
        : "Trùng biên bản (thiết bị, ngày, pha) với 1 file phía trên — tick thì file này GHI ĐÈ file đó") +
        (warn.length ? ` · ${warn.join("; ")}` : "");
      if (row.autoInclude !== false) row.include = false;
    } else {
      row.statusKind = warn.length ? "warn" : "ok";
      row.status = warn.length ? `Hợp lệ · ${warn.join("; ")}` : "Hợp lệ";
      if (row.autoInclude !== false) row.include = true;
    }
  }

  function render() {
    const tbody = id("BatchTable");
    tbody.innerHTML = rows.map((row) => {
      const dev = row.statusKind === "pending" && !row.parsed ? { tram: "", thietBi: "" } : rowDevice(row);
      const disabled = row.statusKind === "bad" || row.statusKind === "pending" || row.saved;
      return `
        <tr data-row-id="${row.id}">
          <td><input type="checkbox" class="obatch-check" ${row.include ? "checked" : ""} ${disabled ? "disabled" : ""} /></td>
          <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(row.file.name)}">${escapeHtml(row.file.name)}</td>
          <td>${escapeHtml(dev.tram || "—")}</td>
          <td>${escapeHtml(dev.thietBi || "—")}</td>
          <td><input type="date" class="obatch-ngay" value="${row.ngay || ""}" ${row.statusKind === "pending" || row.saved ? "disabled" : ""} style="padding:4px 6px; font-size:12.5px;" /></td>
          ${(row.parsed ? cfg.cells(row) : cfg.cells(null)).map((c) => `<td>${c}</td>`).join("")}
          <td><span class="pill ${batchPillClass(row.saved ? "ok" : row.statusKind)}" style="font-size:11px; white-space:normal; display:inline-block; line-height:1.4;">${escapeHtml(row.status)}</span></td>
        </tr>`;
    }).join("");
    tbody.querySelectorAll("tr").forEach((tr) => {
      const row = rows.find((r) => r.id === tr.dataset.rowId);
      if (!row) return;
      tr.querySelector(".obatch-check").addEventListener("change", (e) => {
        row.include = e.target.checked;
        row.autoInclude = false; // người dùng đã tự chọn — không tự đổi lại khi tính lại trạng thái
        summary();
      });
      tr.querySelector(".obatch-ngay").addEventListener("change", (e) => {
        row.ngay = e.target.value;
        rows.forEach(recompute);
        render();
        summary();
      });
    });
  }

  function summary() {
    const total = rows.length;
    const included = rows.filter((r) => r.include).length;
    id("BatchSummaryText").textContent = total ? `${total} file — ${included} biên bản sẽ được lưu (bỏ/tích chọn từng dòng nếu cần).` : "—";
  }

  function reset() {
    rows = [];
    id("BatchPreviewWrap").classList.add("hidden");
    id("BatchTable").innerHTML = "";
    id("BatchProgressText").textContent = "";
  }

  async function handleFiles(fileList) {
    if (busy) {
      notifyError("Đang đọc / lưu đợt biên bản trước — chờ xong rồi chọn đợt file mới.");
      return;
    }
    busy = true;
    try {
      await readFiles(fileList);
    } finally {
      busy = false;
    }
  }

  async function readFiles(fileList) {
    const all = Array.from(fileList || []);
    const files = all.filter((f) => cfg.fileRe.test(f.name) && !/^~\$/.test(f.name));
    const skipped = all.length - files.length;
    const skipNote = id("BatchSkippedNote");
    skipNote.textContent = skipped > 0 ? `Đã bỏ qua ${skipped} file không đúng loại ${cfg.fileLabel} (kể cả file tạm "~$..." của Word).` : "";
    skipNote.classList.toggle("hidden", skipped === 0);
    if (!files.length) { reset(); return; }
    id("BatchPreviewWrap").classList.remove("hidden");
    id("BatchProgressText").textContent = "";
    id("BatchSummaryText").textContent = `Đang đọc ${files.length} file...`;
    rows = files.map((file, i) => ({ id: P + "brow_" + i + "_" + Date.now(), file, parsed: null, ngay: "", status: "Đang đọc...", statusKind: "pending", include: false }));
    render();
    for (const row of rows) {
      try {
        Object.assign(row, await cfg.read(row.file));
      } catch (err) {
        row.error = "Không đọc được: " + ((err && err.message) || String(err));
      }
      row.statusKind = "";
      recompute(row);
      render();
    }
    rows.sort((a, b) => String(a.ngay || "9999").localeCompare(String(b.ngay || "9999")));
    rows.forEach(recompute);
    render();
    summary();
  }

  async function save() {
    if (busy) return;
    const todo = rows.filter((r) => r.include && r.parsed && !r.saved);
    if (!todo.length) { notifyError("Chưa chọn biên bản nào để lưu."); return; }
    if (typeof canSaveEntry === "function" && !canSaveEntry()) return;
    busy = true;
    // Chốt Trạm / Thiết bị của từng dòng TRƯỚC khi lưu: trong lúc lưu, form bị điền lần lượt từng biên bản nên
    // đọc lại form (rowDevice) giữa chừng sẽ ra thiết bị của file vừa lưu trước.
    const devices = new Map(todo.map((r) => [r, rowDevice(r)]));
    todo.forEach((r) => { r.lockedDevice = devices.get(r); });
    const ctx = cfg.beginSave();
    ctx.attach = id("BatchAttach").checked;
    const btn = id("BatchSave");
    btn.disabled = true;
    let ok = 0;
    let fail = 0;
    try {
      for (let i = 0; i < todo.length; i++) {
        const row = todo[i];
        id("BatchProgressText").textContent = `Đang lưu ${i + 1}/${todo.length}: ${row.file.name}...`;
        row.statusKind = "pending";
        row.status = "Đang lưu...";
        render();
        let saved = false;
        row.saveError = "";
        _oilBatchSaving = true;
        try {
          saved = await cfg.saveRow(row, devices.get(row), ctx);
        } catch (err) {
          row.saveError = (err && err.message) || String(err);
        } finally {
          _oilBatchSaving = false;
        }
        if (saved) { ok++; row.saved = true; row.statusKind = "ok"; row.status = "Đã lưu"; row.include = false; }
        else {
          // để người dùng sửa form/tick lại rồi lưu riêng dòng này (dòng không bị khóa)
          fail++;
          row.include = false;
          row.statusKind = "warn";
          row.status = "Lưu thất bại" + (row.saveError ? ": " + row.saveError : " — xem thông báo lỗi ở góc màn hình");
        }
        render();
      }
    } finally {
      todo.forEach((r) => { if (!r.saved) delete r.lockedDevice; }); // dòng chưa lưu được: lại theo form
      busy = false;
      btn.disabled = false;
      cfg.endSave(ctx);
      if (typeof refreshSavedTables === "function") refreshSavedTables();
    }
    id("BatchProgressText").textContent = `Xong: đã lưu ${ok} biên bản` + (fail ? `, ${fail} biên bản lỗi (xem cột Trạng thái).` : ".");
    summary();
    if (ok) showToast(`Đã lưu ${ok} ${cfg.noun}.`);
  }

  function setup() {
    const zone = id("BatchDropzone");
    const input = id("BatchFiles");
    if (!zone || !input || zone.dataset.bound === "1") return;
    zone.dataset.bound = "1";
    input.addEventListener("change", (e) => { handleFiles(e.target.files); });
    id("BatchChooseFolder").addEventListener("click", () => id("BatchFolderFiles").click());
    id("BatchFolderFiles").addEventListener("change", (e) => { handleFiles(e.target.files); });
    id("BatchSelectAll").addEventListener("click", () => {
      rows.forEach((r) => { if (!r.saved && (r.statusKind === "ok" || r.statusKind === "warn")) r.include = true; });
      render();
      summary();
    });
    id("BatchSelectNone").addEventListener("click", () => {
      rows.forEach((r) => { r.include = false; });
      render();
      summary();
    });
    id("BatchSave").addEventListener("click", save);
    zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    ["dragenter", "dragover"].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.add("dragover"); }));
    ["dragleave", "dragend"].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.remove("dragover"); }));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove("dragover");
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) handleFiles(files);
    });
    // Đổi Trạm / Thiết bị ở form → cập nhật cột Trạm/Thiết bị + trạng thái trùng của bảng xem trước
    (cfg.deviceInputs || []).forEach((iid) => $(iid) && $(iid).addEventListener("change", () => {
      if (!rows.length || busy) return;
      rows.forEach(recompute);
      render();
      summary();
    }));
  }

  return { setup, handleFiles, rows: () => rows };
}

// ---------------------------------------------------------------------
// Dầu MBA/Kháng dầu — thùng dầu chính + OLTC
// ---------------------------------------------------------------------
function oilBatchPartLabel(part, phaseHint) {
  if (!part || !part.matched || !part.matched.length) return "—";
  const where = part.threePhase ? `pha ${(part.phases || ["A", "B", "C"]).join(", ")}` : phaseHint ? `pha ${phaseHint}` : "mẫu chung";
  return `${part.matched.length} chỉ tiêu (${where})`;
}

const OilMbaBatch = createOilBatch({
  prefix: "o",
  fileRe: /\.(pdf|docx)$/i,
  fileLabel: "PDF / Word .docx",
  noun: "biên bản dầu MBA",
  deviceInputs: ["o_tram", "o_thietbi"],
  baseDevice: () => ({ tram: oilBatchNorm($("o_tram") && $("o_tram").value), thietBi: oilBatchNorm($("o_thietbi") && $("o_thietbi").value) }),
  async read(file) {
    if (!window.MbaOilBbtn) throw new Error("bộ đọc BBTN chưa tải xong");
    const read = await oilBbtnReadLines(file);
    const parsed = MbaOilBbtn.parseMbaOilBbtnLines(read.lines || []);
    const h = parsed.header || {};
    const out = { parsed, ngay: h.ngay || "", tram: h.tram, thietBi: h.thietBi, warn: [] };
    if (!parsed.matched.length && !parsed.oltc) out.error = "Không nhận ra chỉ tiêu dầu nào";
    if (read.viaOCR) out.warn.push("đọc bằng OCR");
    if (!h.voltageClass) out.warn.push("chưa đọc được cấp điện áp — dùng cấp ở form");
    return out;
  },
  cells(row) {
    if (!row) return ["—", "—"];
    const h = row.parsed.header || {};
    return [escapeHtml(oilBatchPartLabel(row.parsed, h.phase)), escapeHtml(oilBatchPartLabel(row.parsed.oltc, h.phase))];
  },
  recordKeys(row, dev) {
    return oilBatchPlannedRecords(row, dev).map((x) => x.part + "|" + DGA.oilSeriesKey(x.rec) + "|" + (x.rec.oil_sample_point || x.rec.oltc_sample_point) + "|" + row.ngay);
  },
  isDuplicate(row, dev) {
    return oilBatchPlannedRecords(row, dev).some((x) => (x.part === "main" ? oilFindExisting(x.rec) : oltcFindExisting(x.rec)));
  },
  beginSave: () => ({
    ...OilMbaBatchBase(),
    voltageClass: $("o_voltage_class").value, oilState: $("o_oilstate").value,
    nsx: $("o_nsx").value, membrane: $("o_membrane").checked, inhibited: $("o_inhibited").value, oxMethod: $("o_oxmethod").value,
    otVoltageClass: $("ot_voltage_class").value, otOilState: $("ot_oilstate").value, otNsx: $("ot_nsx").value,
  }),
  async saveRow(row, dev, ctx) {
    clearOilForm();
    clearOltcOilForm();
    $("o_tram").value = dev.tram;
    $("o_thietbi").value = dev.thietBi;
    oilBatchApplyFormDefaults(ctx);
    resetOilTestEditState();
    _oilBbtnImport = { file: ctx.attach ? row.file : null, groupId: Storage.newId(), attachment: null };
    if (typeof _oilBbtnLastHeader !== "undefined") _oilBbtnLastHeader = row.parsed.header || null;
    oilFillFromParsed(row.parsed);
    oltcFillFromParsed(row.parsed);
    // Trạm / Thiết bị / Ngày của cả đợt (form) hoặc đã sửa ở bảng xem trước → ghi đè giá trị đọc từ biên bản
    $("o_tram").value = dev.tram;
    $("o_thietbi").value = dev.thietBi;
    $("o_ngay").value = row.ngay;
    if (typeof syncOltcFromMain === "function") syncOltcFromMain();
    if (typeof oltcInheritOn === "function" && !oltcInheritOn()) {
      $("ot_tram").value = dev.tram;
      $("ot_thietbi").value = dev.thietBi;
      $("ot_ngay").value = row.ngay;
    }
    return (await onSaveOilBbtnAll()) === true;
  },
  endSave(ctx) {
    // Trả form về trống, giữ Trạm / Thiết bị / cấp điện áp / trạng thái dầu của cả đợt
    clearOilForm();
    clearOltcOilForm();
    if (ctx.tram) $("o_tram").value = ctx.tram;
    if (ctx.thietBi) $("o_thietbi").value = ctx.thietBi;
    oilBatchApplyFormDefaults(ctx);
    if (typeof syncOltcFromMain === "function") syncOltcFromMain();
  },
});

/** Giá trị form người dùng đã chọn cho cả đợt (clearOilForm()/clearOltcOilForm() xóa trước mỗi file): cấp điện áp,
 *  trạng thái dầu, NSX, màng N2, chất ức chế, phương pháp ôxi hóa; OLTC khi không kế thừa từ dầu MBA chính.
 *  Biên bản đọc được giá trị nào (cấp điện áp, trạng thái dầu) thì oilFillFromParsed() ghi đè sau đó. */
function oilBatchApplyFormDefaults(ctx) {
  ensureOilVoltageOption("o_voltage_class", ctx.voltageClass);
  $("o_voltage_class").value = ctx.voltageClass;
  $("o_oilstate").value = ctx.oilState;
  $("o_nsx").value = ctx.nsx || "";
  $("o_inhibited").value = ctx.inhibited || "";
  $("o_oxmethod").value = ctx.oxMethod || "";
  toggleOilMembraneField();
  $("o_membrane").checked = !!ctx.membrane;
  if (ctx.otVoltageClass) { ensureOilVoltageOption("ot_voltage_class", ctx.otVoltageClass); $("ot_voltage_class").value = ctx.otVoltageClass; }
  if (ctx.otOilState) $("ot_oilstate").value = ctx.otOilState;
  if ($("ot_nsx")) $("ot_nsx").value = ctx.otNsx || "";
}

/** Bản ghi thùng chính / OLTC mà 1 biên bản SẼ tạo ra (đúng điểm lấy mẫu + pha như oilFillFromParsed/
 *  oltcFillFromParsed điền vào form) — để kiểm tra trùng bằng chính oilFindExisting()/oltcFindExisting(). */
function oilBatchPlannedRecords(row, dev) {
  const p = row.parsed;
  const h = p.header || {};
  const base = { tram: dev.tram, thiet_bi: dev.thietBi, sample_date: row.ngay };
  const out = [];
  const cols = (part) => Object.keys(part.values || {}).filter((c) => Object.keys(part.values[c] || {}).length);
  if (p.matched && p.matched.length) {
    const pharieng = !!(h.phase || p.threePhase);
    cols(p).forEach((c) => out.push({ part: "main", rec: { ...base, oil_sample_point: pharieng ? "pharieng" : "chung", phase: pharieng ? (c === "X" ? h.phase : c) : "" } }));
  }
  if (p.oltc && p.oltc.matched && p.oltc.matched.length) {
    const pharieng = !!(p.oltc.threePhase || h.phase);
    cols(p.oltc).forEach((c) => out.push({ part: "oltc", rec: { ...base, oltc_sample_point: pharieng ? "pharieng" : "trungtinh", phase: pharieng ? (c === "X" ? h.phase : c) : "" } }));
  }
  return out;
}
function OilMbaBatchBase() {
  return { tram: oilBatchNorm($("o_tram").value), thietBi: oilBatchNorm($("o_thietbi").value) };
}

// ---------------------------------------------------------------------
// BBTN dầu 3 pha TI/TU/Sứ xuyên (PDF, mẫu PTC3/BM.14)
// ---------------------------------------------------------------------
const Tio3Batch = createOilBatch({
  prefix: "t3",
  fileRe: /\.pdf$/i,
  fileLabel: "PDF",
  noun: "biên bản dầu 3 pha",
  deviceInputs: ["t3_tram", "t3_thietbi"],
  baseDevice: () => ({ tram: oilBatchNorm($("t3_tram") && $("t3_tram").value), thietBi: oilBatchNorm($("t3_thietbi") && $("t3_thietbi").value) }),
  async read(file) {
    if (!window.BbtnImport || !window.BbtnImport.readLines || typeof OilBbtn === "undefined") throw new Error("bộ đọc PDF chưa tải xong");
    const read = await window.BbtnImport.readLines(file);
    const parsed = OilBbtn.parseOilBbtnLines(read.lines || []);
    const out = { parsed, ngay: parsed.ngayLayMau || "", tram: parsed.tram, thietBi: parsed.thietBi, warn: [] };
    if (!parsed.isThreePhase) out.error = "Không thấy bảng kết quả 3 pha (A, B, C) — kiểm tra đúng mẫu PTC3/BM.14";
    if (read.viaOCR) out.warn.push("đọc bằng OCR");
    const nsx = OilBbtn.matchOilBbtnManufacturer(parsed.hangSx, tio3NamesFor(parsed.equipmentType || tio3EquipmentType()));
    out.nsx = nsx || "";
    if (!nsx && !$("t3_nsx").value) out.warn.push(`"${parsed.hangSx || "hãng SX"}" chưa khớp tiêu chuẩn NSX — chọn Nhà sản xuất ở form`);
    return out;
  },
  cells(row) {
    if (!row) return ["—", "—", "—"];
    const p = row.parsed;
    const phases = OilBbtn.PHASES.filter((ph) => OilBbtn.ITEMS.some((k) => oilBbtnHasValue((p.phases[ph] || {})[k])));
    return [
      escapeHtml(p.equipmentType ? tioEquipmentTypeShort(p.equipmentType) : "theo loại đã chọn"),
      escapeHtml(row.nsx || $("t3_nsx").value || "—"),
      escapeHtml(phases.length ? `pha ${phases.join(", ")} · ${p.rowCount || 0} hạng mục` : "—"),
    ];
  },
  recordKeys(row, dev) {
    return tio3BatchPhases(row).map((ph) => [oilBatchNorm(dev.tram), oilBatchNorm(dev.thietBi), ph, row.ngay].join("|"));
  },
  isDuplicate(row, dev) {
    // đúng hàm tìm trùng của "Đánh giá & Lưu 3 pha" (tio3FindExisting, ui-ti-oil-3pha.js)
    return tio3BatchPhases(row).some((ph) => tio3FindExisting({ tram: dev.tram, thiet_bi: dev.thietBi, phase: ph, sample_date: row.ngay }));
  },
  beginSave: () => ({ tram: oilBatchNorm($("t3_tram").value), thietBi: oilBatchNorm($("t3_thietbi").value), nsx: $("t3_nsx").value, type: tio3EquipmentType() }),
  async saveRow(row, dev, ctx) {
    tio3ClearForm();
    tio3ClearLoadedStateForImport();
    // Biên bản không nhận ra TI/TU/Sứ xuyên → theo loại đang chọn khi bắt đầu lưu (không lấy loại của file trước)
    tio3SetEquipmentType(row.parsed.equipmentType || ctx.type);
    tio3FillForm(row.parsed);
    _tio3Printed = row.parsed.printed || {};
    _tio3SoBbtn = row.parsed.soBbtn || "";
    $("t3_nsx").value = row.nsx || ctx.nsx || "";
    $("t3_tram").value = dev.tram;
    $("t3_thietbi").value = dev.thietBi;
    $("t3_ngay").value = row.ngay;
    return (await tio3AnalyzeAndSave({ file: ctx.attach ? row.file : null, batch: true })) === true;
  },
  endSave(ctx) {
    tio3ClearForm();
    if (ctx.type) tio3SetEquipmentType(ctx.type);
    if (ctx.tram) $("t3_tram").value = ctx.tram;
    if (ctx.thietBi) $("t3_thietbi").value = ctx.thietBi;
    if (ctx.nsx) $("t3_nsx").value = ctx.nsx;
  },
});

/** Tên NSX đã cấu hình tiêu chuẩn dầu cho 1 loại thiết bị (TI/TU/Sứ xuyên) — dùng chung tio3ManufacturerNames(). */
function tio3NamesFor(type) {
  return tio3ManufacturerNames(type);
}

/** Các pha có số liệu trong biên bản 3 pha (mỗi pha = 1 bản ghi khi lưu). */
function tio3BatchPhases(row) {
  const p = row.parsed;
  return OilBbtn.PHASES.filter((ph) => OilBbtn.ITEMS.some((k) => oilBbtnHasValue((p.phases[ph] || {})[k])));
}

function setupOilBatchImport() {
  OilMbaBatch.setup();
  Tio3Batch.setup();
}
