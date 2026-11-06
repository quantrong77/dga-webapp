// types.d.ts — Định nghĩa KIỂU dùng chung cho lớp logic DGA (src/domain/*.js).
//
// Chỉ phục vụ kiểm tra tĩnh (`npm run typecheck`, tsc --noEmit, checkJs) — KHÔNG được nạp vào trình duyệt
// và KHÔNG đổi cách app chạy (vẫn là JavaScript thuần, không có bước build). File này KHÔNG có
// import/export nên mọi tên bên dưới là kiểu toàn cục, dùng được trong JSDoc: `@param {GasReading} gases`.
//
// Tên trường khớp đúng cấu trúc dữ liệu đang dùng ở logic/ (KHÔNG phải tên cột lưu trữ dạng snake_case
// như equipment_type/thiet_bi của bản ghi trong database — phần đó do src/presentation/*.js và storage.js chuyển đổi).

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

/** Tiêu chuẩn riêng của nhà sản xuất (khí hòa tan) — xem toManufacturerStandardsForLogic() ở src/presentation/tabs/ui-standards.js. */
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

// ---------------------------------------------------------------------------------------------------------------
// LỚP DỮ LIỆU (src/data/) — API dùng chung giữa các driver (Bước 4.5 REFACTOR_PLAN). Các file driver có nhánh
// module.exports nên tsc coi mỗi file là 1 module riêng; khai báo ở đây để file này kiểm tra được lời gọi sang
// file khác. Mở rộng dần theo từng file được đưa vào tsconfig.json "include" (hiện: storage-repo.js).
// ---------------------------------------------------------------------------------------------------------------

/** Khóa localStorage của bộ nhớ đệm từng thực thể (storage-core.js) — KHÔNG đổi tên (dữ liệu cũ phải đọc được). */
declare const LS_KEYS: {
  measurements: string; standards: string; stations: string; oilTests: string; oltcOilTests: string;
  instrumentOilTests: string; feedback: string; regulationConfig: string;
};
/** Đọc mảng bản ghi đã lưu đệm (storage-local.js); lỗi/chưa có → []. */
declare function lsGet(key: string): any[];
/** Ghi mảng bản ghi vào bộ nhớ đệm (storage-local.js); lỗi ghi chỉ cảnh báo, không ném. */
declare function lsSet(key: string, value: any): void;
/** Gọi API kiểu Apps Script (Google Sheets / máy chủ on-premise) — storage-remote.js. Ném lỗi nếu máy chủ trả { error }. */
declare function gsheetGet(action: string, params?: Record<string, any>): Promise<any>;
declare function gsheetPost(action: string, body?: Record<string, any>): Promise<any>;
/** Client Supabase (storage-core.js) — đang tắt, giữ nguyên code. */
declare function sb(): any;
/** Lỗi do mất mạng (không phải lỗi nghiệp vụ/máy chủ) — storage-core.js. */
declare function isNetworkError(err: unknown): boolean;
/** Báo trạng thái đồng bộ cho các listener (badge đồng bộ) — storage-core.js. */
declare function notifySyncStatus(override?: { online?: boolean; syncing?: boolean; pending?: number }): void;
/** Đưa 1 thao tác ghi vào hàng đợi đồng bộ (gửi lại khi có mạng) — storage-offline.js. */
declare function enqueueSyncOp(action: string, payload: Record<string, any>): { id: string; action: string; payload: any };

/** Mô tả 1 thực thể lưu trữ (STORAGE_ENTITIES ở storage-repo.js). */
interface StorageEntitySpec {
  /** Tên khóa trong LS_KEYS. */
  cacheKey: keyof typeof LS_KEYS;
  /** Bảng Supabase. */
  table: string;
  listAction: string;
  saveAction: string;
  deleteAction: string;
  /** Cột sắp xếp tăng dần khi đọc từ Supabase (không có = không sắp xếp). */
  orderBy?: string;
  /** Cách ghi lên Supabase cho thực thể không có xử lý riêng. */
  supabaseWrite?: "upsert" | "insert";
  /** Câu console.warn khi đọc lúc mất mạng. */
  offlineWarn?: string;
  /** false = không báo trạng thái mất mạng khi đọc lỗi mạng. */
  notifyOffline?: boolean;
}

/** 1 thao tác ghi từ xa (repoRemoteWrite). */
interface RepoRemoteWriteOp {
  action: string;
  payload: Record<string, any>;
  /** Giá trị trả về khi chạy local / mất mạng (đã vào hàng đợi). */
  localResult?: any;
  gsheet: () => Promise<any>;
  supabase: () => Promise<any>;
}

/** Trình duyệt: navigator.onLine (false = mất mạng). Kiểu Navigator của Node không có thuộc tính này. */
interface Navigator {
  onLine?: boolean;
}
