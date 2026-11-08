// Dự báo xu hướng theo mô hình thống kê chuẩn: OLS (kiểm định t, khoảng dự báo 95%), độ dốc Sen +
// kiểm định Mann–Kendall (toàn chuỗi và giai đoạn gần đây), tốc độ 2 lần đo gần nhất (Bảng 65); phát
// hiện khí giảm đột ngột (nghi lọc/thay dầu) và cắt chuỗi số liệu từ lần xử lý dầu gần nhất. Giá trị tham chiếu tính bằng SciPy 1.18
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

describe("latestPairSlope — tốc độ 2 lần đo gần nhất (Bảng 65)", () => {
  test("lấy 2 lần đo cuối có ngày khác nhau", () => {
    expect(DGA.latestPairSlope([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 25 }])).toBeCloseTo(2);
    expect(DGA.latestPairSlope([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 10, y: 7 }])).toBeCloseTo(0.7);
    expect(DGA.latestPairSlope([{ x: 1, y: 0 }, { x: 1, y: 5 }])).toBeNull();
  });
});

describe("khí giảm đột ngột — nghi lọc/thay dầu", () => {
  const before = { H2: 40, CH4: 30, C2H6: 20, C2H4: 10, C2H2: 0, CO: 300, CO2: 2500 };
  test("lọc dầu: TDCG giảm ≥ 50% và ≥ 2 khí cùng giảm ≥ 50% → phát hiện (khóa chữ thường cũng đọc được)", () => {
    const d = DGA.detectGasDrop(before, { h2: 3, ch4: 2, c2h6: 1, c2h4: 1, c2h2: "KPH", co: 30, co2: 400 });
    expect(d.prevTdcg).toBe(400);
    expect(d.tdcg).toBe(37);
    expect(d.dropPct).toBeCloseTo(90.75, 6);
    expect(d.gases).toEqual(["H2", "CH4", "C2H6", "C2H4", "CO", "CO2"]);
  });
  test("giảm < 50%, TDCG lần trước < 30 ppm, hay chỉ 1 khí giảm → không hỏi", () => {
    expect(DGA.detectGasDrop(before, { ...before, CO: 200, H2: 25 })).toBeNull();
    expect(DGA.detectGasDrop({ H2: 10, CO: 15 }, { H2: 1, CO: 2 })).toBeNull();
    expect(DGA.detectGasDrop({ H2: 2, CO: 100, CO2: 3 }, { H2: 2, CO: 10, CO2: 3 })).toBeNull();
  });
  const recs = [
    { id: "a", sample_date: "2022-01-10", ...before },
    { id: "c", sample_date: "2024-01-10", H2: 5, CO: 40, CO2: 500, xu_ly_dau: "loc_dau" },
    { id: "b", sample_date: "2023-01-10", ...before, CO: 320 },
    { id: "d", sample_date: "2025-01-10", H2: 6, CO: 60, CO2: 600 },
  ];
  test("findGasDrops quét chuỗi (không cần sắp sẵn), kèm trạng thái xác nhận", () => {
    const out = DGA.findGasDrops(recs, (r) => r);
    expect(out).toHaveLength(1);
    expect(out[0].record.id).toBe("c");
    expect(out[0].prev.id).toBe("b");
    expect(out[0].status).toBe("loc_dau");
  });
  test("lastOilTreatmentDate: lần lọc/thay dầu GẦN NHẤT; 'khong' không tính", () => {
    expect(DGA.lastOilTreatmentDate(recs)).toBe(new Date("2024-01-10").toISOString());
    const more = [...recs, { sample_date: "2025-06-01", xu_ly_dau: "khong" }, { sample_date: "2023-06-01", xu_ly_dau: "thay_dau" }];
    expect(DGA.lastOilTreatmentDate(more)).toBe(new Date("2024-01-10").toISOString());
    expect(DGA.lastOilTreatmentDate([{ sample_date: "2024-01-10", xu_ly_dau: "khong" }])).toBeNull();
    expect(DGA.OIL_TREATMENT_LABELS).toEqual({ loc_dau: "Lọc dầu", thay_dau: "Thay dầu", khong: "Không xử lý dầu" });
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
    expect(f.methods.latest.ratePerYear).toBeCloseTo(((47 - 40) / 160) * 365.25, 6);
    expect(f.methods.latest.forecastValue).toBeCloseTo(47 + (7 / 160) * 3 * 365.25, 6);
    expect(f.methods.latest.significant).toBeNull();
    expect(f.sinceDate).toBeNull();
    expect(f.nBefore).toBe(0);
  });
  test("sau lọc/thay dầu (sinceDate): chỉ dùng các lần đo từ mốc đó", () => {
    const since = new Date(dateOf(900)).toISOString();
    const f = DGA.forecastGasTrend(hist, 3, null, { sinceDate: since });
    expect(f.n).toBe(4);
    expect(f.nBefore).toBe(6);
    expect(f.sinceDate).toBe(since);
    const r = DGA.linearRegression(REF.slice(6).map((p) => ({ x: p.x - 900, y: p.y })));
    expect(f.methods.ols.ratePerYear).toBeCloseTo(r.slope * 365.25, 9);
    const one = DGA.forecastGasTrend(hist, 3, null, { sinceDate: dateOf(1460) });
    expect(one).toMatchObject({ ok: false, reason: "not_enough_data", n: 1, nBefore: 9 });
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
    ["ols", "sen", "latest"].forEach((k) => {
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

describe("forecastLimitWarning — cảnh báo vượt giá trị điển hình (thay cột 'Dự kiến đạt ngưỡng')", () => {
  const dateOf = (days) => new Date(Date.UTC(2020, 0, 1) + days * 86400000).toISOString().slice(0, 10);
  const hist = REF.map((p) => ({ date: dateOf(p.x), value: p.y }));
  test("xu hướng tăng có ý nghĩa + mốc trong số năm dự báo → cảnh báo theo Sen", () => {
    const w = DGA.forecastLimitWarning(DGA.forecastGasTrend(hist, 3, 60));
    expect(w).toMatchObject({ status: "predicted", method: "sen" });
    expect(w.yearsFromLast).toBeLessThanOrEqual(3);
    expect(w.pValue).toBeLessThan(0.05);
  });
  test("mốc ngoài số năm dự báo → không cảnh báo", () => {
    expect(DGA.forecastLimitWarning(DGA.forecastGasTrend(hist, 1, 80))).toBeNull();
  });
  test("lần đo gần nhất đã vượt ngưỡng → exceeded; không có ngưỡng / chuỗi nhiễu → null", () => {
    expect(DGA.forecastLimitWarning(DGA.forecastGasTrend(hist, 3, 47))).toEqual({ status: "exceeded" });
    expect(DGA.forecastLimitWarning(DGA.forecastGasTrend(hist, 3, null))).toBeNull();
    const noisy = [5, 7, 4, 6, 5, 7, 4, 7].map((v, i) => ({ date: dateOf(i * 200), value: v }));
    expect(DGA.forecastLimitWarning(DGA.forecastGasTrend(noisy, 30, 8))).toBeNull();
  });
});
