/* tech-report-export.js — Xuất "Báo cáo phân tích kỹ thuật" (.docx) cho THIẾT BỊ CÓ BẤT
   THƯỜNG, dựa trên kết quả đánh giá của lần đo VỪA phân tích (xem "_lastAnalysis" ở
   ui-dga.js, gán trong onAnalyze()) — cùng cơ chế/thư viện với bbtn-export.js (mẫu
   Word tĩnh + docxtemplater, chạy 100% client-side, không gửi số liệu lên server nào).

   Khác với BBTN (biên bản điền số liệu thô để lưu hồ sơ), báo cáo này tổng hợp đúng 6
   nội dung người dùng yêu cầu: (1) thông số kỹ thuật thiết bị, (2) thông số kết quả
   thí nghiệm, (3) tính toán 3 tỷ số khí, (4) dạng bất thường (chẩn đoán), (5) đề xuất
   hướng tiếp theo, (6) việc cần làm — TOÀN BỘ lấy đúng từ dữ liệu/kết quả đã tính sẵn
   trong _lastAnalysis, không tự suy diễn thêm nội dung nào ngoài đó.

   Mẫu template/template-baocao-phantich-dga.docx CHỈ dùng placeholder phẳng {tag} (7
   khí lặp lại {xx_kq}/{xx_tc}/{xx_dg} như BBTN — xem BBTN_GAS_TAG_KEYS ở bbtn-export.js)
   — KHÔNG dùng loop {#tag} của docxtemplater cho các danh sách dài/ngắn tùy trường hợp
   (Căn cứ trạng thái tổng thể, Việc cần làm): thay vào đó nối nhiều dòng bằng "\n" rồi
   dựa vào option {linebreaks:true} (đã bật sẵn, xem exportTechReportDocx()) để
   docxtemplater tự tách thành nhiều dòng trong cùng 1 đoạn văn — đơn giản, chắc chắn
   chạy đúng với đúng 1 bản build docxtemplater đang đóng gói sẵn (vendor/docxtemplater),
   không phụ thuộc tính năng loop-trong-bảng nào khác. */

const TECH_REPORT_TEMPLATE_URL = "template/template-baocao-phantich-dga.docx";

const TECH_REPORT_GAS_TAG_KEYS = { H2: "h2", CH4: "ch4", C2H6: "c2h6", C2H4: "c2h4", C2H2: "c2h2", CO: "co", CO2: "co2" };

function techFormatDateVN(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}

function techFormatToday() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function techEmptyDash(v) {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

/** Dựng object dữ liệu để docxtemplater điền vào mẫu — key khớp CHÍNH XÁC với tên
 *  placeholder {tag} đã cài trong template/template-baocao-phantich-dga.docx. Chỉ gọi
 *  khi overallStatus.level !== "normal" (xem onExportTechReport() ở ui-dga.js — nút chỉ
 *  hiện trong trường hợp đó), nhưng hàm này không tự kiểm tra lại điều đó (để nơi khác
 *  có thể tái dùng nếu cần xem trước dữ liệu). */
function buildTechReportData(a) {
  const m = a.measurement || {};
  const evalByGas = {};
  (a.evalRows || []).forEach((r) => (evalByGas[r.gas] = r));

  const data = {
    tram: m.tram || "",
    thiet_bi: m.thiet_bi || "",
    loai_thietbi: m.equipment_type || "",
    pha_label: m.pha ? DGA.phaLabelWithPrefix(m.pha) : "",
    nsx: m.manufacturer || "",
    kieu_may: m.kieu_may || "",
    nam_sx: techEmptyDash(m.nam_sx),
    nam_van_hanh: techEmptyDash(m.nam_van_hanh),
    dien_ap_dm: m.dien_ap_dm || "",
    so_che_tao: m.so_che_tao || "",
    loai_dau: m.loai_dau || "",
    ket_cau_cach_dien: m.ket_cau_cach_dien || "",
    hien_trang_van_hanh: m.hien_trang_van_hanh || "",
    ngay_lay_mau: techFormatDateVN(m.sample_date),
    lan_do: techEmptyDash(m.lan_do),
    tieu_chuan: (a.standard && a.standard.sourceLabel) || "",

    // .toFixed(1) giống hệt cách hiển thị TCG trên màn hình (xem $("r_tcg") ở
    // renderResults(), ui-dga.js).
    tcg: Number.isFinite(a.tcg) ? a.tcg.toFixed(1) : techEmptyDash(a.tcg),

    ratio1: a.ratios ? a.ratios.c2h2_c2h4.toFixed(3) : "—",
    ratio2: a.ratios ? a.ratios.ch4_h2.toFixed(3) : "—",
    ratio3: a.ratios ? a.ratios.c2h4_c2h6.toFixed(3) : "—",
    pd_threshold: a.standard ? "< " + a.standard.pdThreshold : "—",
    applicability: a.applicability || "—",

    trang_thai: (a.overallStatus && a.overallStatus.label) || "—",
    diag_ma: a.diagnosis || "—",
    duval_zone: a.duval ? a.duval.zone : "—",
    duval_label: a.duval ? a.duval.label : "Không đủ dữ liệu (cần CH4/C2H4/C2H2 > 0)",
    reasons_text: (a.overallStatus && a.overallStatus.reasons || []).map((r) => "- " + r).join("\n") || "—",
    status_action: (a.overallStatus && a.overallStatus.action) || "—",
    recs_text: (a.recs || []).map((r) => "- " + r).join("\n") || "—",

    ngay_lap: techFormatToday(),
  };

  const condemnExceeded = DGA.condemningExceededRows(a.condemningRows);
  data.condemn_text = condemnExceeded.length > 0
    ? `⚠ VƯỢT NGƯỠNG LOẠI BỎ (do nhà sản xuất quy định) ở ${condemnExceeded.length} khí: ` +
      condemnExceeded.map((r) => `${r.gas} (${r.value} > ${r.limit} ppm)`).join(", ") + "."
    : "";

  Object.keys(TECH_REPORT_GAS_TAG_KEYS).forEach((gas) => {
    const key = TECH_REPORT_GAS_TAG_KEYS[gas];
    const ev = evalByGas[gas];
    data[key + "_kq"] = ev ? String(ev.value) : "";
    data[key + "_tc"] = ev && ev.limit !== null && ev.limit !== undefined ? String(ev.limit) : "—";
    data[key + "_dg"] = ev ? (ev.verdict === "Không có ngưỡng" ? "—" : ev.verdict) : "—";
  });

  return data;
}

/** Tải mẫu .docx, điền số liệu bằng docxtemplater, rồi tải file kết quả xuống máy
 *  người dùng. Ném lỗi ra ngoài (không tự alert) để nơi gọi (onExportTechReport() ở
 *  ui-dga.js) quyết định cách báo — giống hệt cấu trúc exportBbtnDocx() ở bbtn-export.js. */
async function exportTechReportDocx(analysis) {
  const res = await fetch(TECH_REPORT_TEMPLATE_URL);
  if (!res.ok) throw new Error(`Không tải được mẫu báo cáo (${TECH_REPORT_TEMPLATE_URL}) — mã lỗi ${res.status}`);
  const buf = await res.arrayBuffer();

  const Ctor = typeof window.docxtemplater === "function" ? window.docxtemplater : window.docxtemplater.default;
  const zip = new window.PizZip(buf);
  const doc = new Ctor(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(buildTechReportData(analysis));
  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const m = analysis.measurement || {};
  const namePart = [m.thiet_bi, m.pha ? DGA.phaLabelWithPrefix(m.pha) : "", m.sample_date]
    .filter(Boolean)
    .join("_")
    .replace(/[\\/:*?"<>|\s]+/g, "-");
  const fileName = "BaoCao_PhanTichKyThuat_DGA" + (namePart ? "_" + namePart : "") + ".docx";

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

window.TechReportExport = { exportTechReportDocx, buildTechReportData };
