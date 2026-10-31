/* early-layout.js — nạp bằng <script> ĐỒNG BỘ ngay đầu <body> (index.html), trước khi phần
   còn lại của trang render. Trước đây là 1 khối <script> inline; tách ra file riêng vì Content
   Security Policy (thẻ meta CSP trong <head>) không cho chạy script inline.

   Đọc lựa chọn bố cục thanh tab đã lưu trước đó (ngang/dọc) và áp dụng NGAY để tránh nháy layout
   (đổi từ ngang sang dọc ngay sau khi tải xong) — không đặt ở <head> vì lúc đó document.body CHƯA
   tồn tại. Đây là SỞ THÍCH GIAO DIỆN riêng của trình duyệt đang dùng (không phải dữ liệu nghiệp vụ)
   nên lưu ở localStorage, không qua Storage (gsheet/Supabase) — xem setupTabLayoutToggle() ở
   app-core.js (gắn sự kiện bấm nút #btnToggleTabLayout + lưu lại lựa chọn khi đổi). */
// Giao diện sáng/tối: áp trước khi vẽ trang để không nháy nền trắng. Chưa chọn thì theo hệ điều hành.
(function () {
  let saved = null;
  try { saved = localStorage.getItem("dga_theme"); } catch (e) {}
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light";
})();

try {
  if (localStorage.getItem("dga_tab_layout") === "sidebar") {
    document.body.classList.add("tabs-sidebar");
  }
  // Trạng thái "thu gọn sidebar" (chỉ có ý nghĩa khi đang ở bố cục dọc) — cũng đọc và áp dụng SỚM
  // ở đây cùng lúc để tránh nháy (sidebar rộng đầy đủ rồi mới co lại ngay sau khi JS ở app-core.js
  // chạy) — xem setupSidebarCollapseToggle().
  if (localStorage.getItem("dga_sidebar_collapsed") === "1") {
    document.body.classList.add("sidebar-collapsed");
  }
} catch (e) {}
