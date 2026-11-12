#!/usr/bin/env node
/* scripts/check-contrast.js — Kiểm tra độ tương phản WCAG của các cặp màu chữ/nền khai báo trong tokens.css, cho cả
 * giao diện sáng (:root) và tối (:root[data-theme="dark"]). Cặp nào < 4,5:1 (chữ thường, mức AA) thì báo lỗi, thoát mã 1.
 *
 *   node scripts/check-contrast.js
 *
 * Chỉ xét màu hex (#rgb/#rrggbb); token dạng rgba() hoặc không có trong theme thì bỏ qua cặp đó (ghi "bỏ qua").
 * Thêm cặp mới vào PAIRS khi thêm token chữ/nền mới. */
const fs = require("fs");
const path = require("path");

const CSS = fs.readFileSync(path.join(__dirname, "..", "src", "presentation", "styles", "tokens.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// [chữ, nền, ghi chú] — ngưỡng 4,5:1 (AA chữ thường) trừ khi ghi min khác.
const PAIRS = [
  ["--text-primary", "--surface"], ["--text-primary", "--surface-page"], ["--text-secondary", "--surface"],
  ["--text-secondary", "--surface-page"], ["--text-tertiary", "--surface"], ["--text-tertiary", "--surface-sunken"],
  ["--gray-700", "--surface"], ["--blue-700", "--surface"], ["--blue-900", "--surface"], ["--blue-700", "--blue-100"],
  ["--btn-primary-text", "--btn-primary"], ["--btn-primary-text", "--btn-primary-hover"], ["--on-dark", "--header-bg"],
  ["--ok", "--ok-bg"], ["--bad", "--bad-bg"], ["--warn", "--warn-bg"], ["--accent", "--accent-bg"],
  ["--ok", "--surface"], ["--bad", "--surface"], ["--warn", "--surface"],
  ["--status-online-text", "--status-online-bg"], ["--status-offline-text", "--status-offline-bg"],
  ["--status-syncing-text", "--status-syncing-bg"], ["--status-local-text", "--status-local-bg"],
  ["--status-error", "--status-error-bg"], ["--tooltip-text", "--tooltip-bg"],
  ["--on-accent", "--ok-solid"], ["--on-accent", "--warn-solid"], ["--on-accent", "--bad-solid"],
];

function block(selectorRe) {
  const out = {};
  const re = new RegExp(selectorRe.source + "\\s*\\{([^}]*)\\}", "g");
  let m;
  while ((m = re.exec(CSS))) {
    for (const d of m[1].split(";")) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      const k = d.slice(0, i).trim();
      if (k.startsWith("--")) out[k] = d.slice(i + 1).trim();
    }
  }
  return out;
}

const light = block(/(?:^|\n)\s*:root/);
const dark = { ...light, ...block(/:root\[data-theme="dark"\]/) };

function resolve(vars, name, depth = 0) {
  const v = vars[name];
  if (!v || depth > 10) return null;
  const ref = v.match(/^var\((--[\w-]+)(?:,[^)]*)?\)$/);
  return ref ? resolve(vars, ref[1], depth + 1) : v;
}
function hex(v) {
  if (!v) return null;
  if (/^#fff$/i.test(v)) return "#ffffff";
  const m3 = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m3) return "#" + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}
function lum(h) {
  const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

let fails = 0;
for (const [themeName, vars] of [["sáng", light], ["tối", dark]]) {
  console.log(`\n== Giao diện ${themeName}`);
  for (const [fg, bg, min = 4.5] of PAIRS) {
    const a = hex(resolve(vars, fg));
    const b = hex(resolve(vars, bg));
    if (!a || !b) { console.log(`  bỏ qua  ${fg} / ${bg}`); continue; }
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(`  ${ok ? "đạt   " : "KHÔNG "} ${r.toFixed(2).padStart(5)}:1  ${fg} ${a} / ${bg} ${b}`);
  }
}
console.log(fails ? `\n${fails} cặp chưa đạt AA (4,5:1).` : "\nMọi cặp đều đạt AA.");
process.exit(fails ? 1 : 0);
