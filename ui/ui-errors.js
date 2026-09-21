/* ui-errors.js — Xử lý lỗi TẬP TRUNG phía trình duyệt.
 *
 * Trước đây lỗi được báo theo nhiều kiểu (58 chỗ alert() chặn giao diện, 10 chỗ toast, vài
 * catch nuốt lỗi) và KHÔNG có handler toàn cục — lỗi ở callback sự kiện/Promise không được
 * await biến mất không dấu vết. File này gom về 1 cách duy nhất:
 *
 *   notifyError(message)   — báo 1 thông điệp lỗi/cảnh báo cho người dùng bằng toast đỏ (không
 *                            chặn giao diện như alert). Thay thế trực tiếp cho alert() ở mọi
 *                            chỗ chỉ để "hiện thông báo"; hộp xác nhận (confirm) giữ nguyên.
 *   reportError(err, ctx)  — dùng trong catch: ghi console.error kèm ngữ cảnh + hiện toast.
 *   installGlobalErrorHandlers() — đăng ký "error" và "unhandledrejection" 1 lần lúc nạp file.
 *
 * Chống lặp: cùng 1 thông điệp trong vòng ERROR_TOAST_DEDUPE_MS chỉ hiện 1 toast (tránh
 * "bão" toast khi 1 lỗi lặp liên tục, ví dụ trong vòng lặp render).
 *
 * Nạp NGAY SAU config.js (trước logic/ và ui/) để bắt được cả lỗi lúc khởi động. showToast()
 * nằm ở ui-auth.js nạp sau — nên chỉ gọi lúc có lỗi thật (khi đó đã có), và nếu vẫn chưa có
 * thì rơi về console.error + 1 alert duy nhất (xem notifyError). Bộ xử lý lỗi KHÔNG được
 * ném thêm lỗi (mọi thao tác hiển thị đều bọc try/catch) để tránh vòng lặp vô hạn. */

const ERROR_TOAST_DEDUPE_MS = 2000;
const ERROR_TOAST_MAP_MAX = 50;

const _recentErrorToasts = new Map(); // thông điệp -> mốc thời gian (ms) lần hiện gần nhất
let _fallbackAlertShown = false;

/** Lấy chuỗi thông điệp đọc được từ bất kỳ giá trị nào bị ném ra (Error, chuỗi, object, null). */
function errorMessageOf(err) {
  if (err === null || err === undefined) return "Lỗi không xác định.";
  if (typeof err === "string") return err || "Lỗi không xác định.";
  if (err.message) return String(err.message);
  try {
    return String(err);
  } catch (e) {
    return "Lỗi không xác định.";
  }
}

/** true nếu thông điệp này CHƯA hiện trong khoảng chống lặp (đồng thời ghi nhận lần hiện này). */
function shouldShowErrorToast(message, now) {
  const last = _recentErrorToasts.get(message);
  if (last !== undefined && now - last < ERROR_TOAST_DEDUPE_MS) return false;
  _recentErrorToasts.set(message, now);
  if (_recentErrorToasts.size > ERROR_TOAST_MAP_MAX) {
    _recentErrorToasts.forEach((t, k) => {
      if (now - t >= ERROR_TOAST_DEDUPE_MS) _recentErrorToasts.delete(k);
    });
  }
  return true;
}

/** Hiện thông điệp lỗi/cảnh báo bằng toast đỏ. Không ném lỗi. */
function notifyError(message) {
  const text = String(message);
  try {
    if (!shouldShowErrorToast(text, Date.now())) return;
    if (typeof showToast === "function") {
      showToast(text, "error");
      return;
    }
  } catch (e) {
    console.error("[DGA] Không hiện được toast lỗi:", e);
  }
  // Dự phòng cuối: showToast chưa sẵn sàng (lỗi rất sớm lúc nạp trang) — chỉ 1 alert duy nhất.
  console.error("[DGA] " + text);
  if (!_fallbackAlertShown && typeof alert === "function") {
    _fallbackAlertShown = true;
    try { alert(text); } catch (e) { /* môi trường không có alert — bỏ qua */ }
  }
}

/** Dùng trong catch: ghi log kỹ thuật (kèm ngữ cảnh) rồi báo người dùng. */
function reportError(err, context) {
  try {
    console.error("[DGA]" + (context ? " " + context : ""), err);
  } catch (e) { /* console không khả dụng — bỏ qua */ }
  const msg = errorMessageOf(err);
  notifyError(context ? context + ": " + msg : msg);
}

/** Đăng ký handler toàn cục. target mặc định là window; truyền đối tượng khác để test. */
function installGlobalErrorHandlers(target) {
  const t = target || (typeof window !== "undefined" ? window : null);
  if (!t || typeof t.addEventListener !== "function") return false;

  t.addEventListener("error", (ev) => {
    try {
      const err = (ev && ev.error) || (ev && ev.message);
      const msg = errorMessageOf(err);
      // Nhiễu vô hại của trình duyệt — không đáng làm phiền người dùng.
      if (/ResizeObserver loop/i.test(msg)) return;
      // "Script error." = lỗi từ script CDN khác nguồn, trình duyệt giấu chi tiết — chỉ ghi log.
      if (msg === "Script error.") {
        console.error("[DGA] Lỗi từ script bên ngoài (thường do CDN/mạng):", ev);
        return;
      }
      reportError(err, "Đã xảy ra lỗi không lường trước");
    } catch (e) { /* không ném thêm lỗi từ chính bộ xử lý lỗi */ }
  });

  t.addEventListener("unhandledrejection", (ev) => {
    try {
      reportError(ev && ev.reason, "Thao tác không hoàn tất");
    } catch (e) { /* như trên */ }
  });
  return true;
}

if (typeof window !== "undefined") installGlobalErrorHandlers(window);

// Export cho Node (dùng để test) — trình duyệt bỏ qua nhánh này.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { errorMessageOf, shouldShowErrorToast, notifyError, reportError, installGlobalErrorHandlers, ERROR_TOAST_DEDUPE_MS };
}
