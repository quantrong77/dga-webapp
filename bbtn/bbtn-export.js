/* bbtn-export.js — Xuất Biên bản thí nghiệm (BBTN, .docx) đã điền sẵn số liệu khí hòa
   tan + kết quả đánh giá của lần đo VỪA phân tích (xem "_lastAnalysis" ở ui-dga.js, gán
   trong onAnalyze()), dựa trên mẫu template/template-bbtn-dga.docx (PTC3/BM.15) đã cài
   sẵn placeholder {tag} — điền bằng docxtemplater (MIT), đóng gói tại
   vendor/docxtemplater/ (xem index.html). Chạy 100% phía client, KHÔNG gửi số liệu lên
   server nào để "điền" — chỉ tải mẫu .docx tĩnh về rồi xử lý ngay trong trình duyệt,
   giống triết lý của bbtn-import.js (đọc BBTN PDF) ở chiều ngược lại.

   Điền vào các trường webapp CÓ dữ liệu (Trạm, Vị trí lắp đặt, Hãng SX, Ngày lấy mẫu,
   Ngày thí nghiệm, Lý do thí nghiệm, Điều kiện môi trường (nhiệt độ/độ ẩm), 7 khí hòa
   tan + TCG, tốc độ sinh khí %/tháng của từng khí + TCG nếu có lần đo trước liền kề để
   so sánh (xem computeRateOfChange()/computeTcgRateOfChange() ở dga-logic.js, tính ở
   onAnalyze()), N2/O2 (mục 8/9, tùy chọn) + Tổng hàm lượng khí hòa tan (mục 11, Bảng 63
   Điều 54 QĐ1901 — chỉ điền khi đã nhập cả N2 lẫn O2, xem computeTotalDissolvedGasPercent()
   ở dga-logic.js), Ghi chú, Kết luận) — các trường khác (Năm SX, Điện áp định mức, Công
   suất, Số chế tạo, Năm vận hành, Loại dầu, chữ ký) vẫn giữ NGUYÊN trống như mẫu gốc vì
   webapp không thu thập số liệu này — người dùng tự bổ sung trong Word trước khi ký ban
   hành (xem tag_template.py đã dùng để chèn placeholder vào mẫu, không đi kèm trong
   webapp — các tag {ly_do_thi_nghiem}/{nhiet_do}/{do_am}/{tcg_toc} chèn thêm sau này
   bằng script riêng, không qua tag_template.py; {n2_kq}/{o2_kq}/{tonghamluongkhi_kq}/
   {tonghamluongkhi_tc}/{tonghamluongkhi_dg} cũng vậy — 3 tag đầu còn THAY THẾ 2 số liệu
   mẫu cứng "14766"/"5833.79" (N2/O2) để sót lại từ tài liệu gốc dùng làm mẫu, trước đây
   in ra y nguyên ở MỌI bản BBTN xuất ra bất kể số liệu thực tế; 2 tag {tonghamluongkhi_tc}/
   {tonghamluongkhi_dg} lấp ô "Tiêu chuẩn"/"Đánh giá" của dòng 11 (Tổng hàm lượng khí)
   vốn để trống hoàn toàn trong mẫu gốc dù Bảng 63 CÓ ngưỡng cụ thể theo cấp điện áp. */

const BBTN_TEMPLATE_URL = "template/template-bbtn-dga.docx";

// Tên khí trong dữ liệu app (DGA.GASES) -> tiền tố tag trong mẫu .docx (xem các cột
// "{xx_kq}"/"{xx_tc}"/"{xx_toc}"/"{xx_dg}" trong bảng KẾT QUẢ THÍ NGHIỆM của mẫu).
const BBTN_GAS_TAG_KEYS = { H2: "h2", CH4: "ch4", C2H6: "c2h6", C2H4: "c2h4", C2H2: "c2h2", CO: "co", CO2: "co2" };

function bbtnFormatDateVN(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}

function bbtnFormatNum(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : String(v);
}

/** Câu KẾT LUẬN tổng hợp từ đúng các kết quả đã tính (không tự suy đoán thêm) — ghép
 *  trạng thái tổng thể (Bình thường/Cảnh báo/Báo động), kết luận Đạt/Không đạt theo
 *  tiêu chuẩn áp dụng, mã chẩn đoán Bảng 66 và Tam giác Duval, giống hệt nội dung đã
 *  hiển thị ở khối "Kết quả đánh giá" trên màn hình (xem renderResults() ở ui-dga.js). */
function bbtnBuildKetLuan(a) {
  const parts = [];
  if (a.overallStatus && a.overallStatus.label) parts.push(a.overallStatus.label + ".");
  const standardLabel = (a.standard && a.standard.sourceLabel) || "tiêu chuẩn áp dụng";
  parts.push((a.overall === "Đạt" ? "Các chỉ tiêu khí hòa tan đạt yêu cầu" : a.overall) + " theo " + standardLabel + ".");
  if (a.diagnosis) parts.push("Chẩn đoán tỷ số khí (Bảng 66): " + a.diagnosis + ".");
  if (a.duval) parts.push("Tam giác Duval: " + a.duval.zone + " – " + a.duval.label + ".");
  return parts.join(" ");
}

/** Dựng object dữ liệu để docxtemplater điền vào mẫu — key khớp CHÍNH XÁC với tên
 *  placeholder {tag} đã cài trong template/template-bbtn-dga.docx. */
function buildBbtnExportData(a) {
  const m = a.measurement || {};
  const evalByGas = {};
  (a.evalRows || []).forEach((r) => (evalByGas[r.gas] = r));
  const rateByGas = {};
  (a.rateRows || []).forEach((r) => (rateByGas[r.gas] = r));

  const data = {
    tram: m.tram || "",
    vi_tri_lap_dat: [m.thiet_bi, m.pha ? DGA.phaLabelWithPrefix(m.pha) : ""].filter(Boolean).join(" - "),
    hang_sx: m.manufacturer || "",
    ngay_lay_mau: bbtnFormatDateVN(m.sample_date),
    // Ưu tiên "Ngày thí nghiệm" thu thập riêng (m.ngay_thi_nghiem, xem khối "Thông tin
    // thí nghiệm bổ sung" ở ui-dga.js) — chỉ dùng lại "Ngày lấy mẫu" nếu để trống, giữ
    // đúng hành vi cũ (trước khi có trường riêng, 2 mốc coi như trùng nhau).
    ngay_thi_nghiem: bbtnFormatDateVN(m.ngay_thi_nghiem || m.sample_date),
    ly_do_thi_nghiem: m.ly_do_thi_nghiem || "",
    nhiet_do: bbtnFormatNum(m.nhiet_do),
    do_am: bbtnFormatNum(m.do_am),
    ghi_chu: m.ghi_chu || "",
    ket_luan: bbtnBuildKetLuan(a),
    // .toFixed(1) giống hệt cách hiển thị TCG trên màn hình (xem $("r_tcg") ở
    // renderResults(), ui-dga.js) — tcg là tổng cộng dồn nhiều số thập phân nên có thể
    // dính sai số dấu phẩy động kiểu 125.89999999999999 nếu không làm tròn.
    tcg: Number.isFinite(a.tcg) ? a.tcg.toFixed(1) : bbtnFormatNum(a.tcg),
    // Tốc độ sinh khí (%/tháng) của TCG — chỉ có khi có lần đo trước để so sánh (xem
    // computeTcgRateOfChange() ở dga-logic.js, tính ở onAnalyze()); để trống nếu chưa
    // có lần đo trước hoặc TCG lần trước = 0 (không chia được), giống hệt cách 7 khí
    // riêng lẻ xử lý _toc bên dưới.
    tcg_toc: a.tcgRate && a.tcgRate.ratePerMonth !== null ? bbtnFormatNum(a.tcgRate.ratePerMonth) + "%" : "",
    // N2, O2 (tùy chọn — mục 8/9 bảng KẾT QUẢ THÍ NGHIỆM) + Tổng hàm lượng khí hòa tan
    // (mục 11, Bảng 63 Điều 54 QĐ1901 — cộng CẢ 9 khí kể cả N2/O2, xem
    // computeTotalDissolvedGasPercent() ở dga-logic.js, tính ở onAnalyze()). Để trống nếu
    // chưa nhập N2/O2 (a.bang63.value = null) — KHÔNG tự bịa số như 2 giá trị mẫu cũ
    // (14766/5833.79) từng để cứng trong mẫu gốc trước khi có 3 tag này.
    n2_kq: m.n2 !== null && m.n2 !== undefined ? bbtnFormatNum(m.n2) : "",
    o2_kq: m.o2 !== null && m.o2 !== undefined ? bbtnFormatNum(m.o2) : "",
    tonghamluongkhi_kq:
      a.bang63 && a.bang63.value !== null && a.bang63.value !== undefined ? bbtnFormatNum(a.bang63.value.toFixed(3)) + "%" : "",
    // Ngưỡng Bảng 63 (cột "Tiêu chuẩn") — hiện theo cấp điện áp đã chọn (a.bang63.limit)
    // BẤT KỂ đã nhập N2/O2 hay chưa, vì ngưỡng chỉ phụ thuộc cấp điện áp, không phụ thuộc
    // số liệu đo. Cột "Đánh giá" (Đạt/Không đạt) CHỈ điền khi Bảng 63 thật sự áp dụng
    // (a.bang63.applicable — đã tick "dầu mới/sau sửa chữa thay dầu hoặc lọc dầu") — để
    // trống khi không áp dụng, KHÔNG tự kết luận Đạt/Không đạt cho dầu đang vận hành định
    // kỳ thông thường (giống hệt logic hiển thị ở renderResults(), ui-dga.js).
    tonghamluongkhi_tc: a.bang63 && a.bang63.limit !== null && a.bang63.limit !== undefined ? "< " + bbtnFormatNum(a.bang63.limit) + "%" : "",
    tonghamluongkhi_dg: a.bang63 && a.bang63.applicable && a.bang63.verdict ? a.bang63.verdict : "",
  };

  Object.keys(BBTN_GAS_TAG_KEYS).forEach((gas) => {
    const key = BBTN_GAS_TAG_KEYS[gas];
    const ev = evalByGas[gas];
    const rate = rateByGas[gas];
    data[key + "_kq"] = ev ? bbtnFormatNum(ev.value) : "";
    data[key + "_tc"] = ev && ev.limit !== null && ev.limit !== undefined ? "< " + bbtnFormatNum(ev.limit) : "";
    data[key + "_toc"] =
      rate && rate.ratePerMonth !== null && rate.ratePerMonth !== undefined ? bbtnFormatNum(rate.ratePerMonth) + "%" : "";
    data[key + "_dg"] = ev ? (ev.verdict === "Không có ngưỡng" ? "—" : ev.verdict) : "";
  });

  return data;
}

/** Tải mẫu .docx, điền số liệu bằng docxtemplater, rồi tải file kết quả xuống máy
 *  người dùng (tên file gồm Thiết bị + Pha + Ngày lấy mẫu để dễ phân biệt). Ném lỗi ra
 *  ngoài (không tự alert) để nơi gọi (onExportBbtn() ở ui-dga.js) quyết định cách báo. */
async function exportBbtnDocx(analysis) {
  const res = await fetch(BBTN_TEMPLATE_URL);
  if (!res.ok) throw new Error(`Không tải được mẫu BBTN (${BBTN_TEMPLATE_URL}) — mã lỗi ${res.status}`);
  const buf = await res.arrayBuffer();

  // Bản build docxtemplater đóng gói dạng UMD gán window.docxtemplater — tùy phiên bản
  // bundler, constructor thật có thể nằm trực tiếp ở đó hoặc ở thuộc tính .default.
  const Ctor = typeof window.docxtemplater === "function" ? window.docxtemplater : window.docxtemplater.default;
  const zip = new window.PizZip(buf);
  const doc = new Ctor(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(buildBbtnExportData(analysis));
  const blob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const m = analysis.measurement || {};
  const namePart = [m.thiet_bi, m.pha ? DGA.phaLabelWithPrefix(m.pha) : "", m.sample_date]
    .filter(Boolean)
    .join("_")
    .replace(/[\\/:*?"<>|\s]+/g, "-");
  const fileName = "BBTN_DGA" + (namePart ? "_" + namePart : "") + ".docx";

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

window.BbtnExport = { exportBbtnDocx, buildBbtnExportData };
