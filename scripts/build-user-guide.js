#!/usr/bin/env node
/* build-user-guide.js — Dựng lại nội dung tab "Hướng dẫn" của app từ user_manual.md.
 *
 * Nguồn duy nhất của hướng dẫn là `docs/huong-dan/user_manual.md`. Khối HTML giữa 2 dấu
 *   <!-- USER-GUIDE:BEGIN --> ... <!-- USER-GUIDE:END -->
 * trong index.html được SINH từ file đó (mỗi mục "## N. Tiêu đề" thành 1 khối <details class="mm-node">) —
 * KHÔNG sửa tay khối này (sẽ bị ghi đè). Sửa user_manual.md rồi chạy:
 *
 *   npm run build-guide          ghi lại index.html
 *   npm run build-guide:check    chỉ kiểm tra (thoát mã 1 nếu index.html đã lỗi thời)
 *
 * LUÔN dùng bộ chuyển Markdown -> HTML viết bằng JavaScript có sẵn (scripts/md-to-html.js) để kết quả
 * GIỐNG HỆT nhau trên mọi máy. (Trước đây tự chọn pandoc nếu máy có cài -> pandoc xuống dòng, đổi dấu
 * ngoặc kép, thêm <colgroup>... khác bộ JS, nên `build-guide:check` / tests/user-guide.test.js báo
 * "lỗi thời" trên máy có pandoc dù user_manual.md không đổi.)
 */
const fs = require("fs");
const path = require("path");
const { mdToHtml } = require("./md-to-html");

const ROOT = path.resolve(__dirname, "..");
const MANUAL = path.join(ROOT, "docs", "huong-dan", "user_manual.md");
const INDEX = path.join(ROOT, "index.html");
const BEGIN = "<!-- USER-GUIDE:BEGIN — sinh tự động bởi scripts/build-user-guide.js từ user_manual.md, KHÔNG sửa tay -->";
const END = "<!-- USER-GUIDE:END -->";
const CHEVRON = '<svg class="mm-chevron" aria-hidden="true"><use href="#icon-chevron-right"></use></svg>';

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const norm = (t) => t.replace(/\r\n/g, "\n");

/** Tách user_manual.md thành các mục "## N. Tiêu đề" (bỏ tiêu đề đầu tài liệu và mục "Mục lục"). */
function parseSections(md) {
  const parts = md.split(/^## /m).slice(1); // phần trước "## " đầu tiên là tiêu đề + lời dẫn
  return parts
    .map((chunk) => {
      const nl = chunk.indexOf("\n");
      const title = chunk.slice(0, nl).trim();
      let body = chunk.slice(nl + 1);
      // Bỏ đường kẻ "---" ngăn giữa các mục (riêng mục cuối giữ lại đường kẻ + dòng ghi chú cuối tài liệu).
      body = body.replace(/\n---\s*$/, "\n");
      return { title, body: body.trim() + "\n" };
    })
    .filter((s) => /^\d+\./.test(s.title)); // chỉ các mục đánh số 1..19 (bỏ "Mục lục")
}

function markdownToHtml(markdown) {
  return norm(mdToHtml(markdown));
}

function decorate(html) {
  // If html already has <div class="table-scroll">, don't double wrap
  let out = html;
  if (!out.includes('<div class="table-scroll">')) {
    out = out.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, "</table></div>");
  }
  if (!out.includes('<p class="sm-note">')) {
    out = out.replace(/<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/g, '<p class="sm-note">$1</p>');
  }
  if (!out.includes('<ul class="rec-list">')) {
    out = out.replace(/<ul>/g, '<ul class="rec-list">');
  }
  return out.replace(/<a\s+href="#[^"]*">([\s\S]*?)<\/a>/g, "$1");
}

function renderSection(sec) {
  const body = decorate(markdownToHtml(sec.body)).trimEnd();
  const indent = (text, n) => text.split("\n").map((l) => (l.length ? " ".repeat(n) + l : l)).join("\n");
  return [
    '        <details class="mm-node">',
    `          <summary>${escapeHtml(sec.title)}${CHEVRON}</summary>`,
    '          <div class="sm-body">',
    indent(body, 10),
    "",
    "          </div>",
    "        </details>",
  ].join("\n");
}

/** Khối HTML mà index.html PHẢI chứa giữa 2 dấu BEGIN/END. */
function buildGuideBlock() {
  const sections = parseSections(norm(fs.readFileSync(MANUAL, "utf8")));
  if (sections.length === 0) throw new Error("Không tìm thấy mục nào trong user_manual.md");
  return sections.map(renderSection).join("\n");
}

/** Thay khối giữa BEGIN/END trong nội dung index.html; nếu chưa có dấu thì báo lỗi rõ ràng. */
function applyToIndex(indexHtml, block) {
  const b = indexHtml.indexOf("<!-- USER-GUIDE:BEGIN");
  const e = indexHtml.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error("index.html chưa có cặp dấu USER-GUIDE:BEGIN/END quanh khối hướng dẫn.");
  return indexHtml.slice(0, b) + BEGIN + "\n" + block + "\n        " + indexHtml.slice(e);
}

function main() {
  const raw = fs.readFileSync(INDEX, "utf8");
  const crlf = raw.includes("\r\n");
  const current = norm(raw);
  const next = applyToIndex(current, buildGuideBlock());
  if (process.argv.includes("--check")) {
    if (next === current) {
      console.log("Tab Hướng dẫn trong index.html đã khớp user_manual.md.");
      return;
    }
    console.error("Tab Hướng dẫn trong index.html đã LỖI THỜI so với user_manual.md — chạy: npm run build-guide");
    process.exit(1);
  }
  fs.writeFileSync(INDEX, crlf ? next.replace(/\n/g, "\r\n") : next, "utf8");
  console.log("Đã dựng lại tab Hướng dẫn trong index.html từ user_manual.md.");
}

if (require.main === module) main();
module.exports = { buildGuideBlock, parseSections, applyToIndex, BEGIN, END };
