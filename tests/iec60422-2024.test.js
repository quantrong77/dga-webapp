/**
 * Unit Test Suite for IEC 60422:2024 Edition 5 (dga-logic-iec60422-2024.js)
 * Senior QA Engineer & Test Automation Specialist
 * Structure: AAA (Arrange - Act - Assert)
 * Coverage: Table 5 (MBA/Kháng Category A/B/C), Table 7 (TI/TU Category D/E), boundary conditions, edge cases
 */

const { DGA } = require("./helpers");

describe("IEC 60422:2024 — Category Mapping (Voltage Class Mapping)", () => {
  test("mapOilVoltageClassToIec60422Category: maps MBA voltage classes to Category A, B, C", () => {
    // Arrange & Act & Assert
    expect(DGA.mapOilVoltageClassToIec60422Category("500")).toBe("A");
    expect(DGA.mapOilVoltageClassToIec60422Category("220")).toBe("A");
    expect(DGA.mapOilVoltageClassToIec60422Category("110")).toBe("B");
    expect(DGA.mapOilVoltageClassToIec60422Category("tren35duoi110")).toBe("C");
    expect(DGA.mapOilVoltageClassToIec60422Category("15den35")).toBe("C");
    expect(DGA.mapOilVoltageClassToIec60422Category("duoi15")).toBe("C");
  });

  test("Edge case: unknown or invalid voltage class defaults to Category C", () => {
    // Arrange & Act & Assert
    expect(DGA.mapOilVoltageClassToIec60422Category(null)).toBe("C");
    expect(DGA.mapOilVoltageClassToIec60422Category(undefined)).toBe("C");
    expect(DGA.mapOilVoltageClassToIec60422Category("UNKNOWN_KV")).toBe("C");
    expect(DGA.mapOilVoltageClassToIec60422Category("")).toBe("C");
  });

  test("resolveIec60422TituCategory: maps umKv to Category D (>170kV) or E (≤170kV)", () => {
    // Arrange & Act & Assert
    expect(DGA.resolveIec60422TituCategory(500)).toBe("D");
    expect(DGA.resolveIec60422TituCategory("220")).toBe("D");
    expect(DGA.resolveIec60422TituCategory(171)).toBe("D");
    expect(DGA.resolveIec60422TituCategory(170)).toBe("E");
    expect(DGA.resolveIec60422TituCategory("110")).toBe("E");
    expect(DGA.resolveIec60422TituCategory(35)).toBe("E");
  });

  test("resolveIec60422TituCategory: edge case returns null when umKv is missing/null/undefined/empty", () => {
    // Arrange & Act & Assert
    expect(DGA.resolveIec60422TituCategory(null)).toBeNull();
    expect(DGA.resolveIec60422TituCategory(undefined)).toBeNull();
    expect(DGA.resolveIec60422TituCategory("")).toBeNull();
  });
});

describe("IEC 60422:2024 — Table 5 (evaluateIec60422MbaOilTest)", () => {
  const row = (res, key) => res.rows.find((r) => r.key === key);

  test("Category A (>170kV): Boundary test for all parameters (Tốt / Cần theo dõi / Kém)", () => {
    // Arrange: Category A (>170kV: 220kV or 500kV)
    // BDV: good >= 60, poor < 50
    // Moisture: good <= 15, poor > 20
    // TgD 90°C: good <= 10, poor > 20

    // Act: Test 'Tốt' (Đạt)
    const goodRes = DGA.evaluateIec60422MbaOilTest({
      voltageClass: "220",
      bdv: 60,       // exactly on boundary 60 => Đạt
      moisture: 15,  // exactly on boundary 15 => Đạt
      tgd90: 10,     // exactly on boundary 10 => Đạt
    });

    // Assert 'Tốt'
    expect(row(goodRes, "bdv").verdict).toBe("Đạt");
    expect(row(goodRes, "moisture").verdict).toBe("Đạt");
    expect(row(goodRes, "tgd90").verdict).toBe("Đạt");
    expect(goodRes.overall).toBe("Đạt");

    // Act: Test 'Cần theo dõi' (Cảnh báo)
    const fairRes = DGA.evaluateIec60422MbaOilTest({
      voltageClass: "220",
      bdv: 55,       // between 50 and 60
      moisture: 18,  // between 15 and 20
      tgd90: 15,     // between 10 and 20
    });

    // Assert 'Cần theo dõi'
    expect(row(fairRes, "bdv").verdict).toBe("Cảnh báo");
    expect(row(fairRes, "moisture").verdict).toBe("Cảnh báo");
    expect(row(fairRes, "tgd90").verdict).toBe("Cảnh báo");
    expect(fairRes.overall).toBe("Cảnh báo");

    // Act: Test 'Kém' (Không đạt)
    const poorRes = DGA.evaluateIec60422MbaOilTest({
      voltageClass: "220",
      bdv: 49.9,     // < 50 => Không đạt
      moisture: 20.1, // > 20 => Không đạt
      tgd90: 20.1,    // > 20 => Không đạt
    });

    // Assert 'Kém'
    expect(row(poorRes, "bdv").verdict).toBe("Không đạt");
    expect(row(poorRes, "moisture").verdict).toBe("Không đạt");
    expect(row(poorRes, "tgd90").verdict).toBe("Không đạt");
    expect(poorRes.overall).toBe("Không đạt");
  });

  test("Category B (72.5–170kV): verifies distinct thresholds (BDV 50/40, Moisture 20/30, TgD 10/50)", () => {
    // Arrange & Act
    const res = DGA.evaluateIec60422MbaOilTest({
      voltageClass: "110",
      bdv: 52,        // >= 50 => Đạt
      moisture: 25,   // between 20 and 30 => Cảnh báo
      tgd90: 45,      // between 10 and 50 => Cảnh báo
    });

    // Assert
    expect(res.category).toBe("B");
    expect(row(res, "bdv").verdict).toBe("Đạt");
    expect(row(res, "moisture").verdict).toBe("Cảnh báo");
    expect(row(res, "tgd90").verdict).toBe("Cảnh báo");
    expect(res.overall).toBe("Cảnh báo");
  });

  test("Category C (≤72.5kV): verifies thresholds (BDV 40/30, Moisture 30/40, TgD 10/50)", () => {
    // Arrange & Act
    const res = DGA.evaluateIec60422MbaOilTest({
      voltageClass: "15den35",
      bdv: 29.9,      // < 30 => Không đạt
      moisture: 35,   // between 30 and 40 => Cảnh báo
      tgd90: 8,       // <= 10 => Đạt
    });

    // Assert
    expect(res.category).toBe("C");
    expect(row(res, "bdv").verdict).toBe("Không đạt");
    expect(row(res, "moisture").verdict).toBe("Cảnh báo");
    expect(row(res, "tgd90").verdict).toBe("Đạt");
    expect(res.overall).toBe("Không đạt"); // Worst case wins
  });

  test("Edge case: empty data returns 'Chưa đủ dữ liệu' and 0 rows", () => {
    // Arrange & Act
    const res = DGA.evaluateIec60422MbaOilTest({ voltageClass: "220" });

    // Assert
    expect(res.overall).toBe("Chưa đủ dữ liệu");
    expect(res.rows).toHaveLength(0);
  });

  test("Edge case: single parameter evaluation works and evaluates overall verdict correctly", () => {
    // Arrange & Act
    const res = DGA.evaluateIec60422MbaOilTest({ voltageClass: "220", bdv: 65 });

    // Assert
    expect(res.rows).toHaveLength(1);
    expect(res.overall).toBe("Đạt");
  });

  test("Edge case: zero values are evaluated numerically, not treated as empty", () => {
    // Arrange & Act
    const res = DGA.evaluateIec60422MbaOilTest({ voltageClass: "220", moisture: 0, bdv: 0 });

    // Assert
    expect(row(res, "moisture").verdict).toBe("Đạt"); // 0 <= 15
    expect(row(res, "bdv").verdict).toBe("Không đạt");  // 0 < 50
    expect(res.overall).toBe("Không đạt");
  });
});

describe("IEC 60422:2024 — Table 7 (evaluateIec60422TituOilTest)", () => {
  const row = (res, key) => res.rows.find((r) => r.key === key);

  test("Category D (TI/TU > 170kV): evaluates moisture and tgD with Table 7, BDV with Table 5 inferred", () => {
    // Arrange: Category D (umKv > 170)
    // Moisture: good <= 20, poor > 30
    // TgD 90°C: good <= 1.0, poor > 10
    // Inferred BDV (Cat A): good >= 60, poor < 50

    // Act
    const res = DGA.evaluateIec60422TituOilTest({
      umKv: 220,
      moisture: 18,  // <= 20 => Đạt
      tgd90: 0.8,    // <= 1.0 => Đạt
      bdv: 62,       // >= 60 => Đạt
    });

    // Assert
    expect(res.category).toBe("D");
    expect(row(res, "moisture").verdict).toBe("Đạt");
    expect(row(res, "tgd90").verdict).toBe("Đạt");
    expect(row(res, "bdv").verdict).toBe("Đạt");
    expect(row(res, "bdv").label).toContain("(suy diễn)");
    expect(res.overall).toBe("Đạt");
  });

  test("Category E (TI/TU ≤ 170kV): evaluates moisture (30/40), tgD (10/30), inferred BDV (50/40)", () => {
    // Arrange & Act
    const res = DGA.evaluateIec60422TituOilTest({
      umKv: 110,
      moisture: 35,  // between 30 and 40 => Cảnh báo
      tgd90: 32,     // > 30 => Không đạt
      bdv: 45,       // between 40 and 50 => Cảnh báo
    });

    // Assert
    expect(res.category).toBe("E");
    expect(row(res, "moisture").verdict).toBe("Cảnh báo");
    expect(row(res, "tgd90").verdict).toBe("Không đạt");
    expect(row(res, "bdv").verdict).toBe("Cảnh báo");
    expect(res.overall).toBe("Không đạt");
  });

  test("Edge case: missing umKv returns overall 'Chưa có cấp điện áp Um' and empty rows", () => {
    // Arrange & Act
    const res = DGA.evaluateIec60422TituOilTest({
      umKv: null,
      moisture: 15,
      bdv: 60,
    });

    // Assert
    expect(res.category).toBeNull();
    expect(res.overall).toBe("Chưa có cấp điện áp Um");
    expect(res.rows).toHaveLength(0);
  });
});
