// boot-guard.js chống "trang trắng" khi mở app trong Zalo/trình duyệt nhúng — nó chỉ có ích nếu
// CHẠY ĐƯỢC ở nơi phần còn lại của app không chạy nổi, nên phải giữ cú pháp ES5 và nạp đầu tiên.
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const { ROOT, localScripts } = require("./scripts-helpers");

const REL = "src/presentation/boot-guard.js";

test("boot-guard.js chỉ dùng cú pháp ES5 (chạy được trên WebView đời cũ)", () => {
  const src = fs.readFileSync(path.join(ROOT, REL), "utf8");
  expect(() => acorn.parse(src, { ecmaVersion: 5 })).not.toThrow();
});

test("index.html nạp boot-guard.js là script cục bộ ĐẦU TIÊN (trước mọi thư viện)", () => {
  expect(localScripts("index.html")[0].rel).toBe(REL);
});

test("sw.js precache boot-guard.js", () => {
  expect(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8")).toContain(`"./${REL}"`);
});
