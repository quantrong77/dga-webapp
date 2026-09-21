// Tốc độ sinh khí (Bảng 65), tỷ lệ bổ sung/Bảng 63 (Điều 54), trạng thái tổng thể.
const { DGA, gases } = require("./helpers");
const { EQUIPMENT_TYPES: T, NO_DIAGNOSIS } = DGA;

const rowOf = (rows, gas) => rows.find((x) => x.gas === gas);

describe("computeRateOfChange — Bảng 65 QĐ1901 (ppm/năm)", () => {
  const range = DGA.QD1901_BANG65_RATE; // H2 [35;132], C2H2 [0;4] ...

  test("deltaDays <= 0 hoặc thiếu => null", () => {
    expect(DGA.computeRateOfChange(gases(), gases(), 0, range, T.MBA)).toBeNull();
    expect(DGA.computeRateOfChange(gases(), gases(), -5, range, T.MBA)).toBeNull();
    expect(DGA.computeRateOfChange(gases(), gases(), undefined, range, T.MBA)).toBeNull();
  });
  test("tốc độ ppm/năm = Δ / số ngày × 365; trong khoảng điển hình", () => {
    const rows = DGA.computeRateOfChange(gases({ H2: 100 }), gases({ H2: 200 }), 365, range, T.MBA);
    const h2 = rowOf(rows, "H2");
    expect(h2.ratePerYear).toBe(100);
    expect(h2.verdict).toMatch(/^Trong khoảng điển hình/);
  });
  test("vượt cận trên => cảnh báo '⚠'", () => {
    const h2 = rowOf(DGA.computeRateOfChange(gases({ H2: 100 }), gases({ H2: 200 }), 182.5, range, T.MBA), "H2"); // 200 ppm/năm > 132
    expect(h2.ratePerYear).toBe(200);
    expect(h2.verdict.startsWith("⚠")).toBe(true);
  });
  test("dưới cận dưới => 'Dưới cận dưới'", () => {
    const h2 = rowOf(DGA.computeRateOfChange(gases({ H2: 100 }), gases({ H2: 110 }), 365, range, T.MBA), "H2"); // 10 < 35
    expect(h2.verdict).toMatch(/^Dưới cận dưới/);
  });
  test("giảm (Δ < 0) => 'Giảm', không cảnh báo", () => {
    const h2 = rowOf(DGA.computeRateOfChange(gases({ H2: 200 }), gases({ H2: 100 }), 365, range, T.MBA), "H2");
    expect(h2.verdict).toMatch(/^Giảm/);
  });
  test("C2H2 tăng 0 -> 10 ppm trong 1 năm vượt cận trên 4", () => {
    const c = rowOf(DGA.computeRateOfChange(gases(), gases({ C2H2: 10 }), 365, range, T.MBA), "C2H2");
    expect(c.verdict.startsWith("⚠")).toBe(true);
  });
  test("%/tháng: (Δ/trước)/(ngày/30)×100; lần đo trước bằng 0 => null", () => {
    const h2 = rowOf(DGA.computeRateOfChange(gases({ H2: 100 }), gases({ H2: 200 }), 30, range, T.MBA), "H2");
    expect(h2.ratePerMonth).toBe(100);
    const zero = rowOf(DGA.computeRateOfChange(gases({ H2: 0 }), gases({ H2: 5 }), 30, range, T.MBA), "H2");
    expect(zero.ratePerMonth).toBeNull();
  });
  test("chỉ MBA/Kháng dầu là 'chính thức'; loại khác chỉ tham khảo", () => {
    expect(DGA.computeRateOfChange(gases(), gases(), 30, range, T.MBA)[0].officialForEquipment).toBe(true);
    expect(DGA.computeRateOfChange(gases(), gases(), 30, range, T.TI)[0].officialForEquipment).toBe(false);
  });
  test("khoảng riêng của NSX được ưu tiên", () => {
    const custom = { ...range, H2: [0, 50] };
    const h2 = rowOf(DGA.computeRateOfChange(gases({ H2: 0 }), gases({ H2: 100 }), 365, custom, T.MBA), "H2");
    expect(h2.verdict.startsWith("⚠")).toBe(true);
  });
  test("computeTcgRateOfChange", () => {
    expect(DGA.computeTcgRateOfChange(100, 200, 0)).toBeNull();
    expect(DGA.computeTcgRateOfChange(100, 150, 30)).toEqual({ before: 100, after: 150, delta: 50, ratePerMonth: 50 });
    expect(DGA.computeTcgRateOfChange(0, 10, 30).ratePerMonth).toBeNull();
  });
});

describe("Bảng 63 — Tổng hàm lượng khí hòa tan", () => {
  test("cộng 7 khí + N2 + O2, quy đổi 10.000 ppm = 1%", () => {
    expect(DGA.computeTotalDissolvedGasPercent(gases({ H2: 100 }), 20000, 5000)).toBeCloseTo(2.51);
  });
  test("thiếu N2 hoặc O2 => null (không tính thấp giả tạo)", () => {
    expect(DGA.computeTotalDissolvedGasPercent(gases(), null, 5000)).toBeNull();
    expect(DGA.computeTotalDissolvedGasPercent(gases(), 20000, undefined)).toBeNull();
  });
  test("giới hạn: 110-220 kV < 1,0%; 500 kV < 0,5%; đúng bằng giới hạn => Không đạt", () => {
    expect(DGA.evaluateBang63(0.99, "110-220", true).verdict).toBe("Đạt");
    expect(DGA.evaluateBang63(1.0, "110-220", true).verdict).toBe("Không đạt");
    expect(DGA.evaluateBang63(0.49, "500", true).verdict).toBe("Đạt");
    expect(DGA.evaluateBang63(0.5, "500", true).verdict).toBe("Không đạt");
  });
  test("không áp dụng (dầu vận hành thường) => không kết luận, vẫn trả giới hạn", () => {
    expect(DGA.evaluateBang63(5, "110-220", false)).toEqual({ limit: 1.0, verdict: null, applicable: false });
  });
  test("thiếu tổng % hoặc cấp điện áp lạ => verdict null", () => {
    expect(DGA.evaluateBang63(null, "500", true).verdict).toBeNull();
    expect(DGA.evaluateBang63(1, "lạ", true).limit).toBeNull();
  });
});

describe("Tỷ lệ bổ sung — Điều 54 QĐ1901", () => {
  test("CO2/CO < 3 và CO > 1000 => nghi carbon hóa giấy", () => {
    const x = DGA.diagnoseAdditionalRatios(gases({ CO: 2000, CO2: 4000 }), null, null);
    expect(x.co2_co).toBe(2);
    expect(x.co2coNote).toMatch(/^CO2\/CO < 3/);
  });
  test("CO đúng 1000 ppm (không > 1000) => không cảnh báo", () => {
    const x = DGA.diagnoseAdditionalRatios(gases({ CO: 1000, CO2: 2000 }), null, null);
    expect(x.co2coNote).toMatch(/^Không rơi vào/);
  });
  test("CO2/CO > 10 và CO2 > 10.000 => quá nhiệt nhẹ/oxy hóa dầu", () => {
    const x = DGA.diagnoseAdditionalRatios(gases({ CO: 500, CO2: 12000 }), null, null);
    expect(x.co2coNote).toMatch(/^CO2\/CO > 10/);
  });
  test("CO = CO2 = 0 => không đủ dữ liệu", () => {
    const x = DGA.diagnoseAdditionalRatios(gases(), null, null);
    expect(x.co2_co).toBeNull();
    expect(x.co2coNote).toMatch(/Không đủ dữ liệu/);
  });
  test("O2/N2 < 0,3 => tiêu thụ oxy; thiếu N2/O2 => bỏ qua", () => {
    expect(DGA.diagnoseAdditionalRatios(gases(), 10000, 2000).o2n2Note).toMatch(/^O2\/N2 < 0,3/);
    const none = DGA.diagnoseAdditionalRatios(gases(), null, null);
    expect(none.o2_n2).toBeNull();
    expect(none.o2n2Note).toMatch(/Chưa nhập đủ/);
  });
});

describe("computeOverallStatus — Bình thường / Cảnh báo / Báo động", () => {
  const base = { overallOk: true, exceedCount: 0, diagnosis: NO_DIAGNOSIS, priorDiagnosis: null, rateRows: null, condemningRows: [] };

  test("mọi tiêu chí tốt => BÌNH THƯỜNG", () => {
    expect(DGA.computeOverallStatus(base).level).toBe("normal");
  });
  test("có khí vượt giá trị điển hình => CẢNH BÁO", () => {
    expect(DGA.computeOverallStatus({ ...base, exceedCount: 1 }).level).toBe("alert");
  });
  test("tốc độ tăng vượt khoảng điển hình => CẢNH BÁO", () => {
    const rateRows = [{ gas: "H2", verdict: "⚠ Vượt cận trên ..." }, { gas: "CH4", verdict: "Trong khoảng điển hình" }];
    const s = DGA.computeOverallStatus({ ...base, rateRows });
    expect(s.level).toBe("alert");
    expect(s.reasons.join(" ")).toMatch(/H2/);
  });
  test("có khí 'Không đạt' => BÁO ĐỘNG", () => {
    expect(DGA.computeOverallStatus({ ...base, overallOk: false }).level).toBe("alarm");
  });
  test("vượt ngưỡng loại bỏ của NSX => BÁO ĐỘNG", () => {
    const s = DGA.computeOverallStatus({ ...base, condemningRows: [{ gas: "C2H2", exceeded: true }] });
    expect(s.level).toBe("alarm");
    expect(s.reasons.join(" ")).toMatch(/LOẠI BỎ/);
  });
  test("loại sự cố đổi giữa 2 lần đo (cả hai đều có kết luận) => BÁO ĐỘNG", () => {
    const s = DGA.computeOverallStatus({ ...base, diagnosis: "T1 - x", priorDiagnosis: "D1 - y" });
    expect(s.level).toBe("alarm");
  });
  test("cùng loại sự cố, hoặc một bên không xác định => không tính là đổi loại", () => {
    expect(DGA.computeOverallStatus({ ...base, diagnosis: "T1 - x", priorDiagnosis: "T1 - x" }).level).toBe("normal");
    expect(DGA.computeOverallStatus({ ...base, diagnosis: "T1 - x", priorDiagnosis: NO_DIAGNOSIS }).level).toBe("normal");
  });
  test("báo động lấn át cảnh báo", () => {
    expect(DGA.computeOverallStatus({ ...base, overallOk: false, exceedCount: 3 }).level).toBe("alarm");
  });
  test("luôn có label, reasons (mảng không rỗng) và action", () => {
    ["normal", "alert", "alarm"].forEach((lvl) => {
      const s = DGA.computeOverallStatus(lvl === "normal" ? base : lvl === "alert" ? { ...base, exceedCount: 1 } : { ...base, overallOk: false });
      expect(s.label).toBeTruthy();
      expect(s.reasons.length).toBeGreaterThan(0);
      expect(s.action).toBeTruthy();
    });
  });
});
