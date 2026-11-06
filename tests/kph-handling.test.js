const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBbtnHelpers() {
  const code = fs.readFileSync(path.join(__dirname, "..", "src", "data", "io", "bbtn-import.js"), "utf8");
  const m1 = code.indexOf("const VN_DIACRITICS_RE =");
  const m2 = code.indexOf("// Các trường \"Thông số kỹ thuật");
  const subCode = code.slice(m1, m2);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    subCode +
    "\nthis.stripVnDiacritics = stripVnDiacritics;" +
    "\nthis.guessDoAm = guessDoAm;" +
    "\nthis.guessNhietDo = guessNhietDo;" +
    "\nthis.extractGasValues = extractGasValues;" +
    "\nthis.extractSoCheTao = extractSoCheTao;" +
    "\nthis.extractLoaiDau = extractLoaiDau;" +
    "\nthis.extractDienApDm = extractDienApDm;" +
    "\nthis.mapVoltageToBang63Class = mapVoltageToBang63Class;",
    sandbox
  );
  return sandbox;
}

const { stripVnDiacritics, guessDoAm, guessNhietDo, extractGasValues, extractSoCheTao, extractLoaiDau, extractDienApDm, mapVoltageToBang63Class } = loadBbtnHelpers();

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

  test("trường hợp H2 là KPH nhưng có STT 1 hoặc tỷ số CH4/H2: 1.0 không bị đọc nhầm là 1", () => {
    const docLines = [
      "CÁC HẠNG MỤC ĐÃ THÍ NGHIỆM:",
      "1. Hydrogen H2 1",
      "2. Methane CH4 1",
      "KẾT QUẢ THÍ NGHIỆM (TESTING RESULTS):",
      "1 Hydro (H2) ppm KPH < 300 Đạt",
      "2 Metan (CH4) ppm 8.5 < 30 Đạt",
      "3 Ethan (C2H6) ppm 4.2 < 25 Đạt",
      "4 Ethylen (C2H4) ppm 2.0 < 4 Đạt",
      "5 Acetylen (C2H2) ppm KPH < 1 Đạt",
      "6 Carbon Monoxit (CO) ppm 85 < 330 Đạt",
      "7 Carbon Dioxit (CO2) ppm 320 < 900 Đạt",
      "TỶ SỐ KHÍ (GAS RATIOS):",
      "CH4/H2: 1.0",
      "C2H2/C2H4: 0.1",
      "C2H4/C2H6: 0.48",
      "THIẾT BỊ THÍ NGHIỆM: GC-2014 S/N 1",
    ];
    const res = extractGasValues(docLines);
    expect(res.H2).toBe("KPH");
    expect(res.CH4).toBe(8.5);
    expect(res.C2H6).toBe(4.2);
    expect(res.C2H4).toBe(2.0);
    expect(res.C2H2).toBe("KPH");
    expect(res.CO).toBe(85);
    expect(res.CO2).toBe(320);
  });

  test("trường hợp H2 hoặc C2H2 dưới ngưỡng phát hiện ghi < 1, < 1 < 300, < 0.1, hoặc '-' được đọc là KPH", () => {
    // 2 dấu < (kết quả < 1, tiêu chuẩn < 300)
    const l1 = [
      "BẢNG KẾT QUẢ THÍ NGHIỆM",
      "1 Hydro (H2) ppm < 1 < 300 Đạt",
      "2 Metan (CH4) ppm 5.0 < 30 Đạt",
      "5 Acetylen (C2H2) ppm < 0.1 < 1 Đạt",
      "CH4/H2: 1.0",
    ];
    const res1 = extractGasValues(l1);
    expect(res1.H2).toBe("KPH");
    expect(res1.CH4).toBe(5.0);
    expect(res1.C2H2).toBe("KPH");

    // Chỉ có 1 dấu < 1 Đạt
    const l2 = [
      "1 Hydro H2 ppm < 1 Đạt",
      "5 Axetilen C2H2 ppm < 0.1 Đạt",
    ];
    const res2 = extractGasValues(l2);
    expect(res2.H2).toBe("KPH");
    expect(res2.C2H2).toBe("KPH");

    // Dấu gạch ngang "-"
    const l3 = [
      "1 Hydro H2 ppm - < 300 Đạt",
      "5 Acetylen C2H2 ppm — < 1 Đạt",
    ];
    const res3 = extractGasValues(l3);
    expect(res3.H2).toBe("KPH");
    expect(res3.C2H2).toBe("KPH");
  });

  test("trường hợp H2 có giá trị đo thật 1.0 thì vẫn đọc đúng số liệu 1.0", () => {
    const l = [
      "1 Hydro H2 ppm 1.0 < 300 Đạt",
      "2 Metan CH4 ppm 1 < 30 Đạt",
    ];
    const res = extractGasValues(l);
    expect(res.H2).toBe(1.0);
    expect(res.CH4).toBe(1);
  });
});

describe("BbtnImport — Tự động đọc Độ ẩm môi trường và Nhiệt độ", () => {
  test("trích độ ẩm môi trường từ nhiều dạng biểu diễn khác nhau", () => {
    const h1 = "Điều kiện môi trường (Ambient condition): t (Temp.) = 29 ºC , Độ ẩm (Humidity) = 78 %";
    expect(guessDoAm(stripVnDiacritics(h1))).toBe(78);

    const h2 = "Độ ẩm môi trường: 62 %";
    expect(guessDoAm(stripVnDiacritics(h2))).toBe(62);

    const h3 = "Độ ẩm: 65%";
    expect(guessDoAm(stripVnDiacritics(h3))).toBe(65);

    const h4 = "Humidity: 70%";
    expect(guessDoAm(stripVnDiacritics(h4))).toBe(70);

    const h5 = "Độ ẩm môi trường: 60";
    expect(guessDoAm(stripVnDiacritics(h5))).toBe(60);

    const h6 = "Độ ẩm MT = 58.5 %";
    expect(guessDoAm(stripVnDiacritics(h6))).toBe(58.5);
  });

  test("trích nhiệt độ môi trường", () => {
    const t1 = "Điều kiện môi trường (Ambient condition): t (Temp.) = 29 ºC , Độ ẩm (Humidity) = 78 %";
    expect(guessNhietDo(stripVnDiacritics(t1))).toBe(29);

    const t2 = "Nhiệt độ: 31.5 °C";
    expect(guessNhietDo(stripVnDiacritics(t2))).toBe(31.5);
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

  test("trích Điện áp định mức từ các dòng định dạng khác nhau", () => {
    // Tiêu chuẩn có nhãn Rated voltage và stop trước Công suất
    const l1 = ["Điện áp định mức (Rated voltage): 550 kV Công suất (Rated power): 15-15-30-30-30-30-15-15"];
    expect(extractDienApDm(l1, l1.map(stripVnDiacritics))).toBe("550 kV");

    // Lỗi font/OCR tách rời các chữ số: "5 5 0 kV" -> "550 kV"
    const l2 = ["Điện áp định mức (Rated voltage): 5 5 0 kV Công suất: 15VA"];
    expect(extractDienApDm(l2, l2.map(stripVnDiacritics))).toBe("550 kV");

    // Điện áp 220 kV bị tách số và tách kV
    const l3 = ["Điện áp định mức: 2 2 0 k V"];
    expect(extractDienApDm(l3, l3.map(stripVnDiacritics))).toBe("220 kV");

    // Điện áp 110 kV
    const l4 = ["Điện áp định mức (Rated voltage): 1 1 0 kV Năm sản xuất: 2015"];
    expect(extractDienApDm(l4, l4.map(stripVnDiacritics))).toBe("110 kV");

    // Máy biến áp đa cuộn dây
    const l5 = ["Điện áp định mức: 500/220/35 kV Năm sản xuất: 2020"];
    expect(extractDienApDm(l5, l5.map(stripVnDiacritics))).toBe("500/220/35 kV");

    // Dạng bảng ô ở hàng dưới
    const l6 = [
      "Điện áp định mức (Rated voltage):",
      "550 kV",
    ];
    expect(extractDienApDm(l6, l6.map(stripVnDiacritics))).toBe("550 kV");

    // Nhãn Um
    const l7 = ["Um: 220 kV  Năm vận hành: 2018"];
    expect(extractDienApDm(l7, l7.map(stripVnDiacritics))).toBe("220 kV");

    // Không nhầm lẫn với hạng mục "Điện áp chọc thủng"
    const l8 = ["1. Điện áp chọc thủng (Breakdown voltage): 75 kV Đạt"];
    expect(extractDienApDm(l8, l8.map(stripVnDiacritics))).toBeNull();
  });

  test("ánh xạ mapVoltageToBang63Class từ điện áp định mức, trạm và thiết bị", () => {
    // 500 kV
    expect(mapVoltageToBang63Class("550 kV")).toBe("500");
    expect(mapVoltageToBang63Class("500 kV")).toBe("500");
    expect(mapVoltageToBang63Class("525 kV")).toBe("500");
    expect(mapVoltageToBang63Class("5 5 0 kV")).toBe("500");
    expect(mapVoltageToBang63Class("500/220/35 kV")).toBe("500");

    // 110-220 kV
    expect(mapVoltageToBang63Class("220 kV")).toBe("110-220");
    expect(mapVoltageToBang63Class("230 kV")).toBe("110-220");
    expect(mapVoltageToBang63Class("110 kV")).toBe("110-220");
    expect(mapVoltageToBang63Class("115 kV")).toBe("110-220");
    expect(mapVoltageToBang63Class("220/110/22 kV")).toBe("110-220");
    expect(mapVoltageToBang63Class("22 kV")).toBe("110-220");

    // Dự phòng theo tên trạm
    expect(mapVoltageToBang63Class(null, "Trạm 500kV Vĩnh Tân")).toBe("500");
    expect(mapVoltageToBang63Class("", "TBA 500 kV Pleiku")).toBe("500");
    expect(mapVoltageToBang63Class(null, "Trạm 220kV Bảo Lộc")).toBe("110-220");
    expect(mapVoltageToBang63Class(null, "TBA 110kV Tháp Chàm")).toBe("110-220");

    // Dự phòng theo ngăn lộ thiết bị (quy ước EVN: 5xx = 500kV, 2xx = 220kV, 1xx = 110kV)
    expect(mapVoltageToBang63Class(null, null, "TI 566")).toBe("500");
    expect(mapVoltageToBang63Class(null, null, "571")).toBe("500");
    expect(mapVoltageToBang63Class(null, null, "TI 271")).toBe("110-220");
    expect(mapVoltageToBang63Class(null, null, "171")).toBe("110-220");
    expect(mapVoltageToBang63Class(null, null, "MC 272")).toBe("110-220");
  });
});

const { DGA } = require("./helpers");
const BbtnExport = require("../src/data/io/bbtn-export.js");

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

describe("BbtnImport.extractGasValues — Ô 'Kết quả' để TRỐNG = KPH, không lấy giá trị cột Tiêu chuẩn", () => {
  const wrap = (rows) => [
    "KẾT QUẢ THÍ NGHIỆM",
    "TT Hạng mục phân tích (Test items) Đơn vị (Unit) Kết quả (Result) Tiêu chuẩn (Limits) Đánh giá",
    ...rows,
    "Ghi chú (Remark):",
  ];

  test("ô trống, cột Tiêu chuẩn có '<' với ngưỡng lớn -> KPH (trước đây bỏ trống)", () => {
    const res = extractGasValues(wrap([
      "1 Hydrogen H2 ppm < 300 Đạt",
      "2 Methane CH4 9.703 < 30 Đạt",
      "3 Ethan C2H6 < 25 Đạt",
      "6 CarbonMonoxit CO 97.798 < 330 Đạt",
      "7 Carbondioxit CO2 < 900 Đạt",
    ]));
    expect(res.H2).toBe("KPH");
    expect(res.CH4).toBe(9.703);
    expect(res.C2H6).toBe("KPH");
    expect(res.CO).toBe(97.798);
    expect(res.CO2).toBe("KPH");
  });

  test("ô trống + có cột Tốc độ sinh khí -> KPH", () => {
    const res = extractGasValues(wrap(["1 Hydrogen H2 ppm < 300 0.5% Đạt", "7 Carbondioxit CO2 < 900 -2.1% Đạt"]));
    expect(res.H2).toBe("KPH");
    expect(res.CO2).toBe("KPH");
  });

  test("dấu '<' bị đổi ký tự khi trích PDF (‹ ˂ ＜ &lt;) -> không lấy số Tiêu chuẩn làm kết quả", () => {
    const res = extractGasValues(wrap([
      "1 Hydrogen H2 ppm ‹ 300 Đạt",
      "2 Methane CH4 ˂ 30 Đạt",
      "6 CarbonMonoxit CO ＜ 330 Đạt",
      "7 Carbondioxit CO2 &lt; 900 Đạt",
    ]));
    expect(res).toMatchObject({ H2: "KPH", CH4: "KPH", CO: "KPH", CO2: "KPH" });
  });

  test("dấu '<' bị MẤT, chỉ còn số trùng ngưỡng tiêu chuẩn + 'Đạt' -> KPH", () => {
    const res = extractGasValues(wrap(["1 Hydrogen H2 ppm 300 Đạt", "7 Carbondioxit CO2 900 Đạt"]));
    expect(res.H2).toBe("KPH");
    expect(res.CO2).toBe("KPH");
  });

  test("an toàn: số trùng ngưỡng nhưng Đánh giá 'Không đạt' -> GIỮ số đo", () => {
    const res = extractGasValues(wrap(["1 Hydrogen H2 ppm 300 Không đạt"]));
    expect(res.H2).toBe(300);
  });

  test("có số đo thật thì vẫn đọc đúng số đo, kể cả khi cột Tiêu chuẩn mất '<'", () => {
    const res = extractGasValues(wrap([
      "1 Hydrogen H2 ppm 12.5 < 300 Đạt",
      "2 Methane CH4 9.7 30 Đạt",
      "7 Carbondioxit CO2 950 < 900 Không đạt",
    ]));
    expect(res.H2).toBe(12.5);
    expect(res.CH4).toBe(9.7);
    expect(res.CO2).toBe(950);
  });

  test("ô kết quả trống, cột Tiêu chuẩn rơi xuống dòng kế tiếp -> KPH", () => {
    const res = extractGasValues(wrap(["1 Hydrogen H2 ppm", "< 300", "Đạt", "2 Methane CH4 9.7 < 30 Đạt"]));
    expect(res.H2).toBe("KPH");
    expect(res.CH4).toBe(9.7);
  });
});

describe("Form nhập tab Khí hòa tan — ô khí để TRỐNG được hiểu là KPH", () => {
  const dgaSrc = fs.readFileSync(path.join(__dirname, "..", "src", "presentation", "tabs", "ui-dga.js"), "utf8");
  test("onAnalyze(): ô trống -> gases = 0 và đánh dấu kphGases", () => {
    expect(dgaSrc).toMatch(/raw === ""\) \{[\s\S]{0,300}?gases\[g\] = 0;\s*kphGases\[g\] = true;/);
  });
  test("thông báo ô trống nói rõ là KPH, không dùng alert() chặn màn hình", () => {
    const utils = fs.readFileSync(path.join(__dirname, "..", "src", "presentation", "components", "ui-utils.js"), "utf8");
    const fn = utils.slice(utils.indexOf("function warnIfEmptyMainGas"), utils.indexOf("function warnIfEmptyMainGas") + 600);
    expect(fn).toContain("KPH");
    expect(fn).not.toMatch(/\balert\(/);
  });
  test("bản mobile dùng cùng bộ đọc khí (extractGasValues) với bản web", () => {
    const norm = (s) => {
      s = s.replace(/\r/g, "");
      const a = s.indexOf("const KPH_PATTERN");
      return s.slice(a, s.indexOf("\n}\n", s.indexOf("function extractGasValues", a)));
    };
    const web = fs.readFileSync(path.join(__dirname, "..", "src", "data", "io", "bbtn-import.js"), "utf8");
    const mob = fs.readFileSync(path.join(__dirname, "..", "mobile", "bbtn-import.js"), "utf8");
    expect(norm(mob)).toBe(norm(web));
  });
});

// Bước 4.3 REFACTOR_PLAN (gỡ vi phạm V1): bộ đọc BBTN không còn đọc _allStandards của giao diện — tiêu chuẩn NSX đến
// qua setManufacturerStandardsProvider() (ui-standards.js / mobile/app.js đăng ký). Ngưỡng NSX in ở cột "Tiêu chuẩn" khi
// ô kết quả để TRỐNG phải được nhận ra là ngưỡng (KPH), không bị đọc thành kết quả đo.
describe("BbtnImport — ngưỡng tiêu chuẩn NSX qua hàm cung cấp", () => {
  function load() {
    const code = fs.readFileSync(path.join(__dirname, "..", "src", "data", "io", "bbtn-import.js"), "utf8");
    const sub = code.slice(code.indexOf("const VN_DIACRITICS_RE ="), code.indexOf("// Các trường \"Thông số kỹ thuật"));
    const sb = {};
    vm.createContext(sb);
    vm.runInContext(sub + "\nthis.extractGasValues = extractGasValues; this.setManufacturerStandardsProvider = setManufacturerStandardsProvider;", sb);
    return sb;
  }
  const lines = ["1 Hydro (H2) ppm 777 Đạt", "2 Metan (CH4) ppm 10 < 130 Đạt"];

  test("chưa đăng ký tiêu chuẩn NSX: 777 (không phải ngưỡng mặc định) được đọc là kết quả", () => {
    const sb = load();
    expect(sb.extractGasValues(lines)).toEqual({ H2: 777, CH4: 10 });
  });

  test("đã đăng ký NSX có ngưỡng H2 = 777: ô kết quả trống → KPH; đọc lúc trích xuất (danh sách mới nhất)", () => {
    const sb = load();
    let standards = [];
    sb.setManufacturerStandardsProvider(() => standards);
    expect(sb.extractGasValues(lines).H2).toBe(777);
    standards = [{ limits: { H2: 777 } }];
    expect(sb.extractGasValues(lines)).toEqual({ H2: "KPH", CH4: 10 });
    standards = [{ condemning: { H2: 777 } }];
    expect(sb.extractGasValues(lines).H2).toBe("KPH");
    sb.setManufacturerStandardsProvider(null);
    expect(sb.extractGasValues(lines).H2).toBe(777);
  });
});
