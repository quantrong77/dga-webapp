/* sw.js — Service Worker cho DGA Web App.
 * Cung cấp khả năng chạy hoàn toàn ngoại tuyến (Offline-First) và nạp tức thì qua Cache Storage.
 * API backend (Google Apps Script / Supabase) được bypass để lớp Storage (storage.js) xử lý
 * hàng đợi và tự động đồng bộ (Outbox Sync Pattern).
 */

const CACHE_NAME = "dga-offline-v12-workflow";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./early-layout.js",
  "./config.js",
  "./storage/storage-core.js",
  "./storage/storage-remote.js",
  "./storage/storage-local.js",
  "./storage/storage-offline.js",
  "./storage/storage-auth.js",
  "./storage.js",
  "./dga-logic.js",
  "./app-core.js",
  "./style.css",
  "./css/style-base.css",
  "./css/style-auth.css",
  "./css/style-nav-layout.css",
  "./css/style-components.css",
  "./css/style-tab-feedback.css",
  "./css/style-tab-tables.css",
  "./css/style-tabs-secondary.css",
  "./css/style-tab-regulation-config.css",
  "./css/style-dieu54-charts.css",
  "./css/style-dga-workflow.css",
  "./image/app-icon-96.webp",
  "./image/favicon-32.png",
  "./image/favicon-16.png",
  "./image/apple-touch-icon.png",
  "./logic/dga-logic-core.js",
  "./logic/dga-logic-gas.js",
  "./logic/dga-logic-oil.js",
  "./logic/dga-logic-instrument-oil.js",
  "./logic/dga-logic-iec60422-2024.js",
  "./logic/dga-logic-forecast.js",
  "./logic/dga-logic-regulation-config.js",
  "./logic/dga-logic-peer.js",
  "./logic/dga-logic-case.js",
  "./ui/ui-errors.js",
  "./ui/ui-auth.js",
  "./ui/ui-utils.js",
  "./ui/ui-combobox.js",
  "./ui/ui-dropzone.js",
  "./ui/ui-layout.js",
  "./ui/ui-busy.js",
  "./ui/ui-theme.js",
  "./ui/ui-guides.js",
  "./ui/ui-dieu54-charts.js",
  "./ui/ui-dga-workflow.js",
  "./ui/ui-dga.js",
  "./ui/ui-standards.js",
  "./ui/ui-regulation-config.js",
  "./ui/ui-admin.js",
  "./ui/ui-oil.js",
  "./ui/ui-oltc.js",
  "./ui/ui-ti-oil.js",
  "./ui/ui-ti-oil-3pha.js",
  "./ui/ui-history.js",
  "./ui/ui-trend.js",
  "./ui/ui-alerts.js",
  "./ui/ui-feedback.js",
  "./bbtn/bbtn-export.js",
  "./bbtn/oil-bbtn.js",
  "./bbtn/tech-report-export.js",
  "./ui/ui-batch-import.js",
  "./vendor/docxtemplater/pizzip.min.js",
  "./vendor/docxtemplater/docxtemplater.min.js",
  "./vendor/supabase/supabase.js",
  "./vendor/chartjs/chart.umd.min.js",
  "./vendor/xlsx/xlsx.full.min.js",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // cache.addAll có thể fail nếu 1 file không tồn tại; dùng map từng file để an toàn
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] Không thể precache asset:", url, err);
          })
        )
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log("[SW] Xóa cache cũ:", k);
            return caches.delete(k);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Chỉ xử lý GET requests (POST/PUT/DELETE gửi lên Google Apps Script/Supabase để nguyên)
  if (req.method !== "GET") return;

  // Bỏ qua các API endpoint động hoặc OAuth (để Storage layer quản lý)
  if (
    url.pathname.startsWith("/api") ||
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("script.googleusercontent.com") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("accounts.google.com")
  ) {
    return;
  }

  // Đối với điều hướng trang (Navigation / index.html)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html") || caches.match("./"))
    );
    return;
  }

  // Đối với tài nguyên cùng nguồn (local static assets: JS, CSS, HTML...)
  // Ưu tiên mạng trước (Network-First) để luôn nhận bản cập nhật mới nhất,
  // nếu mất mạng mới trả về bản trong Cache (Offline-First dự phòng).
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Đối với CDN và thư viện ngoài: Cache-First để tối ưu tốc độ và tiết kiệm băng thông
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
