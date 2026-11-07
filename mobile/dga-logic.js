/* mobile/dga-logic.js — FILE ĐƯỢC SINH TỰ ĐỘNG bởi scripts/sync-mobile.js. KHÔNG SỬA TAY.
 *
 * Nội dung = ghép các file logic dùng chung của bản web theo đúng thứ tự nạp trong index.html:
 * src/domain/dga-logic-core.js, src/domain/dga-logic-gas.js, src/domain/dga-logic-oil.js, src/domain/dga-logic-instrument-oil.js, src/domain/dga-logic-iec60422-2024.js, src/domain/dga-logic-oil-extended.js, src/domain/dga-logic-forecast.js, src/domain/dga-logic-regulation-config.js, src/domain/dga-logic-peer.js, src/domain/dga-logic-case.js, src/domain/dga-logic.js
 * Muốn đổi logic đánh giá: sửa ở src/domain/*.js (bản web) rồi chạy `npm run sync-mobile`.
 * (Nhánh Node ở cuối file — dùng "vm" — chỉ chạy khi có module.exports; trình duyệt bỏ qua.) */

// ===== src/domain/dga-logic-core.js =====
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
 *  (rowToObject(), backend/gsheet/Code.gs — format lại đúng "yyyy-MM-dd" theo múi giờ spreadsheet
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
// Bảng 64 — CẬN DƯỚI của cùng khoảng điển hình (H2 50–150, CO 400–600, CO2 3.800–14.000, CH4 30–130,
// C2H6 20–90, C2H4 60–280, C2H2 2–20). Dùng cho nhánh lưu đồ Điều 54 "hàm lượng khí THẤP HƠN khoảng
// điển hình -> kiểm tra lỗi lấy mẫu, đo lường hoặc do xử lý dầu gần đây" (xem gasesBelowTypicalLow()).
const QD1901_BANG64_MBA_LOW = { H2: 50, CH4: 30, C2H6: 20, C2H4: 60, C2H2: 2, CO: 400, CO2: 3800 };

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
  BANG64_MBA_LOW: "QĐ1901 Bảng 64, Điều 54 (cận dưới khoảng điển hình)",
  BANG66_TABLE1: "QĐ1901 Bảng 66, Điều 54 = IEC 60599:2022 Table 1 (mục 5.4)",
  BANG66_PDT: "QĐ1901 Điều 54 — bảng đơn giản PD/D/T dưới Bảng 66 (= IEC 60599:2022 Table 2)",
  IEC_A10_BUSHING: "IEC 60599:2022 Annex A.5.3 Table A.10 (sứ xuyên)",
  BANG67_DUVAL: "QĐ1901 Bảng 67, Điều 54 = IEC 60599:2022 Annex B, Figure B.3",
  DIEU54_OLTC: "QĐ1901 Điều 54 mục 3 — kiểm tra nhiễm khí từ OLTC",
  DIEU54_ADDITIONAL: "QĐ1901 Điều 54 — Đánh giá các tỷ lệ bổ sung (= IEC 60599:2022 mục 5.5, 5.6)",
  TERMS_DOCS: "Tên văn bản quy định / tiêu chuẩn đang áp dụng",
  TERMS_QD_ARTICLES: "Số hiệu điều khoản, bảng của quy định (QĐ1901/QĐ-EVNNPT)",
  TERMS_IEC: "Số hiệu bảng, phụ lục, hình của tiêu chuẩn IEC",
};


// Bảng 63, Điều 54 (chuyển ra đây từ mục 7bis vì dga-logic-regulation-config.js
// cũng cần tham chiếu TRỰC TIẾP object này để hỗ trợ sửa qua giao diện).
// Bảng 63, Điều 54 — ngưỡng tổng hàm lượng khí hòa tan (%) trong dầu MBA. CHỈ áp dụng
// chính thức cho dầu MỚI đưa vào vận hành lần đầu, sau sửa chữa có thay dầu, hoặc sau
// sửa chữa không thay dầu có lọc dầu — QĐ1901 KHÔNG nêu ngưỡng nào cho dầu đang vận
// hành định kỳ thông thường (xem evaluateBang63()).
const QD1901_BANG63_TDGC = { "110-220": 1.0, "500": 0.5 };

// ---------------------------------------------------------------------------
// Ngưỡng TỶ SỐ KHÍ / RANH GIỚI VÙNG dùng trong logic chẩn đoán — tách thành tham số (object
// literal, sửa được property) để Admin cấu hình qua tab "Cấu hình" > "Quy định" khi QĐ1901 /
// IEC 60599 thay đổi (xem dga-logic-regulation-config.js). Giá trị mặc định = đúng văn bản gốc.
// Chỉ CON SỐ là cấu hình được; dấu so sánh (<, ≤, >, ≥) và cấu trúc rẽ nhánh giữ đúng văn bản.
// ---------------------------------------------------------------------------

// Bảng 66 = Table 1 IEC 60599 (mục 5.4). Ngưỡng CH4/H2 của PD lấy theo loại thiết bị ở
// PD_THRESHOLD_BY_TYPE (cấu hình riêng); ở đây là các ngưỡng còn lại. Quy ước so sánh:
//   PD: C2H4/C2H6 < i_max
//   D1: C2H2/C2H4 > g_min; h_min ≤ CH4/H2 ≤ h_max; C2H4/C2H6 > i_min
//   D2: g_min ≤ C2H2/C2H4 ≤ g_max; h_min ≤ CH4/H2 ≤ h_max; C2H4/C2H6 > i_min
//   T1: CH4/H2 > h_min; C2H4/C2H6 < i_max
//   T2: C2H2/C2H4 < g_max; CH4/H2 > h_min; i_min ≤ C2H4/C2H6 ≤ i_max
//   T3: C2H2/C2H4 < g_max; CH4/H2 > h_min; C2H4/C2H6 > i_min
const QD1901_BANG66_TABLE1 = {
  PD: { i_max: 0.2 },
  D1: { g_min: 1, h_min: 0.1, h_max: 0.5, i_min: 1 },
  D2: { g_min: 0.6, g_max: 2.5, h_min: 0.1, h_max: 1, i_min: 2 },
  T1: { h_min: 1, i_max: 1 },
  T2: { g_max: 0.1, h_min: 1, i_min: 1, i_max: 4 },
  T3: { g_max: 0.2, h_min: 1, i_min: 4 },
};

// Bảng đơn giản PD / D / T (dưới Bảng 66): PD: CH4/H2 < pd_h_max; D: C2H2/C2H4 > dt_g; T: C2H2/C2H4 < dt_g
const QD1901_BANG66_PDT = { pd_h_max: 0.2, dt_g: 0.2 };

// Table A.10 sứ xuyên: PD: CH4/H2 < pd_h_max; D: C2H2/C2H4 > d_g_min; T: C2H4/C2H6 > t_i_min;
// TP: CO2/CO < tp_low hoặc > tp_high
const IEC_A10_BUSHING_RATIOS = { pd_h_max: 0.07, d_g_min: 1, t_i_min: 1, tp_low: 1, tp_high: 20 };

// Bảng 67 — giới hạn các vùng Tam giác Duval 1 (%):
//   PD: %CH4 ≥ pd_ch4
//   T1: %C2H2 ≤ t_c2h2 và %C2H4 ≤ t1_c2h4;  T2: %C2H2 ≤ t_c2h2 và t1_c2h4 < %C2H4 ≤ t2_c2h4
//   D1: %C2H2 ≥ d_c2h2 và %C2H4 ≤ d1_c2h4
//   D2: %C2H2 ≥ d_c2h2 và %C2H4 > d1_c2h4, trừ phần (%C2H4 > d2_c2h4 và %C2H2 < d2_c2h2)
//   T3: %C2H4 > t2_c2h4 và %C2H2 ≤ t3_c2h2;  còn lại: D+T
const QD1901_BANG67_DUVAL = { pd_ch4: 98, t_c2h2: 4, t1_c2h4: 20, t2_c2h4: 50, d_c2h2: 13, d1_c2h4: 23, d2_c2h4: 40, d2_c2h2: 29, t3_c2h2: 15 };

// Điều 54 — nghi nhiễm khí từ OLTC khi C2H2/H2 > possible (có thể) / > likely (nghi ngờ rõ) — văn bản: "> 2 - 3"
const DIEU54_OLTC_C2H2_H2 = { possible: 2, likely: 3 };

// Điều 54 — Đánh giá các tỷ lệ bổ sung
//   CO2/CO < co2co_low và CO > co_min -> giấy cách điện carbon hóa
//   CO2/CO > co2co_high và CO2 > co2_min -> quá nhiệt nhẹ / oxy hóa dầu
//   O2/N2 < o2n2_low -> tiêu thụ oxy quá mức; o2n2_normal: mốc tham khảo "bình thường" (~)
const DIEU54_ADDITIONAL_RATIOS = { co2co_low: 3, co_min: 1000, co2co_high: 10, co2_min: 10000, o2n2_low: 0.3, o2n2_normal: 0.5 };

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

// Bậc "> 35 kV và < 110 kV" (cấp 66 kV cũ) ĐÃ BỎ khỏi lưới điện nên không còn trong danh sách chọn — các
// bảng ngưỡng bên dưới vẫn GIỮ khóa "tren35duoi110" để bản ghi cũ (nếu có) vẫn hiển thị/đánh giá được.
const OIL_VOLTAGE_CLASSES = [
  { value: "duoi15", label: "< 15 kV" },
  { value: "15den35", label: "15 – 35 kV" },
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

/** Nhãn cấp điện áp dầu, kể cả bậc đã bỏ (bản ghi cũ). */
const OIL_VOLTAGE_CLASS_LEGACY_LABELS = { tren35duoi110: "> 35 kV và < 110 kV (cấp 66 kV cũ, đã bỏ)" };
function oilVoltageClassName(vc) {
  const found = OIL_VOLTAGE_CLASSES.find((c) => c.value === vc);
  return found ? found.label : OIL_VOLTAGE_CLASS_LEGACY_LABELS[vc] || vc || "—";
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

// ===== src/domain/dga-logic-gas.js =====
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
function evaluateAbsolute(gases, limits, kphGases) {
  const isKph = (g) => Boolean(kphGases && (kphGases[g] || (Array.isArray(kphGases) && kphGases.includes(g))));
  return GASES.map((gas) => {
    const value = num(gases[gas]);
    const limit = limits[gas];
    const hasLimit = limit !== undefined && limit !== null && limit !== "";
    const gasIsKph = isKph(gas);
    const verdict = !hasLimit ? "Không có ngưỡng" : (gasIsKph || value <= limit) ? "Đạt" : "Không đạt";
    return { gas, value, limit: hasLimit ? limit : null, verdict, isKph: gasIsKph };
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
  const T = QD1901_BANG66_TABLE1; // ngưỡng cấu hình được (dga-logic-core.js)
  const isD1 = g > T.D1.g_min && h >= T.D1.h_min && h <= T.D1.h_max && i > T.D1.i_min;
  const isD2 = g >= T.D2.g_min && g <= T.D2.g_max && h >= T.D2.h_min && h <= T.D2.h_max && i > T.D2.i_min;
  if (h < pd && i < T.PD.i_max) return "PD - Phóng điện cục bộ";
  // Vùng chồng lấn = khớp ĐỒNG THỜI cả D1 VÀ D2.
  if (isD1 && isD2) return "D1/D2 - Phóng điện (vùng chồng lấn)";
  if (isD1) return "D1 - Phóng điện năng lượng thấp";
  if (isD2) return "D2 - Phóng điện năng lượng cao";
  if (h > T.T1.h_min && i < T.T1.i_max) return "T1 - Tăng nhiệt, t<300°C";
  if (g < T.T2.g_max && h > T.T2.h_min && i >= T.T2.i_min && i <= T.T2.i_max) return "T2 - Tăng nhiệt, 300-700°C";
  if (g < T.T3.g_max && h > T.T3.h_min && i > T.T3.i_min) return "T3 - Tăng nhiệt, t>700°C";
  return NO_DIAGNOSIS;
}

/**
 * Bảng đơn giản hóa PD / D / T của Điều 54 QĐ1901 (ngay dưới Bảng 66 = Table 2 IEC 60599):
 * "nếu tỷ lệ không nằm trong giới hạn của bảng trên, sử dụng bảng dưới để xác định lỗi khiếm
 * khuyết SƠ BỘ giữa phóng điện cục bộ (PD), phóng điện (D) và lỗi tăng nhiệt (T)":
 *   PD — CH4/H2 < 0,2      D — C2H2/C2H4 > 0,2      T — C2H2/C2H4 < 0,2
 * Chỉ dùng khi diagnoseRatios() trả NO_DIAGNOSIS. Kết quả là chẩn đoán SƠ BỘ — KHÔNG thay
 * NO_DIAGNOSIS trong luồng "đổi loại sự cố" (computeOverallStatus) để tránh Báo động giả.
 * @returns {{codes: string[], text: string, label: string}|null} null nếu không tính được tỷ số
 */
function diagnoseSimplifiedPDT(ratios) {
  if (!ratios) return null;
  const g = ratios.c2h2_c2h4, h = ratios.ch4_h2;
  const P = QD1901_BANG66_PDT;
  const codes = [];
  if (Number.isFinite(h) && h < P.pd_h_max) codes.push("PD");
  if (Number.isFinite(g) && g > P.dt_g) codes.push("D");
  else if (Number.isFinite(g) && g < P.dt_g) codes.push("T");
  if (codes.length === 0) return null;
  const names = { PD: "PD — phóng điện cục bộ", D: "D — phóng điện", T: "T — lỗi tăng nhiệt" };
  const text = codes.map((c) => names[c]).join(" + ");
  return { codes, text, label: `Sơ bộ (bảng PD/D/T, Điều 54): ${text}` };
}

/**
 * Bước "kiểm tra nhiễm khí từ OLTC" của lưu đồ Điều 54 (sau khi khí vượt điển hình và tốc độ
 * tăng cao): "Tính tỷ lệ C2H2/H2, nếu C2H2/H2 > 2 - 3, nghi ngờ nhiễm khí từ OLTC". Văn bản cho
 * ngưỡng là KHOẢNG 2–3 nên chia 2 mức: > 3 nghi ngờ rõ, 2–3 có thể.
 * @returns {{ratio:number|null, level:"none"|"possible"|"likely"}}
 */
function oltcContaminationCheck(gases) {
  const h2 = num(gases.H2), c2h2 = num(gases.C2H2);
  if (h2 <= 0) return { ratio: null, level: "none" };
  const ratio = c2h2 / h2;
  const O = DIEU54_OLTC_C2H2_H2;
  return { ratio: Math.round(ratio * 100) / 100, level: ratio > O.likely ? "likely" : ratio > O.possible ? "possible" : "none" };
}

/**
 * Nhánh "hàm lượng khí THẤP HƠN khoảng giá trị điển hình" của lưu đồ Điều 54 (Bảng 64, MBA) ->
 * "kiểm tra lỗi lấy mẫu, đo lường hoặc do xử lý dầu gần đây, tiếp tục theo dõi định kỳ".
 * Chỉ coi là "thấp hơn khoảng điển hình" khi TẤT CẢ 7 khí đều dưới cận dưới Bảng 64 — từng khí
 * riêng lẻ thấp (VD C2H2 = 0) là bình thường ở MBA khỏe nên không nhắc.
 * @returns {boolean}
 */
function gasesBelowTypicalLow(gases, equipmentType) {
  if (equipmentType !== EQUIPMENT_TYPES.MBA) return false;
  return GASES.every((g) => num(gases[g]) < QD1901_BANG64_MBA_LOW[g]);
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
  const A = IEC_A10_BUSHING_RATIOS;
  const codes = [];
  if (ratios.ch4_h2 < A.pd_h_max) codes.push("PD");
  if (ratios.c2h2_c2h4 > A.d_g_min) codes.push("D");
  if (ratios.c2h4_c2h6 > A.t_i_min) codes.push("T");
  if (ratios.co2_co !== null && (ratios.co2_co < A.tp_low || ratios.co2_co > A.tp_high)) codes.push("TP");
  return codes;
}

/** Số thập phân kiểu Việt Nam (0.07 -> "0,07") cho câu hiển thị có ngưỡng cấu hình được. */
function vnNum(v) {
  return String(v).replace(".", ",");
}

// Nhãn mã Table A.10 — getter để luôn hiện ĐÚNG ngưỡng đang cấu hình (IEC_A10_BUSHING_RATIOS).
const BUSHING_CODE_LABELS = {
  get PD() { return `PD (phóng điện cục bộ — CH4/H2 < ${vnNum(IEC_A10_BUSHING_RATIOS.pd_h_max)})`; },
  get D() { return `D (phóng điện — C2H2/C2H4 > ${vnNum(IEC_A10_BUSHING_RATIOS.d_g_min)})`; },
  get T() { return `T (tăng nhiệt — C2H4/C2H6 > ${vnNum(IEC_A10_BUSHING_RATIOS.t_i_min)})`; },
  get TP() { return "TP (nghi liên quan cách điện giấy — CO2/CO bất thường)"; },
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
function diagnoseGasFault(gases, equipmentType, pdThreshold, kphGases) {
  const isKph = (g) => Boolean(kphGases && (kphGases[g] || (Array.isArray(kphGases) && kphGases.includes(g))));
  // Nếu có truyền kphGases và có khí liên quan KPH trong khi không khí nào vượt giá trị điển hình:
  // theo Điều 54 QĐ1901 & IEC 60599 mục 6.1(c), tỷ số khí không có hiệu lực chẩn đoán sự cố.
  if (kphGases && (isKph("C2H2") || isKph("C2H4") || isKph("CH4") || isKph("H2") || isKph("C2H6"))) {
    const exceedCount = countExceedTypical(gases, equipmentType);
    if (exceedCount === 0) {
      return "Không áp dụng (các khí đều trong khoảng điển hình / dưới ngưỡng phát hiện — Điều 54 QĐ1901 & IEC 60599)";
    }
  }
  // Mẫu không có khí nào (5 khí dùng cho tỷ số đều = 0): mọi tỷ số đều 0/0 — không được
  // suy ra mã sự cố (computeRatios() quy ước x/0 = 999 nên sẽ ra nhầm "T3").
  if (["H2", "CH4", "C2H6", "C2H4", "C2H2"].every((g) => num(gases[g]) === 0)) return NO_DIAGNOSIS;
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
//      D2: %C2H4 > 23 và %C2H2 ≥ 13, TRỪ phần (%C2H4 > 40 và %C2H2 < 29) — 4 đường biên đúng như
//          Bảng 67 Điều 54 (23% C2H4, 13% C2H2, 40% C2H4, 29% C2H2); D2 kéo xuống tận cạnh đáy
//          (%CH4 = 0) như Biểu đồ 3. (Bản cũ chỉ lấy ô 13–29% C2H2 × 23–40% C2H4 nên xếp nhầm toàn
//          bộ vùng %C2H2 > 29, %C2H4 > 23 vào "D+T" — sửa 11/2026 khi rà soát theo Điều 54.)
//      T1: %C2H2 ≤ 4  và %C2H4 ≤ 20
//      T2: %C2H2 ≤ 4  và 20 < %C2H4 ≤ 50
//      T3: (%C2H2 ≤ 4 và %C2H4 > 50) — dải hẹp sát cạnh %C2H2=0 —
//          hoặc (%C2H2 ≤ 15 và %C2H4 > 50) — vùng mở rộng của T3 theo đúng dòng T3
//          trong bảng "Limits of zones" (15 % C2H2, 50 % C2H4)
//    Phần diện tích còn lại (4 < %C2H2 < 13 với %C2H4 ≤ 50; hoặc 13 ≤ %C2H2 < 29 với %C2H4 > 40,
//    ngoài T3) là vùng ranh giới "D+T" mà chính hình vẽ gốc IEC 60599:2022
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
  const L = QD1901_BANG67_DUVAL; // ranh giới vùng cấu hình được (dga-logic-core.js)

  if (m >= L.pd_ch4) return { zone: "PD", label: "PD - Phóng điện cục bộ (Tam giác Duval)" };

  if (a <= L.t_c2h2) {
    if (e <= L.t1_c2h4) return { zone: "T1", label: "T1 - Tăng nhiệt, t<300°C (Tam giác Duval)" };
    if (e <= L.t2_c2h4) return { zone: "T2", label: "T2 - Tăng nhiệt, 300-700°C (Tam giác Duval)" };
    return { zone: "T3", label: "T3 - Tăng nhiệt, t>700°C (Tam giác Duval)" };
  }

  if (a >= L.d_c2h2 && e > L.d1_c2h4 && (e <= L.d2_c2h4 || a >= L.d2_c2h2)) {
    return { zone: "D2", label: "D2 - Phóng điện năng lượng cao (Tam giác Duval)" };
  }
  if (a >= L.d_c2h2 && e <= L.d1_c2h4) {
    return { zone: "D1", label: "D1 - Phóng điện năng lượng thấp (Tam giác Duval)" };
  }

  if (a <= L.t3_c2h2 && e > L.t2_c2h4) {
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
function diagnoseDuval1(gases, kphGases) {
  const isKph = (g) => Boolean(kphGases && (kphGases[g] || (Array.isArray(kphGases) && kphGases.includes(g))));
  if (kphGases && isKph("C2H2") && isKph("C2H4")) {
    return null;
  }
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
function computeRateOfChange(prevGases, currGases, deltaDays, rateRanges, equipmentType, kphGases) {
  if (!deltaDays || deltaDays <= 0) return null;
  const official = equipmentType === EQUIPMENT_TYPES.MBA;
  const isKph = (g) => Boolean(kphGases && (kphGases[g] || (Array.isArray(kphGases) && kphGases.includes(g))));
  return GASES.map((gas) => {
    const before = num(prevGases[gas]);
    const after = num(currGases[gas]);
    const delta = after - before;
    const gasIsKph = isKph(gas);
    const ratePerYear = gasIsKph ? 0 : (delta / deltaDays) * 365;
    const ratePerMonth = gasIsKph || before === 0 ? null : (delta / before) / (deltaDays / 30) * 100;
    const [lo, hi] = (rateRanges && rateRanges[gas]) || QD1901_BANG65_RATE[gas];
    let verdict;
    if (gasIsKph) verdict = "Dưới ngưỡng phát hiện (KPH) — bình thường";
    else if (delta < 0) verdict = "Giảm — có thể do lọc/xử lý/thay dầu, hoặc khiếm khuyết cũ ngừng phát triển";
    else if (ratePerYear > hi) verdict = `⚠ Vượt cận trên ${REGULATION_CITATIONS.BANG65_RATE} — nghi khiếm khuyết đang phát triển`;
    // Điều 54: "Nếu độ tăng hàm lượng khí thấp hơn khoảng giá trị tốc độ tăng hàm lượng khí điển hình,
    // kiểm tra lỗi đo lường hoặc do xử lý dầu gần đây, tiếp tục theo dõi định kỳ".
    else if (ratePerYear < lo) verdict = `Dưới cận dưới ${REGULATION_CITATIONS.BANG65_RATE} — kiểm tra lỗi đo lường hoặc do xử lý dầu gần đây; tiếp tục theo dõi định kỳ`;
    else verdict = `Trong khoảng điển hình ${REGULATION_CITATIONS.BANG65_RATE}`;
    return {
      gas, before, after, delta,
      ratePerYear: round1(ratePerYear),
      ratePerMonth: ratePerMonth === null ? null : round1(ratePerMonth),
      rangeLo: lo, rangeHi: hi, verdict,
      officialForEquipment: official,
      isKph: gasIsKph,
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
  const R = DIEU54_ADDITIONAL_RATIOS; // ngưỡng cấu hình được (dga-logic-core.js)
  const vn = (v) => Number(v).toLocaleString("vi-VN");
  let co2coNote;
  let co2coCase = null; // "carbonization" (CO2/CO thấp + CO cao) | "overheat" (CO2/CO cao + CO2 cao) | null
  if (co2_co === null) {
    co2coNote = "Không đủ dữ liệu để tính (CO và CO2 đều bằng 0).";
  } else if (co2_co < R.co2co_low && co > R.co_min) {
    co2coCase = "carbonization";
    co2coNote = `CO2/CO < ${vn(R.co2co_low)} và CO > ${vnNum(R.co_min)} ppm — có khả năng liên quan đến giấy cách điện bị carbon hóa, cần xác nhận bằng phân tích furanic hoặc đo độ trùng hợp giấy.`;
  } else if (co2_co > R.co2co_high && co2 > R.co2_min) {
    co2coCase = "overheat";
    co2coNote = `CO2/CO > ${vn(R.co2co_high)} và CO2 > ${vn(R.co2_min)} ppm — có thể do quá nhiệt nhẹ (<160°C) hoặc oxy hóa dầu, đặc biệt ở máy biến áp hở.`;
  } else {
    co2coNote = `Không rơi vào 2 điều kiện cảnh báo bổ sung của Điều 54 (CO2/CO<${vn(R.co2co_low)} và CO>${vnNum(R.co_min)} ppm; hoặc CO2/CO>${vn(R.co2co_high)} và CO2>${vn(R.co2_min)} ppm).`;
  }

  const hasN2O2 = n2 !== null && n2 !== undefined && o2 !== null && o2 !== undefined && num(n2) > 0;
  let o2_n2 = null;
  let o2n2Note = "Chưa nhập đủ N2/O2 — bỏ qua tỷ lệ O2/N2.";
  if (hasN2O2) {
    o2_n2 = num(o2) / num(n2);
    if (o2_n2 < R.o2n2_low) {
      o2n2Note = `O2/N2 < ${vn(R.o2n2_low)} — tiêu thụ oxy quá mức do oxy hóa dầu hoặc lão hóa giấy cách điện.`;
    } else {
      o2n2Note = `QĐ1901 chỉ nêu mốc tham khảo O2/N2 ~ ${vn(R.o2n2_normal)} là bình thường ở thiết bị có tiếp xúc với không khí; văn bản không có thang đầy đủ để phân loại chính xác các giá trị khác — cần đối chiếu thêm kết cấu bình dầu phụ (có màng ngăn hay không) và thực tế vận hành trước khi kết luận.`;
    }
  }

  return {
    co2_co: co2_co === null ? null : round1(co2_co),
    co2coNote,
    co2coCase,
    // O2/N2 hiển thị: CẮT (không làm tròn) ở 3 chữ số — làm tròn có thể đẩy 0,2998 thành "0,3" trong khi
    // số thực vẫn < 0,3 (có cảnh báo), gây mâu thuẫn. Cắt bớt thì số < 0,3 luôn hiện ra < 0,3.
    o2_n2: o2_n2 === null ? null : Math.floor(o2_n2 * 1000 + 1e-9) / 1000, // +1e-9: bù sai số dấu phẩy động (4,35*1000 = 4349,999…)
    // Giá trị CHƯA làm tròn — dùng để so ngưỡng (dieu54AdditionalFlags), tránh bỏ sót VD O2/N2 = 0,27
    o2_n2_raw: o2_n2,
    co2_co_raw: co2_co,
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
/** Cờ cảnh báo tỷ lệ bổ sung Điều 54: { co2co, o2n2 } — true khi rơi vào điều kiện cảnh báo. */
function dieu54AdditionalFlags(additionalRatios) {
  const a = additionalRatios;
  return {
    co2co: !!(a && a.co2_co !== null && a.co2coNote && a.co2coNote.startsWith("CO2/CO")),
    // So bằng SỐ THỰC chưa làm tròn (o2_n2_raw) với ngưỡng — o2_n2 chỉ làm tròn để HIỂN THỊ
    o2n2: !!(a && Number.isFinite(a.o2_n2_raw) && a.o2_n2_raw < DIEU54_ADDITIONAL_RATIOS.o2n2_low),
  };
}

/** Điều 54 chỉ quy định cho MBA/Kháng dầu ("Phân tích khí hòa tan trong dầu MBA") — TI/TU, sứ xuyên,
 *  loại khác KHÔNG áp tỷ lệ bổ sung/Bảng 63. equipmentType không truyền -> coi như áp dụng (tương thích cũ). */
function dieu54Applies(equipmentType) {
  return equipmentType === undefined || equipmentType === null || equipmentType === "" || equipmentType === EQUIPMENT_TYPES.MBA;
}

function dieu54AdvisoryMessages({ additionalRatios, bang63, equipmentType }) {
  const msgs = [];
  if (!dieu54Applies(equipmentType)) return msgs;
  const flags = dieu54AdditionalFlags(additionalRatios);
  if (flags.co2co) msgs.push(`Tỷ lệ bổ sung CO2/CO (Điều 54): ${additionalRatios.co2coNote}`);
  if (flags.o2n2) msgs.push(`Tỷ lệ bổ sung O2/N2 (Điều 54): ${additionalRatios.o2n2Note}`);
  if (bang63 && bang63.verdict === "Không đạt") {
    msgs.push(
      `⚠ Tổng hàm lượng khí hòa tan vượt ngưỡng ${REGULATION_CITATIONS.BANG63_TDGC} (cấp điện áp áp dụng: <${bang63.limit}%) — áp dụng cho dầu mới/sau ` +
      `sửa chữa có thay dầu hoặc lọc dầu; khuyến cáo kiểm tra lại quy trình xử lý dầu (chân không hóa/lọc khí) trước khi ` +
      `đưa thiết bị vào vận hành chính thức.`
    );
  }
  return msgs;
}

/** Hành động khuyến cáo RIÊNG cho từng điều kiện Điều 54 (cột "Khuyến cáo" tab "Cảnh báo"):
 *  CO2/CO thấp + CO cao (carbon hóa giấy), CO2/CO cao + CO2 cao (quá nhiệt nhẹ/oxy hóa dầu),
 *  O2/N2 thấp (tiêu thụ oxy), Bảng 63. Ngưỡng lấy từ DIEU54_ADDITIONAL_RATIOS (cấu hình được).
 *  Trả về mảng chuỗi — rỗng nếu không rơi vào điều kiện nào / thiết bị không phải MBA/Kháng. */
function dieu54ActionMessages({ additionalRatios, bang63, equipmentType }) {
  const acts = [];
  if (!dieu54Applies(equipmentType)) return acts;
  const a = additionalRatios;
  const R = DIEU54_ADDITIONAL_RATIOS;
  const vn = (v) => Number(v).toLocaleString("vi-VN");
  const flags = dieu54AdditionalFlags(a);
  if (flags.co2co && a.co2coCase === "carbonization") {
    acts.push(
      `CO2/CO = ${vn(a.co2_co)} < ${vn(R.co2co_low)} và CO > ${vnNum(R.co_min)} ppm (nghi giấy cách điện bị carbon hóa): ` +
      `lấy mẫu dầu phân tích hợp chất furan (2-FAL) và/hoặc đo độ trùng hợp giấy (DP) để xác nhận; rút ngắn chu kỳ ` +
      `lấy mẫu DGA, theo dõi tốc độ tăng CO, CO2; đối chiếu chẩn đoán Bảng 66/Tam giác Duval (sự cố nhiệt/phóng điện có liên quan giấy).`
    );
  } else if (flags.co2co && a.co2coCase === "overheat") {
    acts.push(
      `CO2/CO = ${vn(a.co2_co)} > ${vn(R.co2co_high)} và CO2 > ${vn(R.co2_min)} ppm (nghi quá nhiệt nhẹ <160°C hoặc oxy hóa dầu): ` +
      `kiểm tra chế độ mang tải, nhiệt độ dầu/cuộn dây và hệ thống làm mát (quạt, bơm, bộ tản nhiệt); với MBA hở (bình dầu ` +
      `phụ không màng ngăn) kiểm tra bình hút ẩm/silicagel; thí nghiệm chỉ số axit, sức căng bề mặt, tgδ dầu để đánh giá mức oxy hóa; theo dõi xu hướng CO2.`
    );
  }
  if (flags.o2n2) {
    acts.push(
      `O2/N2 = ${vn(a.o2_n2)} < ${vn(R.o2n2_low)} (tiêu thụ oxy quá mức do oxy hóa dầu hoặc lão hóa giấy): ` +
      `thí nghiệm chất lượng dầu (chỉ số axit, sức căng bề mặt, tgδ, cặn bùn) và phân tích furan để đánh giá lão hóa giấy; ` +
      `đối chiếu kết cấu bình dầu phụ (MBA kín/có màng ngăn thường có O2 thấp) và xu hướng O2, N2 các lần đo trước khi kết luận.`
    );
  }
  if (bang63 && bang63.verdict === "Không đạt") {
    acts.push(
      `Tổng hàm lượng khí hòa tan vượt ${REGULATION_CITATIONS.BANG63_TDGC} (<${bang63.limit}%): kiểm tra lại quy trình xử lý dầu ` +
      `(chân không hóa/lọc khí) trước khi đưa thiết bị vào vận hành chính thức.`
    );
  }
  return acts;
}

function buildRecommendations({ overallOk, exceedCount, diagnosis, duval, rateRows, condemningRows, additionalRatios, bang63, equipmentType, bushingCodes, gases }) {
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
        PD: `Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): PD — phóng điện cục bộ (CH4/H2 < ${vnNum(IEC_A10_BUSHING_RATIOS.pd_h_max)}) — khuyến cáo đo phóng điện cục bộ bổ sung nếu điều kiện cho phép.`,
        D: `Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): D — phóng điện (C2H2/C2H4 > ${vnNum(IEC_A10_BUSHING_RATIOS.d_g_min)}) — khuyến cáo kiểm tra cách điện, siết lại kết nối, xem xét thí nghiệm điện môi bổ sung.`,
        T: `Mã chẩn đoán Bảng A.10 (sứ xuyên, Annex A.5.3): T — tăng nhiệt (C2H4/C2H6 > ${vnNum(IEC_A10_BUSHING_RATIOS.t_i_min)}) — khuyến cáo kiểm tra mối nối/tiếp xúc, tải vận hành, và nhiệt độ điểm nóng nếu có điều kiện đo.`,
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
  // Bảng 66 không khớp mã nào -> bảng đơn giản hóa PD/D/T (Điều 54) để xác định lỗi SƠ BỘ.
  if (gases && equipmentType !== EQUIPMENT_TYPES.BUSHING && diagnosis === NO_DIAGNOSIS) {
    const simple = diagnoseSimplifiedPDT(computeRatios(gases));
    if (simple) {
      recs.push(`Tỷ số khí không nằm trong giới hạn Bảng 66 — theo bảng đơn giản hóa của Điều 54, lỗi khiếm khuyết sơ bộ: ${simple.text}; đối chiếu thêm Tam giác Duval và biểu đồ tỷ số khí.`);
    }
  }
  // Lưu đồ Điều 54: khí vượt điển hình + tốc độ tăng cao -> kiểm tra nhiễm khí từ OLTC (C2H2/H2 > 2–3).
  if (gases && equipmentType === EQUIPMENT_TYPES.MBA && exceedCount > 0) {
    const oltc = oltcContaminationCheck(gases);
    if (oltc.level !== "none") {
      recs.push(
        `C2H2/H2 = ${vnNum(oltc.ratio)} ${oltc.level === "likely" ? `> ${vnNum(DIEU54_OLTC_C2H2_H2.likely)}` : `trong khoảng ${vnNum(DIEU54_OLTC_C2H2_H2.possible)}–${vnNum(DIEU54_OLTC_C2H2_H2.likely)}`} — ${oltc.level === "likely" ? "nghi ngờ rõ" : "có thể"} nhiễm khí từ khoang OLTC (Điều 54): lấy mẫu dầu khoang OLTC, phân tích khí hòa tan so sánh với khoang dầu chính, trừ khí nền từ OLTC để tính lại hàm lượng khí trong khoang dầu chính trước khi tra tỷ số khí; kiểm tra tiếp điểm chuyển nấc và độ kín giữa 2 khoang.`
      );
    }
  }
  // Lưu đồ Điều 54: hàm lượng khí thấp hơn khoảng điển hình.
  if (gases && gasesBelowTypicalLow(gases, equipmentType)) {
    recs.push("Hàm lượng tất cả các khí đều thấp hơn khoảng giá trị điển hình (Bảng 64) — kiểm tra lỗi lấy mẫu, đo lường hoặc do xử lý dầu gần đây; tiếp tục theo dõi định kỳ (Điều 54).");
  }
  if (rateWarnings.length > 0) {
    recs.push(`Tốc độ sinh khí vượt ${REGULATION_CITATIONS.BANG65_RATE} ở ${rateWarnings.length} khí (${rateWarnings.map((r) => r.gas).join(", ")}) — nghi khiếm khuyết đang phát triển, khuyến cáo rút ngắn chu kỳ giám sát và lấy mẫu DGA lại sớm hơn dự kiến.`);
  }
  if (exceedCount === 0 && diagnosis) {
    recs.push("Chưa đủ điều kiện áp dụng chính thức tỷ lệ khí (chưa có khí vượt giá trị điển hình) — mã chẩn đoán Bảng 66/Bảng A.10/Tam giác Duval ở trên chỉ mang tính tham khảo.");
  }
  // Tỷ lệ bổ sung + Tổng hàm lượng khí hòa tan (Điều 54) — xem dieu54AdvisoryMessages().
  recs.push(...dieu54AdvisoryMessages({ additionalRatios, bang63, equipmentType }));
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
  return !!diagnosis && diagnosis !== NO_DIAGNOSIS && !diagnosis.startsWith("Không áp dụng");
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

// ===== src/domain/dga-logic-oil.js =====
/* dga-logic-oil.js — Phần 3/6 của dga-logic.js sau khi tách theo miền (xem
   dga-logic.js). Đánh giá thí nghiệm dầu cách điện MBA/Kháng dầu (Bảng 54/55/58) và
   dầu khoang điều áp dưới tải OLTC (Điều 37/Bảng 49) — dùng các bảng hằng số từ
   dga-logic-core.js. */

function evaluateOltcOilTest({ oltcSamplePoint, voltageClass, oilState, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards, extra, prevFlashPoint, oxMethod }) {
  const state = oilState === "new" ? "new" : "inservice";

  if (state === "new") {
    // Điều 37: dầu OLTC lắp mới đánh giá như dầu thùng chính — gồm cả chỉ tiêu bổ sung (axit, chớp cháy, tạp chất...)
    const result = evaluateOilTest({ voltageClass, oilState: state, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards, extra, prevFlashPoint, oxMethod });
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

  const baseCount = rows.length;
  // Dầu OLTC VẬN HÀNH: Bảng 49 chỉ quy định BDV + độ ẩm — các chỉ tiêu bổ sung (nếu có trên BBTN) chỉ GHI NHẬN
  // để theo dõi xu hướng, không kết luận (theo chỉ dẫn nhà sản xuất OLTC nếu có).
  if (extra) {
    evaluateOilExtendedQd1901({ voltageClass, oilState: "inservice", extra, prevFlashPoint, oxMethod }).forEach((r) => rows.push({
      ...r, label: r.label + " (OLTC)", limit: null, limitText: "—", verdict: "Không có ngưỡng",
      ref: REGULATION_CITATIONS.BANG49_OLTC + " chỉ quy định điện áp chọc thủng và hàm lượng nước cho dầu OLTC vận hành — chỉ ghi nhận (theo chỉ dẫn nhà sản xuất OLTC nếu có)",
    }));
  }
  rows.forEach((r) => { if (r.limitText === undefined) r.limitText = oilLimitText(r.limit, r.direction); });

  const overall = baseCount === 0 ? oilOverallFromRows(rows)
    : rows.some((r) => r.verdict === "Không đạt") ? "Không đạt" : "Đạt";
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
function evaluateOilTest({ voltageClass, oilState, hasMembraneN2, moisture, tgd90, bdv, manufacturer, manufacturerOilStandards, extra, prevFlashPoint, oxMethod }) {
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

  // Chỉ tiêu lý-hóa BỔ SUNG (axit, chớp cháy, tạp chất, điện trở suất, 2-FAL...) — dga-logic-oil-extended.js.
  // Không truyền "extra" (bản ghi/caller cũ) thì giữ nguyên 3 chỉ tiêu như trước.
  if (extra) rows.push(...evaluateOilExtendedQd1901({ voltageClass, oilState: state, extra, prevFlashPoint, oxMethod }));
  rows.forEach((r) => { if (r.limitText === undefined) r.limitText = oilLimitText(r.limit, r.direction); });

  // Dòng "Không có ngưỡng" (chỉ ghi nhận) không làm thay đổi kết luận — xem oilOverallFromRows().
  const overall = oilOverallFromRows(rows);
  return { rows, overall };
}

// ===== src/domain/dga-logic-instrument-oil.js =====
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
 * Tham số là 1 object:
 *   equipmentType — EQUIPMENT_TYPES.TI / TU / BUSHING (sứ xuyên dùng chung cách đánh giá theo NSX);
 *   manufacturerOilStandards — xem toOilStandardsForLogic() — cần thêm equipmentType/*Reject;
 *   tgd20 — tgδ đo ở 20°C (%, tùy chọn) — khác hẳn tgd90, một số NSX (VD Arteche) đưa ra ngưỡng riêng ở
 *     nhiệt độ phòng thay vì 90°C như QĐ1901/Bảng 55 dùng cho dầu MBA;
 *   umKv — Cấp điện áp Um (kV) của chính thiết bị (tùy chọn) — dùng để xác định có áp ngưỡng loại bỏ tgδ20°C
 *     RIÊNG cho thiết bị U.H.V hay không, xem tgd20RejectUhv/tgd20UhvUmKv ở toOilStandardsForLogic() (VD Arteche:
 *     loại bỏ chung >3%, nhưng U.H.V (Um≥500kV theo xác nhận người dùng) dùng ngưỡng chặt hơn 1,5%).
 * @param {{equipmentType: string, manufacturer: (string|null|undefined), manufacturerOilStandards: Array<object>,
 *   moisture?: (number|string|null), tgd90?: (number|string|null), tgd20?: (number|string|null),
 *   bdv?: (number|string|null), umKv?: (number|string|null)}} params
 */
function evaluateInstrumentOilTest({ equipmentType, manufacturer, manufacturerOilStandards, moisture, tgd90, tgd20, bdv, umKv }) {
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
  if (hasVal(tgd20)) {
    const v = Number(tgd20);
    const normalLimit = match ? match.tgd20 : null;
    // Ngưỡng loại bỏ RIÊNG cho thiết bị U.H.V (VD Arteche: tài liệu NSX ghi "giới hạn
    // thấp phía U.H.V là 1,5 hoặc 2" — không nêu rõ mốc kV; người dùng xác nhận áp
    // dụng khi Um ≥ 500kV, chọn 1,5 làm giá trị — xem tgd20RejectUhv/tgd20UhvUmKv ở
    // toOilStandardsForLogic()). Chỉ áp dụng khi NSX có cấu hình ĐỦ cả 2 trường này
    // VÀ đã nhập Um của thiết bị VÀ Um đạt/vượt mốc — nếu không, dùng tgd20Reject chung.
    const uhvApplies = match && hasVal(match.tgd20RejectUhv) && hasVal(match.tgd20UhvUmKv)
      && hasVal(umKv) && Number(umKv) >= Number(match.tgd20UhvUmKv);
    const rejectLimit = match ? (uhvApplies ? match.tgd20RejectUhv : match.tgd20Reject) : null;
    rows.push({
      key: "tgd20",
      label: "Tổn hao điện môi tgδ (20°C)" + (uhvApplies ? ` — áp ngưỡng U.H.V (Um≥${match.tgd20UhvUmKv}kV)` : ""),
      value: v, direction: "le", unit: "%",
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

// ===== src/domain/dga-logic-iec60422-2024.js =====
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
function evaluateIec60422MbaOilTest({ voltageClass, moisture, tgd90, bdv, oilState, extra, prevFlashPoint, inhibited }) {
  const category = mapOilVoltageClassToIec60422Category(voltageClass);
  const limits = IEC60422_2024_TABLE5_MBA[category];
  // Dầu MỚI (sau khi nạp, trước đóng điện) -> Bảng 3; dầu vận hành -> Bảng 5 (như trước). Chỉ tiêu bổ sung:
  // evaluateIec60422ExtendedMba() (dga-logic-oil-extended.js).
  if (oilState === "new") {
    const rowsNew = [...evaluateIec60422NewOilBase({ voltageClass, moisture, tgd90, bdv }),
      ...(extra ? evaluateIec60422ExtendedMba({ voltageClass, oilState, extra, prevFlashPoint, inhibited }) : [])];
    return { rows: rowsNew, overall: oilOverallFromRows(rowsNew), category,
      categoryLabel: IEC60422_2024_CATEGORY_LABEL_MBA[category] + " — Bảng 3 (dầu mới)" };
  }
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
  if (extra) rows.push(...evaluateIec60422ExtendedMba({ voltageClass, oilState, extra, prevFlashPoint, inhibited }));

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
 *  Tham số là 1 object; umKv: cấp điện áp Um (kV) của TI/TU — BẮT BUỘC để xác định Category D/E,
 *  thiếu thì trả overall "Chưa có cấp điện áp Um".
 *  @param {{umKv: (number|string|null|undefined), moisture?: (number|string|null), tgd90?: (number|string|null),
 *    bdv?: (number|string|null)}} params
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

// ===== src/domain/dga-logic-oil-extended.js =====
/* dga-logic-oil-extended.js — Các chỉ tiêu LÝ-HÓA dầu MBA/Kháng dầu BỔ SUNG ngoài 3 chỉ tiêu cơ bản
   (độ ẩm, tgδ 90°C, điện áp chọc thủng — dga-logic-oil.js), theo:
   - QĐ1901 Chương VI "Dầu MBA": Điều 48 (màu sắc), Điều 49 (tạp chất cơ học — Bảng 56, đếm hạt — Bảng 57),
     Điều 51 (nhiệt độ chớp cháy), Điều 52 (trị số axit — Bảng 59), Điều 53 (độ ổn định/kháng ôxi hóa —
     Bảng 60/61/62, khi pha trộn dầu), Điều 55 (2-furfural), Điều 56 (điện trở suất — Bảng 70).
   - IEC 60422:2024: Bảng 3 (dầu mới sau khi nạp, trước khi đóng điện) và các chỉ tiêu còn lại của Bảng 5
     (dầu vận hành: màu, ngoại quan, axit, điện trở suất, sức căng bề mặt, cặn/bùn, lưu huỳnh ăn mòn, PCB,
     chất ức chế, chất thụ động, nhiệt độ chớp cháy).
   Nạp SAU dga-logic-iec60422-2024.js (dùng verdictTwoTierOil()/mapOilVoltageClassToIec60422Category()) và
   TRƯỚC dga-logic-regulation-config.js (registry cấu hình tham chiếu trực tiếp các hằng số bên dưới).
   Mọi ngưỡng ở đây Admin chỉnh được (Cấu hình → Quy định). KHÔNG tự tạo ngưỡng ngoài văn bản: ô nào
   văn bản không có số liệu thì để null → đánh giá "Không có ngưỡng" (chỉ ghi nhận để theo dõi xu hướng). */

REGULATION_CITATIONS.DIEU48_COLOR = "Điều 48 QĐ1901";
REGULATION_CITATIONS.BANG56_MECH = "Bảng 56, Điều 49 QĐ1901";
REGULATION_CITATIONS.BANG57_PARTICLES = "Bảng 57, Điều 49 QĐ1901";
REGULATION_CITATIONS.DIEU51_FLASH = "Điều 51 QĐ1901";
REGULATION_CITATIONS.BANG59_ACID = "Bảng 59, Điều 52 QĐ1901";
REGULATION_CITATIONS.BANG60_62_OXIDATION = "Bảng 60–62, Điều 53 QĐ1901";
REGULATION_CITATIONS.DIEU55_FURFURAL = "Điều 55 QĐ1901";
REGULATION_CITATIONS.BANG70_RESISTIVITY = "Bảng 70, Điều 56 QĐ1901";
REGULATION_CITATIONS.IEC60422_2024_TABLE3_NEW = "IEC 60422:2024 Bảng 3 (Table 3) — dầu mới sau khi nạp vào thiết bị, trước khi đóng điện";

// ---------------------------------------------------------------------------
// 1) Ngưỡng QĐ1901
// ---------------------------------------------------------------------------

// Bảng 59 — Trị số axit (mgKOH/g dầu), KHÔNG LỚN HƠN. Dầu mới: 0,02 mọi cấp. Dầu vận hành: "Đến 35 kV" 0,25;
// "110 kV" 0,15; "220 đến 500 kV" 0,1 — đủ mọi cấp điện áp đang dùng (cấp 66 kV cũ đã bỏ).
const BANG59_ACID = {
  new: 0.02,
  inservice: { duoi15: 0.25, "15den35": 0.25, "110": 0.15, "220": 0.1, "500": 0.1 },
};

// Điều 51 — Nhiệt độ chớp cháy cốc kín (ASTM D93/ISO 2719): dầu mới KHÔNG THẤP HƠN 135°C; trong vận hành
// KHÔNG ĐƯỢC GIẢM QUÁ 5°C (so với lần thí nghiệm trước — app lấy lần thí nghiệm liền trước của cùng thiết bị).
const DIEU51_FLASH = { new_min: 135, max_drop: 5 };

// Bảng 56 — Tạp chất cơ học (% khối lượng), KHÔNG LỚN HƠN. Đến 110 kV: quan sát bằng mắt "Không thấy".
const BANG56_MECH = {
  "220": { new: 0.0016, inservice: 0.0017 },
  "500": { new: 0.0015, inservice: 0.0016 },
};

// Bảng 57 — Đếm hạt tạp chất (số hạt trong 1 ml dầu), KHÔNG LỚN HƠN. Đến 110 kV: quan sát "Không thấy".
const BANG57_PARTICLES = {
  "220": { p6: { new: 320, inservice: 1300 }, p14: { new: 40, inservice: 160 } },
  "500": { p6: { new: 80, inservice: 320 }, p14: { new: 10, inservice: 40 } },
};

// Điều 55 — Hàm lượng 2-furfural: "không quá 15 ppm" — thực hiện với MBA ≥110 kV.
const DIEU55_FURFURAL = { max_ppm: 15 };

// Bảng 70 — Điện trở suất khối ở 90°C (×10¹² Ω·cm), KHÔNG NHỎ HƠN. Bản trích QĐ1901 có 5 cột (≤15, 15÷35,
// 110, 220, 500 kV) nhưng hàng "Dầu mới" chỉ có 4 ô "- - 0,3×10¹² 1×10¹²" → app hiểu ô 1×10¹² gộp cho
// 220 và 500 kV; hàng "Dầu trong vận hành" KHÔNG có số liệu → null. Admin kiểm tra lại với văn bản gốc.
const BANG70_RESISTIVITY = {
  new: { "110": 0.3, "220": 1, "500": 1 },
  inservice: { "110": null, "220": null, "500": null },
};

// Bảng 60–62 — Độ ổn định ôxi hóa (kháng ôxi hóa) — CHỈ thí nghiệm khi PHA TRỘN dầu (Điều 53), dầu mới.
// sludge: khối lượng cặn sau ôxi hóa (%), acid: trị số axit sau ôxi hóa (mgKOH/g), tgd: tổn thất điện môi
// sau ôxi hóa ở 90°C (ghi đúng như văn bản, dạng phân số) — KHÔNG LỚN HƠN.
const BANG60_62_OXIDATION = {
  gost981: { label: "GOST 981 (Bảng 60)", sludge: 0.01, acid: 0.1, tgd: null },
  iec61125_A: { label: "IEC 61125 — Loại A, dầu ức chế 0,08–0,40%, 500h (Bảng 61)", sludge: 0.05, acid: 0.3, tgd: 0.05 },
  iec61125_B: { label: "IEC 61125 — Loại B (Bảng 61)", sludge: 0.8, acid: 1.2, tgd: 0.5 },
  astm_I_72: { label: "ASTM D2440 — Loại I, 72h (Bảng 62)", sludge: 0.15, acid: 0.5, tgd: null },
  astm_II_72: { label: "ASTM D2440 — Loại II, 72h (Bảng 62)", sludge: 0.1, acid: 0.3, tgd: null },
  astm_I_164: { label: "ASTM D2440 — Loại I, 164h (Bảng 62)", sludge: 0.3, acid: 0.6, tgd: null },
  astm_II_164: { label: "ASTM D2440 — Loại II, 164h (Bảng 62)", sludge: 0.2, acid: 0.4, tgd: null },
};

// ---------------------------------------------------------------------------
// 2) Ngưỡng IEC 60422:2024
// ---------------------------------------------------------------------------

// Bảng 3 — dầu mới sau khi nạp vào thiết bị, trước khi đóng điện. Category theo Um: C <72,5 / B 72,5–170 /
// A >170 kV. tgδ (DDF) bản gốc ghi dạng phân số (0,010/0,015) → quy đổi % (×100) cho khớp app.
const IEC60422_2024_TABLE3_NEW = {
  A: { bdv: 60, moisture: 10, tgd90: 1.0 },
  B: { bdv: 60, moisture: 10, tgd90: 1.5 },
  C: { bdv: 55, moisture: 20, tgd90: 1.5 },
  common: { color: 2.0, acid: 0.03, ift: 35, pcb: 2 },
};

// Bảng 5 — các chỉ tiêu dầu vận hành NGOÀI 3 chỉ tiêu cơ bản (good = biên "Tốt", poor = biên "Kém").
// Điện trở suất ở 90°C tính bằng GΩ·m (app nhập ×10¹² Ω·cm theo QĐ1901, 1×10¹² Ω·cm = 10 GΩ·m).
const IEC60422_2024_TABLE5_EXTRA = {
  color: { good: 2, poor: 6 },
  acid: { A: { good: 0.1, poor: 0.15 }, B: { good: 0.1, poor: 0.2 }, C: { good: 0.15, poor: 0.3 } },
  resistivity: { A: { good: 10, poor: 3 }, B: { good: 3, poor: 0.2 }, C: { good: 3, poor: 0.2 } },
  ift: { inhibited: { good: 28, poor: 22 }, uninhibited: { good: 25, poor: 20 } },
  inhibitor: { good: 60, poor: 40 },
  passivator: { good: 70, poor: 50 },
  sediment_max: 0.02,
  sludge_max: 0.02,
  flash_drop_pct: 10,
};

// ---------------------------------------------------------------------------
// 3) Danh mục chỉ tiêu (dùng chung cho form nhập, lưu trữ, đọc BBTN, xu hướng)
//    field = tên cột lưu trữ; group: "base" (3 chỉ tiêu cơ bản), "qd1901", "iec", "oxidation".
// ---------------------------------------------------------------------------
const OIL_PARAM_DEFS = [
  { field: "bdv_kv", key: "bdv", group: "base", label: "Điện áp chọc thủng", unit: "kV", step: "0.1" },
  { field: "tgd_90c_percent", key: "tgd90", group: "base", label: "Tổn hao điện môi tgδ ở 90°C", unit: "%", step: "0.001" },
  { field: "moisture_ppm", key: "moisture", group: "base", label: "Hàm lượng nước (độ ẩm)", unit: "ppm", step: "0.1" },
  { field: "acid_mgkoh", key: "acid", group: "qd1901", label: "Trị số axit", unit: "mgKOH/g", step: "0.001" },
  { field: "flash_point_c", key: "flash", group: "qd1901", label: "Nhiệt độ chớp cháy cốc kín", unit: "°C", step: "0.1" },
  { field: "mech_visual", key: "mechvis", group: "qd1901", label: "Tạp chất cơ học — quan sát bằng mắt", unit: "", type: "select",
    options: [{ value: "khong", label: "Không thấy" }, { value: "co", label: "Có tạp chất" }] },
  { field: "mech_impurity_percent", key: "mech", group: "qd1901", label: "Hàm lượng tạp chất cơ học", unit: "%", step: "0.0001" },
  { field: "particles_6um", key: "p6", group: "qd1901", label: "Số hạt tạp chất > 6 μm", unit: "hạt/ml", step: "1" },
  { field: "particles_14um", key: "p14", group: "qd1901", label: "Số hạt tạp chất > 14 μm", unit: "hạt/ml", step: "1" },
  { field: "resistivity_90c_e12", key: "resistivity", group: "qd1901", label: "Điện trở suất khối ở 90°C", unit: "×10¹² Ω·cm", step: "0.01" },
  { field: "furfural_ppm", key: "furfural", group: "qd1901", label: "Hàm lượng 2-furfural (2-FAL)", unit: "ppm", step: "0.01" },
  { field: "color_iso2049", key: "color", group: "qd1901", label: "Màu sắc (thang ISO 2049)", unit: "", step: "0.5" },
  { field: "appearance", key: "appearance", group: "iec", label: "Ngoại quan", unit: "", type: "select",
    options: [{ value: "trong", label: "Trong, không cặn/vẩn" }, { value: "duc", label: "Đục/vẩn đục" }] },
  { field: "ift_mnm", key: "ift", group: "iec", label: "Sức căng bề mặt (IFT)", unit: "mN/m", step: "0.1" },
  { field: "corrosive_sulfur", key: "sulfur", group: "iec", label: "Lưu huỳnh ăn mòn / có khả năng ăn mòn", unit: "", type: "select",
    options: [{ value: "khong", label: "Không ăn mòn" }, { value: "co", label: "Ăn mòn / có khả năng ăn mòn" }] },
  { field: "pcb_mgkg", key: "pcb", group: "iec", label: "Hàm lượng PCB", unit: "mg/kg", step: "0.1" },
  { field: "sediment_percent", key: "sediment", group: "iec", label: "Cặn (sediment)", unit: "%", step: "0.001" },
  { field: "sludge_percent", key: "sludge", group: "iec", label: "Bùn (sludge)", unit: "%", step: "0.001" },
  { field: "inhibitor_pct_original", key: "inhibitor", group: "iec", label: "Hàm lượng chất ức chế (so với ban đầu)", unit: "%", step: "1" },
  { field: "passivator_mgkg", key: "passivator", group: "iec", label: "Hàm lượng chất thụ động (passivator)", unit: "mg/kg", step: "1" },
  { field: "acid_base_soluble", key: "acidbase", group: "other", label: "Axit – kiềm hòa tan trong dầu (phản ứng axit-bazơ)", unit: "", type: "select",
    options: [{ value: "khong", label: "Không có" }, { value: "co", label: "Có" }] },
  { field: "ox_sludge_percent", key: "oxsludge", group: "oxidation", label: "Khối lượng cặn sau ôxi hóa", unit: "%", step: "0.001" },
  { field: "ox_acid_mgkoh", key: "oxacid", group: "oxidation", label: "Trị số axit sau ôxi hóa", unit: "mgKOH/g", step: "0.001" },
  { field: "ox_tgd", key: "oxtgd", group: "oxidation", label: "Tổn thất điện môi tgδ 90°C sau ôxi hóa", unit: "", step: "0.001" },
];

/** Các trường MỚI (ngoài moisture_ppm/tgd_90c_percent/bdv_kv) — dùng cho lưu trữ & kiểm tra đủ dữ liệu. */
const OIL_EXT_FIELDS = OIL_PARAM_DEFS.filter((d) => d.group !== "base").map((d) => d.field);

const OIL_GROUP_LABELS = {
  base: "Chỉ tiêu cơ bản (Bảng 54, 55, 58 QĐ1901)",
  qd1901: "Chỉ tiêu lý-hóa bổ sung theo QĐ1901 (Điều 48–56)",
  iec: "Chỉ tiêu bổ sung theo IEC 60422:2024 (QĐ1901 không quy định)",
  other: "Chỉ tiêu khác ghi trên BBTN (QĐ1901, IEC 60422 không quy định)",
  oxidation: "Độ ổn định ôxi hóa — chỉ khi pha trộn dầu (Điều 53, Bảng 60–62)",
};

function oilParamDef(field) {
  return OIL_PARAM_DEFS.find((d) => d.field === field) || null;
}

function oilSelectLabel(field, value) {
  const d = oilParamDef(field);
  const o = d && d.options ? d.options.find((x) => x.value === value) : null;
  return o ? o.label : value;
}

function oilExtNum(extra, field) {
  return extra && hasVal(extra[field]) && Number.isFinite(Number(extra[field])) ? Number(extra[field]) : null;
}

function oilVerdictLe(v, lim) {
  return lim === null || lim === undefined ? "Không có ngưỡng" : v <= lim ? "Đạt" : "Không đạt";
}
function oilVerdictGe(v, lim) {
  return lim === null || lim === undefined ? "Không có ngưỡng" : v >= lim ? "Đạt" : "Không đạt";
}
function oilLimitText(lim, direction) {
  return lim === null || lim === undefined ? "—" : (direction === "ge" ? "≥ " : "≤ ") + lim;
}

/**
 * Đánh giá các chỉ tiêu bổ sung theo QĐ1901 (Điều 48–56). Trả về mảng dòng cùng định dạng
 * evaluateOilTest() (key, label, value, limit, limitText, unit, direction, verdict, ref).
 * @param {{voltageClass:string, oilState:string, extra:Object, prevFlashPoint?:number|null, oxMethod?:string}} p
 */
function evaluateOilExtendedQd1901({ voltageClass, oilState, extra, prevFlashPoint, oxMethod }) {
  const state = oilState === "new" ? "new" : "inservice";
  const vc = voltageClass;
  const upTo110 = ["duoi15", "15den35", "tren35duoi110", "110"].includes(vc);
  const rows = [];
  const push = (r) => rows.push({ limitText: oilLimitText(r.limit, r.direction), ...r });

  const acid = oilExtNum(extra, "acid_mgkoh");
  if (acid !== null) {
    const lim = state === "new" ? BANG59_ACID.new : (BANG59_ACID.inservice[vc] ?? null);
    push({
      key: "acid", label: "Trị số axit", value: acid, limit: lim, unit: "mgKOH/g", direction: "le",
      verdict: oilVerdictLe(acid, lim),
      ref: REGULATION_CITATIONS.BANG59_ACID + (lim === null ? " — văn bản không có số liệu cho cấp điện áp này" : ""),
    });
  }

  const flash = oilExtNum(extra, "flash_point_c");
  if (flash !== null) {
    if (state === "new") {
      push({
        key: "flash", label: "Nhiệt độ chớp cháy cốc kín", value: flash, limit: DIEU51_FLASH.new_min, unit: "°C", direction: "ge",
        verdict: oilVerdictGe(flash, DIEU51_FLASH.new_min), ref: REGULATION_CITATIONS.DIEU51_FLASH + " — dầu mới",
      });
    } else if (prevFlashPoint !== null && prevFlashPoint !== undefined && Number.isFinite(Number(prevFlashPoint))) {
      const prev = Number(prevFlashPoint);
      const drop = Math.round((prev - flash) * 100) / 100;
      push({
        key: "flash", label: "Nhiệt độ chớp cháy cốc kín", value: flash, limit: null,
        limitText: `Giảm ≤ ${DIEU51_FLASH.max_drop}°C so với lần trước (${prev}°C)`, unit: "°C", direction: "ge",
        verdict: drop <= DIEU51_FLASH.max_drop ? "Đạt" : "Không đạt",
        ref: `${REGULATION_CITATIONS.DIEU51_FLASH} — dầu vận hành, ${drop > 0 ? `giảm ${drop}°C` : "không giảm"} so với lần thí nghiệm trước`,
      });
    } else {
      push({
        key: "flash", label: "Nhiệt độ chớp cháy cốc kín", value: flash, limit: null,
        limitText: `Giảm ≤ ${DIEU51_FLASH.max_drop}°C so với lần trước`, unit: "°C", direction: "ge", verdict: "Không có ngưỡng",
        ref: REGULATION_CITATIONS.DIEU51_FLASH + " — dầu vận hành: chưa có lần thí nghiệm trước của thiết bị để so sánh mức giảm",
      });
    }
  }

  const mechVis = extra && hasVal(extra.mech_visual) ? String(extra.mech_visual) : null;
  if (mechVis) {
    push({
      key: "mechvis", label: "Tạp chất cơ học (quan sát bằng mắt)", value: oilSelectLabel("mech_visual", mechVis), limit: null,
      limitText: "Không thấy", unit: "", direction: "le", verdict: mechVis === "co" ? "Không đạt" : "Đạt",
      ref: REGULATION_CITATIONS.BANG56_MECH + " / " + REGULATION_CITATIONS.BANG57_PARTICLES + " — quan sát bằng mắt phải \"Không thấy\"",
    });
  }
  const mech = oilExtNum(extra, "mech_impurity_percent");
  if (mech !== null) {
    const lim = BANG56_MECH[vc] ? BANG56_MECH[vc][state] : null;
    push({
      key: "mech", label: "Hàm lượng tạp chất cơ học", value: mech, limit: lim, unit: "%", direction: "le",
      verdict: oilVerdictLe(mech, lim),
      ref: REGULATION_CITATIONS.BANG56_MECH + (lim === null ? (upTo110 ? " — đến 110 kV đánh giá bằng quan sát (Không thấy)" : " — không có số liệu") : ""),
    });
  }
  [["particles_6um", "p6", "Số hạt tạp chất > 6 μm"], ["particles_14um", "p14", "Số hạt tạp chất > 14 μm"]].forEach(([field, k, label]) => {
    const v = oilExtNum(extra, field);
    if (v === null) return;
    const lim = BANG57_PARTICLES[vc] ? BANG57_PARTICLES[vc][k][state] : null;
    push({
      key: k, label, value: v, limit: lim, unit: "hạt/ml", direction: "le", verdict: oilVerdictLe(v, lim),
      ref: REGULATION_CITATIONS.BANG57_PARTICLES + (lim === null ? (upTo110 ? " — đến 110 kV đánh giá bằng quan sát (Không thấy)" : " — không có số liệu") : ""),
    });
  });

  const res = oilExtNum(extra, "resistivity_90c_e12");
  if (res !== null) {
    const lim = (BANG70_RESISTIVITY[state] || {})[vc] ?? null;
    push({
      key: "resistivity", label: "Điện trở suất khối ở 90°C", value: res, limit: lim, unit: "×10¹² Ω·cm", direction: "ge",
      verdict: oilVerdictGe(res, lim),
      ref: REGULATION_CITATIONS.BANG70_RESISTIVITY + (lim === null ? (state === "inservice" ? " — văn bản không có số liệu cho dầu vận hành, ghi nhận để theo dõi xu hướng" : " — không có số liệu cho cấp điện áp này") : ""),
    });
  }

  const fur = oilExtNum(extra, "furfural_ppm");
  if (fur !== null) {
    const applies = ["110", "220", "500"].includes(vc);
    const lim = applies ? DIEU55_FURFURAL.max_ppm : null;
    push({
      key: "furfural", label: "Hàm lượng 2-furfural (2-FAL)", value: fur, limit: lim, unit: "ppm", direction: "le",
      verdict: oilVerdictLe(fur, lim),
      ref: REGULATION_CITATIONS.DIEU55_FURFURAL + (applies ? "" : " — chỉ quy định cho MBA điện áp 110 kV trở lên"),
    });
  }

  const color = oilExtNum(extra, "color_iso2049");
  if (color !== null) {
    push({
      key: "color", label: "Màu sắc (thang ISO 2049)", value: color, limit: null, limitText: "—", unit: "", direction: "le",
      verdict: "Không có ngưỡng",
      ref: REGULATION_CITATIONS.DIEU48_COLOR + " — không bắt buộc, không có ngưỡng số: dầu mới màu tối = độ sạch không đạt; trong vận hành tối nhanh = dầu bị nóng hoặc tạo than",
    });
  }

  // Axit – kiềm hòa tan (water-soluble acids & bases): QĐ1901 KHÔNG quy định — chỉ đánh giá theo đúng giới hạn
  // "Không có" mà phòng thí nghiệm ghi trên BBTN (mẫu BBTN dầu cách điện PTC3).
  const acidBase = extra && hasVal(extra.acid_base_soluble) ? String(extra.acid_base_soluble) : null;
  if (acidBase) {
    push({
      key: "acidbase", label: "Axit – kiềm hòa tan trong dầu", value: oilSelectLabel("acid_base_soluble", acidBase), limit: null,
      limitText: "Không có", unit: "", direction: "le", verdict: acidBase === "co" ? "Không đạt" : "Đạt",
      ref: "Giới hạn ghi trên BBTN của phòng thí nghiệm — QĐ1901 không quy định chỉ tiêu này",
    });
  }

  const ox = BANG60_62_OXIDATION[oxMethod] || null;
  [["ox_sludge_percent", "oxsludge", "Khối lượng cặn sau ôxi hóa", "%", "sludge"],
    ["ox_acid_mgkoh", "oxacid", "Trị số axit sau ôxi hóa", "mgKOH/g", "acid"],
    ["ox_tgd", "oxtgd", "Tổn thất điện môi tgδ 90°C sau ôxi hóa", "", "tgd"]].forEach(([field, k, label, unit, limKey]) => {
    const v = oilExtNum(extra, field);
    if (v === null) return;
    const lim = ox ? ox[limKey] ?? null : null;
    push({
      key: k, label, value: v, limit: lim, unit, direction: "le", verdict: oilVerdictLe(v, lim),
      ref: REGULATION_CITATIONS.BANG60_62_OXIDATION + (ox ? " — " + ox.label : " — chưa chọn phương pháp thử nên chưa có ngưỡng"),
    });
  });

  return rows;
}

/** Đánh giá IEC 60422:2024 cho các chỉ tiêu bổ sung. oilState "new" → Bảng 3 (2 mức Đạt/Không đạt),
 *  ngược lại → Bảng 5 (3 mức Tốt/Cần theo dõi/Kém = Đạt/Cảnh báo/Không đạt). */
function evaluateIec60422ExtendedMba({ voltageClass, oilState, extra, prevFlashPoint, inhibited }) {
  const category = mapOilVoltageClassToIec60422Category(voltageClass);
  const rows = [];
  const isNew = oilState === "new";
  const ref3 = REGULATION_CITATIONS.IEC60422_2024_TABLE3_NEW + " — Category " + category;
  const ref5 = REGULATION_CITATIONS.IEC60422_2024_TABLE5_MBA + " — Category " + category;
  const T3 = IEC60422_2024_TABLE3_NEW.common;
  const T5 = IEC60422_2024_TABLE5_EXTRA;
  const tier = (label, key, v, good, poor, dir, unit, extraRef) => rows.push({
    key, label, value: v, unit, direction: dir,
    limit: "Tốt " + (dir === "ge" ? "> " : "< ") + good + " · Kém " + (dir === "ge" ? "< " : "> ") + poor,
    verdict: verdictTwoTierOil(v, good, poor, dir), ref: ref5 + (extraRef || ""),
  });
  const pass = (label, key, v, lim, dir, unit, extraRef) => rows.push({
    key, label, value: v, unit, direction: dir, limit: (dir === "ge" ? "≥ " : "≤ ") + lim,
    verdict: dir === "ge" ? (v >= lim ? "Đạt" : "Không đạt") : (v <= lim ? "Đạt" : "Không đạt"), ref: ref3 + (extraRef || ""),
  });

  const color = oilExtNum(extra, "color_iso2049");
  if (color !== null) {
    if (isNew) pass("Màu sắc (ISO 2049)", "color", color, T3.color, "le", "");
    else tier("Màu sắc (ISO 2049)", "color", color, T5.color.good, T5.color.poor, "le", "", " — chỉ tham khảo, IEC khuyến cáo không hành động chỉ dựa vào màu");
  }
  const app = extra && hasVal(extra.appearance) ? String(extra.appearance) : null;
  if (app) {
    rows.push({
      key: "appearance", label: "Ngoại quan", value: oilSelectLabel("appearance", app), unit: "", direction: "le",
      limit: "Trong, không cặn/vẩn", verdict: app === "duc" ? (isNew ? "Không đạt" : "Cảnh báo") : "Đạt", ref: isNew ? ref3 : ref5,
    });
  }
  const acid = oilExtNum(extra, "acid_mgkoh");
  if (acid !== null) {
    if (isNew) pass("Trị số axit", "acid", acid, T3.acid, "le", "mgKOH/g");
    else tier("Trị số axit", "acid", acid, T5.acid[category].good, T5.acid[category].poor, "le", "mgKOH/g");
  }
  const res = oilExtNum(extra, "resistivity_90c_e12");
  if (res !== null && !isNew) {
    const gohm = Math.round(res * 10 * 1000) / 1000; // 1×10¹² Ω·cm = 10 GΩ·m
    tier("Điện trở suất ở 90°C", "resistivity", gohm, T5.resistivity[category].good, T5.resistivity[category].poor, "ge", "GΩ·m",
      ` — quy đổi từ ${res}×10¹² Ω·cm`);
  }
  const ift = oilExtNum(extra, "ift_mnm");
  if (ift !== null) {
    if (isNew) pass("Sức căng bề mặt (IFT)", "ift", ift, T3.ift, "ge", "mN/m");
    else {
      const t = inhibited === "uninhibited" ? T5.ift.uninhibited : T5.ift.inhibited;
      tier("Sức căng bề mặt (IFT)", "ift", ift, t.good, t.poor, "ge", "mN/m",
        inhibited === "uninhibited" ? " — dầu không ức chế" : inhibited === "inhibited" ? " — dầu có ức chế" : " — chưa chọn loại dầu, tạm dùng ngưỡng dầu có ức chế");
    }
  }
  const sulfur = extra && hasVal(extra.corrosive_sulfur) ? String(extra.corrosive_sulfur) : null;
  if (sulfur) {
    rows.push({
      key: "sulfur", label: "Lưu huỳnh ăn mòn", value: oilSelectLabel("corrosive_sulfur", sulfur), unit: "", direction: "le",
      limit: "Không ăn mòn", verdict: sulfur === "co" ? "Không đạt" : "Đạt", ref: isNew ? ref3 : ref5,
    });
  }
  const pcb = oilExtNum(extra, "pcb_mgkg");
  if (pcb !== null) {
    rows.push({
      key: "pcb", label: "Hàm lượng PCB", value: pcb, unit: "mg/kg", direction: "le", limit: "Không phát hiện (< " + T3.pcb + " mg/kg)",
      verdict: pcb < T3.pcb ? "Đạt" : "Không đạt", ref: (isNew ? ref3 : ref5) + " — có thể chịu quy định pháp luật về môi trường",
    });
  }
  if (!isNew) {
    [["sediment_percent", "sediment", "Cặn (sediment)", T5.sediment_max], ["sludge_percent", "sludge", "Bùn (sludge)", T5.sludge_max]].forEach(([f, k, label, max]) => {
      const v = oilExtNum(extra, f);
      if (v === null) return;
      rows.push({ key: k, label, value: v, unit: "%", direction: "le", limit: `< ${max}% (bỏ qua)`,
        verdict: v < Number(max) ? "Đạt" : "Không đạt", ref: ref5 + " — không phải thí nghiệm định kỳ" });
    });
    const inh = oilExtNum(extra, "inhibitor_pct_original");
    if (inh !== null) tier("Hàm lượng chất ức chế (so với ban đầu)", "inhibitor", inh, T5.inhibitor.good, T5.inhibitor.poor, "ge", "%", " — chỉ áp dụng dầu có ức chế");
    const pas = oilExtNum(extra, "passivator_mgkg");
    if (pas !== null) tier("Hàm lượng chất thụ động", "passivator", pas, T5.passivator.good, T5.passivator.poor, "ge", "mg/kg");
    const flash = oilExtNum(extra, "flash_point_c");
    if (flash !== null && prevFlashPoint !== null && prevFlashPoint !== undefined && Number(prevFlashPoint) > 0) {
      const dropPct = Math.round(((Number(prevFlashPoint) - flash) / Number(prevFlashPoint)) * 1000) / 10;
      rows.push({ key: "flash", label: "Nhiệt độ chớp cháy (mức giảm)", value: flash, unit: "°C", direction: "ge",
        limit: `Giảm < ${T5.flash_drop_pct}% so với lần trước (${prevFlashPoint}°C)`,
        verdict: dropPct < T5.flash_drop_pct ? "Đạt" : "Không đạt", ref: ref5 + ` — giảm ${dropPct > 0 ? dropPct : 0}%` });
    }
  }
  return rows;
}

/** Bảng 3 IEC 60422:2024 cho 3 chỉ tiêu cơ bản (dầu mới). */
function evaluateIec60422NewOilBase({ voltageClass, moisture, tgd90, bdv }) {
  const category = mapOilVoltageClassToIec60422Category(voltageClass);
  const L = IEC60422_2024_TABLE3_NEW[category];
  const ref = REGULATION_CITATIONS.IEC60422_2024_TABLE3_NEW + " — Category " + category;
  const rows = [];
  if (hasVal(moisture)) rows.push({ key: "moisture", label: "Độ ẩm dầu", value: Number(moisture), unit: "mg/kg (≈ppm)", direction: "le", limit: "≤ " + L.moisture, verdict: Number(moisture) <= L.moisture ? "Đạt" : "Không đạt", ref });
  if (hasVal(tgd90)) rows.push({ key: "tgd90", label: "Tổn hao điện môi tgδ (90°C)", value: Number(tgd90), unit: "%", direction: "le", limit: "≤ " + L.tgd90, verdict: Number(tgd90) <= L.tgd90 ? "Đạt" : "Không đạt", ref });
  if (hasVal(bdv)) rows.push({ key: "bdv", label: "Điện áp chọc thủng dầu", value: Number(bdv), unit: "kV", direction: "ge", limit: "≥ " + L.bdv, verdict: Number(bdv) >= L.bdv ? "Đạt" : "Không đạt", ref });
  return rows;
}

// ---------------------------------------------------------------------------
// 4) Tiện ích theo BẢN GHI đã lưu (dùng chung tab Lý-Hóa dầu, Lịch sử, Cảnh báo)
// ---------------------------------------------------------------------------

/** Các chỉ tiêu bổ sung đang có giá trị trên 1 bản ghi oil_tests. */
function oilExtraFromRecord(rec) {
  const o = {};
  OIL_EXT_FIELDS.forEach((f) => { if (rec && hasVal(rec[f])) o[f] = rec[f]; });
  return o;
}

/** Khóa chuỗi số liệu CÙNG 1 thùng dầu: Trạm + Thiết bị (bỏ khoảng trắng thừa, không phân biệt hoa/thường)
 *  + Pha (chỉ khi lấy mẫu riêng từng pha). */
function oilSeriesKey(rec) {
  const n = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  const sp = rec ? rec.oil_sample_point || rec.oltc_sample_point : "";
  const phase = sp === "pharieng" ? String(rec.phase || "").trim() : "";
  return `${n(rec && rec.tram)}|${n(rec && rec.thiet_bi)}|${phase}`;
}

/** Đánh giá 1 bản ghi dầu OLTC (oltc_oil_tests) — Điều 37: dầu MỚI như dầu thùng chính (đủ chỉ tiêu bổ sung),
 *  dầu VẬN HÀNH theo Bảng 49 (BDV, độ ẩm); chỉ tiêu bổ sung khi vận hành chỉ ghi nhận (xem evaluateOltcOilTest()). */
function evaluateOltcRecord(rec, manufacturerOilStandards, allRecords) {
  return evaluateOltcOilTest({
    oltcSamplePoint: rec.oltc_sample_point, voltageClass: rec.voltage_class, oilState: rec.oil_state,
    hasMembraneN2: rec.has_membrane_n2, manufacturer: rec.manufacturer || null, manufacturerOilStandards,
    moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
    extra: oilExtraFromRecord(rec), prevFlashPoint: findPreviousOilFlashPoint(allRecords, rec), oxMethod: rec.ox_method || "",
  });
}

/** Nhiệt độ chớp cháy của lần thí nghiệm LIỀN TRƯỚC (ngày lấy mẫu nhỏ hơn hẳn) cùng thùng dầu — Điều 51
 *  ("trong vận hành không được giảm quá 5°C"). null nếu chưa có. */
function findPreviousOilFlashPoint(records, rec) {
  if (!rec || !rec.sample_date) return null;
  const key = oilSeriesKey(rec);
  const t = new Date(rec.sample_date).getTime();
  let best = null;
  (records || []).forEach((r) => {
    if (r === rec || (rec.id && r.id === rec.id)) return;
    if (!hasVal(r.flash_point_c) || oilSeriesKey(r) !== key) return;
    const rt = new Date(r.sample_date).getTime();
    if (!(rt < t)) return;
    if (!best || rt > best.t) best = { t: rt, v: Number(r.flash_point_c) };
  });
  return best ? best.v : null;
}

/** Đánh giá QĐ1901 cho 1 bản ghi oil_tests (3 chỉ tiêu cơ bản + chỉ tiêu bổ sung). */
function evaluateOilRecord(rec, manufacturerOilStandards, allRecords) {
  return evaluateOilTest({
    voltageClass: rec.voltage_class, oilState: rec.oil_state, hasMembraneN2: rec.has_membrane_n2,
    manufacturer: rec.manufacturer || null, manufacturerOilStandards,
    moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
    extra: oilExtraFromRecord(rec), prevFlashPoint: findPreviousOilFlashPoint(allRecords, rec), oxMethod: rec.ox_method || "",
  });
}

/** Đánh giá tham khảo IEC 60422:2024 cho 1 bản ghi oil_tests. */
function evaluateIec60422OilRecord(rec, allRecords) {
  return evaluateIec60422MbaOilTest({
    voltageClass: rec.voltage_class, oilState: rec.oil_state,
    moisture: rec.moisture_ppm, tgd90: rec.tgd_90c_percent, bdv: rec.bdv_kv,
    extra: oilExtraFromRecord(rec), prevFlashPoint: findPreviousOilFlashPoint(allRecords, rec), inhibited: rec.oil_inhibited || "",
  });
}

/** Kết luận chung từ danh sách dòng: bỏ qua dòng "Không có ngưỡng"; xấu nhất thắng. */
function oilOverallFromRows(rows) {
  const judged = rows.filter((r) => r.verdict === "Đạt" || r.verdict === "Không đạt" || r.verdict === "Cảnh báo");
  if (judged.length === 0) return "Chưa đủ dữ liệu";
  if (judged.some((r) => r.verdict === "Không đạt")) return "Không đạt";
  if (judged.some((r) => r.verdict === "Cảnh báo")) return "Cảnh báo";
  return "Đạt";
}

// ===== src/domain/dga-logic-forecast.js =====
/* dga-logic-forecast.js — Phần 5/6 của dga-logic.js sau khi tách theo miền (xem
   dga-logic.js). Dự báo xu hướng khí theo các mô hình thống kê CHUẨN:
     (1) Hồi quy tuyến tính OLS — kèm sai số chuẩn, kiểm định t cho độ dốc và KHOẢNG DỰ BÁO 95%
         (Student t, n − 2 bậc tự do);
     (2) Ước lượng độ dốc Sen (Theil–Sen) + kiểm định xu hướng Mann–Kendall (phi tham số, có hiệu
         chỉnh giá trị trùng) — cặp phương pháp tiêu chuẩn cho chuỗi số liệu giám sát lấy mẫu không
         đều, ít điểm, có điểm bất thường (Sen 1968; Mann 1945; Kendall 1975; Gilbert 1987);
     (3) Độ dốc Sen + Mann–Kendall trên GIAI ĐOẠN GẦN ĐÂY (cửa sổ: các lần đo trong
         FORECAST_RECENT_YEARS năm gần nhất, nhưng tối thiểu FORECAST_RECENT_MIN_N lần đo) — phát hiện
         tốc độ sinh khí đang thay đổi mà độ dốc toàn chuỗi phản ứng chậm. Tốc độ giữa 2 lần đo liền kề
         (Bảng 65 Điều 54 QĐ1901) là chỉ số CHẨN ĐOÁN, không dùng để ngoại suy: chỉ 2 điểm nên sai số đo
         khuếch đại theo 1/Δt và không có kiểm định — xem tab Lịch sử (So sánh 2 lần đo).
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
const FORECAST_MK_MIN_N = 4; // Mann–Kendall: dưới 4 điểm → "chưa đủ dữ liệu"
// Cửa sổ "giai đoạn gần đây": mọi lần đo trong 3 năm gần nhất (≈ 1 chu kỳ 3 năm của Điều 3 QĐ1901),
// nhưng không ít hơn 5 lần đo — n = 5 là cỡ mẫu nhỏ nhất để Mann–Kendall hai phía có thể đạt
// p < 0,05 (n = 4 đơn điệu hoàn toàn: S = 6, p ≈ 0,089).
const FORECAST_RECENT_YEARS = 3;
const FORECAST_RECENT_MIN_N = 5;

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

// ---------------------------- (3) Cửa sổ giai đoạn gần đây -------------------
/** Chỉ số đầu của cửa sổ "giai đoạn gần đây" trên chuỗi ĐÃ sắp theo x (đơn vị ngày): lần đo đầu tiên
 *  trong FORECAST_RECENT_YEARS năm tính tới lần đo cuối, lùi thêm nếu cần để có ≥ FORECAST_RECENT_MIN_N
 *  lần đo. Trả về 0 khi cửa sổ trùm cả chuỗi (khi đó không tách được giai đoạn gần). */
function recentWindowStart(points, years = FORECAST_RECENT_YEARS, minN = FORECAST_RECENT_MIN_N) {
  const n = points.length;
  if (n === 0) return 0;
  const fromX = points[n - 1].x - years * FORECAST_DAYS_PER_YEAR;
  let start = points.findIndex((p) => p.x >= fromX);
  if (start < 0) start = n - 1;
  return Math.max(0, Math.min(start, n - minN));
}

const FORECAST_METHOD_LABELS = {
  ols: "Hồi quy tuyến tính OLS (khoảng dự báo 95%)",
  sen: "Độ dốc Sen + kiểm định Mann–Kendall",
  recent: "Độ dốc Sen + Mann–Kendall — giai đoạn gần đây",
};

/**
 * Dự báo xu hướng 1 thông số (khí) theo 3 phương pháp (FORECAST_METHOD_LABELS); "recent" chỉ có khi
 * cửa sổ gần đây ngắn hơn cả chuỗi.
 * @param {Array<{date: string|Date, value: number|string|null|undefined}>} history (không cần sắp sẵn;
 *   điểm rỗng/không phải số/ngày sai bị loại)
 * @param {number} forecastYears số năm ngoại suy (vd 3)
 * @param {number|null} limit ngưỡng đang áp dụng (null nếu không có)
 * @returns {object} { ok:false, reason, n } hoặc
 *   { ok:true, n, lastValue, lastDate, limit, trend (kết quả Mann–Kendall), methods:{ols, sen, recent},
 *     recentWindow: {n, fromDate} | null, rateChange: "faster"|"slower"|"consistent"|null (tốc độ giai đoạn
 *     gần so với KTC 95% tốc độ Sen toàn chuỗi; null khi thiếu "recent" hoặc KTC) }
 *   — mỗi method (null nếu không tính được): { label, ratePerYear, fittedAtLast (giá trị của mô hình tại
 *   lần đo gần nhất — điểm đầu đường dự báo trên đồ thị), forecastValue (≥ 0), clamped,
 *   forecastDate, interval ({lower, upper} — OLS: khoảng dự báo 95% của giá trị; Sen: khoảng tin
 *   cậy 95% của tốc độ ppm/năm; null nếu không tính được), r2 (chỉ OLS), pValue (OLS: kiểm định t
 *   độ dốc; Sen/recent: Mann–Kendall), significant (p < α; null khi n < 4), crossing }
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
  if (!ols && !sen) return { ok: false, reason: "same_date", n: pts.length };

  const hasLimit = limit !== null && limit !== undefined && Number.isFinite(Number(limit));
  const limitNum = hasLimit ? Number(limit) : null;

  // Thời điểm đạt ngưỡng theo 1 ĐƯỜNG y = a + b·x (đường khớp của OLS/Sen). Đã vượt ngưỡng xét theo GIÁ TRỊ ĐO THỰC TẾ gần nhất.
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

  const methods = { ols: null, sen: null, recent: null };
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
  function senMethod(label, est, test) {
    const raw = est.intercept + est.slope * horizonX;
    const significant = test.direction === "insufficient" ? null : test.p < FORECAST_ALPHA;
    return {
      label,
      ratePerYear: est.slope * FORECAST_DAYS_PER_YEAR,
      fittedAtLast: clamp0(est.intercept + est.slope * lastX),
      forecastValue: clamp0(raw),
      clamped: raw < 0,
      forecastDate,
      interval: est.lower === null ? null
        : { lower: est.lower * FORECAST_DAYS_PER_YEAR, upper: est.upper * FORECAST_DAYS_PER_YEAR },
      r2: null,
      pValue: test.direction === "insufficient" ? null : test.p,
      significant,
      crossing: crossingFor(est.intercept, est.slope, significant),
    };
  }
  if (sen) methods.sen = senMethod(FORECAST_METHOD_LABELS.sen, sen, mk);

  let recentWindow = null;
  let rateChange = null;
  const start = recentWindowStart(xy);
  if (start > 0) {
    const win = xy.slice(start);
    const mkR = mannKendallTest(win);
    const senR = senSlopeEstimate(win, mkR.varS);
    if (senR) {
      methods.recent = senMethod(FORECAST_METHOD_LABELS.recent, senR, mkR);
      recentWindow = { n: win.length, fromDate: pts[start].date.toISOString() };
      const ci = methods.sen && methods.sen.interval;
      if (ci) {
        const r = methods.recent.ratePerYear;
        rateChange = r > ci.upper ? "faster" : r < ci.lower ? "slower" : "consistent";
      }
    }
  }

  return {
    ok: true,
    n: pts.length,
    lastValue: lastPoint.value,
    lastDate: lastPoint.date.toISOString(),
    limit: limitNum,
    trend: mk,
    methods,
    recentWindow,
    rateChange,
  };
}

// ===== src/domain/dga-logic-regulation-config.js =====
/* dga-logic-regulation-config.js — Phần 6/6 của dga-logic.js sau khi tách theo miền
   (xem dga-logic.js). Đăng ký + đọc/ghi đè các bảng ngưỡng "đơn giản" có thể cấu hình
   qua tab "Cấu hình" — mục "Quy định" (src/presentation/tabs/ui-regulation-config.js), KHÔNG bao gồm
   logic rẽ nhánh (Bảng 66/Table A.10/Tam giác Duval — cố định theo văn bản gốc). Mỗi
   mục registry giữ tham chiếu TRỰC TIẾP tới 1 object hằng số khai báo ở
   dga-logic-core.js — sửa qua applyRegulationConfigOverride() là ghi đè property của
   CHÍNH object đó, mọi hàm ở các module khác tự động thấy giá trị mới mà không cần
   sửa lại bản thân các hàm đó. */

// ---------------------------------------------------------------------------
// 9) Cấu hình quy định (regulation config) — làm các bảng ngưỡng ĐƠN GIẢN ở trên (không
//    có logic rẽ nhánh phức tạp) có thể XEM/SỬA qua giao diện (mục "Quy định" trong tab
//    "Cấu hình", xem src/presentation/tabs/ui-regulation-config.js), để khi QĐ1901/IEC 60599 có bản cập nhật trong
//    tương lai, người dùng KHÔNG cần sửa code — chỉ cần sửa số + tham chiếu nguồn qua
//    giao diện. Từ 11/2026 gồm cả NGƯỠNG SỐ của các logic rẽ nhánh: Bảng 66/Table 1
//    (diagnoseRatios()), bảng PD/D/T, Table A.10 sứ xuyên (diagnoseBushingRatios()), ranh giới
//    Tam giác Duval (classifyDuval1() — Bảng 67), C2H2/H2 nhiễm khí OLTC, tỷ lệ bổ sung CO2/CO,
//    O2/N2 — chỉ CON SỐ sửa được, cấu trúc rẽ nhánh/dấu so sánh giữ đúng văn bản gốc. Không
//    đưa vào: các enum thuần key/nhãn (EQUIPMENT_TYPES/MBA_SUBTYPES/INSTRUMENT_SUBTYPES).
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
 *  từ giá trị các ô nhập trên form (xem src/presentation/tabs/ui-regulation-config.js). */
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

// ---------------------------------------------------------------------------
// 10) TÊN VĂN BẢN / ĐIỀU KHOẢN / BẢNG / PHỤ LỤC hiển thị — cấu hình được để khi quy định hoặc
//     tiêu chuẩn thay đổi (QĐ mới thay QĐ1901, IEC 60599 bản mới, đánh số lại điều/bảng...) Admin
//     cập nhật 1 lần, mọi nơi hiển thị đổi theo — KHÔNG phải sửa hàng trăm câu chữ trong code.
//
//     Cơ chế: applyRegulationTerms(text) thay các cụm MẶC ĐỊNH (VD "Bảng 66") bằng giá trị đang
//     cấu hình (VD "Bảng 70"), 1 lượt duy nhất, khớp đúng ranh giới từ ("Bảng 6" không ăn vào
//     "Bảng 66"). Chỉ áp dụng các mục ĐÃ ĐỔI khác mặc định -> chưa đổi gì thì văn bản giữ nguyên.
//     Áp dụng ở: giao diện (src/presentation/components/ui-terms.js quét toàn trang + nội dung sinh động), file Word xuất ra.
// ---------------------------------------------------------------------------
const REGULATION_TERMS_DOCS = {
  QD_FULL: "QĐ1901/QĐ-EVNNPT",
  QD_SHORT: "QĐ1901",
  IEC60599_NAME: "IEC 60599",
  IEC60599_YEAR: "2022",
  IEC60422_NAME: "IEC 60422",
  IEC60422_YEAR: "2024",
  IEEE_C57104: "IEEE C57.104",
  QD_SAMPLING: "3856/QĐ-PTC3",
};

const REGULATION_TERMS_QD_ARTICLE_NUMS = [3, 6, 7, 10, 11, 37, 46, 47, 50, 54];
const REGULATION_TERMS_QD_TABLE_NUMS = [12, 49, 54, 55, 58, 63, 64, 65, 66, 67, 68, 69];
const REGULATION_TERMS_QD = {};
REGULATION_TERMS_QD_ARTICLE_NUMS.forEach((n) => { REGULATION_TERMS_QD["D" + n] = "Điều " + n; });
REGULATION_TERMS_QD_TABLE_NUMS.forEach((n) => { REGULATION_TERMS_QD["B" + n] = "Bảng " + n; });

const REGULATION_TERMS_IEC_DEFS = [
  ["T1", "Table 1", "IEC 60599 — Bảng diễn giải 3 tỷ số khí (= Bảng 66)"],
  ["T2", "Table 2", "IEC 60599 — Bảng đơn giản PD/D/T"],
  ["TA2", "Table A.2", "IEC 60599 — Khoảng điển hình MBA lực"],
  ["TA7", "Table A.7", "IEC 60599 — Khoảng điển hình CT/VT"],
  ["TA8", "Table A.8", "IEC 60599 — Giá trị tối đa máy biến áp đo lường"],
  ["TA10", "Table A.10", "IEC 60599 — Chẩn đoán sứ xuyên"],
  ["TA11", "Table A.11", "IEC 60599 — Khoảng điển hình sứ xuyên"],
  ["ANNEX_A", "Annex A", "IEC 60599 — Phụ lục A"],
  ["ANNEX_B", "Annex B", "IEC 60599 — Phụ lục B (Tam giác Duval)"],
  ["FIG_B3", "Figure B.3", "IEC 60599 — Hình Tam giác Duval 1"],
  ["FIG_1", "Hình 1", "IEC 60599 — Lưu đồ đánh giá (mục 9)"],
  ["T60422_5", "Bảng 5", "IEC 60422 — Dầu MBA/Kháng vận hành"],
  ["T60422_7", "Bảng 7", "IEC 60422 — Dầu TI/TU vận hành"],
];
const REGULATION_TERMS_IEC = {};
REGULATION_TERMS_IEC_DEFS.forEach(([k, v]) => { REGULATION_TERMS_IEC[k] = v; });

function termsEscapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
}

/** Danh sách luật thay thế: { pats: [cụm mặc định...], out: giá trị hiện hành, def: giá trị mặc định }. */
function regulationTermRules() {
  const D = REGULATION_TERMS_DOCS, Q = REGULATION_TERMS_QD, I = REGULATION_TERMS_IEC;
  const d0 = _regulationConfigDefaults.TERMS_DOCS.values;
  const rules = [
    { pats: ["QĐ1901/QĐ-EVNNPT", "QĐ 1901/QĐ-EVNNPT"], out: D.QD_FULL, def: d0.QD_FULL },
    { pats: ["QĐ1901", "QĐ 1901"], out: D.QD_SHORT, def: d0.QD_SHORT },
    { pats: [`IEC 60599:${d0.IEC60599_YEAR}`, `IEC60599:${d0.IEC60599_YEAR}`, `IEC 60599-${d0.IEC60599_YEAR}`, `IEC60599-${d0.IEC60599_YEAR}`],
      out: `${D.IEC60599_NAME}:${D.IEC60599_YEAR}`, def: `${d0.IEC60599_NAME}:${d0.IEC60599_YEAR}` },
    { pats: ["IEC 60599", "IEC60599"], out: D.IEC60599_NAME, def: d0.IEC60599_NAME },
    { pats: [`IEC 60422:${d0.IEC60422_YEAR}`, `IEC60422:${d0.IEC60422_YEAR}`],
      out: `${D.IEC60422_NAME}:${D.IEC60422_YEAR}`, def: `${d0.IEC60422_NAME}:${d0.IEC60422_YEAR}` },
    { pats: ["IEC 60422", "IEC60422"], out: D.IEC60422_NAME, def: d0.IEC60422_NAME },
    { pats: ["IEEE C57.104"], out: D.IEEE_C57104, def: d0.IEEE_C57104 },
    { pats: ["3856/QĐ-PTC3"], out: D.QD_SAMPLING, def: d0.QD_SAMPLING },
  ];
  const q0 = _regulationConfigDefaults.TERMS_QD_ARTICLES.values;
  Object.keys(q0).forEach((k) => rules.push({ pats: [q0[k]], out: Q[k], def: q0[k] }));
  const i0 = _regulationConfigDefaults.TERMS_IEC.values;
  Object.keys(i0).forEach((k) => rules.push({ pats: [i0[k]], out: I[k], def: i0[k] }));
  return rules;
}

let _termsCache = { sig: null, re: null, map: null };

/** Biên dịch (và lưu đệm) regex cho các luật ĐANG ĐỔI khác mặc định; null nếu không có gì đổi. */
function compiledRegulationTerms() {
  const active = regulationTermRules().filter((r) => typeof r.out === "string" && r.out.trim() !== "" && r.out !== r.def);
  const sig = JSON.stringify(active.map((r) => [r.pats, r.out]));
  if (_termsCache.sig === sig) return _termsCache;
  if (active.length === 0) {
    _termsCache = { sig, re: null, map: null };
    return _termsCache;
  }
  const entries = [];
  active.forEach((r) => r.pats.forEach((p) => entries.push({ p, out: r.out, test: new RegExp("^" + termsEscapeRe(p) + "$", "u") })));
  entries.sort((a, b) => b.p.length - a.p.length); // cụm dài khớp trước (VD "IEC 60599:2022" trước "IEC 60599")
  const tail = (p) => (/[\p{L}]$/u.test(p) ? "(?![\\p{L}\\p{N}])" : "(?!\\p{N})");
  const body = entries.map((e) => "(?<![\\p{L}\\p{N}])" + termsEscapeRe(e.p) + tail(e.p)).join("|");
  _termsCache = { sig, re: new RegExp(body, "gu"), map: entries };
  return _termsCache;
}

/** Thay tên văn bản/điều/bảng mặc định bằng giá trị Admin đã cấu hình. Không đổi gì -> trả nguyên văn. */
function applyRegulationTerms(text) {
  if (typeof text !== "string" || text === "") return text;
  const c = compiledRegulationTerms();
  if (!c.re) return text;
  return text.replace(c.re, (m) => {
    const e = c.map.find((x) => x.test.test(m));
    return e ? e.out : m;
  });
}

/** Có tên nào đang được đổi khác mặc định không (để giao diện bỏ qua việc quét khi không cần). */
function regulationTermsActive() {
  return !!compiledRegulationTerms().re;
}

/** applyRegulationTerms() cho MỌI chuỗi trong 1 giá trị lồng nhau (object/mảng) — dùng cho dữ liệu điền mẫu BBTN/báo cáo
 *  (src/data/io/*-export.js). Không có tên nào đổi khác mặc định → trả NGUYÊN giá trị (không sao chép). */
function applyRegulationTermsDeep(value) {
  if (!regulationTermsActive()) return value;
  if (typeof value === "string") return applyRegulationTerms(value);
  if (Array.isArray(value)) return value.map(applyRegulationTermsDeep);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = applyRegulationTermsDeep(value[k]); });
    return out;
  }
  return value;
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
        GASES.map((g) => ({ path: [subtype, g], label: `${subtype.replace(/CPC/g, "OLTC")} — ${g}`, unit: "ppm", kind: "number" }))
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
      key: "BANG64_MBA_LOW", category: "MBA/Kháng dầu — Khí hòa tan (khoảng điển hình, lưu đồ Điều 54)",
      title: "QĐ1901 Bảng 64 — Cận DƯỚI khoảng giá trị điển hình (MBA): tất cả khí thấp hơn -> kiểm tra lỗi lấy mẫu/đo lường/xử lý dầu",
      citationKey: "BANG64_MBA_LOW", target: QD1901_BANG64_MBA_LOW, fields: gasMapFields("ppm"),
    },
    {
      key: "BANG66_TABLE1", category: "Chẩn đoán tỷ số khí — Bảng 66 (= Table 1 IEC 60599)",
      title: "QĐ1901 Bảng 66 / IEC 60599 Table 1 — Ngưỡng 3 tỷ số khí xác định mã PD, D1, D2, T1, T2, T3 (ngưỡng CH4/H2 của PD: xem bảng \"Ngưỡng CH4/H2 ... PD\")",
      citationKey: "BANG66_TABLE1", target: QD1901_BANG66_TABLE1,
      fields: [
        { path: ["PD", "i_max"], label: "PD — C2H4/C2H6 nhỏ hơn", unit: "", kind: "number" },
        { path: ["D1", "g_min"], label: "D1 — C2H2/C2H4 lớn hơn", unit: "", kind: "number" },
        { path: ["D1", "h_min"], label: "D1 — CH4/H2 từ", unit: "", kind: "number" },
        { path: ["D1", "h_max"], label: "D1 — CH4/H2 đến", unit: "", kind: "number" },
        { path: ["D1", "i_min"], label: "D1 — C2H4/C2H6 lớn hơn", unit: "", kind: "number" },
        { path: ["D2", "g_min"], label: "D2 — C2H2/C2H4 từ", unit: "", kind: "number" },
        { path: ["D2", "g_max"], label: "D2 — C2H2/C2H4 đến", unit: "", kind: "number" },
        { path: ["D2", "h_min"], label: "D2 — CH4/H2 từ", unit: "", kind: "number" },
        { path: ["D2", "h_max"], label: "D2 — CH4/H2 đến", unit: "", kind: "number" },
        { path: ["D2", "i_min"], label: "D2 — C2H4/C2H6 lớn hơn", unit: "", kind: "number" },
        { path: ["T1", "h_min"], label: "T1 — CH4/H2 lớn hơn", unit: "", kind: "number" },
        { path: ["T1", "i_max"], label: "T1 — C2H4/C2H6 nhỏ hơn", unit: "", kind: "number" },
        { path: ["T2", "g_max"], label: "T2 — C2H2/C2H4 nhỏ hơn", unit: "", kind: "number" },
        { path: ["T2", "h_min"], label: "T2 — CH4/H2 lớn hơn", unit: "", kind: "number" },
        { path: ["T2", "i_min"], label: "T2 — C2H4/C2H6 từ", unit: "", kind: "number" },
        { path: ["T2", "i_max"], label: "T2 — C2H4/C2H6 đến", unit: "", kind: "number" },
        { path: ["T3", "g_max"], label: "T3 — C2H2/C2H4 nhỏ hơn", unit: "", kind: "number" },
        { path: ["T3", "h_min"], label: "T3 — CH4/H2 lớn hơn", unit: "", kind: "number" },
        { path: ["T3", "i_min"], label: "T3 — C2H4/C2H6 lớn hơn", unit: "", kind: "number" },
      ],
    },
    {
      key: "BANG66_PDT", category: "Chẩn đoán tỷ số khí — Bảng 66 (= Table 1 IEC 60599)",
      title: "QĐ1901 Điều 54 — Bảng đơn giản PD / D / T (khi tỷ số không nằm trong giới hạn Bảng 66)",
      citationKey: "BANG66_PDT", target: QD1901_BANG66_PDT,
      fields: [
        { path: ["pd_h_max"], label: "PD — CH4/H2 nhỏ hơn", unit: "", kind: "number" },
        { path: ["dt_g"], label: "Ranh giới D / T — C2H2/C2H4 (lớn hơn: D, nhỏ hơn: T)", unit: "", kind: "number" },
      ],
    },
    {
      key: "IEC_A10_BUSHING", category: "Sứ xuyên (Bushing) — Chẩn đoán tỷ số khí",
      title: "IEC 60599:2022 Annex A.5.3 Table A.10 — Ngưỡng tỷ số khí chẩn đoán sứ xuyên",
      citationKey: "IEC_A10_BUSHING", target: IEC_A10_BUSHING_RATIOS,
      fields: [
        { path: ["pd_h_max"], label: "PD — CH4/H2 nhỏ hơn", unit: "", kind: "number" },
        { path: ["d_g_min"], label: "D — C2H2/C2H4 lớn hơn", unit: "", kind: "number" },
        { path: ["t_i_min"], label: "T — C2H4/C2H6 lớn hơn", unit: "", kind: "number" },
        { path: ["tp_low"], label: "TP — CO2/CO nhỏ hơn", unit: "", kind: "number" },
        { path: ["tp_high"], label: "TP — hoặc CO2/CO lớn hơn", unit: "", kind: "number" },
      ],
    },
    {
      key: "BANG67_DUVAL", category: "Chẩn đoán — Tam giác Duval 1 (Bảng 67)",
      title: "QĐ1901 Bảng 67 — Giới hạn các vùng lỗi Tam giác Duval 1 (% trên tổng CH4 + C2H4 + C2H2)",
      citationKey: "BANG67_DUVAL", target: QD1901_BANG67_DUVAL,
      fields: [
        { path: ["pd_ch4"], label: "PD — %CH4 từ", unit: "%", kind: "number" },
        { path: ["t_c2h2"], label: "T1, T2 — %C2H2 không quá", unit: "%", kind: "number" },
        { path: ["t1_c2h4"], label: "T1 / T2 — ranh giới %C2H4", unit: "%", kind: "number" },
        { path: ["t2_c2h4"], label: "T2 / T3 — ranh giới %C2H4", unit: "%", kind: "number" },
        { path: ["t3_c2h2"], label: "T3 — %C2H2 không quá", unit: "%", kind: "number" },
        { path: ["d_c2h2"], label: "D1, D2 — %C2H2 từ", unit: "%", kind: "number" },
        { path: ["d1_c2h4"], label: "D1 / D2 — ranh giới %C2H4", unit: "%", kind: "number" },
        { path: ["d2_c2h4"], label: "D2 / D+T — ranh giới %C2H4", unit: "%", kind: "number" },
        { path: ["d2_c2h2"], label: "D2 / D+T — ranh giới %C2H2", unit: "%", kind: "number" },
      ],
    },
    {
      key: "DIEU54_OLTC", category: "MBA/Kháng dầu — Kiểm tra nhiễm khí từ OLTC (lưu đồ Điều 54)",
      title: "QĐ1901 Điều 54 — Tỷ lệ C2H2/H2 nghi nhiễm khí từ OLTC (văn bản: \"> 2 - 3\")",
      citationKey: "DIEU54_OLTC", target: DIEU54_OLTC_C2H2_H2,
      fields: [
        { path: ["possible"], label: "C2H2/H2 lớn hơn — có thể nhiễm khí OLTC", unit: "", kind: "number" },
        { path: ["likely"], label: "C2H2/H2 lớn hơn — nghi ngờ rõ nhiễm khí OLTC", unit: "", kind: "number" },
      ],
    },
    {
      key: "DIEU54_ADDITIONAL", category: "Đánh giá các tỷ lệ bổ sung (Điều 54) — áp dụng cho mọi dầu",
      title: "QĐ1901 Điều 54 — Ngưỡng tỷ lệ bổ sung CO2/CO và O2/N2",
      citationKey: "DIEU54_ADDITIONAL", target: DIEU54_ADDITIONAL_RATIOS,
      fields: [
        { path: ["co2co_low"], label: "Carbon hóa giấy — CO2/CO nhỏ hơn", unit: "", kind: "number" },
        { path: ["co_min"], label: "Carbon hóa giấy — và CO lớn hơn", unit: "ppm", kind: "number" },
        { path: ["co2co_high"], label: "Quá nhiệt nhẹ / oxy hóa dầu — CO2/CO lớn hơn", unit: "", kind: "number" },
        { path: ["co2_min"], label: "Quá nhiệt nhẹ / oxy hóa dầu — và CO2 lớn hơn", unit: "ppm", kind: "number" },
        { path: ["o2n2_low"], label: "Tiêu thụ oxy quá mức — O2/N2 nhỏ hơn", unit: "", kind: "number" },
        { path: ["o2n2_normal"], label: "Mốc tham khảo bình thường — O2/N2 khoảng", unit: "", kind: "number" },
      ],
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
        { path: ["pharieng", "110", "bdv"], label: "Một pha/không trung tính, 110kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "110", "moisture"], label: "Một pha/không trung tính, 110kV — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "220", "bdv"], label: "Một pha/không trung tính, 220kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "220", "moisture"], label: "Một pha/không trung tính, 220kV — Hàm lượng nước", unit: "ppm", kind: "number" },
        { path: ["pharieng", "500", "bdv"], label: "Một pha/không trung tính, 500kV — Điện áp chọc thủng", unit: "kV", kind: "number" },
        { path: ["pharieng", "500", "moisture"], label: "Một pha/không trung tính, 500kV — Hàm lượng nước", unit: "ppm", kind: "number" },
      ],
    },
    {
      key: "IEC60422_2024_TABLE5_MBA", category: "Dầu MBA/Kháng — IEC 60422:2024 (tham khảo, song song QĐ1901)",
      title: "IEC 60422:2024 Bảng 5 — Ngưỡng Tốt/Kém dầu MBA/Kháng vận hành, theo Category A/B/C",
      citationKey: "IEC60422_2024_TABLE5_MBA", target: IEC60422_2024_TABLE5_MBA,
      fields: ["A", "B", "C"].flatMap((cat) => [
        { path: [cat, "bdv", "good"], label: `Category ${cat} — Điện áp chọc thủng, biên "Tốt" (≥)`, unit: "kV", kind: "number" },
        { path: [cat, "bdv", "poor"], label: `Category ${cat} — Điện áp chọc thủng, biên "Kém" (<)`, unit: "kV", kind: "number" },
        { path: [cat, "moisture", "good"], label: `Category ${cat} — Độ ẩm dầu, biên "Tốt" (≤)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "moisture", "poor"], label: `Category ${cat} — Độ ẩm dầu, biên "Kém" (>)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "tgd90", "good"], label: `Category ${cat} — tgδ 90°C, biên "Tốt" (≤)`, unit: "%", kind: "number" },
        { path: [cat, "tgd90", "poor"], label: `Category ${cat} — tgδ 90°C, biên "Kém" (>)`, unit: "%", kind: "number" },
      ]),
    },
    {
      key: "IEC60422_2024_TABLE7_TITU", category: "Dầu TI/TU — IEC 60422:2024 (tham khảo, song song tiêu chuẩn NSX)",
      title: "IEC 60422:2024 Bảng 7 — Ngưỡng Tốt/Kém dầu TI/TU vận hành, theo Category D/E (Độ ẩm, tgδ 90°C — số liệu tường minh)",
      citationKey: "IEC60422_2024_TABLE7_TITU", target: IEC60422_2024_TABLE7_TITU,
      fields: ["D", "E"].flatMap((cat) => [
        { path: [cat, "moisture", "good"], label: `Category ${cat} — Độ ẩm dầu, biên "Tốt" (≤)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "moisture", "poor"], label: `Category ${cat} — Độ ẩm dầu, biên "Kém" (>)`, unit: "mg/kg", kind: "number" },
        { path: [cat, "tgd90", "good"], label: `Category ${cat} — tgδ 90°C, biên "Tốt" (≤)`, unit: "%", kind: "number" },
        { path: [cat, "tgd90", "poor"], label: `Category ${cat} — tgδ 90°C, biên "Kém" (>)`, unit: "%", kind: "number" },
      ]),
    },
    // ---- Chỉ tiêu lý-hóa dầu MBA bổ sung (dga-logic-oil-extended.js) ----
    {
      key: "BANG59_ACID", category: "Dầu MBA — Trị số axit",
      title: "QĐ1901 Bảng 59 — Trị số axit của dầu MBA (mgKOH/g), không lớn hơn",
      citationKey: "BANG59_ACID", target: BANG59_ACID,
      fields: [
        { path: ["new"], label: "Dầu mới — mọi cấp điện áp", unit: "mgKOH/g", kind: "number" },
        ...OIL_VOLTAGE_CLASSES.map((vc) => ({ path: ["inservice", vc.value], label: `${vc.label} — Đang vận hành`, unit: "mgKOH/g", kind: "number" })),
      ],
    },
    {
      key: "DIEU51_FLASH", category: "Dầu MBA — Nhiệt độ chớp cháy",
      title: "QĐ1901 Điều 51 — Nhiệt độ chớp cháy cốc kín (°C)",
      citationKey: "DIEU51_FLASH", target: DIEU51_FLASH,
      fields: [
        { path: ["new_min"], label: "Dầu mới — không thấp hơn", unit: "°C", kind: "number" },
        { path: ["max_drop"], label: "Dầu vận hành — mức giảm tối đa so với lần thí nghiệm trước", unit: "°C", kind: "number" },
      ],
    },
    {
      key: "BANG56_MECH", category: "Dầu MBA — Tạp chất cơ học",
      title: "QĐ1901 Bảng 56 — Hàm lượng tạp chất cơ học (%), không lớn hơn (đến 110 kV: quan sát bằng mắt)",
      citationKey: "BANG56_MECH", target: BANG56_MECH,
      fields: ["220", "500"].flatMap((vc) => ["new", "inservice"].map((st) => ({ path: [vc, st], label: `${vc} kV — ${OIL_STATE_LABELS[st]}`, unit: "%", kind: "number" }))),
    },
    {
      key: "BANG57_PARTICLES", category: "Dầu MBA — Đếm hạt tạp chất",
      title: "QĐ1901 Bảng 57 — Số lượng hạt tạp chất trong 1 ml dầu, không lớn hơn",
      citationKey: "BANG57_PARTICLES", target: BANG57_PARTICLES,
      fields: ["220", "500"].flatMap((vc) => [["p6", "> 6 μm"], ["p14", "> 14 μm"]].flatMap(([k, lb]) =>
        ["new", "inservice"].map((st) => ({ path: [vc, k, st], label: `${vc} kV — hạt ${lb} — ${OIL_STATE_LABELS[st]}`, unit: "hạt/ml", kind: "number" })))),
    },
    {
      key: "BANG70_RESISTIVITY", category: "Dầu MBA — Điện trở suất",
      title: "QĐ1901 Bảng 70 — Điện trở suất khối ở 90°C (×10¹² Ω·cm), không nhỏ hơn (để trống = không có số liệu)",
      citationKey: "BANG70_RESISTIVITY", target: BANG70_RESISTIVITY,
      fields: ["new", "inservice"].flatMap((st) => ["110", "220", "500"].map((vc) => ({ path: [st, vc], label: `${vc} kV — ${OIL_STATE_LABELS[st]}`, unit: "×10¹² Ω·cm", kind: "number" }))),
    },
    {
      key: "DIEU55_FURFURAL", category: "Dầu MBA — 2-furfural",
      title: "QĐ1901 Điều 55 — Hàm lượng 2-furfural (MBA ≥110 kV), không quá",
      citationKey: "DIEU55_FURFURAL", target: DIEU55_FURFURAL,
      fields: [{ path: ["max_ppm"], label: "Giá trị cho phép", unit: "ppm", kind: "number" }],
    },
    {
      key: "BANG60_62_OXIDATION", category: "Dầu MBA — Độ ổn định ôxi hóa (khi pha trộn dầu)",
      title: "QĐ1901 Bảng 60–62 — Cặn và trị số axit sau ôxi hóa, tgδ sau ôxi hóa — không lớn hơn",
      citationKey: "BANG60_62_OXIDATION", target: BANG60_62_OXIDATION,
      fields: Object.keys(BANG60_62_OXIDATION).flatMap((m) => [
        { path: [m, "sludge"], label: `${BANG60_62_OXIDATION[m].label} — Khối lượng cặn`, unit: "%", kind: "number" },
        { path: [m, "acid"], label: `${BANG60_62_OXIDATION[m].label} — Trị số axit`, unit: "mgKOH/g", kind: "number" },
        { path: [m, "tgd"], label: `${BANG60_62_OXIDATION[m].label} — tgδ 90°C (để trống = không quy định)`, unit: "", kind: "number" },
      ]),
    },
    {
      key: "IEC60422_2024_TABLE3_NEW", category: "Dầu MBA/Kháng — IEC 60422:2024 (tham khảo, song song QĐ1901)",
      title: "IEC 60422:2024 Bảng 3 — Dầu mới sau khi nạp vào thiết bị, trước khi đóng điện",
      citationKey: "IEC60422_2024_TABLE3_NEW", target: IEC60422_2024_TABLE3_NEW,
      fields: [
        ...["A", "B", "C"].flatMap((cat) => [
          { path: [cat, "bdv"], label: `Category ${cat} — Điện áp chọc thủng, tối thiểu`, unit: "kV", kind: "number" },
          { path: [cat, "moisture"], label: `Category ${cat} — Độ ẩm, tối đa`, unit: "mg/kg", kind: "number" },
          { path: [cat, "tgd90"], label: `Category ${cat} — tgδ 90°C, tối đa`, unit: "%", kind: "number" },
        ]),
        { path: ["common", "color"], label: "Màu sắc ISO 2049, tối đa", unit: "", kind: "number" },
        { path: ["common", "acid"], label: "Trị số axit, tối đa", unit: "mgKOH/g", kind: "number" },
        { path: ["common", "ift"], label: "Sức căng bề mặt, tối thiểu", unit: "mN/m", kind: "number" },
        { path: ["common", "pcb"], label: "PCB — ngưỡng phát hiện", unit: "mg/kg", kind: "number" },
      ],
    },
    {
      key: "IEC60422_2024_TABLE5_EXTRA", category: "Dầu MBA/Kháng — IEC 60422:2024 (tham khảo, song song QĐ1901)",
      title: "IEC 60422:2024 Bảng 5 — Chỉ tiêu bổ sung dầu vận hành (biên Tốt/Kém)",
      citationKey: "IEC60422_2024_TABLE5_MBA", target: IEC60422_2024_TABLE5_EXTRA,
      fields: [
        { path: ["color", "good"], label: "Màu sắc — biên Tốt (<)", unit: "", kind: "number" },
        { path: ["color", "poor"], label: "Màu sắc — biên Kém (>)", unit: "", kind: "number" },
        ...["A", "B", "C"].flatMap((cat) => [
          { path: ["acid", cat, "good"], label: `Category ${cat} — Trị số axit, biên Tốt (<)`, unit: "mgKOH/g", kind: "number" },
          { path: ["acid", cat, "poor"], label: `Category ${cat} — Trị số axit, biên Kém (>)`, unit: "mgKOH/g", kind: "number" },
          { path: ["resistivity", cat, "good"], label: `Category ${cat} — Điện trở suất 90°C, biên Tốt (>)`, unit: "GΩ·m", kind: "number" },
          { path: ["resistivity", cat, "poor"], label: `Category ${cat} — Điện trở suất 90°C, biên Kém (<)`, unit: "GΩ·m", kind: "number" },
        ]),
        { path: ["ift", "inhibited", "good"], label: "IFT dầu có ức chế — biên Tốt (>)", unit: "mN/m", kind: "number" },
        { path: ["ift", "inhibited", "poor"], label: "IFT dầu có ức chế — biên Kém (<)", unit: "mN/m", kind: "number" },
        { path: ["ift", "uninhibited", "good"], label: "IFT dầu không ức chế — biên Tốt (>)", unit: "mN/m", kind: "number" },
        { path: ["ift", "uninhibited", "poor"], label: "IFT dầu không ức chế — biên Kém (<)", unit: "mN/m", kind: "number" },
        { path: ["inhibitor", "good"], label: "Chất ức chế — biên Tốt (> % ban đầu)", unit: "%", kind: "number" },
        { path: ["inhibitor", "poor"], label: "Chất ức chế — biên Kém (< % ban đầu)", unit: "%", kind: "number" },
        { path: ["passivator", "good"], label: "Chất thụ động — biên Tốt (>)", unit: "mg/kg", kind: "number" },
        { path: ["passivator", "poor"], label: "Chất thụ động — biên Kém (<)", unit: "mg/kg", kind: "number" },
        { path: ["sediment_max"], label: "Cặn — bỏ qua nếu nhỏ hơn", unit: "%", kind: "number" },
        { path: ["sludge_max"], label: "Bùn — bỏ qua nếu nhỏ hơn", unit: "%", kind: "number" },
        { path: ["flash_drop_pct"], label: "Nhiệt độ chớp cháy — mức giảm tối đa", unit: "%", kind: "number" },
      ],
    },
    {
      key: "TERMS_DOCS", category: "Tên văn bản, điều khoản, bảng, phụ lục (hiển thị)",
      title: "Tên văn bản quy định / tiêu chuẩn và phiên bản — đổi ở đây, mọi nơi hiển thị cập nhật theo",
      citationKey: "TERMS_DOCS", target: REGULATION_TERMS_DOCS,
      fields: [
        { path: ["QD_FULL"], label: "Quy định — tên đầy đủ (mặc định QĐ1901/QĐ-EVNNPT)", unit: "", kind: "text" },
        { path: ["QD_SHORT"], label: "Quy định — tên viết tắt (mặc định QĐ1901)", unit: "", kind: "text" },
        { path: ["IEC60599_NAME"], label: "Tiêu chuẩn DGA — tên (mặc định IEC 60599)", unit: "", kind: "text" },
        { path: ["IEC60599_YEAR"], label: "Tiêu chuẩn DGA — phiên bản/năm (mặc định 2022)", unit: "", kind: "text" },
        { path: ["IEC60422_NAME"], label: "Tiêu chuẩn dầu — tên (mặc định IEC 60422)", unit: "", kind: "text" },
        { path: ["IEC60422_YEAR"], label: "Tiêu chuẩn dầu — phiên bản/năm (mặc định 2024)", unit: "", kind: "text" },
        { path: ["IEEE_C57104"], label: "Hướng dẫn IEEE (mặc định IEEE C57.104)", unit: "", kind: "text" },
        { path: ["QD_SAMPLING"], label: "Quy trình lấy mẫu dầu (mặc định 3856/QĐ-PTC3)", unit: "", kind: "text" },
      ],
    },
    {
      key: "TERMS_QD_ARTICLES", category: "Tên văn bản, điều khoản, bảng, phụ lục (hiển thị)",
      title: "Số hiệu điều khoản và bảng của quy định — khi quy định mới đánh số lại",
      citationKey: "TERMS_QD_ARTICLES", target: REGULATION_TERMS_QD,
      fields: [
        ...REGULATION_TERMS_QD_ARTICLE_NUMS.map((n) => ({ path: ["D" + n], label: `Điều ${n} (mặc định)`, unit: "", kind: "text" })),
        ...REGULATION_TERMS_QD_TABLE_NUMS.map((n) => ({ path: ["B" + n], label: `Bảng ${n} (mặc định)`, unit: "", kind: "text" })),
      ],
    },
    {
      key: "TERMS_IEC", category: "Tên văn bản, điều khoản, bảng, phụ lục (hiển thị)",
      title: "Số hiệu bảng, phụ lục, hình của tiêu chuẩn IEC — khi IEC ra bản mới đánh số lại",
      citationKey: "TERMS_IEC", target: REGULATION_TERMS_IEC,
      fields: REGULATION_TERMS_IEC_DEFS.map(([k, v, desc]) => ({ path: [k], label: `${v} — ${desc}`, unit: "", kind: "text" })),
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

// ---------------------------------------------------------------------------
// Kiểm tra THỨ TỰ HỢP LÝ giữa các ngưỡng của cùng 1 bảng (ngoài kiểm tra "không âm" chung ở
// giao diện) — tránh Admin nhập số làm logic rẽ nhánh/hình vẽ sai (VD "CH4/H2 từ 0,5 đến 0,1",
// ranh giới Duval chồng chéo). Trả về mảng thông báo lỗi tiếng Việt, rỗng nếu hợp lệ.
// ---------------------------------------------------------------------------
function rcRequireOrder(problems, pairs) {
  pairs.forEach(([a, b, msg, strict]) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    if (strict === false ? a > b : a >= b) problems.push(msg);
  });
  return problems;
}

const rcNonEmptyText = (v) => Object.keys(v).filter((k) => typeof v[k] !== "string" || v[k].trim() === "").map((k) => `Ô "${k}" không được để trống`);

const REGULATION_CONFIG_VALIDATORS = {
  TERMS_DOCS: rcNonEmptyText,
  TERMS_QD_ARTICLES: rcNonEmptyText,
  TERMS_IEC: rcNonEmptyText,
  BANG66_TABLE1: (v) => rcRequireOrder([], [
    [v.D1.h_min, v.D1.h_max, "D1: CH4/H2 \"từ\" phải nhỏ hơn \"đến\""],
    [v.D2.g_min, v.D2.g_max, "D2: C2H2/C2H4 \"từ\" phải nhỏ hơn \"đến\""],
    [v.D2.h_min, v.D2.h_max, "D2: CH4/H2 \"từ\" phải nhỏ hơn \"đến\""],
    [v.T2.i_min, v.T2.i_max, "T2: C2H4/C2H6 \"từ\" phải nhỏ hơn \"đến\""],
    [v.T2.i_max, v.T3.i_min, "T3: C2H4/C2H6 \"lớn hơn\" không được nhỏ hơn T2 \"đến\"", false],
    [v.T2.g_max, v.T3.g_max, "T3: C2H2/C2H4 \"nhỏ hơn\" không được nhỏ hơn của T2", false],
  ]),
  DIEU54_OLTC: (v) => rcRequireOrder([], [[v.possible, v.likely, "Ngưỡng \"nghi ngờ rõ\" không được nhỏ hơn ngưỡng \"có thể\"", false]]),
  DIEU54_ADDITIONAL: (v) => rcRequireOrder([], [[v.co2co_low, v.co2co_high, "CO2/CO: ngưỡng carbon hóa giấy phải nhỏ hơn ngưỡng quá nhiệt nhẹ"]]),
  IEC_A10_BUSHING: (v) => rcRequireOrder([], [[v.tp_low, v.tp_high, "TP: CO2/CO \"nhỏ hơn\" phải nhỏ hơn \"hoặc lớn hơn\""]]),
  BANG67_DUVAL: (v) => {
    const p = rcRequireOrder([], [
      [50, v.pd_ch4, "PD: %CH4 phải lớn hơn 50%"],
      [v.pd_ch4, 100, "PD: %CH4 phải nhỏ hơn 100%"],
      [100 - v.pd_ch4, v.t_c2h2, "Vùng PD phải nhỏ hơn dải T1/T2 (100 − %CH4 của PD < %C2H2 của T1, T2)"],
      [100 - v.pd_ch4, v.t1_c2h4, "Vùng PD phải nhỏ hơn T1 (100 − %CH4 của PD < ranh giới T1/T2)"],
      [v.t1_c2h4, v.t2_c2h4, "Ranh giới T1/T2 phải nhỏ hơn T2/T3 (%C2H4)"],
      [v.t_c2h2, v.d_c2h2, "%C2H2 của T1, T2 phải nhỏ hơn %C2H2 của D1, D2"],
      [v.t_c2h2, v.t3_c2h2, "%C2H2 của T1, T2 phải nhỏ hơn %C2H2 của T3"],
      [v.d_c2h2, v.d2_c2h2, "%C2H2 của D1, D2 phải nhỏ hơn ranh giới D2 / D+T (%C2H2)"],
      [v.t3_c2h2, v.d2_c2h2, "%C2H2 của T3 phải nhỏ hơn ranh giới D2 / D+T (%C2H2)"],
      [v.d1_c2h4, v.d2_c2h4, "Ranh giới D1/D2 phải nhỏ hơn D2 / D+T (%C2H4)"],
      [v.d2_c2h4, v.t2_c2h4, "Ranh giới D2 / D+T (%C2H4) không được lớn hơn T2/T3", false],
      [v.d_c2h2 + v.d1_c2h4, 100, "%C2H2 của D1 + ranh giới D1/D2 phải nhỏ hơn 100%"],
      [v.d2_c2h2 + v.d2_c2h4, 100, "%C2H2 + %C2H4 của ranh giới D2 / D+T phải nhỏ hơn 100%"],
    ]);
    return p;
  },
};

/** Lỗi thứ tự của 1 bảng (values = object đầy đủ của bảng, VD lấy từ form). [] nếu không có luật riêng. */
function validateRegulationConfigValues(key, values) {
  const fn = REGULATION_CONFIG_VALIDATORS[key];
  if (!fn || !values) return [];
  try {
    return fn(values);
  } catch (e) {
    return ["Thiếu giá trị — vui lòng điền đủ các ô của bảng"];
  }
}

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

// ===== src/domain/dga-logic-peer.js =====
// dga-logic-peer.js — Đề xuất người dùng #2: "Phát hiện bất thường theo nhóm thiết bị
// tương tự" (thống kê nhẹ, KHÔNG train/lưu model, chạy 100% phía client, không cần
// server ML riêng — đúng theo yêu cầu gốc của người dùng).
//
// BỔ SUNG một lớp so sánh "SO VỚI ĐÀN" (peer comparison) BÊN CẠNH đánh giá theo ngưỡng
// TUYỆT ĐỐI cố định đã có sẵn (Bảng 64/66/Annex A... ở dga-logic-gas.js/dga-logic-core.js)
// — KHÔNG thay thế, KHÔNG làm thay đổi overallStatus (Bình thường/Cảnh báo/Báo động)
// hay kết quả Đạt/Không đạt chính thức theo QĐ1901/IEC. Đây LUÔN LÀ THAM KHẢO BỔ SUNG —
// không được dùng để tự ý kết luận thay cho các bảng/ngưỡng chính thức (xem ghi chú ở
// evaluatePeerAnomaly() và cách renderPeerAnomaly() ở src/presentation/tabs/ui-dga.js hiển thị rõ nhãn này).
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
  // file logic độc lập, kiểm thử được qua Node như các file src/domain/dga-logic-*.js khác).
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
// Hàm chính — gọi ở src/presentation/tabs/ui-dga.js NGAY SAU khi đã có `all` (Storage.listMeasurements(),
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

// ===== src/domain/dga-logic-case.js =====
// dga-logic-case.js — Đề xuất người dùng #3: "Tìm ca tương tự trong lịch sử đo"
// (case-based reasoning nhẹ, KHÔNG train/lưu model, chạy 100% phía client) — bổ sung
// tiếp sau đề xuất #1 (OCR BBTN), #5 (OCR nameplate) và #2 (so với đàn) đã hoàn tất.
//
// Ý tưởng (theo đúng đề xuất người dùng): khi 1 lần đo có dấu hiệu bất thường, tự tìm
// trong TOÀN BỘ Lịch sử đo — CỦA THIẾT BỊ NÀY HOẶC THIẾT BỊ KHÁC, KHÔNG giới hạn cùng
// loại/cấp điện áp/hãng sản xuất như đề xuất #2 (dga-logic-peer.js) — những lần đo có
// VECTOR 7 KHÍ gần giống nhất (cosine similarity), rồi hiện lại kết luận/chẩn đoán CỦA
// CHÍNH lần đo đó (tính lại tại chỗ ở src/presentation/tabs/ui-dga.js bằng ĐÚNG logic đánh giá hiện có,
// theo tiêu chuẩn áp dụng cho CHÍNH thiết bị/hãng của lần đo đó — KHÔNG lưu sẵn 1 "kết
// luận" tĩnh nào, vì kết luận là hàm xác định của số liệu khí + tiêu chuẩn áp dụng, tính
// lại luôn ĐÚNG và không sợ lệch nếu sau này tiêu chuẩn/logic đánh giá được cập nhật).
//
// File này CHỈ làm phần "tìm ca tương tự" (thuần toán học, không phụ thuộc lớp UI nào,
// kiểm thử được qua Node — cùng nguyên tắc tách file như dga-logic-peer.js) — phần
// "tính lại kết luận của ca tìm được" do src/presentation/tabs/ui-dga.js đảm nhiệm bằng cách gọi lại
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

// ===== src/domain/dga-logic.js =====
// dga-logic.js — File LẮP RÁP (assembler) cho lớp logic nghiệp vụ DGA.
//
// Kể từ đợt tái cấu trúc này, toàn bộ logic đã được tách thành 6 file theo
// miền nghiệp vụ, đặt trong thư mục logic/:
//   - src/domain/dga-logic-core.js               : hằng số dùng chung + hàm lõi (GASES, EQUIPMENT_TYPES,
//                                              các bảng ngưỡng khí thô QĐ1901/IEC, hằng số dầu/OLTC, REGULATION_CITATIONS...)
//   - src/domain/dga-logic-gas.js                 : đánh giá khí hòa tan (TCG, tỷ lệ, Duval, tốc độ tăng, khuyến cáo...)
//   - src/domain/dga-logic-oil.js                 : thí nghiệm dầu MBA + dầu OLTC
//   - src/domain/dga-logic-instrument-oil.js      : thí nghiệm dầu TI/TU
//   - src/domain/dga-logic-iec60422-2024.js       : đánh giá THAM KHẢO dầu MBA + TI/TU theo IEC 60422:2024 (Bảng 5/7)
//   - src/domain/dga-logic-forecast.js            : dự báo xu hướng khí
//   - src/domain/dga-logic-regulation-config.js   : cơ chế cấu hình quy định (ghi đè ngưỡng tại chỗ)
//
// dga-logic-core.js là "hub" duy nhất: 5 file còn lại chỉ phụ thuộc vào core,
// không phụ thuộc lẫn nhau (dga-logic-forecast.js không phụ thuộc file nào).
//
// File này (src/domain/dga-logic.js) nằm CÙNG thư mục với các file logic; index.html
// tham chiếu <script src="src/domain/dga-logic.js">. Nhiệm vụ duy nhất của nó là LẮP RÁP:
//   - Trên trình duyệt: 6 file src/domain/dga-logic-*.js được nạp bằng thẻ <script>
//     THÔNG THƯỜNG (không phải module) ngay TRƯỚC thẻ <script src="src/domain/dga-logic.js">
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

  const LOGIC_DIR = __dirname;
  const LOGIC_FILES = [
    "dga-logic-core.js", // phải nạp đầu tiên — là hub mà các file còn lại phụ thuộc vào
    "dga-logic-gas.js",
    "dga-logic-oil.js",
    "dga-logic-instrument-oil.js",
    "dga-logic-iec60422-2024.js", // phụ thuộc verdictTwoTierOil() (instrument-oil.js) — nạp SAU file đó
    "dga-logic-oil-extended.js", // chỉ tiêu lý-hóa dầu bổ sung — SAU iec60422, TRƯỚC regulation-config
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
      diagnoseSimplifiedPDT, oltcContaminationCheck, gasesBelowTypicalLow, QD1901_BANG64_MBA_LOW,
      QD1901_BANG66_TABLE1, QD1901_BANG66_PDT, IEC_A10_BUSHING_RATIOS, QD1901_BANG67_DUVAL,
      DIEU54_OLTC_C2H2_H2, DIEU54_ADDITIONAL_RATIOS, PD_THRESHOLD_BY_TYPE,
      computeTcgRateOfChange,
      normalizeDuval, classifyDuval1, duvalPlotXY, diagnoseDuval1,
      QD1901_BANG63_TDGC, computeTotalDissolvedGasPercent, evaluateBang63, diagnoseAdditionalRatios,
      dieu54AdvisoryMessages, dieu54ActionMessages, dieu54AdditionalFlags, dieu54Applies, buildRecommendations, computeOverallStatus,
      OIL_VOLTAGE_CLASSES, OIL_VOLTAGE_CLASS_LEGACY_LABELS, oilVoltageClassName, BANG54_BDV, BANG55_TGD90, bang58WaterLimits, resolveOilLimits, evaluateOilTest,
      evaluateInstrumentOilTest,
      IEC60422_2024_TABLE5_MBA, IEC60422_2024_TABLE7_TITU, IEC60422_2024_CATEGORY_LABEL_MBA,
      IEC60422_2024_CATEGORY_LABEL_TITU, mapOilVoltageClassToIec60422Category, resolveIec60422TituCategory,
      evaluateIec60422MbaOilTest, evaluateIec60422TituOilTest,
      OIL_PARAM_DEFS, OIL_EXT_FIELDS, OIL_GROUP_LABELS, oilParamDef, oilSelectLabel, oilOverallFromRows, oilLimitText,
      evaluateOilExtendedQd1901, evaluateIec60422ExtendedMba, evaluateIec60422NewOilBase,
      oilExtraFromRecord, oilSeriesKey, findPreviousOilFlashPoint, evaluateOilRecord, evaluateIec60422OilRecord, evaluateOltcRecord,
      BANG59_ACID, DIEU51_FLASH, BANG56_MECH, BANG57_PARTICLES, DIEU55_FURFURAL, BANG70_RESISTIVITY, BANG60_62_OXIDATION,
      IEC60422_2024_TABLE3_NEW, IEC60422_2024_TABLE5_EXTRA,
      OLTC_SAMPLE_POINTS, BANG49_OLTC, evaluateOltcOilTest, OIL_SAMPLE_POINTS,
      linearRegression, olsPredictionInterval, theilSenSlope, senSlopeEstimate, mannKendallTest, recentWindowStart,
      normalCdf, normalQuantile, studentTCdf, studentTQuantile, FORECAST_ALPHA, FORECAST_RECENT_YEARS, FORECAST_RECENT_MIN_N, FORECAST_METHOD_LABELS, forecastGasTrend,
      REGULATION_CITATIONS, BANG58_WATER, getRegulationConfigRegistry, applyRegulationConfigOverride,
      resetRegulationConfigItem, regulationConfigDefaultCitation, getRegulationConfigCurrentValues, validateRegulationConfigValues, applyRegulationTerms, regulationTermsActive, applyRegulationTermsDeep,
      getValueAtPath, setValueAtPath,
      PEER_MIN_SAMPLES, PEER_Z_WARN, PEER_Z_ALERT, PEER_IF_WARN, PEER_IF_ALERT, evaluatePeerAnomaly,
      CASE_TOP_N, CASE_MIN_SIMILARITY, findSimilarCases,
    })`,
    context
  );

  module.exports = DGA;
} else if (typeof window !== "undefined") {
  // ---------------------------------------------------------------------------
  // Nhánh trình duyệt: 6 file src/domain/dga-logic-*.js đã được nạp bằng <script> thường
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
      diagnoseSimplifiedPDT, oltcContaminationCheck, gasesBelowTypicalLow, QD1901_BANG64_MBA_LOW,
      QD1901_BANG66_TABLE1, QD1901_BANG66_PDT, IEC_A10_BUSHING_RATIOS, QD1901_BANG67_DUVAL,
      DIEU54_OLTC_C2H2_H2, DIEU54_ADDITIONAL_RATIOS, PD_THRESHOLD_BY_TYPE,
    computeTcgRateOfChange,
    normalizeDuval, classifyDuval1, duvalPlotXY, diagnoseDuval1,
    QD1901_BANG63_TDGC, computeTotalDissolvedGasPercent, evaluateBang63, diagnoseAdditionalRatios,
    dieu54AdvisoryMessages, dieu54ActionMessages, dieu54AdditionalFlags, dieu54Applies, buildRecommendations, computeOverallStatus,
    OIL_VOLTAGE_CLASSES, OIL_VOLTAGE_CLASS_LEGACY_LABELS, oilVoltageClassName, BANG54_BDV, BANG55_TGD90, bang58WaterLimits, resolveOilLimits, evaluateOilTest,
    evaluateInstrumentOilTest,
    IEC60422_2024_TABLE5_MBA, IEC60422_2024_TABLE7_TITU, IEC60422_2024_CATEGORY_LABEL_MBA,
    IEC60422_2024_CATEGORY_LABEL_TITU, mapOilVoltageClassToIec60422Category, resolveIec60422TituCategory,
    evaluateIec60422MbaOilTest, evaluateIec60422TituOilTest,
      OIL_PARAM_DEFS, OIL_EXT_FIELDS, OIL_GROUP_LABELS, oilParamDef, oilSelectLabel, oilOverallFromRows, oilLimitText,
      evaluateOilExtendedQd1901, evaluateIec60422ExtendedMba, evaluateIec60422NewOilBase,
      oilExtraFromRecord, oilSeriesKey, findPreviousOilFlashPoint, evaluateOilRecord, evaluateIec60422OilRecord, evaluateOltcRecord,
      BANG59_ACID, DIEU51_FLASH, BANG56_MECH, BANG57_PARTICLES, DIEU55_FURFURAL, BANG70_RESISTIVITY, BANG60_62_OXIDATION,
      IEC60422_2024_TABLE3_NEW, IEC60422_2024_TABLE5_EXTRA,
    OLTC_SAMPLE_POINTS, BANG49_OLTC, evaluateOltcOilTest, OIL_SAMPLE_POINTS,
    linearRegression, olsPredictionInterval, theilSenSlope, senSlopeEstimate, mannKendallTest, recentWindowStart,
      normalCdf, normalQuantile, studentTCdf, studentTQuantile, FORECAST_ALPHA, FORECAST_RECENT_YEARS, FORECAST_RECENT_MIN_N, FORECAST_METHOD_LABELS, forecastGasTrend,
    REGULATION_CITATIONS, BANG58_WATER, getRegulationConfigRegistry, applyRegulationConfigOverride,
    resetRegulationConfigItem, regulationConfigDefaultCitation, getRegulationConfigCurrentValues, validateRegulationConfigValues, applyRegulationTerms, regulationTermsActive, applyRegulationTermsDeep,
    getValueAtPath, setValueAtPath,
    PEER_MIN_SAMPLES, PEER_Z_WARN, PEER_Z_ALERT, PEER_IF_WARN, PEER_IF_ALERT, evaluatePeerAnomaly,
    CASE_TOP_N, CASE_MIN_SIMILARITY, findSimilarCases,
  };

  window.DGA = DGA;
}
