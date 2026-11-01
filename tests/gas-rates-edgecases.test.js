/**
 * Unit Test Suite for Gas Rates, TCG & Additional Ratios Edge Cases (logic/dga-logic-gas.js)
 * Senior QA Engineer & Test Automation Specialist
 * Structure: AAA (Arrange - Act - Assert)
 * Coverage: computeRateOfChange, computeTcgRateOfChange, computeTotalDissolvedGasPercent, evaluateBang63, diagnoseAdditionalRatios
 */

const { DGA, gases } = require("./helpers");

describe("DGA Gas Rate of Change Edge Cases (computeRateOfChange)", () => {
  test("Arrange/Act/Assert: returns null when deltaDays <= 0 or missing (Zero/Negative day interval)", () => {
    // Arrange
    const prev = gases({ H2: 10 });
    const curr = gases({ H2: 20 });

    // Act & Assert
    expect(DGA.computeRateOfChange(prev, curr, 0, null, DGA.EQUIPMENT_TYPES.MBA)).toBeNull();
    expect(DGA.computeRateOfChange(prev, curr, -5, null, DGA.EQUIPMENT_TYPES.MBA)).toBeNull();
    expect(DGA.computeRateOfChange(prev, curr, null, null, DGA.EQUIPMENT_TYPES.MBA)).toBeNull();
  });

  test("Rate per month: handles before = 0 gracefully by returning null for ratePerMonth (Division by zero)", () => {
    // Arrange: H2 was 0, now is 15 (delta = +15 over 30 days)
    const prev = gases({ H2: 0 });
    const curr = gases({ H2: 15 });

    // Act
    const rows = DGA.computeRateOfChange(prev, curr, 30, null, DGA.EQUIPMENT_TYPES.MBA);
    const h2Row = rows.find((r) => r.gas === "H2");

    // Assert
    expect(h2Row.before).toBe(0);
    expect(h2Row.after).toBe(15);
    expect(h2Row.delta).toBe(15);
    expect(h2Row.ratePerMonth).toBeNull(); // Avoided Infinity / Division by zero!
    expect(h2Row.ratePerYear).toBeCloseTo((15 / 30) * 365, 1);
  });

  test("Negative delta: detects gas concentration decrease (e.g., after oil degasification)", () => {
    // Arrange: H2 decreased from 100 to 20 over 10 days
    const prev = gases({ H2: 100 });
    const curr = gases({ H2: 20 });

    // Act
    const rows = DGA.computeRateOfChange(prev, curr, 10, null, DGA.EQUIPMENT_TYPES.MBA);
    const h2Row = rows.find((r) => r.gas === "H2");

    // Assert
    expect(h2Row.delta).toBe(-80);
    expect(h2Row.verdict).toContain("Giảm — có thể do lọc/xử lý/thay dầu");
  });

  test("Extreme spike: calculates accurate rate for sudden gas surge within 1 day", () => {
    // Arrange: C2H2 jumped from 1 to 50 ppm in 1 single day
    const prev = gases({ C2H2: 1 });
    const curr = gases({ C2H2: 50 });

    // Act
    const rows = DGA.computeRateOfChange(prev, curr, 1, null, DGA.EQUIPMENT_TYPES.MBA);
    const c2h2Row = rows.find((r) => r.gas === "C2H2");

    // Assert
    expect(c2h2Row.delta).toBe(49);
    expect(c2h2Row.ratePerYear).toBe(49 * 365); // 17885 ppm/year
    expect(c2h2Row.verdict).toContain("Vượt cận trên");
  });

  test("KPH Handling: gas below detection limit is not flagged as rapid rate", () => {
    // Arrange
    const prev = gases({ C2H2: 0 });
    const curr = gases({ C2H2: 0.1 });

    // Act
    const rows = DGA.computeRateOfChange(prev, curr, 30, null, DGA.EQUIPMENT_TYPES.MBA, ["C2H2"]);
    const c2h2Row = rows.find((r) => r.gas === "C2H2");

    // Assert
    expect(c2h2Row.isKph).toBe(true);
    expect(c2h2Row.ratePerYear).toBe(0);
    expect(c2h2Row.verdict).toContain("Dưới ngưỡng phát hiện (KPH)");
  });
});

describe("DGA TCG Rate of Change Edge Cases (computeTcgRateOfChange)", () => {
  test("handles deltaDays <= 0 by returning null", () => {
    // Arrange & Act & Assert
    expect(DGA.computeTcgRateOfChange(100, 150, 0)).toBeNull();
    expect(DGA.computeTcgRateOfChange(100, 150, -10)).toBeNull();
  });

  test("calculates monthly percentage rate when before > 0", () => {
    // Arrange: TCG increased from 100 to 120 (20% increase) in 30 days
    // Act
    const res = DGA.computeTcgRateOfChange(100, 120, 30);

    // Assert
    expect(res.before).toBe(100);
    expect(res.after).toBe(120);
    expect(res.delta).toBe(20);
    expect(res.ratePerMonth).toBe(20); // 20% / month
  });

  test("returns ratePerMonth = null when before = 0 to avoid division by zero", () => {
    // Arrange & Act
    const res = DGA.computeTcgRateOfChange(0, 50, 30);

    // Assert
    expect(res.ratePerMonth).toBeNull();
    expect(res.delta).toBe(50);
  });
});

describe("Total Dissolved Gas Concentration & Bang 63 (computeTotalDissolvedGasPercent & evaluateBang63)", () => {
  test("computeTotalDissolvedGasPercent: converts sum of all gases (including N2 & O2) from ppm to %", () => {
    // Arrange: 7 gases sum = 1,000 ppm, N2 = 50,000 ppm, O2 = 9,000 ppm -> Total = 60,000 ppm = 6.0%
    const g = gases({ H2: 500, CO: 300, CO2: 200 });
    const n2 = 50000;
    const o2 = 9000;

    // Act
    const percent = DGA.computeTotalDissolvedGasPercent(g, n2, o2);

    // Assert
    expect(percent).toBe(6.0);
  });

  test("computeTotalDissolvedGasPercent: returns null if either N2 or O2 is missing", () => {
    // Arrange & Act & Assert
    expect(DGA.computeTotalDissolvedGasPercent(gases(), null, 5000)).toBeNull();
    expect(DGA.computeTotalDissolvedGasPercent(gases(), 50000, undefined)).toBeNull();
  });

  test("evaluateBang63: checks boundary limits according to voltage class (500kV: < 0.5%, 110-220kV: < 1.0%)", () => {
    // Arrange & Act & Assert: >220 kV (500 kV) limit is 0.5%
    expect(DGA.evaluateBang63(0.4, "500", true).verdict).toBe("Đạt");
    expect(DGA.evaluateBang63(0.5, "500", true).verdict).toBe("Không đạt");
    expect(DGA.evaluateBang63(0.6, "500", true).verdict).toBe("Không đạt");

    // 110-220 kV limit is 1.0%
    expect(DGA.evaluateBang63(0.9, "110-220", true).verdict).toBe("Đạt");
    expect(DGA.evaluateBang63(1.0, "110-220", true).verdict).toBe("Không đạt");
    expect(DGA.evaluateBang63(1.2, "110-220", true).verdict).toBe("Không đạt");
  });

  test("evaluateBang63: handles non-applicable state gracefully", () => {
    // Arrange & Act
    const res = DGA.evaluateBang63(5.0, "500", false);

    // Assert
    expect(res.applicable).toBe(false);
    expect(res.verdict).toBeNull();
  });
});

describe("Additional Gas Ratios (diagnoseAdditionalRatios)", () => {
  test("O2/N2 ratio: detects oxidation / aging when O2/N2 < 0.3", () => {
    // Arrange: N2 = 50,000, O2 = 10,000 => O2/N2 = 0.2
    const g = gases({ CO: 100, CO2: 500 });

    // Act
    const res = DGA.diagnoseAdditionalRatios(g, 50000, 10000);

    // Assert
    expect(res.o2_n2).toBeCloseTo(0.2);
    expect(res.o2n2Note).toContain("O2/N2 < 0,3");
  });

  test("CO2/CO ratio: detects severe cellulose degradation when CO2/CO < 3 and CO > 1000", () => {
    // Arrange: CO = 1200, CO2 = 2400 => CO2/CO = 2.0
    const g = gases({ CO: 1200, CO2: 2400 });

    // Act
    const res = DGA.diagnoseAdditionalRatios(g, 40000, 15000);

    // Assert
    expect(res.co2_co).toBeCloseTo(2.0);
    expect(res.co2coNote).toContain("CO2/CO < 3 và CO > 1000 ppm");
  });

  test("Edge case: handles missing N2/O2 or 0 values without throwing errors", () => {
    // Arrange & Act
    const res = DGA.diagnoseAdditionalRatios(gases(), null, null);

    // Assert
    expect(res.o2_n2).toBeNull();
    expect(res.co2_co).toBeNull();
    expect(res.o2n2Note).toContain("Chưa nhập đủ N2/O2");
  });
});
