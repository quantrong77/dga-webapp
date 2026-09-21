/* mobile/dga-logic.js — FILE ĐƯỢC SINH TỰ ĐỘNG bởi scripts/sync-mobile.js. KHÔNG SỬA TAY.
 *
 * Nội dung = ghép các file logic dùng chung của bản web theo đúng thứ tự nạp trong index.html:
 * logic/dga-logic-core.js, logic/dga-logic-gas.js, logic/dga-logic-oil.js, logic/dga-logic-instrument-oil.js, logic/dga-logic-forecast.js, logic/dga-logic-regulation-config.js, logic/dga-logic-peer.js, logic/dga-logic-case.js, dga-logic.js
 * Muốn đổi logic đánh giá: sửa ở logic/*.js (bản web) rồi chạy `npm run sync-mobile`.
 * (Nhánh Node ở cuối file — dùng "vm" — chỉ chạy khi có module.exports; trình duyệt bỏ qua.) */

// ===== logic/dga-logic-core.js =====
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

// ===== logic/dga-logic-gas.js =====
/* dga-logic-gas.js — Phần 2/6 của dga-logic.js sau khi tách theo miền (xem
   dga-logic.js). Toàn bộ pipeline đánh giá 1 lần đo khí hòa tan: chọn tiêu chuẩn áp
   dụng (resolveStandard), đánh giá giá trị tuyệt đối/ngưỡng loại bỏ, chẩn đoán tỷ số
   khí (Bảng 66 + Table A.10 sứ xuyên), Tam giác Duval 1, tốc độ tăng khí (Bảng 65),
   tỷ lệ bổ sung/Tổng hàm lượng khí hòa tan (Điều 54/Bảng 63), khuyến cáo tổng hợp, và
   trạng thái tổng thể (Bình thường/Cảnh báo/Báo động). Dùng các bảng hằng số từ
   dga-logic-core.js. */

function elementWiseMin(a, b) {
  const out = {};
  GASES.forEach((g) => {
    const av = a ? a[g] : undefined;
    const bv = b ? b[g] : undefined;
    const hasA = av !== undefined && av !== null;
    const hasB = bv !== undefined && bv !== null;
    if (hasA && hasB) out[g] = Math.min(av, bv);
    else if (hasA) out[g] = av;
    else if (hasB) out[g] = bv;
    else out[g] = null;
  });
  return out;
}

function defaultAbsoluteStandard(equipmentType) {
  return equipmentType === EQUIPMENT_TYPES.MBA
    ? { ...QD1901_BANG64_MBA }
    : { ...QD1901_BANG12_TI };
}

/**
 * Ngưỡng "điển hình" tham khảo chính xác nhất hiện có theo loại thiết bị/phân nhóm —
 * dùng cho countExceedTypical() (điều kiện áp dụng tỷ lệ khí, Điều 54 QĐ1901/6.1(c) IEC60599).
 */
function typicalReferenceStandard(equipmentType, subtype) {
  if (equipmentType === EQUIPMENT_TYPES.MBA) {
    return { ...QD1901_BANG64_MBA };
  }
  if (equipmentType === EQUIPMENT_TYPES.TI) {
    return { ...IEC_A7_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.CT] };
  }
  if (equipmentType === EQUIPMENT_TYPES.TU) {
    // Bù các khí VT không có số liệu riêng bằng số liệu CT (cùng Annex A.4.4)
    return { ...IEC_A7_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.CT], ...pickNonNull(IEC_A7_INSTRUMENT_TYPICAL[INSTRUMENT_SUBTYPES.VT]) };
  }
  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    return { ...IEC_A11_BUSHING };
  }
  return { ...QD1901_BANG12_TI };
}

function pickNonNull(obj) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    if (obj[k] !== null && obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}


// ---------------------------------------------------------------------------
// 3) Chọn tiêu chuẩn áp dụng: ưu tiên tiêu chuẩn nhà sản xuất (nếu có cấu hình đầy
//    đủ cho loại thiết bị đó); nếu không, áp dụng tiêu chuẩn CHẶT HƠN giữa QĐ1901
//    và bảng tham khảo tương ứng của IEC 60599 Annex A (theo yêu cầu người dùng);
//    nếu QĐ1901 không có bảng tương ứng (sứ xuyên), dùng trực tiếp IEC Annex A.
// ---------------------------------------------------------------------------

/**
 * Ngưỡng LOẠI BỎ (condemning limit) — khác với ngưỡng tuyệt đối "Đạt/Không đạt" ở trên:
 * đây là ngưỡng nghiêm trọng hơn, do TỪNG NHÀ SẢN XUẤT tự quy định riêng (QĐ1901/IEC
 * không có khái niệm này), dùng để cảnh báo mức nguy hiểm cao hơn mức "không đạt" thông
 * thường (ví dụ: khuyến cáo ngừng vận hành/loại bỏ dầu hoặc thiết bị). Không bắt buộc
 * cấu hình đủ 7 khí — nhà sản xuất có thể chỉ đặt ngưỡng loại bỏ cho 1 vài khí quan
 * trọng (thường là C2H2, H2), các khí còn lại để trống sẽ không bị kiểm tra.
 * Độc lập với việc ngưỡng tuyệt đối của NSX có được cấu hình đủ 7 khí hay không.
 */
function resolveCondemningLimits(measurement, manufacturerStandards) {
  const match = (manufacturerStandards || []).find(
    (s) => s.manufacturer === measurement.manufacturer && s.equipmentType === measurement.equipmentType
  );
  if (!match || !match.condemning) return null;
  const hasAny = GASES.some((g) => match.condemning[g] !== undefined && match.condemning[g] !== null && match.condemning[g] !== "");
  return hasAny ? match.condemning : null;
}

/**
 * @param {LogicMeasurement} measurement { equipmentType, manufacturer, mbaSubtype?, instrumentSubtype? }
 * @param {ManufacturerGasStandard[]|null|undefined} manufacturerStandards danh sách { manufacturer, equipmentType, limits, rate, condemning, source } do người dùng cấu hình
 * @returns {{ limits: object, rate: object, sourceLabel: string, isManufacturer: boolean, pdThreshold: number, typical: object, condemning: object|null }}
 */
function resolveStandard(measurement, manufacturerStandards) {
  const equipmentType = measurement.equipmentType;
  const pdThreshold = pdThresholdForType(equipmentType);
  const typical = typicalReferenceStandard(equipmentType, measurement);
  const condemning = resolveCondemningLimits(measurement, manufacturerStandards);

  const match = (manufacturerStandards || []).find(
    (s) => s.manufacturer === measurement.manufacturer && s.equipmentType === equipmentType
  );
  if (match && match.limits && GASES.every((g) => match.limits[g] !== undefined && match.limits[g] !== null && match.limits[g] !== "")) {
    return {
      limits: match.limits,
      rate: match.rate && GASES.every((g) => match.rate[g]) ? match.rate : QD1901_BANG65_RATE,
      sourceLabel: `Tiêu chuẩn nhà sản xuất: ${match.manufacturer}${match.source ? " (" + match.source + ")" : ""}`,
      isManufacturer: true,
      pdThreshold,
      typical,
      condemning,
    };
  }

  if (equipmentType === EQUIPMENT_TYPES.MBA) {
    const subtype = measurement.mbaSubtype || MBA_SUBTYPES.NO_OLTC;
    const iecTable = IEC_A2_POWER_TRANSFORMER[subtype] || IEC_A2_POWER_TRANSFORMER[MBA_SUBTYPES.NO_OLTC];
    const blended = elementWiseMin(QD1901_BANG64_MBA, iecTable);
    return {
      limits: blended,
      rate: QD1901_BANG65_RATE,
      sourceLabel: `Chặt hơn giữa ${REGULATION_CITATIONS.BANG64_MBA} và ${REGULATION_CITATIONS.IEC_A2} (${subtype})`,
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  if (equipmentType === EQUIPMENT_TYPES.TI || equipmentType === EQUIPMENT_TYPES.TU) {
    // QĐ1901 Bảng 12 và IEC Annex A.4.4 Table A.8 "maximum admissible values" trùng khớp
    // hoàn toàn cho cả CT và VT — không có gì để "chặt hơn", dùng chung một bộ.
    const blended = elementWiseMin(QD1901_BANG12_TI, IEC_A8_INSTRUMENT_MAX);
    return {
      limits: blended,
      rate: QD1901_BANG65_RATE,
      sourceLabel: `${REGULATION_CITATIONS.BANG12_TI} = ${REGULATION_CITATIONS.IEC_A8} (giá trị tối đa cho phép, máy biến áp đo lường kiểu kín)`,
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    return {
      limits: { ...IEC_A11_BUSHING },
      rate: QD1901_BANG65_RATE,
      sourceLabel: `${REGULATION_CITATIONS.IEC_A11_BUSHING} (khoảng giá trị điển hình 90%, sứ xuyên) — QĐ1901 chưa có bảng riêng cho sứ xuyên`,
      isManufacturer: false,
      pdThreshold,
      typical,
      condemning,
    };
  }

  return {
    limits: defaultAbsoluteStandard(equipmentType),
    rate: QD1901_BANG65_RATE,
    sourceLabel: `${REGULATION_CITATIONS.BANG12_TI} — mặc định do chưa xác định loại thiết bị/chưa có tiêu chuẩn nhà sản xuất`,
    isManufacturer: false,
    pdThreshold,
    typical,
    condemning,
  };
}

// ---------------------------------------------------------------------------
// 4) Tổng khí cháy (TCG) & đánh giá giá trị tuyệt đối
// ---------------------------------------------------------------------------

function computeTCG(gases) {
  return (
    num(gases.H2) + num(gases.CH4) + num(gases.C2H6) + num(gases.C2H4) + num(gases.C2H2) + num(gases.CO)
  ); // TCG không tính CO2
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Đánh giá từng khí so với ngưỡng áp dụng (limits).
 * @returns {Array<{gas, value, limit, verdict}>}
 */
function evaluateAbsolute(gases, limits) {
  return GASES.map((gas) => {
    const value = num(gases[gas]);
    const limit = limits[gas];
    const hasLimit = limit !== undefined && limit !== null && limit !== "";
    const verdict = !hasLimit ? "Không có ngưỡng" : value <= limit ? "Đạt" : "Không đạt";
    return { gas, value, limit: hasLimit ? limit : null, verdict };
  });
}

function overallVerdict(evalRows) {
  const failing = evalRows.filter((r) => r.verdict === "Không đạt");
  if (failing.length === 0) return "Đạt";
  return "Không đạt: " + failing.map((r) => r.gas).join(", ");
}

/**
 * Đánh giá theo ngưỡng LOẠI BỎ (condemning limit) của nhà sản xuất — chỉ kiểm tra
 * các khí mà nhà sản xuất có cấu hình (bỏ qua khí không cấu hình, khác với
 * evaluateAbsolute() vốn duyệt đủ 7 khí).
 * @param {object} gases
 * @param {object|null} condemningLimits { gas: value, ... } — kết quả từ resolveStandard().condemning
 * @returns {Array<{gas, value, limit, exceeded}>}
 */
function evaluateCondemning(gases, condemningLimits) {
  if (!condemningLimits) return [];
  return GASES.filter((g) => condemningLimits[g] !== undefined && condemningLimits[g] !== null && condemningLimits[g] !== "").map((g) => {
    const value = num(gases[g]);
    const limit = condemningLimits[g];
    return { gas: g, value, limit, exceeded: value > limit };
  });
}

function condemningExceededRows(condemningRows) {
  return (condemningRows || []).filter((r) => r.exceeded);
}

// Số khí vượt giá trị ĐIỂN HÌNH theo loại thiết bị/phân nhóm (dùng để xét điều kiện áp
// dụng tỷ lệ khí), tách biệt với ngưỡng áp dụng đã chọn (có thể là NSX/chặt hơn) — theo
// đúng nguyên tắc "điển hình" của Điều 54 QĐ1901 / mục 6.1(c) IEC60599.
function countExceedTypical(gases, equipmentType, subtypeOrMeasurement) {
  const measurement = typeof subtypeOrMeasurement === "object" && subtypeOrMeasurement !== null
    ? subtypeOrMeasurement
    : {};
  const typical = typicalReferenceStandard(equipmentType, measurement);
  return GASES.filter((g) => typical[g] !== null && typical[g] !== undefined && num(gases[g]) > typical[g]).length;
}


// ---------------------------------------------------------------------------
// 5) Tỷ lệ khí cơ bản & mã chẩn đoán (Bảng 66, QĐ1901/Điều 54 = Table 1, IEC 60599:2022 —
//    xem 5.4 "DGA interpretation table"; Table 2 IEC 60599:2022 chỉ là bảng đơn giản hóa
//    3 mã PD/D/T, KHÔNG khớp Bảng 66 vốn có đủ 6 mã PD/D1/D2/T1/T2/T3 theo 3 tỷ số khí)
// ---------------------------------------------------------------------------

function computeRatios(gases) {
  const c2h2 = num(gases.C2H2), c2h4 = num(gases.C2H4), c2h6 = num(gases.C2H6), h2 = num(gases.H2), ch4 = num(gases.CH4);
  const co = num(gases.CO), co2 = num(gases.CO2);
  const r1 = c2h4 === 0 ? (c2h2 === 0 ? 0 : 999) : c2h2 / c2h4; // C2H2/C2H4
  const r2 = h2 === 0 ? 999 : ch4 / h2; // CH4/H2
  const r3 = c2h6 === 0 ? 999 : c2h4 / c2h6; // C2H4/C2H6
  // CO2/CO — CHỈ dùng cho Table A.10 (sứ xuyên, Annex A.5.3), KHÁC với tỷ lệ CO2/CO đã có
  // sẵn ở diagnoseAdditionalRatios() (Điều 54 QĐ1901/mục 5.5, ngưỡng <3/>10, áp dụng chung
  // mọi thiết bị, chỉ mang tính khuyến cáo) — Table A.10 dùng ngưỡng RIÊNG <1/>20, là 1 MÃ
  // chẩn đoán chính thức trong bảng, không phải khuyến cáo phụ — không gộp chung 2 hàm.
  const r4 = co === 0 ? (co2 === 0 ? null : 999) : co2 / co; // CO2/CO
  return { c2h2_c2h4: r1, ch4_h2: r2, c2h4_c2h6: r3, co2_co: r4 };
}

// Chuỗi "không xác định" DÙNG CHUNG — nhiều nơi so sánh ĐÚNG BẰNG chuỗi này để biết chẩn
// đoán có kết luận rõ ràng hay không (diagnosisIsConclusive(), buildRecommendations()) —
// khai báo 1 lần ở đây để tránh gõ sai lệch chuỗi giữa các nơi.
const NO_DIAGNOSIS = "Không xác định (ngoài Bảng 66/hỗn hợp khiếm khuyết)";

/**
 * Tra mã khiếm khuyết theo Bảng 66 / Table 1 IEC 60599:2022 (mục 5.4).
 * @param {{c2h2_c2h4:number, ch4_h2:number, c2h4_c2h6:number}} ratios
 * @param {number} pdThreshold ngưỡng CH4/H2 cho PD — mặc định 0,1; dùng 0,2 cho TI/TU
 *   (Annex A.4.3, xác nhận lại tại Table 1 Note 3) hoặc 0,07 cho sứ xuyên (Annex
 *   A.5.3/Table A.10, xác nhận lại tại Table 1 Note 3) thay vì luôn cố định 0,1.
 */
function diagnoseRatios(ratios, pdThreshold) {
  const g = ratios.c2h2_c2h4, h = ratios.ch4_h2, i = ratios.c2h4_c2h6;
  const pd = pdThreshold === undefined || pdThreshold === null ? DEFAULT_PD_THRESHOLD : pdThreshold;
  if (h < pd && i < 0.2) return "PD - Phóng điện cục bộ";
  if (g > 1 && h >= 0.1 && h <= 0.5 && i > 1 && g >= 0.6 && g <= 2.5 && h <= 1) return "D1/D2 - Phóng điện (vùng chồng lấn)";
  if (g > 1 && h >= 0.1 && h <= 0.5 && i > 1) return "D1 - Phóng điện năng lượng thấp";
  if (g >= 0.6 && g <= 2.5 && h >= 0.1 && h <= 1 && i > 2) return "D2 - Phóng điện năng lượng cao";
  if (h > 1 && i < 1) return "T1 - Tăng nhiệt, t<300°C";
  if (g < 0.1 && h > 1 && i >= 1 && i <= 4) return "T2 - Tăng nhiệt, 300-700°C";
  if (g < 0.2 && h > 1 && i > 4) return "T3 - Tăng nhiệt, t>700°C";
  return NO_DIAGNOSIS;
}

// ---------------------------------------------------------------------------
// 5bis) Sứ xuyên (bushing) — Table A.10 IEC 60599:2022, Annex A.5.3 "Simplified
//    interpretation scheme for bushings". KHÁC hẳn Table 1/Bảng 66 (6 mã LOẠI TRỪ
//    NHAU, phải khớp ĐỒNG THỜI cả 3 tỷ số): Table A.10 có 4 mã ĐỘC LẬP, mỗi mã chỉ
//    xét ĐÚNG 1 tỷ số — 1 lần đo có thể khớp 0, 1, hoặc nhiều mã cùng lúc:
//      PD — CH4/H2 < 0,07
//      D  — C2H2/C2H4 > 1        (gộp chung, không tách D1/D2 như Table 1)
//      T  — C2H4/C2H6 > 1        (gộp chung, không tách T1/T2/T3 như Table 1)
//      TP — CO2/CO < 1 hoặc > 20 (nghi liên quan cách điện giấy — bảng gốc IEC không
//           định nghĩa rõ chữ viết tắt "TP"; diễn giải hướng <1 hay >20 nên đối chiếu
//           thêm mục 5.5: CO2/CO<3 thường nghi carbon hóa giấy, CO2/CO>10 có thể là
//           quá nhiệt nhẹ (<160°C) giấy/oxy hóa dầu — Table A.10 dùng ngưỡng riêng,
//           nghiêm ngặt hơn <1/>20)
//    Nguyên văn ngay dưới Table A.10: "In cases where a single characteristic fault
//    cannot be attributed using this simplified table... the general Table 1 should
//    be used" — nên khi KHÔNG mã nào khớp, phải tự rơi về Table 1 (xem
//    diagnoseGasFault() bên dưới), đúng yêu cầu của bảng gốc, KHÔNG trả về rỗng.
// ---------------------------------------------------------------------------

function diagnoseBushingRatios(ratios) {
  const codes = [];
  if (ratios.ch4_h2 < 0.07) codes.push("PD");
  if (ratios.c2h2_c2h4 > 1) codes.push("D");
  if (ratios.c2h4_c2h6 > 1) codes.push("T");
  if (ratios.co2_co !== null && (ratios.co2_co < 1 || ratios.co2_co > 20)) codes.push("TP");
  return codes;
}

const BUSHING_CODE_LABELS = {
  PD: "PD (phóng điện cục bộ — CH4/H2 < 0,07)",
  D: "D (phóng điện — C2H2/C2H4 > 1)",
  T: "T (tăng nhiệt — C2H4/C2H6 > 1)",
  TP: "TP (nghi liên quan cách điện giấy — CO2/CO bất thường)",
};

/**
 * Điểm vào DUY NHẤT nên dùng để chẩn đoán mã khiếm khuyết theo tỷ lệ khí — thay cho gọi
 * thẳng diagnoseRatios(), vì tự chọn ĐÚNG bảng theo loại thiết bị:
 *  - Sứ xuyên: thử Table A.10 (Annex A.5.3) trước — có ≥1 mã khớp thì liệt kê ĐẦY ĐỦ các
 *    mã khớp (đúng bản chất 4 mã độc lập, không chỉ chọn 1 mã); KHÔNG mã nào khớp thì tự
 *    rơi về Table 1 (diagnoseRatios, ngưỡng PD 0,07) như bảng gốc yêu cầu — nếu Table 1
 *    cũng không kết luận được, trả nguyên NO_DIAGNOSIS (không bọc thêm chữ) để các nơi so
 *    sánh đúng-bằng-chuỗi (diagnosisIsConclusive()...) vẫn hoạt động đúng.
 *  - Các loại khác (MBA/TI/TU/Khác): dùng thẳng Table 1/Bảng 66 như trước nay — với TI/TU,
 *    đây CHÍNH LÀ điều Annex A.4.3 chỉ định (Table 1 + ngưỡng PD 0,2), không phải 1 bảng
 *    riêng khác — xem pdThresholdForType().
 * @param {object} gases {H2,CH4,C2H6,C2H4,C2H2,CO,CO2}
 * @param {string} equipmentType EQUIPMENT_TYPES.*
 * @param {number} pdThreshold ngưỡng CH4/H2 cho PD khi dùng/rơi về Table 1
 * @returns {string}
 */
function diagnoseGasFault(gases, equipmentType, pdThreshold) {
  const ratios = computeRatios(gases);
  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    const codes = diagnoseBushingRatios(ratios);
    if (codes.length > 0) {
      return `Bảng A.10 (sứ xuyên): ${codes.join(" + ")} — ${codes.map((c) => BUSHING_CODE_LABELS[c]).join("; ")}`;
    }
    const fallback = diagnoseRatios(ratios, pdThreshold);
    return fallback === NO_DIAGNOSIS ? NO_DIAGNOSIS : `${fallback} (rơi về Table 1 — không mã nào khớp Table A.10)`;
  }
  return diagnoseRatios(ratios, pdThreshold);
}

/**
 * Điều kiện áp dụng tỷ lệ khí theo Điều 54 QĐ1901 / mục 6.1(c) IEC60599:
 * tỷ lệ chỉ có ý nghĩa chẩn đoán khi có ít nhất 1 khí vượt giá trị điển hình.
 */
function ratioApplicability(exceedCount) {
  return exceedCount > 0
    ? "Đủ điều kiện – có khí vượt giá trị điển hình"
    : "Chưa đủ điều kiện chính thức – tỷ lệ chỉ mang tính tham khảo (Điều 54 QĐ1901/mục 6.1(c) IEC60599)";
}


// ---------------------------------------------------------------------------
// 6) Tam giác Duval (Duval Triangle 1) — IEC 60599:2022 Annex B, Figure B.3 (số Annex B
//    và Figure B.3 không đổi giữa 2 bản 1999/2022 — chỉ Annex A bị dịch số)
//    Chẩn đoán dạng sự cố bằng %CH4, %C2H4, %C2H2 (quy về tổng = 100%).
//    Ranh giới vùng lấy đúng theo bảng "Limits of zones" gốc trong Annex B, Figure B.3
//    (đã đối chiếu trực tiếp với file IEC 60599-2022.pdf do người dùng cung cấp — xem
//    ảnh chụp trang 37 của bản PDF gốc — phát hiện và sửa 2024-xx: bản cũ trong code
//    dùng nhầm 10%/38% thay vì đúng 20%/40% theo bảng gốc, và thiếu hẳn ràng buộc trên
//    của D2 theo %C2H2 (29%) cũng như vùng T3 mở rộng theo %C2H2 (15%)):
//      PD: %CH4 ≥ 98
//      D1: %C2H4 ≤ 23  và %C2H2 ≥ 13                (không giới hạn trên của %C2H2)
//      D2: 23 < %C2H4 ≤ 40  và  13 ≤ %C2H2 ≤ 29
//      T1: %C2H2 ≤ 4  và %C2H4 ≤ 20
//      T2: %C2H2 ≤ 4  và 20 < %C2H4 ≤ 50
//      T3: (%C2H2 ≤ 4 và %C2H4 > 50) — dải hẹp sát cạnh %C2H2=0 —
//          hoặc (%C2H2 ≤ 15 và %C2H4 > 50) — vùng mở rộng của T3 theo đúng dòng T3
//          trong bảng "Limits of zones" (15 % C2H2, 50 % C2H4)
//    Phần diện tích còn lại (vượt khỏi D1/D2 nhưng %C2H4 ≤ 50, hoặc %C2H2 > 15 với
//    %C2H4 > 50) là vùng ranh giới "D+T" mà chính hình vẽ gốc IEC 60599:2022
//    (Figure B.3) cũng ghi chú là chồng lấn/không phân định rõ giữa phóng điện và
//    tăng nhiệt — công cụ trả về nhãn riêng cho vùng này thay vì gán cứng vào D2
//    hoặc T3.
// ---------------------------------------------------------------------------

/**
 * Quy đổi 3 khí về % trên tổng (CH4 + C2H4 + C2H2) = 100%.
 * @returns {{ pctCH4:number, pctC2H4:number, pctC2H2:number } | null} null nếu tổng = 0
 */
function normalizeDuval(gases) {
  const ch4 = num(gases.CH4), c2h4 = num(gases.C2H4), c2h2 = num(gases.C2H2);
  const sum = ch4 + c2h4 + c2h2;
  if (sum <= 0) return null;
  return {
    pctCH4: (ch4 / sum) * 100,
    pctC2H4: (c2h4 / sum) * 100,
    pctC2H2: (c2h2 / sum) * 100,
  };
}

/**
 * Phân vùng Tam giác Duval 1 theo bảng "Limits of zones", Annex B, Figure B.3, IEC 60599:2022.
 * @param {{pctCH4:number, pctC2H4:number, pctC2H2:number}} pct
 * @returns {{ zone: string, label: string }}
 */
function classifyDuval1(pct) {
  const { pctCH4: m, pctC2H4: e, pctC2H2: a } = pct;

  if (m >= 98) return { zone: "PD", label: "PD - Phóng điện cục bộ (Tam giác Duval)" };

  if (a <= 4) {
    if (e <= 20) return { zone: "T1", label: "T1 - Tăng nhiệt, t<300°C (Tam giác Duval)" };
    if (e <= 50) return { zone: "T2", label: "T2 - Tăng nhiệt, 300-700°C (Tam giác Duval)" };
    return { zone: "T3", label: "T3 - Tăng nhiệt, t>700°C (Tam giác Duval)" };
  }

  if (a >= 13 && a <= 29 && e > 23 && e <= 40) {
    return { zone: "D2", label: "D2 - Phóng điện năng lượng cao (Tam giác Duval)" };
  }
  if (a >= 13 && e <= 23) {
    return { zone: "D1", label: "D1 - Phóng điện năng lượng thấp (Tam giác Duval)" };
  }

  if (a <= 15 && e > 50) {
    return { zone: "T3", label: "T3 - Tăng nhiệt, t>700°C (Tam giác Duval, vùng %C2H4 cao)" };
  }

  return {
    zone: "D+T",
    label: "D+T - Vùng chồng lấn phóng điện/tăng nhiệt (ranh giới không phân định rõ trong Tam giác Duval gốc IEC60599 Annex B)",
  };
}

/**
 * Tọa độ (x,y) để vẽ điểm trên tam giác đều (đỉnh CH4 ở trên, C2H2 dưới-trái, C2H4 dưới-phải),
 * cạnh đáy = 100 đơn vị, chiều cao = 100*sqrt(3)/2 ≈ 86,6 đơn vị.
 */
function duvalPlotXY(pct) {
  const h = 50 * Math.sqrt(3);
  const x = (pct.pctCH4 / 100) * 50 + (pct.pctC2H4 / 100) * 100;
  const y = (pct.pctCH4 / 100) * h;
  return { x, y };
}

/**
 * Hàm tiện ích tổng hợp: từ 1 bộ khí -> % chuẩn hóa + phân vùng (hoặc null nếu không đủ dữ liệu).
 */
function diagnoseDuval1(gases) {
  const pct = normalizeDuval(gases);
  if (!pct) return null;
  const result = classifyDuval1(pct);
  return { ...pct, ...result, xy: duvalPlotXY(pct) };
}


// ---------------------------------------------------------------------------
// 7) Tốc độ tăng hàm lượng khí giữa 2 lần đo (ppm/năm, Bảng 65, Điều 54 QĐ1901)
// ---------------------------------------------------------------------------

/**
 * @param {object} prevGases, {object} currGases  cùng đơn vị ppm
 * @param {number} deltaDays  số ngày giữa 2 lần đo
 * @param {object} rateRanges { gas: [lo, hi] } ppm/năm — mặc định Bảng 65 hoặc NSX nếu có cấu hình
 * @param {string} equipmentType dùng để ghi chú áp dụng chính thức (MBA) hay tham khảo (khác)
 */
function computeRateOfChange(prevGases, currGases, deltaDays, rateRanges, equipmentType) {
  if (!deltaDays || deltaDays <= 0) return null;
  const official = equipmentType === EQUIPMENT_TYPES.MBA;
  return GASES.map((gas) => {
    const before = num(prevGases[gas]);
    const after = num(currGases[gas]);
    const delta = after - before;
    const ratePerYear = (delta / deltaDays) * 365;
    const ratePerMonth = before === 0 ? null : (delta / before) / (deltaDays / 30) * 100;
    const [lo, hi] = rateRanges[gas] || QD1901_BANG65_RATE[gas];
    let verdict;
    if (delta < 0) verdict = "Giảm — có thể do lọc/xử lý/thay dầu, hoặc khiếm khuyết cũ ngừng phát triển";
    else if (ratePerYear > hi) verdict = `⚠ Vượt cận trên ${REGULATION_CITATIONS.BANG65_RATE} — nghi khiếm khuyết đang phát triển`;
    else if (ratePerYear < lo) verdict = `Dưới cận dưới ${REGULATION_CITATIONS.BANG65_RATE} — tốc độ thấp, bình thường`;
    else verdict = `Trong khoảng điển hình ${REGULATION_CITATIONS.BANG65_RATE}`;
    return {
      gas, before, after, delta,
      ratePerYear: round1(ratePerYear),
      ratePerMonth: ratePerMonth === null ? null : round1(ratePerMonth),
      rangeLo: lo, rangeHi: hi, verdict,
      officialForEquipment: official,
    };
  });
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Tốc độ sinh khí (%/tháng) của TỔNG lượng khí cháy (TCG) giữa 2 lần đo — cùng công
 * thức ratePerMonth với computeRateOfChange() ở trên. Khác chỗ: Bảng 65 (Điều 54
 * QĐ1901) chỉ quy định khoảng tham chiếu ppm/năm cho TỪNG khí riêng lẻ, KHÔNG có
 * khoảng tham chiếu cho TCG — nên hàm này chỉ trả về số liệu %/tháng để tham khảo
 * (dùng khi xuất BBTN, xem tcg_toc ở bbtn-export.js), không có rangeLo/rangeHi/verdict
 * như computeRateOfChange().
 * @param {number} prevTcg, {number} currTcg  ppm (kết quả computeTCG())
 * @param {number} deltaDays  số ngày giữa 2 lần đo
 */
function computeTcgRateOfChange(prevTcg, currTcg, deltaDays) {
  if (!deltaDays || deltaDays <= 0) return null;
  const before = num(prevTcg);
  const after = num(currTcg);
  const delta = after - before;
  const ratePerMonth = before === 0 ? null : (delta / before) / (deltaDays / 30) * 100;
  return {
    before: round1(before),
    after: round1(after),
    delta: round1(delta),
    ratePerMonth: ratePerMonth === null ? null : round1(ratePerMonth),
  };
}


// ---------------------------------------------------------------------------
// 7bis) "Đánh giá các tỷ lệ bổ sung" (Điều 54 QĐ1901, ngay sau Bảng 66) + Tổng hàm
//   lượng khí hòa tan (Bảng 63) — CẢ HAI đều KHÁC bộ 3 tỷ lệ chính (computeRatios()/
//   diagnoseRatios() ở trên, dùng để tra mã khiếm khuyết Bảng 66): đây là 2 chỉ tiêu
//   PHỤ, chỉ mang tính tham khảo bổ sung, KHÔNG dùng để tra mã PD/D1/D2/T1/T2/T3.
// ---------------------------------------------------------------------------



/**
 * Tổng hàm lượng khí hòa tan (%) theo Bảng 63 — CỘNG DỒN CẢ N2, O2, khác hẳn TCG ở
 * computeTCG() (chỉ cộng 6 khí cháy, không có CO2 lẫn N2/O2). Quy đổi ppm -> %: 1% =
 * 10.000 ppm (cùng đơn vị nồng độ thể tích khí/dầu, μL/L). Bắt buộc có CẢ N2 LẪN O2 vì
 * N2 thường chiếm tỷ trọng lớn nhất trong tổng khí hòa tan (hàng chục nghìn ppm ở thiết
 * bị thở tự do với khí quyển) — thiếu 1 trong 2 sẽ làm tổng bị tính thấp giả tạo, không
 * dùng để so Bảng 63 được.
 * @param {object} gases 7 khí GASES (ppm)
 * @param {number|null} n2, {number|null} o2  ppm, hoặc null nếu chưa nhập
 * @returns {number|null} % (null nếu thiếu N2 hoặc O2)
 */
function computeTotalDissolvedGasPercent(gases, n2, o2) {
  if (n2 === null || n2 === undefined || o2 === null || o2 === undefined) return null;
  const sum = GASES.reduce((s, g) => s + num(gases[g]), 0) + num(n2) + num(o2);
  return sum / 10000;
}

/**
 * Đánh giá Bảng 63 — CHỈ trả verdict Đạt/Không đạt khi applicable=true (đúng điều kiện
 * áp dụng của Bảng 63: dầu mới/sau sửa chữa thay dầu hoặc lọc dầu). Khi applicable=false
 * (dầu đang vận hành định kỳ thông thường) vẫn trả limit để tham khảo nhưng verdict=null
 * — không tự kết luận đạt/không đạt cho trường hợp Bảng 63 không áp dụng chính thức.
 * @param {number|null} totalPercent kết quả computeTotalDissolvedGasPercent()
 * @param {"110-220"|"500"} voltageClass
 * @param {boolean} applicable
 */
function evaluateBang63(totalPercent, voltageClass, applicable) {
  const limit = QD1901_BANG63_TDGC[voltageClass] ?? null;
  if (totalPercent === null || limit === null) return { limit, verdict: null, applicable: !!applicable };
  const verdict = applicable ? (totalPercent < limit ? "Đạt" : "Không đạt") : null;
  return { limit, verdict, applicable: !!applicable };
}

/**
 * "Đánh giá các tỷ lệ bổ sung", Điều 54 QĐ1901 (đoạn ngay sau Bảng 66):
 *  - CO2/CO: luôn tính được (CO, CO2 là 2 trong 7 khí bắt buộc).
 *  - O2/N2: chỉ tính được khi có CẢ N2 VÀ O2 (tùy chọn — xem computeTotalDissolvedGasPercent()).
 * CHỈ dùng đúng các mốc/điều kiện QĐ1901 nêu rõ để kết luận; giá trị nằm ngoài các mốc
 * đó chỉ hiển thị con số kèm ghi chú giới hạn, không tự suy diễn thêm ngưỡng ngoài văn
 * bản gốc (văn bản chỉ cho 1 mốc tham khảo O2/N2 ~ 0,5 "bình thường", không có thang đầy đủ).
 * @param {GasReading} gases 7 khí GASES (ppm)
 * @param {number|null} n2  ppm, hoặc null nếu chưa nhập
 * @param {number|null} o2  ppm, hoặc null nếu chưa nhập
 */
function diagnoseAdditionalRatios(gases, n2, o2) {
  const co = num(gases.CO), co2 = num(gases.CO2);
  const co2_co = co === 0 ? (co2 === 0 ? null : 999) : co2 / co;
  let co2coNote;
  if (co2_co === null) {
    co2coNote = "Không đủ dữ liệu để tính (CO và CO2 đều bằng 0).";
  } else if (co2_co < 3 && co > 1000) {
    co2coNote = "CO2/CO < 3 và CO > 1000 ppm — có khả năng liên quan đến giấy cách điện bị carbon hóa, cần xác nhận bằng phân tích furanic hoặc đo độ trùng hợp giấy.";
  } else if (co2_co > 10 && co2 > 10000) {
    co2coNote = "CO2/CO > 10 và CO2 > 10.000 ppm — có thể do quá nhiệt nhẹ (<160°C) hoặc oxy hóa dầu, đặc biệt ở máy biến áp hở.";
  } else {
    co2coNote = "Không rơi vào 2 điều kiện cảnh báo bổ sung của Điều 54 (CO2/CO<3 và CO>1000 ppm; hoặc CO2/CO>10 và CO2>10.000 ppm).";
  }

  const hasN2O2 = n2 !== null && n2 !== undefined && o2 !== null && o2 !== undefined && num(n2) > 0;
  let o2_n2 = null;
  let o2n2Note = "Chưa nhập đủ N2/O2 — bỏ qua tỷ lệ O2/N2.";
  if (hasN2O2) {
    o2_n2 = num(o2) / num(n2);
    if (o2_n2 < 0.3) {
      o2n2Note = "O2/N2 < 0,3 — tiêu thụ oxy quá mức do oxy hóa dầu hoặc lão hóa giấy cách điện.";
    } else {
      o2n2Note = "QĐ1901 chỉ nêu mốc tham khảo O2/N2 ~ 0,5 là bình thường ở thiết bị có tiếp xúc với không khí; văn bản không có thang đầy đủ để phân loại chính xác các giá trị khác — cần đối chiếu thêm kết cấu bình dầu phụ (có màng ngăn hay không) và thực tế vận hành trước khi kết luận.";
    }
  }

  return {
    co2_co: co2_co === null ? null : round1(co2_co),
    co2coNote,
    o2_n2: o2_n2 === null ? null : round1(o2_n2),
    o2n2Note,
  };
}

// ---------------------------------------------------------------------------
// 8) Khuyến cáo tổng hợp — tổng hợp kết luận tuyệt đối + chẩn đoán tỷ lệ (Bảng 66) +
//    chẩn đoán Tam giác Duval + tốc độ sinh khí.
//    Chỉ mang tính hỗ trợ; không thay thế nguyên tắc đánh giá tổng thể tại Điều 3, QĐ1901.
// ---------------------------------------------------------------------------

/** Trích các cảnh báo THEO ĐIỀU KIỆN cụ thể mà Điều 54 QĐ1901 nêu rõ (Tỷ lệ bổ sung
 *  CO2/CO, O2/N2, và Tổng hàm lượng khí hòa tan Bảng 63) — tách riêng khỏi
 *  buildRecommendations() để dùng CHUNG cho khuyến cáo ở tab "DGA" VÀ rà soát tự động ở
 *  tab "Cảnh báo" (computeGasAlerts(), ui-alerts.js), tránh định nghĩa lại điều kiện ở
 *  2 nơi rồi lệch nhau. Chỉ trả về khi rơi vào điều kiện cảnh báo QĐ1901 nêu rõ (không
 *  lặp lại ghi chú "bình thường"/"chưa đủ dữ liệu" — những ghi chú đó đã hiển thị đầy đủ
 *  trong bảng kết quả riêng ở tab "DGA"). Trả về mảng chuỗi, rỗng nếu không có gì đáng
 *  cảnh báo. */
function dieu54AdvisoryMessages({ additionalRatios, bang63 }) {
  const msgs = [];
  if (additionalRatios) {
    if (additionalRatios.co2_co !== null && additionalRatios.co2coNote && additionalRatios.co2coNote.startsWith("CO2/CO")) {
      msgs.push(`Tỷ lệ bổ sung CO2/CO (Điều 54): ${additionalRatios.co2coNote}`);
    }
    if (additionalRatios.o2_n2 !== null && additionalRatios.o2_n2 < 0.3) {
      msgs.push(`Tỷ lệ bổ sung O2/N2 (Điều 54): ${additionalRatios.o2n2Note}`);
    }
  }
  if (bang63 && bang63.verdict === "Không đạt") {
    msgs.push(
      `⚠ Tổng hàm lượng khí hòa tan vượt ngưỡng ${REGULATION_CITATIONS.BANG63_TDGC} (cấp điện áp áp dụng: <${bang63.limit}%) — áp dụng cho dầu mới/sau ` +
      `sửa chữa có thay dầu hoặc lọc dầu; khuyến cáo kiểm tra lại quy trình xử lý dầu (chân không hóa/lọc khí) trước khi ` +
      `đưa thiết bị vào vận hành chính thức.`
    );
  }
  return msgs;
}

function buildRecommendations({ overallOk, exceedCount, diagnosis, duval, rateRows, condemningRows, additionalRatios, bang63, equipmentType, bushingCodes }) {
  const recs = [];
  const rateWarnings = (rateRows || []).filter((r) => r.verdict && r.verdict.startsWith("⚠"));
  const condemnExceeded = condemningExceededRows(condemningRows);

  if (condemnExceeded.length > 0) {
    recs.push(
      `⚠ CẢNH BÁO NGHIÊM TRỌNG — VƯỢT NGƯỠNG LOẠI BỎ do nhà sản xuất quy định ở ${condemnExceeded.length} khí ` +
      `(${condemnExceeded.map((r) => `${r.gas}: ${r.value} > ${r.limit}`).join("; ")}) — đây là ngưỡng nghiêm trọng ` +
      `hơn mức "không đạt" thông thường; khuyến cáo báo cáo ngay cấp có thẩm quyền và xem xét ngừng vận hành/xử lý ` +
      `khẩn cấp theo quy trình nội bộ, không chờ đến chu kỳ giám sát tiếp theo.`
    );
  }
  if (overallOk && exceedCount === 0 && rateWarnings.length === 0 && condemnExceeded.length === 0) {
    recs.push("Kết quả trong giới hạn/khoảng điển hình — tiếp tục giám sát định kỳ theo chu kỳ quy định (Điều 3, 7, QĐ1901).");
  }
  if (!overallOk) {
    recs.push("Có khí vượt ngưỡng đạt/không đạt — đề nghị lấy mẫu bổ sung xác nhận (điện áp đánh thủng, tgδ, hàm lượng nước) và báo cáo cấp có thẩm quyền theo Điều 6, QĐ1901.");
  }
  if (equipmentType === EQUIPMENT_TYPES.BUSHING) {
    // Sứ xuyên: khuyến cáo riêng theo TỪNG mã Table A.10 đã khớp (có thể nhiều mã cùng
    // lúc — xem diagnoseBushingRatios()/diagnoseGasFault()) — KHÔNG dùng logic PD/D1/D2/T
    // chung bên dưới (dành cho Table 1/Bảng 66, cấu trúc 6 mã loại trừ nhau khác hẳn).
    if (bushingCodes && bushingCodes.length > 0) {
      const bushingMsgs = {
        PD: "Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): PD — phóng điện cục bộ (CH4/H2 < 0,07) — khuyến cáo đo phóng điện cục bộ bổ sung nếu điều kiện cho phép.",
        D: "Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): D — phóng điện (C2H2/C2H4 > 1) — khuyến cáo kiểm tra cách điện, siết lại kết nối, xem xét thí nghiệm điện môi bổ sung.",
        T: "Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): T — tăng nhiệt (C2H4/C2H6 > 1) — khuyến cáo kiểm tra mối nối/tiếp xúc, tải vận hành, và nhiệt độ điểm nóng nếu có điều kiện đo.",
        TP: "Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): TP — CO2/CO bất thường (nghi liên quan cách điện giấy) — đối chiếu thêm mục 5.5 IEC60599:2022 (CO2/CO<3 thường nghi carbon hóa giấy, CO2/CO>10 có thể là quá nhiệt nhẹ giấy/oxy hóa dầu) và cân nhắc thử nghiệm furan nếu cần xác nhận thêm.",
      };
      bushingCodes.forEach((c) => { if (bushingMsgs[c]) recs.push(bushingMsgs[c]); });
    } else if (exceedCount > 0 && diagnosis && diagnosis !== NO_DIAGNOSIS) {
      recs.push(`Không mã nào khớp Bảng A.10 (sứ xuyên) — đã tự động dùng lại Table 1/Bảng 66 theo đúng chỉ dẫn của bảng gốc ("the general Table 1 should be used"): "${diagnosis}". Nên đối chiếu thêm ý kiến chuyên gia/nhà sản xuất sứ xuyên khi rơi vào trường hợp này (xem Note 5, Annex A.5.4 IEC60599:2022).`);
    }
  } else if (exceedCount > 0 && diagnosis && diagnosis !== NO_DIAGNOSIS) {
    if (diagnosis.startsWith("PD")) recs.push("Mã chẩn đoán Bảng 66: PD (phóng điện cục bộ) — khuyến cáo đo phóng điện cục bộ (PD) bổ sung nếu điều kiện cho phép.");
    else if (diagnosis.startsWith("D1") || diagnosis.startsWith("D2")) recs.push("Mã chẩn đoán Bảng 66: phóng điện (D1/D2) — khuyến cáo kiểm tra cách điện, siết lại kết nối, xem xét thí nghiệm điện môi bổ sung.");
    else if (diagnosis.startsWith("T")) recs.push("Mã chẩn đoán Bảng 66: tăng nhiệt (T1/T2/T3) — khuyến cáo kiểm tra mối nối/tiếp xúc, tải vận hành, và nhiệt độ điểm nóng nếu có điều kiện đo.");
  }
  if (duval && duval.zone) {
    if (duval.zone === "D+T") {
      recs.push("Tam giác Duval rơi vào vùng chồng lấn phóng điện/tăng nhiệt (D+T, ranh giới không phân định rõ trong hình gốc IEC60599 Annex B) — nên đối chiếu thêm với mã Bảng 66/Bảng A.10 và các pha/lần đo khác trước khi kết luận dạng sự cố.");
    } else if (equipmentType === EQUIPMENT_TYPES.BUSHING && bushingCodes && bushingCodes.length > 0) {
      // So khớp theo "họ" mã (Table A.10 gộp D1/D2 → "D", T1/T2/T3 → "T"; Duval Triangle 1
      // vẫn áp dụng nguyên cho sứ xuyên — Annex B: "Duval's triangle 1 for transformers,
      // bushings and cables" — nên chỉ cần khớp họ, không cần khớp đúng D1 hay D2...).
      const duvalFamily = duval.zone.startsWith("PD") ? "PD" : duval.zone.startsWith("D") ? "D" : duval.zone.startsWith("T") ? "T" : null;
      if (duvalFamily && bushingCodes.includes(duvalFamily)) {
        recs.push(`Tam giác Duval cho cùng họ kết quả với Bảng A.10 (mã ${duvalFamily}, Duval mã ${duval.zone}) — tăng độ tin cậy của chẩn đoán.`);
      } else {
        recs.push(`Lưu ý: Tam giác Duval cho mã ${duval.zone}, khác với các mã đã khớp Bảng A.10 (${bushingCodes.join(", ")}) ở trên — hai phương pháp có thể lệch nhau khi khí ở gần ranh giới vùng; nên đối chiếu thêm dữ liệu vận hành/pha khác trước khi kết luận.`);
      }
    } else if (diagnosis && diagnosis.startsWith(duval.zone)) {
      recs.push(`Tam giác Duval cho cùng kết quả với Bảng 66 (${duval.zone}) — tăng độ tin cậy của chẩn đoán.`);
    } else if (!diagnosis || !diagnosis.startsWith(duval.zone.split("/")[0])) {
      recs.push(`Lưu ý: Tam giác Duval cho mã ${duval.zone}, khác với mã tra theo Bảng 66/Ba tỷ số khí cơ bản ở trên — hai phương pháp có thể lệch nhau khi khí ở gần ranh giới vùng; nên đối chiếu thêm dữ liệu vận hành/pha khác trước khi kết luận.`);
    }
  }
  if (rateWarnings.length > 0) {
    recs.push(`Tốc độ sinh khí vượt ${REGULATION_CITATIONS.BANG65_RATE} ở ${rateWarnings.length} khí (${rateWarnings.map((r) => r.gas).join(", ")}) — nghi khiếm khuyết đang phát triển, khuyến cáo rút ngắn chu kỳ giám sát và lấy mẫu DGA lại sớm hơn dự kiến.`);
  }
  if (exceedCount === 0 && diagnosis) {
    recs.push("Chưa đủ điều kiện áp dụng chính thức tỷ lệ khí (chưa có khí vượt giá trị điển hình) — mã chẩn đoán Bảng 66/Bảng A.10/Tam giác Duval ở trên chỉ mang tính tham khảo.");
  }
  // Tỷ lệ bổ sung + Tổng hàm lượng khí hòa tan (Điều 54) — xem dieu54AdvisoryMessages().
  recs.push(...dieu54AdvisoryMessages({ additionalRatios, bang63 }));
  return recs;
}


// ---------------------------------------------------------------------------
// 8bis) Trạng thái tổng thể — số hóa lưu đồ đánh giá DGA (Hình 1, mục 9, IEC
//    60599:2022) thành 1 thuật toán 3 mức duy nhất, hiển thị nổi bật ở đầu kết quả
//    phân tích và giải thích chi tiết ở tab "Quy trình đánh giá":
//      - "normal" (Bình thường): tất cả khí dưới giá trị điển hình VÀ tốc độ tăng khí
//        bình thường — nhánh phải của lưu đồ gốc ("Report as typical DGA/healthy
//        equipment").
//      - "alert" (Cảnh báo — ALERT condition): có khí vượt giá trị điển hình hoặc tốc
//        độ tăng bất thường, nhưng CHƯA vượt ngưỡng tuyệt đối/loại bỏ và loại sự cố
//        (nếu xác định được) chưa đổi khác so với lần đo liền trước.
//      - "alarm" (Báo động — ALARM condition): vượt ngưỡng tuyệt đối (Không đạt
//        QĐ1901/IEC hoặc tiêu chuẩn nhà sản xuất), HOẶC vượt ngưỡng loại bỏ nhà sản
//        xuất, HOẶC loại sự cố theo Bảng 66 đổi khác so với lần đo liền trước — đúng
//        nhánh "Gas concentration above alarm values... or change in fault type" của
//        lưu đồ gốc.
//    CHỈ mang tính hỗ trợ tự động; KHÔNG thay thế nguyên tắc đánh giá tổng thể tại
//    Điều 3 QĐ1901 (so với pha khác/thiết bị cùng loại/giá trị xuất xưởng/hướng dẫn
//    nhà sản xuất/diễn biến vận hành thực tế — những yếu tố phần mềm không có đủ dữ
//    liệu để tự động hóa).
// ---------------------------------------------------------------------------

function diagnosisIsConclusive(diagnosis) {
  return !!diagnosis && diagnosis !== NO_DIAGNOSIS;
}

/**
 * @param {object} p
 * @param {boolean} p.overallOk kết quả overallVerdict() === "Đạt"
 * @param {number} p.exceedCount kết quả countExceedTypical()
 * @param {string} p.diagnosis kết quả diagnoseRatios() của lần đo hiện tại
 * @param {string|null} p.priorDiagnosis kết quả diagnoseRatios() của lần đo liền trước (nếu có)
 * @param {Array|null} p.rateRows kết quả computeRateOfChange() (nếu có lần đo trước)
 * @param {Array} p.condemningRows kết quả evaluateCondemning()
 * @returns {{level:"normal"|"alert"|"alarm", label:string, reasons:string[], action:string}}
 */
function computeOverallStatus({ overallOk, exceedCount, diagnosis, priorDiagnosis, rateRows, condemningRows }) {
  const condemnExceeded = condemningExceededRows(condemningRows);
  const rateWarnings = (rateRows || []).filter((r) => r.verdict && r.verdict.startsWith("⚠"));
  const faultTypeChanged =
    diagnosisIsConclusive(diagnosis) && diagnosisIsConclusive(priorDiagnosis) && diagnosis !== priorDiagnosis;

  const alarmReasons = [];
  if (condemnExceeded.length > 0) {
    alarmReasons.push(
      `Vượt ngưỡng LOẠI BỎ do nhà sản xuất quy định ở ${condemnExceeded.length} khí (${condemnExceeded.map((r) => r.gas).join(", ")}).`
    );
  }
  if (!overallOk) {
    alarmReasons.push('Có khí vượt ngưỡng tuyệt đối đang áp dụng ("Không đạt") — xem bảng "Đánh giá giá trị tuyệt đối từng khí".');
  }
  if (faultTypeChanged) {
    alarmReasons.push(`Loại sự cố theo Bảng 66 đổi khác so với lần đo liền trước: "${priorDiagnosis}" → "${diagnosis}".`);
  }
  if (alarmReasons.length > 0) {
    return {
      level: "alarm",
      label: "BÁO ĐỘNG (ALARM)",
      reasons: alarmReasons,
      action: "Hành động ngay: lấy mẫu bổ sung xác nhận, kiểm tra hiện trường, cân nhắc giám sát trực tuyến/sửa chữa, và báo cáo cấp có thẩm quyền theo Điều 6 QĐ1901.",
    };
  }

  const alertReasons = [];
  if (exceedCount > 0) {
    alertReasons.push(`Có ${exceedCount} khí vượt giá trị điển hình (Bảng 64 QĐ1901/Điều 54, hoặc Annex A IEC 60599:2022 theo loại thiết bị).`);
  }
  if (rateWarnings.length > 0) {
    alertReasons.push(`Tốc độ tăng khí vượt khoảng điển hình ${REGULATION_CITATIONS.BANG65_RATE} ở ${rateWarnings.length} khí (${rateWarnings.map((r) => r.gas).join(", ")}).`);
  }
  if (alertReasons.length > 0) {
    return {
      level: "alert",
      label: "CẢNH BÁO (ALERT)",
      reasons: alertReasons,
      action: "Tăng tần suất lấy mẫu, cân nhắc giám sát trực tuyến; đối chiếu mã chẩn đoán Bảng 66/Tam giác Duval để theo dõi sát diễn biến.",
    };
  }

  return {
    level: "normal",
    label: "BÌNH THƯỜNG",
    reasons: ["Tất cả khí dưới giá trị điển hình; tốc độ tăng khí (nếu có lần đo trước để so sánh) trong khoảng bình thường."],
    action: "Tiếp tục giám sát định kỳ theo chu kỳ quy định (Điều 3, 7 QĐ1901).",
  };
}

// ===== logic/dga-logic-oil.js =====
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
 * @param {{voltageClass: string, oilState?: string, hasMembraneN2?: boolean, manufacturer?: string|null}} input
 * @param {ManufacturerOilStandard[]|null|undefined} manufacturerOilStandards { manufacturer, voltageClass, oilState, moisture, tgd90, bdv, source }
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

// ===== logic/dga-logic-instrument-oil.js =====
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
 * @param {InstrumentOilTestInput} input  equipmentType là EQUIPMENT_TYPES.TI/TU; manufacturerOilStandards
 *   xem toOilStandardsForLogic() ở ui-standards.js — cần thêm equipmentType/*Reject
 * @returns {OilTestResult}
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

// ===== logic/dga-logic-forecast.js =====
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
 * @param {Array<{date: string|Date, value: number|string|null|undefined}>} history lịch sử đo
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
    .sort((a, b) => a.date.getTime() - b.date.getTime());

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

// ===== logic/dga-logic-regulation-config.js =====
/* dga-logic-regulation-config.js — Phần 6/6 của dga-logic.js sau khi tách theo miền
   (xem dga-logic.js). Đăng ký + đọc/ghi đè các bảng ngưỡng "đơn giản" có thể cấu hình
   qua tab "Cấu hình" — mục "Quy định" (ui/ui-regulation-config.js), KHÔNG bao gồm
   logic rẽ nhánh (Bảng 66/Table A.10/Tam giác Duval — cố định theo văn bản gốc). Mỗi
   mục registry giữ tham chiếu TRỰC TIẾP tới 1 object hằng số khai báo ở
   dga-logic-core.js — sửa qua applyRegulationConfigOverride() là ghi đè property của
   CHÍNH object đó, mọi hàm ở các module khác tự động thấy giá trị mới mà không cần
   sửa lại bản thân các hàm đó. */

// ---------------------------------------------------------------------------
// 9) Cấu hình quy định (regulation config) — làm các bảng ngưỡng ĐƠN GIẢN ở trên (không
//    có logic rẽ nhánh phức tạp) có thể XEM/SỬA qua giao diện (mục "Quy định" trong tab
//    "Cấu hình", xem ui/ui-regulation-config.js), để khi QĐ1901/IEC 60599 có bản cập nhật trong
//    tương lai, người dùng KHÔNG cần sửa code — chỉ cần sửa số + tham chiếu nguồn qua
//    giao diện. CỐ Ý KHÔNG đưa vào đây (theo đúng phạm vi người dùng đã xác nhận): Bảng
//    66/Table 1 (diagnoseRatios() — logic rẽ nhánh 6 mã loại trừ nhau), Table A.10 sứ
//    xuyên (diagnoseBushingRatios()), ranh giới Tam giác Duval (classifyDuval1()), và
//    các enum thuần key/nhãn (EQUIPMENT_TYPES/MBA_SUBTYPES/INSTRUMENT_SUBTYPES — không
//    phải ngưỡng số).
//
// CƠ CHẾ: mỗi bảng hằng số ở các mục 2/2bis/7bis/8 phía trên VẪN LÀ nguồn "mặc định"
// (khai báo bằng const, nhưng object literal nên PROPERTY của nó vẫn sửa được —
// applyRegulationConfigOverride() bên dưới ghi đè trực tiếp lên property của chính các
// object đó, KHÔNG tạo bản sao mới) — nghĩa là mọi hàm ở các mục trên (resolveStandard(),
// computeRateOfChange(), evaluateOltcOilTest()...) tự động dùng số liệu đã ghi đè mà
// KHÔNG cần sửa lại bản thân các hàm đó. _regulationConfigDefaults chụp lại giá trị gốc
// NGAY LÚC file này được nạp (TRƯỚC khi áp dụng bất kỳ override nào từ Google Sheets/
// Supabase/localStorage) để phục vụ nút "Khôi phục mặc định" ở giao diện.
// ---------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/** Ghi đè property của target theo source — CHỈ đệ quy khi CẢ 2 phía đều là object
 *  thuần (không phải mảng/null); còn lại (kể cả khi target đang là null, ví dụ
 *  BANG49_OLTC.pharieng.tren35duoi110 — QĐ1901 hiện chưa có số liệu) thì GÁN THẲNG giá
 *  trị từ source — cho phép người dùng "điền vào chỗ trống" khi quy định có số liệu mới
 *  mà không cần sửa code. Bỏ qua key nào source không có (giữ nguyên mặc định/override cũ). */
function deepMergeInto(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return;
  Object.keys(source).forEach((k) => {
    if (source[k] === undefined) return;
    if (isPlainObject(source[k]) && isPlainObject(target[k])) {
      deepMergeInto(target[k], source[k]);
    } else {
      target[k] = deepClone(source[k]);
    }
  });
}

/** Đọc giá trị tại 1 "đường dẫn" (mảng key) trong object lồng nhau — trả về undefined
 *  an toàn nếu đi qua null/undefined giữa đường (vd tren35duoi110 hiện đang là null). */
function getValueAtPath(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Ghi giá trị tại 1 "đường dẫn" vào object — TỰ TẠO object rỗng ở các cấp trung gian
 *  còn thiếu (kể cả khi cấp đó hiện là null), dùng để build lại object override đầy đủ
 *  từ giá trị các ô nhập trên form (xem ui/ui-regulation-config.js). */
function setValueAtPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!isPlainObject(cur[key])) cur[key] = {};
    cur = cur[key];
  }
  cur[path[path.length - 1]] = value;
}

function gasMapFields(unit) {
  return GASES.map((g) => ({ path: [g], label: g, unit, kind: "number" }));
}

function gasRangeFields(unit) {
  return GASES.map((g) => ({ path: [g], label: g, unit, kind: "range" }));
}

const OIL_STATE_LABELS = { new: "Mới/sau lắp đặt/sau sửa chữa", inservice: "Đang vận hành" };

function voltageStateFields(unit) {
  const fields = [];
  OIL_VOLTAGE_CLASSES.forEach((vc) => {
    ["new", "inservice"].forEach((state) => {
      fields.push({ path: [vc.value, state], label: `${vc.label} — ${OIL_STATE_LABELS[state]}`, unit, kind: "number" });
    });
  });
  return fields;
}

/**
 * Đăng ký toàn bộ các bảng ngưỡng "đơn giản" có thể cấu hình qua tab "Cấu hình quy
 * định". Mỗi mục:
 *  - key: định danh DUY NHẤT, dùng làm "id" khi lưu xuống Google Sheets/Supabase/
 *    localStorage (xem storage.js: listRegulationConfig/saveRegulationConfig).
 *  - category: PHÂN LOẠI áp dụng — hiển thị để nhóm các bảng theo loại thiết bị/bối
 *    cảnh, đúng yêu cầu "có phân loại áp dụng trong giao diện cấu hình".
 *  - title: tên bảng hiển thị.
 *  - citationKey: key trong REGULATION_CITATIONS — chuỗi tham chiếu nguồn, CÓ THỂ SỬA.
 *  - target: tham chiếu TRỰC TIẾP tới object hằng số tương ứng ở các mục trên — sửa
 *    property của target = mọi nơi dùng hằng số đó tự động thấy giá trị mới.
 *  - fields: danh sách trường có thể sửa (path/label/unit/kind) — dùng để tự render
 *    form + đọc/ghi giá trị (generic, không cần code UI riêng cho từng bảng).
 */
function buildRegulationConfigRegistry() {
  return [
    {
      key: "BANG64_MBA", category: "MBA/Kháng dầu — Khí hòa tan (ngưỡng, phối hợp cùng IEC Annex A.2)",
      title: "QĐ1901 Bảng 64 — Cận trên khoảng giá trị điển hình khí hòa tan (MBA)",
      citationKey: "BANG64_MBA", target: QD1901_BANG64_MBA, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A2", category: "MBA/Kháng dầu — Khí hòa tan (ngưỡng, phối hợp cùng QĐ1901 Bảng 64)",
      title: "IEC 60599:2022 Annex A.2.4 Table A.2 — Khoảng giá trị điển hình 90% (MBA lực), theo loại OLTC",
      citationKey: "IEC_A2", target: IEC_A2_POWER_TRANSFORMER,
      fields: [MBA_SUBTYPES.NO_OLTC, MBA_SUBTYPES.COMM_OLTC].flatMap((subtype) =>
        GASES.map((g) => ({ path: [subtype, g], label: `${subtype} — ${g}`, unit: "ppm", kind: "number" }))
      ),
    },
    {
      key: "BANG12_TI", category: "TI/TU — Khí hòa tan (giá trị tối đa cho phép)",
      title: "QĐ1901 Bảng 12 — Giá trị hàm lượng khí hòa tan cực đại (TI kiểu kín)",
      citationKey: "BANG12_TI", target: QD1901_BANG12_TI, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A8", category: "TI/TU — Khí hòa tan (giá trị tối đa cho phép)",
      title: "IEC 60599:2022 Annex A.4.4 Table A.8 — Giá trị tối đa cho phép (máy biến áp đo lường kiểu kín)",
      citationKey: "IEC_A8", target: IEC_A8_INSTRUMENT_MAX, fields: gasMapFields("ppm"),
    },
    {
      key: "IEC_A7", category: "TI/TU — Khí hòa tan (khoảng điển hình tham khảo, CT/VT)",
      title: "IEC 60599:2022 Annex A.4.4 Table A.7 — Khoảng giá trị điển hình 90%, theo CT/VT",
      citationKey: "IEC_A7", target: IEC_A7_INSTRUMENT_TYPICAL,
      fields: [INSTRUMENT_SUBTYPES.CT, INSTRUMENT_SUBTYPES.VT].flatMap((subtype) =>
        GASES.map((g) => ({ path: [subtype, g], label: `${subtype} — ${g}`, unit: "ppm", kind: "number" }))
      ),
    },
    {
      key: "IEC_A11_BUSHING", category: "Sứ xuyên (Bushing) — Khí hòa tan (khoảng điển hình = ngưỡng áp dụng)",
      title: "IEC 60599:2022 Annex A.5.4 Table A.11 — Khoảng giá trị điển hình 90% (sứ xuyên)",
      citationKey: "IEC_A11_BUSHING", target: IEC_A11_BUSHING, fields: gasMapFields("ppm"),
    },
    {
      key: "BANG65_RATE", category: "MBA/Kháng dầu — Tốc độ tăng hàm lượng khí",
      title: "QĐ1901 Bảng 65 — Khoảng tốc độ tăng hàm lượng khí điển hình (ppm/năm)",
      citationKey: "BANG65_RATE", target: QD1901_BANG65_RATE, fields: gasRangeFields("ppm/năm"),
    },
    {
      key: "PD_THRESHOLD", category: "Ngưỡng tỷ lệ CH4/H2 cho mã PD (theo loại thiết bị) — dùng chung cho Bảng 66/Table A.10",
      title: "Ngưỡng CH4/H2 xác định mã Phóng điện cục bộ (PD), theo loại thiết bị",
      citationKey: "PD_THRESHOLD", target: PD_THRESHOLD_BY_TYPE,
      fields: Object.values(EQUIPMENT_TYPES).map((t) => ({ path: [t], label: t, unit: "", kind: "number" })),
    },
    {
      key: "BANG63_TDGC", category: "MBA/Kháng dầu — Tổng hàm lượng khí hòa tan (dầu mới/sau xử lý)",
      title: "QĐ1901 Bảng 63 — Ngưỡng tổng hàm lượng khí hòa tan (%)",
      citationKey: "BANG63_TDGC", target: QD1901_BANG63_TDGC,
      fields: [
        { path: ["110-220"], label: "Cấp điện áp 110–220 kV", unit: "%", kind: "number" },
        { path: ["500"], label: "Cấp điện áp 500 kV", unit: "%", kind: "number" },
      ],
    },
    {
      key: "BANG54_BDV", category: "Dầu MBA — Điện áp chọc thủng",
      title: "QĐ1901 Bảng 54 — Điện áp chọc thủng dầu (kV, khe hở 2,5mm), không thấp hơn",
      citationKey: "BANG54_BDV", target: BANG54_BDV, fields: voltageStateFields("kV"),
    },
    {
      key: "BANG55_TGD90", category: "Dầu MBA — Tổn hao điện môi tgδ ở 90°C",
      title: "QĐ1901 Bảng 55 — Tổn hao điện môi tgδ dầu ở 90°C (%), không lớn hơn",
      citationKey: "BANG55_TGD90", target: BANG55_TGD90, fields: voltageStateFields("%"),
    },
    {
      key: "BANG58_WATER", category: "Dầu MBA — Hàm lượng nước",
      title: "QĐ1901 Bảng 58 — Hàm lượng nước trong dầu (ppm), không lớn hơn",
      citationKey: "BANG58_WATER", target: BANG58_WATER,
      fields: [
        { path: ["den110_comMangN2", "new"], label: "≤110kV, có màng/N2 — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["den110_comMangN2", "inservice"], label: "≤110kV, có màng/N2 — Đang vận hành", unit: "ppm", kind: "number" },
        { path: ["den110_khongMangN2", "new"], label: "≤110kV, không có màng/N2 — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["den110_khongMangN2", "inservice"], label: "≤110kV, không có màng/N2 — Đang vận hành", unit: "ppm", kind: "number" },
        { path: ["tren110", "new"], label: "220kV/500kV — Mới/sau lắp đặt/sau sửa chữa", unit: "ppm", kind: "number" },
        { path: ["tren110", "inservice"], label: "220kV/500kV — Đang vận hành", unit: "ppm", kind: "number" },
      ],
    },
    {
      key: "BANG49_OLTC", category: "Dầu OLTC (đang vận hành) — Độ ẩm & điện áp chọc thủng",
      title: "QĐ1901 Bảng 49 — Ngưỡng dầu khoang điều áp dưới tải (OLTC) khi đang vận hành",
      citationKey: "BANG49_OLTC", target: BANG49_OLTC,
      fields: [
        { path: ["trungtinh", "bdv"], label: "Điểm cuối trung tính — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["trungtinh", "moisture"], label: "Điểm cuối trung tính — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "duoi15", "bdv"], label: "Một pha/không trung tính, <15kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "duoi15", "moisture"], label: "Một pha/không trung tính, <15kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "15den35", "bdv"], label: "Một pha/không trung tính, 15–35kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "15den35", "moisture"], label: "Một pha/không trung tính, 15–35kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "tren35duoi110", "bdv"], label: "Một pha/không trung tính, >35–<110kV — Điện áp chọc thủng (QĐ1901 hiện chưa có số liệu)", unit: "kV", kind: "number" },
        { path: ["pharieng", "tren35duoi110", "moisture"], label: "Một pha/không trung tính, >35–<110kV — Hàm lượng nước (QĐ1901 hiện chưa có số liệu)", unit: "ppm", kind: "number" },
        { path: ["pharieng", "110", "bdv"], label: "Một pha/không trung tính, 110kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "110", "moisture"], label: "Một pha/không trung tính, 110kV — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "220", "bdv"], label: "Một pha/không trung tính, 220kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "220", "moisture"], label: "Một pha/không trung tính, 220kV — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "500", "bdv"], label: "Một pha/không trung tính, 500kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "500", "moisture"], label: "Một pha/không trung tính, 500kV — Hàm lượng nước", unit: "ppm", kind: "number" },
      ],
    },
  ];
}

const REGULATION_CONFIG_REGISTRY = buildRegulationConfigRegistry();

// Chụp lại NGAY LÚC nạp file (trước khi bất kỳ override nào từ storage được áp dụng) để
// phục vụ resetRegulationConfigItem() ("Khôi phục mặc định"). Registry được build 1 LẦN
// DUY NHẤT ở trên nên target luôn đúng là hằng số gốc tại thời điểm chụp này.
const _regulationConfigDefaults = {};
REGULATION_CONFIG_REGISTRY.forEach((item) => {
  _regulationConfigDefaults[item.key] = {
    citation: REGULATION_CITATIONS[item.citationKey],
    values: deepClone(item.target),
  };
});

function getRegulationConfigRegistry() {
  return REGULATION_CONFIG_REGISTRY;
}

function findRegulationConfigItem(key) {
  return REGULATION_CONFIG_REGISTRY.find((it) => it.key === key) || null;
}

/**
 * Áp dụng 1 bản ghi cấu hình đã lưu (Storage.listRegulationConfig()) lên đúng object
 * hằng số target — gọi 1 lần lúc khởi động app (initApp(), xem ui/ui-regulation-
 * config.js: applyAllRegulationConfigOverrides()) SAU KHI đã tải xong danh sách từ
 * storage. Ghi đè CẢ citation (REGULATION_CITATIONS[item.citationKey]) lẫn giá trị số
 * (deep-merge vào item.target — xem deepMergeInto()).
 * @param {string} key
 * @param {{citation?: string, values?: object}} override
 */
function applyRegulationConfigOverride(key, override) {
  const item = findRegulationConfigItem(key);
  if (!item || !override) return;
  if (override.citation) REGULATION_CITATIONS[item.citationKey] = override.citation;
  if (override.values) deepMergeInto(item.target, override.values);
}

/** Khôi phục 1 bảng về ĐÚNG giá trị/citation mặc định gốc (lúc app khởi động). */
function resetRegulationConfigItem(key) {
  const item = findRegulationConfigItem(key);
  const snap = _regulationConfigDefaults[key];
  if (!item || !snap) return;
  REGULATION_CITATIONS[item.citationKey] = snap.citation;
  // Xóa hết property hiện có trên target rồi gán lại nguyên bản snapshot — deepMergeInto()
  // không tự XÓA property (chỉ ghi đè/thêm), nên cần xóa sạch trước để không sót lại phần
  // ghi đè cũ khi khôi phục mặc định.
  Object.keys(item.target).forEach((k) => delete item.target[k]);
  Object.assign(item.target, deepClone(snap.values));
}

function regulationConfigDefaultCitation(key) {
  const snap = _regulationConfigDefaults[key];
  return snap ? snap.citation : null;
}

/** Trạng thái HIỆN TẠI (đã áp dụng override, nếu có) của 1 bảng — dùng để hiển thị lên
 *  form khi mở mục "Quy định" trong tab "Cấu hình". */
function getRegulationConfigCurrentValues(key) {
  const item = findRegulationConfigItem(key);
  if (!item) return null;
  return { citation: REGULATION_CITATIONS[item.citationKey], values: deepClone(item.target) };
}

// Export cho cả trình duyệt (global) lẫn Node (module.exports, dùng để test)

// ===== logic/dga-logic-peer.js =====
// dga-logic-peer.js — Đề xuất người dùng #2: "Phát hiện bất thường theo nhóm thiết bị
// tương tự" (thống kê nhẹ, KHÔNG train/lưu model, chạy 100% phía client, không cần
// server ML riêng — đúng theo yêu cầu gốc của người dùng).
//
// BỔ SUNG một lớp so sánh "SO VỚI ĐÀN" (peer comparison) BÊN CẠNH đánh giá theo ngưỡng
// TUYỆT ĐỐI cố định đã có sẵn (Bảng 64/66/Annex A... ở dga-logic-gas.js/dga-logic-core.js)
// — KHÔNG thay thế, KHÔNG làm thay đổi overallStatus (Bình thường/Cảnh báo/Báo động)
// hay kết quả Đạt/Không đạt chính thức theo QĐ1901/IEC. Đây LUÔN LÀ THAM KHẢO BỔ SUNG —
// không được dùng để tự ý kết luận thay cho các bảng/ngưỡng chính thức (xem ghi chú ở
// evaluatePeerAnomaly() và cách renderPeerAnomaly() ở ui/ui-dga.js hiển thị rõ nhãn này).
//
// Ý tưởng: với 1 lần đo cụ thể, tìm các LẦN ĐO KHÁC (của thiết bị này hoặc thiết bị
// khác, đã lưu trong Lịch sử đo) CÙNG NHÓM — ưu tiên cùng loại thiết bị + cùng cấp điện
// áp + cùng nhà sản xuất, nới dần tiêu chí nếu không đủ dữ liệu — làm "quần thể tham
// chiếu" (peer set), rồi tính:
//   (a) z-score từng khí, trên thang log1p — nồng độ khí hòa tan thực tế lệch phải rõ
//       rệt (đa số thiết bị khỏe mạnh có giá trị rất nhỏ, một số ít có giá trị lớn hơn
//       nhiều lần chứ không phân bố đối xứng kiểu chuẩn) nên z-score trên giá trị PPM
//       thô dễ bị vài lần đo giá trị lớn kéo lệch trung bình/độ lệch chuẩn, làm mất độ
//       nhạy — tính trên log1p(ppm) cho z-score phản ánh đúng "khác biệt bao nhiêu lần"
//       hơn là "khác biệt bao nhiêu ppm tuyệt đối".
//   (b) điểm bất thường tổng hợp bằng Isolation Forest ĐƠN GIẢN tự dựng NGAY LÚC ĐÁNH
//       GIÁ bằng chính quần thể "đàn" hiện có (không lưu lại, không phải model đã huấn
//       luyện theo nghĩa ML thông thường) — xét ĐỒNG THỜI cả 7 khí, phát hiện được kiểu
//       bất thường mà z-score từng khí riêng lẻ dễ bỏ sót (VD: nhiều khí cùng tăng nhẹ
//       một lúc, không khí nào tự nó vượt ngưỡng cảnh báo riêng).
// Thuật toán gốc: Liu, Ting, Zhou (2008), "Isolation Forest".

const PEER_MIN_SAMPLES = 5; // tối thiểu bấy nhiêu lần đo CÙNG NHÓM (không tính lần đo đang xét)
                             // mới đủ tin cậy để tính thống kê — dưới mức này chỉ báo "thiếu dữ liệu".
const PEER_Z_ALERT = 3; // |z-score| từ mức này trở lên: lệch RÕ RỆT khỏi số đông cùng nhóm
const PEER_Z_WARN = 2; // |z-score| từ mức này trở lên: lệch NHẸ, nên theo dõi thêm
const PEER_IF_ALERT = 0.62; // điểm Isolation Forest từ mức này trở lên: khả năng bất thường CAO
const PEER_IF_WARN = 0.55; // từ mức này trở lên: hơi lệch khỏi số đông, nên theo dõi thêm

// Cấp điện áp truyền tải/phân phối phổ biến ở Việt Nam — dùng để gom "cùng cấp điện
// áp" dù ô nhập "Điện áp định mức" là text tự do (VD "220kV", "220 kV", nhãn máy có
// khi ghi lệch chút như "230 kV" cho cùng 1 cấp hệ thống 220kV). Sai lệch trong khoảng
// PEER_VOLTAGE_TOLERANCE so với 1 cấp chuẩn vẫn coi là cùng cấp.
const PEER_VOLTAGE_CLASSES = [22, 35, 66, 110, 220, 500];
const PEER_VOLTAGE_TOLERANCE = 0.15;

function peerParseVoltageKV(dienApDmText) {
  if (!dienApDmText) return null;
  const m = String(dienApDmText).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const kv = parseFloat(m[1]);
  return Number.isFinite(kv) && kv > 0 ? kv : null;
}

function peerVoltageClass(dienApDmText) {
  const kv = peerParseVoltageKV(dienApDmText);
  if (kv === null) return null;
  let nearest = null;
  let nearestDiff = Infinity;
  for (const vc of PEER_VOLTAGE_CLASSES) {
    const diff = Math.abs(kv - vc) / vc;
    if (diff < nearestDiff) { nearestDiff = diff; nearest = vc; }
  }
  if (nearest !== null && nearestDiff <= PEER_VOLTAGE_TOLERANCE) return nearest;
  // Không khớp cấp chuẩn nào (VD sứ hạ thế, kết cấu đặc biệt/thử nghiệm) — vẫn gom
  // theo giá trị thô làm tròn đến hàng chục, còn hơn bỏ hẳn tiêu chí điện áp.
  return Math.round(kv / 10) * 10;
}

function peerGasVector(record) {
  // Bản ghi đọc từ Storage.listMeasurements() có thể ở dạng khóa CHỮ THƯỜNG (h2, ch4...
  // xem normalizeGasKeys() ở storage.js) trong khi "measurement"/"gases" đang nhập ở
  // form dùng khóa CHỮ HOA — đọc cả 2 dạng cho chắc, KHÔNG phụ thuộc lớp UI nào (giữ
  // file logic độc lập, kiểm thử được qua Node như các file logic/dga-logic-*.js khác).
  return GASES.map((g) => {
    const raw = record[g] ?? record[g.toLowerCase()];
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
}

function peerLog1p(v) {
  return Math.log(1 + Math.max(0, v));
}

// ---------------------------------------------------------------------------
// Gom nhóm "đàn" — nới lỏng dần tiêu chí (loại+cấp điện áp+hãng SX → loại+cấp điện áp
// → chỉ loại) nếu tiêu chí chặt hơn không đủ PEER_MIN_SAMPLES lần đo, để LUÔN cố tính
// được thống kê khi có thể thay vì báo "thiếu dữ liệu" quá sớm chỉ vì tiêu chí ban đầu
// quá chặt (thực tế 1 đơn vị truyền tải thường không có nhiều thiết bị TRÙNG cả 3 tiêu
// chí). Trả về tier ĐẦU TIÊN đạt đủ PEER_MIN_SAMPLES; nếu không tier nào đạt, trả về
// tier có nhiều lần đo nhất kèm sufficient=false.
// ---------------------------------------------------------------------------
function peerBuildGroup(allRecords, target) {
  const targetType = target.equipment_type || null;
  const targetVoltage = peerVoltageClass(target.dien_ap_dm);
  const targetMfr = (target.manufacturer || "").trim() || null;
  const targetId = target.id || null;

  const others = allRecords.filter((r) => r.id !== targetId);

  const tiers = [];
  if (targetMfr && targetVoltage !== null) {
    tiers.push({
      key: "loai+capdienap+hangsx",
      label: `${targetType || "?"}, ${targetVoltage} kV, hãng ${targetMfr}`,
      match: (r) =>
        r.equipment_type === targetType &&
        peerVoltageClass(r.dien_ap_dm) === targetVoltage &&
        (r.manufacturer || "").trim() === targetMfr,
    });
  }
  if (targetVoltage !== null) {
    tiers.push({
      key: "loai+capdienap",
      label: `${targetType || "?"}, ${targetVoltage} kV (mọi hãng sản xuất)`,
      match: (r) => r.equipment_type === targetType && peerVoltageClass(r.dien_ap_dm) === targetVoltage,
    });
  }
  tiers.push({
    key: "loai",
    label: `${targetType || "?"} (mọi cấp điện áp, mọi hãng sản xuất)`,
    match: (r) => r.equipment_type === targetType,
  });

  let best = null;
  for (const tier of tiers) {
    const peers = others.filter(tier.match);
    if (!best || peers.length > best.peers.length) best = { tier: tier.key, label: tier.label, peers };
    if (peers.length >= PEER_MIN_SAMPLES) return { tier: tier.key, label: tier.label, peers, sufficient: true };
  }
  return { ...best, sufficient: false };
}

function peerComputeStats(peerVectorsLog) {
  const n = peerVectorsLog.length;
  return GASES.map((_, i) => {
    const vals = peerVectorsLog.map((v) => v[i]);
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
    return { mean, std: Math.sqrt(variance), n };
  });
}

function peerZScores(targetVectorLog, stats) {
  // Sàn tối thiểu cho std (thang log1p) — tránh chia gần-0 phóng đại z ảo khi cả nhóm
  // có giá trị gần như giống hệt nhau (std thật quá nhỏ do quần thể quá đồng nhất).
  const MIN_STD = 0.05;
  return stats.map((s, i) => (targetVectorLog[i] - s.mean) / Math.max(s.std, MIN_STD));
}

// ---------------------------------------------------------------------------
// Isolation Forest ĐƠN GIẢN, tự dựng ngay lúc đánh giá bằng chính quần thể "đàn" hiện
// có (KHÔNG lưu lại, KHÔNG phải model đã huấn luyện trước theo nghĩa ML thông thường).
// Ý tưởng gốc: điểm CÀNG BẤT THƯỜNG thì càng dễ bị "cô lập" (tách khỏi phần còn lại)
// bằng ÍT LẦN CHIA NGẪU NHIÊN hơn → độ sâu trung bình càng NGẮN. Seed cố định (suy ra
// từ kích thước quần thể + tier) để tính lại đúng cùng 1 tập dữ liệu cho kết quả ổn
// định, thay vì nhảy số ngẫu nhiên mỗi lần bấm "Tính toán & đánh giá".
// ---------------------------------------------------------------------------
function peerMulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function peerSampleWithoutReplacement(arr, k, rng) {
  const pool = arr.slice();
  const limit = Math.min(k, pool.length);
  const result = [];
  for (let i = 0; i < limit; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    result.push(pool[i]);
  }
  return result;
}

function peerBuildIsolationTree(data, depth, maxDepth, rng) {
  if (depth >= maxDepth || data.length <= 1) return { size: data.length, depth };
  const nFeatures = data[0].length;
  const feature = Math.floor(rng() * nFeatures);
  let min = Infinity, max = -Infinity;
  for (const row of data) {
    const v = row[feature];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) return { size: data.length, depth };
  const splitValue = min + rng() * (max - min);
  const left = data.filter((row) => row[feature] < splitValue);
  const right = data.filter((row) => row[feature] >= splitValue);
  if (!left.length || !right.length) return { size: data.length, depth };
  return {
    feature,
    splitValue,
    left: peerBuildIsolationTree(left, depth + 1, maxDepth, rng),
    right: peerBuildIsolationTree(right, depth + 1, maxDepth, rng),
  };
}

function peerAvgPathLengthUnsuccessful(n) {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649015329) - (2 * (n - 1)) / n;
}

function peerPathLength(vector, node, depth) {
  if (node.feature === undefined) {
    // Nút lá — cộng thêm ước lượng độ sâu trung bình nếu vẫn còn >1 điểm dồn lại đây
    // (cắt sớm do chạm maxDepth), đúng theo công thức gốc của thuật toán.
    return depth + peerAvgPathLengthUnsuccessful(node.size);
  }
  return vector[node.feature] < node.splitValue
    ? peerPathLength(vector, node.left, depth + 1)
    : peerPathLength(vector, node.right, depth + 1);
}

function peerIsolationForestScore(targetVectorLog, peerVectorsLog, seed) {
  // QUAN TRỌNG: cây phải được dựng từ tập BAO GỒM CẢ điểm đang xét (targetVectorLog),
  // không chỉ riêng "đàn" — đây là cách thuật toán Isolation Forest gốc thực sự tạo ra
  // độ nhạy phát hiện bất thường: khi 1 điểm có giá trị cực đoan so với phần còn lại,
  // chính giá trị cực đoan CỦA NÓ mới kéo giãn khoảng [min,max] dùng để chọn ngẫu nhiên
  // điểm chia ở mỗi nút — nhờ vậy 1 lần chia ngẫu nhiên có xác suất cao rơi vào đúng
  // khoảng trống giữa nó và phần còn lại, cô lập nó chỉ sau rất ít lần chia. Nếu dựng
  // cây CHỈ từ "đàn" (không có điểm đang xét) như bản đầu tiên đã làm, khoảng chia
  // không bao giờ vượt quá giá trị lớn nhất của "đàn" nên KHÔNG có hiệu ứng kéo giãn
  // này — đã kiểm chứng bằng thực nghiệm (điểm bất thường rõ rệt vẫn cho điểm số ngang
  // bằng điểm bình thường), nên đây KHÔNG phải chi tiết cài đặt tuỳ chọn mà là điều
  // kiện bắt buộc để thuật toán hoạt động đúng. Ở quy mô đàn thực tế (vài chục đến vài
  // trăm lần đo), n <= 256 nên "lấy mẫu con" (subsampleSize) gần như luôn bằng CHÍNH
  // TOÀN BỘ tập — không phải bootstrap 1 phần nhỏ như dùng cho dữ liệu lớn.
  const full = peerVectorsLog.concat([targetVectorLog]);
  const n = full.length;
  if (n < 3) return null;
  const NUM_TREES = 100;
  const subsampleSize = Math.min(256, n);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, subsampleSize)));
  const rng = peerMulberry32(seed);

  const trees = [];
  for (let t = 0; t < NUM_TREES; t++) {
    const sample = peerSampleWithoutReplacement(full, subsampleSize, rng);
    trees.push(peerBuildIsolationTree(sample, 0, maxDepth, rng));
  }

  const avgPath = trees.reduce((sum, tree) => sum + peerPathLength(targetVectorLog, tree, 0), 0) / trees.length;
  const c = peerAvgPathLengthUnsuccessful(subsampleSize) || 1;
  return Math.pow(2, -avgPath / c);
}

// ---------------------------------------------------------------------------
// Hàm chính — gọi ở ui/ui-dga.js NGAY SAU khi đã có `all` (Storage.listMeasurements(),
// vốn đã phải gọi sẵn cho bước "tốc độ sinh khí" ở trên) nên KHÔNG tốn thêm 1 lần gọi
// mạng nào. `measurement` là object đang chuẩn bị lưu (đã có equipment_type/dien_ap_dm/
// manufacturer/id), `gases` là object khóa CHỮ HOA (H2, CH4...) đã đọc từ form.
//
// Trả về sufficient=false kèm groupLabel/groupSize khi CHƯA ĐỦ PEER_MIN_SAMPLES lần đo
// cùng nhóm (kể cả sau khi đã nới lỏng hết tiêu chí) — ui-dga.js hiện rõ thông báo này
// thay vì suy diễn thống kê từ quá ít dữ liệu.
// ---------------------------------------------------------------------------
function evaluatePeerAnomaly(measurement, gases, allRecords) {
  if (!Array.isArray(allRecords) || !allRecords.length || !measurement.equipment_type) {
    return { sufficient: false, groupLabel: null, groupSize: 0, minSamples: PEER_MIN_SAMPLES };
  }

  const group = peerBuildGroup(allRecords, measurement);
  if (!group.sufficient) {
    return { sufficient: false, groupLabel: group.label, groupSize: group.peers.length, minSamples: PEER_MIN_SAMPLES };
  }

  const targetVectorRaw = GASES.map((g) => Number(gases[g]) || 0);
  const targetVectorLog = targetVectorRaw.map(peerLog1p);
  const peerVectorsLog = group.peers.map((r) => peerGasVector(r).map(peerLog1p));

  const stats = peerComputeStats(peerVectorsLog);
  const zScores = peerZScores(targetVectorLog, stats);

  const gasRows = GASES.map((g, i) => {
    const absZ = Math.abs(zScores[i]);
    const level = absZ >= PEER_Z_ALERT ? "alert" : absZ >= PEER_Z_WARN ? "warn" : "normal";
    return {
      gas: g,
      value: targetVectorRaw[i],
      peerMean: Math.expm1(stats[i].mean), // đổi lại về đơn vị ppm cho dễ đọc (đã log1p hoá lúc tính)
      z: zScores[i],
      level,
    };
  });
  const flaggedGases = gasRows.filter((r) => r.level !== "normal").map((r) => r.gas);

  const seed = 1000003 * (group.peers.length + 1) + group.tier.length;
  const isolationScore = peerIsolationForestScore(targetVectorLog, peerVectorsLog, seed);
  const isolationLevel =
    isolationScore === null ? null :
    isolationScore >= PEER_IF_ALERT ? "alert" :
    isolationScore >= PEER_IF_WARN ? "warn" : "normal";

  return {
    sufficient: true,
    groupLabel: group.label,
    groupTier: group.tier,
    groupSize: group.peers.length,
    gasRows,
    flaggedGases,
    isolationScore,
    isolationLevel,
  };
}

// ===== logic/dga-logic-case.js =====
// dga-logic-case.js — Đề xuất người dùng #3: "Tìm ca tương tự trong lịch sử đo"
// (case-based reasoning nhẹ, KHÔNG train/lưu model, chạy 100% phía client) — bổ sung
// tiếp sau đề xuất #1 (OCR BBTN), #5 (OCR nameplate) và #2 (so với đàn) đã hoàn tất.
//
// Ý tưởng (theo đúng đề xuất người dùng): khi 1 lần đo có dấu hiệu bất thường, tự tìm
// trong TOÀN BỘ Lịch sử đo — CỦA THIẾT BỊ NÀY HOẶC THIẾT BỊ KHÁC, KHÔNG giới hạn cùng
// loại/cấp điện áp/hãng sản xuất như đề xuất #2 (dga-logic-peer.js) — những lần đo có
// VECTOR 7 KHÍ gần giống nhất (cosine similarity), rồi hiện lại kết luận/chẩn đoán CỦA
// CHÍNH lần đo đó (tính lại tại chỗ ở ui/ui-dga.js bằng ĐÚNG logic đánh giá hiện có,
// theo tiêu chuẩn áp dụng cho CHÍNH thiết bị/hãng của lần đo đó — KHÔNG lưu sẵn 1 "kết
// luận" tĩnh nào, vì kết luận là hàm xác định của số liệu khí + tiêu chuẩn áp dụng, tính
// lại luôn ĐÚNG và không sợ lệch nếu sau này tiêu chuẩn/logic đánh giá được cập nhật).
//
// File này CHỈ làm phần "tìm ca tương tự" (thuần toán học, không phụ thuộc lớp UI nào,
// kiểm thử được qua Node — cùng nguyên tắc tách file như dga-logic-peer.js) — phần
// "tính lại kết luận của ca tìm được" do ui/ui-dga.js đảm nhiệm bằng cách gọi lại
// DGA.resolveStandard/DGA.evaluateAbsolute/DGA.overallVerdict/DGA.diagnoseGasFault
// giống HỆT cách đã làm với "lần đo liền trước" (biến `prior`) — không viết trùng logic.

const CASE_TOP_N = 3; // tối đa hiện bấy nhiêu ca tương tự nhất
const CASE_MIN_SIMILARITY = 0.5; // dưới mức này coi là "không đủ giống" để đáng tham khảo
const CASE_MIN_VECTOR_NORM = 1e-6; // ngưỡng coi vector là "rỗng" (không có số liệu khí)

function caseLog1p(v) {
  return Math.log(1 + Math.max(0, v));
}

function caseGasVector(record) {
  // Đọc cả khóa CHỮ HOA (H2, CH4... — object "gases" đang nhập ở form) lẫn CHỮ THƯỜNG
  // (h2, ch4... — bản ghi đọc từ Storage.listMeasurements(), xem normalizeGasKeys() ở
  // storage.js) — giữ file logic độc lập, không phụ thuộc recordGases() (ui-standards.js).
  return GASES.map((g) => {
    const raw = record[g] ?? record[g.toLowerCase()];
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
}

function caseVectorNorm(v) {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

function caseCosineSimilarity(a, b) {
  const normA = caseVectorNorm(a);
  const normB = caseVectorNorm(b);
  if (normA < CASE_MIN_VECTOR_NORM || normB < CASE_MIN_VECTOR_NORM) return 0;
  const dot = a.reduce((sum, x, i) => sum + x * b[i], 0);
  return dot / (normA * normB);
}

// ---------------------------------------------------------------------------
// Vì sao tính cosine similarity trên thang log1p(ppm) thay vì ppm thô: cosine similarity
// tự nó ĐÃ bất biến với việc nhân 1 vector với hằng số dương (vector [10,1000] và
// [20,2000] cho cosine = 1 dù nhân đôi toàn bộ) — nên KHÔNG cần chuẩn hóa thêm để so
// sánh "cùng hình dạng, khác mức độ nghiêm trọng". Nhưng nếu dùng ppm thô, các khí có
// biên độ tự nhiên LỚN (CO, CO2, thường hàng trăm/nghìn ppm) sẽ áp đảo hoàn toàn tích vô
// hướng so với các khí biên độ NHỎ nhưng lại quan trọng để nhận diện loại lỗi (H2, C2H2,
// C2H4 — thường chỉ vài đến vài chục ppm): 2 lần đo cùng nền CO2 cao nhưng 1 lần MỚI XUẤT
// HIỆN C2H2 (dấu hiệu phóng điện) vẫn sẽ bị tính là "rất giống nhau" nếu so trên ppm thô,
// vì chênh lệch C2H2 quá nhỏ so với CO2 để ảnh hưởng đáng kể tới góc vector. Nén về thang
// log1p trước khi tính cosine giúp các khí biên độ nhỏ có trọng số so sánh tương xứng
// hơn, đúng tinh thần "tìm ca có hình dạng bất thường tương tự" mà đề xuất hướng tới —
// đánh đổi là mức độ nghiêm trọng (không chỉ hình dạng) cũng ảnh hưởng nhẹ tới độ giống
// (log(k·x) ≠ k·log(x)), nhưng đây là điều CÓ LỢI ở đây: ưu tiên ca lịch sử có mức độ
// nghiêm trọng gần tương đương, hữu ích cho tham khảo ra quyết định hơn là 1 ca cùng tỷ
// lệ khí nhưng nghiêm trọng gấp nhiều lần (hoặc nhẹ hơn nhiều lần) so với lần đo hiện tại.
// ---------------------------------------------------------------------------
function findSimilarCases(measurement, gases, allRecords) {
  const targetId = (measurement && measurement.id) || null;
  const targetVectorRaw = GASES.map((g) => Number(gases[g]) || 0);
  const targetVectorLog = targetVectorRaw.map(caseLog1p);

  if (caseVectorNorm(targetVectorLog) < CASE_MIN_VECTOR_NORM) {
    // Lần đo hiện tại chưa có số liệu khí nào (toàn 0) — không có gì để so khớp.
    return { cases: [], insufficient: true, reason: "empty-target" };
  }
  if (!Array.isArray(allRecords) || !allRecords.length) {
    return { cases: [], insufficient: true, reason: "empty-history" };
  }

  const scored = [];
  for (const r of allRecords) {
    if (targetId && r.id === targetId) continue; // không tự so với chính mình khi đang SỬA
    const vec = caseGasVector(r).map(caseLog1p);
    if (caseVectorNorm(vec) < CASE_MIN_VECTOR_NORM) continue; // bỏ bản ghi rỗng khí
    const similarity = caseCosineSimilarity(targetVectorLog, vec);
    scored.push({ record: r, similarity });
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  const cases = scored.filter((c) => c.similarity >= CASE_MIN_SIMILARITY).slice(0, CASE_TOP_N);

  return { cases, insufficient: false };
}

// ===== dga-logic.js =====
// dga-logic.js — File LẮP RÁP (assembler) cho lớp logic nghiệp vụ DGA.
//
// Kể từ đợt tái cấu trúc này, toàn bộ logic đã được tách thành 6 file theo
// miền nghiệp vụ, đặt trong thư mục logic/:
//   - logic/dga-logic-core.js               : hằng số dùng chung + hàm lõi (GASES, EQUIPMENT_TYPES,
//                                              các bảng ngưỡng khí thô QĐ1901/IEC, hằng số dầu/OLTC, REGULATION_CITATIONS...)
//   - logic/dga-logic-gas.js                 : đánh giá khí hòa tan (TCG, tỷ lệ, Duval, tốc độ tăng, khuyến cáo...)
//   - logic/dga-logic-oil.js                 : thí nghiệm dầu MBA + dầu OLTC
//   - logic/dga-logic-instrument-oil.js      : thí nghiệm dầu TI/TU
//   - logic/dga-logic-forecast.js            : dự báo xu hướng khí
//   - logic/dga-logic-regulation-config.js   : cơ chế cấu hình quy định (ghi đè ngưỡng tại chỗ)
//
// dga-logic-core.js là "hub" duy nhất: 5 file còn lại chỉ phụ thuộc vào core,
// không phụ thuộc lẫn nhau (dga-logic-forecast.js không phụ thuộc file nào).
//
// File này (dga-logic.js) được GIỮ NGUYÊN đường dẫn gốc vì index.html vẫn
// tham chiếu <script src="dga-logic.js">. Nhiệm vụ duy nhất của nó là LẮP RÁP:
//   - Trên trình duyệt: 6 file logic/dga-logic-*.js được nạp bằng thẻ <script>
//     THÔNG THƯỜNG (không phải module) ngay TRƯỚC thẻ <script src="dga-logic.js">
//     trong index.html, nên mọi const/function khai báo ở top-level của chúng
//     đã có sẵn trong global scope khi đoạn code dưới đây chạy — file này chỉ
//     cần gom lại thành object DGA và gán window.DGA.
//   - Trên Node (dùng cho các script kiểm thử ad-hoc qua require()): dùng
//     module "vm" built-in để nạp và chạy 6 file trên trong MỘT sandbox context
//     dùng chung (mô phỏng đúng ngữ nghĩa "chia sẻ global scope giữa nhiều thẻ
//     <script>" của trình duyệt), sau đó trích xuất object DGA từ context đó.
//
// Không chỉnh sửa logic nghiệp vụ trong file này — mọi logic đã nằm trong
// 6 file con ở thư mục logic/. File này chỉ lắp ráp + export.

if (typeof module !== "undefined" && module.exports) {
  // ---------------------------------------------------------------------------
  // Nhánh Node: dùng vm để nạp 6 file logic con vào một sandbox context dùng chung
  // ---------------------------------------------------------------------------
  const vm = require("vm");
  const fs = require("fs");
  const path = require("path");

  const LOGIC_DIR = path.join(__dirname, "logic");
  const LOGIC_FILES = [
    "dga-logic-core.js", // phải nạp đầu tiên — là hub mà các file còn lại phụ thuộc vào
    "dga-logic-gas.js",
    "dga-logic-oil.js",
    "dga-logic-instrument-oil.js",
    "dga-logic-forecast.js",
    "dga-logic-regulation-config.js",
    "dga-logic-peer.js",
    "dga-logic-case.js",
  ];

  const sandbox = {
    console,
    Math,
    JSON,
    Date,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    isNaN,
    parseFloat,
    parseInt,
  };
  const context = vm.createContext(sandbox);

  for (const fileName of LOGIC_FILES) {
    const filePath = path.join(LOGIC_DIR, fileName);
    const source = fs.readFileSync(filePath, "utf8");
    vm.runInContext(source, context, { filename: filePath });
  }

  // Trích xuất object DGA từ sandbox — danh sách khóa GIỐNG HỆT nhánh trình duyệt bên dưới.
  const DGA = vm.runInContext(
    `({
      GASES, EQUIPMENT_TYPES, PHA_OPTIONS, PHA_CHUNG_3_PHA, phaLabel, phaLabelWithPrefix, formatSampleDate,
      MBA_SUBTYPES, INSTRUMENT_SUBTYPES,
      QD1901_BANG12_TI, QD1901_BANG64_MBA, QD1901_BANG65_RATE, DEFAULT_PD_THRESHOLD,
      IEC_A2_POWER_TRANSFORMER, IEC_A8_INSTRUMENT_MAX, IEC_A7_INSTRUMENT_TYPICAL, IEC_A11_BUSHING,
      pdThresholdForType, typicalReferenceStandard, resolveCondemningLimits,
      defaultAbsoluteStandard, resolveStandard, computeTCG, evaluateAbsolute, overallVerdict,
      evaluateCondemning, condemningExceededRows,
      countExceedTypical, computeRatios, diagnoseRatios, diagnoseBushingRatios, diagnoseGasFault,
      BUSHING_CODE_LABELS, NO_DIAGNOSIS, ratioApplicability, computeRateOfChange,
      computeTcgRateOfChange,
      normalizeDuval, classifyDuval1, duvalPlotXY, diagnoseDuval1,
      QD1901_BANG63_TDGC, computeTotalDissolvedGasPercent, evaluateBang63, diagnoseAdditionalRatios,
      dieu54AdvisoryMessages, buildRecommendations, computeOverallStatus,
      OIL_VOLTAGE_CLASSES, BANG54_BDV, BANG55_TGD90, bang58WaterLimits, resolveOilLimits, evaluateOilTest,
      evaluateInstrumentOilTest,
      OLTC_SAMPLE_POINTS, BANG49_OLTC, evaluateOltcOilTest, OIL_SAMPLE_POINTS,
      linearRegression, theilSenSlope, consecutiveAverageSlope, FORECAST_METHOD_LABELS, forecastGasTrend,
      REGULATION_CITATIONS, BANG58_WATER, getRegulationConfigRegistry, applyRegulationConfigOverride,
      resetRegulationConfigItem, regulationConfigDefaultCitation, getRegulationConfigCurrentValues,
      getValueAtPath, setValueAtPath,
      PEER_MIN_SAMPLES, PEER_Z_WARN, PEER_Z_ALERT, PEER_IF_WARN, PEER_IF_ALERT, evaluatePeerAnomaly,
      CASE_TOP_N, CASE_MIN_SIMILARITY, findSimilarCases,
    })`,
    context
  );

  module.exports = DGA;
} else if (typeof window !== "undefined") {
  // ---------------------------------------------------------------------------
  // Nhánh trình duyệt: 6 file logic/dga-logic-*.js đã được nạp bằng <script> thường
  // NGAY TRƯỚC file này (xem index.html), nên mọi tên bên dưới đã có sẵn trong
  // global scope của trang — chỉ cần gom lại thành object DGA.
  // ---------------------------------------------------------------------------
  const DGA = {
    GASES, EQUIPMENT_TYPES, PHA_OPTIONS, PHA_CHUNG_3_PHA, phaLabel, phaLabelWithPrefix, formatSampleDate,
    MBA_SUBTYPES, INSTRUMENT_SUBTYPES,
    QD1901_BANG12_TI, QD1901_BANG64_MBA, QD1901_BANG65_RATE, DEFAULT_PD_THRESHOLD,
    IEC_A2_POWER_TRANSFORMER, IEC_A8_INSTRUMENT_MAX, IEC_A7_INSTRUMENT_TYPICAL, IEC_A11_BUSHING,
    pdThresholdForType, typicalReferenceStandard, resolveCondemningLimits,
    defaultAbsoluteStandard, resolveStandard, computeTCG, evaluateAbsolute, overallVerdict,
    evaluateCondemning, condemningExceededRows,
    countExceedTypical, computeRatios, diagnoseRatios, diagnoseBushingRatios, diagnoseGasFault,
    BUSHING_CODE_LABELS, NO_DIAGNOSIS, ratioApplicability, computeRateOfChange,
    computeTcgRateOfChange,
    normalizeDuval, classifyDuval1, duvalPlotXY, diagnoseDuval1,
    QD1901_BANG63_TDGC, computeTotalDissolvedGasPercent, evaluateBang63, diagnoseAdditionalRatios,
    dieu54AdvisoryMessages, buildRecommendations, computeOverallStatus,
    OIL_VOLTAGE_CLASSES, BANG54_BDV, BANG55_TGD90, bang58WaterLimits, resolveOilLimits, evaluateOilTest,
    evaluateInstrumentOilTest,
    OLTC_SAMPLE_POINTS, BANG49_OLTC, evaluateOltcOilTest, OIL_SAMPLE_POINTS,
    linearRegression, theilSenSlope, consecutiveAverageSlope, FORECAST_METHOD_LABELS, forecastGasTrend,
    REGULATION_CITATIONS, BANG58_WATER, getRegulationConfigRegistry, applyRegulationConfigOverride,
    resetRegulationConfigItem, regulationConfigDefaultCitation, getRegulationConfigCurrentValues,
    getValueAtPath, setValueAtPath,
    PEER_MIN_SAMPLES, PEER_Z_WARN, PEER_Z_ALERT, PEER_IF_WARN, PEER_IF_ALERT, evaluatePeerAnomaly,
    CASE_TOP_N, CASE_MIN_SIMILARITY, findSimilarCases,
  };

  window.DGA = DGA;
}
