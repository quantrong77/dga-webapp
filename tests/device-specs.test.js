const DS = require("../src/data/io/device-specs.js");
const P = require("../src/data/io/mba-oil-bbtn.js");

describe("Thông số kỹ thuật thiết bị đã lưu (deviceSpecsCollect)", () => {
  const sources = {
    measurements: [
      { tram: "TBA 220kV Hàm Tân", thiet_bi: "AT2", sample_date: "2024-05-01", kieu_may: "AUTO", nam_sx: 2019, so_che_tao: "OLD-1", manufacturer: "EEMC" },
      { tram: "TBA 220kV Hàm Tân", thiet_bi: "AT2", sample_date: "2025-05-01", so_che_tao: "194839-124", dien_ap_dm: "" },
      { tram: "TBA khác", thiet_bi: "AT2", sample_date: "2026-01-01", so_che_tao: "SAI-TRAM" },
    ],
    oilTests: [
      { tram: "TBA 220kV Hàm Tân", thiet_bi: "AT2", sample_date: "2026-10-18", voltage_class: "220", manufacturer: "",
        device_info: JSON.stringify({ hang_sx: "EEMC", cong_suat: "150/200/250 (MVA)", nam_van_hanh: "2019" }) },
    ],
    oltcTests: [{ tram: "TBA 220kV Hàm Tân", thiet_bi: "AT2", sample_date: "2026-11-01", voltage_class: "220" }],
    instrumentTests: [
      { tram: "TBA 220kV Hàm Tân", thiet_bi: "TI 566", sample_date: "2026-09-01", manufacturer: "Arteche", um_kv: null,
        bbtn_info: JSON.stringify({ hang_sx: "ARTECHE", u_dm: "245", so_che_tao: { A: "S1", B: "S2", C: "" }, loai_dau: "Nytro" }) },
    ],
  };

  test("mỗi thông số lấy giá trị MỚI NHẤT khác rỗng, kèm ngày + nguồn; khớp đúng trạm", () => {
    const r = DS.deviceSpecsCollect(sources, "TBA 220kV Hàm Tân", " AT2 ");
    expect(r.found).toBe(true);
    expect(r.values.so_che_tao).toEqual({ value: "194839-124", date: "2025-05-01", source: "lần đo khí hòa tan" });
    expect(r.values.kieu_may.value).toBe("AUTO");
    expect(r.values.nam_sx.value).toBe(2019);
    expect(r.values.hang_sx).toEqual({ value: "EEMC", date: "2026-10-18", source: "thí nghiệm dầu MBA" });
    expect(r.values.cong_suat.value).toBe("150/200/250 (MVA)");
    expect(r.values.voltage_class.value).toBe("220");
    expect(r.values.manufacturer_dga.value).toBe("EEMC");
    expect(r.values.dien_ap_dm).toBeUndefined(); // chỉ có chuỗi rỗng
  });

  test("TI/TU 3 pha: thông số từ bbtn_info, số chế tạo từng pha, Um suy từ điện áp định mức", () => {
    const r = DS.deviceSpecsCollect(sources, "", "TI 566");
    expect(r.values.so_che_tao_pha.value).toEqual({ A: "S1", B: "S2", C: "" });
    expect(r.values.um_kv.value).toBe(245);
    expect(r.values.manufacturer_instrument.value).toBe("Arteche");
  });

  test("chưa chọn Trạm mà tên thiết bị có ở nhiều trạm → không đoán, báo danh sách trạm", () => {
    const r = DS.deviceSpecsCollect(sources, "", "AT2");
    expect(r).toMatchObject({ found: false, ambiguous: true, stations: ["TBA 220kV Hàm Tân", "TBA khác"] });
    expect(r.values).toEqual({});
  });

  test("thiết bị mới / thiếu tên thiết bị → không có thông số", () => {
    expect(DS.deviceSpecsCollect(sources, "TBA 220kV Hàm Tân", "AT9")).toEqual({ found: false, values: {} });
    expect(DS.deviceSpecsCollect(sources, "TBA 220kV Hàm Tân", "").found).toBe(false);
  });
});

describe("Thông số kỹ thuật đọc từ file (deviceSpecsFromHeader)", () => {
  test("PDF: 2 ô chung 1 dòng, ĐA định mức xuống dòng, kiểu máy", () => {
    const h = P.parseMbaOilBbtnLines([
      "Tên dự án/tên trạm (Project): Trạm 220kV Hàm Tân",
      "Vị trí lắp đặt (Site): Máy biến áp AT2",
      "Hãng sản xuất (Manufacturer): EEMC Số chế tạo (Serial No): 194839-124",
      "Năm sản xuất (Year of manufacture): 2019 Kiểu loại (Type): AUTO",
      "Điện áp định mức (Rated voltage): Công suất (Rated power): 150/200/250 (MVA)",
      "(225/√3±8x1,25%)/115/√3/23 (kV)",
      "Năm vận hành (Year of operation): - Loại dầu (Type): ERGON-Mỹ",
    ]).header;
    expect(DS.deviceSpecsFromHeader(h)).toEqual({
      hang_sx: "EEMC", so_che_tao: "194839-124", nam_sx: "2019", kieu_may: "AUTO", cong_suat: "150/200/250 (MVA)",
      dien_ap_dm: "(225/√3±8x1,25%)/115/√3/23 (kV)", um_kv: 225, voltage_class: "220", loai_dau: "ERGON-Mỹ",
    });
  });

  test("ô trống không sinh thông số", () => {
    expect(DS.deviceSpecsFromHeader(P.parseMbaOilBbtnLines(["Số chế tạo (Serial No): - | Năm vận hành: -"]).header)).toEqual({});
  });
});
