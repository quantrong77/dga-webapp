/**
 * Unit Test Suite for bbtn/tech-report-export.js
 * Senior QA Engineer & Test Automation Specialist
 * Structure: AAA (Arrange - Act - Assert)
 * Coverage: buildTechReportData mapping, placeholders, edge cases, condemn text
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { DGA } = require("./helpers");

function loadTechReportModule() {
  const code = fs.readFileSync(path.join(__dirname, "../bbtn/tech-report-export.js"), "utf8");
  const ctx = {
    DGA,
    window: {},
    fetch: jest.fn(),
    URL: { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() },
    document: { createElement: jest.fn(() => ({ click: jest.fn(), remove: jest.fn() })), body: { appendChild: jest.fn() } },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

describe("tech-report-export: buildTechReportData (Report Data Formatting)", () => {
  let mod;
  beforeAll(() => {
    mod = loadTechReportModule();
  });

  test("Arrange/Act/Assert: formats complete analysis into Docx template placeholders", () => {
    // Arrange
    const mockAnalysis = {
      measurement: {
        tram: "Trạm 500kV Đắk Nông",
        thiet_bi: "AT2",
        equipment_type: "MBA",
        pha: "B",
        manufacturer: "ABB",
        kieu_may: "ODAF",
        nam_sx: 2018,
        nam_van_hanh: 2019,
        dien_ap_dm: "500 kV",
        so_che_tao: "SN-987654",
        loai_dau: "Dầu khoáng",
        ket_cau_cach_dien: "Màng cao su",
        hien_trang_van_hanh: "Bình thường",
        sample_date: "2026-10-15",
        lan_do: 3,
      },
      standard: {
        sourceLabel: "QĐ 1901/EVNNPT Bảng 64",
        pdThreshold: 100,
      },
      tcg: 245.678,
      ratios: {
        c2h2_c2h4: 0.1234,
        ch4_h2: 1.5678,
        c2h4_c2h6: 2.3456,
      },
      applicability: "Áp dụng được tỷ số khí",
      overallStatus: {
        label: "Cảnh báo cấp 1",
        reasons: ["H2 vượt ngưỡng 100 ppm", "C2H2 xuất hiện"],
        action: "Rút ngắn chu kỳ lấy mẫu xuống 1 tháng",
      },
      diagnosis: "T2 - Quá nhiệt nhiệt độ trung bình",
      duval: {
        zone: "T2",
        label: "Quá nhiệt (300°C < T < 700°C)",
      },
      recs: ["Theo dõi chặt chẽ tải máy biến áp", "Đo lại DGA sau 30 ngày"],
      evalRows: [
        { gas: "H2", value: 120, limit: 100, verdict: "Vượt ngưỡng" },
        { gas: "CH4", value: 40, limit: 120, verdict: "Bình thường" },
        { gas: "C2H6", value: 25, limit: 65, verdict: "Bình thường" },
        { gas: "C2H4", value: 50, limit: 50, verdict: "Bình thường" },
        { gas: "C2H2", value: 5, limit: 2, verdict: "Vượt ngưỡng" },
        { gas: "CO", value: 200, limit: 350, verdict: "Bình thường" },
        { gas: "CO2", value: 1800, limit: 2500, verdict: "Bình thường" },
      ],
      condemningRows: [
        { gas: "C2H2", value: 5, limit: 35, verdict: "Bình thường" },
      ],
    };

    // Act
    const data = mod.buildTechReportData(mockAnalysis);

    // Assert
    expect(data.tram).toBe("Trạm 500kV Đắk Nông");
    expect(data.thiet_bi).toBe("AT2");
    expect(data.pha_label).toBe("Pha B");
    expect(data.ngay_lay_mau).toBe("15/10/2026");
    expect(data.tcg).toBe("245.7"); // toFixed(1)
    expect(data.ratio1).toBe("0.123");
    expect(data.ratio2).toBe("1.568");
    expect(data.ratio3).toBe("2.346");
    expect(data.diag_ma).toBe("T2 - Quá nhiệt nhiệt độ trung bình");
    expect(data.duval_zone).toBe("T2");
    expect(data.reasons_text).toContain("- H2 vượt ngưỡng 100 ppm");
    expect(data.recs_text).toContain("- Theo dõi chặt chẽ tải máy biến áp");
    expect(data.h2_kq).toBe("120");
    expect(data.h2_tc).toBe("100");
    expect(data.h2_dg).toBe("Vượt ngưỡng");
    expect(data.condemn_text).toBe(""); // Not exceeded
  });

  test("Condemning limits: generates alert message when manufacturer limits are exceeded", () => {
    // Arrange
    const mockAnalysis = {
      measurement: { thiet_bi: "MBA-T1" },
      condemningRows: [
        { gas: "C2H2", value: 45, limit: 35, exceeded: true },
        { gas: "H2", value: 1500, limit: 1000, exceeded: true },
      ],
    };

    // Act
    const data = mod.buildTechReportData(mockAnalysis);

    // Assert
    expect(data.condemn_text).toContain("⚠ VƯỢT NGƯỠNG LOẠI BỎ (do nhà sản xuất quy định) ở 2 khí:");
    expect(data.condemn_text).toContain("C2H2 (45 > 35 ppm)");
    expect(data.condemn_text).toContain("H2 (1500 > 1000 ppm)");
  });

  test("Edge case: handles empty analysis object without throwing exceptions", () => {
    // Arrange
    const emptyAnalysis = {};

    // Act
    const data = mod.buildTechReportData(emptyAnalysis);

    // Assert
    expect(data.tram).toBe("");
    expect(data.thiet_bi).toBe("");
    expect(data.nam_sx).toBe("—");
    expect(data.tcg).toBe("—");
    expect(data.ratio1).toBe("—");
    expect(data.trang_thai).toBe("—");
    expect(data.condemn_text).toBe("");
    expect(data.h2_kq).toBe("");
    expect(data.h2_tc).toBe("—");
  });
});
