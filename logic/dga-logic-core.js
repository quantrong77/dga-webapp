/* dga-logic-core.js — Phần 1/6 của dga-logic.js sau khi tách theo miền (2026-09,
   xem dga-logic.js đầu file để biết toàn bộ sơ đồ tách + lý do). File này là "từ điển
   dữ liệu" dùng CHUNG cho mọi module logic khác: enum loại thiết bị/pha, MỌI bảng
   ngưỡng số học gốc từ QĐ1901/IEC 60599:2022, và vài hàm tiện ích thuần túy gắn liền
   với 1 bảng cụ thể (bang58WaterLimits, pdThresholdForType, hasVal).

   QUAN TRỌNG: các module khác (dga-logic-gas.js, dga-logic-oil.js,
   dga-logic-instrument-oil.js, dga-logic-regulation-config.js) dùng ĐÚNG các object
   hằng số khai báo ở đây — KHÔNG được sao chép/nhân bản lại, vì cơ chế "Cấu hình quy
   định" (dga-logic-regulation-config.js: applyRegulationConfigOverride()) sửa TRỰC
   TIẾP property của các object này — nếu có 1 bản sao khác, override sẽ không phản
   ánh sang bản sao đó. */

const GASES = ["H2", "CH4", "C2H6", "C2H4", "C2H2", "CO", "CO2"];

// ---------------------------------------------------------------------------
// 1) Loại thiết bị
// ---------------------------------------------------------------------------

const EQUIPMENT_TYPES = {
  TI: "TI (biến dòng điện)",
  TU: "TU (biến điện áp)",
  MBA: "MBA/Kháng dầu",
  BUSHING: "Sứ xuyên (Bushing)",
  OTHER: "Khác",
};

// Pha của lần đo: đa số TI/TU/sứ xuyên tách riêng từng pha theo kết cấu vật lý (mỗi
// pha 1 sứ/1 khoang dầu riêng) nên chọn A/B/C như bình thường — nhưng một số MBA 3 pha
// kết cấu 1 THÙNG DẦU DÙNG CHUNG cho cả 3 pha thì không có mẫu tách riêng theo pha, nên
// thêm lựa chọn "chung3pha" để phản ánh đúng thực tế đó (tương tự cách OLTC_SAMPLE_POINTS
// bên dưới đã phân biệt "trungtinh" (chung) và "pharieng" (riêng) cho dầu OLTC).
const PHA_CHUNG_3_PHA = "chung3pha";
const PHA_OPTIONS = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
  { value: PHA_CHUNG_3_PHA, label: "Chung" },
];

/** Nhãn hiển thị NGẮN cho giá trị "pha" đã lưu — dùng ở nơi đã có tiêu đề cột/nhãn
 * "Pha" sẵn nên không cần lặp lại chữ đó (VD ô trong bảng Lịch sử đo). */
function phaLabel(value) {
  if (!value) return "";
  return value === PHA_CHUNG_3_PHA ? "Chung" : value;
}

/** Nhãn ĐẦY ĐỦ dùng ở nơi tự ghép thêm chữ "Pha " phía trước (VD "Pha A") — với
 * "chung3pha" KHÔNG lặp chữ "Pha" vì "Chung" đã tự nói rõ nghĩa rồi. */
function phaLabelWithPrefix(value) {
  if (!value) return "";
  return value === PHA_CHUNG_3_PHA ? "Chung" : "Pha " + value;
}

/** Phòng hờ hiển thị NGÀY LẤY MẪU (sample_date và các trường "ngày" tương tự — luôn là
 *  chuỗi "yyyy-MM-dd" thuần do <input type="date"> gửi lên) — Google Sheets TỰ ĐỘNG nhận
 *  diện chuỗi dạng đó là ngày tháng và âm thầm đổi ô thành kiểu Date; lần đọc lại trả về
 *  chuỗi ISO đầy đủ kèm giờ/UTC (VD "2026-08-25T17:00:00.000Z") thay vì "2026-08-25"
 *  thuần — hiện nguyên ra bảng trông như dữ liệu sai/thiếu. Đã fix TẬN GỐC ở BACKEND
 *  (rowToObject(), gsheet/Code.gs — format lại đúng "yyyy-MM-dd" theo múi giờ spreadsheet
 *  trước khi trả JSON), nhưng cần Admin bấm redeploy Code.gs thủ công mới có hiệu lực nên
 *  giữ thêm lớp phòng hờ này ở CLIENT cho các bản ghi cũ/lúc Code.gs chưa kịp redeploy.
 *  QUAN TRỌNG: parse rồi lấy lại năm/tháng/ngày theo giờ ĐỊA PHƯƠNG của trình duyệt (an
 *  toàn cho người dùng vì cùng ở VN như spreadsheet) — TUYỆT ĐỐI không dùng toISOString()
 *  ở đây vì sẽ quay lại UTC và bị lệch NGÀY y hệt lỗi gốc (VD UTC+7: nửa đêm ngày sau ở
 *  local = 17h ngày trước ở UTC). Chuỗi "yyyy-MM-dd" thuần (không có "T") thì giữ nguyên,
 *  không đụng vào. */
function formatSampleDate(value) {
  if (!value || typeof value !== "string" || !value.includes("T")) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Phân loại MBA theo cấu trúc OLTC (bộ đổi nấc điện áp dưới tải) — ngăn OLTC có thông
// dầu/khí với thùng dầu chính hay không, quyết định bảng IEC Annex A.2.4 (Table A.2)
// nào áp dụng khi tính "tiêu chuẩn chặt hơn". Ở form (index.html, #f_mbasubtype) đây
// là 1 checkbox ("Ngăn OLTC (thông dầu/khí với thùng chính?)", mặc định KHÔNG tick) —
// xem toggleMbaSubtypeField()/onAnalyze() ở ui-dga.js.
// LƯU Ý: 2 chuỗi giá trị dưới đây vẫn giữ nguyên chữ "CPC" cũ (dù UI đã đổi tên hiển
// thị thành "OLTC") vì đây chính là giá trị được LƯU trong cột mba_subtype của các bản
// ghi đã có sẵn (gsheet/Supabase/localStorage) — đổi chuỗi này sẽ làm mọi bản ghi CŨ hết
// khớp so sánh === MBA_SUBTYPES.NO_OLTC/COMM_OLTC, tự rơi về mặc định sai. Chỉ đổi nếu
// đồng thời chạy migrate lại toàn bộ dữ liệu measurements.mba_subtype hiện có.
const MBA_SUBTYPES = {
  NO_OLTC: "Không có CPC (hoặc CPC không thông dầu/khí với thùng chính)",
  COMM_OLTC: "CPC có thông dầu/khí với thùng chính",
};

// Phân loại máy biến áp đo lường — quyết định bảng IEC Annex A.3 (Table A.6) áp dụng
// (chỉ ảnh hưởng khoảng "điển hình" tham khảo, KHÔNG ảnh hưởng ngưỡng tuyệt đối vì
// bảng "giá trị tối đa cho phép" của IEC trùng với QĐ1901 Bảng 12 cho cả CT lẫn VT).
const INSTRUMENT_SUBTYPES = {
  CT: "CT / TI (biến dòng điện)",
  VT: "VT / TU (biến điện áp)",
};

// ---------------------------------------------------------------------------
// 2) Tiêu chuẩn mặc định QĐ1901/EVNNPT
// ---------------------------------------------------------------------------

// Bảng 12, Điều 10 — TI kiểu kín, giá trị hàm lượng khí hòa tan CỰC ĐẠI (đạt/không đạt chính thức).
// Bảng này trùng khớp hoàn toàn với "maximum admissible values for sealed instrument
// transformers" của IEC 60599:2022, Annex A.4.4, Table A.8 — áp dụng chung cho cả TI (CT) và TU (VT).
const QD1901_BANG12_TI = { H2: 300, CH4: 30, C2H6: 50, C2H4: 10, C2H2: 2, CO: 300, CO2: 900 };

// Bảng 64, Điều 54 — MBA, cận trên khoảng giá trị hàm lượng khí ĐIỂN HÌNH (sàng lọc/tham khảo, không phải giới hạn bắt buộc)
const QD1901_BANG64_MBA = { H2: 150, CH4: 130, C2H6: 90, C2H4: 280, C2H2: 20, CO: 600, CO2: 14000 };

// Bảng 65, Điều 54 — MBA, khoảng tốc độ tăng hàm lượng khí điển hình (ppm/năm)
const QD1901_BANG65_RATE = {
  H2: [35, 132], CH4: [10, 120], C2H6: [5, 90], C2H4: [32, 146],
  C2H2: [0, 4], CO: [260, 1060], CO2: [1700, 10000],
};

// Ngưỡng CH4/H2 cho mã Phóng điện cục bộ (PD) — Bảng 66 / Table 1 IEC60599:2022 mục 5.4.
// IEC 60599:2022 quy định ngưỡng này KHÁC NHAU theo loại thiết bị (mục 5.4, Table 1, Note 3):
//  - Mặc định (MBA lực và các loại khác): < 0,1  (mục 5.4, Table 1)
//  - Máy biến áp đo lường (TI/TU), mục A.4.3: < 0,2 thay vì < 0,1
//  - Sứ xuyên (Bushing), mục A.5.3/Table A.10:  < 0,07 (bảng đơn giản hóa riêng cho sứ xuyên)
const DEFAULT_PD_THRESHOLD = 0.1;
const PD_THRESHOLD_BY_TYPE = {
  [EQUIPMENT_TYPES.TI]: 0.2,
  [EQUIPMENT_TYPES.TU]: 0.2,
  [EQUIPMENT_TYPES.MBA]: DEFAULT_PD_THRESHOLD,
  [EQUIPMENT_TYPES.BUSHING]: 0.07,
  [EQUIPMENT_TYPES.OTHER]: DEFAULT_PD_THRESHOLD,
};

function pdThresholdForType(equipmentType) {
  return PD_THRESHOLD_BY_TYPE[equipmentType] ?? DEFAULT_PD_THRESHOLD;
}

// ---------------------------------------------------------------------------
// 2bis) IEC 60599:2022 Annex A — bảng nồng độ khí tham khảo theo TỪNG LOẠI THIẾT BỊ
//       (dùng để: (a) tính "tiêu chuẩn chặt hơn" so với QĐ1901 khi có thể so sánh,
//       (b) làm ngưỡng riêng khi QĐ1901 không có bảng tương ứng — sứ xuyên,
//       (c) làm khoảng "điển hình" tham khảo chính xác hơn theo phân nhóm thiết bị).
// ---------------------------------------------------------------------------

// Annex A.2.4, Table A.2 — Máy biến áp lực, khoảng giá trị điển hình 90% (µl/l), cận
// trên dùng làm ngưỡng so sánh. Nguồn gốc y hệt bản gốc IEC 60599:2022 Table A.2
// ("Ranges of 90 % typical gas concentration values observed in power transformers"):
// CHỈ RIÊNG C2H2 tách theo "không có OLTC"/"OLTC có thông dầu" (2–20 / 60–280); 6 khí
// còn lại DÙNG CHUNG 1 khoảng cho "All transformers" (không tách theo OLTC) — khớp
// đúng 6 khí của QĐ1901 Bảng 64 (H2 150/CH4 130/C2H6 90/C2H4 280/CO 600/CO2 14000),
// cho thấy Bảng 64 QĐ1901 lấy đúng cận trên của dòng "All transformers"/"No OLTC" ở
// bảng này. (Trước đây bảng này bị nhập SAI — mỗi khí 1 số khác nhau theo từng subtype
// OLTC — đã sửa lại đúng theo bản gốc IEC 60599:2022 Annex A.2.4, Table A.2. Mục này
// là A.1.4 ở bản 1999 — bản 2022 chèn thêm "A.1 General warning" phía trước nên dịch
// số thành A.2, số liệu không đổi.)
const IEC_A2_POWER_TRANSFORMER = {
  [MBA_SUBTYPES.NO_OLTC]: { H2: 150, CO: 600, CO2: 14000, CH4: 130, C2H6: 90, C2H4: 280, C2H2: 20 },
  [MBA_SUBTYPES.COMM_OLTC]: { H2: 150, CO: 600, CO2: 14000, CH4: 130, C2H6: 90, C2H4: 280, C2H2: 280 },
};

// Annex A.4.4, Table A.8 — "Maximum admissible values for sealed instrument
// transformers" — trùng QĐ1901 Bảng 12. (Trước đây hằng số này tên
// "IEC_A6_INSTRUMENT_MAX" — SỐ LIỆU đã đúng từ trước, chỉ SAI số bảng: Table A.6
// trong IEC 60599:2022 Annex A thực chất là bảng định tính "Typical faults in
// instrument transformers", không phải bảng số này — đã sửa tên/chú thích lại
// đúng theo bản gốc IEC 60599:2022 Annex A.4.4, Table A.8, đã đối chiếu trực tiếp
// với file gốc IEC 60599-2022 do người dùng cung cấp: H2 300/CO 300/CO2 900/CH4 30/
// C2H6 50/C2H4 10/C2H2 2 — khớp tuyệt đối. Mục này là A.3.4 ở bản 1999; bản 2022
// chèn thêm "A.1 General warning" và "A.3 Industrial and special transformers" nên
// dịch số thành A.4, số liệu không đổi.)
const IEC_A8_INSTRUMENT_MAX = { H2: 300, CO: 300, CO2: 900, CH4: 30, C2H6: 50, C2H4: 10, C2H2: 2 };

// Annex A.4.4, Table A.7 — "Ranges of 90 % typical concentration values in
// instrument transformers", khoảng giá trị điển hình 90% theo phân nhóm CT/VT
// (µl/l), cận trên. (Trước đây hằng số này tên "IEC_A6_INSTRUMENT_TYPICAL" — SỐ
// LIỆU đã đúng từ trước, chỉ SAI số bảng, cùng lý do như IEC_A8_INSTRUMENT_MAX ở
// trên — đã sửa tên/chú thích lại đúng theo bản gốc IEC 60599:2022 Annex A.4.4,
// Table A.7 (CT: H2 6–300/CO 250–1100/CO2 800–4000/CH4 11–120/C2H6 7–130/
// C2H4 3–40/C2H2 1–5; VT: H2 70–1000/C2H4 20–30/C2H2 4–16 — lấy cận trên mỗi
// khoảng, đã đối chiếu trực tiếp với file gốc do người dùng cung cấp.)
const IEC_A7_INSTRUMENT_TYPICAL = {
  [INSTRUMENT_SUBTYPES.CT]: { H2: 300, CO: 1100, CO2: 4000, CH4: 120, C2H6: 130, C2H4: 40, C2H2: 5 },
  // VT: bảng gốc chỉ công bố H2/C2H4/C2H2; các khí còn lại không có số liệu riêng cho VT trong Annex A.4.4
  [INSTRUMENT_SUBTYPES.VT]: { H2: 1000, CO: null, CO2: null, CH4: null, C2H6: null, C2H4: 30, C2H2: 16 },
};

// Annex A.5.4, Table A.11 — Sứ xuyên (bushing), khoảng giá trị điển hình 90% (µl/l),
// cận trên dùng làm ngưỡng so sánh — KHÔNG có bảng QĐ1901 tương ứng cho sứ xuyên nên
// dùng thẳng bảng này làm "limits" áp dụng (xem resolveStandard()). C2H2 gốc là "< S
// đến 5" (S = ngưỡng phát hiện của máy đo, không phải 1 con số cố định) — lấy cận trên
// 5 làm ngưỡng, bỏ qua cận dưới "< S" vì không có ý nghĩa dùng làm giới hạn so sánh.
// (Trước đây hằng số này tên "IEC_A9_BUSHING" và bị nhập SAI số liệu — có vẻ nhầm với
// 1 bảng/ấn bản khác — đã sửa lại đúng theo bản gốc IEC 60599:2022 Annex A.5.4, Table
// A.11 (69–392/229–927/484–11578/37–216/17–121/2–70/<S–5), đã đối chiếu trực tiếp với
// file gốc do người dùng cung cấp. Mục này là A.4.4 ở bản 1999; bản 2022 dịch số
// thành A.5.4 vì lý do nêu trên, số liệu không đổi.)
const IEC_A11_BUSHING = { H2: 392, CO: 927, CO2: 11578, CH4: 216, C2H6: 121, C2H4: 70, C2H2: 5 };


// ---------------------------------------------------------------------------
// 2ter) Tham chiếu nguồn (citation) của từng bảng ngưỡng — tách thành 1 object RIÊNG,
//   MUTABLE (khác các hằng số Bảng ở trên — vẫn giữ nguyên là object literal, KHÔNG đổi
//   const->let, chỉ ghi đè THUỘC TÍNH), để applyRegulationConfigOverride() (mục 9,
//   "Cấu hình quy định") có thể sửa được đúng CHUỖI tham chiếu hiển thị cho người dùng,
//   không chỉ riêng con số — đúng yêu cầu "có tham chiếu nguồn và có thể hiệu chỉnh
//   tham chiếu này". Toàn bộ chuỗi sourceLabel/ref trong resolveStandard()/
//   resolveOilLimits()/evaluateOltcOilTest()/dieu54AdvisoryMessages()/
//   buildRecommendations() bên dưới ĐỀU đọc từ object này thay vì hardcode chuỗi trực
//   tiếp như trước — sửa 1 nơi (qua mục "Quy định" trong tab "Cấu hình") sẽ đổi hiển thị ở MỌI nơi
//   dùng đến bảng đó.
// ---------------------------------------------------------------------------
const REGULATION_CITATIONS = {
  BANG64_MBA: "QĐ1901 Bảng 64, Điều 54",
  IEC_A2: "IEC 60599:2022 Annex A.2.4 Table A.2",
  BANG12_TI: "QĐ1901 Bảng 12, Điều 10",
  IEC_A8: "IEC 60599:2022 Annex A.4.4 Table A.8",
  IEC_A7: "IEC 60599:2022 Annex A.4.4 Table A.7",
  IEC_A11_BUSHING: "IEC 60599:2022 Annex A.5.4 Table A.11",
  BANG65_RATE: "Bảng 65, Điều 54 QĐ1901",
  PD_THRESHOLD: "IEC 60599:2022 mục 5.4/Table 1 Note 3 (mặc định); Annex A.4.3 (TI/TU); Annex A.5.3/Table A.10 (sứ xuyên)",
  BANG63_TDGC: "Bảng 63, Điều 54 QĐ1901",
  BANG54_BDV: "Bảng 54, Điều 46 QĐ1901",
  BANG55_TGD90: "Bảng 55, Điều 47 QĐ1901",
  BANG58_WATER: "Bảng 58, Điều 50 QĐ1901",
  BANG49_OLTC: "Bảng 49, Điều 37 QĐ1901",
};


// Bảng 63, Điều 54 (chuyển ra đây từ mục 7bis vì dga-logic-regulation-config.js
// cũng cần tham chiếu TRỰC TIẾP object này để hỗ trợ sửa qua giao diện).
// Bảng 63, Điều 54 — ngưỡng tổng hàm lượng khí hòa tan (%) trong dầu MBA. CHỈ áp dụng
// chính thức cho dầu MỚI đưa vào vận hành lần đầu, sau sửa chữa có thay dầu, hoặc sau
// sửa chữa không thay dầu có lọc dầu — QĐ1901 KHÔNG nêu ngưỡng nào cho dầu đang vận
// hành định kỳ thông thường (xem evaluateBang63()).
const QD1901_BANG63_TDGC = { "110-220": 1.0, "500": 0.5 };

// ---------------------------------------------------------------------------
// Thí nghiệm dầu MBA: Độ ẩm (Điều 50/Bảng 58), Tổn hao điện môi tgδ ở 90°C
// (Điều 47/Bảng 55), Điện áp chọc thủng (Điều 46/Bảng 54) — theo QĐ1901.
//
// LƯU Ý: 3 bảng này CHỈ áp dụng cho dầu MBA/Kháng dầu theo đúng QĐ1901 (Điều
// 45–56 "dầu MBA"). QĐ1901 không quy định bảng số liệu riêng cho dầu TI/TU —
// với TI/TU, Điều 10/11 ghi rõ "thí nghiệm dầu cách điện theo quy định nhà sản
// xuất". IEC 60599:2022 (đã dùng ở các hạng mục DGA khác trong công cụ này)
// KHÔNG quy định giới hạn độ ẩm/tgδ/điện áp chọc thủng — đó là phạm vi của
// IEC 60422 (hướng dẫn bảo dưỡng dầu), không phải IEC 60599. Vì vậy 3 hạng
// mục này chỉ đánh giá theo đúng bảng số của QĐ1901, không tự suy diễn thêm
// ngưỡng IEC 60422 chưa được người dùng cung cấp số liệu xác nhận.
// ---------------------------------------------------------------------------

const OIL_VOLTAGE_CLASSES = [
  { value: "duoi15", label: "< 15 kV" },
  { value: "15den35", label: "15 – 35 kV" },
  { value: "tren35duoi110", label: "> 35 kV và < 110 kV" },
  { value: "110", label: "110 kV" },
  { value: "220", label: "220 kV" },
  { value: "500", label: "500 kV" },
];

// Bảng 54 (Điều 46) — Điện áp chọc thủng dầu (kV, khe hở 2,5mm), KHÔNG THẤP HƠN.
// "110 đến 220 kV" trong bảng gốc là 1 bậc gộp chung — áp dụng chung cho cả 110kV và 220kV.
const BANG54_BDV = {
  duoi15: { new: 30, inservice: 25 },
  "15den35": { new: 35, inservice: 30 },
  tren35duoi110: { new: 45, inservice: 40 },
  "110": { new: 60, inservice: 55 },
  "220": { new: 60, inservice: 55 },
  "500": { new: 70, inservice: 60 },
};

// Bảng 55 (Điều 47) — Tổn hao điện môi tgδ dầu ở 90°C (%), KHÔNG LỚN HƠN.
// Bảng gốc chỉ có 2 bậc: "Đến 110kV" và "220kV đến 500kV".
const BANG55_TGD90 = {
  duoi15: { new: 1.5, inservice: 10 },
  "15den35": { new: 1.5, inservice: 10 },
  tren35duoi110: { new: 1.5, inservice: 10 },
  "110": { new: 1.5, inservice: 10 },
  "220": { new: 1.0, inservice: 10 },
  "500": { new: 1.0, inservice: 10 },
};

// Bảng 58 (Điều 50) — Hàm lượng nước trong dầu (ppm), KHÔNG LỚN HƠN. Bảng gốc chỉ có
// 3 "hàng" thực sự (không phải 6 cấp điện áp riêng biệt như Bảng 54/55): "≤110kV, có
// bảo vệ bằng màng chất dẻo/nitơ", "≤110kV, không có bảo vệ", và "220kV/500kV" (2 cấp
// điện áp cao dùng CHUNG 1 hàng, không tách theo màng/N2). Tách thành hằng số RIÊNG
// (thay vì để nguyên trong thân hàm) để đưa được vào registry cấu hình (xem mục 9,
// "Cấu hình quy định" — REGULATION_CONFIG_REGISTRY) cho phép chỉnh số qua giao diện.
const BANG58_WATER = {
  den110_comMangN2: { new: 10, inservice: 25 },
  den110_khongMangN2: { new: 20, inservice: 25 },
  tren110: { new: 10, inservice: 20 },
};

/** Bảng 58 (Điều 50) — Hàm lượng nước trong dầu (ppm), KHÔNG LỚN HƠN. Riêng bậc
 *  ≤110kV có 2 trường hợp tùy có/không bảo vệ bằng màng chất dẻo hoặc nitơ. */
function bang58WaterLimits(voltageClass, hasMembraneN2) {
  const isDen110 = ["duoi15", "15den35", "tren35duoi110", "110"].includes(voltageClass);
  if (isDen110) {
    return hasMembraneN2 ? BANG58_WATER.den110_comMangN2 : BANG58_WATER.den110_khongMangN2;
  }
  return BANG58_WATER.tren110; // 220kV và 500kV — cùng trị số trong Bảng 58
}

function hasVal(v) {
  return v !== null && v !== undefined && v !== "";
}

// ---------------------------------------------------------------------------
// Dầu khoang điều áp dưới tải (OLTC) — Điều 37, Bảng 49 QĐ1901.
//
// Khi dầu OLTC MỚI LẮP: Điều 37 mục 3 quy định dùng CHUNG tiêu chuẩn với dầu
// thùng dầu chính MBA (Bảng 54/55/58, CÓ tgδ) — xem evaluateOltcOilTest() bên
// dưới, tái dùng nguyên evaluateOilTest(), KHÔNG dùng bảng này cho "mới lắp".
//
// Khi dầu OLTC ĐANG VẬN HÀNH: dùng Bảng 49 — CHỈ có độ ẩm + điện áp chọc thủng,
// KHÔNG có tiêu chí tgδ. 2 kiểu điểm lấy mẫu có ngưỡng khác nhau:
//  - "trungtinh": OLTC đặt ở điểm cuối trung tính — 3 pha dùng CHUNG 1 khoang/
//    1 mẫu dầu duy nhất, ngưỡng CỐ ĐỊNH, không phân theo cấp điện áp MBA.
//  - "pharieng": OLTC 1 pha (MBA 1 pha) hoặc đặt ở điểm KHÔNG trung tính (MBA 3
//    pha có OLTC riêng từng pha) — mỗi pha A/B/C có khoang/mẫu RIÊNG, ngưỡng
//    phân theo cấp điện áp MBA.
// Bảng gốc CHỈ có 3 bậc cho "pharieng": ≤35kV / 110÷220kV / 500kV — KHÔNG có số
// liệu riêng cho bậc "35kV-110kV" (khác Bảng 54/55/58 dầu chính có đủ 5 bậc).
// Với bậc đó (và với hàm lượng nước ở bậc ≤35kV — bảng gốc để trống "-"),
// evaluateOltcOilTest() trả verdict "Không có ngưỡng" thay vì tự suy diễn số liệu.
// ---------------------------------------------------------------------------

const OLTC_SAMPLE_POINTS = [
  { value: "trungtinh", label: "Điểm cuối trung tính (3 pha dùng chung 1 mẫu)" },
  { value: "pharieng", label: "Một pha / điểm không trung tính (mỗi pha 1 mẫu riêng)" },
];

// Điểm lấy mẫu dầu cách điện THÙNG DẦU CHÍNH (khác OLTC ở trên) — đa số MBA/Kháng
// (nhất là ≤220kV) có 1 thùng dầu dùng chung cho cả 3 pha, nhưng một số MBA/Kháng
// 500kV kết cấu 3 pha RỜI (mỗi pha 1 máy/1 thùng dầu vật lý riêng) thì cần lấy mẫu
// và đánh giá RIÊNG từng pha — y hệt lý do OLTC_SAMPLE_POINTS đã tách "trungtinh"/
// "pharieng" ở trên. Ngưỡng đánh giá (Bảng 54/55/58, evaluateOilTest()) KHÔNG đổi
// theo điểm lấy mẫu — trường này chỉ dùng để phân biệt ĐÚNG thiết bị vật lý nào
// đang được lấy mẫu (xem deviceIdentityKey() ở ui-alerts.js).
const OIL_SAMPLE_POINTS = [
  { value: "chung", label: "Thùng dầu chung 3 pha (1 mẫu đại diện)" },
  { value: "pharieng", label: "Thùng dầu riêng từng pha (mỗi pha 1 mẫu riêng)" },
];

const BANG49_OLTC = {
  trungtinh: { bdv: 40, moisture: 30 },
  pharieng: {
    duoi15: { bdv: 35, moisture: null },
    "15den35": { bdv: 35, moisture: null },
    tren35duoi110: null, // QĐ1901 Bảng 49 không có số liệu cho bậc này
    "110": { bdv: 50, moisture: 25 },
    "220": { bdv: 50, moisture: 25 },
    "500": { bdv: 60, moisture: 20 },
  },
};

/**
 * Đánh giá 1 lần thử nghiệm dầu khoang điều áp dưới tải (OLTC) theo Điều 37 QĐ1901.
 * oltcSamplePoint: "trungtinh" hoặc "pharieng" (xem OLTC_SAMPLE_POINTS ở trên).
 * oilState: "new" (dầu mới, sau lắp đặt/sau sửa chữa) hoặc "inservice" (dầu vận hành).
 *  - "new": tái dùng NGUYÊN evaluateOilTest() (Bảng 54/55/58, kể cả ưu tiên tiêu
 *    chuẩn nhà sản xuất nếu có cấu hình khớp) — đúng theo Điều 37 mục 3.
 *  - "inservice": dùng Bảng 49 (chỉ độ ẩm + BDV) — KHÔNG áp dụng tiêu chuẩn nhà
 *    sản xuất riêng cho dầu OLTC vận hành (QĐ1901 không có cơ chế đó); tgδ vẫn
 *    cho nhập để theo dõi xu hướng nhưng luôn "Không có ngưỡng" ở trạng thái này.
 */
