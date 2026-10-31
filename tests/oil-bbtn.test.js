// BBTN dầu 3 pha chung 1 biên bản (bbtn/oil-bbtn.js). Số liệu golden lấy từ 1 BBTN đã ban hành (mẫu
// PTC3/BM.14): dòng chữ dưới đây đúng như pdf.js đọc ra; ngưỡng lấy từ Phụ lục I của biên bản đó
// (tiêu chuẩn Arteche): BDV > 60 / < 50 kV, nước < 6 / > 10 ppm, tgδ90 ≤ 1 / > 3 %, tgδ20 < 1 / > 3 %.
const fs = require("fs");
const path = require("path");
const OilBbtn = require("../bbtn/oil-bbtn.js");
const { DGA } = require("./helpers");

const LINES = [
  "PTC3/BM.14", "Số:",
  "BIÊN BẢN THÍ NGHIỆM DẦU CÁCH ĐIỆN", "(Insulation oil test report)",
  "Tên dự án/tên trạm (Project): Trạm 500kV Vĩnh Tân",
  "Vị trí lắp đặt (Site): TI 566",
  "Vị trí lấy mẫu (Sampling position): van (đáy)",
  "Hãng sản xuất (Manufacturer): ARTECHE – SPAIN (CA525) Năm sản xuất: 2016",
  "Điện áp định mức (Rated voltage): 550 kV Công suất (Rated power): 15-15-30-30-30-30-15-15",
  "VA",
  "Số chế tạo (Serial No): pha A: 12345678/1, pha B: 12345678/4, Năm vận hành (Year of operation): 2017",
  "pha C: 12345678/5",
  "Loại dầu (Type): Nynas Nytro 10XN Ngày lấy mẫu (Date): 15/09/2026",
  "Lý do thí nghiệm (Purpose of test): Thí nghiệm tăng cường",
  "Điều kiện môi trường (Ambient condition): t (Temp.) = 30ºC , Độ ẩm (Humidity) = 62%",
  "Các hạng mục đã thí nghiệm (Tested items):",
  "1. Điện áp chọc thủng (Breakdown voltage) ✓ Đạt",
  "2. Hệ số tổn hao điện môi Tgδ 90 C (Dielectric dissipation factor)",
  "GHI CHÚ (Remark): Áp dụng tiêu chuẩn của nhà sản xuất ARTECHE. Đính kèm Phụ lục I: Tiêu chuẩn nhà sản",
  "xuất.",
  "KẾT LUẬN (Conclusion): Độ ẩm dầu pha A/B/C: 6 ppm < 7.4/ 6.5/ 7.3 < 10 ppm, ở mức cảnh báo, cần tham vấn",
  "ý kiến nhà sản xuất.",
  "Khánh Hòa, ngày tháng năm 2026",
  "TUQ.GIÁM ĐỐC",
  "KẾT QUẢ THÍ NGHIỆM", "(TESTING RESULTS)",
  "Hạng mục phân tích Đơn vị Kết quả Tiêu chuẩn Đánh giá", "STT",
  "Pha A Pha B Pha C", "(Phase A) (Phase B) (Phase C)",
  "Điện áp chọc thủng", "1 kV 91.8 94.7 86.8 Xem PL I Đạt", "(Breakdown voltage)",
  "0", "Hệ số tổn hao điện môi Tgδ 90 C", "% 0.335 0.326 0.335 Xem PL I Đạt", "(Dielectric dissipation factor)",
  "2", "0", "Hệ số tổn hao điện môi Tgδ 20 C", "% 0.016 0.021 0.016 Xem PL I Đạt", "(Dielectric dissipation factor)",
  "Hàm lượng nước trong dầu", "3 ppm 7.4 6.5 7.3 Xem PL I Cảnh báo", "(Water content)",
  "THIẾT BỊ THÍ NGHIỆM (Testing instruments):",
  "Số: 1305/BBTN-SCTNĐ3",
];

const TI = DGA.EQUIPMENT_TYPES.TI;
const ARTECHE = [{
  manufacturer: "Arteche", equipmentType: TI,
  moisture: 6, moistureReject: 10, tgd90: 1, tgd90Reject: 3, tgd20: 1, tgd20Reject: 3, bdv: 60, bdvReject: 50,
}];

describe("Đọc BBTN dầu 3 pha", () => {
  const parsed = OilBbtn.parseOilBbtnLines(LINES);

  test("tách đúng số liệu từng pha theo từng hạng mục", () => {
    expect(parsed.isThreePhase).toBe(true);
    expect(parsed.rowCount).toBe(4);
    expect(parsed.phases.A).toEqual({ bdv: 91.8, tgd90: 0.335, tgd20: 0.016, moisture: 7.4 });
    expect(parsed.phases.B).toEqual({ bdv: 94.7, tgd90: 0.326, tgd20: 0.021, moisture: 6.5 });
    expect(parsed.phases.C).toEqual({ bdv: 86.8, tgd90: 0.335, tgd20: 0.016, moisture: 7.3 });
  });
  test("đọc đủ thông tin chung, kể cả số chế tạo pha C xuống dòng", () => {
    expect(parsed).toMatchObject({
      tram: "Trạm 500kV Vĩnh Tân", thietBi: "TI 566", equipmentType: TI, viTriLayMau: "van (đáy)",
      hangSx: "ARTECHE – SPAIN (CA525)", namSx: "2016", uDm: "550", congSuat: "15-15-30-30-30-30-15-15",
      namVanHanh: "2017", loaiDau: "Nynas Nytro 10XN", ngayLayMau: "2026-09-15",
      lyDo: "Thí nghiệm tăng cường", nhietDo: "30", doAm: "62", soBbtn: "1305/BBTN-SCTNĐ3",
    });
    expect(parsed.soCheTao).toEqual({ A: "12345678/1", B: "12345678/4", C: "12345678/5" });
    expect(parsed.ghiChu).toBe("Áp dụng tiêu chuẩn của nhà sản xuất ARTECHE. Đính kèm Phụ lục I: Tiêu chuẩn nhà sản xuất.");
    expect(parsed.ketLuan).toMatch(/^Độ ẩm dầu pha A\/B\/C.*ý kiến nhà sản xuất\.$/);
  });
  test("đọc cả đánh giá in trên biên bản để đối chiếu", () => {
    expect(parsed.printed).toEqual({ bdv: "Đạt", tgd90: "Đạt", tgd20: "Đạt", moisture: "Cảnh báo" });
  });
  test("số thập phân dùng dấu phẩy và ô gạch ngang (pha không thí nghiệm)", () => {
    const p = OilBbtn.parseOilBbtnLines(["KẾT QUẢ THÍ NGHIỆM", "1 kV 91,8 - 86,8 Xem PL I Đạt"]);
    expect(p.phases.A.bdv).toBe(91.8);
    expect(p.phases.B.bdv).toBeNull();
    expect(p.phases.C.bdv).toBe(86.8);
  });
  test("BBTN khí DGA 1 pha / file không có bảng 3 cột: không coi là biên bản 3 pha", () => {
    const p = OilBbtn.parseOilBbtnLines(["KẾT QUẢ THÍ NGHIỆM", "1 Hydro H2 ppm 12 < 100 Đạt", "Điện áp định mức: 220 kV Công suất: 10 VA"]);
    expect(p.isThreePhase).toBe(false);
  });
  test("nhận TU, không đoán khi không phải TI/TU; khớp tên NSX với tiêu chuẩn đã cấu hình", () => {
    expect(OilBbtn.parseOilBbtnLines(["Vị trí lắp đặt (Site): TU 171"]).equipmentType).toBe(DGA.EQUIPMENT_TYPES.TU);
    expect(OilBbtn.parseOilBbtnLines(["Vị trí lắp đặt (Site): MBA AT1"]).equipmentType).toBeNull();
    expect(OilBbtn.matchOilBbtnManufacturer("ARTECHE – SPAIN (CA525)", ["ABB", "Arteche"])).toBe("Arteche");
    expect(OilBbtn.matchOilBbtnManufacturer("Haefely", ["ABB", "Arteche"])).toBeNull();
  });
});

describe("Đánh giá từng pha", () => {
  const parsed = OilBbtn.parseOilBbtnLines(LINES);
  const evaluation = OilBbtn.evaluateOilBbtn(DGA, {
    equipmentType: TI, manufacturer: "Arteche", standards: ARTECHE, umKv: parsed.uDm, phases: parsed.phases,
  });

  test("cho đúng kết quả đã ban hành trên BBTN: nước Cảnh báo, các hạng mục khác Đạt", () => {
    OilBbtn.ITEMS.forEach((k) => expect({ k, v: evaluation.items[k].verdict }).toEqual({ k, v: parsed.printed[k] }));
    expect(evaluation.overall).toBe("Cảnh báo");
  });
  test("hạng mục lấy theo pha xấu nhất; pha khác vẫn giữ đánh giá riêng", () => {
    const phases = { A: { moisture: 5 }, B: { moisture: 7 }, C: { moisture: 12 } };
    const e = OilBbtn.evaluateOilBbtn(DGA, { equipmentType: TI, manufacturer: "Arteche", standards: ARTECHE, phases });
    expect(e.items.moisture.verdicts).toEqual({ A: "Đạt", B: "Cảnh báo", C: "Không đạt" });
    expect(e.items.moisture.verdict).toBe("Không đạt");
  });
  test("chưa có tiêu chuẩn NSX thì không tự kết luận Đạt", () => {
    const e = OilBbtn.evaluateOilBbtn(DGA, { equipmentType: TI, manufacturer: null, standards: [], phases: parsed.phases });
    expect(e.overall).toBe("Chưa có tiêu chuẩn nhà sản xuất");
  });
  test("kết luận nêu đúng hạng mục cảnh báo và các hạng mục đạt", () => {
    const text = OilBbtn.buildOilBbtnConclusion(evaluation, parsed.phases, "Arteche");
    expect(text).toContain("Độ ẩm dầu pha A/B/C: 7.4/6.5/7.3 ppm");
    expect(text).toContain("ở mức cảnh báo");
    expect(text).toContain("điện áp chọc thủng");
    expect(text).toContain("tiêu chuẩn nhà sản xuất Arteche");
  });
});

describe("Tách thành bản ghi theo pha", () => {
  const parsed = OilBbtn.parseOilBbtnLines(LINES);
  const form = { ...parsed, manufacturer: "Arteche", equipmentType: TI };

  test("mỗi pha 1 bản ghi, cùng nhóm biên bản và file đính kèm", () => {
    const recs = OilBbtn.buildOilBbtnRecords(form, "g1", { bbtn_url: "u", bbtn_name: "n", bbtn_file_id: "f" });
    expect(recs.map((r) => r.phase)).toEqual(["A", "B", "C"]);
    expect(recs[1]).toMatchObject({
      tram: "Trạm 500kV Vĩnh Tân", thiet_bi: "TI 566", manufacturer: "Arteche", um_kv: 550, sample_date: "2026-09-15",
      bdv_kv: 94.7, tgd_90c_percent: 0.326, tgd_20c_percent: 0.021, moisture_ppm: 6.5, bbtn_group_id: "g1", bbtn_url: "u",
    });
  });
  test("pha không có số liệu thì không tạo bản ghi", () => {
    const recs = OilBbtn.buildOilBbtnRecords({ ...form, phases: { A: { bdv: 90 }, B: {}, C: { bdv: null } } }, "g1");
    expect(recs.map((r) => r.phase)).toEqual(["A"]);
  });
  test("mở lại từ bản ghi đã lưu cho đúng dữ liệu ban đầu", () => {
    const back = OilBbtn.oilBbtnFormFromRecords(OilBbtn.buildOilBbtnRecords(form, "g1"));
    expect(back.phases.C).toEqual(parsed.phases.C);
    expect(back.soCheTao).toEqual(parsed.soCheTao);
    expect(back).toMatchObject({ loaiDau: "Nynas Nytro 10XN", soBbtn: "1305/BBTN-SCTNĐ3", hangSx: parsed.hangSx, ngayLayMau: "2026-09-15" });
  });
  test("bản ghi nhập từng pha lẻ (không có bbtn_info) vẫn mở được", () => {
    const back = OilBbtn.oilBbtnFormFromRecords([{ phase: "A", tram: "T", thiet_bi: "TI 1", bdv_kv: 90, um_kv: 220, sample_date: "2026-01-02", manufacturer: "Arteche" }]);
    expect(back).toMatchObject({ uDm: "220", hangSx: "Arteche", ngayLayMau: "2026-01-02" });
    expect(back.phases.A.bdv).toBe(90);
  });
});

describe("Template BBTN", () => {
  // Bản đóng gói PizZip gán vào window (đúng như trình duyệt dùng), nên giả lập window lúc nạp. Việc
  // điền mẫu thật bằng docxtemplater cần DOMParser của trình duyệt, không chạy được ở đây.
  global.window = {};
  require("../vendor/docxtemplater/pizzip.min.js");
  const { PizZip } = global.window;
  delete global.window;
  const buf = fs.readFileSync(path.join(__dirname, "..", "template", "template-bbtn-dau-3pha.docx"));
  const parsed = OilBbtn.parseOilBbtnLines(LINES);
  const form = { ...parsed, manufacturer: "Arteche", equipmentType: TI, ketLuan: "" };
  const evaluation = OilBbtn.evaluateOilBbtn(DGA, { equipmentType: TI, manufacturer: "Arteche", standards: ARTECHE, umKv: "550", phases: parsed.phases });
  const templateText = new PizZip(buf.toString("binary")).file("word/document.xml").asText().replace(/<[^>]+>/g, "");

  test("mẫu không còn tag sai cú pháp/số liệu cứng, dữ liệu xuất có đủ MỌI tag", () => {
    expect(templateText).not.toMatch(/\{\{|\}\}|16022125|Tự động/);
    const tags = templateText.match(/\{[^{}]+\}/g).map((t) => t.slice(1, -1));
    const data = OilBbtn.buildOilBbtnExportData(form, evaluation);
    expect(tags.filter((t) => !Object.prototype.hasOwnProperty.call(data, t))).toEqual([]);
    expect(tags).toEqual(expect.arrayContaining(["t_20_A", "t_20_B", "t_20_C", "t_90_B", "t_90_C"]));
    expect(data).toMatchObject({
      so_che_tao: "pha A: 12345678/1, pha B: 12345678/4, pha C: 12345678/5", ngay_lay_mau: "15/09/2026",
      U_ct_B: "94.7", t_90_C: "0.335", t_20_B: "0.021", am_A: "7.4", dg_moisture: "Cảnh báo", dg_bdv: "Đạt", tick_tgd20: "✓",
    });
  });
  test("hạng mục không thí nghiệm để trống dấu ✓ và ô đánh giá", () => {
    const phases = { A: { bdv: 90 }, B: { bdv: 91 }, C: { bdv: 92 } };
    const e = OilBbtn.evaluateOilBbtn(DGA, { equipmentType: TI, manufacturer: "Arteche", standards: ARTECHE, phases });
    const data = OilBbtn.buildOilBbtnExportData({ ...form, phases }, e);
    expect(data).toMatchObject({ tick_bdv: "✓", dg_bdv: "Đạt", tick_tgd20: "", dg_tgd20: "", tc_tgd20: "", t_20_A: "" });
  });
});
