/* storage.js — Facade Repository chính cho Data Access Tier.
 * Lắp ráp các driver từ storage/:
 *   - src/data/drivers/storage-core.js
 *   - src/data/drivers/storage-remote.js
 *   - src/data/drivers/storage-local.js
 *   - src/data/drivers/storage-offline.js
 *   - src/data/drivers/storage-auth.js
 *   - src/data/drivers/storage-repo.js  (khuôn CRUD dùng chung theo thực thể)
 * Cung cấp window.Storage và window.Auth thống nhất, giữ 100% tương thích ngược.
 */

if (typeof module !== "undefined" && module.exports) {
  const core = require("./drivers/storage-core");
  Object.assign(global, core);
  const remote = require("./drivers/storage-remote");
  Object.assign(global, remote);
  const local = require("./drivers/storage-local");
  Object.assign(global, local);
  const offline = require("./drivers/storage-offline");
  Object.assign(global, offline);
  const auth = require("./drivers/storage-auth");
  Object.assign(global, auth);
  const repo = require("./drivers/storage-repo");
  Object.assign(global, repo);
}

const Storage = {
  mode: (typeof hasLocalServerConfig === "function" && hasLocalServerConfig()) ? "local-server" : hasGsheetConfig() ? "gsheet" : hasSupabaseConfig() ? "supabase" : "local",

  // ---------------------------------------------------------------------------
  // CRUD theo thực thể — khuôn chung ở src/data/drivers/storage-repo.js (repoList / repoSave / repoDelete /
  // repoRemoteWrite, bảng STORAGE_ENTITIES). Hành vi khóa bởi tests/storage-characterization.test.js.
  // ---------------------------------------------------------------------------

  // Lần đo khí hòa tan (DGA)
  async listMeasurements() {
    return repoList(this.mode, STORAGE_ENTITIES.measurements);
  },

  async addMeasurement(m) {
    // Dùng chung cho cả TẠO MỚI và SỬA/LƯU LẠI 1 bản ghi đã có (không có
    // updateMeasurement() riêng — khi sửa, m.id là id bản ghi cũ nên phải UPDATE
    // đúng dòng đó, không được tạo thêm dòng mới trùng thiết bị/ngày đo).
    const spec = STORAGE_ENTITIES.measurements;
    const record = normalizeGasKeys({ ...m, id: m.id || uid(), created_at: m.created_at || new Date().toISOString() });
    // Lưu ngay vào bộ nhớ cục bộ để UI phản ánh tức thì (Optimistic UI)
    const all = repoCacheUpsert(spec, record);
    return repoRemoteWrite(this.mode, {
      action: spec.saveAction,
      payload: { record },
      localResult: record,
      gsheet: async () => (await gsheetPost(spec.saveAction, { record })) || record,
      supabase: async () => {
        const { data, error } = await sb().from(spec.table).upsert(record).select();
        if (error) throw error;
        if (data && data[0]) {
          // Thay bản ghi trong bộ nhớ đệm bằng dòng máy chủ trả về (có cột do máy chủ sinh)
          const freshIdx = all.findIndex((r) => r.id === record.id);
          if (freshIdx >= 0) {
            all[freshIdx] = data[0];
            lsSet(LS_KEYS[spec.cacheKey], all);
          }
          return data[0];
        }
        return record;
      },
    });
  },

  async deleteMeasurement(id) {
    return repoDelete(this.mode, STORAGE_ENTITIES.measurements, id);
  },

  // Tiêu chuẩn theo nhà sản xuất
  async listStandards() {
    return repoList(this.mode, STORAGE_ENTITIES.standards);
  },

  async saveStandard(s) {
    const record = { ...s, id: s.id || uid() };
    repoCacheUpsert(STORAGE_ENTITIES.standards, record);
    return repoSave(this.mode, STORAGE_ENTITIES.standards, record);
  },

  async deleteStandard(id) {
    return repoDelete(this.mode, STORAGE_ENTITIES.standards, id);
  },

  // -------------------------------------------------------------------
  // "Cấu hình quy định" (tab riêng, xem src/presentation/tabs/ui-regulation-config.js) — cho phép Admin
  // sửa số liệu/tham chiếu nguồn của các bảng ngưỡng ĐƠN GIẢN trong dga-logic.js (mục 9,
  // REGULATION_CONFIG_REGISTRY) mà KHÔNG cần sửa code, đáp ứng khi QĐ1901/IEC 60599 có
  // bản cập nhật trong tương lai. Mỗi bản ghi ứng với ĐÚNG 1 bảng (id = key trong
  // registry, VD "BANG64_MBA") — không phải danh sách tự do như Tiêu chuẩn NSX.
  // "values" ở phía gọi (dga-logic.js applyRegulationConfigOverride()) LUÔN là 1 object
  // JS lồng nhau đúng shape của bảng đó — storage.js CHỈ lo phần (de)serialize thành
  // chuỗi JSON (values_json) để lưu thống nhất trên CẢ 3 backend (kể cả Supabase — dùng
  // cột text thay vì jsonb để khỏi phải đổi schema riêng), người gọi không cần biết.
  // -------------------------------------------------------------------
  async listRegulationConfig() {
    const rows = await repoList(this.mode, STORAGE_ENTITIES.regulationConfig);
    return (rows || []).map((r) => {
      let values = null;
      try {
        values = r.values_json ? JSON.parse(r.values_json) : null;
      } catch (err) {
        console.warn("Không đọc được values_json của cấu hình quy định:", r.id, err);
      }
      return { id: r.id, citation: r.citation || null, values, updated_by: r.updated_by, updated_at: r.updated_at };
    });
  },

  /** @param {{id:string, citation?:string, values?:object}} rec */
  async saveRegulationConfig(rec) {
    const spec = STORAGE_ENTITIES.regulationConfig;
    const wire = {
      id: rec.id,
      citation: rec.citation || "",
      values_json: JSON.stringify(rec.values || {}),
      updated_at: new Date().toISOString(),
    };
    repoCacheUpsert(spec, wire);
    // Không trả giá trị ở mọi chế độ; Supabase upsert KHÔNG kèm .select()
    await repoRemoteWrite(this.mode, {
      action: spec.saveAction,
      payload: { record: wire },
      localResult: undefined,
      gsheet: async () => {
        await gsheetPost(spec.saveAction, { record: wire });
      },
      supabase: async () => {
        const { error } = await sb().from(spec.table).upsert(wire);
        if (error) throw error;
      },
    });
  },

  /** Xóa bản ghi ghi đè — dùng cho nút "Khôi phục mặc định" (xóa override thì lần nạp
   *  sau tự dùng lại hằng số mặc định trong dga-logic.js). */
  async deleteRegulationConfig(id) {
    return repoDelete(this.mode, STORAGE_ENTITIES.regulationConfig, id);
  },

  // Danh mục Trạm (MaTram/TenTram) — dùng để gợi ý/tìm kiếm ở ô "Trạm", không bắt buộc.
  async listStations() {
    return repoList(this.mode, STORAGE_ENTITIES.stations);
  },

  async saveStation(s) {
    const record = { ...s, id: s.id || uid() };
    repoCacheUpsert(STORAGE_ENTITIES.stations, record);
    return repoSave(this.mode, STORAGE_ENTITIES.stations, record);
  },

  async deleteStation(id) {
    return repoDelete(this.mode, STORAGE_ENTITIES.stations, id);
  },

  // Thí nghiệm dầu MBA (độ ẩm/tgδ 90°C/điện áp chọc thủng) — Điều 46/47/50, QĐ1901.
  async listOilTests() {
    return repoList(this.mode, STORAGE_ENTITIES.oilTests);
  },

  async addOilTest(t) {
    const spec = STORAGE_ENTITIES.oilTests;
    const record = { ...t, id: t.id || uid(), created_at: new Date().toISOString() };
    repoCacheAppend(spec, record);
    return repoRemoteWrite(this.mode, {
      action: spec.saveAction,
      payload: { record },
      localResult: record,
      gsheet: () => gsheetPost(spec.saveAction, { record }),
      supabase: async () => {
        let { data, error } = await sb().from(spec.table).insert(record).select();
        if (error && "device_info" in record && /device_info/.test(String(error.message || ""))) {
          // Bảng chưa có cột device_info (chưa chạy backend/supabase/mirror-setup.sql) — vẫn lưu được số liệu thí nghiệm
          const { device_info, ...rest } = record;
          ({ data, error } = await sb().from(spec.table).insert(rest).select());
        }
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      },
    });
  },

  async deleteOilTest(id) {
    return repoDelete(this.mode, STORAGE_ENTITIES.oilTests, id);
  },

  // Thí nghiệm dầu khoang điều áp dưới tải (OLTC) — Điều 37/Bảng 49, QĐ1901. Bảng
  // riêng khỏi oil_tests (dầu thùng dầu chính) vì có thêm điểm lấy mẫu + pha.
  async listOltcOilTests() {
    return repoList(this.mode, STORAGE_ENTITIES.oltcOilTests);
  },

  async addOltcOilTest(t) {
    const record = { ...t, id: t.id || uid(), created_at: new Date().toISOString() };
    repoCacheAppend(STORAGE_ENTITIES.oltcOilTests, record);
    return repoSave(this.mode, STORAGE_ENTITIES.oltcOilTests, record);
  },

  async deleteOltcOilTest(id) {
    return repoDelete(this.mode, STORAGE_ENTITIES.oltcOilTests, id);
  },

  // Thí nghiệm dầu cách điện TI/TU (biến dòng điện/biến điện áp kiểu kín, cách điện
  // dầu) — Điều 10/11 QĐ1901 (chỉ dẫn chiếu "theo quy định nhà sản xuất", không có
  // bảng số mặc định — xem DGA.evaluateInstrumentOilTest() ở dga-logic.js). Bảng
  // RIÊNG khỏi oil_tests (MBA) vì khác hẳn cấu trúc (equipment_type TI/TU thay cấp
  // điện áp/trạng thái dầu, không có has_membrane_n2/oil_sample_point).
  async listInstrumentOilTests() {
    return repoList(this.mode, STORAGE_ENTITIES.instrumentOilTests);
  },

  async addInstrumentOilTest(t) {
    // Có id sẵn = cập nhật bản ghi đã có (sửa, hoặc nhập lại đúng BBTN 3 pha đã lưu): giữ
    // created_at gốc và ghi đè đúng dòng đó, không tạo dòng trùng (dòng được đưa xuống CUỐI bộ nhớ đệm).
    const spec = STORAGE_ENTITIES.instrumentOilTests;
    const record = { ...t, id: t.id || uid(), created_at: t.created_at || new Date().toISOString() };
    const all = lsGet(LS_KEYS[spec.cacheKey]).filter((r) => r.id !== record.id);
    all.push(record);
    lsSet(LS_KEYS[spec.cacheKey], all);
    return repoSave(this.mode, spec, record);
  },

  async deleteInstrumentOilTest(id) {
    return repoDelete(this.mode, STORAGE_ENTITIES.instrumentOilTests, id);
  },

  // Góp ý người dùng (tab "Người dùng phản hồi") — nội dung tự do + 1 ảnh minh họa tùy
  // chọn (xem uploadFeedbackImage() bên dưới). KHÔNG dùng prepareOwnedRecord()/audit như
  // measurements (feedback không có khái niệm "sửa lại" — chỉ tạo mới và Admin xóa được),
  // nên phía gsheet (Code.gs) vẫn gắn created_by nếu đã đăng nhập nhưng không giới hạn ai
  // sửa vì client không cung cấp tính năng sửa.
  async listFeedback() {
    return repoList(this.mode, STORAGE_ENTITIES.feedback);
  },

  async addFeedback(f) {
    const record = { ...f, id: f.id || uid(), created_at: new Date().toISOString() };
    repoCacheAppend(STORAGE_ENTITIES.feedback, record);
    return repoSave(this.mode, STORAGE_ENTITIES.feedback, record);
  },

  async deleteFeedback(id) {
    return repoDelete(this.mode, STORAGE_ENTITIES.feedback, id);
  },

  /** Tải lên 1 ảnh minh họa đính kèm góp ý — cùng cơ chế với uploadAttachment() (BBTN) ở
   *  trên, nhưng tách riêng bucket Supabase ("feedback" thay vì "bbtn") / thư mục Drive
   *  ("DGA_Feedback_DinhKem" thay vì "DGA_BBTN_DinhKem") để 2 loại file khác mục đích
   *  không lẫn vào nhau. Chế độ localStorage dùng lại NGUYÊN uploadAttachment()/
   *  getLocalAttachment() — cơ chế đó vốn chỉ là 1 map id→file dùng chung, khóa nào (id
   *  lần đo hay id góp ý) cũng được, không cần tách riêng như 2 chế độ kia. feedbackId
   *  phải sinh TRƯỚC bằng Storage.newId() (giống cách BBTN làm) vì ảnh có thể tải lên
   *  trước khi gọi addFeedback(). Trả về { image_url, image_name, image_file_id }. */
  async uploadFeedbackImage(feedbackId, file) {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      const base64Data = await fileToBase64(file);
      const res = await gsheetPost("uploadAttachment", {
        measurementId: feedbackId,
        filename: file.name,
        mimeType: file.type || "image/png",
        base64Data,
        folder: "DGA_Feedback_DinhKem",
      });
      return { image_url: res.url, image_name: res.name || file.name, image_file_id: res.id || null };
    }
    if (this.mode === "supabase") {
      const path = `${feedbackId}/${Date.now()}_${file.name}`;
      const { error } = await sb().storage.from("feedback").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/png",
      });
      if (error) throw error;
      const { data } = sb().storage.from("feedback").getPublicUrl(path);
      return { image_url: data.publicUrl, image_name: file.name, image_file_id: null };
    }
    const uploaded = await this.uploadAttachment(feedbackId, file);
    return { image_url: uploaded.bbtn_url, image_name: uploaded.bbtn_name, image_file_id: uploaded.bbtn_file_id };
  },

  // Id sinh phía client — dùng khi cần biết trước id của 1 lần đo (vd: để đính kèm
  // BBTN trước khi gọi addMeasurement()), thay vì để addMeasurement() tự sinh id.
  newId() {
    return uid();
  },

  /** Tải lên 1 file BBTN (PDF) và gắn với 1 lần đo (measurementId) — trả về các cột
   *  cần gộp vào record trước khi gọi addMeasurement(): { bbtn_url, bbtn_name, bbtn_file_id }.
   *  bbtn_file_id chỉ có giá trị ở chế độ Google Sheets (id file trên Drive); 2 chế độ
   *  còn lại để null. Ở chế độ localStorage, bbtn_url có dạng "local:<measurementId>" —
   *  KHÔNG phải URL thật, chỉ là "khóa" để tra lại qua getLocalAttachment(). */
  async uploadAttachment(measurementId, file) {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      const base64Data = await fileToBase64(file);
      const res = await gsheetPost("uploadAttachment", {
        measurementId,
        filename: file.name,
        mimeType: file.type || "application/pdf",
        base64Data,
      });
      return { bbtn_url: res.url, bbtn_name: res.name || file.name, bbtn_file_id: res.id || null };
    }
    if (this.mode === "supabase") {
      const path = `${measurementId}/${Date.now()}_${file.name}`;
      const { error } = await sb().storage.from("bbtn").upload(path, file, {
        upsert: true,
        contentType: file.type || "application/pdf",
      });
      if (error) throw error;
      const { data } = sb().storage.from("bbtn").getPublicUrl(path);
      return { bbtn_url: data.publicUrl, bbtn_name: file.name, bbtn_file_id: null };
    }
    // Chế độ thử nghiệm (localStorage) — chỉ máy/trình duyệt hiện tại thấy được file này.
    if (file.size > MAX_LOCAL_BBTN_BYTES) {
      throw new Error(
        `Chế độ lưu cục bộ (localStorage) chỉ hỗ trợ file tối đa 4MB — file này ${(file.size / 1024 / 1024).toFixed(1)}MB. ` +
        "Cấu hình Google Sheets hoặc Supabase trong config.js để lưu file lớn hơn."
      );
    }
    const dataUrl = await fileToDataUrl(file);
    const map = lsBbtnGetAll();
    map[measurementId] = { name: file.name, dataUrl };
    lsBbtnSetAll(map);
    return { bbtn_url: "local:" + measurementId, bbtn_name: file.name, bbtn_file_id: null };
  },

  /** Chỉ dùng ở chế độ localStorage — tra lại {name, dataUrl} đã lưu bằng
   *  uploadAttachment() ở trên, theo measurementId (phần sau "local:" trong bbtn_url). */
  getLocalAttachment(measurementId) {
    const map = lsBbtnGetAll();
    return map[measurementId] || null;
  },

  /** Nội dung file đính kèm (BBTN) dạng Blob để hiện trong khung đối chiếu cạnh số liệu, null nếu không lấy được.
   *  Chế độ Google Sheets: link Google Drive không nhúng/tải thẳng được từ trình duyệt (CORS, X-Frame-Options) —
   *  Apps Script đọc hộ (action getAttachment, chỉ file trong thư mục đính kèm của app) rồi trả base64.
   *  att = { bbtn_url, bbtn_file_id? }; id Drive lấy từ bbtn_file_id hoặc tách từ link .../d/<id>/... */
  async fetchAttachmentBlob(att) {
    if (!att || !att.bbtn_url || this.mode !== "gsheet") return null;
    const m = String(att.bbtn_url).match(/\/d\/([A-Za-z0-9_-]{10,})|[?&]id=([A-Za-z0-9_-]{10,})/);
    const id = att.bbtn_file_id || (m && (m[1] || m[2]));
    if (!id) return null;
    const res = await gsheetGet("getAttachment", { id });
    if (!res || !res.base64Data) return null;
    const bin = atob(res.base64Data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: res.mimeType || "application/pdf" });
  },

  // ---------------------------------------------------------------------------
  // API quản lý hàng đợi & Tự động đồng bộ (Outbox Processor)
  // ---------------------------------------------------------------------------
  async processSyncQueue() {
    if (_isSyncing) return { syncing: true, pending: lsSyncQueueGet().length };
    if (this.mode === "local") return { mode: "local", pending: 0 };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      notifySyncStatus({ online: false });
      return { offline: true, pending: lsSyncQueueGet().length };
    }

    const queue = lsSyncQueueGet();
    if (!queue.length) {
      notifySyncStatus({ syncing: false, pending: 0 });
      return { processed: 0, pending: 0 };
    }

    _isSyncing = true;
    notifySyncStatus({ syncing: true, pending: queue.length });

    let processedCount = 0;
    try {
      while (queue.length > 0) {
        const item = queue[0];
        try {
          await executeRemoteSyncItem(item);
          queue.shift();
          lsSyncQueueSet(queue);
          processedCount++;
          notifySyncStatus({ syncing: true, pending: queue.length });
        } catch (err) {
          if (isNetworkError(err)) {
            console.warn("Đang đồng bộ thì gặp sự cố mạng, tạm hoãn chờ lần kết nối tiếp theo:", err);
            break;
          } else {
            console.error("Lỗi khi xử lý mục đồng bộ (bỏ qua sau nhiều lần lỗi):", item, err);
            item.retries = (item.retries || 0) + 1;
            if (item.retries >= 3) {
              queue.shift();
              lsSyncQueueSet(queue);
            } else {
              lsSyncQueueSet(queue);
              break;
            }
          }
        }
      }
    } finally {
      _isSyncing = false;
      notifySyncStatus();
    }

    return { processed: processedCount, pending: queue.length };
  },

  getSyncQueue() {
    return lsSyncQueueGet();
  },

  clearSyncQueue() {
    lsSyncQueueSet([]);
    notifySyncStatus();
  },

  getSyncStatus() {
    const queue = lsSyncQueueGet();
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    return {
      online: isOnline,
      syncing: _isSyncing,
      pendingCount: queue.length,
      mode: this.mode,
    };
  },

  onSyncStatusChange(fn) {
    if (typeof fn === "function") {
      _syncListeners.push(fn);
      try {
        fn(this.getSyncStatus());
      } catch (e) {}
    }
  },
};

if (typeof window !== "undefined") {
  window.Storage = Storage;
  window.Auth = Auth;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    Storage,
    Auth,
    LS_KEYS,
    LS_SYNC_QUEUE_KEY,
    lsSyncQueueGet,
    lsSyncQueueSet,
    enqueueSyncOp,
    isNetworkError,
    executeRemoteSyncItem,
  };
}
