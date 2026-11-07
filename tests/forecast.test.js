// Dự báo xu hướng theo mô hình thống kê chuẩn: OLS (kiểm định t, khoảng dự báo 95%), độ dốc Sen +
// kiểm định Mann–Kendall (toàn chuỗi và giai đoạn gần đây). Giá trị tham chiếu tính bằng SciPy 1.18
// (scipy.stats.linregress / theilslopes / t.ppf / norm.cdf) trên cùng chuỗi số liệu.
const { DGA } = require("./helpers");

// Chuỗi tham chiếu: x = ngày kể từ lần đo đầu, y = ppm (tăng ~6 ppm/năm, có nhiễu)
const REF = [0, 90, 200, 380, 500, 730, 900, 1100, 1300, 1460].map((x, i) => ({
  x, y: [20, 24, 23, 30, 29, 35, 33, 41, 40, 47][i],
}));

describe("hàm phân phối (đối chiếu bảng tra / SciPy)", () => {
  test.each([
    [0.975, 1, 12.7062], [0.975, 2, 4.3027], [0.975, 10, 2.2281], [0.975, 30, 2.0423], [0.95, 5, 2.015],
  ])("t-quantile(%p, df=%i) = %f", (p, df, expected) => {
    expect(DGA.studentTQuantile(p, df)).toBeCloseTo(expected, 3);
  });
  test("Student t CDF và Φ chuẩn tắc", () => {
    expect(DGA.studentTCdf(2.0, 5)).toBeCloseTo(0.94903, 5);
    expect(DGA.studentTCdf(-2.0, 5)).toBeCloseTo(0.05097, 5);
    expect(DGA.normalCdf(1.96)).toBeCloseTo(0.975, 5);
    expect(DGA.normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(DGA.normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
  });
});

describe("linearRegression (OLS) — khớp scipy.stats.linregress", () => {
  test("chuỗi tham chiếu: slope, intercept, R², p-value kiểm định t", () => {
    const r = DGA.linearRegression(REF);
    expect(r.slope).toBeCloseTo(0.01645139075517334, 12);
    expect(r.intercept).toBeCloseTo(21.243373757054556, 9);
    expect(r.r2).toBeCloseTo(0.9456170584010873, 10);
    expect(r.pSlope).toBeCloseTo(2.445579236215806e-6, 10);
    expect(r.n).toBe(10);
  });
  test("khoảng dự báo 95% sau 3 năm kể từ lần đo cuối", () => {
    const r = DGA.linearRegression(REF);
    const pi = DGA.olsPredictionInterval(r, 1460 + 3 * 365.25);
    expect(pi.lower).toBeCloseTo(55.285834399892536, 6);
    expect(pi.upper).toBeCloseTo(71.2921969592851, 6);
  });
  test("đường thẳng chính xác: R² = 1, p = 0; y không đổi: slope 0, p = 1", () => {
    const exact = DGA.linearRegression([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 4 }]);
    expect(exact.slope).toBeCloseTo(2);
    expect(exact.r2).toBeCloseTo(1);
    expect(exact.pSlope).toBe(0);
    const flat = DGA.linearRegression([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]);
    expect(flat.slope).toBeCloseTo(0);
    expect(flat.pSlope).toBe(1);
  });
  test("2 điểm: có slope nhưng không có sai số chuẩn / khoảng dự báo", () => {
    const r = DGA.linearRegression([{ x: 0, y: 1 }, { x: 1, y: 3 }]);
    expect(r.slope).toBeCloseTo(2);
    expect(r.pSlope).toBeNull();
    expect(DGA.olsPredictionInterval(r, 5)).toBeNull();
  });
  test("dưới 2 điểm hoặc mọi x giống nhau => null", () => {
    expect(DGA.linearRegression([])).toBeNull();
    expect(DGA.linearRegression([{ x: 1, y: 1 }])).toBeNull();
    expect(DGA.linearRegression([{ x: 1, y: 1 }, { x: 1, y: 5 }])).toBeNull();
  });
});

describe("độ dốc Sen + Mann–Kendall — khớp scipy.stats.theilslopes", () => {
  test("chuỗi tham chiếu: slope, intercept, KTC 95% của độ dốc", () => {
    const mk = DGA.mannKendallTest(REF);
    const s = DGA.senSlopeEstimate(REF, mk.varS);
    expect(s.slope).toBeCloseTo(0.016666666666666666, 12);
    expect(s.intercept).toBeCloseTo(21.25, 10);
    expect(s.lower).toBeCloseTo(0.01375, 12);
    expect(s.upper).toBeCloseTo(0.02, 12);
  });
  test("Mann–Kendall: S = 37, p = 0,00128 (hai phía, hiệu chỉnh liên tục) → xu hướng tăng", () => {
    const mk = DGA.mannKendallTest(REF);
    expect(mk.S).toBe(37);
    expect(mk.p).toBeCloseTo(0.0012821837418053317, 6);
    expect(mk.direction).toBe("increasing");
    expect(mk.tau).toBeCloseTo(37 / 45, 10);
  });
  test("giá trị trùng: Var(S) trừ phần hiệu chỉnh nhóm trùng", () => {
    const pts = [1, 2, 2, 2, 3, 4].map((y, x) => ({ x, y }));
    const n = 6;
    expect(DGA.mannKendallTest(pts).varS).toBeCloseTo((n * (n - 1) * (2 * n + 5) - 3 * 2 * 11) / 18, 10);
  });
  test("dưới 4 điểm => insufficient; chuỗi nhiễu không xu hướng => none", () => {
    expect(DGA.mannKendallTest([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }]).direction).toBe("insufficient");
    const noisy = [5, 7, 4, 6, 5, 7, 4, 6].map((y, x) => ({ x, y }));
    expect(DGA.mannKendallTest(noisy).direction).toBe("none");
  });
  test("bền với điểm ngoại lai: Sen ≈ 1 trong khi OLS bị kéo lệch", () => {
    const pts = [0, 1, 2, 3, 4].map((x, i) => ({ x, y: i === 4 ? 100 : x }));
    expect(DGA.theilSenSlope(pts)).toBeCloseTo(1);
    expect(DGA.linearRegression(pts).slope).toBeGreaterThan(10);
  });
});

describe("recentWindowStart — cửa sổ giai đoạn gần đây (3 năm, tối thiểu 5 lần đo)", () => {
  const Y = 365.25;
  test("đủ 5 lần đo trong 3 năm → bắt đầu từ lần đo đầu trong 3 năm", () => {
    const pts = [0, 1, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6].map((t) => ({ x: t * Y, y: 0 }));
    expect(DGA.recentWindowStart(pts)).toBe(3); // x ≥ 3 năm: 3, 3.5, …, 6 → 7 lần đo
  });
  test("3 năm có ít hơn 5 lần đo → lùi để có 5 lần đo gần nhất", () => {
    const pts = [0, 1, 2, 3, 4, 5, 6].map((t) => ({ x: t * Y, y: 0 }));
    expect(DGA.recentWindowStart(pts)).toBe(2); // 3 năm chỉ có 4 lần đo (3..6) → lấy 5 lần từ chỉ số 2
  });
  test("chuỗi ≤ 5 lần đo → 0 (cửa sổ trùm cả chuỗi)", () => {
    expect(DGA.recentWindowStart([0, 1, 2, 3, 4].map((t) => ({ x: t * Y, y: 0 })))).toBe(0);
  });
  test("n = 5 là cỡ mẫu nhỏ nhất Mann–Kendall có thể đạt p < 0,05", () => {
    const mono = (n) => DGA.mannKendallTest(Array.from({ length: n }, (_, i) => ({ x: i, y: i }))).p;
    expect(mono(4)).toBeGreaterThan(0.05);
    expect(mono(5)).toBeLessThan(0.05);
    expect(DGA.FORECAST_RECENT_MIN_N).toBe(5);
    expect(DGA.FORECAST_RECENT_YEARS).toBe(3);
  });
});

describe("forecastGasTrend", () => {
  const dateOf = (days) => new Date(Date.UTC(2020, 0, 1) + days * 86400000).toISOString().slice(0, 10);
  const hist = REF.map((p) => ({ date: dateOf(p.x), value: p.y }));

  test("dưới 2 điểm hợp lệ => ok:false; mọi lần đo cùng ngày => same_date", () => {
    expect(DGA.forecastGasTrend([], 3, 100)).toMatchObject({ ok: false, reason: "not_enough_data" });
    expect(DGA.forecastGasTrend([{ date: "2020-01-01", value: 1 }], 3, 100)).toMatchObject({ ok: false, n: 1 });
    expect(DGA.forecastGasTrend([{ date: "2020-01-01", value: 1 }, { date: "2020-01-01", value: 5 }], 3, 100))
      .toMatchObject({ ok: false, reason: "same_date" });
  });
  test("bỏ điểm rỗng/không phải số/ngày sai; không cần sắp sẵn", () => {
    const messy = [hist[3], ...hist.slice(0, 3), ...hist.slice(4), { date: "2030-01-01", value: "" }, { date: "sai", value: 5 }];
    const f = DGA.forecastGasTrend(messy, 3, null);
    expect(f.n).toBe(10);
    expect(f.lastValue).toBe(47);
  });
  test("dự báo lấy từ ĐƯỜNG ĐÃ KHỚP (không neo vào lần đo cuối) + khoảng dự báo OLS", () => {
    const f = DGA.forecastGasTrend(hist, 3, null);
    const r = DGA.linearRegression(REF);
    const xh = 1460 + 3 * 365.25;
    expect(f.methods.ols.forecastValue).toBeCloseTo(r.intercept + r.slope * xh, 6);
    expect(f.methods.ols.fittedAtLast).toBeCloseTo(r.intercept + r.slope * 1460, 6);
    expect(f.methods.ols.interval.lower).toBeCloseTo(55.285834399892536, 5);
    expect(f.methods.ols.significant).toBe(true);
    expect(f.methods.sen.forecastValue).toBeCloseTo(21.25 + (1 / 60) * xh, 6);
    expect(f.methods.sen.interval.lower).toBeCloseTo(0.01375 * 365.25, 6);
    expect(f.trend.direction).toBe("increasing");
  });
  test("giai đoạn gần đây = Sen + Mann–Kendall trên cửa sổ; tốc độ phù hợp toàn chuỗi", () => {
    const f = DGA.forecastGasTrend(hist, 3, null);
    // lần đo cuối x = 1460; 3 năm = 1095,75 ngày → x ≥ 364,25: 7 lần đo (380 … 1460)
    const win = REF.slice(3);
    expect(f.recentWindow.n).toBe(7);
    expect(f.recentWindow.fromDate).toBe(new Date(dateOf(380)).toISOString());
    const mk = DGA.mannKendallTest(win);
    const s = DGA.senSlopeEstimate(win, mk.varS);
    expect(f.methods.recent.ratePerYear).toBeCloseTo(s.slope * 365.25, 9);
    expect(f.methods.recent.pValue).toBeCloseTo(mk.p, 12);
    expect(f.rateChange).toBe("consistent");
  });
  test("tốc độ tăng mạnh gần đây → rateChange = faster; chuỗi ngắn → không có giai đoạn gần", () => {
    const vals = [10, 11, 10, 12, 11, 12, 13, 12, 20, 28, 37, 46];
    const acc = vals.map((v, i) => ({ date: dateOf(i * 182), value: v }));
    const f = DGA.forecastGasTrend(acc, 3, null);
    expect(f.methods.recent.ratePerYear).toBeGreaterThan(f.methods.sen.interval.upper);
    expect(f.rateChange).toBe("faster");
    expect(f.methods.recent.significant).toBe(true);
    const short = DGA.forecastGasTrend(hist.slice(0, 5), 3, null);
    expect(short.methods.recent).toBeNull();
    expect(short.recentWindow).toBeNull();
    expect(short.rateChange).toBeNull();
  });
  test("nồng độ dự báo không âm: giảm mạnh => cắt tại 0, clamped = true, cận dưới KDB ≥ 0", () => {
    const down = [40, 30, 22, 12, 5].map((v, i) => ({ date: dateOf(i * 365), value: v }));
    const f = DGA.forecastGasTrend(down, 5, null);
    ["ols", "sen"].forEach((k) => {
      expect(f.methods[k].forecastValue).toBe(0);
      expect(f.methods[k].clamped).toBe(true);
    });
    expect(f.methods.ols.interval.lower).toBeGreaterThanOrEqual(0);
  });
  test("mốc đạt ngưỡng theo đường khớp; đánh dấu khi xu hướng chưa có ý nghĩa thống kê", () => {
    const f = DGA.forecastGasTrend(hist, 3, 60);
    const c = f.methods.ols.crossing;
    const r = DGA.linearRegression(REF);
    expect(c.status).toBe("predicted");
    expect(c.yearsFromLast).toBeCloseTo(((60 - r.intercept) / r.slope - 1460) / 365.25, 6);
    expect(c.significant).toBe(true);
    const noisy = [5, 7, 4, 6, 5, 7, 4, 7].map((v, i) => ({ date: dateOf(i * 200), value: v }));
    const cn = DGA.forecastGasTrend(noisy, 3, 50).methods.sen.crossing;
    if (cn.status === "predicted") expect(cn.significant).toBe(false);
  });
  test("đã vượt ngưỡng (theo lần đo thực tế) / không tăng / không có ngưỡng", () => {
    expect(DGA.forecastGasTrend(hist, 3, 47).methods.ols.crossing.status).toBe("already_exceeded");
    const down = [30, 20, 10].map((v, i) => ({ date: dateOf(i * 365), value: v }));
    expect(DGA.forecastGasTrend(down, 3, 100).methods.ols.crossing.status).toBe("not_increasing");
    expect(DGA.forecastGasTrend(hist, 3, null).methods.ols.crossing).toBeNull();
    expect(DGA.forecastGasTrend(hist, 3, undefined).limit).toBeNull();
  });
  test("ngưỡng ngoài tầm dự báo => withinHorizon = false", () => {
    const c = DGA.forecastGasTrend(hist, 1, 80).methods.ols.crossing;
    expect(c.status).toBe("predicted");
    expect(c.withinHorizon).toBe(false);
  });
});
