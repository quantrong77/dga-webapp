// Cơ chế "Cấu hình quy định": ghi đè ngưỡng lúc chạy và khôi phục về mặc định gốc.
// Mỗi file test Jest có module registry riêng nên việc ghi đè ở đây KHÔNG ảnh hưởng file khác.
const { DGA, gases } = require("./helpers");
const { EQUIPMENT_TYPES: T } = DGA;

const DEFAULT_C2H2_MBA = 20;

afterEach(() => {
  DGA.getRegulationConfigRegistry().forEach((it) => DGA.resetRegulationConfigItem(it.key));
});

describe("Registry", () => {
  test("có đủ 34 bảng cấu hình được, mỗi bảng có key duy nhất", () => {
    const keys = DGA.getRegulationConfigRegistry().map((i) => i.key);
    expect(keys).toHaveLength(34);
    expect(new Set(keys).size).toBe(34);
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

describe("Ngưỡng tỷ số khí / ranh giới vùng cấu hình được (Bảng 66, PD/D/T, A.10, Bảng 67, OLTC, tỷ lệ bổ sung)", () => {
  const R = (g, h, i) => DGA.diagnoseRatios({ c2h2_c2h4: g, ch4_h2: h, c2h4_c2h6: i });

  test("đủ các bảng mới, mỗi trường trỏ đúng 1 số mặc định", () => {
    ["BANG64_MBA_LOW", "BANG66_TABLE1", "BANG66_PDT", "IEC_A10_BUSHING", "BANG67_DUVAL", "DIEU54_OLTC", "DIEU54_ADDITIONAL"].forEach((key) => {
      const item = DGA.getRegulationConfigRegistry().find((i) => i.key === key);
      expect(item).toBeTruthy();
      item.fields.forEach((f) => expect(typeof DGA.getValueAtPath(item.target, f.path)).toBe("number"));
    });
  });

  test("Bảng 66: đổi ngưỡng T2/T3 C2H4/C2H6 (4 -> 3) đổi kết luận; khôi phục trả lại như cũ", () => {
    expect(R(0.05, 2, 3.5)).toMatch(/^T2/);
    DGA.applyRegulationConfigOverride("BANG66_TABLE1", { values: { T2: { i_max: 3 }, T3: { i_min: 3 } } });
    expect(R(0.05, 2, 3.5)).toMatch(/^T3/);
    DGA.resetRegulationConfigItem("BANG66_TABLE1");
    expect(R(0.05, 2, 3.5)).toMatch(/^T2/);
  });

  test("Bảng 66: vùng chồng lấn D1/D2 tính lại theo ngưỡng D2 mới", () => {
    expect(R(1.5, 0.3, 1.5)).toMatch(/^D1 -/);
    DGA.applyRegulationConfigOverride("BANG66_TABLE1", { values: { D2: { i_min: 1.2 } } });
    expect(R(1.5, 0.3, 1.5)).toMatch(/^D1\/D2/);
  });

  test("bảng PD/D/T dùng ngưỡng cấu hình", () => {
    expect(DGA.diagnoseSimplifiedPDT({ c2h2_c2h4: 0.3, ch4_h2: 0.5 }).codes).toEqual(["D"]);
    DGA.applyRegulationConfigOverride("BANG66_PDT", { values: { dt_g: 0.5, pd_h_max: 0.6 } });
    expect(DGA.diagnoseSimplifiedPDT({ c2h2_c2h4: 0.3, ch4_h2: 0.5 }).codes).toEqual(["PD", "T"]);
  });

  test("Table A.10 sứ xuyên: ngưỡng PD và nhãn hiển thị theo cấu hình", () => {
    const r = { c2h2_c2h4: 0.1, ch4_h2: 0.08, c2h4_c2h6: 0.5, co2_co: 5 };
    expect(DGA.diagnoseBushingRatios(r)).toEqual([]);
    DGA.applyRegulationConfigOverride("IEC_A10_BUSHING", { values: { pd_h_max: 0.1 } });
    expect(DGA.diagnoseBushingRatios(r)).toEqual(["PD"]);
    expect(DGA.BUSHING_CODE_LABELS.PD).toContain("< 0,1");
  });

  test("Bảng 67 Duval: dời ranh giới D1/D2 (23% -> 35% C2H4) đổi vùng", () => {
    const zone = () => DGA.classifyDuval1({ pctCH4: 40, pctC2H4: 30, pctC2H2: 30 }).zone;
    expect(zone()).toBe("D2");
    DGA.applyRegulationConfigOverride("BANG67_DUVAL", { values: { d1_c2h4: 35 } });
    expect(zone()).toBe("D1");
  });

  test("OLTC C2H2/H2 và tỷ lệ bổ sung CO2/CO dùng ngưỡng cấu hình (cả câu ghi chú)", () => {
    expect(DGA.oltcContaminationCheck({ H2: 10, C2H2: 25 }).level).toBe("possible");
    DGA.applyRegulationConfigOverride("DIEU54_OLTC", { values: { likely: 2.4 } });
    expect(DGA.oltcContaminationCheck({ H2: 10, C2H2: 25 }).level).toBe("likely");

    const g = gases({ CO: 900, CO2: 1800 });
    expect(DGA.diagnoseAdditionalRatios(g, null, null).co2coNote).toMatch(/^Không rơi vào/);
    DGA.applyRegulationConfigOverride("DIEU54_ADDITIONAL", { values: { co_min: 800 } });
    const note = DGA.diagnoseAdditionalRatios(g, null, null).co2coNote;
    expect(note).toMatch(/^CO2\/CO < 3 và CO > 800 ppm/);
  });

  test("Bảng 64 cận dưới: nhánh 'tất cả khí thấp hơn khoảng điển hình' theo cấu hình", () => {
    const g = gases({ H2: 40, CH4: 20, C2H6: 10, C2H4: 30, C2H2: 1, CO: 300, CO2: 3000 });
    expect(DGA.gasesBelowTypicalLow(g, T.MBA)).toBe(true);
    DGA.applyRegulationConfigOverride("BANG64_MBA_LOW", { values: { H2: 30 } });
    expect(DGA.gasesBelowTypicalLow(g, T.MBA)).toBe(false);
  });
});

describe("Kiểm tra thứ tự hợp lý khi Admin nhập ngưỡng", () => {
  const V = (key, patch) => DGA.validateRegulationConfigValues(key, { ...JSON.parse(JSON.stringify(DGA.getRegulationConfigCurrentValues(key).values)), ...patch });
  test("giá trị mặc định của mọi bảng đều hợp lệ", () => {
    DGA.getRegulationConfigRegistry().forEach((it) => {
      expect([it.key, DGA.validateRegulationConfigValues(it.key, DGA.getRegulationConfigCurrentValues(it.key).values)]).toEqual([it.key, []]);
    });
  });
  test("bắt lỗi: Duval chồng chéo, D1 'từ' > 'đến', OLTC đảo ngưỡng, CO2/CO đảo ngưỡng", () => {
    expect(V("BANG67_DUVAL", { d1_c2h4: 45 })).toEqual(expect.arrayContaining([expect.stringMatching(/D1\/D2/)]));
    expect(V("BANG67_DUVAL", { t_c2h2: 14 })).not.toEqual([]);
    expect(V("BANG66_TABLE1", { D1: { g_min: 1, h_min: 0.6, h_max: 0.5, i_min: 1 } })).toEqual([expect.stringMatching(/^D1: CH4\/H2/)]);
    expect(V("DIEU54_OLTC", { possible: 3, likely: 2 })).toHaveLength(1);
    expect(V("DIEU54_ADDITIONAL", { co2co_low: 12 })).toHaveLength(1);
  });
});
