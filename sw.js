/* sw.js — Service Worker cho DGA Web App.
 * Cung cấp khả năng chạy hoàn toàn ngoại tuyến (Offline-First) và nạp tức thì qua Cache Storage.
 * API backend (Google Apps Script / Supabase) được bypass để lớp Storage (storage.js) xử lý
 * hàng đợi và tự động đồng bộ (Outbox Sync Pattern).
 */

const CACHE_NAME = "dga-offline-v64-tick-duval";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/presentation/early-layout.js",
  "./config.js",
  "./src/data/drivers/storage-core.js",
  "./src/data/drivers/storage-remote.js",
  "./src/data/drivers/storage-local.js",
  "./src/data/drivers/storage-offline.js",
  "./src/data/drivers/storage-auth.js",
  "./src/data/drivers/storage-repo.js",
  "./src/data/storage.js",
  "./src/domain/dga-logic.js",
  "./src/presentation/app-status.js",
  "./src/presentation/app-views.js",
  "./src/presentation/app-core.js",
  "./src/presentation/styles/tokens.css",
  "./src/presentation/styles/style-base.css",
  "./src/presentation/styles/style-auth.css",
  "./src/presentation/styles/style-nav-layout.css",
  "./src/presentation/styles/style-components.css",
  "./src/presentation/styles/style-tab-feedback.css",
  "./src/presentation/styles/style-tab-tables.css",
  "./src/presentation/styles/style-tabs-secondary.css",
  "./src/presentation/styles/style-tab-regulation-config.css",
  "./src/presentation/styles/style-dieu54-charts.css",
  "./src/presentation/styles/style-dga-workflow.css",
  "./assets/image/app-icon-96.webp",
  "./assets/image/favicon-32.png",
  "./assets/image/favicon-16.png",
  "./assets/image/apple-touch-icon.png",
  "./assets/image/app-icon-192.webp",
  "./src/domain/dga-logic-core.js",
  "./src/domain/dga-logic-gas.js",
  "./src/domain/dga-logic-oil.js",
  "./src/domain/dga-logic-instrument-oil.js",
  "./src/domain/dga-logic-iec60422-2024.js",
  "./src/domain/dga-logic-oil-extended.js",
  "./src/domain/dga-logic-forecast.js",
  "./src/domain/dga-logic-regulation-config.js",
  "./src/domain/dga-logic-peer.js",
  "./src/domain/dga-logic-case.js",
  "./src/presentation/components/ui-errors.js",
  "./src/presentation/tabs/ui-auth.js",
  "./src/presentation/components/ui-utils.js",
  "./src/presentation/components/ui-combobox.js",
  "./src/presentation/components/ui-dropzone.js",
  "./src/presentation/components/ui-layout.js",
  "./src/presentation/components/ui-busy.js",
  "./src/presentation/components/ui-theme.js",
  "./src/presentation/tabs/ui-guides.js",
  "./src/presentation/tabs/ui-dieu54-charts.js",
  "./src/presentation/tabs/ui-dga-workflow.js",
  "./src/presentation/components/ui-terms.js",
  "./src/presentation/tabs/ui-dga.js",
  "./src/presentation/tabs/ui-standards.js",
  "./src/presentation/tabs/ui-regulation-config.js",
  "./src/presentation/tabs/ui-admin.js",
  "./src/presentation/tabs/ui-oil.js",
  "./src/presentation/tabs/ui-oltc.js",
  "./src/presentation/tabs/ui-oil-bbtn-export.js",
  "./src/presentation/tabs/ui-ti-oil.js",
  "./src/presentation/tabs/ui-ti-oil-3pha.js",
  "./src/presentation/tabs/ui-history.js",
  "./src/presentation/components/ui-input-subtabs.js",
  "./src/presentation/tabs/ui-device-specs.js",
  "./src/presentation/tabs/ui-oil-batch-import.js",
  "./src/presentation/tabs/ui-trend.js",
  "./src/presentation/tabs/ui-alerts.js",
  "./src/presentation/tabs/ui-feedback.js",
  "./src/data/io/bbtn-export.js",
  "./src/data/io/bbtn-import.js",
  "./src/data/io/nameplate-import.js",
  "./src/data/io/mba-oil-bbtn.js",
  "./src/data/io/oil-bbtn.js",
  "./src/data/io/mba-oil-bbtn-export.js",
  "./src/data/io/device-specs.js",
  "./assets/template/template-bbtn-ly-hoa-dau.docx",
  "./src/data/io/tech-report-export.js",
  "./src/presentation/tabs/ui-batch-import.js",
  "./vendor/docxtemplater/pizzip.min.js",
  "./vendor/docxtemplater/docxtemplater.min.js",
  "./vendor/supabase/supabase.js",
  "./vendor/chartjs/chart.umd.min.js",
  "./vendor/xlsx/xlsx.full.min.js",
  // bbtn-import.js / nameplate-import.js (ES module) import tĩnh 2 file này — thiếu thì 2 module không nạp được
  // khi mất mạng. Worker nặng (pdf.worker ~1,3 MB, lõi OCR ~3,9 MB + dữ liệu ngôn ngữ) chỉ tải khi đọc PDF → để
  // runtime cache (network-first bên dưới) lưu lại sau lần dùng đầu lúc có mạng.
  "./vendor/pdfjs/pdf.min.js",
  "./vendor/tesseract/tesseract.esm.min.js",
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
      // caches.match() trả Promise (luôn "truthy") nên "a || b" cũ không bao giờ thử "./" — nối bằng .then.
      fetch(req).catch(() => caches.match("./index.html").then((res) => res || caches.match("./")))
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
