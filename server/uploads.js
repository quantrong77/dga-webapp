/* server/uploads.js — Lưu tệp đính kèm (BBTN PDF/Word, ảnh góp ý) của máy chủ on-premise theo MÃ BĂM NỘI DUNG.
 *
 * Cấu trúc:  data/uploads/<yyyy>/<mm>/<sha8>_<ten-file-an-toan>
 *   - <sha8>: 8 ký tự hex đầu của SHA-256 nội dung; <yyyy>/<mm>: tháng tải lên LẦN ĐẦU.
 *   - Cùng nội dung tải lên lần nữa (dù khác tên, khác tháng) → dùng lại file đã có, KHÔNG ghi thêm bản sao.
 *     Trùng 8 ký tự đầu nhưng khác nội dung (va chạm rất hiếm) → so cả SHA-256 nên vẫn lưu riêng (thêm hậu tố).
 *   - id trả về (= đường dẫn tương đối, dấu "/") dùng trong URL /api/files/<encodeURIComponent(id)>; tệp kiểu cũ
 *     nằm phẳng ngay trong uploads/ (<timestamp>_<ten>) vẫn tải được bình thường (handleFileDownload).
 * Tên gốc người dùng tải lên không lưu trong tên file mà trả về trong bản ghi (name) như trước.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SHA_PREFIX_LEN = 8;

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** Tên file an toàn trên mọi hệ điều hành: chỉ chữ/số không dấu, ".", "_", "-" (giống cách làm cũ). */
function safeFileName(filename) {
  const base = path.basename(String(filename || "")).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base || "tep_dinh_kem";
}

/** Đường dẫn tương đối kiểu URL (dấu "/") từ thư mục uploads. */
function toId(uploadsDir, absPath) {
  return path.relative(uploadsDir, absPath).split(path.sep).join("/");
}

/** Mọi file đã lưu theo kiểu mới (uploads/<yyyy>/<mm>/<sha8>_*) có cùng <sha8>. */
function candidatesByPrefix(uploadsDir, prefix) {
  const out = [];
  if (!fs.existsSync(uploadsDir)) return out;
  for (const y of fs.readdirSync(uploadsDir, { withFileTypes: true })) {
    if (!y.isDirectory() || !/^\d{4}$/.test(y.name)) continue;
    const yDir = path.join(uploadsDir, y.name);
    for (const m of fs.readdirSync(yDir, { withFileTypes: true })) {
      if (!m.isDirectory() || !/^\d{2}$/.test(m.name)) continue;
      const mDir = path.join(yDir, m.name);
      for (const f of fs.readdirSync(mDir)) {
        if (f.startsWith(prefix + "_") || f.startsWith(prefix + "-")) out.push(path.join(mDir, f));
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/** File đã lưu có ĐÚNG nội dung này (so cả SHA-256), hoặc null. */
function findExisting(uploadsDir, hash) {
  const prefix = hash.slice(0, SHA_PREFIX_LEN);
  return candidatesByPrefix(uploadsDir, prefix).find((p) => sha256(fs.readFileSync(p)) === hash) || null;
}

/** Đường dẫn mới cho nội dung chưa có: uploads/<yyyy>/<mm>/<sha8>_<ten>; tránh đè file khác nội dung. */
function newPathFor(uploadsDir, hash, filename, when) {
  // Không dùng instanceof Date: fs.Stats.mtime có thể là Date của realm khác (VD trong Jest) — nhận mọi giá trị ngày
  const parsed = when == null ? new Date() : new Date(when);
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const dir = path.join(uploadsDir, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, "0"));
  const prefix = hash.slice(0, SHA_PREFIX_LEN);
  const clean = safeFileName(filename);
  let p = path.join(dir, `${prefix}_${clean}`);
  for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `${prefix}-${i}_${clean}`);
  return p;
}

/**
 * Lưu nội dung tệp đính kèm, không lưu trùng.
 * @param {string} uploadsDir thư mục data/uploads
 * @param {Buffer} buffer nội dung
 * @param {string} filename tên gốc (chỉ dùng để đặt tên file an toàn)
 * @param {Date} [when] thời điểm tải lên (chọn thư mục <yyyy>/<mm>)
 * @returns {{ id: string, path: string, size: number, sha256: string, reused: boolean }}
 */
function storeUpload(uploadsDir, buffer, filename, when) {
  const hash = sha256(buffer);
  const existing = findExisting(uploadsDir, hash);
  if (existing) {
    return { id: toId(uploadsDir, existing), path: existing, size: buffer.length, sha256: hash, reused: true };
  }
  const p = newPathFor(uploadsDir, hash, filename, when);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buffer);
  return { id: toId(uploadsDir, p), path: p, size: buffer.length, sha256: hash, reused: false };
}

/** URL tải tệp (giữ nguyên dạng cũ /api/files/<id đã mã hóa>). */
function fileUrl(id) {
  return `/api/files/${encodeURIComponent(id)}`;
}

module.exports = { sha256, safeFileName, storeUpload, findExisting, newPathFor, fileUrl, toId, SHA_PREFIX_LEN };
