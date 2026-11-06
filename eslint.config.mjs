// eslint.config.mjs — ESLint (flat config) cho DGOil.
// App chạy bằng nhiều <script> thường (không phải ES module) chia sẻ biến toàn cục qua
// window, nên TẮT no-undef/no-unused-vars cấp file — để tsc (npm run typecheck) lo phần kiểu.
// Mục tiêu: bắt lỗi THẬT (biến trùng, so sánh sai, code chết), không ép đổi style.
import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

// Tên toàn cục cấm theo lớp — giữ khớp với DOMAIN_BANNED / DATA_BANNED trong tests/architecture.test.js
const DOMAIN_BANNED = ["document", "window", "localStorage", "sessionStorage", "fetch", "navigator", "alert", "confirm", "gsheetGet", "gsheetPost", "sb", "Storage", "Auth"];
const DATA_BANNED = ["document", "showToast", "notifyError", "$", "alert", "confirm"];

export default [
  {
    ignores: [
      "node_modules/**",
      "vendor/**",
      "mobile/**",
      ".dist/**",
      "coverage/**",
      "data/**",
      ".agent/**",
      ".claude/**",
      ".playwright/**",
      ".playwright-cli/**",
      "assets/**",
      "pdf/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  {
    // Mặc định: script trình duyệt (index.html nạp lần lượt) — có nhánh Node cho Jest (typeof module).
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, ...globals.commonjs },
    },
    rules: {
      "no-undef": "off", // biến toàn cục định nghĩa ở file khác
      "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }],
      "no-redeclare": "off", // cùng lý do no-undef: hàm toàn cục khai báo ở nhiều nhánh
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-prototype-builtins": "off",
      "no-useless-escape": "warn",
      "no-cond-assign": ["error", "except-parens"],
      eqeqeq: ["warn", "smart"],
      "no-var": "warn",
      "prefer-const": ["warn", { destructuring: "all" }],
      "preserve-caught-error": "warn", // nên gắn { cause: err } khi ném lỗi mới trong catch
      "no-useless-assignment": "warn",
      "no-irregular-whitespace": ["error", { skipRegExps: true, skipStrings: true, skipTemplates: true }],
    },
  },
  {
    // Script trình duyệt: biến `let` cấp file (VD _allOilTests, _oilBbtnExport) được GÁN LẠI ở file KHÁC — ESLint chỉ
    // thấy từng file nên prefer-const báo sai, và `npm run lint:fix` sẽ đổi thành const → lỗi "Assignment to constant"
    // khi chạy app. Chỉ giữ prefer-const cho server/scripts/tests (CommonJS, mỗi file độc lập).
    files: ["*.js", "src/**/*.js"],
    rules: { "prefer-const": "off" },
  },
  {
    // 2 file nạp bằng <script type="module"> (import pdf.js/tesseract từ vendor/)
    files: ["src/data/io/bbtn-import.js", "src/data/io/nameplate-import.js"],
    languageOptions: { sourceType: "module" },
  },
  // ---- Ranh giới 3 lớp (docs/refactor/ARCHITECTURE.md mục 4; kiểm tra đầy đủ bằng AST ở tests/architecture.test.js) ----
  {
    files: ["src/domain/**/*.js"],
    rules: { "no-restricted-globals": ["error", ...DOMAIN_BANNED.map((name) => ({ name, message: "src/domain/ là logic thuần: không DOM/storage/fetch (ARCHITECTURE.md mục 4)." }))] },
  },
  {
    // V10 (cho phép): facade UMD gán window.DGA = DGA
    files: ["src/domain/dga-logic.js"],
    rules: { "no-restricted-globals": ["error", ...DOMAIN_BANNED.filter((n) => n !== "window").map((name) => ({ name, message: "src/domain/ là logic thuần." }))] },
  },
  {
    files: ["src/data/**/*.js"],
    rules: { "no-restricted-globals": ["error", ...DATA_BANNED.map((name) => ({ name, message: "src/data/ không chạm DOM trang / không toast: báo lỗi bằng throw hoặc sự kiện (ARCHITECTURE.md mục 4)." }))] },
  },
  {
    // V8–V9 (cho phép): <canvas> NGOÀI trang để render PDF cho OCR. Xem EXCEPTIONS trong tests/architecture.test.js
    files: ["src/data/io/bbtn-import.js", "src/data/io/nameplate-import.js"],
    rules: { "no-restricted-globals": ["error", ...DATA_BANNED.filter((n) => n !== "document").map((name) => ({ name, message: "src/data/ không toast." }))] },
  },
  {
    files: ["sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ["backend/**/*.js", "scripts/**/*.js", "tests/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "no-undef": "error" },
  },
  {
    // Test nạp code trình duyệt vào global qua vm/require nên hàm toàn cục không khai báo trong file.
    files: ["tests/**/*.js"],
    languageOptions: { globals: { ...globals.jest } },
    rules: { "no-undef": "off" },
  },
  prettier, // tắt mọi rule định dạng trùng với Prettier
];
