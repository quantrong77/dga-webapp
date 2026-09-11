/* ui-auth.js — Đăng nhập / phiên đăng nhập / phân quyền (canWrite, canEditRecord...)
   + toast thông báo. Tách ra từ app.js (trước đây tất cả nằm chung 1 file duy nhất)
   để dễ tìm code hơn khi app ngày càng có nhiều tính năng.

   LƯU Ý KIẾN TRÚC — đọc trước khi sửa: các file ui-*.js + app-core.js KHÔNG dùng
   ES module (không có import/export) — mỗi file chỉ là 1 <script> thường, và TẤT CẢ
   cùng chia sẻ 1 scope toàn cục duy nhất (đặc điểm của nhiều thẻ <script> cổ điển
   trên cùng 1 trang: biến let/const và hàm khai báo ở cấp cao nhất của file này vẫn
   gọi thẳng được từ file khác, y hệt như khi còn chung 1 file app.js). Vì vậy:
     - KHÔNG bọc file này trong (function(){...})() riêng — sẽ làm hỏng việc chia sẻ
       biến/hàm giữa các file.
     - KHÔNG khai báo trùng tên biến top-level (let/const) ở 2 file khác nhau.
     - Thứ tự nạp file trong index.html không quan trọng với hầu hết hàm (vì chỉ
       thật sự được GỌI lúc DOMContentLoaded, sau khi mọi file đã nạp xong) — ngoại
       lệ DUY NHẤT là app-core.js phải nạp SAU CÙNG vì dòng cuối của nó
       (document.addEventListener("DOMContentLoaded", init)) cần init() đã được khai
       báo (init() nằm ở file này, ui-auth.js). */

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Danh mục Trạm mặc định (MaTram/TenTram) — chỉ dùng để "gieo" (seed) 1 lần
// duy nhất vào Storage.listStations() nếu danh mục đang trống. Sau đó danh
// mục được quản lý hoàn toàn qua Storage (thêm trạm mới khi người dùng gõ
// tay 1 trạm chưa có), không đọc lại mảng này nữa.
// ---------------------------------------------------------------------
const SEED_STATIONS = [
  ["TBA-01", "TBA 500kV Pleiku"],
  ["TBA-02", "TBA 500kV Pleiku 2"],
  ["TBA-03", "TBA 220kV Chư Sê"],
  ["TBA-04", "TBA 220kV An Khê"],
  ["TBA-05", "TBA 220kV KrôngBuk"],
  ["TBA-06", "TBA 220kV Krông Ana"],
  ["TBA-07", "XT273 NMTĐ Srêpốk 4"],
  ["TBA-08", "TBA 220kV Quy Nhơn"],
  ["TBA-09", "TBA 220kV Phước An"],
  ["TBA-10", "TBA 220kV Phù Mỹ"],
  ["TBA-11", "TBA 220kV Tuy Hòa"],
  ["TBA-12", "TBA 220kV Nha Trang"],
  ["TBA-13", "TBA 500kV Vân Phong"],
  ["TBA-14", "TBA 220kV Vân Phong"],
  ["TBA-15", "TBA 220kV Cam Ranh"],
  ["TBA-16", "TBA 500kV Đắk Nông"],
  ["TBA-17", "TBA 220kV Đắk Nông"],
  ["TBA-18", "TBA 500kV Di Linh"],
  ["TBA-19", "TBA 220kV Bảo Lộc"],
  ["TBA-20", "TBA 220kV Đức Trọng"],
  ["TBA-21", "TBA 500kV Vĩnh Tân"],
  ["TBA-22", "TBA 220kV Phan Thiết"],
  ["TBA-23", "TBA 220kV Hàm Tân"],
  ["TBA-24", "TBA 220kV Phan Rí"],
  ["TBA-25", "TBA 220kV Vĩnh Hảo"],
  ["TBA-26", "TBA 500kV Thuận Nam"],
  ["TBA-27", "TBA 220kV Tháp Chàm"],
  ["TBA-28", "TBA 220kV Ninh Phước"],
  ["TBA-29", "TBA 220kV Phước Thái"],
].map(([ma_tram, ten_tram]) => ({ ma_tram, ten_tram }));

// ---------------------------------------------------------------------
// Đăng nhập / phân quyền — chỉ có tác dụng khi Auth.enabled (chế độ Google
// Sheets, xem storage.js). Ở chế độ Supabase/localStorage, mọi hàm bên dưới
// đều trả về true — hành vi y hệt bản trước khi có đăng nhập.
//
// canWrite(): CHỈ Admin — dùng cho Tiêu chuẩn/Trạm/Quản trị user, và cho nút
// "Xóa" của Đo khí/Dầu MBA/Dầu OLTC (xóa luôn là đặc quyền Admin).
//
// canSaveEntry(): mọi user ĐÃ ĐĂNG NHẬP (không cần Admin) — dùng để cho phép
// Đo khí/Dầu MBA/Dầu OLTC được TỰ NHẬP bản ghi mới. Trong thực tế luôn true
// một khi đã vào được giao diện chính (màn hình đăng nhập chặn từ trước),
// giữ lại hàm riêng để rõ ý định và phòng hờ.
//
// canEditRecord(rec): Admin sửa được mọi bản ghi; user thường chỉ sửa được
// bản ghi do CHÍNH MÌNH nhập (so theo rec.created_by — xem prepareOwnedRecord()
// ở Code.gs, đây chỉ là gợi ý hiển thị nút "Sửa"; quyền thật được kiểm tra lại
// ở server, không tin tưởng tuyệt đối phía client).
// ---------------------------------------------------------------------
function canWrite() {
  return !Auth.enabled || Auth.isAdmin();
}

function currentUserEmail() {
  return (Auth.current && Auth.current.email) || null;
}

function isOwnRecord(rec) {
  const email = currentUserEmail();
  return !!(email && rec && rec.created_by && String(rec.created_by).trim().toLowerCase() === email.trim().toLowerCase());
}

function canSaveEntry() {
  return !Auth.enabled || !!Auth.current;
}

function canEditRecord(rec) {
  return !Auth.enabled || Auth.isAdmin() || isOwnRecord(rec);
}

/** Chuỗi ngắn hiển thị "Người nhập" trong bảng lịch sử — email người tạo bản ghi,
 *  kèm tooltip cho biết ai/lúc nào sửa lần cuối nếu có. Bản ghi cũ (trước khi có
 *  tính năng lưu vết) không có created_by → hiển thị "—". */
function ownerCellHtml(rec) {
  if (!rec.created_by) return `<span class="pill muted" title="Bản ghi cũ, chưa có dữ liệu người nhập">—</span>`;
  const editedLater = rec.updated_by && rec.updated_at && rec.updated_by !== rec.created_by;
  const title = editedLater
    ? `Sửa lần cuối bởi ${rec.updated_by} lúc ${new Date(rec.updated_at).toLocaleString("vi-VN")}`
    : `Nhập lúc ${rec.created_at ? new Date(rec.created_at).toLocaleString("vi-VN") : ""}`;
  return `<span style="font-size:12px;" title="${escapeHtml(title)}">${escapeHtml(rec.created_by)}${editedLater ? " ✎" : ""}</span>`;
}

async function init() {
  setupAuthForms();

  if (!Auth.enabled) {
    $("authOverlay").classList.add("hidden");
    await initApp();
    return;
  }

  Auth.loadSaved();
  const session = await Auth.refresh();
  if (session) {
    $("authOverlay").classList.add("hidden");
    await initApp();
  } else {
    $("authOverlay").classList.remove("hidden");
    initGoogleSignIn();
  }
}

function setupAuthForms() {
  $("linkShowRegister").addEventListener("click", (e) => {
    e.preventDefault();
    $("authLoginForm").classList.add("hidden");
    $("authRegisterForm").classList.remove("hidden");
  });
  $("linkShowLogin").addEventListener("click", (e) => {
    e.preventDefault();
    $("authRegisterForm").classList.add("hidden");
    $("authLoginForm").classList.remove("hidden");
  });

  $("btnAuthLogin").addEventListener("click", async () => {
    const email = $("auth_login_email").value.trim();
    const password = $("auth_login_password").value;
    const errEl = $("authLoginError");
    errEl.classList.add("hidden");
    if (!email || !password) {
      errEl.textContent = "Vui lòng nhập email và mật khẩu.";
      errEl.classList.remove("hidden");
      return;
    }
    setAuthLoading(true, "Đang đăng nhập...");
    try {
      await Auth.login(email, password);
      setAuthLoading(false);
      $("authOverlay").classList.add("hidden");
      showToast("Đăng nhập thành công!");
      await initApp();
    } catch (err) {
      setAuthLoading(false);
      errEl.textContent = err.message || String(err);
      errEl.classList.remove("hidden");
    }
  });

  $("btnAuthRegister").addEventListener("click", async () => {
    const email = $("auth_register_email").value.trim();
    const password = $("auth_register_password").value;
    const errEl = $("authRegisterError");
    errEl.classList.add("hidden");
    if (!email || !password) {
      errEl.textContent = "Vui lòng nhập email và mật khẩu.";
      errEl.classList.remove("hidden");
      return;
    }
    setAuthLoading(true, "Đang đăng ký...");
    try {
      await Auth.register(email, password);
      setAuthLoading(false);
      $("authOverlay").classList.add("hidden");
      showToast("Đăng ký thành công!");
      await initApp();
    } catch (err) {
      setAuthLoading(false);
      errEl.textContent = err.message || String(err);
      errEl.classList.remove("hidden");
    }
  });

  $("btnLogout").addEventListener("click", async () => {
    await Auth.logout();
    // Tải lại trang cho gọn — reset toàn bộ state trong bộ nhớ (danh sách đã
    // nạp, form đang nhập dở...) và quay lại đúng luồng init() từ đầu.
    location.reload();
  });
}

// ---------------------------------------------------------------------
// Đăng nhập bằng Google (Google Identity Services) — tùy chọn, chỉ hiện khi
// config.js có GOOGLE_CLIENT_ID và thư viện GIS tải thành công. Không ảnh hưởng
// gì đến luồng đăng nhập email/mật khẩu hiện có nếu chưa cấu hình.
// ---------------------------------------------------------------------
// initGoogleSignIn() có thể được gọi 2 LẦN theo 2 đường khác nhau, vì thẻ <script>
// của GIS tải bất đồng bộ (async) nên KHÔNG đảm bảo tải xong trước khi init() ở
// trên chạy tới initGoogleSignIn() lần đầu — đây là race condition thật sự, không
// phải trường hợp hiếm (đã xác nhận qua console log thực tế: cảnh báo "Google
// Identity Services chưa sẵn sàng" xuất hiện dù GOOGLE_CLIENT_ID đã cấu hình đúng).
// Nên ngoài lần gọi ở init(), app.js còn đăng ký window.onGoogleLibraryLoad — GIS
// tự động gọi hàm toàn cục này khi thư viện thật sự sẵn sàng, bất kể thứ tự tải.
// Cờ googleSignInInitialized để không khởi tạo/renderButton 2 lần nếu cả 2 đường
// đều thành công (vd: thư viện tải rất nhanh, kịp trước init()).
let googleSignInInitialized = false;
function initGoogleSignIn() {
  if (googleSignInInitialized) return;
  const clientId = window.DGA_CONFIG && window.DGA_CONFIG.GOOGLE_CLIENT_ID;
  if (!clientId) return; // chưa cấu hình -> giữ nguyên UI đăng nhập email/mật khẩu như cũ
  if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
    // Thư viện GIS chưa tải xong tại thời điểm này -> bỏ qua lần này, không chặn
    // đăng nhập email/mật khẩu; window.onGoogleLibraryLoad sẽ thử lại khi tải xong.
    console.warn("Google Identity Services chưa sẵn sàng ở lần gọi này — sẽ tự thử lại khi tải xong.");
    return;
  }
  try {
    google.accounts.id.initialize({ client_id: clientId, callback: onGoogleCredential });
    google.accounts.id.renderButton($("googleSignInBtn"), {
      theme: "outline", size: "large", text: "continue_with", width: 320, locale: "vi",
    });
    $("googleSignInWrap").classList.remove("hidden");
    googleSignInInitialized = true;
  } catch (err) {
    console.warn("Không khởi tạo được Đăng nhập Google:", err);
  }
}

// GIS tự động gọi window.onGoogleLibraryLoad ngay khi thư viện tải xong — đây là
// cách chính thức của Google để xử lý đúng thứ tự tải bất đồng bộ (xem thẻ <script
// async> trong index.html). Nếu người dùng đã đăng nhập xong trước khi hàm này
// chạy, initGoogleSignIn() vẫn chạy an toàn (chỉ gắn nút vào overlay đang ẩn).
window.onGoogleLibraryLoad = initGoogleSignIn;

/** Callback của google.accounts.id — nhận credential (ID token JWT), gửi lên Apps
 *  Script để xác thực + tự động đăng ký/đăng nhập (xem actionGoogleLogin trong Code.gs). */
async function onGoogleCredential(response) {
  const errEl = $("authLoginError");
  errEl.classList.add("hidden");
  setAuthLoading(true, "Đang xác thực với Google...");
  try {
    await Auth.loginWithGoogle(response.credential);
    setAuthLoading(false);
    $("authOverlay").classList.add("hidden");
    showToast("Đăng nhập thành công!");
    await initApp();
  } catch (err) {
    setAuthLoading(false);
    errEl.textContent = "Đăng nhập Google thất bại: " + ((err && err.message) || err);
    errEl.classList.remove("hidden");
  }
}

/** Hiện/ẩn spinner phủ lên thẻ đăng nhập trong lúc chờ server — cho người dùng biết
 *  thao tác đang được xử lý (đăng nhập/đăng ký/xác thực Google đều dùng chung). */
function setAuthLoading(isLoading, message) {
  $("authLoadingOverlay").classList.toggle("hidden", !isLoading);
  if (message) $("authLoadingText").textContent = message;
  $("btnAuthLogin").disabled = isLoading;
  $("btnAuthRegister").disabled = isLoading;
}

/** Thông báo nổi góc trên bên phải, tự biến mất sau ~2.4s — dùng cho các mốc thao
 *  tác rõ ràng của người dùng (đăng nhập/đăng ký thành công), không dùng cho các
 *  bước tự động ngầm (vd: tự khôi phục phiên đăng nhập đã lưu khi tải lại trang). */
function showToast(message, type) {
  const container = $("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast " + (type || "success");
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => el.remove(), 320);
  }, 2400);
}
