/* ui-oil-bbtn-export.js — Khối "Xuất Biên bản thí nghiệm (docx)" ở tab "Lý-Hóa dầu" (MBA/Kháng dầu): gom
   kết quả VỪA đánh giá của form dầu thùng chính (onAnalyzeOil, ui-oil.js) và form dầu OLTC
   (onAnalyzeOltcOil, ui-oltc.js) — cùng thiết bị + ngày lấy mẫu thì xuất chung 1 biên bản — rồi điền mẫu
   PTC3 qua src/data/io/mba-oil-bbtn-export.js. 7 ô THÔNG SỐ KỸ THUẬT (hãng SX, năm SX, ĐA định mức, công suất, số chế tạo,
   năm vận hành, loại dầu — OIL_DEVICE_INFO_IDS, ui-oil.js) nằm ở form dầu MBA và LƯU kèm bản ghi (device_info);
   các ô còn lại (vị trí lấy mẫu, lý do thí nghiệm, điều kiện môi trường, kết luận) chỉ dùng khi xuất, KHÔNG lưu.
   App gợi ý từ BBTN vừa đọc hoặc lần đo DGA cùng trạm + thiết bị, người dùng sửa được. */

let _oilBbtnExport = { main: null, oltc: null, key: "" };
let _oilBbtnLastHeader = null; // header đọc từ file BBTN gần nhất (mba-oil-bbtn.js), để gợi ý điền

const OIL_BBTN_EXPORT_FIELDS = {
  viTriLayMau: "ob_vitrilaymau", hangSx: "ob_hangsx", namSx: "ob_namsx", dienApDm: "ob_dienapdm",
  congSuat: "ob_congsuat", soCheTao: "ob_sochetao", namVanHanh: "ob_namvanhanh", loaiDau: "ob_loaidau",
  lyDo: "ob_lydo", nhietDo: "ob_nhietdo", doAm: "ob_doam",
};

function oilBbtnSameReport(a, b) {
  const norm = (s) => String(s || "").trim().toLowerCase();
  return !!a && !!b && norm(a.thiet_bi) === norm(b.thiet_bi) && DGA.formatSampleDate(a.sample_date) === DGA.formatSampleDate(b.sample_date);
}

/** Phần thùng chính / OLTC sẽ xuất: phần vừa đánh giá sau cùng làm gốc, phần kia chỉ kèm khi cùng biên bản. */
function oilBbtnExportParts() {
  const { main, oltc } = _oilBbtnExport;
  const anchor = main && oltc ? (main.at >= oltc.at ? main : oltc) : main || oltc;
  if (!anchor) return null;
  return {
    header: anchor.header,
    main: main && (main === anchor || oilBbtnSameReport(main.header, anchor.header)) ? main : null,
    oltc: oltc && (oltc === anchor || oilBbtnSameReport(oltc.header, anchor.header)) ? oltc : null,
  };
}

function oilBbtnExportInput(parts) {
  const h = parts.header;
  const info = { tram: h.tram, thietBi: h.thiet_bi, ngayLayMau: DGA.formatSampleDate(h.sample_date), ghiChu: h.ghi_chu };
  Object.entries(OIL_BBTN_EXPORT_FIELDS).forEach(([k, id]) => { info[k] = $(id) ? $(id).value.trim() : ""; });
  info.ketLuan = $("ob_ketluan") ? $("ob_ketluan").value.trim() : "";
  const main = parts.main ? parts.main.results.map((x) => ({
    title: x.col === "X" ? "" : "Pha " + x.col, label: x.col === "X" ? "thùng chính" : "thùng chính pha " + x.col,
    record: x.rec, qd: x.qd, iec: x.iec,
  })) : [];
  const oltc = parts.oltc ? parts.oltc.results.map((x) => ({
    title: x.col === "X" ? "" : "OLTC pha " + x.col, label: x.col === "X" ? "OLTC" : "OLTC pha " + x.col,
    record: x.rec, qd: x.qd,
  })) : [];
  const vc = parts.oltc ? parts.oltc.header.voltage_class : parts.main && parts.main.header.voltage_class;
  return { info, main, oltc, oltcVoltageLabel: vc ? DGA.oilVoltageClassName(vc) : "" };
}

/** Gợi ý thông tin biên bản: BBTN vừa đọc (cùng thiết bị) → lần đo DGA mới nhất cùng trạm + thiết bị. */
function oilBbtnPrefill(parts) {
  const h = parts.header;
  const specIds = typeof OIL_DEVICE_INFO_IDS !== "undefined" ? Object.values(OIL_DEVICE_INFO_IDS) : [];
  const set = (id, v) => {
    const el = $(id);
    if (!el || v === null || v === undefined || String(v).trim() === "") return;
    if (specIds.includes(id)) {
      // ô thông số kỹ thuật (lưu kèm bản ghi): chỉ ô trống / ô đang giữ đúng giá trị khối này đã gợi ý.
      // Đánh dấu riêng exportAuto (= giá trị đã ghi) — deviceSpecIsAuto() (ui-device-specs.js) cũng coi là "tự điền".
      const auto = el.dataset.exportAuto !== undefined && el.value === el.dataset.exportAuto;
      if (!el.value.trim() || auto) { el.value = String(v); el.dataset.exportAuto = String(v); }
      return;
    }
    // Ô trống hoặc ô app tự điền trước đó (người dùng chưa sửa) thì điền/cập nhật lại
    if (!el.value.trim() || el.dataset.auto === "1") { el.value = String(v); el.dataset.auto = "1"; }
  };
  const fileH = _oilBbtnLastHeader && oilBbtnSameReport({ thiet_bi: _oilBbtnLastHeader.thietBi, sample_date: _oilBbtnLastHeader.ngay }, h)
    ? _oilBbtnLastHeader : null;
  if (fileH) {
    set("ob_hangsx", fileH.hangSx);
    set("ob_sochetao", fileH.serial);
    set("ob_loaidau", fileH.loaiDau);
  }
  const norm = (s) => String(s || "").trim().toLowerCase();
  const m = (typeof _allMeasurements !== "undefined" ? _allMeasurements : [])
    .filter((x) => norm(x.thiet_bi) === norm(h.thiet_bi) && norm(x.tram) === norm(h.tram))
    .sort((a, b) => String(b.sample_date || "").localeCompare(String(a.sample_date || "")))
    .find((x) => x.nam_sx || x.so_che_tao || x.dien_ap_dm || x.loai_dau || x.nam_van_hanh);
  if (m) {
    set("ob_namsx", m.nam_sx);
    set("ob_namvanhanh", m.nam_van_hanh);
    set("ob_dienapdm", m.dien_ap_dm);
    set("ob_sochetao", m.so_che_tao);
    set("ob_loaidau", m.loai_dau);
  }
  const where = [];
  if (parts.main) where.push("van thùng chính");
  if (parts.oltc) {
    const ph = parts.oltc.results.map((x) => x.col).filter((c) => c !== "X");
    where.push(ph.length ? `van OLTC pha ${ph.join(",")}` : "van OLTC");
  }
  set("ob_vitrilaymau", where.length ? `${where.join(", ").replace(/^./, (c) => c.toUpperCase())} ${h.thiet_bi || ""}`.trim() : "");
  set("ob_lydo", h.oil_state === "new" ? "Sau lắp đặt" : "Định kỳ");
}

function oilBbtnRefreshConclusion(parts, force) {
  const el = $("ob_ketluan");
  if (!el || (!force && el.value.trim() && el.dataset.auto !== "1")) return;
  const input = oilBbtnExportInput(parts);
  input.info.ketLuan = "";
  el.value = MbaOilBbtnExport.buildMbaOilBbtnExportData(DGA, input).ket_luan;
  el.dataset.auto = "1";
}

/** Vẽ lại khối xuất BBTN sau khi đánh giá (gọi từ ui-oil.js / ui-oltc.js). */
function oilBbtnExportRender() {
  const panel = $("oilBbtnExportPanel");
  const parts = oilBbtnExportParts();
  if (!panel || !parts || !window.MbaOilBbtnExport) return;
  panel.classList.remove("hidden");
  const key = [String(parts.header.tram || "").trim(), String(parts.header.thiet_bi || "").trim(), DGA.formatSampleDate(parts.header.sample_date)].join("|");
  if (key !== _oilBbtnExport.key) {
    // Thiết bị/biên bản khác → bỏ thông tin đã điền cho biên bản trước
    const specIds = typeof OIL_DEVICE_INFO_IDS !== "undefined" ? Object.values(OIL_DEVICE_INFO_IDS) : [];
    Object.values(OIL_BBTN_EXPORT_FIELDS).concat("ob_ketluan").forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (specIds.includes(id)) {
        // ô thông số thuộc form: chỉ bỏ giá trị khối này đã gợi ý cho biên bản trước; giữ giá trị người dùng nhập và
        // giá trị tự điền theo thiết bị (specAuto, ui-device-specs.js)
        if (el.dataset.exportAuto !== undefined && el.value === el.dataset.exportAuto) el.value = "";
        delete el.dataset.exportAuto;
        return;
      }
      el.value = "";
      delete el.dataset.auto;
    });
    _oilBbtnExport.key = key;
  }
  oilBbtnPrefill(parts);
  oilBbtnRefreshConclusion(parts, false);
  const what = [];
  if (parts.main) what.push(`dầu thùng chính (${parts.main.results.map((x) => (x.col === "X" ? "mẫu chung" : "pha " + x.col)).join(", ")})`);
  if (parts.oltc) what.push(`dầu OLTC (${parts.oltc.results.map((x) => (x.col === "X" ? "mẫu chung" : "pha " + x.col)).join(", ")})`);
  const other = parts.main ? (!parts.oltc && _oilBbtnExport.oltc ? "OLTC" : "") : _oilBbtnExport.main ? "thùng chính" : "";
  $("ob_scope").innerHTML = `Biên bản: <strong>${escapeHtml(parts.header.thiet_bi || "—")}</strong>` +
    (parts.header.tram ? ` — ${escapeHtml(parts.header.tram)}` : "") + `, ngày lấy mẫu ${escapeHtml(MbaOilBbtnExport.mobDateVN(DGA.formatSampleDate(parts.header.sample_date)) || "—")}. ` +
    `Gồm ${escapeHtml(what.join(" và "))}.` +
    (other ? ` <span style="color:var(--warn);">Kết quả ${other} vừa đánh giá thuộc thiết bị/ngày khác nên không đưa vào.</span>` : "") +
    (!parts.oltc && !other ? " Muốn kèm phần OLTC: nhập và bấm \"Đánh giá & Lưu\" ở khối dầu OLTC (cùng thiết bị, cùng ngày lấy mẫu)." : "");
}

function oilBbtnExportSetMain(header, results) {
  _oilBbtnExport.main = { header, results, at: Date.now() };
  oilBbtnExportRender();
}
function oilBbtnExportSetOltc(header, results) {
  _oilBbtnExport.oltc = { header, results, at: Date.now() + 0.5 };
  oilBbtnExportRender();
}

async function onExportMbaOilBbtn() {
  const parts = oilBbtnExportParts();
  if (!parts) {
    notifyError("Chưa có kết quả để xuất — nhập số liệu và bấm \"Đánh giá & Lưu\" trước.");
    return;
  }
  if (!window.docxtemplater || !window.PizZip) {
    notifyError("Thư viện xuất Word chưa tải xong — thử lại sau vài giây.");
    return;
  }
  const btn = $("btnExportMbaOilBbtn");
  btn.disabled = true;
  try {
    oilBbtnRefreshConclusion(parts, false);
    const { blob, fileName } = await MbaOilBbtnExport.renderMbaOilBbtnDocx(DGA, oilBbtnExportInput(parts));
    const name = downloadBlob(blob, fileName);
    showToast(`Đã xuất ${name}. Mở trong Word để bổ sung số biên bản, thiết bị thí nghiệm và ký trước khi ban hành.`);
  } catch (err) {
    notifyError("Không xuất được BBTN: " + ((err && err.message) || err));
  } finally {
    btn.disabled = false;
  }
}

function setupOilBbtnExport() {
  if (!$("btnExportMbaOilBbtn")) return;
  $("btnExportMbaOilBbtn").addEventListener("click", onExportMbaOilBbtn);
  if ($("btnExportMbaOilBbtnOltc")) {
    $("btnExportMbaOilBbtnOltc").addEventListener("click", () => {
      $("oilBbtnExportPanel").scrollIntoView({ behavior: "smooth", block: "start" });
      onExportMbaOilBbtn();
    });
  }
  if ($("btnExportMbaOilBbtnMain")) {
    $("btnExportMbaOilBbtnMain").addEventListener("click", () => {
      $("oilBbtnExportPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  $("btnOilBbtnAutoConclusion").addEventListener("click", () => {
    const parts = oilBbtnExportParts();
    if (parts) oilBbtnRefreshConclusion(parts, true);
  });
  Object.values(OIL_BBTN_EXPORT_FIELDS).concat("ob_ketluan").forEach((id) => {
    if ($(id)) $(id).addEventListener("input", () => { delete $(id).dataset.auto; });
  });
}
