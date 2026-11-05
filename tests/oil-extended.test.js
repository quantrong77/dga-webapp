/* Chỉ tiêu lý-hóa dầu MBA bổ sung (logic/dga-logic-oil-extended.js) + bộ đọc BBTN dầu MBA (bbtn/mba-oil-bbtn.js). */
const DGA = require("../dga-logic");
const MbaOilBbtn = require("../bbtn/mba-oil-bbtn.js");

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
    expect(at("tren35duoi110", "inservice", 0.2).verdict).toBe("Không có ngưỡng");
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
    expect(p.header).toEqual({ tram: "TBA 220kV Bảo Lộc", thietBi: "MBA AT1", ngay: "2024-03-05", voltageClass: "220", oilState: "inservice" });
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

  test("điện trở suất ghi số mũ khác 12 được quy về ×10¹²", () => {
    const p = MbaOilBbtn.parseMbaOilBbtnLines(["Điện trở suất 90°C 3,2.10^13 Ω.cm"]);
    expect(p.values.X.resistivity_90c_e12).toBe(32);
  });
});
