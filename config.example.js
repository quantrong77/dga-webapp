/*
 * config.example.js — File mẫu cấu hình cho ứng dụng DGA Web App.
 *
 * HƯỚNG DẪN:
 * Sao chép file này thành config.js và điền thông tin của bạn.
 * KHÔNG commit file config.js chứa URL riêng tư lên kho mã nguồn công khai (Git).
 *
 * Chọn 1 trong 3 chế độ lưu trữ (điền đúng 1 mục, để trống các mục còn lại):
 *
 * 1) GOOGLE SHEETS (Đơn giản nhất, dùng Google Apps Script):
 *    Điền GSHEET_WEBAPP_URL = URL Web App bạn deploy từ Apps Script (xem gsheet/Code.gs).
 *
 * 2) SUPABASE (Postgres, có Row Level Security):
 *    Điền SUPABASE_URL và SUPABASE_ANON_KEY (Settings > API trong dự án Supabase).
 *
 * 3) KHÔNG ĐIỀN GÌ:
 *    Dữ liệu tự động lưu vào localStorage của trình duyệt (chế độ chạy thử cá nhân).
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
