// Tốc độ mở trang: index.html có thẻ meta CSP nên Chrome tắt preload scanner — <script> thường (không defer)
// bị tải tuần tự từng file (đo thực tế: màn hình đăng nhập 13 giây -> 3 giây sau khi thêm defer). Khóa lại:
//   - mọi <script src> cổ điển phải "defer", trừ 2 file cần chạy đồng bộ;
//   - thư viện nặng chỉ dùng khi thao tác (SheetJS, pdf.js, Tesseract) KHÔNG nạp lúc mở trang.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./scripts-helpers");

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const SYNC_ALLOWED = ["src/presentation/boot-guard.js", "src/presentation/early-layout.js"];

test("mọi <script src> cổ điển đều có defer (trừ boot-guard.js, early-layout.js)", () => {
  const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
  const bad = tags
    .filter(([tag, src]) => !/type="module"/.test(tag) && !/\b(defer|async)\b/.test(tag) && !SYNC_ALLOWED.includes(src))
    .map(([, src]) => src);
  expect(bad).toEqual([]);
});

test("SheetJS không nạp lúc mở trang (tải khi bấm Xuất Excel)", () => {
  expect(html).not.toMatch(/<script[^>]*xlsx/);
});

test.each(["src/data/io/bbtn-import.js", "src/data/io/nameplate-import.js"])("%s không import tĩnh pdf.js/Tesseract", (rel) => {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  expect(src).not.toMatch(/^import .*(pdfjs|tesseract)/m);
});
