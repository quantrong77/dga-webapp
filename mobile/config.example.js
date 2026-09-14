/*
 * config.example.js (BẢN MOBILE) — File mẫu cấu hình cho ứng dụng di động DGA.
 *
 * HƯỚNG DẪN:
 * Sao chép file này thành mobile/config.js và điền thông số GIỐNG HỆT bản web app
 * để đồng bộ dữ liệu giữa 2 giao diện.
 */
window.DGA_CONFIG = {
  // URL Web App triển khai từ Google Apps Script (gsheet/Code.gs)
  GSHEET_WEBAPP_URL: "",

  // Thông số cấu hình Supabase (nếu chọn chế độ Supabase)
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Google OAuth 2.0 Client ID cho tính năng Đăng nhập bằng Google (tùy chọn)
  GOOGLE_CLIENT_ID: "",
};
