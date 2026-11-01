const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBbtnHelpers() {
  const code = fs.readFileSync(path.join(__dirname, "..", "bbtn", "bbtn-import.js"), "utf8");
  const m1 = code.indexOf("const VN_DIACRITICS_RE =");
  const m2 = code.indexOf("// Các trường \"Thông số kỹ thuật");
  const subCode = code.slice(m1, m2);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    subCode +
    "\nthis.stripVnDiacritics = stripVnDiacritics;" +
    "\nthis.extractGasValues = extractGasValues;" +
    "\nthis.extractSoCheTao = extractSoCheTao;" +
    "\nthis.extractLoaiDau = extractLoaiDau;",
    sandbox
  );
  return sandbox;
}

const { stripVnDiacritics, extractGasValues, extractSoCheTao, extractLoaiDau } = loadBbtnHelpers();

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
    expect(res.C2H2).toBe("KPH");
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

  test("trích được cả N2 và O2 với các định dạng khác nhau (có ngoặc, không ngoặc, tiếng Anh/Việt)", () => {
    // Dạng chuẩn không ngoặc
    const lines1 = [
      "8 Nitơ N2 ppm 14500",
      "9 Oxy O2 ppm 5200",
    ];
    const res1 = extractGasValues(lines1);
    expect(res1.N2).toBe(14500);
    expect(res1.O2).toBe(5200);

    // Dạng có ngoặc đơn (N2), (O2)
    const lines2 = [
      "8. Nitơ (N2) ppm 14500 < 15000",
      "9. Oxy (O2) ppm 5200 < 6000",
    ];
    const res2 = extractGasValues(lines2);
    expect(res2.N2).toBe(14500);
    expect(res2.O2).toBe(5200);

    // Dạng rút gọn chỉ ghi N2, O2
    const lines3 = [
      "8. N2 ppm 13800",
      "9. O2 ppm 4900",
    ];
    const res3 = extractGasValues(lines3);
    expect(res3.N2).toBe(13800);
    expect(res3.O2).toBe(4900);

    // Dạng tiếng Anh Nitrogen, Oxygen
    const lines4 = [
      "8. Nitrogen (N2) ppm 14200",
      "9. Oxygen (O2) ppm 5100",
    ];
    const res4 = extractGasValues(lines4);
    expect(res4.N2).toBe(14200);
    expect(res4.O2).toBe(5100);

    // Dạng KPH cho N2 / O2
    const lines5 = [
      "8. Nitơ N2 ppm KPH < 15000",
      "9. Oxy (O2) ppm KPH < 6000",
    ];
    const res5 = extractGasValues(lines5);
    expect(res5.N2).toBe("KPH");
    expect(res5.O2).toBe("KPH");
  });
});

describe("BbtnImport — Tự động đọc Loại dầu và Số chế tạo", () => {
  test("trích Loại dầu từ các dòng thông tin khác nhau", () => {
    const l1 = ["Loại dầu (Type ): Nynas Nytro 10XN Ngày lấy mẫu (Date): 1 5 /09/2026"];
    expect(extractLoaiDau(l1, l1.map(stripVnDiacritics))).toBe("Nynas Nytro 10XN");

    const l2 = ["Loại dầu: Dầu khoáng"];
    expect(extractLoaiDau(l2, l2.map(stripVnDiacritics))).toBe("Dầu khoáng");

    const l3 = ["Loại dầu cách điện: Shell Diala S4 ZX-I Ngày lấy mẫu: 10/10/2026"];
    expect(extractLoaiDau(l3, l3.map(stripVnDiacritics))).toBe("Shell Diala S4 ZX-I");

    const l4 = ["Chủng loại dầu (Oil type): Ergon Hyvolt II  Lý do thí nghiệm: Định kỳ"];
    expect(extractLoaiDau(l4, l4.map(stripVnDiacritics))).toBe("Ergon Hyvolt II");

    // Dạng bảng ô ở hàng dưới
    const l5 = ["Loại dầu (Type):", "Nynas Nytro 10XN"];
    expect(extractLoaiDau(l5, l5.map(stripVnDiacritics))).toBe("Nynas Nytro 10XN");

    // Dòng tiêu đề biên bản không bị nhận nhầm là loại dầu
    const l6 = [
      "BIÊN BẢN THÍ NGHIỆM DẦU CÁCH ĐIỆN",
      "(Insulation oil test report)",
      "Loại dầu (Type ): Nynas Nytro 10XN Ngày lấy mẫu (Date): 15/09/2026",
    ];
    expect(extractLoaiDau(l6, l6.map(stripVnDiacritics))).toBe("Nynas Nytro 10XN");
  });

  test("trích Số chế tạo đơn lẻ và phân tách theo từng pha", () => {
    // Đơn lẻ
    const l1 = ["Số chế tạo (Serial No): 123456 Năm vận hành: 2018"];
    expect(extractSoCheTao(l1, l1.map(stripVnDiacritics), null)).toBe("123456");

    const l2 = ["Số chế tạo (Serial No): 123456 Năm đưa vào vận hành (Year of operation): 2018"];
    expect(extractSoCheTao(l2, l2.map(stripVnDiacritics), null)).toBe("123456");

    const l3 = ["Số chế tạo: MBA-AT1-2022"];
    expect(extractSoCheTao(l3, l3.map(stripVnDiacritics), null)).toBe("MBA-AT1-2022");

    // 3 pha: tách đúng pha yêu cầu
    const l4 = [
      "Số chế tạo (Serial No): p ha A: 16019123/1, p ha B: 16019123 /4, Năm vận hành (Year of operation): 20 17",
      "p ha C: 16019123 /5",
    ];
    expect(extractSoCheTao(l4, l4.map(stripVnDiacritics), "A")).toBe("16019123/1");
    expect(extractSoCheTao(l4, l4.map(stripVnDiacritics), "B")).toBe("16019123/4");
    expect(extractSoCheTao(l4, l4.map(stripVnDiacritics), "C")).toBe("16019123/5");

    // Khi không chỉ định pha cụ thể: gộp các pha rõ ràng
    expect(extractSoCheTao(l4, l4.map(stripVnDiacritics), null)).toBe("Pha A: 16019123/1, Pha B: 16019123/4, Pha C: 16019123/5");

    // Dạng ô nhãn ở hàng trên, số ở hàng dưới
    const l5 = [
      "Số chế tạo (Serial No): Năm vận hành: 2017",
      "7891011",
    ];
    expect(extractSoCheTao(l5, l5.map(stripVnDiacritics), null)).toBe("7891011");
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
