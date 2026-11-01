/* storage.js — Facade Repository chính cho Data Access Tier.
 * Lắp ráp các driver từ storage/:
 *   - storage/storage-core.js
 *   - storage/storage-remote.js
 *   - storage/storage-local.js
 *   - storage/storage-offline.js
 *   - storage/storage-auth.js
 * Cung cấp window.Storage và window.Auth thống nhất, giữ 100% tương thích ngược.
 */

if (typeof module !== "undefined" && module.exports) {
  const core = require("./storage/storage-core");
  Object.assign(global, core);
  const remote = require("./storage/storage-remote");
  Object.assign(global, remote);
  const local = require("./storage/storage-local");
  Object.assign(global, local);
  const offline = require("./storage/storage-offline");
  Object.assign(global, offline);
  const auth = require("./storage/storage-auth");
  Object.assign(global, auth);
}

const Storage = {
  mode: (typeof hasLocalServerConfig === "function" && hasLocalServerConfig()) ? "local-server" : hasGsheetConfig() ? "gsheet" : hasSupabaseConfig() ? "supabase" : "local",

  async listMeasurements() {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      try {
        const data = await gsheetGet("listMeasurements");
        lsSet(LS_KEYS.measurements, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Mất kết nối mạng: trả về measurements từ bộ nhớ đệm ngoại tuyến (localStorage)");
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.measurements);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("measurements").select("*").order("sample_date", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.measurements, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Mất kết nối mạng: trả về measurements từ bộ nhớ đệm ngoại tuyến (localStorage)");
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.measurements);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.measurements);
  },

  async addMeasurement(m) {
    // Dùng chung cho cả TẠO MỚI và SỬA/LƯU LẠI 1 bản ghi đã có (không có
    // updateMeasurement() riêng — khi sửa, m.id là id bản ghi cũ nên phải UPDATE
    // đúng dòng đó, không được tạo thêm dòng mới trùng thiết bị/ngày đo).
    const isEdit = !!m.id;
    const record = normalizeGasKeys({ ...m, id: m.id || uid(), created_at: m.created_at || new Date().toISOString() });

    // Lưu ngay vào bộ nhớ cục bộ để UI phản ánh tức thì (Optimistic UI)
    const all = lsGet(LS_KEYS.measurements);
    const idx = isEdit ? all.findIndex((r) => r.id === record.id) : -1;
    if (idx >= 0) all[idx] = record; else all.push(record);
    lsSet(LS_KEYS.measurements, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addMeasurement", { record });
        return record;
      }
      try {
        const res = await gsheetPost("addMeasurement", { record });
        return res || record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addMeasurement", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addMeasurement", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("measurements").upsert(record).select();
        if (error) throw error;
        if (data && data[0]) {
          const freshIdx = all.findIndex((r) => r.id === record.id);
          if (freshIdx >= 0) { all[freshIdx] = data[0]; lsSet(LS_KEYS.measurements, all); }
          return data[0];
        }
        return record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addMeasurement", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteMeasurement(id) {
    const all = lsGet(LS_KEYS.measurements).filter((r) => r.id !== id);
    lsSet(LS_KEYS.measurements, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteMeasurement", { id });
        return;
      }
      try {
        await gsheetPost("deleteMeasurement", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteMeasurement", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteMeasurement", { id });
        return;
      }
      try {
        const { error } = await sb().from("measurements").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteMeasurement", { id });
          return;
        }
        throw err;
      }
    }
  },

  async listStandards() {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      try {
        const data = await gsheetGet("listStandards");
        lsSet(LS_KEYS.standards, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.standards);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("manufacturer_standards").select("*");
        if (error) throw error;
        lsSet(LS_KEYS.standards, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.standards);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.standards);
  },

  async saveStandard(s) {
    const record = { ...s, id: s.id || uid() };
    const all = lsGet(LS_KEYS.standards);
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.push(record);
    lsSet(LS_KEYS.standards, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveStandard", { record });
        return record;
      }
      try {
        return await gsheetPost("saveStandard", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveStandard", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveStandard", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("manufacturer_standards").upsert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveStandard", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteStandard(id) {
    const all = lsGet(LS_KEYS.standards).filter((r) => r.id !== id);
    lsSet(LS_KEYS.standards, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteStandard", { id });
        return;
      }
      try {
        await gsheetPost("deleteStandard", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteStandard", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteStandard", { id });
        return;
      }
      try {
        const { error } = await sb().from("manufacturer_standards").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteStandard", { id });
          return;
        }
        throw err;
      }
    }
  },

  // -------------------------------------------------------------------
  // "Cấu hình quy định" (tab riêng, xem ui/ui-regulation-config.js) — cho phép Admin
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
    let rows;
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      try {
        rows = await gsheetGet("listRegulationConfig");
        lsSet(LS_KEYS.regulationConfig, rows || []);
      } catch (err) {
        if (isNetworkError(err)) {
          rows = lsGet(LS_KEYS.regulationConfig);
        } else {
          throw err;
        }
      }
    } else if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("regulation_config").select("*");
        if (error) throw error;
        rows = data || [];
        lsSet(LS_KEYS.regulationConfig, rows);
      } catch (err) {
        if (isNetworkError(err)) {
          rows = lsGet(LS_KEYS.regulationConfig);
        } else {
          throw err;
        }
      }
    } else {
      rows = lsGet(LS_KEYS.regulationConfig);
    }
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
    const wire = {
      id: rec.id,
      citation: rec.citation || "",
      values_json: JSON.stringify(rec.values || {}),
      updated_at: new Date().toISOString(),
    };
    const all = lsGet(LS_KEYS.regulationConfig);
    const idx = all.findIndex((r) => r.id === wire.id);
    if (idx >= 0) all[idx] = wire; else all.push(wire);
    lsSet(LS_KEYS.regulationConfig, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveRegulationConfig", { record: wire });
        return;
      }
      try {
        await gsheetPost("saveRegulationConfig", { record: wire });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveRegulationConfig", { record: wire });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveRegulationConfig", { record: wire });
        return;
      }
      try {
        const { error } = await sb().from("regulation_config").upsert(wire);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveRegulationConfig", { record: wire });
          return;
        }
        throw err;
      }
    }
  },

  /** Xóa bản ghi ghi đè — dùng cho nút "Khôi phục mặc định" (xóa override thì lần nạp
   *  sau tự dùng lại hằng số mặc định trong dga-logic.js). */
  async deleteRegulationConfig(id) {
    const all = lsGet(LS_KEYS.regulationConfig).filter((r) => r.id !== id);
    lsSet(LS_KEYS.regulationConfig, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteRegulationConfig", { id });
        return;
      }
      try {
        await gsheetPost("deleteRegulationConfig", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteRegulationConfig", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteRegulationConfig", { id });
        return;
      }
      try {
        const { error } = await sb().from("regulation_config").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteRegulationConfig", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Danh mục Trạm (MaTram/TenTram) — dùng để gợi ý/tìm kiếm ở ô "Trạm", không bắt buộc.
  async listStations() {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      try {
        const data = await gsheetGet("listStations");
        lsSet(LS_KEYS.stations, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.stations);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("stations").select("*");
        if (error) throw error;
        lsSet(LS_KEYS.stations, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.stations);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.stations);
  },

  async saveStation(s) {
    const record = { ...s, id: s.id || uid() };
    const all = lsGet(LS_KEYS.stations);
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx >= 0) all[idx] = record; else all.push(record);
    lsSet(LS_KEYS.stations, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveStation", { record });
        return record;
      }
      try {
        return await gsheetPost("saveStation", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveStation", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("saveStation", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("stations").upsert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("saveStation", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteStation(id) {
    const all = lsGet(LS_KEYS.stations).filter((r) => r.id !== id);
    lsSet(LS_KEYS.stations, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteStation", { id });
        return;
      }
      try {
        await gsheetPost("deleteStation", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteStation", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteStation", { id });
        return;
      }
      try {
        const { error } = await sb().from("stations").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteStation", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Thí nghiệm dầu MBA (độ ẩm/tgδ 90°C/điện áp chọc thủng) — Điều 46/47/50, QĐ1901.
  async listOilTests() {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      try {
        const data = await gsheetGet("listOilTests");
        lsSet(LS_KEYS.oilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.oilTests);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("oil_tests").select("*").order("sample_date", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.oilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.oilTests);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.oilTests);
  },

  async addOilTest(t) {
    const record = { ...t, id: t.id || uid(), created_at: new Date().toISOString() };
    const all = lsGet(LS_KEYS.oilTests);
    all.push(record);
    lsSet(LS_KEYS.oilTests, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addOilTest", { record });
        return record;
      }
      try {
        return await gsheetPost("addOilTest", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addOilTest", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("oil_tests").insert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteOilTest(id) {
    const all = lsGet(LS_KEYS.oilTests).filter((r) => r.id !== id);
    lsSet(LS_KEYS.oilTests, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteOilTest", { id });
        return;
      }
      try {
        await gsheetPost("deleteOilTest", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteOilTest", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteOilTest", { id });
        return;
      }
      try {
        const { error } = await sb().from("oil_tests").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteOilTest", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Thí nghiệm dầu khoang điều áp dưới tải (OLTC) — Điều 37/Bảng 49, QĐ1901. Bảng
  // riêng khỏi oil_tests (dầu thùng dầu chính) vì có thêm điểm lấy mẫu + pha.
  async listOltcOilTests() {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      try {
        const data = await gsheetGet("listOltcOilTests");
        lsSet(LS_KEYS.oltcOilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.oltcOilTests);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("oltc_oil_tests").select("*").order("sample_date", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.oltcOilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.oltcOilTests);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.oltcOilTests);
  },

  async addOltcOilTest(t) {
    const record = { ...t, id: t.id || uid(), created_at: new Date().toISOString() };
    const all = lsGet(LS_KEYS.oltcOilTests);
    all.push(record);
    lsSet(LS_KEYS.oltcOilTests, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addOltcOilTest", { record });
        return record;
      }
      try {
        return await gsheetPost("addOltcOilTest", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addOltcOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addOltcOilTest", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("oltc_oil_tests").insert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addOltcOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteOltcOilTest(id) {
    const all = lsGet(LS_KEYS.oltcOilTests).filter((r) => r.id !== id);
    lsSet(LS_KEYS.oltcOilTests, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteOltcOilTest", { id });
        return;
      }
      try {
        await gsheetPost("deleteOltcOilTest", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteOltcOilTest", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteOltcOilTest", { id });
        return;
      }
      try {
        const { error } = await sb().from("oltc_oil_tests").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteOltcOilTest", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Thí nghiệm dầu cách điện TI/TU (biến dòng điện/biến điện áp kiểu kín, cách điện
  // dầu) — Điều 10/11 QĐ1901 (chỉ dẫn chiếu "theo quy định nhà sản xuất", không có
  // bảng số mặc định — xem DGA.evaluateInstrumentOilTest() ở dga-logic.js). Bảng
  // RIÊNG khỏi oil_tests (MBA) vì khác hẳn cấu trúc (equipment_type TI/TU thay cấp
  // điện áp/trạng thái dầu, không có has_membrane_n2/oil_sample_point).
  async listInstrumentOilTests() {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      try {
        const data = await gsheetGet("listInstrumentOilTests");
        lsSet(LS_KEYS.instrumentOilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.instrumentOilTests);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("instrument_oil_tests").select("*").order("sample_date", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.instrumentOilTests, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.instrumentOilTests);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.instrumentOilTests);
  },

  async addInstrumentOilTest(t) {
    // Có id sẵn = cập nhật bản ghi đã có (sửa, hoặc nhập lại đúng BBTN 3 pha đã lưu): giữ
    // created_at gốc và ghi đè đúng dòng đó, không tạo dòng trùng.
    const record = { ...t, id: t.id || uid(), created_at: t.created_at || new Date().toISOString() };
    const all = lsGet(LS_KEYS.instrumentOilTests).filter((r) => r.id !== record.id);
    all.push(record);
    lsSet(LS_KEYS.instrumentOilTests, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addInstrumentOilTest", { record });
        return record;
      }
      try {
        return await gsheetPost("addInstrumentOilTest", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addInstrumentOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addInstrumentOilTest", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("instrument_oil_tests").upsert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addInstrumentOilTest", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteInstrumentOilTest(id) {
    const all = lsGet(LS_KEYS.instrumentOilTests).filter((r) => r.id !== id);
    lsSet(LS_KEYS.instrumentOilTests, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteInstrumentOilTest", { id });
        return;
      }
      try {
        await gsheetPost("deleteInstrumentOilTest", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteInstrumentOilTest", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteInstrumentOilTest", { id });
        return;
      }
      try {
        const { error } = await sb().from("instrument_oil_tests").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteInstrumentOilTest", { id });
          return;
        }
        throw err;
      }
    }
  },

  // Góp ý người dùng (tab "Người dùng phản hồi") — nội dung tự do + 1 ảnh minh họa tùy
  // chọn (xem uploadFeedbackImage() bên dưới). KHÔNG dùng prepareOwnedRecord()/audit như
  // measurements (feedback không có khái niệm "sửa lại" — chỉ tạo mới và Admin xóa được),
  // nên phía gsheet (Code.gs) vẫn gắn created_by nếu đã đăng nhập nhưng không giới hạn ai
  // sửa vì client không cung cấp tính năng sửa.
  async listFeedback() {
    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      try {
        const data = await gsheetGet("listFeedback");
        lsSet(LS_KEYS.feedback, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.feedback);
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      try {
        const { data, error } = await sb().from("feedback").select("*").order("created_at", { ascending: true });
        if (error) throw error;
        lsSet(LS_KEYS.feedback, data || []);
        return data || [];
      } catch (err) {
        if (isNetworkError(err)) {
          notifySyncStatus({ online: false });
          return lsGet(LS_KEYS.feedback);
        }
        throw err;
      }
    }
    return lsGet(LS_KEYS.feedback);
  },

  async addFeedback(f) {
    const record = { ...f, id: f.id || uid(), created_at: new Date().toISOString() };
    const all = lsGet(LS_KEYS.feedback);
    all.push(record);
    lsSet(LS_KEYS.feedback, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addFeedback", { record });
        return record;
      }
      try {
        return await gsheetPost("addFeedback", { record });
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addFeedback", { record });
          return record;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("addFeedback", { record });
        return record;
      }
      try {
        const { data, error } = await sb().from("feedback").insert(record).select();
        if (error) throw error;
        return data && data[0] ? data[0] : record;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("addFeedback", { record });
          return record;
        }
        throw err;
      }
    }
    return record;
  },

  async deleteFeedback(id) {
    const all = lsGet(LS_KEYS.feedback).filter((r) => r.id !== id);
    lsSet(LS_KEYS.feedback, all);

    if ((this.mode === "gsheet" || this.mode === "local-server")) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteFeedback", { id });
        return;
      }
      try {
        await gsheetPost("deleteFeedback", { id });
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteFeedback", { id });
          return;
        }
        throw err;
      }
    }
    if (this.mode === "supabase") {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSyncOp("deleteFeedback", { id });
        return;
      }
      try {
        const { error } = await sb().from("feedback").delete().eq("id", id);
        if (error) throw error;
        return;
      } catch (err) {
        if (isNetworkError(err)) {
          enqueueSyncOp("deleteFeedback", { id });
          return;
        }
        throw err;
      }
    }
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
