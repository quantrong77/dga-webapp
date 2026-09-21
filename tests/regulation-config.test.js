// Cơ chế "Cấu hình quy định": ghi đè ngưỡng lúc chạy và khôi phục về mặc định gốc.
// Mỗi file test Jest có module registry riêng nên việc ghi đè ở đây KHÔNG ảnh hưởng file khác.
const { DGA, gases } = require("./helpers");
const { EQUIPMENT_TYPES: T } = DGA;

const DEFAULT_C2H2_MBA = 20;

afterEach(() => {
  DGA.getRegulationConfigRegistry().forEach((it) => DGA.resetRegulationConfigItem(it.key));
});

describe("Registry", () => {
  test("có đủ 13 bảng cấu hình được, mỗi bảng có key duy nhất", () => {
    const keys = DGA.getRegulationConfigRegistry().map((i) => i.key);
    expect(keys).toHaveLength(13);
    expect(new Set(keys).size).toBe(13);
    expect(keys).toEqual(expect.arrayContaining(["BANG64_MBA", "BANG12_TI", "BANG65_RATE", "BANG54_BDV", "BANG58_WATER", "BANG49_OLTC"]));
  });
  test("bảng lấy citation mặc định đúng", () => {
    expect(DGA.regulationConfigDefaultCitation("BANG64_MBA")).toBe("QĐ1901 Bảng 64, Điều 54");
    expect(DGA.regulationConfigDefaultCitation("không-có")).toBeNull();
  });
});

describe("applyRegulationConfigOverride / resetRegulationConfigItem", () => {
  test("ghi đè Bảng 64 => resolveStandard áp dụng ngay ngưỡng mới (chặt hơn thì được chọn)", () => {
    DGA.applyRegulationConfigOverride("BANG64_MBA", { values: { C2H2: 5 } });
    expect(DGA.resolveStandard({ equipmentType: T.MBA }, []).limits.C2H2).toBe(5);
    // các khí không sửa giữ nguyên (deep-merge, không xóa)
    expect(DGA.resolveStandard({ equipmentType: T.MBA }, []).limits.H2).toBe(150);
  });
  test("ghi đè cả chuỗi tham chiếu nguồn", () => {
    DGA.applyRegulationConfigOverride("BANG64_MBA", { citation: "QĐ mới 2030" });
    expect(DGA.REGULATION_CITATIONS.BANG64_MBA).toBe("QĐ mới 2030");
    expect(DGA.resolveStandard({ equipmentType: T.MBA }, []).sourceLabel).toMatch(/QĐ mới 2030/);
  });
  test("khôi phục mặc định trả đúng số liệu và citation gốc", () => {
    DGA.applyRegulationConfigOverride("BANG64_MBA", { citation: "X", values: { C2H2: 1, H2: 1 } });
    DGA.resetRegulationConfigItem("BANG64_MBA");
    expect(DGA.QD1901_BANG64_MBA.C2H2).toBe(DEFAULT_C2H2_MBA);
    expect(DGA.QD1901_BANG64_MBA.H2).toBe(150);
    expect(DGA.REGULATION_CITATIONS.BANG64_MBA).toBe("QĐ1901 Bảng 64, Điều 54");
  });
  test("khôi phục xóa cả phần thuộc tính thêm vào (không sót override)", () => {
    DGA.applyRegulationConfigOverride("BANG64_MBA", { values: { KHI_LA: 123 } });
    expect(DGA.QD1901_BANG64_MBA.KHI_LA).toBe(123);
    DGA.resetRegulationConfigItem("BANG64_MBA");
    expect(DGA.QD1901_BANG64_MBA).not.toHaveProperty("KHI_LA");
  });
  test("ghi đè bảng dầu lồng nhau (Bảng 54) chỉ đổi đúng ô cần đổi", () => {
    DGA.applyRegulationConfigOverride("BANG54_BDV", { values: { "220": { inservice: 99 } } });
    expect(DGA.BANG54_BDV["220"].inservice).toBe(99);
    expect(DGA.BANG54_BDV["220"].new).toBe(60);
    const r = DGA.evaluateOilTest({ voltageClass: "220", oilState: "inservice", bdv: 60 });
    expect(r.rows[0].verdict).toBe("Không đạt"); // 60 < 99
    DGA.resetRegulationConfigItem("BANG54_BDV");
    expect(DGA.evaluateOilTest({ voltageClass: "220", oilState: "inservice", bdv: 60 }).rows[0].verdict).toBe("Đạt");
  });
  test("ghi đè khoảng tốc độ (Bảng 65) được dùng khi tính tốc độ sinh khí", () => {
    DGA.applyRegulationConfigOverride("BANG65_RATE", { values: { H2: [0, 10] } });
    const h2 = DGA.computeRateOfChange(gases({ H2: 0 }), gases({ H2: 100 }), 365, DGA.QD1901_BANG65_RATE, T.MBA)[0];
    expect(h2.verdict.startsWith("⚠")).toBe(true);
  });
  test("key không tồn tại hoặc override rỗng => bỏ qua, không ném lỗi", () => {
    expect(() => DGA.applyRegulationConfigOverride("không-có", { values: { a: 1 } })).not.toThrow();
    expect(() => DGA.applyRegulationConfigOverride("BANG64_MBA", null)).not.toThrow();
    expect(() => DGA.resetRegulationConfigItem("không-có")).not.toThrow();
    expect(DGA.QD1901_BANG64_MBA.C2H2).toBe(DEFAULT_C2H2_MBA);
  });
});

describe("getRegulationConfigCurrentValues", () => {
  test("trả bản sao: sửa kết quả trả về không làm đổi hằng số thật", () => {
    const cur = DGA.getRegulationConfigCurrentValues("BANG64_MBA");
    cur.values.C2H2 = 12345;
    expect(DGA.QD1901_BANG64_MBA.C2H2).toBe(DEFAULT_C2H2_MBA);
  });
  test("phản ánh override đang áp dụng; key lạ => null", () => {
    DGA.applyRegulationConfigOverride("BANG64_MBA", { values: { C2H2: 7 } });
    expect(DGA.getRegulationConfigCurrentValues("BANG64_MBA").values.C2H2).toBe(7);
    expect(DGA.getRegulationConfigCurrentValues("không-có")).toBeNull();
  });
});

describe("Đường dẫn giá trị", () => {
  test("getValueAtPath / setValueAtPath", () => {
    const o = { a: { b: 1 } };
    expect(DGA.getValueAtPath(o, ["a", "b"])).toBe(1);
    DGA.setValueAtPath(o, ["a", "c"], 5);
    expect(o.a.c).toBe(5);
  });
});
