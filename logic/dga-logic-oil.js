/* dga-logic-oil.js — Phần 3/6 của dga-logic.js sau khi tách theo miền (xem
   dga-logic.js). Đánh giá thí nghiệm dầu cách điện MBA/Kháng dầu (Bảng 54/55/58) và
   dầu khoang điều áp dưới tải OLTC (Điều 37/Bảng 49) — dùng các bảng hằng số từ
   dga-logic-core.js. */

function evaluateOltcOilTest({ oltcSamplePoint, voltageClass, oilState, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards }) {
  const state = oilState === "new" ? "new" : "inservice";

  if (state === "new") {
    const result = evaluateOilTest({ voltageClass, oilState: state, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards });
    return {
      overall: result.overall,
      rows: result.rows.map((r) => ({
        ...r,
        label: r.label + " (OLTC)",
        ref: r.ref + " — dầu OLTC mới lắp áp dụng như dầu chính MBA (Điều 37 QĐ1901)",
      })),
    };
  }

  const point = oltcSamplePoint === "pharieng" ? "pharieng" : "trungtinh";
  const limits = point === "trungtinh" ? BANG49_OLTC.trungtinh : BANG49_OLTC.pharieng[voltageClass];
  const refBase = REGULATION_CITATIONS.BANG49_OLTC + (point === "trungtinh" ? " — điểm cuối trung tính" : " — một pha/điểm không trung tính");
  const noDataRef = "QĐ1901 Bảng 49 không có số liệu cho cấp điện áp này — chưa đủ căn cứ, cần tham khảo hướng dẫn nhà sản xuất";

  const rows = [];
  if (hasVal(moisture)) {
    const v = Number(moisture);
    const lim = limits && hasVal(limits.moisture) ? limits.moisture : null;
    rows.push({
      key: "moisture", label: "Độ ẩm dầu OLTC", value: v, limit: lim, unit: "ppm", direction: "le",
      verdict: lim === null ? "Không có ngưỡng" : v <= lim ? "Đạt" : "Không đạt",
      ref: limits === null ? noDataRef : lim === null ? refBase + " — không quy định ngưỡng độ ẩm ở bậc này" : refBase,
    });
  }
  if (hasVal(tgd90)) {
    const v = Number(tgd90);
    rows.push({
      key: "tgd90", label: "Tổn hao điện môi tgδ (90°C) OLTC", value: v, limit: null, unit: "%", direction: "le",
      verdict: "Không có ngưỡng",
      ref: "QĐ1901 Bảng 49 không quy định ngưỡng tgδ cho dầu OLTC khi vận hành — chỉ ghi nhận để theo dõi xu hướng",
    });
  }
  if (hasVal(bdv)) {
    const v = Number(bdv);
    const lim = limits && hasVal(limits.bdv) ? limits.bdv : null;
    rows.push({
      key: "bdv", label: "Điện áp chọc thủng dầu OLTC", value: v, limit: lim, unit: "kV", direction: "ge",
      verdict: lim === null ? "Không có ngưỡng" : v >= lim ? "Đạt" : "Không đạt",
      ref: limits === null ? noDataRef : refBase,
    });
  }

  const overall = rows.length === 0 ? "Chưa đủ dữ liệu" : rows.some((r) => r.verdict === "Không đạt") ? "Không đạt" : "Đạt";
  return { rows, overall };
}

/**
 * Chọn ngưỡng áp dụng cho 3 hạng mục dầu — ưu tiên tiêu chuẩn NHÀ SẢN XUẤT nếu có
 * cấu hình khớp đúng (manufacturer + cấp điện áp + trạng thái dầu), ngược lại dùng
 * bảng QĐ1901 mặc định. Cho phép ghi đè TỪNG hạng mục riêng lẻ (khác với tiêu chuẩn
 * khí — vốn yêu cầu đủ 7 khí mới coi là "tiêu chuẩn nhà sản xuất") vì 1 lần thử
 * nghiệm dầu có thể chỉ đo 1-2 trong 3 hạng mục.
 * @param {object} manufacturerOilStandards { manufacturer, voltageClass, oilState, moisture, tgd90, bdv, source }
 */
function resolveOilLimits({ voltageClass, oilState, hasMembraneN2, manufacturer }, manufacturerOilStandards) {
  const state = oilState === "new" ? "new" : "inservice";
  const bdvDefault = (BANG54_BDV[voltageClass] || BANG54_BDV["220"])[state];
  const tgdDefault = (BANG55_TGD90[voltageClass] || BANG55_TGD90["220"])[state];
  const waterDefault = bang58WaterLimits(voltageClass, !!hasMembraneN2)[state];

  const match = (manufacturerOilStandards || []).find(
    (s) => s.manufacturer === manufacturer && s.voltageClass === voltageClass && s.oilState === state
  );

  function pick(manufVal, defaultVal, defaultRef) {
    if (match && hasVal(manufVal)) {
      return {
        limit: Number(manufVal),
        ref: `Tiêu chuẩn nhà sản xuất: ${match.manufacturer}${match.source ? " (" + match.source + ")" : ""}`,
        isManufacturer: true,
      };
    }
    return { limit: defaultVal, ref: defaultRef, isManufacturer: false };
  }

  return {
    moisture: pick(match && match.moisture, waterDefault, REGULATION_CITATIONS.BANG58_WATER),
    tgd90: pick(match && match.tgd90, tgdDefault, REGULATION_CITATIONS.BANG55_TGD90),
    bdv: pick(match && match.bdv, bdvDefault, REGULATION_CITATIONS.BANG54_BDV),
  };
}

/**
 * Đánh giá 1 lần thử nghiệm dầu MBA theo QĐ1901 (hoặc tiêu chuẩn nhà sản xuất nếu
 * có cấu hình khớp — xem resolveOilLimits()). Chỉ đánh giá các hạng mục có nhập giá
 * trị (moisture/tgd90/bdv có thể để trống nếu chưa đo hạng mục đó).
 * oilState: "new" (dầu mới, sau lắp đặt/sau sửa chữa) hoặc "inservice" (dầu vận hành).
 * manufacturer/manufacturerOilStandards: tùy chọn — bỏ qua thì luôn dùng QĐ1901.
 */
function evaluateOilTest({ voltageClass, oilState, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards }) {
  const state = oilState === "new" ? "new" : "inservice";
  const resolved = resolveOilLimits({ voltageClass, oilState: state, hasMembraneN2, manufacturer }, manufacturerOilStandards);

  const rows = [];
  if (hasVal(moisture)) {
    const v = Number(moisture);
    const { limit, ref, isManufacturer } = resolved.moisture;
    rows.push({
      key: "moisture", label: "Độ ẩm dầu", value: v, limit, unit: "ppm",
      verdict: v <= limit ? "Đạt" : "Không đạt", direction: "le", ref, isManufacturer,
    });
  }
  if (hasVal(tgd90)) {
    const v = Number(tgd90);
    const { limit, ref, isManufacturer } = resolved.tgd90;
    rows.push({
      key: "tgd90", label: "Tổn hao điện môi tgδ (90°C)", value: v, limit, unit: "%",
      verdict: v <= limit ? "Đạt" : "Không đạt", direction: "le", ref, isManufacturer,
    });
  }
  if (hasVal(bdv)) {
    const v = Number(bdv);
    const { limit, ref, isManufacturer } = resolved.bdv;
    rows.push({
      key: "bdv", label: "Điện áp chọc thủng dầu", value: v, limit, unit: "kV",
      // Ngược hướng với 2 hạng mục trên: BDV càng CAO càng tốt, đạt khi >= giới hạn.
      verdict: v >= limit ? "Đạt" : "Không đạt", direction: "ge", ref, isManufacturer,
    });
  }

  const overall = rows.length === 0 ? "Chưa đủ dữ liệu" : rows.every((r) => r.verdict === "Đạt") ? "Đạt" : "Không đạt";
  return { rows, overall };
}

