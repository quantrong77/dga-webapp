/*
 * config.js — chọn 1 trong 3 chế độ lưu trữ (điền đúng 1 mục, để trống các mục còn lại):
 *
 * 1) GOOGLE SHEETS (đơn giản nhất, không cần tài khoản bên thứ 3 — chỉ cần Google):
 *    Điền GSHEET_WEBAPP_URL = URL Web App bạn deploy từ Apps Script (xem thư mục
 *    gsheet/Code.gs và README.md, mục "Dùng Google Sheets thay Supabase").
 *
 * 2) SUPABASE (Postgres, có Row Level Security thực sự — chặt hơn Google Sheets):
 *    Điền SUPABASE_URL và SUPABASE_ANON_KEY (Settings > API trong dự án Supabase).
 *    "anon key" được thiết kế để đặt công khai ở phía trình duyệt/GitHub — không
 *    phải khóa bí mật — miễn là đã bật RLS theo supabase-schema.sql. KHÔNG dán
 *    "service_role key" vào đây.
 *
 * 3) KHÔNG ĐIỀN GÌ: dữ liệu tự động lưu vào localStorage của trình duyệt (dùng
 *    thử ngay, không cần cấu hình, nhưng chỉ máy/trình duyệt hiện tại thấy được).
 *
 * Thứ tự ưu tiên nếu điền nhiều hơn 1: Google Sheets > Supabase > localStorage.
 */
window.DGA_CONFIG = {
  GSHEET_WEBAPP_URL:"https://script.google.com/macros/s/AKfycbx5tqUPqL2Hu6Fh9fDjdA_vPsHUbwwNHYnzFTnZsfxVrCAZGXFXTGTtv2WUeSPyuQJ4/exec",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  GOOGLE_CLIENT_ID: "162684736346-spsmoiqgk6sp3k5d8l24h85p1mcd5cja.apps.googleusercontent.com",
};
