/* dga-logic-iec60422-2024.js — Đánh giá dầu cách điện (MBA/Kháng dầu VÀ TI/TU) theo
   IEC 60422:2024 (Edition 5) — TÁCH RIÊNG khỏi dga-logic-oil.js/dga-logic-instrument-
   oil.js vì đây là 1 HỆ THAM CHIẾU SONG SONG, độc lập với QĐ1901/tiêu chuẩn nhà sản
   xuất đã có — KHÔNG thay thế "Kết luận chung" hiện có của 2 tab dầu, chỉ hiển thị
   THÊM 1 khối "Tham khảo — IEC 60422:2024" bên cạnh.

   NGUỒN: người dùng cung cấp trực tiếp
   "C:\Users\quant\Documents\Claude\Project_I (danh gia DGA TI Trench)\data\
   IEC-60422-2024.md" (bản đầy đủ, Edition 5, xuất bản 2024) — số liệu dưới đây trích
   TRỰC TIẾP từ file này, KHÔNG dùng lại file xlsx tham khảo trước đó (file đó tự ghi
   là dẫn bản IEC 60422:2013 Edition 4.0 — bản CŨ hơn, không phải bản người dùng yêu
   cầu).

   CẤU TRÚC BẢN 2024: 3 mức Tốt/Cần theo dõi/Kém (Good/Fair/Poor), khác hẳn kiểu 2 mức
   Bình thường/Loại bỏ (Đạt/Cảnh báo/Không đạt) đã dùng cho tiêu chuẩn NSX TI/TU — NHƯNG
   verdictTwoTierOil() (dga-logic-instrument-oil.js) vừa khớp: truyền biên "Tốt" làm
   normalLimit và biên "Kém" làm rejectLimit là ra ĐÚNG 3 mức Đạt/Cảnh báo/Không đạt
   tương ứng Tốt/Cần theo dõi/Kém — không cần viết lại hàm verdict riêng.

   PHẠM VI ĐÃ CHỐT VỚI NGƯỜI DÙNG (không tự suy diễn thêm ngoài phạm vi này):
   - Bảng 5 (Transformers and reactors, Category A >170kV / B 72,5–170kV / C ≤72,5kV):
     dùng cho dầu MBA/Kháng — 3 hạng mục ĐÃ có sẵn trong app (độ ẩm, tgδ 90°C, BDV).
   - Bảng 7 (Instrument and protection transformers, Category D >170kV / E ≤170kV):
     dùng cho dầu TI/TU — CHỈ 2 hạng mục có số liệu TƯỜNG MINH theo D/E trong văn bản
     gốc (độ ẩm, tgδ 90°C). Với Điện áp chọc thủng, văn bản gốc CHỈ ghi "refer to the
     appropriate category in Table 5" — KHÔNG có ánh xạ D/E → A/B/C tường minh nào
     khác trong toàn bộ tài liệu (đã rà bằng grep, chỉ xuất hiện đúng 1 lần ở Bảng 1 —
     định nghĩa Category, không có ghi chú ánh xạ bổ sung ở đâu khác). Người dùng đã
     xác nhận muốn BỔ SUNG hạng mục này bằng cách SUY DIỄN Category D≈A (cùng biên
     >170kV) và E≈B (cùng biên trên 170kV) — đây là SUY DIỄN của ứng dụng, không phải
     số liệu tường minh của Bảng 7, LUÔN ghi rõ trong "Căn cứ" hiển thị cho người dùng.
   - CÁC HẠNG MỤC KHÁC của Bảng 5 (màu sắc, ngoại quan, độ chua, điện trở suất, sức
     căng bề mặt, hàm lượng chất ức chế/thụ động, cặn/bùn, lưu huỳnh ăn mòn, điểm chớp
     cháy, PCB...) KHÔNG đưa vào — app hiện KHÔNG có trường nhập liệu cho các hạng mục
     này ở cả 2 tab dầu MBA/TI-TU; bổ sung sẽ cần thêm form nhập liệu mới, ngoài phạm
     vi đã xác nhận lần này.

   ĐƠN VỊ tgδ (DDF): bản gốc ghi số liệu Bảng 5/7 dạng PHÂN SỐ THẬP PHÂN không kèm đơn
   vị trong bảng (vd "< 0,10"), nhưng Bảng 3 (dầu mới) ghi cùng đại lượng là "Max.
   0,010 / 0,015" — đối chiếu với QĐ1901 Bảng 55 (tgδ dầu MBA mới ~1,0–1,5%) cho thấy
   0,010–0,015 ĐÚNG LÀ 1,0–1,5% viết dạng phân số (không phải 0,010%) — vì vậy toàn bộ
   ngưỡng tgδ bên dưới đã QUY ĐỔI ×100 sang % để khớp đơn vị "%" đang dùng thống nhất
   trong app (tgd90/tgd20 hiện có). */

// ---------------------------------------------------------------------------
// Tham chiếu nguồn — thêm trực tiếp vào REGULATION_CITATIONS (dga-logic-core.js, đã
// nạp trước file này) để dùng chung cơ chế "sửa được qua Cấu hình → Quy định".
// ---------------------------------------------------------------------------
REGULATION_CITATIONS.IEC60422_2024_TABLE5_MBA = "IEC 60422:2024 Bảng 5 (Table 5), Category A/B/C — Transformers and reactors";
REGULATION_CITATIONS.IEC60422_2024_TABLE7_TITU = "IEC 60422:2024 Bảng 7 (Table 7), Category D/E — Instrument and protection transformers";
REGULATION_CITATIONS.IEC60422_2024_TITU_BDV_INFERRED =
  "IEC 60422:2024 Bảng 7 dẫn chiếu \"tham khảo hạng mục phù hợp ở Bảng 5\" cho Điện áp chọc thủng nhưng KHÔNG nêu ánh xạ D/E→A/B/C tường minh — " +
  "ứng dụng SUY DIỄN Category D≈A, E≈B (cùng biên >170kV) để có số tham khảo; đây KHÔNG phải số liệu tường minh của Bảng 7";

// ---------------------------------------------------------------------------
// Bảng 5 — dầu MBA/Kháng, theo Category A (>170kV) / B (72,5–170kV, gồm cả 110kV) /
// C (≤72,5kV). good = biên "Tốt", poor = biên "Kém" (giữa 2 biên = "Cần theo dõi").
// ---------------------------------------------------------------------------
const IEC60422_2024_TABLE5_MBA = {
  A: { bdv: { good: 60, poor: 50 }, moisture: { good: 15, poor: 20 }, tgd90: { good: 10, poor: 20 } },
  B: { bdv: { good: 50, poor: 40 }, moisture: { good: 20, poor: 30 }, tgd90: { good: 10, poor: 50 } },
  C: { bdv: { good: 40, poor: 30 }, moisture: { good: 30, poor: 40 }, tgd90: { good: 10, poor: 50 } },
};

const IEC60422_2024_CATEGORY_LABEL_MBA = {
  A: "Category A (MBA/Kháng > 170kV)",
  B: "Category B (MBA/Kháng > 72,5kV và ≤ 170kV)",
  C: "Category C (MBA/Kháng ≤ 72,5kV)",
};

// Ánh xạ TRỰC TIẾP từ DGA.OIL_VOLTAGE_CLASSES (đã dùng cho Bảng 54/55/58 QĐ1901) sang
// Category A/B/C của IEC 60422:2024 — dùng đúng biên Um do Bảng 1 quy định (>170kV=A,
// 72,5–170kV=B, ≤72,5kV=C). "tren35duoi110" (>35kV và <110kV) có thể vắt qua biên
// 72,5kV tùy thiết bị cụ thể — tạm xếp vào Category C (đa số MBA phân phối/trung áp ở
// bậc này thực tế ≤72,5kV); có thể sửa lại nếu 1 thiết bị cụ thể nằm trên 72,5kV, xem
// ghi chú ở getRegulationConfigRegistry() nếu cần mở rộng thành trường chọn tay sau này.
const OIL_VOLTAGE_CLASS_TO_IEC60422_CATEGORY = {
  duoi15: "C", "15den35": "C", tren35duoi110: "C", "110": "B", "220": "A", "500": "A",
};

function mapOilVoltageClassToIec60422Category(voltageClass) {
  return OIL_VOLTAGE_CLASS_TO_IEC60422_CATEGORY[voltageClass] || "C";
}

/** Đánh giá THAM KHẢO dầu MBA/Kháng theo IEC 60422:2024 Bảng 5 — hàm ĐỘC LẬP với
 *  evaluateOilTest() (QĐ1901), gọi thêm ở UI để hiển thị khối riêng, KHÔNG ảnh hưởng
 *  "Kết luận chung" theo QĐ1901 hiện có. */
function evaluateIec60422MbaOilTest({ voltageClass, moisture, tgd90, bdv }) {
  const category = mapOilVoltageClassToIec60422Category(voltageClass);
  const limits = IEC60422_2024_TABLE5_MBA[category];
  const refBase = REGULATION_CITATIONS.IEC60422_2024_TABLE5_MBA + " — " + IEC60422_2024_CATEGORY_LABEL_MBA[category];

  function limitText(good, poor, direction) {
    return "Tốt " + (direction === "ge" ? "≥ " : "≤ ") + good + " · Kém " + (direction === "ge" ? "< " : "> ") + poor;
  }

  const rows = [];
  if (hasVal(moisture)) {
    const v = Number(moisture);
    rows.push({
      key: "moisture", label: "Độ ẩm dầu", value: v, direction: "le", unit: "mg/kg (≈ppm)",
      limit: limitText(limits.moisture.good, limits.moisture.poor, "le"),
      verdict: verdictTwoTierOil(v, limits.moisture.good, limits.moisture.poor, "le"), ref: refBase,
    });
  }
  if (hasVal(tgd90)) {
    const v = Number(tgd90);
    rows.push({
      key: "tgd90", label: "Tổn hao điện môi tgδ (90°C)", value: v, direction: "le", unit: "%",
      limit: limitText(limits.tgd90.good, limits.tgd90.poor, "le"),
      verdict: verdictTwoTierOil(v, limits.tgd90.good, limits.tgd90.poor, "le"), ref: refBase,
    });
  }
  if (hasVal(bdv)) {
    const v = Number(bdv);
    rows.push({
      key: "bdv", label: "Điện áp chọc thủng dầu", value: v, direction: "ge", unit: "kV",
      limit: limitText(limits.bdv.good, limits.bdv.poor, "ge"),
      verdict: verdictTwoTierOil(v, limits.bdv.good, limits.bdv.poor, "ge"), ref: refBase,
    });
  }

  let overall;
  if (rows.length === 0) overall = "Chưa đủ dữ liệu";
  else if (rows.some((r) => r.verdict === "Không đạt")) overall = "Không đạt";
  else if (rows.some((r) => r.verdict === "Cảnh báo")) overall = "Cảnh báo";
  else overall = "Đạt";

  return { rows, overall, category, categoryLabel: IEC60422_2024_CATEGORY_LABEL_MBA[category] };
}

// ---------------------------------------------------------------------------
// Bảng 7 — dầu TI/TU, theo Category D (Um > 170kV) / E (Um ≤ 170kV). Độ ẩm + tgδ 90°C
// là số liệu TƯỜNG MINH của Bảng 7; BDV lấy từ IEC60422_2024_TABLE5_MBA (SUY DIỄN
// D≈A/E≈B — xem ghi chú citation IEC60422_2024_TITU_BDV_INFERRED ở trên).
// ---------------------------------------------------------------------------
const IEC60422_2024_TABLE7_TITU = {
  D: { moisture: { good: 20, poor: 30 }, tgd90: { good: 1, poor: 10 } },
  E: { moisture: { good: 30, poor: 40 }, tgd90: { good: 10, poor: 30 } },
};

const IEC60422_2024_CATEGORY_LABEL_TITU = {
  D: "Category D (TI/TU Um > 170kV)",
  E: "Category E (TI/TU Um ≤ 170kV)",
};

/** Category D/E chỉ phụ thuộc Um (kV) của CHÍNH TI/TU, KHÁC trục cấp điện áp
 *  OIL_VOLTAGE_CLASSES dùng cho dầu MBA — trả null nếu chưa nhập Um (chưa xác định
 *  được category thì KHÔNG đánh giá được, không tự đoán). */
function resolveIec60422TituCategory(umKv) {
  if (!hasVal(umKv)) return null;
  return Number(umKv) > 170 ? "D" : "E";
}

/** Đánh giá THAM KHẢO dầu TI/TU theo IEC 60422:2024 Bảng 7 (+ Bảng 5 suy diễn cho
 *  BDV) — hàm ĐỘC LẬP với evaluateInstrumentOilTest() (tiêu chuẩn nhà sản xuất), gọi
 *  thêm ở UI để hiển thị khối riêng, KHÔNG ảnh hưởng "Kết luận chung" theo NSX hiện có.
 *  @param {number|string|null} umKv cấp điện áp Um (kV) của TI/TU — BẮT BUỘC để xác
 *    định Category D/E; thiếu thì trả overall "Chưa có cấp điện áp Um".
 */
function evaluateIec60422TituOilTest({ umKv, moisture, tgd90, bdv }) {
  const category = resolveIec60422TituCategory(umKv);
  if (!category) {
    return { rows: [], overall: "Chưa có cấp điện áp Um", category: null, categoryLabel: null };
  }

  const explicitLimits = IEC60422_2024_TABLE7_TITU[category];
  const mbaCategory = category === "D" ? "A" : "B";
  const bdvLimits = IEC60422_2024_TABLE5_MBA[mbaCategory].bdv;
  const refExplicit = REGULATION_CITATIONS.IEC60422_2024_TABLE7_TITU + " — " + IEC60422_2024_CATEGORY_LABEL_TITU[category];
  const refBdvInferred = REGULATION_CITATIONS.IEC60422_2024_TITU_BDV_INFERRED + " (Category " + category + " ≈ " + mbaCategory + ")";

  function limitText(good, poor, direction) {
    return "Tốt " + (direction === "ge" ? "≥ " : "≤ ") + good + " · Kém " + (direction === "ge" ? "< " : "> ") + poor;
  }

  const rows = [];
  if (hasVal(moisture)) {
    const v = Number(moisture);
    rows.push({
      key: "moisture", label: "Độ ẩm dầu", value: v, direction: "le", unit: "mg/kg (≈ppm)",
      limit: limitText(explicitLimits.moisture.good, explicitLimits.moisture.poor, "le"),
      verdict: verdictTwoTierOil(v, explicitLimits.moisture.good, explicitLimits.moisture.poor, "le"), ref: refExplicit,
    });
  }
  if (hasVal(tgd90)) {
    const v = Number(tgd90);
    rows.push({
      key: "tgd90", label: "Tổn hao điện môi tgδ (90°C)", value: v, direction: "le", unit: "%",
      limit: limitText(explicitLimits.tgd90.good, explicitLimits.tgd90.poor, "le"),
      verdict: verdictTwoTierOil(v, explicitLimits.tgd90.good, explicitLimits.tgd90.poor, "le"), ref: refExplicit,
    });
  }
  if (hasVal(bdv)) {
    const v = Number(bdv);
    rows.push({
      key: "bdv", label: "Điện áp chọc thủng dầu (suy diễn)", value: v, direction: "ge", unit: "kV",
      limit: limitText(bdvLimits.good, bdvLimits.poor, "ge"),
      verdict: verdictTwoTierOil(v, bdvLimits.good, bdvLimits.poor, "ge"), ref: refBdvInferred,
    });
  }

  let overall;
  if (rows.length === 0) overall = "Chưa đủ dữ liệu";
  else if (rows.some((r) => r.verdict === "Không đạt")) overall = "Không đạt";
  else if (rows.some((r) => r.verdict === "Cảnh báo")) overall = "Cảnh báo";
  else overall = "Đạt";

  return { rows, overall, category, categoryLabel: IEC60422_2024_CATEGORY_LABEL_TITU[category] };
}
