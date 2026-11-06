#!/usr/bin/env node
/* scripts/build-pages-site.js — Gom các file web cần cho GitHub Pages vào 1 thư mục (mặc định _site/) theo DANH SÁCH
 * CHO PHÉP, để artifact Pages KHÔNG chứa data/ (database.json: users/password_hash, sessions), server/, tests/,
 * scripts/, docs/, gsheet/, supabase/, pdf/, node_modules/ hay tài liệu .md nội bộ.
 *
 * Không biến đổi nội dung file nào (app vẫn không có bước build) — chỉ sao chép. Sau khi chép, script tự kiểm tra
 * mọi đường dẫn tương đối mà index.html, mobile/index.html, manifest, sw.js (PRECACHE_ASSETS) và các mẫu BBTN
 * (*_TEMPLATE_URL) cần đều có trong thư mục ra; thiếu → thoát mã 1 (workflow dừng, không deploy bản hỏng).
 *
 * Dùng:  node scripts/build-pages-site.js [thư-mục-ra]
 * Thêm file/thư mục web mới ở gốc → bổ sung vào ROOT_FILES / ROOT_DIRS bên dưới.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

/** File ở gốc dự án mà trình duyệt tải. */
const ROOT_FILES = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "config.js",
];
/** Thư mục chép nguyên (trừ file bị loại bởi isExcluded). */
const ROOT_DIRS = ["src", "vendor", "image", "mobile"];
/** Mẫu BBTN app tải bằng fetch(): chỉ các file template-*.docx (không chép BBTN thật / file khóa ~$ của Word). */
const TEMPLATE_PATTERN = /^template-[\w.-]+\.docx$/;

/** Loại khỏi artifact dù nằm trong thư mục được chép. */
function isExcluded(name) {
  return /\.md$/i.test(name) || /^~\$/.test(name) || /\.(tmp|bak)$/i.test(name) || name === ".DS_Store";
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (isExcluded(ent.name)) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else if (ent.isFile()) fs.copyFileSync(s, d);
  }
}

/** Đường dẫn tương đối (không phải URL ngoài, data:, #, mailto:) — bỏ ?query/#hash, giải mã %xx. */
function localRef(ref) {
  if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null;
  const clean = ref.split(/[?#]/)[0].replace(/^\.\//, "");
  if (!clean || clean.includes("${")) return null;
  try {
    return decodeURIComponent(clean);
  } catch (_) {
    return clean;
  }
}

/** Mọi đường dẫn tương đối mà app cần, tính từ gốc site. */
function requiredPaths(siteDir) {
  const need = new Set();
  const addFrom = (baseDir, ref) => {
    const r = localRef(ref);
    if (r) need.add(path.posix.normalize(path.posix.join(baseDir, r)));
  };
  // HTML: src= / href= (bỏ qua khối Hướng dẫn: liên kết trong tài liệu, không phải tài nguyên tải)
  for (const html of ["index.html", "mobile/index.html"]) {
    const p = path.join(siteDir, html);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    const baseDir = path.posix.dirname(html) === "." ? "" : path.posix.dirname(html);
    for (const m of s.matchAll(/<(?:script|link|img|source)\b[^>]*?\s(?:src|href|srcset)="([^"]+)"/gi)) {
      addFrom(baseDir, m[1].split(/\s+/)[0]);
    }
  }
  // manifest icons
  const man = path.join(siteDir, "manifest.webmanifest");
  if (fs.existsSync(man)) {
    for (const ic of JSON.parse(fs.readFileSync(man, "utf8")).icons || []) addFrom("", ic.src);
  }
  // sw.js PRECACHE_ASSETS
  const sw = fs.readFileSync(path.join(siteDir, "sw.js"), "utf8");
  const block = (sw.match(/PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || "";
  for (const m of block.matchAll(/"([^"]+)"/g)) {
    if (m[1] !== "./") addFrom("", m[1]);
  }
  // Mẫu BBTN tải bằng fetch(*_TEMPLATE_URL)
  const walkJs = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "vendor" && e.name !== "mobile") walkJs(p);
      } else if (e.name.endsWith(".js")) {
        const s = fs.readFileSync(p, "utf8");
        for (const m of s.matchAll(/_TEMPLATE_URL\s*=\s*"([^"]+)"/g)) addFrom("", m[1]);
      }
    }
  };
  walkJs(siteDir);
  return [...need].sort((a, b) => a.localeCompare(b));
}

function build(outDir) {
  const out = path.resolve(outDir || path.join(ROOT, "_site"));
  // Thư mục ra bị xóa trước khi chép: không bao giờ được là gốc dự án hay thư mục cha của nó
  if (out === ROOT || ROOT.startsWith(out + path.sep)) throw new Error(`Thư mục ra không hợp lệ: ${out}`);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of ROOT_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(out, f));
  for (const d of ROOT_DIRS) copyDir(path.join(ROOT, d), path.join(out, d));
  fs.mkdirSync(path.join(out, "template"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "template"))) {
    if (TEMPLATE_PATTERN.test(f)) fs.copyFileSync(path.join(ROOT, "template", f), path.join(out, "template", f));
  }
  // Pages: không xử lý Jekyll (thư mục/file bắt đầu bằng "_" vẫn được phục vụ)
  fs.writeFileSync(path.join(out, ".nojekyll"), "");

  const missing = requiredPaths(out).filter((p) => !fs.existsSync(path.join(out, p)));
  return { out, missing };
}

if (require.main === module) {
  const { out, missing } = build(process.argv[2]);
  if (missing.length) {
    console.error(`THIẾU ${missing.length} file app cần trong ${out}:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  let count = 0;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : count++));
  walk(out);
  console.log(`Đã gom ${count} file web vào ${path.relative(ROOT, out) || out} — đủ mọi tài nguyên app cần.`);
}

module.exports = { build, requiredPaths, ROOT_FILES, ROOT_DIRS, TEMPLATE_PATTERN };
