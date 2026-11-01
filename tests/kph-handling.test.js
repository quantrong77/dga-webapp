const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadExtractGasValues() {
  const code = fs.readFileSync(path.join(__dirname, "..", "bbtn", "bbtn-import.js"), "utf8");
  // Extract GAS_LINE_PATTERNS, KPH_PATTERN, and extractGasValues
  const m1 = code.indexOf("const GAS_LINE_PATTERNS =");
  const m2 = code.indexOf("// Các trường \"Thông số kỹ thuật");
  const subCode = code.slice(m1, m2);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(subCode + "\nthis.extractGasValues = extractGasValues;", sandbox);
  return sandbox.extractGasValues;
}

const extractGasValues = loadExtractGasValues();

describe("BbtnImport.extractGasValues — Nhận diện KPH và số liệu khí", () => {
  test("trích số bình thường khi có số liệu", () => {
    const lines = [
      "1 Hydrogen H2 ppm 12.5 < 300 0.5% Đạt",
      "2 Methane CH4 ppm 9.703 < 30 0% Đạt",
      "3 Ethan C2H6 ppm 13.241 < 25 Đạt",
      "4 Ethylen C2H4 ppm 1.483 < 4 Đạt",
      "5 Acetylen C2H2 ppm 0 < 1 Đạt",
      "6 CarbonMonoxit CO ppm 97.798 < 330 Đạt",
      "7 Carbondioxit CO2 ppm 192.679 < 900 Đạt",
    ];
    const res = extractGasValues(lines);
    expect(res.H2).toBe(12.5);
    expect(res.CH4).toBe(9.703);
    expect(res.C2H6).toBe(13.241);
    expect(res.C2H4).toBe(1.483);
    expect(res.C2H2).toBe(0);
    expect(res.CO).toBe(97.798);
    expect(res.CO2).toBe(192.679);
  });

  test("nhận diện KPH và KHÔNG đọc số trong cột Tiêu chuẩn (< 1, ≤ 1, 1, 300...)", () => {
    const lines = [
      "1 Hydrogen H2 ppm KPH < 300 Đạt",
      "2 Methane CH4 ppm KPH ≤ 30 Đạt",
      "3 Ethan C2H6 ppm kph < 25 Đạt",
      "4 Ethylen C2H4 ppm K.P.H <= 4 Đạt",
      "5 Acetylen C2H2 ppm KPH ≤ 1 0% Đạt",
      "6 CarbonMonoxit CO ppm Không phát hiện < 330 Đạt",
      "7 Carbondioxit CO2 ppm < LOD < 900 Đạt",
    ];
    const res = extractGasValues(lines);
    expect(res.H2).toBe("KPH");
    expect(res.CH4).toBe("KPH");
    expect(res.C2H6).toBe("KPH");
    expect(res.C2H4).toBe("KPH");
    expect(res.C2H2).toBe("KPH");
    expect(res.CO).toBe("KPH");
    expect(res.CO2).toBe("KPH");
  });

  test("trường hợp C2H2 ghi KPH nhưng cột Tiêu chuẩn ghi 1 (không có dấu < hay ≤)", () => {
    const lines = [
      "5 Acetylen C2H2 ppm KPH 1 Đạt",
    ];
    const res = extractGasValues(lines);
    expect(res.C2H2).toBe("KPH"); // Không được đọc nhầm thành 1
  });

  test("trường hợp hỗn hợp: một số khí có số liệu, C2H2 ghi KPH", () => {
    const lines = [
      "1 Hydrogen H2 ppm 15.2 < 300 0.5% Đạt",
      "2 Methane CH4 ppm 8.0 < 30 0% Đạt",
      "3 Ethan C2H6 ppm 5.5 < 25 Đạt",
      "4 Ethylen C2H4 ppm 2.1 < 4 Đạt",
      "5 Acetylen C2H2 ppm KPH < 1 Đạt",
      "6 CarbonMonoxit CO ppm 110 < 330 Đạt",
      "7 Carbondioxit CO2 ppm 350 < 900 Đạt",
    ];
    const res = extractGasValues(lines);
    expect(res.H2).toBe(15.2);
    expect(res.CH4).toBe(8.0);
    expect(res.C2H6).toBe(5.5);
    expect(res.C2H4).toBe(2.1);
    expect(res.C2H2).toBe("KPH");
    expect(res.CO).toBe(110);
    expect(res.CO2).toBe(350);
  });

  test("trích được cả N2 và O2 nếu có trong biên bản", () => {
    const lines = [
      "8 Nitơ N2 ppm 14500",
      "9 Oxy O2 ppm 5200",
    ];
    const res = extractGasValues(lines);
    expect(res.N2).toBe(14500);
    expect(res.O2).toBe(5200);
  });
});

const { DGA } = require("./helpers");
const BbtnExport = require("../bbtn/bbtn-export.js");

describe("DGA Logic — Xử lý các khí dưới ngưỡng phát hiện (KPH)", () => {
  const limits = { H2: 300, CH4: 30, C2H6: 25, C2H4: 4, C2H2: 1, CO: 330, CO2: 900 };

  test("evaluateAbsolute: khí KPH được đánh dấu isKph và kết luận Đạt", () => {
    const gases = { H2: 10, CH4: 5, C2H6: 3, C2H4: 2, C2H2: 0, CO: 100, CO2: 200 };
    const kphGases = { C2H2: true };
    const evalRows = DGA.evaluateAbsolute(gases, limits, kphGases);
    const c2h2Row = evalRows.find((r) => r.gas === "C2H2");
    expect(c2h2Row.isKph).toBe(true);
    expect(c2h2Row.verdict).toBe("Đạt");
  });

  test("diagnoseGasFault: khi có khí KPH và không có khí vượt điển hình thì trả về 'Không áp dụng'", () => {
    const gases = { H2: 10, CH4: 5, C2H6: 3, C2H4: 2, C2H2: 0, CO: 100, CO2: 200 };
    const kphGases = { C2H2: true };
    const diag = DGA.diagnoseGasFault(gases, DGA.EQUIPMENT_TYPES.MBA, undefined, kphGases);
    expect(diag).toContain("Không áp dụng");

    // computeOverallStatus không bị kích hoạt đổi mã lỗi báo động nhầm khi chẩn đoán là "Không áp dụng"
    const status = DGA.computeOverallStatus({
      overallOk: true,
      exceedCount: 0,
      diagnosis: diag,
      priorDiagnosis: "PD — Phóng điện cục bộ (Bảng 66)",
      rateRows: [],
      condemningRows: [],
    });
    expect(status.level).toBe("normal");
  });

  test("diagnoseDuval1: khi C2H2 và C2H4 đều KPH thì trả về null (không gán nhầm sang PD)", () => {
    const gases = { H2: 10, CH4: 20, C2H6: 5, C2H4: 0, C2H2: 0, CO: 100, CO2: 200 };
    const kphGases = { C2H2: true, C2H4: true };
    const duval = DGA.diagnoseDuval1(gases, kphGases);
    expect(duval).toBeNull();
  });

  test("computeRateOfChange: khí KPH có isKph = true, ratePerMonth = null và verdict ghi rõ KPH", () => {
    const prev = { H2: 10, CH4: 5, C2H6: 3, C2H4: 2, C2H2: 0, CO: 100, CO2: 200 };
    const curr = { H2: 12, CH4: 6, C2H6: 3, C2H4: 2, C2H2: 0, CO: 110, CO2: 210 };
    const kphGases = { C2H2: true };
    const rateRows = DGA.computeRateOfChange(prev, curr, 30, DGA.RATE_RANGES, DGA.EQUIPMENT_TYPES.MBA, kphGases);
    const c2h2Rate = rateRows.find((r) => r.gas === "C2H2");
    expect(c2h2Rate.isKph).toBe(true);
    expect(c2h2Rate.ratePerMonth).toBeNull();
    expect(c2h2Rate.verdict).toContain("KPH");
  });
});

describe("BbtnExport — Xuất biên bản khi có khí KPH", () => {
  test("buildBbtnExportData điền đúng KPH, trống tốc độ sinh khí và Đạt", () => {
    const gases = { H2: 10, CH4: 5, C2H6: 3, C2H4: 2, C2H2: 0, CO: 100, CO2: 200 };
    const limits = { H2: 300, CH4: 30, C2H6: 25, C2H4: 4, C2H2: 1, CO: 330, CO2: 900 };
    const kphGases = { C2H2: true };
    const evalRows = DGA.evaluateAbsolute(gases, limits, kphGases);
    const data = BbtnExport.buildBbtnExportData({
      measurement: { thiet_bi: "AT1", sample_date: "2026-11-01" },
      tcg: 320,
      evalRows,
      kphGases,
      overallStatus: { label: "Bình thường" },
    });
    expect(data.c2h2_kq).toBe("KPH");
    expect(data.c2h2_toc).toBe("");
    expect(data.c2h2_dg).toBe("Đạt");
    expect(data.h2_kq).toBe("10");
  });

  test("bbtnBuildKetLuan không đưa câu 'Không áp dụng' vào kết luận văn bản", () => {
    const ketLuan = BbtnExport.bbtnBuildKetLuan({
      overallStatus: { label: "Bình thường" },
      overall: "Đạt",
      standard: { label: "QĐ 1901/QĐ-EVNNPT" },
      diagnosis: "Không áp dụng (các khí đều trong khoảng điển hình / dưới ngưỡng phát hiện)",
    });
    expect(ketLuan).toContain("Bình thường.");
    expect(ketLuan).not.toContain("Không áp dụng");
  });
});
