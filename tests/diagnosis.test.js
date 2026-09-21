// Chẩn đoán dạng sự cố: Bảng 66 (= IEC 60599:2022 Table 1), Table A.10 (sứ xuyên), Tam giác Duval 1.
//
// Ngưỡng Bảng 66 / Table 1 (nguồn: IEC 60599:2022 mục 5.4; QĐ1901 Điều 54):
//   mã   C2H2/C2H4   CH4/H2      C2H4/C2H6
//   PD   NS          < 0,1       < 0,2      (0,2 cho TI/TU; 0,07 cho sứ xuyên)
//   D1   > 1         0,1 – 0,5   > 1
//   D2   0,6 – 2,5   0,1 – 1     > 2
//   T1   NS          > 1         < 1
//   T2   < 0,1       > 1         1 – 4
//   T3   < 0,2       > 1         > 4
const { DGA, gases } = require("./helpers");
const { EQUIPMENT_TYPES: T, NO_DIAGNOSIS } = DGA;

const r = (c2h2_c2h4, ch4_h2, c2h4_c2h6) => ({ c2h2_c2h4, ch4_h2, c2h4_c2h6 });

describe("computeRatios — trường hợp chia cho 0", () => {
  test("tỷ số bình thường", () => {
    const x = DGA.computeRatios(gases({ H2: 100, CH4: 10, C2H6: 20, C2H4: 40, C2H2: 20, CO: 10, CO2: 50 }));
    expect(x.c2h2_c2h4).toBeCloseTo(0.5);
    expect(x.ch4_h2).toBeCloseTo(0.1);
    expect(x.c2h4_c2h6).toBeCloseTo(2);
    expect(x.co2_co).toBeCloseTo(5);
  });
  test("C2H4 = 0: C2H2 cũng 0 => 0; C2H2 > 0 => 999 (rất lớn)", () => {
    expect(DGA.computeRatios(gases({ C2H4: 0, C2H2: 0 })).c2h2_c2h4).toBe(0);
    expect(DGA.computeRatios(gases({ C2H4: 0, C2H2: 5 })).c2h2_c2h4).toBe(999);
  });
  test("CO = 0: CO2 cũng 0 => null; CO2 > 0 => 999", () => {
    expect(DGA.computeRatios(gases({ CO: 0, CO2: 0 })).co2_co).toBeNull();
    expect(DGA.computeRatios(gases({ CO: 0, CO2: 5 })).co2_co).toBe(999);
  });
  test("không bao giờ trả NaN/Infinity", () => {
    const x = DGA.computeRatios(gases());
    Object.values(x).filter((v) => v !== null).forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe("diagnoseRatios — Bảng 66 (điểm nằm trong vùng)", () => {
  test("PD: CH4/H2 < 0,1 và C2H4/C2H6 < 0,2", () => {
    expect(DGA.diagnoseRatios(r(0, 0.05, 0.1))).toMatch(/^PD/);
  });
  test("D1 thuần: C2H2/C2H4 > 2,5 (ngoài vùng của D2)", () => {
    expect(DGA.diagnoseRatios(r(3, 0.3, 1.5))).toMatch(/^D1 -/);
  });
  test("D2 thuần: C2H2/C2H4 ≤ 1 nên không thuộc D1", () => {
    expect(DGA.diagnoseRatios(r(0.7, 0.8, 3))).toMatch(/^D2/);
    expect(DGA.diagnoseRatios(r(1, 1, 3))).toMatch(/^D2/); // đúng bằng 1: không > 1, nên không phải D1
  });
  test("vùng chồng lấn D1 ∩ D2: C2H2/C2H4 ∈ (1; 2,5], CH4/H2 ∈ [0,1; 0,5], C2H4/C2H6 > 2", () => {
    expect(DGA.diagnoseRatios(r(1.5, 0.3, 3))).toMatch(/^D1\/D2/);
  });
  test("T1: CH4/H2 > 1 và C2H4/C2H6 < 1", () => {
    expect(DGA.diagnoseRatios(r(0.05, 2, 0.5))).toMatch(/^T1/);
  });
  test("T2: C2H2/C2H4 < 0,1, CH4/H2 > 1, C2H4/C2H6 từ 1 đến 4", () => {
    expect(DGA.diagnoseRatios(r(0.05, 2, 2))).toMatch(/^T2/);
    expect(DGA.diagnoseRatios(r(0.05, 2, 4))).toMatch(/^T2/); // đúng bằng 4: vẫn T2 ("1 – 4")
    expect(DGA.diagnoseRatios(r(0.05, 2, 1))).toMatch(/^T2/); // đúng bằng 1: không < 1 nên không phải T1
  });
  test("T3: C2H2/C2H4 < 0,2, CH4/H2 > 1, C2H4/C2H6 > 4", () => {
    expect(DGA.diagnoseRatios(r(0.1, 2, 6))).toMatch(/^T3/);
    expect(DGA.diagnoseRatios(r(0.1, 2, 4.01))).toMatch(/^T3/);
  });
  test("không khớp mã nào => NO_DIAGNOSIS", () => {
    expect(DGA.diagnoseRatios(r(3, 0.3, 0.5))).toBe(NO_DIAGNOSIS);
    expect(DGA.diagnoseRatios(r(0.15, 2, 2))).toBe(NO_DIAGNOSIS); // g ≥ 0,1 nên không T2; i ≤ 4 nên không T3
  });
});

describe("diagnoseRatios — điều kiện biên và ngưỡng PD theo loại thiết bị", () => {
  test("CH4/H2 đúng bằng ngưỡng PD (0,1) => KHÔNG phải PD (điều kiện '<')", () => {
    expect(DGA.diagnoseRatios(r(0, 0.1, 0.1))).toBe(NO_DIAGNOSIS);
  });
  test("TI/TU: ngưỡng PD 0,2 => CH4/H2 = 0,15 là PD; với ngưỡng mặc định 0,1 thì không", () => {
    expect(DGA.diagnoseRatios(r(0, 0.15, 0.1), 0.2)).toMatch(/^PD/);
    expect(DGA.diagnoseRatios(r(0, 0.15, 0.1))).toBe(NO_DIAGNOSIS);
  });
  test("sứ xuyên: ngưỡng PD 0,07 => CH4/H2 = 0,08 không phải PD", () => {
    expect(DGA.diagnoseRatios(r(0, 0.08, 0.1), 0.07)).toBe(NO_DIAGNOSIS);
    expect(DGA.diagnoseRatios(r(0, 0.06, 0.1), 0.07)).toMatch(/^PD/);
  });
  test("C2H4/C2H6 đúng bằng 0,2 => không PD", () => {
    expect(DGA.diagnoseRatios(r(0, 0.05, 0.2))).toBe(NO_DIAGNOSIS);
  });
});

describe("Sứ xuyên — Table A.10 (IEC 60599:2022 Annex A.5.3), 4 mã ĐỘC LẬP", () => {
  const b = (ch4_h2, c2h2_c2h4, c2h4_c2h6, co2_co) => ({ ch4_h2, c2h2_c2h4, c2h4_c2h6, co2_co });

  test("không mã nào khớp => mảng rỗng", () => {
    expect(DGA.diagnoseBushingRatios(b(0.5, 0.5, 0.5, 5))).toEqual([]);
  });
  test("PD: CH4/H2 < 0,07 (đúng 0,07 thì không)", () => {
    expect(DGA.diagnoseBushingRatios(b(0.06, 0, 0, null))).toEqual(["PD"]);
    expect(DGA.diagnoseBushingRatios(b(0.07, 0, 0, null))).toEqual([]);
  });
  test("D: C2H2/C2H4 > 1; T: C2H4/C2H6 > 1 (đúng 1 thì không)", () => {
    expect(DGA.diagnoseBushingRatios(b(0.5, 1.01, 0, null))).toEqual(["D"]);
    expect(DGA.diagnoseBushingRatios(b(0.5, 1, 1, null))).toEqual([]);
    expect(DGA.diagnoseBushingRatios(b(0.5, 0, 1.01, null))).toEqual(["T"]);
  });
  test("TP: CO2/CO < 1 hoặc > 20; đúng 1 hoặc 20 thì không; null thì bỏ qua", () => {
    expect(DGA.diagnoseBushingRatios(b(0.5, 0, 0, 0.5))).toEqual(["TP"]);
    expect(DGA.diagnoseBushingRatios(b(0.5, 0, 0, 21))).toEqual(["TP"]);
    expect(DGA.diagnoseBushingRatios(b(0.5, 0, 0, 1))).toEqual([]);
    expect(DGA.diagnoseBushingRatios(b(0.5, 0, 0, 20))).toEqual([]);
    expect(DGA.diagnoseBushingRatios(b(0.5, 0, 0, null))).toEqual([]);
  });
  test("có thể khớp NHIỀU mã cùng lúc", () => {
    expect(DGA.diagnoseBushingRatios(b(0.05, 2, 3, 25))).toEqual(["PD", "D", "T", "TP"]);
  });

  test("diagnoseGasFault (sứ xuyên) liệt kê đủ mã khớp theo Table A.10", () => {
    // C2H2/C2H4 = 2 (D), C2H4/C2H6 = 2 (T), CH4/H2 = 1 (không PD), CO2/CO = 5 (không TP)
    const out = DGA.diagnoseGasFault(gases({ H2: 10, CH4: 10, C2H6: 10, C2H4: 20, C2H2: 40, CO: 10, CO2: 50 }), T.BUSHING, 0.07);
    expect(out).toMatch(/A\.10/);
    expect(out).toMatch(/D \+ T/);
  });
  test("không mã A.10 nào khớp => rơi về Table 1 (Bảng 66) đúng yêu cầu IEC", () => {
    // CH4/H2 = 2, C2H4/C2H6 = 0,5, C2H2 = 0, CO2/CO = 5 => A.10 rỗng; Table 1 => T1
    const out = DGA.diagnoseGasFault(gases({ H2: 10, CH4: 20, C2H6: 40, C2H4: 20, CO: 100, CO2: 500 }), T.BUSHING, 0.07);
    expect(out).toMatch(/^T1/);
    expect(out).toMatch(/rơi về Table 1/);
  });
  test("A.10 và Table 1 đều không kết luận => trả nguyên NO_DIAGNOSIS (không bọc thêm chữ)", () => {
    const out = DGA.diagnoseGasFault(gases({ H2: 10, CH4: 5, C2H6: 10, C2H4: 5, C2H2: 0, CO: 100, CO2: 500 }), T.BUSHING, 0.07);
    expect(out).toBe(NO_DIAGNOSIS);
  });
  test("loại thiết bị khác dùng thẳng Bảng 66", () => {
    const g = gases({ H2: 10, CH4: 20, C2H6: 40, C2H4: 20 });
    expect(DGA.diagnoseGasFault(g, T.MBA, 0.1)).toMatch(/^T1/);
  });
});

describe("Tam giác Duval 1 — IEC 60599:2022 Annex B, Figure B.3", () => {
  const zone = (m, e, a) => DGA.classifyDuval1({ pctCH4: m, pctC2H4: e, pctC2H2: a }).zone;

  test("PD: %CH4 ≥ 98", () => {
    expect(zone(98, 2, 0)).toBe("PD");
    expect(zone(100, 0, 0)).toBe("PD");
  });
  test("T1: %C2H2 ≤ 4 và %C2H4 ≤ 20 (đúng 20 vẫn T1)", () => {
    expect(zone(85, 15, 0)).toBe("T1");
    expect(zone(80, 20, 0)).toBe("T1");
  });
  test("T2: %C2H2 ≤ 4 và 20 < %C2H4 ≤ 50", () => {
    expect(zone(79.9, 20.1, 0)).toBe("T2");
    expect(zone(50, 50, 0)).toBe("T2");
  });
  test("T3: %C2H2 ≤ 4 và %C2H4 > 50; và vùng mở rộng %C2H2 ≤ 15 với %C2H4 > 50", () => {
    expect(zone(49.9, 50.1, 0)).toBe("T3");
    expect(zone(30, 60, 10)).toBe("T3");
  });
  test("D1: %C2H2 ≥ 13 và %C2H4 ≤ 23 (điểm biên 13 và 23 thuộc D1)", () => {
    expect(zone(60, 10, 30)).toBe("D1");
    expect(zone(64, 23, 13)).toBe("D1");
  });
  test("D2: 13 ≤ %C2H2 ≤ 29 và 23 < %C2H4 ≤ 40", () => {
    expect(zone(50, 30, 20)).toBe("D2");
    expect(zone(31, 40, 29)).toBe("D2");
  });
  test("vùng chồng lấn D+T (hình gốc IEC cũng không phân định rõ)", () => {
    expect(zone(45, 45, 10)).toBe("D+T"); // %C2H2 từ 4 đến 13, %C2H4 không đủ lớn cho T3 mở rộng
    expect(zone(35, 45, 20)).toBe("D+T"); // %C2H2 trong 13–29 nhưng %C2H4 > 40 và ≤ 50
    expect(zone(20, 60, 20)).toBe("D+T"); // %C2H2 > 15 với %C2H4 > 50
  });

  test("normalizeDuval: quy về tổng 100%; tổng 0 => null", () => {
    const p = DGA.normalizeDuval(gases({ CH4: 50, C2H4: 30, C2H2: 20, H2: 999 }));
    expect(p.pctCH4).toBeCloseTo(50);
    expect(p.pctC2H4).toBeCloseTo(30);
    expect(p.pctC2H2).toBeCloseTo(20);
    expect(DGA.normalizeDuval(gases({ H2: 100 }))).toBeNull();
    expect(DGA.diagnoseDuval1(gases())).toBeNull();
  });
  test("diagnoseDuval1 trả %, vùng và tọa độ vẽ", () => {
    const d = DGA.diagnoseDuval1(gases({ CH4: 60, C2H4: 10, C2H2: 30 }));
    expect(d.zone).toBe("D1");
    expect(d.xy).toBeDefined();
  });
  test("duvalPlotXY: 3 đỉnh tam giác đều (cạnh đáy 100)", () => {
    const top = DGA.duvalPlotXY({ pctCH4: 100, pctC2H4: 0, pctC2H2: 0 });
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(50 * Math.sqrt(3));
    const right = DGA.duvalPlotXY({ pctCH4: 0, pctC2H4: 100, pctC2H2: 0 });
    expect(right.x).toBeCloseTo(100);
    expect(right.y).toBeCloseTo(0);
    const left = DGA.duvalPlotXY({ pctCH4: 0, pctC2H4: 0, pctC2H2: 100 });
    expect(left.x).toBeCloseTo(0);
    expect(left.y).toBeCloseTo(0);
  });
});
