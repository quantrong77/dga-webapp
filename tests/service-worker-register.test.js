// Lỗi #2 (BUGS_FOUND.md): registerServiceWorker() chỉ gắn trình nghe "load", mà được gọi từ initApp() SAU khi đăng
// nhập — lúc "load" đã xảy ra → Service Worker không bao giờ được đăng ký. Test chạy app-status.js trong vm với
// window/document/navigator giả, kiểm cả 2 trường hợp readyState, và nhánh fallback điều hướng offline của sw.js.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "src", "presentation", "app-status.js"), "utf8");

function makeEnv({ readyState, protocol = "http:", hasSW = true, registerImpl } = {}) {
  const listeners = {};
  const registered = [];
  const navigator = {};
  if (hasSW) {
    navigator.serviceWorker = {
      register: (url) => {
        registered.push(url);
        return registerImpl ? registerImpl(url) : Promise.resolve({});
      },
    };
  }
  const window = {
    location: { protocol },
    addEventListener: (type, fn, opts) => {
      (listeners[type] = listeners[type] || []).push({ fn, opts });
    },
  };
  const warnings = [];
  const ctx = {
    window,
    navigator,
    document: { readyState, addEventListener() {}, getElementById: () => null },
    console: { ...console, warn: (...a) => warnings.push(a) },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "app-status.js" });
  return { ctx, listeners, registered, warnings };
}

describe("registerServiceWorker (lỗi #2)", () => {
  test("trang đã tải xong (gọi sau đăng nhập) → đăng ký NGAY, không chờ load", () => {
    const env = makeEnv({ readyState: "complete" });
    env.ctx.registerServiceWorker();
    expect(env.registered).toEqual(["./sw.js"]);
    expect(env.listeners.load).toBeUndefined();
  });

  test.each(["loading", "interactive"])("readyState=%s → chờ sự kiện load (một lần) rồi mới đăng ký", (rs) => {
    const env = makeEnv({ readyState: rs });
    env.ctx.registerServiceWorker();
    expect(env.registered).toEqual([]);
    expect(env.listeners.load).toHaveLength(1);
    expect(env.listeners.load[0].opts).toEqual({ once: true });
    env.listeners.load[0].fn();
    expect(env.registered).toEqual(["./sw.js"]);
  });

  test("file:// → không đăng ký (Service Worker cần http/https)", () => {
    const env = makeEnv({ readyState: "complete", protocol: "file:" });
    env.ctx.registerServiceWorker();
    expect(env.registered).toEqual([]);
  });

  test("trình duyệt không hỗ trợ Service Worker → bỏ qua, không lỗi", () => {
    const env = makeEnv({ readyState: "complete", hasSW: false });
    expect(() => env.ctx.registerServiceWorker()).not.toThrow();
  });

  test("register() thất bại → chỉ cảnh báo console, không ném lỗi", async () => {
    const env = makeEnv({ readyState: "complete", registerImpl: () => Promise.reject(new Error("x")) });
    env.ctx.registerServiceWorker();
    await new Promise((r) => setImmediate(r));
    expect(env.warnings).toHaveLength(1);
    expect(String(env.warnings[0][0])).toContain("Service Worker");
  });
});

describe("sw.js — điều hướng khi mất mạng", () => {
  function loadSW(cacheContent) {
    const handlers = {};
    const self = {
      location: { origin: "http://localhost:8091" },
      addEventListener: (t, fn) => (handlers[t] = fn),
      skipWaiting() {},
      clients: { claim: () => Promise.resolve() },
    };
    const caches = { match: (u) => Promise.resolve(cacheContent[u]) };
    const ctx = { self, caches, URL, fetch: () => Promise.reject(new TypeError("offline")), console };
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"), ctx, { filename: "sw.js" });
    return handlers;
  }
  function navigateOffline(handlers) {
    let responded;
    handlers.fetch({
      request: { method: "GET", mode: "navigate", url: "http://localhost:8091/" },
      respondWith: (p) => (responded = p),
    });
    return responded;
  }

  test("có ./index.html trong cache → trả bản đó", async () => {
    const h = loadSW({ "./index.html": "INDEX", "./": "ROOT" });
    await expect(navigateOffline(h)).resolves.toBe("INDEX");
  });

  test("thiếu ./index.html → thử tiếp ./ (trước đây không bao giờ thử vì Promise luôn truthy)", async () => {
    const h = loadSW({ "./": "ROOT" });
    await expect(navigateOffline(h)).resolves.toBe("ROOT");
  });
});
