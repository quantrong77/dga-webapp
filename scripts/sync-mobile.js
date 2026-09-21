#!/usr/bin/env node
/* sync-mobile.js — SINH `mobile/dga-logic.js` từ logic dùng chung của bản web.
 *
 * Vì sao cần: bản di động được deploy như 1 thư mục độc lập (mobile/, xem mobile/README.md) nên
 * không tham chiếu được `../logic/...`. Trước đây `mobile/dga-logic.js` là bản sao chép TAY và đã
 * lệch hẳn bản web (IEC 1999, thiếu dự báo/cấu hình quy định/Table A.10...) → cùng số liệu có thể ra
 * kết luận khác nhau. Giờ file này được SINH TỰ ĐỘNG từ nguồn duy nhất là `logic/*.js` +
 * `dga-logic.js` (đúng thứ tự nạp trong index.html) — KHÔNG sửa tay `mobile/dga-logic.js`.
 *
 *   npm run sync-mobile         ghi lại mobile/dga-logic.js
 *   npm run sync-mobile:check   chỉ kiểm tra (thoát mã 1 nếu mobile/dga-logic.js đã lỗi thời)
 *
 * `npm test` cũng chạy kiểm tra này (tests/mobile-sync.test.js) nên quên chạy sync sẽ bị báo đỏ. */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "mobile", "dga-logic.js");

const HEADER = `/* mobile/dga-logic.js — FILE ĐƯỢC SINH TỰ ĐỘNG bởi scripts/sync-mobile.js. KHÔNG SỬA TAY.
 *
 * Nội dung = ghép các file logic dùng chung của bản web theo đúng thứ tự nạp trong index.html:
 * {{FILES}}
 * Muốn đổi logic đánh giá: sửa ở logic/*.js (bản web) rồi chạy \`npm run sync-mobile\`.
 * (Nhánh Node ở cuối file — dùng "vm" — chỉ chạy khi có module.exports; trình duyệt bỏ qua.) */
`;

/** Danh sách file logic theo đúng thứ tự thẻ <script> trong index.html (nguồn sự thật duy nhất). */
function logicFilesInLoadOrder() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const found = [];
  const re = /<script\s+src="((?:logic\/dga-logic-[\w-]+|dga-logic)\.js)"/g;
  let m;
  while ((m = re.exec(html)) !== null) found.push(m[1]);
  if (found.length === 0 || found[found.length - 1] !== "dga-logic.js") {
    throw new Error("Không tìm thấy thứ tự nạp logic trong index.html (dga-logic.js phải là file cuối).");
  }
  return found;
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n").replace(/^﻿/, "");
}

/** Trả về nội dung mà mobile/dga-logic.js PHẢI có. */
function buildMobileLogic() {
  const files = logicFilesInLoadOrder();
  const parts = files.map((f) => `\n// ===== ${f} =====\n` + normalize(fs.readFileSync(path.join(ROOT, f), "utf8")).replace(/\s+$/, "") + "\n");
  return HEADER.replace("{{FILES}}", files.join(", ")) + parts.join("");
}

function main() {
  const expected = buildMobileLogic();
  const check = process.argv.includes("--check");
  const current = fs.existsSync(OUTPUT) ? normalize(fs.readFileSync(OUTPUT, "utf8")) : null;
  if (check) {
    if (current === expected) {
      console.log("mobile/dga-logic.js đã khớp logic/ của bản web.");
      return;
    }
    console.error("mobile/dga-logic.js đã LỖI THỜI so với logic/ — chạy: npm run sync-mobile");
    process.exit(1);
  }
  fs.writeFileSync(OUTPUT, expected, "utf8");
  console.log(`Đã ghi ${path.relative(ROOT, OUTPUT)} (${expected.split("\n").length} dòng).`);
}

if (require.main === module) main();
module.exports = { buildMobileLogic, logicFilesInLoadOrder, OUTPUT };
