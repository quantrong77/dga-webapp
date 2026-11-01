/* storage/storage-remote.js — Thao tác giao tiếp từ xa qua Google Apps Script Web App (REST). */

/** GET với action= (+ token nếu có) trong query string — dùng cho các thao tác đọc. */
async function gsheetGet(action, params) {
  const qs = new URLSearchParams({ action, ...(params || {}) });
  if (_authToken) qs.set("token", _authToken);
  const res = await fetch(gsheetUrl() + "?" + qs.toString(), { method: "GET" });
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

/**
 * POST cho các thao tác ghi (+ token nếu đã đăng nhập). Dùng Content-Type: text/plain
 * (thay vì application/json) để trình duyệt coi đây là "simple request", KHÔNG gửi
 * preflight OPTIONS trước — vì Google Apps Script Web App không tự xử lý OPTIONS,
 * preflight sẽ bị chặn nếu dùng application/json. Phía Apps Script (Code.gs) tự
 * JSON.parse(e.postData.contents).
 */
async function gsheetPost(action, payload) {
  const body = { action, ...payload };
  if (_authToken) body.token = _authToken;
  const res = await fetch(gsheetUrl(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
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
