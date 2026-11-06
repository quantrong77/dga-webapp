#!/usr/bin/env node
/* scripts/extract-md-images.js — Tách hình nhúng base64 trong file Markdown xuất từ Google Docs
 * (File > Tải xuống > Markdown (.md)) ra thành file ảnh riêng, rồi đổi link trong .md trỏ tới ảnh.
 *
 * Google Docs ghi hình ở cuối file dạng:   [image1]: <data:image/png;base64,iVBORw0...>
 * Sau khi chạy:                            [image1]: docs/images/<ten-file>/image1.png
 *
 * Cách dùng:
 *   npm run extract-images -- "docs/quy-dinh/Dieu54_QD1901.md"
 *   npm run extract-images -- "tai-lieu.md" --out docs/images/tai-lieu
 *
 * - Thư mục ảnh mặc định: docs/images/<tên file .md, viết thường, bỏ dấu cách>/
 * - Đường dẫn ảnh ghi vào .md là đường dẫn TƯƠNG ĐỐI so với chính file .md (xem được trong
 *   VS Code / GitHub).
 * - Tạo bản sao lưu <file>.md.bak trước khi ghi đè (đuôi .bak đã nằm trong .gitignore).
 * - Hỗ trợ cả hình nhúng trực tiếp dạng ![mô tả](data:image/...;base64,...). */
const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = { file: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (!args.file) args.file = argv[i];
  }
  return args;
}

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const EXT = { png: "png", jpeg: "jpg", jpg: "jpg", gif: "gif", webp: "webp", "svg+xml": "svg", bmp: "bmp" };

/** Trả về { text, images: [{name, ext, buffer}] } — hàm thuần, không đụng tới đĩa (dễ test). */
function extractImages(markdown, relDir) {
  const images = [];
  let counter = 0;
  const save = (name, mime, data) => {
    const ext = EXT[mime.toLowerCase()] || "png";
    images.push({ name, ext, buffer: Buffer.from(data.replace(/\s+/g, ""), "base64") });
    return `${relDir}/${name}.${ext}`;
  };

  // 1) Kiểu tham chiếu của Google Docs: [image1]: <data:image/png;base64,...>
  let text = markdown.replace(
    /^\[([^\]\n]+)\]:\s*<?data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+?)>?\s*$/gim,
    (_, ref, mime, data) => `[${ref}]: ${save(slugify(ref) || `image${++counter}`, mime, data)}`
  );
  // 2) Kiểu nhúng trực tiếp: ![alt](data:image/png;base64,...)
  text = text.replace(
    /!\[([^\]]*)\]\(\s*<?data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+?)>?\s*\)/gi,
    (_, alt, mime, data) => `![${alt}](${save(`inline${++counter}`, mime, data)})`
  );
  return { text, images };
}

function main() {
  const { file, out } = parseArgs(process.argv.slice(2));
  if (!file) {
    console.error('Cách dùng: npm run extract-images -- "<file.md>" [--out <thư mục ảnh>]');
    process.exit(1);
  }
  const mdPath = path.resolve(file);
  if (!fs.existsSync(mdPath)) {
    console.error("Không tìm thấy file: " + mdPath);
    process.exit(1);
  }
  const root = path.resolve(__dirname, "..");
  const outDir = path.resolve(out || path.join(root, "docs", "images", slugify(path.basename(mdPath, path.extname(mdPath)))));
  const relDir = path.relative(path.dirname(mdPath), outDir).split(path.sep).join("/") || ".";

  const original = fs.readFileSync(mdPath, "utf8");
  const { text, images } = extractImages(original, relDir);
  if (images.length === 0) {
    console.log("Không có hình nhúng base64 nào trong " + path.basename(mdPath) + " — không thay đổi gì.");
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const img of images) {
    const p = path.join(outDir, `${img.name}.${img.ext}`);
    fs.writeFileSync(p, img.buffer);
    console.log(`  ${path.relative(root, p)}  (${img.buffer.length} bytes)`);
  }
  fs.writeFileSync(mdPath + ".bak", original);
  fs.writeFileSync(mdPath, text);
  console.log(
    `Đã tách ${images.length} hình. ${path.basename(mdPath)}: ${Buffer.byteLength(original)} -> ${Buffer.byteLength(text)} bytes` +
    ` (bản gốc: ${path.basename(mdPath)}.bak)`
  );
}

if (require.main === module) main();
module.exports = { extractImages, slugify };
