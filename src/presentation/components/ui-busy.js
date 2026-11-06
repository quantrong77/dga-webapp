/* ui-busy.js — Chỉ báo xoay "Đang lưu.../Đang cập nhật..." dùng chung cả app. Bọc các hàm của
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
  if (!active) {
    _busyTimer = setTimeout(() => el.classList.add("hidden"), BUSY_HIDE_DELAY_MS);
    return;
  }
  // Đang ghi thì luôn báo việc ghi, dù có lượt đọc chạy song song.
  $("busyIndicatorText").textContent = busyIsWriting() ? _busyWriteLabels[_busyWriteLabels.length - 1] : "Đang cập nhật dữ liệu...";
  if (el.classList.contains("hidden")) {
    _busyTimer = setTimeout(() => el.classList.remove("hidden"), BUSY_SHOW_DELAY_MS);
  }
}

function busyWrap(owner, name, label) {
  const original = owner[name];
  owner[name] = async function busyWrapped(...args) {
    if (label) _busyWriteLabels.push(label);
    else _busyReadCount++;
    busyRender();
    try {
      return await original.apply(this, args);
    } finally {
      if (label) _busyWriteLabels.splice(_busyWriteLabels.lastIndexOf(label), 1);
      else _busyReadCount--;
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

  // Bấm lại nút chính trong lúc đang ghi sẽ gửi trùng (lưu 2 lần), nên bỏ qua cú bấm đó.
  document.addEventListener("click", (e) => {
    if (!busyIsWriting()) return;
    const btn = e.target.closest && e.target.closest(".btn.primary, .btn.danger");
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
}
