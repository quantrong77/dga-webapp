/* ui-busy.js — Chỉ báo tải dùng chung cả app: mũi tên động trên header, sát bên trái nút Database (xuống = đang tải
   dữ liệu, lên = đang lưu/xóa/tải file lên). Bọc các hàm của
   Storage/Auth một lần duy nhất ở đây, nên mọi form đều có chỉ báo mà không phải sửa từng nơi, và
   hàm mới thêm theo đúng quy tắc đặt tên (add/save/delete/upload/list) tự có luôn. Đăng nhập không
   nằm trong danh sách vì đã có lớp chờ riêng (setAuthLoading(), ui-auth.js). */

const BUSY_SHOW_DELAY_MS = 150; // thao tác nhanh hơn mức này (chế độ thử nghiệm) thì không nháy lên
const BUSY_HIDE_DELAY_MS = 200; // nối liền các lượt gọi kế tiếp (lưu xong rồi tải lại) thành 1 lần hiện
const BUSY_AUTH_LABELS = {
  changePassword: "Đang đổi mật khẩu...",
  adminResetPassword: "Đang đặt lại mật khẩu...",
  adminCreateUser: "Đang tạo tài khoản...",
  setUserRole: "Đang lưu...",
  deleteUser: "Đang xóa...",
  syncSupabase: "Đang đồng bộ sang Supabase...",
};

let _busyWriteLabels = [];
let _busyReadCount = 0;
let _busyTimer = null;

/* % tải. Máy chủ (Apps Script / on-premise) không báo được số byte đã truyền, nên % tính theo SỐ LƯỢT GỌI trong 1 đợt
   chờ: mỗi lượt xong = 1 phần; lượt đang chờ nhích dần theo thời gian (tối đa 90% phần của nó, không bao giờ tự
   chạm mốc kế tiếp). % chỉ tăng, chỉ đạt 100% khi MỌI lượt đã xong; đợt chờ kết thúc (ẩn vòng) thì đặt lại 0. */
const BUSY_TRICKLE_MS = 1500;
let _busyTotal = 0;
let _busyDone = 0;
let _busyPending = []; // thời điểm bắt đầu của các lượt đang chờ
let _busyShownPct = 0;
let _busyTick = null;

/** % ước lượng (0–100) của 1 đợt chờ — hàm thuần, có test. */
function busyEstimatePct(total, done, pendingElapsedMs) {
  if (!total) return 0;
  const partial = pendingElapsedMs.reduce((s, ms) => s + 0.9 * (1 - Math.exp(-Math.max(0, ms) / BUSY_TRICKLE_MS)), 0);
  return Math.min(100, ((done + partial) / total) * 100);
}

let _busyLabel = "Đang cập nhật dữ liệu...";

function busyPaintPct(pct) {
  _busyShownPct = Math.max(_busyShownPct, pct);
  const v = Math.round(_busyShownPct);
  const ring = $("busyRing");
  if (ring) ring.setAttribute("aria-valuenow", String(v));
  const el = $("busyIndicator");
  if (el) el.title = `${_busyLabel} (${v}%)`;
}

function busyUpdatePct() {
  const now = Date.now();
  const active = _busyPending.length > 0;
  // Còn lượt đang chờ thì giữ dưới 100% (tránh hiện 100% rồi vẫn quay).
  const pct = busyEstimatePct(_busyTotal, _busyDone, _busyPending.map((t) => now - t));
  busyPaintPct(active ? Math.min(pct, 99) : pct);
}

/** Chỗ đặt chỉ báo: máy tính — ngay bên trái nút Database (#storageBadge, trong cụm nút bên phải header); điện thoại —
 *  cụm nút đó nằm trong menu "⋯" (thường đóng) nên dời ra ngay bên trái nút ⋯ (#btnHeaderMenu). */
function busyPlaceOnHeader() {
  const el = $("busyIndicator");
  if (!el || typeof window === "undefined") return;
  const narrow = window.matchMedia && window.matchMedia("(max-width: 800px)").matches;
  const anchor = narrow ? $("btnHeaderMenu") : $("storageBadge");
  if (anchor && anchor.previousElementSibling !== el) anchor.before(el);
}

/** Nhãn cho 1 hàm của Storage; null = hàm tiện ích, không phải lượt gọi cần chờ. */
function busyStorageLabel(name) {
  if (/^(add|save)/.test(name)) return "Đang lưu...";
  if (/^delete/.test(name)) return "Đang xóa...";
  if (/^upload/.test(name)) return "Đang tải file lên...";
  return null;
}

function busyIsWriting() {
  return _busyWriteLabels.length > 0;
}

function busyRender() {
  const el = $("busyIndicator");
  const active = busyIsWriting() || _busyReadCount > 0;
  document.body.classList.toggle("is-saving", busyIsWriting());
  clearTimeout(_busyTimer);
  busyUpdatePct();
  if (!active) {
    clearInterval(_busyTick);
    _busyTick = null;
    _busyTimer = setTimeout(() => {
      el.classList.add("hidden");
      // Kết thúc đợt chờ → đợt sau đếm lại từ 0%.
      _busyTotal = 0;
      _busyDone = 0;
      _busyShownPct = 0;
      busyPaintPct(0);
    }, BUSY_HIDE_DELAY_MS);
    return;
  }
  if (!_busyTick) _busyTick = setInterval(busyUpdatePct, 120);
  // Đang ghi thì luôn báo việc ghi, dù có lượt đọc chạy song song.
  const label = busyIsWriting() ? _busyWriteLabels[_busyWriteLabels.length - 1] : "Đang cập nhật dữ liệu...";
  if ($("busyIndicatorText").textContent !== label) $("busyIndicatorText").textContent = label;
  _busyLabel = label;
  el.title = `${label} (${Math.round(_busyShownPct)}%)`;
  if (el.classList.contains("hidden")) {
    _busyTimer = setTimeout(() => {
      busyPlaceOnHeader();
      el.classList.remove("hidden");
    }, BUSY_SHOW_DELAY_MS);
  }
}

function busyWrap(owner, name, label) {
  const original = owner[name];
  owner[name] = async function busyWrapped(...args) {
    if (label) _busyWriteLabels.push(label);
    else _busyReadCount++;
    const startedAt = Date.now();
    _busyTotal++;
    _busyPending.push(startedAt);
    busyRender();
    try {
      return await original.apply(this, args);
    } finally {
      if (label) _busyWriteLabels.splice(_busyWriteLabels.lastIndexOf(label), 1);
      else _busyReadCount--;
      _busyPending.splice(_busyPending.indexOf(startedAt), 1);
      _busyDone++;
      busyRender();
    }
  };
}

/** Gọi 1 lần ở init() (ui-auth.js), trước mọi lượt gọi Storage/Auth. */
function setupBusyIndicator() {
  Object.keys(Storage).forEach((name) => {
    if (typeof Storage[name] !== "function") return;
    const label = busyStorageLabel(name);
    if (label || /^list/.test(name)) busyWrap(Storage, name, label);
  });
  Object.keys(BUSY_AUTH_LABELS).forEach((name) => busyWrap(Auth, name, BUSY_AUTH_LABELS[name]));
  // Đổi cỡ cửa sổ / xoay màn hình qua mốc 800px → dời chỉ báo về đúng chỗ (cạnh nút Database hoặc nút ⋯).
  busyPlaceOnHeader();
  window.addEventListener("resize", busyPlaceOnHeader);

  // Bấm lại nút chính trong lúc đang ghi sẽ gửi trùng (lưu 2 lần), nên bỏ qua cú bấm đó.
  document.addEventListener("click", (e) => {
    if (!busyIsWriting()) return;
    const btn = e.target.closest && e.target.closest(".btn.primary, .btn.danger");
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
}
