/* backend/onpremise/static-allowlist.js — DANH SÁCH CHO PHÉP các file web mà trình duyệt được tải, dùng chung cho:
 *  - máy chủ nội bộ backend/onpremise/serve.js (mọi đường dẫn KHÔNG có trong danh sách → 404), và
 *  - scripts/build-pages-site.js (chỉ chép các file này vào artifact GitHub Pages).
 * Lỗi #4 (docs/refactor/BUGS_FOUND.md): trước đây máy chủ nội bộ phục vụ MỌI file dưới gốc dự án — ai cùng mạng
 * cũng tải được data/database.json (tài khoản, password_hash, token phiên), data/uploads/ (bỏ qua kiểm tra phiên của
 * /api/files/…), .git/ (toàn bộ lịch sử), mã máy chủ, tài liệu nội bộ.
 * Thêm file/thư mục web mới ở gốc → bổ sung vào ROOT_FILES / ROOT_DIRS (test tests/onpremise-static.test.js và
 * tests/pages-site.test.js kiểm tra mọi tài nguyên index.html / sw.js / manifest cần đều được phép).
 */
const path = require("path");

/** File ở gốc dự án mà trình duyệt tải. */
const ROOT_FILES = ["index.html", "manifest.webmanifest", "sw.js", "config.js"];
/** Thư mục phục vụ/chép nguyên (trừ file bị loại bởi isExcluded). */
const ROOT_DIRS = ["src", "vendor", "assets/image", "mobile"];
/** Mẫu BBTN app tải bằng fetch(): chỉ các file template-*.docx (không phải BBTN thật / file khóa ~$ của Word). */
const TEMPLATE_DIR = "assets/template";
const TEMPLATE_PATTERN = /^template-[\w.-]+\.docx$/;

/** Loại dù nằm trong thư mục được phép: tài liệu .md, file khóa Word ~$, file tạm/sao lưu, file ẩn (.git, .env…). */
function isExcluded(name) {
  return /\.md$/i.test(name) || /^~\$/.test(name) || /\.(tmp|bak)$/i.test(name) || name === ".DS_Store" || name.startsWith(".");
}

/**
 * Đường dẫn tương đối so với gốc dự án (dấu "/", không có "/" đầu) có được phép phục vụ cho trình duyệt không.
 * Đường dẫn chứa ".." / tuyệt đối / rỗng → không.
 * @param {string} rel
 * @returns {boolean}
 */
function isAllowedStaticPath(rel) {
  if (typeof rel !== "string" || !rel) return false;
  const norm = path.posix.normalize(rel.replace(/\\/g, "/"));
  if (norm.startsWith("/") || norm === ".." || norm.startsWith("../") || /^[a-z]:/i.test(norm)) return false;
  const parts = norm.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return false;
  if (ROOT_FILES.includes(norm)) return true;
  if (parts.length === 3 && `${parts[0]}/${parts[1]}` === TEMPLATE_DIR) return TEMPLATE_PATTERN.test(parts[2]);
  const dir = ROOT_DIRS.find((d) => norm.startsWith(d + "/"));
  if (!dir) return false;
  return !parts.some(isExcluded);
}

module.exports = { ROOT_FILES, ROOT_DIRS, TEMPLATE_DIR, TEMPLATE_PATTERN, isExcluded, isAllowedStaticPath };
