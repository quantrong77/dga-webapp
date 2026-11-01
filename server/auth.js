/* server/auth.js — Quản lý xác thực, phân quyền (RBAC) và bảo mật cho Máy chủ nội bộ DGA.
 * Tương thích 100% với giao thức của Google Apps Script (Code.gs).
 */
const crypto = require("crypto");
const { db } = require("./db");

const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCKOUT_SECONDS = 300; // 5 phút
const SESSION_TTL_DAYS = 30;

const failedAttempts = new Map(); // email -> { count, lockedUntil }

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}|${password}`)
    .digest("hex");
}

function generateRandomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

function checkLoginThrottle(email) {
  const norm = normalizeEmail(email);
  const info = failedAttempts.get(norm);
  if (!info) return null;

  const now = Date.now();
  if (info.lockedUntil && info.lockedUntil > now) {
    const remainMins = Math.ceil((info.lockedUntil - now) / 60000);
    return `Nhập sai mật khẩu quá ${MAX_FAILED_LOGINS} lần — tài khoản tạm khóa đăng nhập ${remainMins} phút. Thử lại sau hoặc liên hệ Admin.`;
  }
  if (info.lockedUntil && info.lockedUntil <= now) {
    failedAttempts.delete(norm);
  }
  return null;
}

function recordFailedLogin(email) {
  const norm = normalizeEmail(email);
  const info = failedAttempts.get(norm) || { count: 0, lockedUntil: null };
  info.count += 1;
  if (info.count >= MAX_FAILED_LOGINS) {
    info.lockedUntil = Date.now() + LOGIN_LOCKOUT_SECONDS * 1000;
  }
  failedAttempts.set(norm, info);
}

function clearFailedLogins(email) {
  failedAttempts.delete(normalizeEmail(email));
}

function initDefaultAdmin() {
  db.init();
  const users = db.getTable("users");
  if (users.length === 0) {
    const adminEmail = "admin@ptc3.evnnpt.vn";
    const salt = generateRandomHex(16);
    const pwdHash = hashPassword("admin123456", salt);
    const now = new Date().toISOString();
    const adminUser = {
      id: "usr_" + Date.now().toString(36),
      email: adminEmail,
      salt,
      password_hash: pwdHash,
      role: "admin",
      must_change_password: "0",
      created_at: now,
      last_login: now,
    };
    db.upsert("users", adminUser, "id");
    console.log(`[DGA On-Premise Auth] Đã tạo tài khoản quản trị nội bộ mặc định:`);
    console.log(`  > Email:    ${adminEmail}`);
    console.log(`  > Mật khẩu: admin123456 (Khuyến cáo đổi ngay sau khi đăng nhập)`);
  }
}

function findUserByEmail(email) {
  const norm = normalizeEmail(email);
  return db.find("users", (u) => normalizeEmail(u.email) === norm);
}

function createSession(user) {
  const token = "tok_" + generateRandomHex(24);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = {
    token,
    email: user.email,
    role: user.role || "user",
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };
  db.upsert("sessions", session, "token");
  return session;
}

function getSession(token) {
  if (!token) return null;
  const s = db.find("sessions", (item) => item.token === token);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    db.delete("sessions", token, "token");
    return null;
  }
  return s;
}

function requireSession(token, allowMustChange = false) {
  const s = getSession(token);
  if (!s) {
    throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
  }
  const user = findUserByEmail(s.email);
  if (!user) {
    throw new Error("Không tìm thấy người dùng cho phiên này.");
  }
  if (!allowMustChange && String(user.must_change_password) === "1") {
    throw new Error("Bạn đang sử dụng mật khẩu tạm. Bắt buộc phải đổi mật khẩu trước khi thao tác tiếp.");
  }
  return { ...user, token: s.token, role: s.role || user.role };
}

function requireAdmin(token) {
  const user = requireSession(token);
  if (user.role !== "admin") {
    throw new Error("Thao tác yêu cầu quyền Quản trị viên (Admin).");
  }
  return user;
}

function login(email, password) {
  const norm = normalizeEmail(email);
  const throttleMsg = checkLoginThrottle(norm);
  if (throttleMsg) return { error: throttleMsg };

  const user = findUserByEmail(norm);
  if (!user || !user.password_hash) {
    recordFailedLogin(norm);
    return { error: "Email hoặc mật khẩu không chính xác." };
  }

  const computedHash = hashPassword(password, user.salt);
  if (computedHash !== user.password_hash) {
    recordFailedLogin(norm);
    return { error: "Email hoặc mật khẩu không chính xác." };
  }

  clearFailedLogins(norm);
  const now = new Date().toISOString();
  db.upsert("users", { id: user.id, last_login: now });

  const session = createSession(user);
  return {
    token: session.token,
    email: user.email,
    role: user.role || "user",
    mustChangePassword: String(user.must_change_password) === "1",
  };
}

function register(email, password) {
  const norm = normalizeEmail(email);
  if (!norm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(norm)) {
    return { error: "Email không hợp lệ." };
  }
  if (!password || password.length < 6) {
    return { error: "Mật khẩu phải có ít nhất 6 ký tự." };
  }
  if (findUserByEmail(norm)) {
    return { error: "Email này đã được đăng ký trong hệ thống." };
  }

  const salt = generateRandomHex(16);
  const pwdHash = hashPassword(password, salt);
  const now = new Date().toISOString();
  const newUser = {
    id: "usr_" + Date.now().toString(36),
    email: norm,
    salt,
    password_hash: pwdHash,
    role: "user",
    must_change_password: "0",
    created_at: now,
    last_login: now,
  };
  db.upsert("users", newUser, "id");
  const session = createSession(newUser);
  return {
    token: session.token,
    email: newUser.email,
    role: newUser.role,
    mustChangePassword: false,
  };
}

function changePassword(token, oldPassword, newPassword) {
  const session = requireSession(token, true);
  const user = findUserByEmail(session.email);
  if (!user) return { error: "Không tìm thấy người dùng." };

  if (user.password_hash) {
    const checkHash = hashPassword(oldPassword, user.salt);
    if (checkHash !== user.password_hash) {
      return { error: "Mật khẩu hiện tại không đúng." };
    }
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: "Mật khẩu mới phải có ít nhất 6 ký tự." };
  }

  const newSalt = generateRandomHex(16);
  const newHash = hashPassword(newPassword, newSalt);

  db.upsert("users", {
    id: user.id,
    salt: newSalt,
    password_hash: newHash,
    must_change_password: "0",
  });

  return { ok: true, message: "Đổi mật khẩu thành công." };
}

function adminResetPassword(adminToken, targetEmail) {
  requireAdmin(adminToken);
  const user = findUserByEmail(targetEmail);
  if (!user) return { error: "Không tìm thấy người dùng." };

  const tempPassword = generateRandomHex(6); // 12 ký tự hex
  const newSalt = generateRandomHex(16);
  const newHash = hashPassword(tempPassword, newSalt);

  db.upsert("users", {
    id: user.id,
    salt: newSalt,
    password_hash: newHash,
    must_change_password: "1",
  });

  // Hủy phiên cũ của user đó
  const norm = normalizeEmail(targetEmail);
  const sessions = db.getTable("sessions");
  db.data.sessions = sessions.filter((s) => normalizeEmail(s.email) !== norm);
  db.save();

  return { ok: true, tempPassword, email: targetEmail };
}

function adminCreateUser(adminToken, email, role = "user") {
  requireAdmin(adminToken);
  const norm = normalizeEmail(email);
  if (!norm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(norm)) {
    return { error: "Email không hợp lệ." };
  }
  if (findUserByEmail(norm)) {
    return { error: "Email này đã tồn tại trong hệ thống." };
  }

  const tempPassword = generateRandomHex(6);
  const salt = generateRandomHex(16);
  const pwdHash = hashPassword(tempPassword, salt);
  const now = new Date().toISOString();

  const newUser = {
    id: "usr_" + Date.now().toString(36),
    email: norm,
    salt,
    password_hash: pwdHash,
    role: ["admin", "user", "viewer"].includes(role) ? role : "user",
    must_change_password: "1",
    created_at: now,
    last_login: null,
  };
  db.upsert("users", newUser, "id");
  return { ok: true, email: norm, role: newUser.role, tempPassword };
}

function listUsers(adminToken) {
  requireAdmin(adminToken);
  return db.getTable("users").map((u) => ({
    email: u.email,
    role: u.role,
    created_at: u.created_at,
    last_login: u.last_login,
  }));
}

function setUserRole(adminToken, targetEmail, newRole) {
  requireAdmin(adminToken);
  const user = findUserByEmail(targetEmail);
  if (!user) return { error: "Không tìm thấy người dùng." };

  const validRoles = ["admin", "user", "viewer"];
  const role = validRoles.includes(newRole) ? newRole : "user";
  db.upsert("users", { id: user.id, role });
  return { ok: true, email: targetEmail, role };
}

function deleteUser(adminToken, targetEmail) {
  const admin = requireAdmin(adminToken);
  if (normalizeEmail(targetEmail) === normalizeEmail(admin.email)) {
    return { error: "Không thể tự xóa chính tài khoản Admin đang đăng nhập." };
  }
  const user = findUserByEmail(targetEmail);
  if (!user) return { error: "Không tìm thấy người dùng." };

  db.delete("users", user.id);
  const norm = normalizeEmail(targetEmail);
  db.data.sessions = db.getTable("sessions").filter((s) => normalizeEmail(s.email) !== norm);
  db.save();
  return { ok: true, email: targetEmail };
}

module.exports = {
  initDefaultAdmin,
  findUserByEmail,
  requireSession,
  requireAdmin,
  login,
  register,
  changePassword,
  adminResetPassword,
  adminCreateUser,
  listUsers,
  setUserRole,
  deleteUser,
};
