// Lỗi #8 (BUGS_FOUND.md): mở app bằng file:// thì trình duyệt chặn 2 module đọc BBTN PDF / ảnh nhãn (ES module,
// Web Worker, WASM) — trước đây app báo "chưa tải xong, thử lại sau vài giây" (không bao giờ hết). Nay báo rõ phải mở
// qua máy chủ. Kiểm hàm dùng chung + mọi chỗ báo "chưa tải xong" ở tầng giao diện đều đi qua hàm này.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const UTILS = fs.readFileSync(path.join(ROOT, "src", "presentation", "components", "ui-utils.js"), "utf8");

function load(protocol) {
  const ctx = { location: { protocol, href: protocol + "//x/index.html" }, URL, document: {}, console };
  vm.createContext(ctx);
  vm.runInContext(UTILS, ctx);
  return ctx.importModuleUnavailableMessage;
}

describe("importModuleUnavailableMessage (lỗi #8)", () => {
  test("file:// → hướng dẫn chạy chay_dga_offline.bat / npm start, mở http://localhost:8080", () => {
    const msg = load("file:")("chưa tải xong");
    expect(msg).toContain("file://");
    expect(msg).toContain("chay_dga_offline.bat");
    expect(msg).toContain("http://localhost:8080");
    expect(msg).not.toContain("chưa tải xong");
  });
  test.each(["http:", "https:"])("%s → giữ nguyên thông báo cũ", (proto) => {
    expect(load(proto)("chưa tải xong")).toBe("chưa tải xong");
  });
});

test("mọi thông báo 'chưa tải xong' của bộ đọc PDF / OCR ở giao diện đều qua importModuleUnavailableMessage", () => {
  const dir = path.join(ROOT, "src", "presentation");
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".js")) files.push(p);
    }
  })(dir);
  const bad = [];
  for (const f of files) {
    fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
      if (/chưa tải xong/i.test(line) && /(?:PDF|OCR)/.test(line) && !line.includes("importModuleUnavailableMessage(")) {
        bad.push(`${path.relative(ROOT, f)}:${i + 1}`);
      }
    });
  }
  expect(bad).toEqual([]);
});
