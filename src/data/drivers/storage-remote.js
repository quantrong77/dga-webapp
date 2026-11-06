/* src/data/drivers/storage-remote.js — Thao tác giao tiếp từ xa qua Google Apps Script Web App hoặc Máy chủ nội bộ On-Premise (REST). */

/** GET với action= (+ token nếu có) trong query string — dùng cho các thao tác đọc. */
async function gsheetGet(action, params) {
  const qs = new URLSearchParams({ action, ...(params || {}) });
  if (_authToken) qs.set("token", _authToken);
  const baseUrl = gsheetUrl();
  const sep = baseUrl.includes("?") ? "&" : "?";
  let res;
  try {
    res = await fetch(baseUrl + sep + qs.toString(), { method: "GET" });
  } catch (err) {
    if (typeof hasLocalServerConfig === "function" && hasLocalServerConfig()) {
      throw new Error("Không thể kết nối đến Máy chủ nội bộ tại " + baseUrl + ". Vui lòng kiểm tra file chay_dga_offline.bat đang được bật.");
    }
    throw err;
  }
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

/**
 * POST cho các thao tác ghi (+ token nếu đã đăng nhập).
 */
async function gsheetPost(action, payload) {
  const body = { action, ...payload };
  if (_authToken) body.token = _authToken;
  const baseUrl = gsheetUrl();
  let res;
  try {
    res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (typeof hasLocalServerConfig === "function" && hasLocalServerConfig()) {
      throw new Error("Không thể kết nối đến Máy chủ nội bộ tại " + baseUrl + ". Vui lòng kiểm tra file chay_dga_offline.bat đang được bật.");
    }
    throw err;
  }
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    gsheetGet,
    gsheetPost,
  };
}
