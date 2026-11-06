const fs = require("fs");
const path = require("path");
const DGA = require("../src/domain/dga-logic.js");
const X = require("../src/data/io/mba-oil-bbtn-export.js");

// Bản đóng gói PizZip gán vào window (như trình duyệt) — nạp 1 lần, dùng chung cho các test
let _PizZip = null;
function loadPizZip() {
  if (!_PizZip) {
    global.window = {};
    require("../vendor/docxtemplater/pizzip.min.js");
    _PizZip = global.window.PizZip;
    delete global.window;
  }
  return _PizZip;
}

const mainRec = {
  tram: "Trạm 220kV Hàm Tân", thiet_bi: "AT2", sample_date: "2026-10-18", voltage_class: "220", oil_state: "inservice",
  oil_sample_point: "chung", phase: "", bdv_kv: 95.9, tgd_90c_percent: 0.092, moisture_ppm: 8, acid_mgkoh: 0.02,
  mech_visual: "khong", acid_base_soluble: "khong", ift_mnm: 30,
};
const oltcRec = (phase, bdv) => ({
  tram: mainRec.tram, thiet_bi: "AT2", sample_date: "2026-10-18", voltage_class: "220", oil_state: "inservice",
  oltc_sample_point: "pharieng", phase, bdv_kv: bdv, tgd_90c_percent: 0.25, moisture_ppm: 10,
});

function input(overrides = {}) {
  const oltc = [["A", 90], ["B", 88], ["C", 40]].map(([ph, bdv]) => {
    const record = oltcRec(ph, bdv);
    return { title: "OLTC pha " + ph, label: "OLTC pha " + ph, record, qd: DGA.evaluateOltcRecord(record, [], []) };
  });
  return {
    info: { tram: mainRec.tram, thietBi: "AT2", ngayLayMau: "2026-10-18", lyDo: "Định kỳ 1 năm", nhietDo: "33", doAm: "68" },
    main: [{ title: "", label: "thùng chính", record: mainRec, qd: DGA.evaluateOilRecord(mainRec, [], []), iec: DGA.evaluateIec60422OilRecord(mainRec, []) }],
    oltc, oltcVoltageLabel: DGA.oilVoltageClassName("220"), exportDate: new Date(2026, 10, 3),
    ...overrides,
  };
}

describe("Dữ liệu xuất BBTN lý-hóa dầu MBA", () => {
  const data = X.buildMbaOilBbtnExportData(DGA, input());

  test("thông tin chung + ngày ký", () => {
    expect(data).toMatchObject({
      tram: "Trạm 220kV Hàm Tân", vi_tri_lap_dat: "AT2", ngay_lay_mau: "18/10/2026", ly_do_thi_nghiem: "Định kỳ 1 năm",
      nhiet_do: "33", do_am: "68", ngay: "03", thang: "11", nam: "2026", co_chinh: true, co_oltc: true,
    });
  });

  test("thùng chính chung: 1 bảng không tiêu đề, theo thứ tự mẫu, chỉ chỉ tiêu đã nhập", () => {
    expect(data.chinh).toHaveLength(1);
    expect(data.chinh[0].co_tieu_de).toBe(false);
    const rows = data.chinh[0].rows;
    expect(rows.map((r) => r.ten)).toEqual([
      "Điện áp chọc thủng", "Hệ số tổn hao điện môi Tgδ 90°C", "Hàm lượng tạp chất cơ học - quan sát bằng mắt",
      "Hàm lượng nước trong dầu", "Hàm lượng axit", "Hàm lượng axit – kiềm hòa tan trong dầu", "Sức căng bề mặt",
    ]);
    expect(rows[0]).toMatchObject({ stt: "1", ten_en: "(Breakdown voltage)", don_vi: "kV", ket_qua: "95.9", tieu_chuan: "≥ 55", danh_gia: "Đạt" });
    expect(rows[2]).toMatchObject({ ket_qua: "Không thấy", danh_gia: "Đạt" });
    // QĐ1901 không quy định IFT → lấy ngưỡng IEC 60422
    expect(rows[6].tieu_chuan).toMatch(/IEC 60422/);
    expect(rows[6].danh_gia).toBe("Đạt");
  });

  test("OLTC từng pha: 3 bảng có tiêu đề; tgδ OLTC vận hành không có ngưỡng", () => {
    expect(data.oltc.map((s) => s.tieu_de)).toEqual(["OLTC pha A", "OLTC pha B", "OLTC pha C"]);
    const tgd = data.oltc[0].rows.find((r) => r.ten.startsWith("Hệ số tổn hao"));
    expect(tgd).toMatchObject({ tieu_chuan: "—", danh_gia: "—" });
    expect(data.oltc_cap_dien_ap).toBe(DGA.oilVoltageClassName("220"));
  });

  test("danh sách hạng mục đã thí nghiệm lấy đánh giá xấu nhất; kết luận nêu chỗ không đạt", () => {
    const bdv = data.hang_muc.find((h) => h.ten === "Điện áp chọc thủng");
    expect(bdv).toMatchObject({ tick: "✓", dg: "Không đạt" });
    expect(data.hang_muc.map((h) => h.stt)).toEqual(data.hang_muc.map((_, i) => String(i + 1)));
    expect(data.ket_luan).toMatch(/không đạt/);
    expect(data.ket_luan).toMatch(/OLTC pha C/);
  });

  test("tất cả đạt → kết luận đạt yêu cầu; kết luận người dùng nhập được giữ nguyên", () => {
    const ok = X.buildMbaOilBbtnExportData(DGA, input({ oltc: [] }));
    expect(ok.co_oltc).toBe(false);
    expect(ok.ket_luan).toBe("Các hạng mục đã thí nghiệm đạt yêu cầu kỹ thuật.");
    const custom = X.buildMbaOilBbtnExportData(DGA, input({ info: { ketLuan: "Theo dõi thêm" } }));
    expect(custom.ket_luan).toBe("Theo dõi thêm");
  });

  test("thùng chính riêng từng pha: mỗi pha 1 bảng", () => {
    const recA = { ...mainRec, oil_sample_point: "pharieng", phase: "A" };
    const d = X.buildMbaOilBbtnExportData(DGA, input({
      main: [{ title: "Pha A", label: "thùng chính pha A", record: recA, qd: DGA.evaluateOilRecord(recA, [], []) }], oltc: [],
    }));
    expect(d.chinh[0]).toMatchObject({ tieu_de: "Pha A", co_tieu_de: true });
  });
});

describe("Template BBTN lý-hóa dầu", () => {
  const PizZip = loadPizZip();
  const buf = fs.readFileSync(path.join(__dirname, "..", "template", "template-bbtn-ly-hoa-dau.docx"));
  const text = new PizZip(buf.toString("binary")).file("word/document.xml").asText().replace(/<[^>]+>/g, "");

  test("không còn số liệu mẫu cứng; mọi thẻ đều có dữ liệu", () => {
    expect(text).not.toMatch(/Hàm Tân|194839|95\.9|ERGON|18\/10\/2026|\{\{|\}\}/);
    const tags = text.match(/\{[^{}]+\}/g).map((t) => t.slice(1, -1).replace(/^[#/]/, ""));
    const data = X.buildMbaOilBbtnExportData(DGA, input());
    const keys = new Set([
      ...Object.keys(data), ...Object.keys(data.hang_muc[0]), ...Object.keys(data.chinh[0]), ...Object.keys(data.chinh[0].rows[0]),
    ]);
    expect([...new Set(tags)].filter((t) => !keys.has(t))).toEqual([]);
    // vòng lặp mở/đóng cân bằng
    ["hang_muc", "co_chinh", "chinh", "co_tieu_de", "rows", "co_oltc", "oltc"].forEach((k) => {
      expect((text.match(new RegExp("\\{#" + k + "\\}", "g")) || []).length).toBe((text.match(new RegExp("\\{/" + k + "\\}", "g")) || []).length);
    });
  });
});

describe("Xem nhanh file .docx (docx → HTML)", () => {
  const P = require("../src/data/io/mba-oil-bbtn.js");
  const W = (body) => `<w:document><w:body>${body}</w:body></w:document>`;

  test("đoạn văn: đậm/nghiêng, căn giữa, thoát ký tự HTML", () => {
    const html = P.mbaOilDocxXmlToHtml(W(
      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>KẾT QUẢ</w:t></w:r>' +
      '<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve"> (a &lt;b&gt;)</w:t></w:r></w:p>'));
    expect(html).toBe('<p style="text-align:center"><b>KẾT QUẢ</b><i> (a &lt;b&gt;)</i></p>');
  });

  test("bảng: gộp ô ngang (gridSpan) và dọc (vMerge); bỏ qua text box", () => {
    const tc = (txt, pr = "") => `<w:tc><w:tcPr>${pr}</w:tcPr><w:p><w:r><w:t>${txt}</w:t></w:r></w:p></w:tc>`;
    const html = P.mbaOilDocxXmlToHtml(W(
      "<w:tbl>" +
      `<w:tr>${tc("4", '<w:vMerge w:val="restart"/>')}${tc("Tạp chất", '<w:gridSpan w:val="2"/>')}</w:tr>` +
      `<w:tr>${tc("", "<w:vMerge/>")}${tc("6μm")}${tc("12")}</w:tr>` +
      "</w:tbl>" +
      '<w:p><w:r><w:txbxContent><w:p><w:r><w:t>LOGO</w:t></w:r></w:p></w:txbxContent></w:r></w:p>'));
    expect(html).toContain('<td rowspan="2"><p>4</p></td><td colspan="2"><p>Tạp chất</p></td>');
    expect(html).toContain("<tr><td><p>6μm</p></td><td><p>12</p></td></tr>");
    expect(html).not.toContain("LOGO");
  });

  test("mẫu BBTN thật chuyển được và giữ nội dung bảng", () => {
    const PizZip = loadPizZip();
    const buf = fs.readFileSync(path.join(__dirname, "..", "template", "template-bbtn-ly-hoa-dau.docx"));
    const xml = new PizZip(buf.toString("binary")).file("word/document.xml").asText();
    const page = P.mbaOilDocxHtmlPage(P.mbaOilDocxXmlToHtml(xml), "x.docx");
    expect(page).toMatch(/^<!DOCTYPE html>/);
    expect(page).toContain("KẾT QUẢ THÍ NGHIỆM");
    expect((page.match(/<table>/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
