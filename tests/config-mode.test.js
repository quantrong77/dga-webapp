/* config.js tự chọn chế độ theo nơi mở app: On-Premise (file:/localhost/LAN) hay
 * Online (GitHub Pages — Google Sheets + đăng nhập Google). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");

function loadConfig(href) {
  const u = new URL(href);
  const window = { location: { protocol: u.protocol, hostname: u.hostname } };
  vm.runInNewContext(SRC, { window });
  return window.DGA_CONFIG;
}

describe("config.js — chọn chế độ theo host", () => {
  test.each([
    ["file:///C:/dga-webapp/index.html", "http://localhost:8080/api"],
    ["http://localhost:8080/", "/api"],
    ["http://127.0.0.1:8080/", "/api"],
    ["http://192.168.1.20:8080/", "/api"],
    ["http://10.0.0.5:8080/", "/api"],
    ["http://172.20.1.1:8080/", "/api"],
  ])("%s -> On-Premise, không gọi Google", (href, api) => {
    const cfg = loadConfig(href);
    expect(cfg.DEPLOY_MODE).toBe("on-premise");
    expect(cfg.LOCAL_SERVER_URL).toBe(api);
    expect(cfg.GSHEET_WEBAPP_URL).toBe("");
    expect(cfg.GOOGLE_CLIENT_ID).toBe("");
  });

  test.each(["https://quantrong77.github.io/dga-webapp/", "https://dga.example.com/"])(
    "%s -> Online: Google Sheets + Google Sign-In",
    (href) => {
      const cfg = loadConfig(href);
      expect(cfg.DEPLOY_MODE).toBe("online");
      expect(cfg.LOCAL_SERVER_URL).toBe("");
      expect(cfg.GSHEET_WEBAPP_URL).toMatch(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/);
      expect(cfg.GOOGLE_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/);
    }
  );

  test("CSP trong index.html cho phép Google Sign-In và Apps Script", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
    expect(csp).toContain("https://accounts.google.com/gsi/client");
    expect(csp).toContain("https://script.google.com");
    expect(csp).toContain("https://script.googleusercontent.com");
    expect(csp).toMatch(/frame-src[^;]*https:\/\/accounts\.google\.com/);
  });

  test("cache name trong index.html khớp sw.js (tránh tự xóa cache mới)", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
    const swName = sw.match(/const CACHE_NAME = "([^"]+)"/)[1];
    expect(html).toContain(`k !== "${swName}"`);
  });
});
