/* storage/storage-offline.js — Quản lý hàng đợi ngoại tuyến (Offline Sync Queue) và thực thi lại tác vụ từ xa. */

const LS_SYNC_QUEUE_KEY = "dga_sync_queue_v1";

function lsSyncQueueGet() {
  try {
    const raw = localStorage.getItem(LS_SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("localStorage read failed (sync queue)", e);
    return [];
  }
}

function lsSyncQueueSet(queue) {
  try {
    localStorage.setItem(LS_SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn("localStorage write failed (sync queue)", e);
  }
}

function enqueueSyncOp(action, payload) {
  const queue = lsSyncQueueGet();
  const item = {
    id: "sq_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
    action,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  queue.push(item);
  lsSyncQueueSet(queue);
  if (typeof notifySyncStatus === "function") {
    notifySyncStatus();
  }
  return item;
}

/** Thực thi lại 1 tác vụ từ hàng đợi đồng bộ lên server (Google Sheets hoặc Supabase). */
async function executeRemoteSyncItem(item) {
  const { action, payload } = item;
  const currentMode = typeof Storage !== "undefined" ? Storage.mode : (hasGsheetConfig() ? "gsheet" : hasSupabaseConfig() ? "supabase" : "local");
  if (currentMode === "gsheet") {
    if (action === "addMeasurement") return await gsheetPost("addMeasurement", payload);
    if (action === "deleteMeasurement") return await gsheetPost("deleteMeasurement", payload);
    if (action === "saveStandard") return await gsheetPost("saveStandard", payload);
    if (action === "deleteStandard") return await gsheetPost("deleteStandard", payload);
    if (action === "saveStation") return await gsheetPost("saveStation", payload);
    if (action === "deleteStation") return await gsheetPost("deleteStation", payload);
    if (action === "addOilTest") return await gsheetPost("addOilTest", payload);
    if (action === "deleteOilTest") return await gsheetPost("deleteOilTest", payload);
    if (action === "addOltcOilTest") return await gsheetPost("addOltcOilTest", payload);
    if (action === "deleteOltcOilTest") return await gsheetPost("deleteOltcOilTest", payload);
    if (action === "addInstrumentOilTest") return await gsheetPost("addInstrumentOilTest", payload);
    if (action === "deleteInstrumentOilTest") return await gsheetPost("deleteInstrumentOilTest", payload);
    if (action === "saveRegulationConfig") return await gsheetPost("saveRegulationConfig", payload);
    if (action === "deleteRegulationConfig") return await gsheetPost("deleteRegulationConfig", payload);
    if (action === "addFeedback") return await gsheetPost("addFeedback", payload);
    if (action === "deleteFeedback") return await gsheetPost("deleteFeedback", payload);
    if (action === "uploadAttachment") {
      const res = await gsheetPost("uploadAttachment", payload);
      if (res && res.url && payload.measurementId) {
        await gsheetPost("addMeasurement", {
          record: { id: payload.measurementId, bbtn_url: res.url, bbtn_name: res.name || payload.filename, bbtn_file_id: res.id || null },
        });
      }
      return res;
    }
  } else if (currentMode === "supabase") {
    if (action === "addMeasurement") {
      const { data, error } = await sb().from("measurements").upsert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteMeasurement") {
      const { error } = await sb().from("measurements").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "saveStandard") {
      const { data, error } = await sb().from("manufacturer_standards").upsert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteStandard") {
      const { error } = await sb().from("manufacturer_standards").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "saveStation") {
      const { data, error } = await sb().from("stations").upsert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteStation") {
      const { error } = await sb().from("stations").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "addOilTest") {
      let { data, error } = await sb().from("oil_tests").insert(payload.record).select();
      if (error && payload.record && "device_info" in payload.record && /device_info/.test(String(error.message || ""))) {
        // Bảng chưa có cột device_info (chưa chạy supabase/mirror-setup.sql) — vẫn đồng bộ được số liệu thí nghiệm
        const { device_info, ...rest } = payload.record;
        ({ data, error } = await sb().from("oil_tests").insert(rest).select());
      }
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteOilTest") {
      const { error } = await sb().from("oil_tests").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "addOltcOilTest") {
      const { data, error } = await sb().from("oltc_oil_tests").insert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteOltcOilTest") {
      const { error } = await sb().from("oltc_oil_tests").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "addInstrumentOilTest") {
      const { data, error } = await sb().from("instrument_oil_tests").upsert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteInstrumentOilTest") {
      const { error } = await sb().from("instrument_oil_tests").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "saveRegulationConfig") {
      const { error } = await sb().from("regulation_config").upsert(payload.record);
      if (error) throw error;
      return;
    }
    if (action === "deleteRegulationConfig") {
      const { error } = await sb().from("regulation_config").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
    if (action === "addFeedback") {
      const { data, error } = await sb().from("feedback").insert(payload.record).select();
      if (error) throw error;
      return data && data[0];
    }
    if (action === "deleteFeedback") {
      const { error } = await sb().from("feedback").delete().eq("id", payload.id);
      if (error) throw error;
      return;
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LS_SYNC_QUEUE_KEY,
    lsSyncQueueGet,
    lsSyncQueueSet,
    enqueueSyncOp,
    executeRemoteSyncItem,
  };
}
