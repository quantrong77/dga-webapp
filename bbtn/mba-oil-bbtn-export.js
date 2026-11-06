/* mba-oil-bbtn-export.js — Xuất Biên bản thí nghiệm dầu cách điện MBA (thùng chính + OLTC, .docx) cho số
   liệu nhập tay ở tab "Lý-Hóa dầu", theo mẫu PTC3 template/template-bbtn-ly-hoa-dau.docx (dựng từ mẫu
   "BBTN lyhoadau MBA_OLTC 3 pha" của đơn vị, file template/bbtn-ly-hoa-dau-mba-oltc-3pha.docx — thay số liệu bằng thẻ docxtemplater). Cùng cách làm với
   bbtn-export.js (tab DGA): chạy hoàn toàn trong trình duyệt, không gửi số liệu đi đâu.

   Phần dựng dữ liệu (buildMbaOilBbtnExportData) là hàm thuần để kiểm thử được ở Node; phần tải mẫu/điền/
   tải file xuống (exportMbaOilBbtnDocx) chỉ chạy trong trình duyệt.

   Mỗi "mục" (section) là 1 bảng kết quả: thùng chính chung (1 bảng, không tiêu đề) hoặc từng pha; OLTC
   chung (điểm trung tính, 1 bảng) hoặc từng pha ("+ OLTC pha A"...). Dòng kết quả chỉ gồm chỉ tiêu ĐÃ NHẬP,
   theo thứ tự của mẫu BBTN. Tiêu chuẩn/đánh giá lấy theo QĐ1901; chỉ tiêu QĐ1901 không quy định ngưỡng
   nhưng IEC 60422:2024 có (sức căng bề mặt, PCB, lưu huỳnh ăn mòn...) thì ghi ngưỡng IEC kèm "(IEC 60422)". */

const MBA_OIL_BBTN_TEMPLATE_URL = "template/template-bbtn-ly-hoa-dau.docx";

// Thứ tự + tên song ngữ in trên BBTN (key khớp DGA.OIL_PARAM_DEFS[].key). Đơn vị để trống = lấy theo định nghĩa.
const MBA_OIL_BBTN_ITEMS = [
  { key: "bdv", vi: "Điện áp chọc thủng", en: "Breakdown voltage" },
  { key: "tgd90", vi: "Hệ số tổn hao điện môi Tgδ 90°C", en: "Dielectric dissipation factor" },
  { key: "appearance", vi: "Màu sắc và độ trong", en: "Appearance", unit: "/" },
  { key: "color", vi: "Màu sắc theo thang ISO 2049", en: "Colour", unit: "/" },
  { key: "mechvis", vi: "Hàm lượng tạp chất cơ học - quan sát bằng mắt", en: "Particles content - visual", unit: "/" },
  { key: "mech", vi: "Hàm lượng tạp chất cơ học", en: "Mechanical impurities" },
  { key: "p6", vi: "Tạp chất có kích thước hạt lớn hơn 6 μm", en: "Particles > 6 μm", unit: "Số lượng tạp chất/1ml dầu" },
  { key: "p14", vi: "Tạp chất có kích thước hạt lớn hơn 14 μm", en: "Particles > 14 μm", unit: "Số lượng tạp chất/1ml dầu" },
  { key: "moisture", vi: "Hàm lượng nước trong dầu", en: "Water content" },
  { key: "flash", vi: "Nhiệt độ chớp cháy kín", en: "Flash point PMCC" },
  { key: "acid", vi: "Hàm lượng axit", en: "Acid number" },
  { key: "acidbase", vi: "Hàm lượng axit – kiềm hòa tan trong dầu", en: "Acid base reaction", unit: "/" },
  { key: "resistivity", vi: "Điện trở suất khối ở 90°C", en: "Volume resistivity at 90°C" },
  { key: "furfural", vi: "Hàm lượng 2-furfural", en: "2-Furfural content" },
  { key: "ift", vi: "Sức căng bề mặt", en: "Interfacial tension" },
  { key: "sulfur", vi: "Lưu huỳnh ăn mòn", en: "Corrosive sulphur", unit: "/" },
  { key: "pcb", vi: "Hàm lượng PCB", en: "PCB content" },
  { key: "sediment", vi: "Hàm lượng cặn", en: "Sediment" },
  { key: "sludge", vi: "Hàm lượng bùn", en: "Sludge" },
  { key: "inhibitor", vi: "Hàm lượng chất ức chế ôxi hóa (so với ban đầu)", en: "Inhibitor content" },
  { key: "passivator", vi: "Hàm lượng chất thụ động", en: "Passivator content" },
  { key: "oxsludge", vi: "Độ ổn định ôxi hóa - khối lượng cặn", en: "Oxidation stability - sludge" },
  { key: "oxacid", vi: "Độ ổn định ôxi hóa - trị số axit", en: "Oxidation stability - acidity" },
  { key: "oxtgd", vi: "Độ ổn định ôxi hóa - tgδ 90°C", en: "Oxidation stability - DDF" },
];

const MBA_OIL_JUDGED = ["Đạt", "Cảnh báo", "Không đạt"];

function mobDateVN(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}

function mobText(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function mobVerdictRank(v) {
  return v === "Không đạt" ? 3 : v === "Cảnh báo" ? 2 : v === "Đạt" ? 1 : 0;
}

/** 1 dòng kết quả cho chỉ tiêu `item` của bản ghi: giá trị, tiêu chuẩn, đánh giá (QĐ1901, bổ sung IEC). */
function mobRow(DGA, item, rec, qdRows, iecRows) {
  const def = (DGA.OIL_PARAM_DEFS || []).find((d) => d.key === item.key);
  if (!def) return null;
  const raw = rec[def.field];
  if (raw === null || raw === undefined || raw === "") return null;
  const value = def.type === "select" ? DGA.oilSelectLabel(def.field, raw) : String(raw);
  const qd = (qdRows || []).find((r) => r.key === item.key);
  const iec = (iecRows || []).find((r) => r.key === item.key);
  let limit = "";
  let verdict = "";
  if (qd && MBA_OIL_JUDGED.includes(qd.verdict)) {
    limit = mobText(qd.limitText);
    verdict = qd.verdict;
  } else if (iec && MBA_OIL_JUDGED.includes(iec.verdict)) {
    limit = mobText(iec.limit) + " (IEC 60422)";
    verdict = iec.verdict;
  } else if (qd && qd.limitText && qd.limitText !== "—") {
    limit = mobText(qd.limitText);
  }
  return {
    key: item.key,
    ten: item.vi,
    ten_en: `(${item.en})`,
    don_vi: item.unit || def.unit || "/",
    ket_qua: value,
    tieu_chuan: limit || "—",
    danh_gia: verdict || "—",
    verdict,
  };
}

/** Dựng 1 mục (bảng kết quả). entry: { title, record, qd, iec } — qd/iec là kết quả DGA.evaluate*Record. */
function buildMbaOilBbtnSection(DGA, entry) {
  const rec = entry.record || {};
  const rows = MBA_OIL_BBTN_ITEMS
    .map((it) => mobRow(DGA, it, rec, entry.qd && entry.qd.rows, entry.iec && entry.iec.rows))
    .filter(Boolean);
  rows.forEach((r, i) => { r.stt = String(i + 1); });
  return { tieu_de: entry.title || "", co_tieu_de: !!entry.title, rows, label: entry.label || entry.title || "" };
}

/** Kết luận viết sẵn (người dùng sửa được trước khi xuất). sections: [{ label, rows }]. */
function buildMbaOilBbtnConclusion(sections) {
  const all = sections.flatMap((s) => s.rows.map((r) => ({ ...r, where: s.label })));
  const judged = all.filter((r) => r.verdict);
  if (judged.length === 0) return "Chưa đủ cơ sở đánh giá — các hạng mục đã thí nghiệm chưa có tiêu chuẩn áp dụng.";
  const list = (verdict) => {
    const byItem = new Map();
    judged.filter((r) => r.verdict === verdict).forEach((r) => {
      const arr = byItem.get(r.ten) || [];
      if (r.where) arr.push(r.where);
      byItem.set(r.ten, arr);
    });
    return [...byItem.entries()].map(([ten, where]) => ten + (where.length ? ` (${where.join(", ")})` : "")).join("; ");
  };
  const bad = list("Không đạt");
  const warn = list("Cảnh báo");
  if (!bad && !warn) return "Các hạng mục đã thí nghiệm đạt yêu cầu kỹ thuật.";
  const parts = [];
  if (bad) parts.push("Các hạng mục không đạt yêu cầu kỹ thuật: " + bad + ".");
  if (warn) parts.push("Các hạng mục cần theo dõi (cảnh báo): " + warn + ".");
  if (judged.some((r) => r.verdict === "Đạt")) parts.push("Các hạng mục còn lại đạt yêu cầu kỹ thuật.");
  return parts.join(" ");
}

/** Danh sách "Các hạng mục đã thí nghiệm" — mỗi chỉ tiêu 1 dòng, đánh giá theo mục xấu nhất. */
function buildMbaOilBbtnItemList(sections) {
  const out = [];
  MBA_OIL_BBTN_ITEMS.forEach((it) => {
    const rows = sections.flatMap((s) => s.rows.filter((r) => r.key === it.key));
    if (!rows.length) return;
    const worst = rows.reduce((a, r) => (mobVerdictRank(r.verdict) > mobVerdictRank(a) ? r.verdict : a), "");
    out.push({ stt: String(out.length + 1), ten: it.vi, ten_en: `(${it.en})`, tick: "✓", dg: worst || "—" });
  });
  return out;
}

/** Dữ liệu điền mẫu. input: { info, main: [entry], oltc: [entry], oltcVoltageLabel, exportDate }.
 *  info: { tram, thietBi, viTriLayMau, hangSx, namSx, dienApDm, congSuat, soCheTao, namVanHanh, loaiDau,
 *  ngayLayMau (yyyy-mm-dd), lyDo, nhietDo, doAm, ghiChu, ketLuan }. */
function buildMbaOilBbtnExportData(DGA, input) {
  const info = input.info || {};
  const main = (input.main || []).map((e) => buildMbaOilBbtnSection(DGA, e)).filter((s) => s.rows.length);
  const oltc = (input.oltc || []).map((e) => buildMbaOilBbtnSection(DGA, e)).filter((s) => s.rows.length);
  const all = main.concat(oltc);
  const d = input.exportDate instanceof Date ? input.exportDate : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const strip = (s) => ({ tieu_de: s.tieu_de, co_tieu_de: s.co_tieu_de, rows: s.rows.map(({ verdict, key, ...r }) => r) });
  return {
    tram: mobText(info.tram),
    vi_tri_lap_dat: mobText(info.thietBi),
    vi_tri_lay_mau: mobText(info.viTriLayMau),
    hang_sx: mobText(info.hangSx),
    nam_sx: mobText(info.namSx),
    dien_ap_dm: mobText(info.dienApDm),
    cong_suat: mobText(info.congSuat),
    so_che_tao: mobText(info.soCheTao),
    nam_van_hanh: mobText(info.namVanHanh),
    loai_dau: mobText(info.loaiDau),
    ngay_lay_mau: mobDateVN(info.ngayLayMau),
    ly_do_thi_nghiem: mobText(info.lyDo),
    nhiet_do: mobText(info.nhietDo),
    do_am: mobText(info.doAm),
    ghi_chu: mobText(info.ghiChu),
    ket_luan: mobText(info.ketLuan) || buildMbaOilBbtnConclusion(all),
    ngay: pad(d.getDate()),
    thang: pad(d.getMonth() + 1),
    nam: String(d.getFullYear()),
    hang_muc: buildMbaOilBbtnItemList(all),
    co_chinh: main.length > 0,
    chinh: main.map(strip),
    co_oltc: oltc.length > 0,
    oltc_cap_dien_ap: mobText(input.oltcVoltageLabel),
    oltc: oltc.map(strip),
  };
}

/** Tải mẫu, điền, tải file xuống (chỉ trình duyệt). Ném lỗi để nơi gọi báo. */
async function exportMbaOilBbtnDocx(DGA, input) {
  const res = await fetch(MBA_OIL_BBTN_TEMPLATE_URL);
  if (!res.ok) throw new Error(`Không tải được mẫu BBTN (${MBA_OIL_BBTN_TEMPLATE_URL}) — mã lỗi ${res.status}`);
  const Ctor = typeof window.docxtemplater === "function" ? window.docxtemplater : window.docxtemplater.default;
  const doc = new Ctor(new window.PizZip(await res.arrayBuffer()), { paragraphLoop: true, linebreaks: true });
  const data = buildMbaOilBbtnExportData(DGA, input);
  doc.render(typeof applyRegulationTermsDeep === "function" ? applyRegulationTermsDeep(data) : data);
  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const info = input.info || {};
  const namePart = [info.thietBi, info.ngayLayMau].filter(Boolean).join("_").replace(/[\\/:*?"<>|\s]+/g, "-");
  const fileName = "BBTN_LyHoaDau" + (namePart ? "_" + namePart : "") + ".docx";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return fileName;
}

const MbaOilBbtnExport = {
  MBA_OIL_BBTN_TEMPLATE_URL, MBA_OIL_BBTN_ITEMS, mobDateVN,
  buildMbaOilBbtnExportData, buildMbaOilBbtnSection, buildMbaOilBbtnConclusion, buildMbaOilBbtnItemList,
  exportMbaOilBbtnDocx,
};
if (typeof window !== "undefined") window.MbaOilBbtnExport = MbaOilBbtnExport;
if (typeof module !== "undefined" && module.exports) module.exports = MbaOilBbtnExport;
