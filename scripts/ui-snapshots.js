#!/usr/bin/env node
/* scripts/ui-snapshots.js — Chụp ảnh các tab chính ở 3 cỡ màn hình × sáng/tối để so trước/sau khi refactor UI.
 *
 * Dùng `playwright-cli` (đã cài toàn cục, skill playwright-cli) — không thêm thư viện vào package.json.
 * Cần 1 máy chủ đang chạy app có đăng nhập (VD máy chủ nội bộ: `PORT=8091 DGA_DATA_DIR=<thư mục dữ liệu thử> npm start`).
 *
 *   UI_SNAP_URL=http://localhost:8091 UI_SNAP_EMAIL=... UI_SNAP_PASSWORD=... node scripts/ui-snapshots.js <thư mục ra>
 *
 * Tài khoản đọc từ biến môi trường, KHÔNG ghi vào repo. Ảnh lưu dạng <thư mục ra>/<theme>-<rộng>-<tab>.png
 * (chụp nguyên trang). Thư mục ra nên nằm ngoài repo hoặc trong thư mục đã .gitignore. */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const URL = process.env.UI_SNAP_URL || "http://localhost:8091";
const EMAIL = process.env.UI_SNAP_EMAIL;
const PASSWORD = process.env.UI_SNAP_PASSWORD;
const OUT = path.resolve(process.argv[2] || "ui-snapshots");
const TABS = (process.env.UI_SNAP_TABS || "huongdan,nhap,dau,canhbao,lichsu,xuhuong,quytrinh").split(",");
const WIDTHS = (process.env.UI_SNAP_WIDTHS || "375,768,1440").split(",").map(Number);
const THEMES = (process.env.UI_SNAP_THEMES || "light,dark").split(",");
const SESSION = "-s=ui-snapshots";

if (!EMAIL || !PASSWORD) {
  console.error("Thiếu UI_SNAP_EMAIL / UI_SNAP_PASSWORD (tài khoản đăng nhập app để chụp).");
  process.exit(1);
}

// Windows: playwright-cli là file .cmd nên phải chạy qua shell — bọc từng đối số trong "..." (mã JS bên dưới không dùng dấu ").
const WIN = process.platform === "win32";
const cli = (...args) => execFileSync("playwright-cli", [SESSION, ...args].map((a) => (WIN ? `"${a}"` : a)), { encoding: "utf8", shell: WIN });
const evalJs = (code) => cli("--raw", "eval", code).trim();
const wait = (ms) => evalJs(`new Promise((r) => setTimeout(() => r(1), ${ms}))`);

fs.mkdirSync(OUT, { recursive: true });
cli("open", URL);
try {
  cli("resize", "1440", "900");
  cli("fill", "#auth_login_email", EMAIL);
  cli("fill", "#auth_login_password", PASSWORD);
  cli("click", "#btnAuthLogin");
  wait(5000);
  const loggedIn = evalJs("getComputedStyle(document.getElementById('authOverlay')).display === 'none'");
  if (loggedIn !== "true") throw new Error("Đăng nhập không thành công — kiểm tra tài khoản/máy chủ.");

  let n = 0;
  for (const theme of THEMES) {
    evalJs(`(() => { document.documentElement.setAttribute('data-theme', '${theme}'); return 1; })()`);
    for (const width of WIDTHS) {
      cli("resize", String(width), width < 600 ? "812" : "900");
      for (const tab of TABS) {
        evalJs(`(() => { const b = document.querySelector('[data-tab=${tab}]'); if (b) b.click(); return !!b; })()`);
        wait(1200);
        evalJs("(() => { window.scrollTo(0, 0); return 1; })()");
        const file = path.join(OUT, `${theme}-${width}-${tab}.png`);
        cli("screenshot", "--full-page", `--filename=${file}`);
        n++;
        process.stdout.write(`\r${n} ảnh`);
      }
    }
  }
  console.log(`\nĐã lưu ${n} ảnh vào ${OUT}`);
} finally {
  try { cli("close"); } catch (e) { /* trình duyệt đã đóng */ }
}
