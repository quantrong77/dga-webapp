// Đánh giá tuyệt đối từng khí, chọn tiêu chuẩn áp dụng, ngưỡng loại bỏ, TCG.
const { DGA, gases } = require("./helpers");
const { EQUIPMENT_TYPES: T, MBA_SUBTYPES: S } = DGA;

describe("TCG (Tổng khí cháy)", () => {
  test("cộng H2+CH4+C2H6+C2H4+C2H2+CO, KHÔNG cộng CO2", () => {
    expect(DGA.computeTCG(gases({ H2: 1, CH4: 2, C2H6: 3, C2H4: 4, C2H2: 5, CO: 6, CO2: 1000 }))).toBe(21);
  });
  test("giá trị rỗng/không phải số coi là 0, chuỗi số được ép kiểu", () => {
    expect(DGA.computeTCG({ H2: "", CH4: null, C2H6: undefined, C2H4: "abc", C2H2: "2.5", CO: 10 })).toBeCloseTo(12.5);
  });
});

describe("evaluateAbsolute — điều kiện biên so với ngưỡng", () => {
  const limits = { H2: 100, CH4: 100, C2H6: 100, C2H4: 100, C2H2: 2, CO: 100, CO2: 100 };
  const verdictOf = (rows, gas) => rows.find((r) => r.gas === gas).verdict;

  test("đúng bằng ngưỡng => Đạt (ngưỡng là 'không lớn hơn')", () => {
    expect(verdictOf(DGA.evaluateAbsolute(gases({ C2H2: 2 }), limits), "C2H2")).toBe("Đạt");
  });
  test("vượt ngưỡng chút ít => Không đạt", () => {
    expect(verdictOf(DGA.evaluateAbsolute(gases({ C2H2: 2.01 }), limits), "C2H2")).toBe("Không đạt");
  });
  test("khí không có ngưỡng => 'Không có ngưỡng', không làm hỏng kết luận chung", () => {
    const rows = DGA.evaluateAbsolute(gases({ CO2: 5 }), { ...limits, CO2: null });
    expect(verdictOf(rows, "CO2")).toBe("Không có ngưỡng");
    expect(DGA.overallVerdict(rows)).toBe("Đạt");
  });
  test("overallVerdict liệt kê các khí không đạt", () => {
    const rows = DGA.evaluateAbsolute(gases({ C2H2: 3, H2: 500 }), limits);
    expect(DGA.overallVerdict(rows)).toBe("Không đạt: H2, C2H2");
  });
});

describe("resolveStandard — tiêu chuẩn mặc định theo loại thiết bị", () => {
  test("TI: QĐ1901 Bảng 12 = IEC A.4.4 Table A.8 (H2 300/CH4 30/C2H6 50/C2H4 10/C2H2 2/CO 300/CO2 900)", () => {
    const r = DGA.resolveStandard({ equipmentType: T.TI }, []);
    expect(r.limits).toEqual({ H2: 300, CH4: 30, C2H6: 50, C2H4: 10, C2H2: 2, CO: 300, CO2: 900 });
    expect(r.isManufacturer).toBe(false);
    expect(r.pdThreshold).toBe(0.2);
  });
  test("TU dùng cùng bộ ngưỡng tối đa với TI", () => {
    expect(DGA.resolveStandard({ equipmentType: T.TU }, []).limits).toEqual(
      DGA.resolveStandard({ equipmentType: T.TI }, []).limits
    );
  });
  test("MBA: lấy giá trị CHẶT HƠN giữa QĐ1901 Bảng 64 và IEC Table A.2", () => {
    const r = DGA.resolveStandard({ equipmentType: T.MBA, mbaSubtype: S.NO_OLTC }, []);
    expect(r.limits).toEqual({ H2: 150, CH4: 130, C2H6: 90, C2H4: 280, C2H2: 20, CO: 600, CO2: 14000 });
    expect(r.pdThreshold).toBe(0.1);
  });
  test("MBA: với số liệu mặc định, tick 'ngăn OLTC thông thùng chính' KHÔNG đổi ngưỡng (min(20; 280) = 20)", () => {
    // Ghi lại hành vi hiện tại: vì lấy min, ngưỡng C2H2 luôn = 20 ở cả 2 nhóm OLTC. README
    // từng nói tick làm ngưỡng C2H2 nới lên ~280 — KHÔNG đúng với code hiện tại.
    const noOltc = DGA.resolveStandard({ equipmentType: T.MBA, mbaSubtype: S.NO_OLTC }, []);
    const commOltc = DGA.resolveStandard({ equipmentType: T.MBA, mbaSubtype: S.COMM_OLTC }, []);
    expect(commOltc.limits.C2H2).toBe(20);
    expect(commOltc.limits).toEqual(noOltc.limits);
  });
  test("Sứ xuyên: dùng IEC A.5.4 Table A.11 (392/216/121/70/5/927/11578), PD < 0,07", () => {
    const r = DGA.resolveStandard({ equipmentType: T.BUSHING }, []);
    expect(r.limits).toEqual({ H2: 392, CH4: 216, C2H6: 121, C2H4: 70, C2H2: 5, CO: 927, CO2: 11578 });
    expect(r.pdThreshold).toBe(0.07);
  });
  test("pdThresholdForType: TI/TU 0,2; MBA/Khác 0,1; Sứ xuyên 0,07; loại lạ => mặc định 0,1", () => {
    expect(DGA.pdThresholdForType(T.TI)).toBe(0.2);
    expect(DGA.pdThresholdForType(T.TU)).toBe(0.2);
    expect(DGA.pdThresholdForType(T.MBA)).toBe(0.1);
    expect(DGA.pdThresholdForType(T.OTHER)).toBe(0.1);
    expect(DGA.pdThresholdForType(T.BUSHING)).toBe(0.07);
    expect(DGA.pdThresholdForType("không tồn tại")).toBe(0.1);
  });
});

describe("resolveStandard — tiêu chuẩn nhà sản xuất", () => {
  const fullLimits = { H2: 1, CH4: 2, C2H6: 3, C2H4: 4, C2H2: 5, CO: 6, CO2: 7 };
  const makeStd = (over = {}) => ({ manufacturer: "ABB", equipmentType: T.TI, limits: fullLimits, ...over });

  test("NSX cấu hình đủ 7 khí => dùng ngưỡng NSX", () => {
    const r = DGA.resolveStandard({ equipmentType: T.TI, manufacturer: "ABB" }, [makeStd()]);
    expect(r.isManufacturer).toBe(true);
    expect(r.limits).toEqual(fullLimits);
  });
  test("NSX thiếu 1 khí => quay về tiêu chuẩn mặc định QĐ1901/IEC", () => {
    const partial = { ...fullLimits, CO2: "" };
    const r = DGA.resolveStandard({ equipmentType: T.TI, manufacturer: "ABB" }, [makeStd({ limits: partial })]);
    expect(r.isManufacturer).toBe(false);
    expect(r.limits.C2H2).toBe(2);
  });
  test("NSX khác hãng hoặc khác loại thiết bị => không áp dụng", () => {
    expect(DGA.resolveStandard({ equipmentType: T.TI, manufacturer: "Siemens" }, [makeStd()]).isManufacturer).toBe(false);
    expect(DGA.resolveStandard({ equipmentType: T.TU, manufacturer: "ABB" }, [makeStd()]).isManufacturer).toBe(false);
  });
  test("danh sách tiêu chuẩn null/undefined không làm hàm ném lỗi", () => {
    expect(() => DGA.resolveStandard({ equipmentType: T.MBA }, null)).not.toThrow();
    expect(() => DGA.resolveStandard({ equipmentType: T.MBA }, undefined)).not.toThrow();
  });
});

describe("Ngưỡng loại bỏ (condemning) — chỉ do nhà sản xuất quy định", () => {
  const std = { manufacturer: "ABB", equipmentType: T.TI, limits: null, condemning: { C2H2: 10, H2: "" } };

  test("resolveCondemningLimits trả null khi không có NSX/không cấu hình khí nào", () => {
    expect(DGA.resolveCondemningLimits({ equipmentType: T.TI, manufacturer: "ABB" }, [])).toBeNull();
    expect(DGA.resolveCondemningLimits({ equipmentType: T.TI, manufacturer: "ABB" }, [{ ...std, condemning: { H2: "" } }])).toBeNull();
  });
  test("chỉ kiểm tra khí có cấu hình; vượt nghiêm ngặt '>' mới tính là vượt", () => {
    const lim = DGA.resolveCondemningLimits({ equipmentType: T.TI, manufacturer: "ABB" }, [std]);
    expect(DGA.evaluateCondemning(gases({ C2H2: 10 }), lim)).toEqual([{ gas: "C2H2", value: 10, limit: 10, exceeded: false }]);
    const rows = DGA.evaluateCondemning(gases({ C2H2: 10.5 }), lim);
    expect(DGA.condemningExceededRows(rows).map((r) => r.gas)).toEqual(["C2H2"]);
  });
  test("evaluateCondemning(null) => mảng rỗng", () => {
    expect(DGA.evaluateCondemning(gases({ C2H2: 999 }), null)).toEqual([]);
  });
});

describe("countExceedTypical — điều kiện áp dụng tỷ lệ khí (Điều 54 / IEC 6.1(c))", () => {
  test("MBA: đếm khí vượt Bảng 64 (cận trên điển hình)", () => {
    expect(DGA.countExceedTypical(gases({ H2: 150, C2H2: 20 }), T.MBA, {})).toBe(0); // bằng ngưỡng: chưa vượt
    expect(DGA.countExceedTypical(gases({ H2: 151, C2H2: 21 }), T.MBA, {})).toBe(2);
  });
  test("ratioApplicability: 0 khí vượt => chỉ tham khảo; >=1 => đủ điều kiện", () => {
    expect(DGA.ratioApplicability(0)).toMatch(/Chưa đủ điều kiện/);
    expect(DGA.ratioApplicability(1)).toMatch(/Đủ điều kiện/);
  });
});
