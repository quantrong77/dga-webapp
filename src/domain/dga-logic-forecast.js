/* dga-logic-forecast.js — Phần 5/6 của dga-logic.js sau khi tách theo miền (xem
   dga-logic.js). Dự báo xu hướng khí theo các mô hình thống kê CHUẨN:
     (1) Hồi quy tuyến tính OLS — kèm sai số chuẩn, kiểm định t cho độ dốc và KHOẢNG DỰ BÁO 95%
         (Student t, n − 2 bậc tự do);
     (2) Ước lượng độ dốc Sen (Theil–Sen) + kiểm định xu hướng Mann–Kendall (phi tham số, có hiệu
         chỉnh giá trị trùng) — cặp phương pháp tiêu chuẩn cho chuỗi số liệu giám sát lấy mẫu không
         đều, ít điểm, có điểm bất thường (Sen 1968; Mann 1945; Kendall 1975; Gilbert 1987);
     (3) Tốc độ giữa 2 lần đo gần nhất — đúng cách tính tốc độ tăng của Bảng 65 Điều 54 QĐ1901,
         giữ làm tham chiếu nghiệp vụ.
   Hoàn toàn độc lập — không phụ thuộc dga-logic-core.js hay module nào khác. */

// ---------------------------------------------------------------------------
// QUAN TRỌNG: đây CHỈ là công cụ THAM KHẢO thống kê hỗ trợ ra quyết định — KHÔNG PHẢI kết luận
// chính thức theo QĐ1901 (Điều 3 yêu cầu đánh giá TỔNG HỢP: tiêu chuẩn, các pha/thiết bị cùng
// loại, giá trị xuất xưởng, hướng dẫn NSX, diễn biến vận hành...). Giả định của mô hình tuyến
// tính: tốc độ sinh khí giữ nguyên trong tương lai — có thể sai khi có sự cố đột biến, lọc/thay
// dầu, đổi chế độ vận hành. Vì vậy:
//   - dự báo lấy từ ĐƯỜNG ĐÃ KHỚP (không neo vào 1 lần đo đơn lẻ có sai số);
//   - kèm khoảng dự báo 95% (OLS) và khoảng tin cậy 95% của độ dốc (Sen);
//   - chỉ coi là "có xu hướng" khi kiểm định có ý nghĩa thống kê (p < FORECAST_ALPHA);
//   - nồng độ dự báo không âm (cắt tại 0, có cờ clamped).
// ---------------------------------------------------------------------------

const FORECAST_MS_PER_DAY = 86400000;
const FORECAST_DAYS_PER_YEAR = 365.25;
const FORECAST_ALPHA = 0.05; // mức ý nghĩa 5% (độ tin cậy 95%)
const FORECAST_MK_MIN_N = 4; // Mann–Kendall: dưới 4 điểm không thể đạt p < 0,05 → "chưa đủ dữ liệu"

// ---------------------------- Hàm phân phối -----------------------------------
/** Hàm phân phối chuẩn tắc Φ(z) — xấp xỉ erf của Abramowitz & Stegun 7.1.26 (sai số < 1,5e-7). */
function normalCdf(z) {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Nghịch đảo Φ — thuật toán Acklam (sai số tương đối < 1,2e-9). */
function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** ln Γ(x) — xấp xỉ Lanczos (g = 7, 9 hệ số). */
function logGamma(x) {
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let s = g[0];
  for (let i = 1; i < 9; i++) s += g[i] / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
}

/** Hàm beta không đầy đủ chuẩn hóa I_x(a, b) — phân số liên tục (Lentz), như Numerical Recipes betacf. */
function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx, aa, bb) => {
    const TINY = 1e-300;
    let c = 1;
    let d = 1 - ((aa + bb) * xx) / (aa + 1);
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let num = (m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2));
      d = 1 + num * d; if (Math.abs(d) < TINY) d = TINY;
      c = 1 + num / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d; h *= d * c;
      num = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1));
      d = 1 + num * d; if (Math.abs(d) < TINY) d = TINY;
      c = 1 + num / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (front * cf(x, a, b)) / a : 1 - (front * cf(1 - x, b, a)) / b;
}

/** Hàm phân phối Student t với df bậc tự do: P(T ≤ t). */
function studentTCdf(t, df) {
  const x = df / (df + t * t);
  const tail = 0.5 * regularizedIncompleteBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Phân vị Student t: t sao cho P(T ≤ t) = p (chia đôi — studentTCdf đơn điệu). */
function studentTQuantile(p, df) {
  if (p === 0.5) return 0;
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-10) break;
  }
  return (lo + hi) / 2;
}

function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------------------- (1) OLS -----------------------------------------
/**
 * Hồi quy tuyến tính bình phương tối thiểu y = intercept + slope·x. Ngoài slope/intercept/r2/n
 * trả thêm (khi n ≥ 3): s (sai số chuẩn của phần dư, n − 2 bậc tự do), seSlope, tSlope,
 * pSlope (kiểm định t hai phía H0: slope = 0), meanX, sxx — dùng cho khoảng dự báo
 * (olsPredictionInterval). Trả về null nếu < 2 điểm hoặc mọi x giống nhau.
 * @param {Array<{x:number, y:number}>} points
 */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  points.forEach((p) => {
    sxy += (p.x - meanX) * (p.y - meanY);
    sxx += (p.x - meanX) * (p.x - meanX);
  });
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  const out = { slope, intercept, r2, n, meanX, sxx, df: n - 2, s: null, seSlope: null, tSlope: null, pSlope: null };
  if (n >= 3) {
    const s = Math.sqrt(ssRes / (n - 2));
    const seSlope = s / Math.sqrt(sxx);
    out.s = s;
    out.seSlope = seSlope;
    if (seSlope > 0) {
      out.tSlope = slope / seSlope;
      out.pSlope = 2 * (1 - studentTCdf(Math.abs(out.tSlope), n - 2));
    } else {
      out.tSlope = slope === 0 ? 0 : Infinity;
      out.pSlope = slope === 0 ? 1 : 0; // khớp hoàn hảo
    }
  }
  return out;
}

/** Khoảng dự báo (prediction interval) 1 − α cho 1 lần đo MỚI tại x0:
 *  ŷ ± t(1−α/2, n−2) · s · √(1 + 1/n + (x0 − x̄)² / Sxx). Null nếu n < 3. */
function olsPredictionInterval(reg, x0, alpha = FORECAST_ALPHA) {
  if (!reg || reg.s === null || reg.df < 1) return null;
  const yhat = reg.intercept + reg.slope * x0;
  const tq = studentTQuantile(1 - alpha / 2, reg.df);
  const half = tq * reg.s * Math.sqrt(1 + 1 / reg.n + (x0 - reg.meanX) ** 2 / reg.sxx);
  return { lower: yhat - half, upper: yhat + half };
}

// ---------------------------- (2) Sen + Mann–Kendall -------------------------
/** Độ dốc Theil–Sen = trung vị độ dốc mọi cặp điểm (i < j, x_i ≠ x_j). Null nếu không có cặp nào. */
function theilSenSlope(points) {
  const slopes = pairwiseSlopes(points);
  return slopes.length === 0 ? null : median(slopes);
}

function pairwiseSlopes(points) {
  const slopes = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      if (dx !== 0) slopes.push((points[j].y - points[i].y) / dx);
    }
  }
  return slopes;
}

/**
 * Kiểm định xu hướng Mann–Kendall (hai phía) trên chuỗi đã sắp theo thời gian.
 * S = Σ sign(y_j − y_i) (i < j, bỏ cặp cùng thời điểm); Var(S) hiệu chỉnh nhóm giá trị trùng:
 * [n(n−1)(2n+5) − Σ t(t−1)(2t+5)] / 18; Z có hiệu chỉnh liên tục (S ∓ 1)/√Var; p = 2(1 − Φ(|Z|));
 * tau = S / (n(n−1)/2). direction: "increasing" | "decreasing" | "none" (p ≥ α) | "insufficient" (n < 4).
 * @param {Array<{x:number, y:number}>} points ĐÃ sắp tăng dần theo x
 */
function mannKendallTest(points, alpha = FORECAST_ALPHA) {
  const n = points.length;
  let S = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (points[j].x === points[i].x) continue;
      const d = points[j].y - points[i].y;
      S += d > 0 ? 1 : d < 0 ? -1 : 0;
    }
  }
  const groups = {};
  points.forEach((p) => { groups[p.y] = (groups[p.y] || 0) + 1; });
  const tieTerm = Object.values(groups).reduce((s, t) => s + (t > 1 ? t * (t - 1) * (2 * t + 5) : 0), 0);
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  let z = 0;
  if (varS > 0) z = S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0;
  const p = varS > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;
  const tau = n > 1 ? S / ((n * (n - 1)) / 2) : 0;
  let direction = "none";
  if (n < FORECAST_MK_MIN_N) direction = "insufficient";
  else if (p < alpha) direction = S > 0 ? "increasing" : "decreasing";
  return { n, S, varS, z, p, tau, direction, alpha };
}

/** Sen's slope + intercept (median(y) − slope·median(x), như scipy.stats.theilslopes) + khoảng tin
 *  cậy 1 − α của độ dốc theo Gilbert (1987): C = z(1−α/2)·√Var(S), M1 = (N′ − C)/2, M2 = (N′ + C)/2. */
function senSlopeEstimate(points, varS, alpha = FORECAST_ALPHA) {
  const slopes = pairwiseSlopes(points).sort((a, b) => a - b);
  if (slopes.length === 0) return null;
  const slope = median(slopes);
  const intercept = median(points.map((p) => p.y)) - slope * median(points.map((p) => p.x));
  let lower = null;
  let upper = null;
  if (varS > 0) {
    const C = normalQuantile(1 - alpha / 2) * Math.sqrt(varS);
    const N = slopes.length;
    const m1 = Math.round((N - C) / 2);
    const m2 = Math.round((N + C) / 2) + 1;
    if (m1 >= 1 && m2 <= N) {
      lower = slopes[m1 - 1];
      upper = slopes[m2 - 1];
    }
  }
  return { slope, intercept, lower, upper };
}

// ---------------------------- (3) Tốc độ 2 lần đo gần nhất --------------------
/** Tốc độ (đơn vị y / đơn vị x) giữa 2 lần đo gần nhất có thời điểm khác nhau — cách tính tốc độ tăng
 *  của Bảng 65 QĐ1901. Null nếu không có 2 thời điểm khác nhau. points ĐÃ sắp tăng dần theo x. */
function latestPairSlope(points) {
  const last = points[points.length - 1];
  for (let i = points.length - 2; i >= 0; i--) {
    const dx = last.x - points[i].x;
    if (dx !== 0) return (last.y - points[i].y) / dx;
  }
  return null;
}

const FORECAST_METHOD_LABELS = {
  ols: "Hồi quy tuyến tính OLS (khoảng dự báo 95%)",
  sen: "Độ dốc Sen + kiểm định Mann–Kendall",
  latest: "Tốc độ 2 lần đo gần nhất (cách tính Bảng 65)",
};

/**
 * Dự báo xu hướng 1 thông số (khí) theo 3 phương pháp (FORECAST_METHOD_LABELS).
 * @param {Array<{date: string|Date, value: number|string|null|undefined}>} history (không cần sắp sẵn;
 *   điểm rỗng/không phải số/ngày sai bị loại)
 * @param {number} forecastYears số năm ngoại suy (vd 3)
 * @param {number|null} limit ngưỡng đang áp dụng (null nếu không có)
 * @returns {object} { ok:false, reason, n } hoặc
 *   { ok:true, n, lastValue, lastDate, limit, trend (kết quả Mann–Kendall), methods:{ols, sen, latest} }
 *   — mỗi method (null nếu không tính được): { label, ratePerYear, fittedAtLast (giá trị của mô hình tại
 *   lần đo gần nhất — điểm đầu đường dự báo trên đồ thị), forecastValue (≥ 0), clamped,
 *   forecastDate, interval ({lower, upper} — OLS: khoảng dự báo 95% của giá trị; Sen: khoảng tin
 *   cậy 95% của tốc độ ppm/năm; null nếu không tính được), r2 (chỉ OLS), pValue (OLS: kiểm định t
 *   độ dốc; Sen: Mann–Kendall; latest: null), significant (p < α; latest: null), crossing }
 *   crossing: null (không có ngưỡng) | {status:"already_exceeded"} | {status:"not_increasing"} |
 *   {status:"predicted", date, withinHorizon, yearsFromLast, significant}.
 */
function forecastGasTrend(history, forecastYears, limit) {
  const pts = (history || [])
    .filter((h) => h && h.value !== null && h.value !== undefined && h.value !== "" && h.date)
    .map((h) => ({ date: new Date(h.date), value: Number(h.value) }))
    .filter((h) => Number.isFinite(h.value) && !Number.isNaN(h.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (pts.length < 2) return { ok: false, reason: "not_enough_data", n: pts.length };

  const t0 = pts[0].date.getTime();
  const xy = pts.map((p) => ({ x: (p.date.getTime() - t0) / FORECAST_MS_PER_DAY, y: p.value }));
  const lastPoint = pts[pts.length - 1];
  const lastX = xy[xy.length - 1].x;
  const horizonDays = forecastYears * FORECAST_DAYS_PER_YEAR;
  const horizonX = lastX + horizonDays;
  const forecastDate = new Date(lastPoint.date.getTime() + horizonDays * FORECAST_MS_PER_DAY).toISOString();

  const ols = linearRegression(xy);
  const mk = mannKendallTest(xy);
  const sen = senSlopeEstimate(xy, mk.varS);
  const latest = latestPairSlope(xy);
  if (!ols && !sen && latest === null) return { ok: false, reason: "same_date", n: pts.length };

  const hasLimit = limit !== null && limit !== undefined && Number.isFinite(Number(limit));
  const limitNum = hasLimit ? Number(limit) : null;

  // Thời điểm đạt ngưỡng theo 1 ĐƯỜNG y = a + b·x (đường khớp của OLS/Sen, hoặc đường đi qua lần
  // đo gần nhất của phương pháp "latest"). Đã vượt ngưỡng xét theo GIÁ TRỊ ĐO THỰC TẾ gần nhất.
  function crossingFor(a, b, significant) {
    if (!hasLimit) return null;
    if (lastPoint.value >= limitNum) return { status: "already_exceeded" };
    if (!(b > 0)) return { status: "not_increasing" };
    const daysFromLast = Math.max(0, (limitNum - a) / b - lastX);
    return {
      status: "predicted",
      date: new Date(lastPoint.date.getTime() + daysFromLast * FORECAST_MS_PER_DAY).toISOString(),
      withinHorizon: daysFromLast <= horizonDays,
      yearsFromLast: daysFromLast / FORECAST_DAYS_PER_YEAR,
      significant,
    };
  }
  const clamp0 = (v) => (v < 0 ? 0 : v);

  const methods = { ols: null, sen: null, latest: null };
  if (ols) {
    const raw = ols.intercept + ols.slope * horizonX;
    const pi = olsPredictionInterval(ols, horizonX);
    const significant = ols.pSlope === null ? null : ols.pSlope < FORECAST_ALPHA;
    methods.ols = {
      label: FORECAST_METHOD_LABELS.ols,
      ratePerYear: ols.slope * FORECAST_DAYS_PER_YEAR,
      fittedAtLast: clamp0(ols.intercept + ols.slope * lastX),
      forecastValue: clamp0(raw),
      clamped: raw < 0,
      forecastDate,
      interval: pi ? { lower: clamp0(pi.lower), upper: clamp0(pi.upper) } : null,
      r2: ols.r2,
      pValue: ols.pSlope,
      significant,
      crossing: crossingFor(ols.intercept, ols.slope, significant),
    };
  }
  if (sen) {
    const raw = sen.intercept + sen.slope * horizonX;
    const significant = mk.direction === "insufficient" ? null : mk.p < FORECAST_ALPHA;
    methods.sen = {
      label: FORECAST_METHOD_LABELS.sen,
      ratePerYear: sen.slope * FORECAST_DAYS_PER_YEAR,
      fittedAtLast: clamp0(sen.intercept + sen.slope * lastX),
      forecastValue: clamp0(raw),
      clamped: raw < 0,
      forecastDate,
      interval: sen.lower === null ? null
        : { lower: sen.lower * FORECAST_DAYS_PER_YEAR, upper: sen.upper * FORECAST_DAYS_PER_YEAR },
      r2: null,
      pValue: mk.direction === "insufficient" ? null : mk.p,
      significant,
      crossing: crossingFor(sen.intercept, sen.slope, significant),
    };
  }
  if (latest !== null) {
    const raw = lastPoint.value + latest * horizonDays;
    methods.latest = {
      label: FORECAST_METHOD_LABELS.latest,
      ratePerYear: latest * FORECAST_DAYS_PER_YEAR,
      fittedAtLast: lastPoint.value,
      forecastValue: clamp0(raw),
      clamped: raw < 0,
      forecastDate,
      interval: null,
      r2: null,
      pValue: null,
      significant: null,
      crossing: crossingFor(lastPoint.value - latest * lastX, latest, null),
    };
  }

  return {
    ok: true,
    n: pts.length,
    lastValue: lastPoint.value,
    lastDate: lastPoint.date.toISOString(),
    limit: limitNum,
    trend: mk,
    methods,
  };
}
