// Dự báo xu hướng: OLS, Theil–Sen, trung bình liền kề, ngoại suy và mốc chạm ngưỡng.
const { DGA } = require("./helpers");

describe("linearRegression (OLS)", () => {
  test("đường thẳng chính xác y = 2x => slope 2, intercept 0, R² = 1", () => {
    const r = DGA.linearRegression([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
    expect(r.slope).toBeCloseTo(2);
    expect(r.intercept).toBeCloseTo(0);
    expect(r.r2).toBeCloseTo(1);
    expect(r.n).toBe(3);
  });
  test("dưới 2 điểm hoặc mọi x giống nhau => null", () => {
    expect(DGA.linearRegression([])).toBeNull();
    expect(DGA.linearRegression([{ x: 1, y: 1 }])).toBeNull();
    expect(DGA.linearRegression([{ x: 1, y: 1 }, { x: 1, y: 5 }])).toBeNull();
  });
  test("y không đổi => slope 0, R² = 1 (không chia cho 0)", () => {
    const r = DGA.linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]);
    expect(r.slope).toBeCloseTo(0);
    expect(r.r2).toBe(1);
  });
  test("dữ liệu nhiễu => 0 ≤ R² < 1", () => {
    const r = DGA.linearRegression([{ x: 0, y: 0 }, { x: 1, y: 3 }, { x: 2, y: 1 }, { x: 3, y: 4 }]);
    expect(r.r2).toBeGreaterThanOrEqual(0);
    expect(r.r2).toBeLessThan(1);
  });
});

describe("theilSenSlope — trung vị độ dốc, bền với điểm ngoại lai", () => {
  test("có 1 điểm ngoại lai: Theil–Sen vẫn ≈ 1, OLS bị kéo lệch mạnh", () => {
    const pts = [0, 1, 2, 3, 4].map((x, i) => ({ x, y: i === 4 ? 100 : x }));
    expect(DGA.theilSenSlope(pts)).toBeCloseTo(1);
    expect(DGA.linearRegression(pts).slope).toBeGreaterThan(10);
  });
  test("số cặp chẵn lấy trung bình 2 giá trị giữa; không có cặp x khác nhau => null", () => {
    expect(DGA.theilSenSlope([{ x: 0, y: 0 }, { x: 1, y: 2 }])).toBeCloseTo(2);
    expect(DGA.theilSenSlope([{ x: 1, y: 0 }, { x: 1, y: 2 }])).toBeNull();
    expect(DGA.theilSenSlope([])).toBeNull();
  });
});

describe("consecutiveAverageSlope — trung bình tốc độ các đoạn liền kề", () => {
  test("(0,0) (1,1) (3,5): các đoạn 1 và 2 => trung bình 1,5", () => {
    expect(DGA.consecutiveAverageSlope([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 3, y: 5 }])).toBeCloseTo(1.5);
  });
  test("dưới 2 điểm hoặc mọi đoạn có dx = 0 => null", () => {
    expect(DGA.consecutiveAverageSlope([{ x: 0, y: 0 }])).toBeNull();
    expect(DGA.consecutiveAverageSlope([{ x: 1, y: 0 }, { x: 1, y: 5 }])).toBeNull();
  });
});

describe("forecastGasTrend", () => {
  const hist = [
    { date: "2020-01-01", value: 10 },
    { date: "2021-01-01", value: 20 },
    { date: "2022-01-01", value: 30 },
  ];

  test("dưới 2 điểm hợp lệ => ok:false, not_enough_data", () => {
    expect(DGA.forecastGasTrend([], 3, 100)).toMatchObject({ ok: false, reason: "not_enough_data" });
    expect(DGA.forecastGasTrend([{ date: "2020-01-01", value: 1 }], 3, 100)).toMatchObject({ ok: false, n: 1 });
  });
  test("bỏ qua điểm rỗng/không phải số/ngày sai", () => {
    const messy = [...hist, { date: "2023-01-01", value: "" }, { date: "2023-06-01", value: null }, { date: "không phải ngày", value: 5 }, { date: "", value: 5 }];
    expect(DGA.forecastGasTrend(messy, 3, 100).n).toBe(3);
  });
  test("mọi lần đo cùng 1 ngày => ok:false (same_date)", () => {
    const same = [{ date: "2020-01-01", value: 1 }, { date: "2020-01-01", value: 5 }];
    expect(DGA.forecastGasTrend(same, 3, 100)).toMatchObject({ ok: false, reason: "same_date" });
  });
  test("không cần sắp sẵn theo ngày — hàm tự sắp", () => {
    const shuffled = [hist[2], hist[0], hist[1]];
    const a = DGA.forecastGasTrend(shuffled, 3, 100);
    const b = DGA.forecastGasTrend(hist, 3, 100);
    expect(a.methods.ols.ratePerYear).toBeCloseTo(b.methods.ols.ratePerYear);
    expect(a.lastValue).toBe(30);
  });
  test("tăng đều ~10 ppm/năm: cả 3 thuật toán ≈ 10, dự báo sau 1 năm ≈ 40", () => {
    const f = DGA.forecastGasTrend(hist, 1, null);
    expect(f.ok).toBe(true);
    ["ols", "theilsen", "consecutive", "average"].forEach((k) => {
      expect(f.methods[k].ratePerYear).toBeCloseTo(10, 0);
      expect(f.methods[k].forecastValue).toBeCloseTo(40, 0);
    });
    expect(f.methods.ols.r2).toBeGreaterThan(0.999);
    expect(f.methods.theilsen.r2).toBeNull();
  });
  test("mốc chạm ngưỡng: ngưỡng 50 từ giá trị cuối 30, tốc độ ~10/năm => ~2 năm sau", () => {
    const f = DGA.forecastGasTrend(hist, 3, 50);
    const c = f.methods.ols.crossing;
    expect(c.status).toBe("predicted");
    expect(c.yearsFromLast).toBeCloseTo(2, 0);
    expect(c.withinHorizon).toBe(true);
  });
  test("ngưỡng ngoài tầm dự báo => withinHorizon = false", () => {
    const c = DGA.forecastGasTrend(hist, 1, 50).methods.ols.crossing;
    expect(c.status).toBe("predicted");
    expect(c.withinHorizon).toBe(false);
  });
  test("đã vượt ngưỡng => already_exceeded (kể cả đúng bằng ngưỡng)", () => {
    expect(DGA.forecastGasTrend(hist, 3, 25).methods.ols.crossing.status).toBe("already_exceeded");
    expect(DGA.forecastGasTrend(hist, 3, 30).methods.ols.crossing.status).toBe("already_exceeded");
  });
  test("xu hướng không tăng => not_increasing", () => {
    const down = [{ date: "2020-01-01", value: 30 }, { date: "2021-01-01", value: 20 }, { date: "2022-01-01", value: 10 }];
    expect(DGA.forecastGasTrend(down, 3, 100).methods.ols.crossing.status).toBe("not_increasing");
  });
  test("không có ngưỡng => crossing = null", () => {
    expect(DGA.forecastGasTrend(hist, 3, null).methods.ols.crossing).toBeNull();
    expect(DGA.forecastGasTrend(hist, 3, undefined).limit).toBeNull();
  });
});
