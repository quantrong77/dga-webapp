/* storage/storage-auth.js — Quản lý đăng ký, đăng nhập, phiên và phân quyền người dùng (Auth). */

const AUTH_LS_KEY = "dga_auth_v1";

function authLsGet() {
  try {
    const raw = localStorage.getItem(AUTH_LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function authLsSet(session) {
  try {
    if (session) localStorage.setItem(AUTH_LS_KEY, JSON.stringify(session));
    else localStorage.removeItem(AUTH_LS_KEY);
  } catch (e) {
    console.warn("localStorage write failed (auth)", e);
  }
}

const Auth = {
  get enabled() {
    return (typeof hasLocalServerConfig === "function" && hasLocalServerConfig()) || hasGsheetConfig();
  },
  current: null, // { token, email, role } sau khi xác thực thành công, null nếu chưa đăng nhập

  isAdmin() {
    return !!(this.current && this.current.role === "admin");
  },

  isViewer() {
    return !!(this.current && this.current.role === "viewer");
  },

  isUser() {
    return !!(this.current && (this.current.role === "user" || this.current.role === "admin"));
  },

  /** Nạp phiên đã lưu (nếu có) từ lần trước — gọi 1 lần lúc khởi động trang. */
  loadSaved() {
    const saved = authLsGet();
    if (saved && saved.token) {
      _authToken = saved.token;
      this.current = saved;
    }
    return this.current;
  },

  _applySession(data) {
    _authToken = data.token;
    // mustChangePassword: đang dùng mật khẩu TẠM do Admin cấp — server chặn mọi thao tác
    // khác cho tới khi đổi (requireSession(), Code.gs); xem enterApp() ở ui-auth.js.
    this.current = { token: data.token, email: data.email, role: data.role, mustChangePassword: !!data.mustChangePassword };
    authLsSet(this.current);
    return this.current;
  },

  async register(email, password) {
    const data = await gsheetPost("register", { email, password });
    return this._applySession(data);
  },

  async login(email, password) {
    const data = await gsheetPost("login", { email, password });
    return this._applySession(data);
  },

  /** Đăng nhập/đăng ký bằng Google — idToken là credential JWT do Google Identity
   *  Services (GIS) trả về ở trình duyệt sau khi người dùng chọn tài khoản Google. */
  async loginWithGoogle(idToken) {
    const data = await gsheetPost("googleLogin", { idToken });
    return this._applySession(data);
  },

  async logout() {
    try {
      await gsheetPost("logout", {});
    } catch (e) {
      // bỏ qua lỗi mạng khi logout — phiên cục bộ vẫn xóa
    }
    _authToken = null;
    this.current = null;
    authLsSet(null);
  },

  /** Thông tin cấu hình đăng ký (ai được đăng ký) từ server — gọi 1 lần lúc vẽ modal. */
  async registrationInfo() {
    return await gsheetGet("registrationInfo");
  },

  /** Kiểm tra lại phiên hiện tại với server (còn hạn không, role đổi chưa, cần đổi mk không). */
  async refresh() {
    if (!this.current) return null;
    try {
      const data = await gsheetGet("me");
      this.current = {
        token: this.current.token,
        email: data.email,
        role: data.role,
        hasPassword: !!data.hasPassword,
        mustChangePassword: !!data.mustChangePassword,
      };
      authLsSet(this.current);
      return this.current;
    } catch (e) {
      // Token hết hạn hoặc user bị xóa — coi như đã đăng xuất
      _authToken = null;
      this.current = null;
      authLsSet(null);
      return null;
    }
  },

  async listUsers() {
    return await gsheetGet("listUsers");
  },

  async setUserRole(email, role) {
    return await gsheetPost("setUserRole", { email, role });
  },

  async deleteUser(email) {
    return await gsheetPost("deleteUser", { email });
  },

  /** Tự đổi mật khẩu (người dùng đang đăng nhập) — server yêu cầu đúng mật khẩu cũ. */
  async changePassword(oldPassword, newPassword) {
    const data = await gsheetPost("changePassword", { oldPassword, newPassword });
    return this._applySession(data);
  },

  /** Admin đặt lại mật khẩu cho 1 tài khoản đã quên mật khẩu — trả về { email, tempPassword }
   *  ĐÚNG 1 LẦN để Admin copy gửi cho người dùng qua kênh khác (app không có email server để
   *  tự gửi); KHÔNG lưu lại mật khẩu tạm này ở đâu trong app. Hủy luôn mọi phiên cũ của tài
   *  khoản đó ở phía server (đăng xuất khỏi mọi thiết bị). */
  async adminResetPassword(email) {
    return await gsheetPost("adminResetPassword", { email });
  },

  /** Admin tạo tài khoản mới trực tiếp (không cần người dùng tự đăng ký) — dùng khi
   *  registrationInfo().mode !== "open", hoặc đơn giản Admin muốn chủ động cấp tài khoản.
   *  Trả về { email, role, tempPassword } giống adminResetPassword() ở trên. */
  async adminCreateUser(email, role) {
    return await gsheetPost("adminCreateUser", { email, role });
  },

  /** Bản sao song song trên Supabase (Code.gs ghi theo phía máy chủ) — chỉ Admin. Server cũ
   *  chưa có action này sẽ báo lỗi "unknown action" (hiện nguyên văn ở tab Quản trị). */
  async supabaseSyncStatus() {
    return await gsheetGet("supabaseSyncStatus");
  },

  async syncSupabase() {
    return await gsheetPost("syncSupabase", {});
  },
};

if (typeof window !== "undefined") {
  window.Auth = Auth;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AUTH_LS_KEY,
    authLsGet,
    authLsSet,
    Auth,
  };
}
