/* storage-repo.js — Khuôn truy cập dữ liệu DÙNG CHUNG cho mọi thực thể của window.Storage (src/data/storage.js).
 *
 * Trước đây mỗi hàm list/add/save/delete lặp lại cùng 1 khuôn ~40 dòng:
 *   Google Sheets / máy chủ on-premise → Supabase → localStorage, mất mạng thì trả bộ nhớ đệm (đọc) hoặc đưa vào
 *   hàng đợi đồng bộ (ghi). File này gom khuôn đó về 4 hàm + 1 bảng mô tả thực thể (STORAGE_ENTITIES).
 * Hành vi được khóa bởi tests/storage-characterization.test.js — mọi khác biệt nhỏ giữa các thực thể (cột sắp xếp,
 * insert hay upsert, cảnh báo console, có báo trạng thái mất mạng hay không…) là THAM SỐ khai báo ở đây, không bị gộp mất.
 * Phụ thuộc (nạp trước): storage-core (LS_KEYS, sb, isNetworkError, notifySyncStatus), storage-remote (gsheetGet/Post),
 * storage-local (lsGet/lsSet), storage-offline (enqueueSyncOp).
 */

/** Chế độ dùng API kiểu Apps Script (Google Sheets hoặc máy chủ on-premise — cùng giao thức gsheetGet/gsheetPost). */
const REPO_GSHEET_MODES = ["gsheet", "local-server"];

/**
 * Mô tả từng thực thể: khóa bộ nhớ đệm (LS_KEYS), bảng Supabase, tên action phía Apps Script/on-premise.
 * - orderBy: cột sắp xếp tăng dần khi đọc từ Supabase (không có = không sắp xếp)
 * - supabaseWrite: "upsert" (ghi đè theo id) hoặc "insert"
 * - offlineWarn: câu console.warn khi đọc lúc mất mạng (chỉ measurements có)
 * - notifyOffline: false = KHÔNG báo trạng thái mất mạng khi đọc lỗi mạng (regulationConfig)
 */
const STORAGE_ENTITIES = {
  measurements: {
    cacheKey: "measurements", table: "measurements", orderBy: "sample_date",
    listAction: "listMeasurements", saveAction: "addMeasurement", deleteAction: "deleteMeasurement",
    offlineWarn: "Mất kết nối mạng: trả về measurements từ bộ nhớ đệm ngoại tuyến (localStorage)",
  },
  standards: {
    cacheKey: "standards", table: "manufacturer_standards", supabaseWrite: "upsert",
    listAction: "listStandards", saveAction: "saveStandard", deleteAction: "deleteStandard",
  },
  regulationConfig: {
    cacheKey: "regulationConfig", table: "regulation_config", notifyOffline: false,
    listAction: "listRegulationConfig", saveAction: "saveRegulationConfig", deleteAction: "deleteRegulationConfig",
  },
  stations: {
    cacheKey: "stations", table: "stations", supabaseWrite: "upsert",
    listAction: "listStations", saveAction: "saveStation", deleteAction: "deleteStation",
  },
  oilTests: {
    cacheKey: "oilTests", table: "oil_tests", orderBy: "sample_date", supabaseWrite: "insert",
    listAction: "listOilTests", saveAction: "addOilTest", deleteAction: "deleteOilTest",
  },
  oltcOilTests: {
    cacheKey: "oltcOilTests", table: "oltc_oil_tests", orderBy: "sample_date", supabaseWrite: "insert",
    listAction: "listOltcOilTests", saveAction: "addOltcOilTest", deleteAction: "deleteOltcOilTest",
  },
  instrumentOilTests: {
    cacheKey: "instrumentOilTests", table: "instrument_oil_tests", orderBy: "sample_date", supabaseWrite: "upsert",
    listAction: "listInstrumentOilTests", saveAction: "addInstrumentOilTest", deleteAction: "deleteInstrumentOilTest",
  },
  feedback: {
    cacheKey: "feedback", table: "feedback", orderBy: "created_at", supabaseWrite: "insert",
    listAction: "listFeedback", saveAction: "addFeedback", deleteAction: "deleteFeedback",
  },
};

function repoIsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Đọc danh sách 1 thực thể; ghi lại bộ nhớ đệm khi đọc được từ xa, mất mạng thì trả bộ nhớ đệm. */
async function repoList(mode, spec) {
  const cacheKey = LS_KEYS[spec.cacheKey];
  const fromCache = () => {
    if (spec.offlineWarn) console.warn(spec.offlineWarn);
    if (spec.notifyOffline !== false) notifySyncStatus({ online: false });
    return lsGet(cacheKey);
  };
  if (REPO_GSHEET_MODES.includes(mode)) {
    try {
      const data = await gsheetGet(spec.listAction);
      lsSet(cacheKey, data || []);
      return data || [];
    } catch (err) {
      if (isNetworkError(err)) return fromCache();
      throw err;
    }
  }
  if (mode === "supabase") {
    try {
      let query = sb().from(spec.table).select("*");
      if (spec.orderBy) query = query.order(spec.orderBy, { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      lsSet(cacheKey, data || []);
      return data || [];
    } catch (err) {
      if (isNetworkError(err)) return fromCache();
      throw err;
    }
  }
  return lsGet(cacheKey);
}

/**
 * Ghi lên nơi lưu từ xa theo chế độ. Mất mạng (navigator.onLine === false) hoặc lỗi mạng → đưa {action, payload} vào
 * hàng đợi đồng bộ và trả `localResult`; lỗi khác → ném lại. Chế độ localStorage → trả `localResult`.
 * @param {string} mode Storage.mode
 * @param {{ action: string, payload: object, localResult?: any, gsheet: () => Promise<any>, supabase: () => Promise<any> }} op
 */
async function repoRemoteWrite(mode, op) {
  const queued = () => {
    enqueueSyncOp(op.action, op.payload);
    return op.localResult;
  };
  const attempt = async (fn) => {
    if (repoIsOffline()) return queued();
    try {
      return await fn();
    } catch (err) {
      if (isNetworkError(err)) return queued();
      throw err;
    }
  };
  if (REPO_GSHEET_MODES.includes(mode)) return attempt(op.gsheet);
  if (mode === "supabase") return attempt(op.supabase);
  return op.localResult;
}

/** Supabase insert/upsert 1 bản ghi, trả về dòng máy chủ trả lại (nếu có) hoặc chính bản ghi. */
async function repoSupabaseWriteReturning(table, method, record) {
  const { data, error } = await sb().from(table)[method](record).select();
  if (error) throw error;
  return data && data[0] ? data[0] : record;
}

/** Lưu (thêm/ghi đè) 1 bản ghi đã gắn id + cập nhật bộ nhớ đệm ở phía gọi: Apps Script trả nguyên kết quả máy chủ,
 *  Supabase trả dòng đã lưu (hoặc bản ghi). Dùng cho thực thể không có xử lý riêng. */
function repoSave(mode, spec, record) {
  return repoRemoteWrite(mode, {
    action: spec.saveAction,
    payload: { record },
    localResult: record,
    gsheet: () => gsheetPost(spec.saveAction, { record }),
    supabase: () => repoSupabaseWriteReturning(spec.table, spec.supabaseWrite, record),
  });
}

/** Xóa 1 bản ghi theo id: bỏ khỏi bộ nhớ đệm ngay, rồi xóa từ xa (mất mạng → hàng đợi). Không trả giá trị. */
async function repoDelete(mode, spec, id) {
  const cacheKey = LS_KEYS[spec.cacheKey];
  lsSet(cacheKey, lsGet(cacheKey).filter((r) => r.id !== id));
  await repoRemoteWrite(mode, {
    action: spec.deleteAction,
    payload: { id },
    localResult: undefined,
    gsheet: async () => {
      await gsheetPost(spec.deleteAction, { id });
    },
    supabase: async () => {
      const { error } = await sb().from(spec.table).delete().eq("id", id);
      if (error) throw error;
    },
  });
}

/** Ghi đè bản ghi cùng id trong bộ nhớ đệm, chưa có thì thêm vào cuối. */
function repoCacheUpsert(spec, record) {
  const cacheKey = LS_KEYS[spec.cacheKey];
  const all = lsGet(cacheKey);
  const idx = all.findIndex((r) => r.id === record.id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  lsSet(cacheKey, all);
  return all;
}

/** Thêm bản ghi vào CUỐI bộ nhớ đệm (không kiểm tra trùng id — giữ đúng cách làm cũ của dầu MBA/OLTC/góp ý). */
function repoCacheAppend(spec, record) {
  const cacheKey = LS_KEYS[spec.cacheKey];
  const all = lsGet(cacheKey);
  all.push(record);
  lsSet(cacheKey, all);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    REPO_GSHEET_MODES, STORAGE_ENTITIES, repoIsOffline, repoList, repoRemoteWrite, repoSupabaseWriteReturning,
    repoSave, repoDelete, repoCacheUpsert, repoCacheAppend,
  };
}
