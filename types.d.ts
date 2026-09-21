// types.d.ts — Định nghĩa KIỂU dùng chung cho lớp logic DGA (logic/*.js + dga-logic.js).
//
// Chỉ phục vụ kiểm tra tĩnh (`npm run typecheck`, tsc --noEmit, checkJs) — KHÔNG được nạp vào trình duyệt
// và KHÔNG đổi cách app chạy (vẫn là JavaScript thuần, không có bước build). File này KHÔNG có
// import/export nên mọi tên bên dưới là kiểu toàn cục, dùng được trong JSDoc: `@param {GasReading} gases`.
//
// Tên trường khớp đúng cấu trúc dữ liệu đang dùng ở logic/ (KHÔNG phải tên cột lưu trữ dạng snake_case
// như equipment_type/thiet_bi của bản ghi trong database — phần đó do ui/*.js và storage.js chuyển đổi).

/** Hàm lượng 7 khí hòa tan (ppm). Giá trị có thể là chuỗi từ ô nhập — logic ép kiểu bằng num(). */
interface GasReading {
  H2?: number | string | null;
  CH4?: number | string | null;
  C2H6?: number | string | null;
  C2H4?: number | string | null;
  C2H2?: number | string | null;
  CO?: number | string | null;
  CO2?: number | string | null;
}

type GasName = "H2" | "CH4" | "C2H6" | "C2H4" | "C2H2" | "CO" | "CO2";

/** Ngưỡng theo từng khí (ppm); khí không có ngưỡng để null/""/undefined. */
type GasLimits = { [gas in GasName]?: number | string | null };

/** Khoảng tốc độ tăng khí điển hình [thấp, cao] (ppm/năm), theo từng khí — Bảng 65 QĐ1901. */
type GasRateRanges = { [gas in GasName]?: [number, number] };

/** Thông tin thiết bị/lần đo mà logic cần để chọn tiêu chuẩn áp dụng (xem resolveStandard()). */
interface LogicMeasurement {
  /** Một trong EQUIPMENT_TYPES.* (chuỗi tiếng Việt, vd "MBA/Kháng dầu"). */
  equipmentType: string;
  manufacturer?: string | null;
  /** MBA_SUBTYPES.* — chỉ dùng cho MBA/Kháng dầu. */
  mbaSubtype?: string | null;
  /** INSTRUMENT_SUBTYPES.* — chỉ dùng cho TI/TU. */
  instrumentSubtype?: string | null;
}

/** Tiêu chuẩn riêng của nhà sản xuất (khí hòa tan) — xem toManufacturerStandardsForLogic() ở ui/ui-standards.js. */
interface ManufacturerGasStandard {
  manufacturer: string;
  equipmentType: string;
  limits?: GasLimits | null;
  rate?: GasRateRanges | null;
  condemning?: GasLimits | null;
  source?: string;
}

/** Tiêu chuẩn riêng của nhà sản xuất cho dầu cách điện (MBA theo cấp điện áp/trạng thái; TI/TU 2 tầng). */
interface ManufacturerOilStandard {
  manufacturer: string;
  source?: string;
  /** Chỉ dầu MBA: cấp điện áp OIL_VOLTAGE_CLASSES.value và trạng thái "new" | "inservice". */
  voltageClass?: string;
  oilState?: string;
  /** Chỉ dầu TI/TU. */
  equipmentType?: string;
  moisture?: number | string | null;
  tgd90?: number | string | null;
  bdv?: number | string | null;
  moistureReject?: number | string | null;
  tgd90Reject?: number | string | null;
  bdvReject?: number | string | null;
}

/** Dòng kết quả của 1 hạng mục dầu (Độ ẩm / tgδ / BDV). */
interface OilTestRow {
  key: "moisture" | "tgd90" | "bdv";
  label: string;
  value: number;
  limit: number | string | null;
  unit: string;
  verdict: string;
  direction: "le" | "ge";
  ref: string;
  isManufacturer?: boolean;
}

interface OilTestResult {
  rows: OilTestRow[];
  /** "Đạt" | "Không đạt" | "Cảnh báo" | "Chưa đủ dữ liệu" | "Chưa có tiêu chuẩn nhà sản xuất". */
  overall: string;
}

/** Đầu vào chung của evaluateOilTest()/evaluateOltcOilTest(). */
interface OilTestInput {
  voltageClass: string;
  oilState?: string;
  hasMembraneN2?: boolean;
  oltcSamplePoint?: string;
  moisture?: number | string | null;
  tgd90?: number | string | null;
  bdv?: number | string | null;
  manufacturer?: string | null;
  manufacturerOilStandards?: ManufacturerOilStandard[] | null;
}

/** Đầu vào của evaluateInstrumentOilTest() (dầu TI/TU). */
interface InstrumentOilTestInput {
  equipmentType: string;
  manufacturer?: string | null;
  manufacturerOilStandards?: ManufacturerOilStandard[] | null;
  moisture?: number | string | null;
  tgd90?: number | string | null;
  bdv?: number | string | null;
}

/** Kết quả computeOverallStatus(). */
interface OverallStatus {
  level: "normal" | "alert" | "alarm";
  label: string;
  reasons: string[];
  action: string;
}

/** Trình duyệt gắn logic đã lắp ráp vào window.DGA (xem dga-logic.js). Không khai báo cả lib DOM để tsc
 *  báo lỗi nếu lớp logic lỡ dùng document/localStorage/... (lớp logic phải thuần, không phụ thuộc DOM). */
declare const window: { DGA?: any } | undefined;
