/* dga-logic-forecast.js — Phần 5/6 của dga-logic.js sau khi tách theo miền (xem
   dga-logic.js). Dự báo xu hướng khí bằng ngoại suy tuyến tính (OLS/Theil-Sen/trung
   bình liền kề). Hoàn toàn độc lập — không phụ thuộc dga-logic-core.js hay module nào
   khác. */

// ---------------------------------------------------------------------------
// Dự báo xu hướng (ngoại suy tuyến tính) — dùng lịch sử đo của TỪNG khí để ước lượng
// tốc độ thay đổi trung bình (hồi quy tuyến tính bình phương tối thiểu) rồi ngoại suy
// ra tương lai theo số năm người dùng chọn, và (nếu có ngưỡng đang áp dụng) ước tính
// thời điểm dự kiến đạt ngưỡng đó. QUAN TRỌNG: đây CHỈ là công cụ THAM KHẢO thống kê hỗ
// trợ ra quyết định — KHÔNG PHẢI kết luận chính thức theo QĐ1901 (Điều 3 yêu cầu đánh
// giá TỔNG HỢP nhiều yếu tố — tiêu chuẩn, các pha/thiết bị cùng loại, giá trị xuất
// xưởng, hướng dẫn NSX, diễn biến thực tế... — không chỉ ngoại suy số học đơn thuần).
// Giả định CỐT LÕI của phép ngoại suy tuyến tính: tốc độ sinh khí trung bình quan sát
// được trong quá khứ giữ NGUYÊN không đổi trong tương lai — giả định này có thể sai khi
// có sự cố đột biến, can thiệp sửa chữa/xử lý dầu (lọc dầu, thay dầu), hoặc thay đổi chế
// độ vận hành giữa các lần đo. Người dùng cần tự đánh giá thêm bối cảnh thực tế, không
// nên dùng kết quả dự báo này làm căn cứ DUY NHẤT để ra quyết định.
// ---------------------------------------------------------------------------

const FORECAST_MS_PER_DAY = 86400000;
const FORECAST_DAYS_PER_YEAR = 365.25;

/**
 * Hồi quy tuyến tính đơn giản (bình phương tối thiểu) trên các điểm {x, y} sao cho
 * y ≈ intercept + slope * x. Trả về thêm r2 (hệ số xác định, 0..1 — càng gần 1 thì
 * đường thẳng khớp dữ liệu càng tốt, giúp người dùng tự đánh giá độ tin cậy của dự báo)
 * và n (số điểm dùng để hồi quy). Trả về null nếu <2 điểm hoặc mọi x giống nhau (vd tất
 * cả các lần đo cùng 1 ngày — không tính được độ dốc theo thời gian).
 * @param {Array<{x:number, y:number}>} points
 */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  points.forEach((p) => {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) * (p.x - meanX);
  });
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2, n };
}

/**
 * Theil–Sen — TRUNG VỊ (median) độ dốc của TẤT CẢ các cặp điểm (i<j, x_i ≠ x_j). Là ước
 * lượng độ dốc PHI THAM SỐ (non-parametric) kinh điển, thường dùng để kiểm chứng chéo với
 * OLS vì KHÔNG bị 1 điểm đo bất thường (outlier) kéo lệch nhiều như OLS — do lấy trung vị
 * thay vì trung bình có trọng số bình phương. Trả về null nếu không có cặp điểm nào có
 * x khác nhau (không tính được độ dốc theo thời gian).
 * @param {Array<{x:number, y:number}>} points
 */
function theilSenSlope(points) {
  const slopes = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      if (dx === 0) continue;
      slopes.push((points[j].y - points[i].y) / dx);
    }
  }
  if (slopes.length === 0) return null;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 === 0 ? (slopes[mid - 1] + slopes[mid]) / 2 : slopes[mid];
}

/**
 * Trung bình tốc độ giữa các lần đo LIỀN KỀ (khác Theil-Sen ở trên: chỉ lấy từng ĐOẠN
 * LIỀN KỀ i→i+1, không lấy mọi cặp điểm) — cùng nguyên lý với tính năng "So sánh tốc độ
 * gia tăng khí giữa 2 lần đo" (tab Lịch sử đo, Bảng 65 QĐ1901) đã có sẵn trong app, chỉ
 * khác là lấy trung bình NHIỀU đoạn liền kề trong toàn bộ lịch sử thay vì chỉ 2 lần đo
 * gần nhất — phản ánh tốc độ gần đây rõ hơn OLS/Theil-Sen (vốn coi trọng toàn bộ lịch sử
 * như nhau), phù hợp khi tốc độ sinh khí đổi dần theo thời gian.
 * @param {Array<{x:number, y:number}>} points ĐÃ sort tăng dần theo x
 */
function consecutiveAverageSlope(points) {
  if (points.length < 2) return null;
  const rates = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    if (dx === 0) continue;
    rates.push((points[i].y - points[i - 1].y) / dx);
  }
  if (rates.length === 0) return null;
  return rates.reduce((s, r) => s + r, 0) / rates.length;
}

const FORECAST_METHOD_LABELS = {
  ols: "Hồi quy tuyến tính OLS (bình phương tối thiểu)",
  theilsen: "Theil–Sen (trung vị độ dốc từng cặp điểm)",
  consecutive: "Trung bình tốc độ giữa các lần đo liền kề",
  average: "Trung bình 3 thuật toán",
};

/**
 * Dự báo xu hướng 1 thông số (khí) bằng ĐỒNG THỜI 3 thuật toán ước lượng tốc độ độc lập
 * (xem FORECAST_METHOD_LABELS) rồi ngoại suy TỪ GIÁ TRỊ ĐO GẦN NHẤT theo tốc độ mỗi
 * thuật toán ước lượng được — dùng CÙNG 1 điểm neo (lần đo gần nhất) cho cả 3 để kết quả
 * có thể so sánh trực tiếp với nhau (khác biệt DUY NHẤT giữa 3 kết quả là tốc độ ước
 * lượng được, không phải cách ngoại suy). Cột "Trung bình 3 thuật toán" chỉ đơn giản là
 * ngoại suy lại bằng tốc độ TRUNG BÌNH CỘNG của 3 thuật toán trên — không phải 1 thuật
 * toán độc lập, mà là 1 cách tổng hợp/đối chiếu chéo giúp giảm ảnh hưởng của 1 thuật toán
 * bị lệch (vd Theil-Sen ổn định hơn khi có outlier, nhưng OLS phản ánh đúng xu hướng
 * chung hơn khi dữ liệu đều) — xem ghi chú tổng quan ở đầu khối này về giới hạn/giả định
 * chung của MỌI phép ngoại suy tuyến tính (giả định tốc độ không đổi trong tương lai).
 * @param {Array<{date: string|Date, value: number|null|undefined}>} history lịch sử đo
 *   (không cần sort sẵn — hàm tự sort tăng dần theo ngày); các điểm value rỗng/null bị
 *   loại bỏ trước khi tính (đúng nguyên tắc "số liệu trống thì không đánh giá").
 * @param {number} forecastYears số năm muốn ngoại suy tới (vd 3, 5, 10)
 * @param {number|null} limit ngưỡng đang áp dụng cho thông số này (vd standard.limits[gas]
 *   từ resolveStandard()), null nếu không xác định được ngưỡng để so sánh.
 * @returns {object} { ok:false, reason } nếu không đủ dữ liệu, hoặc
 *   { ok:true, n, lastValue, lastDate, limit, methods:{ols,theilsen,consecutive,average} }
 *   — mỗi method (null nếu bản thân thuật toán đó không tính được, vd Theil-Sen/consecutive
 *   không thể xảy ra khi đã có ≥2 điểm nên trong thực tế luôn có giá trị) gồm:
 *   { label, ratePerYear, r2 (chỉ OLS có, còn lại null), forecastValue, forecastDate,
 *     crossing } — crossing giống hệt cấu trúc của bản 1-thuật-toán trước đây (null /
 *     {status:"already_exceeded"} / {status:"not_increasing"} / {status:"predicted",
 *     date, withinHorizon, yearsFromLast}).
 */
function forecastGasTrend(history, forecastYears, limit) {
  const pts = (history || [])
    .filter((h) => h && h.value !== null && h.value !== undefined && h.value !== "" && h.date)
    .map((h) => ({ date: new Date(h.date), value: Number(h.value) }))
    .filter((h) => Number.isFinite(h.value) && !Number.isNaN(h.date.getTime()))
    .sort((a, b) => a.date - b.date);

  if (pts.length < 2) {
    return { ok: false, reason: "not_enough_data", n: pts.length };
  }

  const t0 = pts[0].date.getTime();
  const regPoints = pts.map((p) => ({ x: (p.date.getTime() - t0) / FORECAST_MS_PER_DAY, y: p.value }));
  const lastPoint = pts[pts.length - 1];
  const lastX = regPoints[regPoints.length - 1].x;
  const horizonDays = lastX + forecastYears * FORECAST_DAYS_PER_YEAR;

  const olsReg = linearRegression(regPoints);
  const rawSlopes = {
    ols: olsReg ? olsReg.slope : null,
    theilsen: theilSenSlope(regPoints),
    consecutive: consecutiveAverageSlope(regPoints),
  };
  if (Object.values(rawSlopes).every((s) => s === null)) {
    return { ok: false, reason: "same_date", n: pts.length };
  }

  const hasLimit = limit !== null && limit !== undefined && Number.isFinite(Number(limit));
  const limitNum = hasLimit ? Number(limit) : null;

  // Ngoại suy TỪ ĐIỂM ĐO GẦN NHẤT theo 1 tốc độ (ppm/ngày) cho trước — dùng CHUNG cho cả
  // 3 thuật toán lẫn cột "trung bình" để đảm bảo chỉ khác nhau ở tốc độ ước lượng, không
  // khác cách ngoại suy (xem ghi chú ở đầu hàm).
  function extrapolateFrom(slopePerDay, r2) {
    if (slopePerDay === null || !Number.isFinite(slopePerDay)) return null;
    const ratePerYear = slopePerDay * FORECAST_DAYS_PER_YEAR;
    const forecastValue = lastPoint.value + slopePerDay * (horizonDays - lastX);
    const forecastDate = new Date(lastPoint.date.getTime() + (horizonDays - lastX) * FORECAST_MS_PER_DAY);
    let crossing = null;
    if (hasLimit) {
      if (lastPoint.value >= limitNum) {
        crossing = { status: "already_exceeded" };
      } else if (slopePerDay <= 0) {
        crossing = { status: "not_increasing" };
      } else {
        const crossDaysFromLast = (limitNum - lastPoint.value) / slopePerDay;
        crossing = {
          status: "predicted",
          date: new Date(lastPoint.date.getTime() + crossDaysFromLast * FORECAST_MS_PER_DAY).toISOString(),
          withinHorizon: crossDaysFromLast <= horizonDays - lastX,
          yearsFromLast: crossDaysFromLast / FORECAST_DAYS_PER_YEAR,
        };
      }
    }
    return { ratePerYear, r2: r2 ?? null, forecastValue, forecastDate: forecastDate.toISOString(), crossing };
  }

  const methods = {
    ols: extrapolateFrom(rawSlopes.ols, olsReg ? olsReg.r2 : null),
    theilsen: extrapolateFrom(rawSlopes.theilsen, null),
    consecutive: extrapolateFrom(rawSlopes.consecutive, null),
  };
  Object.keys(methods).forEach((k) => {
    if (methods[k]) methods[k].label = FORECAST_METHOD_LABELS[k];
  });

  // "Trung bình 3 thuật toán" — trung bình cộng tốc độ của các thuật toán TÍNH ĐƯỢC (bỏ
  // qua method null, dù trong thực tế với ≥2 điểm cả 3 đều luôn tính được), rồi ngoại suy
  // lại bằng extrapolateFrom() y hệt các thuật toán trên để đảm bảo nhất quán công thức.
  const validSlopes = Object.values(rawSlopes).filter((s) => s !== null && Number.isFinite(s));
  const avgSlope = validSlopes.length > 0 ? validSlopes.reduce((s, v) => s + v, 0) / validSlopes.length : null;
  methods.average = extrapolateFrom(avgSlope, null);
  if (methods.average) methods.average.label = FORECAST_METHOD_LABELS.average;

  return {
    ok: true,
    n: pts.length,
    lastValue: lastPoint.value,
    lastDate: lastPoint.date.toISOString(),
    limit: limitNum,
    methods,
  };
}

