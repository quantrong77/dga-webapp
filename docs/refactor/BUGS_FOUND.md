# Lỗi phát hiện trong quá trình tái cấu trúc

Theo quy tắc B.2 của `REFACTOR_PLAN.md`: lỗi thật **không sửa lẫn** trong commit refactor. Mỗi lỗi ghi ở đây, chờ chủ
dự án quyết định sửa riêng (commit `fix(...)` tách biệt) hay để sau.

| # | Phát hiện ở | Mức độ | Trạng thái |
|---|---|---|---|
| 1 | Bước 0 | Thấp | Chờ quyết định |
| 2 | Bước 0 | **Cao** — chế độ offline không hoạt động | Chờ quyết định |

---

## #1. Tab Quản trị (on-premise) gọi `supabaseSyncStatus` → HTTP 400

- **Hiện tượng:** mở tab Quản trị khi chạy `npm start` → console có lỗi
  `Failed to load resource: the server responded with a status of 400` cho
  `/api?action=supabaseSyncStatus&token=...`.
- **Nguyên nhân:** `ui/ui-admin.js:136` gọi `Auth.supabaseSyncStatus()` → `storage/storage-auth.js:162` gửi
  `gsheetGet("supabaseSyncStatus")`. Action này chỉ có ở `gsheet/Code.gs:365`; `server/api.js` không có nên trả 400.
- **Ảnh hưởng:** chỉ là 1 lỗi console + khối "Bản sao Supabase" không có trạng thái; không mất dữ liệu.
- **Hướng sửa đề xuất:** ở chế độ on-premise thì không gọi (hoặc `server/api.js` trả `{ enabled: false }`).

## #2. Service Worker không bao giờ được đăng ký → không có bộ nhớ đệm offline

- **Hiện tượng:** sau khi mở app (on-premise `http://localhost:8091` hoặc bản tĩnh như GitHub Pages) và chờ 5 giây,
  `navigator.serviceWorker.getRegistration()` trả `undefined`. Không có cache `dga-offline-*` → tắt mạng rồi tải lại
  trang thì app không mở được. Hàng đợi đồng bộ (`storage/storage-offline.js`, localStorage) vẫn chạy bình thường;
  chỉ phần "mở app khi mất mạng" là hỏng.
- **Nguyên nhân:** `registerServiceWorker()` (`app-core.js:906`) chỉ gắn trình nghe
  `window.addEventListener("load", ...)`. Hàm này được gọi trong `initApp()` (`app-core.js:102`), mà `initApp()` chỉ
  chạy **sau khi đăng nhập xong** (`ui/ui-auth.js:137`, `:160`, có `await`). Lúc đó sự kiện `load` đã xảy ra từ lâu
  → trình nghe không bao giờ chạy.
- **Hướng sửa đề xuất:** nếu `document.readyState === "complete"` thì đăng ký ngay, ngược lại mới chờ `load`
  (hoặc gọi `registerServiceWorker()` từ đầu trang, trước màn hình đăng nhập). Sau khi sửa phải tăng tên cache trong
  `sw.js` và kiểm tra kịch bản D.9 (tắt mạng → tải lại trang).
- **Ghi chú:** Bước 7 của kế hoạch (kiểm thử offline bằng Service Worker) sẽ không đạt nếu chưa sửa lỗi này.
