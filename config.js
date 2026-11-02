/*
 * config.js — Cấu hình chế độ lưu trữ cho nhánh On-Premise Local Server.
 *
 * Trên nhánh này, toàn bộ dữ liệu và file đính kèm được xử lý bởi Máy chủ nội bộ (server/api.js)
 * chạy trên localhost:8080 hoặc máy chủ mạng LAN của đơn vị, HOÀN TOÀN KHÔNG KẾT NỐI INTERNET.
 */
window.DGA_CONFIG = {
  // Máy chủ nội bộ On-Premise (Localhost / LAN Server)
  // - Khi mở bằng http://localhost:8080: dùng relative path "/api"
  // - Khi mở trực tiếp bằng file:///.../index.html: dùng "http://localhost:8080/api"
  LOCAL_SERVER_URL:
    typeof window !== "undefined" && window.location.protocol === "file:"
      ? "http://localhost:8080/api"
      : "/api",

  // Để trống Google Sheets trên nhánh on-premise để không gửi bất kỳ request nào ra ngoài Internet
  GSHEET_WEBAPP_URL: "",
  GSHEET_SHEET_URL: "",

  // Supabase để trống
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Để trống Google Client ID khi offline để không gọi accounts.google.com
  GOOGLE_CLIENT_ID: "",
};
