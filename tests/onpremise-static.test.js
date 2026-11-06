// Lỗi #4 (docs/refactor/BUGS_FOUND.md): máy chủ nội bộ chỉ được phục vụ file web theo DANH SÁCH CHO PHÉP —
// không lộ data/database.json, data/uploads/, .git/, mã máy chủ, tài liệu nội bộ, BBTN thật trong assets/template/.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { isAllowedStaticPath } = require("../backend/onpremise/static-allowlist");
const { requiredPaths } = require("../scripts/build-pages-site");

const ROOT = path.resolve(__dirname, "..");

describe("isAllowedStaticPath — danh sách cho phép", () => {
  test.each([
    "index.html", "sw.js", "config.js", "manifest.webmanifest",
    "src/presentation/app-core.js", "src/presentation/styles/tokens.css", "src/data/io/bbtn-import.js",
    "vendor/chartjs/chart.umd.min.js", "assets/image/app-icon-96.webp",
    "assets/template/template-bbtn-dga.docx", "mobile/index.html", "mobile/template/template-bbtn-dga.docx",
  ])("cho phép %s", (p) => expect(isAllowedStaticPath(p)).toBe(true));

  test.each([
    "data/database.json", "data/uploads/2026/11/6e2433e7_Bien_ban_DGA_2026_AT2.pdf", ".git/config", ".git/HEAD",
    "backend/onpremise/auth.js", "backend/gsheet/Code.gs", "node_modules/jest/package.json", "docs/refactor/SECURITY_NOTE.md",
    "README.md", "REFACTOR_PLAN.md", "package.json", "package-lock.json", "tests/storage-characterization.test.js",
    "scripts/build-pages-site.js", "assets/template/bbtn-ly-hoa-dau-mba-oltc-1pha.docx", "assets/template/~$mplate-bbtn-dga.docx",
    "src/README.md", "mobile/README.md", "src/.env", "src/../data/database.json", "src/../../etc/passwd", "../index.html",
    "/index.html", "C:/Windows/win.ini", "", "src", "src/", "assets/image",
  ])("chặn %j", (p) => expect(isAllowedStaticPath(p)).toBe(false));

  test("mọi tài nguyên index.html / mobile / manifest / sw.js (precache) / mẫu BBTN cần đều được phép", () => {
    const need = requiredPaths(ROOT);
    expect(need.length).toBeGreaterThan(50);
    expect(need.filter((p) => !isAllowedStaticPath(p))).toEqual([]);
  });
});

describe("backend/onpremise/serve.js — gọi HTTP thật", () => {
  let child, port, dataDir;
  const get = (p) => new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: p }, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dga-static-"));
    fs.writeFileSync(path.join(dataDir, "database.json"), JSON.stringify({ users: [{ email: "bi-mat@example.com" }] }));
    port = 18000 + Math.floor(Math.random() * 2000);
    child = spawn(process.execPath, [path.join(ROOT, "backend", "onpremise", "serve.js")], {
      env: { ...process.env, PORT: String(port), DGA_DATA_DIR: dataDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("máy chủ không khởi động")), 10000);
      child.stdout.on("data", (d) => { if (/đang chạy/.test(String(d))) { clearTimeout(t); resolve(); } });
    });
  });

  afterAll(() => {
    if (child) child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  test.each(["/", "/index.html", "/sw.js", "/src/presentation/app-core.js", "/assets/template/template-bbtn-dga.docx", "/mobile/index.html"])(
    "200 %s", async (p) => expect((await get(p)).status).toBe(200));

  test.each([
    "/data/database.json", "/data/uploads/x.pdf", "/.git/config", "/backend/onpremise/auth.js", "/node_modules/jest/package.json",
    "/docs/refactor/SECURITY_NOTE.md", "/README.md", "/package.json", "/tests/onpremise-static.test.js",
    "/src/%2e%2e/data/database.json", "/src/..%2f..%2fdata/database.json", "/assets/template/bbtn-ly-hoa-dau-mba-oltc-1pha.docx",
  ])("404 %s (không lộ nội dung)", async (p) => {
    const r = await get(p);
    expect(r.status).toBe(404);
    expect(r.body).not.toMatch(/password_hash|bi-mat@example\.com|"users"|\[core\]/);
  });

  test("API vẫn chạy (đường /api không bị danh sách chặn)", async () => {
    const r = await get("/api?action=health");
    expect(r.status).not.toBe(404);
  });
});
