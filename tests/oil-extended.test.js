/* Chỉ tiêu lý-hóa dầu MBA bổ sung (src/domain/dga-logic-oil-extended.js) + bộ đọc BBTN dầu MBA (src/data/io/mba-oil-bbtn.js). */
const DGA = require("../src/domain/dga-logic");
const MbaOilBbtn = require("../src/data/io/mba-oil-bbtn.js");

const base = { voltageClass: "220", oilState: "inservice", moisture: 15, tgd90: 2, bdv: 60 };
const rowOf = (res, key) => res.rows.find((r) => r.key === key);

describe("QĐ1901 — chỉ tiêu bổ sung", () => {
  test("không truyền extra: giữ nguyên 3 chỉ tiêu như trước", () => {
    const r = DGA.evaluateOilTest(base);
    expect(r.rows.map((x) => x.key)).toEqual(["moisture", "tgd90", "bdv"]);
    expect(r.overall).toBe("Đạt");
  });

  test("Bảng 59 trị số axit theo cấp điện áp / trạng thái dầu", () => {
    const at = (vc, st, v) => rowOf(DGA.evaluateOilTest({ ...base, voltageClass: vc, oilState: st, extra: { acid_mgkoh: v } }), "acid");
    expect(at("220", "inservice", 0.1).verdict).toBe("Đạt");
    expect(at("220", "inservice", 0.11).verdict).toBe("Không đạt");
    expect(at("110", "inservice", 0.15).verdict).toBe("Đạt");
    expect(at("15den35", "inservice", 0.25).verdict).toBe("Đạt");
    expect(at("500", "new", 0.03).verdict).toBe("Không đạt");
  });

  test("cấp 66 kV cũ (> 35 – < 110 kV) đã bỏ khỏi danh sách chọn; bản ghi cũ vẫn có nhãn; Bảng 59 đủ mọi cấp còn lại", () => {
    expect(DGA.OIL_VOLTAGE_CLASSES.map((c) => c.value)).toEqual(["duoi15", "15den35", "110", "220", "500"]);
    expect(DGA.oilVoltageClassName("tren35duoi110")).toMatch(/66 kV cũ/);
    DGA.OIL_VOLTAGE_CLASSES.forEach((c) => {
      expect(DGA.BANG59_ACID.inservice[c.value]).toEqual(expect.any(Number));
    });
  });

  test("Điều 51 chớp cháy: dầu mới ≥135°C; vận hành giảm ≤5°C so với lần trước", () => {
    const f = (st, v, prev) => rowOf(DGA.evaluateOilTest({ ...base, oilState: st, extra: { flash_point_c: v }, prevFlashPoint: prev }), "flash");
    expect(f("new", 135).verdict).toBe("Đạt");
    expect(f("new", 134).verdict).toBe("Không đạt");
    expect(f("inservice", 145, 150).verdict).toBe("Đạt");
    expect(f("inservice", 144, 150).verdict).toBe("Không đạt");
    expect(f("inservice", 144, null).verdict).toBe("Không có ngưỡng");
  });

  test("Bảng 56/57 tạp chất cơ học, đếm hạt; ≤110 kV quan sát bằng mắt", () => {
    const r = DGA.evaluateOilTest({ ...base, voltageClass: "500", extra: { mech_impurity_percent: 0.0017, particles_6um: 300, particles_14um: 41 } });
    expect(rowOf(r, "mech").verdict).toBe("Không đạt");
    expect(rowOf(r, "p6").verdict).toBe("Đạt");
    expect(rowOf(r, "p14").verdict).toBe("Không đạt");
    const r110 = DGA.evaluateOilTest({ ...base, voltageClass: "110", extra: { mech_visual: "co", particles_6um: 300 } });
    expect(rowOf(r110, "mechvis").verdict).toBe("Không đạt");
    expect(rowOf(r110, "p6").verdict).toBe("Không có ngưỡng");
  });

  test("Bảng 70 điện trở suất: dầu mới có ngưỡng, dầu vận hành chỉ ghi nhận; 2-FAL ≤15 ppm (≥110 kV)", () => {
    const n = DGA.evaluateOilTest({ ...base, oilState: "new", extra: { resistivity_90c_e12: 0.9 } });
    expect(rowOf(n, "resistivity").verdict).toBe("Không đạt");
    const s = DGA.evaluateOilTest({ ...base, extra: { resistivity_90c_e12: 0.1, furfural_ppm: 16 } });
    expect(rowOf(s, "resistivity").verdict).toBe("Không có ngưỡng");
    expect(rowOf(s, "furfural").verdict).toBe("Không đạt");
  });

  test("dòng 'Không có ngưỡng' không làm đổi Kết luận chung", () => {
    const r = DGA.evaluateOilTest({ ...base, extra: { color_iso2049: 5, resistivity_90c_e12: 0.1 } });
    expect(r.overall).toBe("Đạt");
    expect(DGA.evaluateOilTest({ voltageClass: "220", oilState: "inservice", extra: { color_iso2049: 5 } }).overall).toBe("Chưa đủ dữ liệu");
  });

  test("Bảng 60–62 độ ổn định ôxi hóa theo phương pháp thử", () => {
    const r = DGA.evaluateOilTest({ ...base, oilState: "new", oxMethod: "iec61125_A", extra: { ox_sludge_percent: 0.06, ox_acid_mgkoh: 0.2 } });
    expect(rowOf(r, "oxsludge").verdict).toBe("Không đạt");
    expect(rowOf(r, "oxacid").verdict).toBe("Đạt");
    const none = DGA.evaluateOilTest({ ...base, oilState: "new", extra: { ox_sludge_percent: 0.06 } });
    expect(rowOf(none, "oxsludge").verdict).toBe("Không có ngưỡng");
  });

  test("ngưỡng mới cấu hình được qua registry (Admin)", () => {
    DGA.applyRegulationConfigOverride("BANG59_ACID", { values: { inservice: { "220": 0.2 } } });
    expect(rowOf(DGA.evaluateOilTest({ ...base, extra: { acid_mgkoh: 0.15 } }), "acid").verdict).toBe("Đạt");
    DGA.resetRegulationConfigItem("BANG59_ACID");
    expect(rowOf(DGA.evaluateOilTest({ ...base, extra: { acid_mgkoh: 0.15 } }), "acid").verdict).toBe("Không đạt");
  });
});

describe("IEC 60422:2024 — Bảng 3 (dầu mới) / Bảng 5 bổ sung", () => {
  test("dầu mới dùng Bảng 3", () => {
    const r = DGA.evaluateIec60422MbaOilTest({ voltageClass: "220", oilState: "new", moisture: 12, tgd90: 0.9, bdv: 65, extra: { acid_mgkoh: 0.04, ift_mnm: 36 } });
    expect(rowOf(r, "moisture").verdict).toBe("Không đạt"); // A: ≤ 10
    expect(rowOf(r, "acid").verdict).toBe("Không đạt"); // ≤ 0,03
    expect(rowOf(r, "ift").verdict).toBe("Đạt");
    expect(r.overall).toBe("Không đạt");
  });

  test("dầu vận hành: axit, điện trở suất (quy đổi GΩ·m), IFT theo loại dầu", () => {
    const r = DGA.evaluateIec60422MbaOilTest({ voltageClass: "220", oilState: "inservice", extra: { acid_mgkoh: 0.12, resistivity_90c_e12: 0.5, ift_mnm: 24 }, inhibited: "uninhibited" });
    expect(rowOf(r, "acid").verdict).toBe("Cảnh báo");
    expect(rowOf(r, "resistivity").value).toBe(5);
    expect(rowOf(r, "resistivity").verdict).toBe("Cảnh báo");
    expect(rowOf(r, "ift").verdict).toBe("Cảnh báo"); // không ức chế: Tốt > 25
  });

  test("không truyền oilState/extra: kết quả như trước (Bảng 5, 3 chỉ tiêu)", () => {
    const r = DGA.evaluateIec60422MbaOilTest({ voltageClass: "220", moisture: 15, tgd90: 2, bdv: 60 });
    expect(r.rows.map((x) => x.key)).toEqual(["moisture", "tgd90", "bdv"]);
  });
});

describe("Dầu OLTC — Điều 37", () => {
  const ex = { particles_6um: 90, flash_point_c: 144, acid_mgkoh: 0 };
  test("dầu OLTC MỚI: chỉ tiêu bổ sung đánh giá như dầu thùng chính", () => {
    const r = DGA.evaluateOltcOilTest({ oltcSamplePoint: "pharieng", voltageClass: "500", oilState: "new", extra: ex });
    expect(rowOf(r, "p6").verdict).toBe("Không đạt"); // 500 kV dầu mới: ≤ 80
    expect(rowOf(r, "p6").label).toMatch(/OLTC/);
    expect(r.overall).toBe("Không đạt");
  });
  test("dầu OLTC VẬN HÀNH: Bảng 49 cho BDV/độ ẩm, chỉ tiêu bổ sung chỉ ghi nhận", () => {
    const r = DGA.evaluateOltcOilTest({ oltcSamplePoint: "pharieng", voltageClass: "220", oilState: "inservice", bdv: 88, extra: ex });
    expect(rowOf(r, "bdv").verdict).toBe("Đạt");
    expect(rowOf(r, "p6").verdict).toBe("Không có ngưỡng");
    expect(r.overall).toBe("Đạt");
    const onlyExtra = DGA.evaluateOltcOilTest({ oltcSamplePoint: "trungtinh", voltageClass: "220", oilState: "inservice", extra: ex });
    expect(onlyExtra.overall).toBe("Chưa đủ dữ liệu");
  });
});

describe("theo bản ghi đã lưu", () => {
  const recs = [
    { id: "1", tram: "A", thiet_bi: "T1", oil_sample_point: "chung", voltage_class: "220", oil_state: "inservice", sample_date: "2024-01-01", flash_point_c: 150 },
    { id: "2", tram: "A ", thiet_bi: "t1", oil_sample_point: "chung", voltage_class: "220", oil_state: "inservice", sample_date: "2025-01-01", flash_point_c: 148 },
    { id: "3", tram: "A", thiet_bi: "T1", oil_sample_point: "chung", voltage_class: "220", oil_state: "inservice", sample_date: "2026-01-01", flash_point_c: 140 },
    { id: "4", tram: "A", thiet_bi: "T1", oil_sample_point: "pharieng", phase: "B", voltage_class: "220", oil_state: "inservice", sample_date: "2025-06-01", flash_point_c: 100 },
  ];
  test("chớp cháy lần LIỀN TRƯỚC cùng thùng dầu (không lẫn pha riêng)", () => {
    expect(DGA.findPreviousOilFlashPoint(recs, recs[2])).toBe(148);
    expect(DGA.findPreviousOilFlashPoint(recs, recs[0])).toBe(null);
    const r = DGA.evaluateOilRecord(recs[2], [], recs);
    expect(rowOf(r, "flash").verdict).toBe("Không đạt"); // giảm 8°C
  });
});

describe("đọc BBTN dầu MBA (PDF -> dòng chữ)", () => {
  test("biên bản mẫu chung: nhãn + kết quả, bỏ cột giới hạn và số hiệu tiêu chuẩn", () => {
    const p = MbaOilBbtn.parseMbaOilBbtnLines([
      "Trạm biến áp: TBA 220kV Bảo Lộc", "Thiết bị: MBA AT1", "Điện áp định mức: 225/115/23 kV",
      "Lý do thí nghiệm: Định kỳ", "Ngày lấy mẫu: 05/03/2024",
      "1 Điện áp chọc thủng (IEC 60156) kV 68,5 ≥ 55 Đạt",
      "2 Tổn hao điện môi tgδ ở 90°C % 0,85 ≤ 10 Đạt",
      "3 Hàm lượng nước (IEC 60814) ppm 12 ≤ 20 Đạt",
      "4 Trị số axit mgKOH/g 0,045 ≤ 0,1 Đạt",
      "5 Nhiệt độ chớp cháy cốc kín (ASTM D93) 146 °C",
      "6 Điện trở suất ở 90°C Ω.cm 2,5x10^12",
      "7 Số hạt > 6 μm hạt/ml 450", "8 Số hạt > 14 μm hạt/ml 35",
      "9 Lưu huỳnh ăn mòn Không ăn mòn",
    ]);
    expect(p.threePhase).toBe(false);
    expect(p.values.X).toEqual({
      bdv_kv: 68.5, tgd_90c_percent: 0.85, moisture_ppm: 12, acid_mgkoh: 0.045, flash_point_c: 146,
      resistivity_90c_e12: 2.5, particles_6um: 450, particles_14um: 35, corrosive_sulfur: "khong",
    });
    expect(p.header).toMatchObject({ tram: "TBA 220kV Bảo Lộc", thietBi: "MBA AT1", ngay: "2024-03-05", voltageClass: "220", oilState: "inservice" });
  });

  test("biên bản 3 pha A/B/C", () => {
    const p = MbaOilBbtn.parseMbaOilBbtnLines([
      "Ngày thí nghiệm 12/08/2025", "Hạng mục Đơn vị Pha A Pha B Pha C",
      "Điện áp chọc thủng kV 70 72 69 ≥ 60", "Hàm lượng nước ppm 8 9 11 ≤ 20",
    ]);
    expect(p.threePhase).toBe(true);
    expect(p.values.A).toEqual({ bdv_kv: 70, moisture_ppm: 8 });
    expect(p.values.C).toEqual({ bdv_kv: 69, moisture_ppm: 11 });
  });

  // Dòng chữ trích từ mẫu thật assets/template/bbtn-ly-hoa-dau-mba-oltc-1pha.docx (MBA 1 pha 500 kV) — bỏ phần ký tên
  const BBTN_1PHA = [
    "BIÊN BẢN THÍ NGHIỆM DẦU CÁCH ĐIỆN (Insulation oil test report)",
    "Tên dự án/tên trạm (Project): Công trình nâng công suất TBA 500kV Di Linh",
    "Vị trí lắp đặt (Site): Máy biến áp 500kV AT1",
    "Vị trí lấy mẫu (Sampling position): Thân máy và bộ OLTC pha C",
    "Hãng sản xuất (Manufacturer): TOSHIBA | Năm sản xuất (Year of manufacture): 2026",
    "Điện áp định mức (Rated voltage): 500 kV | Công suất (Rated power): 300 MVA",
    "Loại dầu (Type): Nynas Nytro 10XN | Ngày lấy mẫu (Date): 23/10/2026",
    "Lý do thí nghiệm (Purpose of test): Lắp mới",
    "Các hạng mục đã thí nghiệm (Tested items): | Đánh giá (Estimate)",
    "2. Nhiệt độ chớp cháy kín (Flash point PMCC) | ✓ | Đạt",
    "4. Hàm lượng axit – kiềm hòa tan trong dầu (Acid-base reaction) | ✓ | Đạt",
    "KẾT QUẢ THÍ NGHIỆM",
    "Dầu cách điện trong thùng dầu chính (Insulation oil of main tank):",
    "STT | Hạng mục phân tích (Test items) | Đơn vị (Unit) | Kết quả (Result) | Tiêu chuẩn (Limits) | Đánh giá (Estimate)",
    "1 | Hàm lượng tạp chất cơ học (Particles content)",
    "1.1 | - Quan sát bằng mắt | / | Không thấy | Không thấy | Đạt",
    "1.2 | - Có kích thước hạt lớn hơn 6μm | Số lượng tạp chất/1ml dầu | 12.1 | ≤ 80 | Đạt",
    "1.3 | - Có kích thước hạt lớn hơn 14μm | 1.2 | ≤ 10 | Đạt",
    "2 | Nhiệt độ chớp cháy kín (Flash point PMCC) | 0C | 144 | ≥ 135°C và Giảm không quá 5°C | Đạt",
    "3 | Hàm lượng axit (Acid number) | mgKOH/g dầu | Không có | ≤ 0.02 | Đạt",
    "4 | Hàm lượng axit – kiềm hòa tan trong dầu (Acid-base reaction) | mgKOH/g dầu | Không có | Không có | Đạt",
    "Dầu cách điện trong bộ OLTC (Insulation oil of on - load tap changer):",
    "1.2 | - Có kích thước hạt lớn hơn 6μm | Số lượng tạp chất/1ml dầu | 48.3 | ≤ 80 | Đạt",
    "1.3 | - Có kích thước hạt lớn hơn 14μm | 4.1 | ≤ 10 | Đạt",
    "2 | Nhiệt độ chớp cháy kín (Flash point PMCC) | 0C | 144 | ≥ 135°C và Giảm không quá 5°C | Đạt",
    "THIẾT BỊ THÍ NGHIỆM (Testing instruments):",
    "Thiết bị đo nhiệt độ chớp cháy kín (Flash point PMCC tester) Koehler K16270 – S/N: R61490095.",
  ];

  test("mẫu PTC3 — MBA 1 pha: thùng chính + OLTC đều là pha C, chữ 'Không thấy'/'Không có'", () => {
    const p = MbaOilBbtn.parseMbaOilBbtnLines(BBTN_1PHA);
    expect(p.header).toMatchObject({ tram: "TBA 500kV Di Linh", thietBi: "Máy biến áp 500kV AT1", ngay: "2026-10-23",
      voltageClass: "500", oilState: "new", phase: "C", hangSx: "TOSHIBA", loaiDau: "Nynas Nytro 10XN" });
    expect(p.values.X).toEqual({ mech_visual: "khong", particles_6um: 12.1, particles_14um: 1.2, flash_point_c: 144, acid_mgkoh: 0, acid_base_soluble: "khong" });
    expect(p.oltc.threePhase).toBe(false);
    expect(p.oltc.values.X).toEqual({ particles_6um: 48.3, particles_14um: 4.1, flash_point_c: 144 });
    // dầu mới 500 kV: hạt >6μm ≤ 80, >14μm ≤ 10, chớp cháy ≥ 135, axit ≤ 0,02 → Đạt
    const r = DGA.evaluateOilTest({ voltageClass: "500", oilState: "new", extra: p.values.X });
    expect(r.overall).toBe("Đạt");
  });

  test("mẫu PTC3 — MBA 3 pha: thùng chính 1 cột, OLTC tách bảng con pha A/B/C; 'pha A,B,C' không gán 1 pha", () => {
    const p = MbaOilBbtn.parseMbaOilBbtnLines([
      "Tên dự án/tên trạm (Project): Trạm 220kV Hàm Tân",
      "Vị trí lắp đặt (Site): Máy biến áp AT2",
      "Vị trí lấy mẫu (Sampling position): Van thùng chính, van OLTC pha A,B,C máy biến áp AT2",
      "Điện áp định mức (Rated voltage): (225/√3±8x1,25%)/115/√3/23 (kV) | Công suất (Rated power): 150/200/250 (MVA)",
      "Loại dầu (Type): ERGON-Mỹ | Ngày lấy mẫu (Date): 18/10/2026",
      "Lý do thí nghiệm (Purpose of test): Định kỳ 1 năm",
      "1. Điện áp chọc thủng (Breakdown voltage) | ✓ | Đạt",
      "Dầu cách điện trong thùng dầu chính (Insulation oil of main tank):",
      "1 | Điện áp chọc thủng (Breakdown voltage) | kV | 95.9 | ≥ 55 | Đạt",
      "2 | Hệ số tổn hao điện môi Tgδ 900C (Dielectric dissipation factor) | % | 0.092 | ≤ 10 | Đạt",
      "5 | Hàm lượng nước trong dầu (Water content) | ppm",
      "Dầu cách điện trong bộ OLTC (Insulation oil of on - load tap changer):",
      "Dầu cách điện trong bộ OLTC máy biến áp 220kV.",
      "+ OLTC pha A",
      "1 | Điện áp chọc thủng (Breakdown voltage) | kV | 90 | ≥ 50 | Đạt",
      "2 | Hệ số tổn hao điện môi Tgδ 900C (Dielectric dissipation factor) | % | 0.247 | ≤ 10 | Đạt",
      "+ OLTC pha B",
      "1 | Điện áp chọc thủng (Breakdown voltage) | kV | 88 | ≥ 50 | Đạt",
      "+ OLTC pha C",
      "1 | Điện áp chọc thủng (Breakdown voltage) | kV | 87.4 | ≥ 50 | Đạt",
      "Dầu cách điện trong bộ OLTC máy biến áp 110kV/500kV.",
      "THIẾT BỊ THÍ NGHIỆM (Testing instruments):",
    ]);
    expect(p.header).toMatchObject({ tram: "Trạm 220kV Hàm Tân", voltageClass: "220", oilState: "inservice", phase: "" });
    expect(p.threePhase).toBe(false);
    expect(p.values.X).toEqual({ bdv_kv: 95.9, tgd_90c_percent: 0.092 });
    expect(p.oltc.threePhase).toBe(true);
    expect(p.oltc.values).toEqual({ A: { bdv_kv: 90, tgd_90c_percent: 0.247 }, B: { bdv_kv: 88 }, C: { bdv_kv: 87.4 } });
  });

  test("mẫu PTC3 form 2 — MBA 3 pha: thùng chính và OLTC đều 1 bảng có 3 cột Pha A/B/C; 'sau nạp vào máy' = dầu mới", () => {
    const p = MbaOilBbtn.parseMbaOilBbtnLines([
      "Tên dự án/tên trạm (Project): Công trình NCS TBA 500kV Di Linh",
      "Vị trí lắp đặt (Site): MBA AT1",
      "Vị trí lấy mẫu (Sampling position): Van đáy thân máy, OLTC",
      "Hãng sản xuất (Manufacturer): Nynas | Năm sản xuất: 2026",
      "Điện áp định mức (Rated voltage): 500kV | Công suất (Rated power):",
      "Số chế tạo (Serial No): - | Năm vận hành (Year of operation): -",
      "Loại dầu (Type): NYTRO 10XN | Ngày lấy mẫu (Date): 22/10/2026",
      "Lý do thí nghiệm (Purpose of test): Thí nghiệm sau nạp vào máy",
      "1. Điện áp chọc thủng (Breakdown voltage) | ✓ | Đạt",
      "Dầu cách điện trong thùng dầu chính (Insulation oil of main tank):",
      "STT | Hạng mục phân tích (Test items) | Đơn vị (Unit) | Kết quả (Result) | Tiêu chuẩn (Limits) | Đánh giá (Estimate)",
      "Pha A (Phase A) | Pha B (Phase B) | Pha C (Phase C)",
      "1 | Điện áp chọc thủng (Breakdown voltage) | kV | 90,1 | 90,3 | 94,2 | ≥ 70 | Đạt",
      "2 | Hệ số tổn hao điện môi Tgδ 900C (Dielectric dissipation factor) | % | 0,278 | 0,078 | 0,085 | ≤ 1 | Đạt",
      "3 | Hàm lượng nước trong dầu (Water content) | ppm | 4 | 5 | 5 | < 10 | Đạt",
      "Dầu cách điện trong bộ OLTC (Insulation oil of on - load tap changer):",
      "Pha A (Phase A) | Pha B (Phase B) | Pha C (Phase C)",
      "1 | Điện áp chọc thủng (Breakdown voltage) | kV | 80,6 | 83,8 | 87,9 | ≥ 70 | Đạt",
      "2 | Hệ số tổn hao điện môi Tgδ 900C (Dielectric dissipation factor) | % | 0,118 | 0,127 | 0,132 | ≤ 1 | Đạt",
      "3 | Hàm lượng nước trong dầu (Water content) | ppm",
      "THIẾT BỊ THÍ NGHIỆM (Testing instruments):",
    ]);
    expect(p.header).toMatchObject({ tram: "TBA 500kV Di Linh", thietBi: "MBA AT1", ngay: "2026-10-22", voltageClass: "500",
      oilState: "new", phase: "", hangSx: "Nynas", serial: "", loaiDau: "NYTRO 10XN" });
    expect(p.threePhase).toBe(true);
    expect(p.values).toEqual({
      A: { bdv_kv: 90.1, tgd_90c_percent: 0.278, moisture_ppm: 4 },
      B: { bdv_kv: 90.3, tgd_90c_percent: 0.078, moisture_ppm: 5 },
      C: { bdv_kv: 94.2, tgd_90c_percent: 0.085, moisture_ppm: 5 },
    });
    expect(p.oltc.threePhase).toBe(true);
    expect(p.oltc.values).toEqual({ A: { bdv_kv: 80.6, tgd_90c_percent: 0.118 }, B: { bdv_kv: 83.8, tgd_90c_percent: 0.127 }, C: { bdv_kv: 87.9, tgd_90c_percent: 0.132 } });
  });

  test("PDF: 1 hàng bảng tách nhiều dòng (nhãn / '0' của °C / STT + kết quả / chú thích tiếng Anh); header không có dấu ô", () => {
    const p = MbaOilBbtn.parseMbaOilBbtnLines([
      "Tên dự án/tên trạm (Project): Công trình nâng công suất Trạm 220kV Hàm Tân",
      "Hãng sản xuất (Manufacturer): EEMC Năm sản xuất: 2019",
      "Điện áp định mức (Rated voltage): Công suất (Rated power): 150/200/250 (MVA)",
      "(225/√3±8x1,25%)/115/√3/23 (kV)",
      "Số chế tạo (Serial No): 194839-124 Năm vận hành (Year of operation): 2019",
      "Loại dầu (Type): ERGON-Mỹ Ngày lấy mẫu (Date): 18/10/2026",
      "1. Điện áp chọc thủng (Breakdown voltage) ✓ Đạt",
      "0",
      "2. Hệ số tổn hao điện môi Tgδ 90 C (Dielectric dissipation factor) ✓ Đạt",
      "6. Nhiệt độ chớp cháy kín (Flash point PMCC)",
      "1. Dầu cách điện trong thùng dầu chính (Insulation oil of main tank):",
      "Hạng mục phân tích Đơn vị Kết quả Tiêu chuẩn Đánh giá",
      "STT",
      "(Test items) (Unit) (Result) (Limits) (Estimate)",
      "Điện áp chọc thủng",
      "1 kV 95.9 ≥ 55 Đạt",
      "(Breakdown voltage)",
      "0",
      "Hệ số tổn hao điện môi Tgδ 90 C",
      "2 % 0.092 ≤ 10 Đạt",
      "(Dielectric dissipation factor)",
      "Màu sắc và độ trong",
      "3 / Trong Trong, không có cặn Đạt",
      "(Appearance)",
      "Hàm lượng tạp chất cơ học",
      "4",
      "(Particles content)",
      "4.1 - Quan sát bằng mắt / Không thấy Không thấy Đạt",
      "4.2 - Có kích thước hạt lớn hơn 6μm Số lượng tạp",
      "4.3 - Có kích thước hạt lớn hơn 14μm chất/1ml dầu",
      "Hàm lượng nước trong dầu",
      "5 ppm",
      "(Water content)",
      "Nhiệt độ chớp cháy kín",
      "0",
      "6 C 144 ≥ 135 C và giảm không quá 5 C Đạt",
      "(Flash point PMCC)",
      "7 Hàm lượng axit (Acid number) mgKOH/g 0.02 ≤ 0.15 Đạt",
      "THIẾT BỊ THÍ NGHIỆM (Testing instruments):",
    ]);
    expect(p.header).toMatchObject({ tram: "Trạm 220kV Hàm Tân", hangSx: "EEMC", serial: "194839-124", loaiDau: "ERGON-Mỹ",
      voltageClass: "220", ngay: "2026-10-18" });
    // nước để trống → không lấy STT "5"; tạp chất 6μm không lấy nhầm "14" của dòng sau; chớp cháy không lấy "0" của °C
    expect(p.values.X).toEqual({ bdv_kv: 95.9, tgd_90c_percent: 0.092, appearance: "trong", mech_visual: "khong",
      flash_point_c: 144, acid_mgkoh: 0.02 });
  });

  test("DOCX (word/document.xml) → dòng: đoạn văn 1 dòng, hàng bảng nối ô bằng ' | '", () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>Dầu cách điện trong thùng dầu chính:</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Điện áp chọc thủng</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>(Breakdown voltage)</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t xml:space="preserve">kV</w:t></w:r></w:p></w:tc>' +
      '<w:tc><w:p><w:r><w:t>95.9</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>≥ 55</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
    const lines = MbaOilBbtn.mbaOilDocxXmlToLines(xml);
    expect(lines).toEqual(["Dầu cách điện trong thùng dầu chính:", "1 | Điện áp chọc thủng (Breakdown voltage) | kV | 95.9 | ≥ 55"]);
    expect(MbaOilBbtn.parseMbaOilBbtnLines(lines).values.X).toEqual({ bdv_kv: 95.9 });
  });

  test("điện trở suất ghi số mũ khác 12 được quy về ×10¹²", () => {
    const p = MbaOilBbtn.parseMbaOilBbtnLines(["Điện trở suất 90°C 3,2.10^13 Ω.cm"]);
    expect(p.values.X.resistivity_90c_e12).toBe(32);
  });
});
