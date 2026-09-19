/* dga-logic-instrument-oil.js — Phần 4/6 của dga-logic.js sau khi tách theo miền
   (xem dga-logic.js). Đánh giá thí nghiệm dầu cách điện TI/TU theo tiêu chuẩn nhà sản
   xuất 2 tầng (Bình thường/Loại bỏ) — QĐ1901 Điều 10/11 không có bảng mặc định cho
   hạng mục này. Dùng hasVal() từ dga-logic-core.js. */

// ---------------------------------------------------------------------------
// 7bis) Dầu cách điện TI/TU (biến dòng điện/biến điện áp kiểu kín, cách điện dầu) —
// QĐ1901 Điều 10 (Bảng 9, mục 12) VÀ Điều 11 (Bảng 14, mục 11) đều ghi CHÚ THÍCH a
// giống hệt nhau cho hạng mục "Thí nghiệm dầu cách điện": "Thực hiện theo quy định
// của nhà sản xuất trong điều kiện kỹ thuật cho phép" — nghĩa là KHÁC HẲN dầu MBA
// (có sẵn Bảng 54/55/58 làm mặc định), QĐ1901 KHÔNG tự đưa ra số liệu Độ ẩm/tgδ ở
// 90°C/Điện áp chọc thủng cho dầu TI/TU — bắt buộc phải có tiêu chuẩn nhà sản xuất
// mới đánh giá được. Theo đúng nguyên tắc "không tự suy diễn ngưỡng" (xem skill
// electrical-testing-1901), evaluateInstrumentOilTest() KHÔNG có bảng mặc định nào
// để dự phòng — thiếu tiêu chuẩn nhà sản xuất thì trả "Chưa có tiêu chuẩn nhà sản
// xuất" cho hạng mục đó thay vì tự bịa số.
//
// Hỗ trợ 2 MỨC ngưỡng độc lập cho mỗi hạng mục — đúng cấu trúc thường gặp ở tài
// liệu nhà sản xuất (ví dụ Haefely Trench cho TI): "normal conditions/concentrations"
// (ngưỡng bình thường) và "limits — units to be taken out of service" (ngưỡng loại
// bỏ, nghiêm trọng hơn). Vượt ngưỡng bình thường nhưng CHƯA vượt ngưỡng loại bỏ (và
// ngưỡng loại bỏ CÓ được cấu hình, phân biệt được 2 vùng) => "Cảnh báo"; vượt luôn
// ngưỡng loại bỏ => "Không đạt"; chỉ cấu hình 1 trong 2 mức thì mức đó coi là ngưỡng
// duy nhất (vượt => "Không đạt" luôn, giống ngữ nghĩa 1-mức của dầu MBA).
// ---------------------------------------------------------------------------

/** Đánh giá verdict 1 hạng mục dầu TI/TU theo 2 mức ngưỡng (bình thường/loại bỏ).
 *  direction "le": càng THẤP càng tốt (Độ ẩm, tgδ). direction "ge": càng CAO càng
 *  tốt (Điện áp chọc thủng). */
function verdictTwoTierOil(value, normalLimit, rejectLimit, direction) {
  const hasNormal = hasVal(normalLimit);
  const hasReject = hasVal(rejectLimit);
  if (!hasNormal && !hasReject) return "Chưa có tiêu chuẩn nhà sản xuất";
  const exceedsNormal = hasNormal && (direction === "ge" ? value < normalLimit : value > normalLimit);
  const exceedsReject = hasReject && (direction === "ge" ? value < rejectLimit : value > rejectLimit);
  if (exceedsReject) return "Không đạt";
  if (!exceedsNormal) return "Đạt";
  return hasReject ? "Cảnh báo" : "Không đạt"; // chỉ có 1 mức (bình thường) => coi như ngưỡng tuyệt đối
}

/** Tìm tiêu chuẩn nhà sản xuất khớp (manufacturer + equipmentType) trong danh sách
 *  đã cấu hình cho dầu — xem toOilStandardsForLogic() ở ui-standards.js (đã bổ sung
 *  equipmentType/moistureReject/tgd90Reject/bdvReject). Khác resolveOilLimits() (dầu
 *  MBA) ở chỗ KHÔNG so khớp theo cấp điện áp/trạng thái dầu — bảng NSX ví dụ (Haefely
 *  Trench) không phân theo 2 trục đó, và QĐ1901 cũng không đặt ra cấu trúc nào khác
 *  để mô phỏng theo cho TI/TU. */
function resolveInstrumentOilLimits(equipmentType, manufacturer, manufacturerOilStandards) {
  return (manufacturerOilStandards || []).find(
    (s) => s.manufacturer === manufacturer && s.equipmentType === equipmentType
  ) || null;
}

/**
 * @param {"TI (biến dòng điện)"|"TU (biến điện áp)"} equipmentType EQUIPMENT_TYPES.TI/TU
 * @param {object} manufacturerOilStandards xem toOilStandardsForLogic() — cần thêm equipmentType/*Reject
 */
function evaluateInstrumentOilTest({ equipmentType, manufacturer, manufacturerOilStandards, moisture, tgd90, bdv }) {
  const match = resolveInstrumentOilLimits(equipmentType, manufacturer, manufacturerOilStandards);
  const refBase = match
    ? `Tiêu chuẩn nhà sản xuất: ${match.manufacturer}${match.source ? " (" + match.source + ")" : ""}`
    : "Chưa cấu hình tiêu chuẩn nhà sản xuất cho thiết bị này — QĐ1901 Điều 10/11 không quy định ngưỡng số cho dầu TI/TU (thực hiện theo quy định nhà sản xuất), cần bổ sung ở tab \"Cấu hình\" — mục \"Tiêu chuẩn\"";

  function limitText(normalLimit, rejectLimit, direction) {
    const parts = [];
    if (hasVal(normalLimit)) parts.push("Bình thường " + (direction === "ge" ? "≥ " : "≤ ") + normalLimit);
    if (hasVal(rejectLimit)) parts.push("Loại bỏ " + (direction === "ge" ? "< " : "> ") + rejectLimit);
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  const rows = [];
  if (hasVal(moisture)) {
    const v = Number(moisture);
    const normalLimit = match ? match.moisture : null;
    const rejectLimit = match ? match.moistureReject : null;
    rows.push({
      key: "moisture", label: "Độ ẩm dầu", value: v, direction: "le", unit: "ppm",
      limit: limitText(normalLimit, rejectLimit, "le"),
      verdict: verdictTwoTierOil(v, normalLimit, rejectLimit, "le"), ref: refBase,
    });
  }
  if (hasVal(tgd90)) {
    const v = Number(tgd90);
    const normalLimit = match ? match.tgd90 : null;
    const rejectLimit = match ? match.tgd90Reject : null;
    rows.push({
      key: "tgd90", label: "Tổn hao điện môi tgδ (90°C)", value: v, direction: "le", unit: "%",
      limit: limitText(normalLimit, rejectLimit, "le"),
      verdict: verdictTwoTierOil(v, normalLimit, rejectLimit, "le"), ref: refBase,
    });
  }
  if (hasVal(bdv)) {
    const v = Number(bdv);
    const normalLimit = match ? match.bdv : null;
    const rejectLimit = match ? match.bdvReject : null;
    rows.push({
      key: "bdv", label: "Điện áp chọc thủng dầu", value: v, direction: "ge", unit: "kV",
      limit: limitText(normalLimit, rejectLimit, "ge"),
      verdict: verdictTwoTierOil(v, normalLimit, rejectLimit, "ge"), ref: refBase,
    });
  }

  let overall;
  if (rows.length === 0) overall = "Chưa đủ dữ liệu";
  else if (rows.every((r) => r.verdict === "Chưa có tiêu chuẩn nhà sản xuất")) overall = "Chưa có tiêu chuẩn nhà sản xuất";
  else if (rows.some((r) => r.verdict === "Không đạt")) overall = "Không đạt";
  else if (rows.some((r) => r.verdict === "Cảnh báo")) overall = "Cảnh báo";
  else overall = "Đạt";

  return { rows, overall };
}

