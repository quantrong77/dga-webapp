/*
 * config.js (BẢN MOBILE) — PHẢI điền GIỐNG HỆT config.js của bản web app (cùng
 * GSHEET_WEBAPP_URL/SUPABASE_URL/SUPABASE_ANON_KEY/GOOGLE_CLIENT_ID) thì 2 app mới
 * đọc/ghi chung 1 nơi lưu trữ (storage.js dùng đúng file này để quyết định gọi tới
 * đâu — xem storage.js, không đổi tên biến/khoá bên dưới). Đổi 1 bên mà quên đổi
 * bên kia là nguyên nhân phổ biến nhất khiến "mobile không thấy dữ liệu của web".
 *
 * chọn 1 trong 3 chế độ lưu trữ (điền đúng 1 mục, để trống các mục còn lại):
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
 *
 * ĐĂNG NHẬP BẰNG GOOGLE (tùy chọn, chỉ có tác dụng ở chế độ Google Sheets):
 *   Điền GOOGLE_CLIENT_ID = OAuth Client ID tạo tại console.cloud.google.com
 *   (APIs & Services > Credentials > Create Credentials > OAuth client ID > Web
 *   application). Phải khớp với GOOGLE_CLIENT_ID đã điền trong gsheet/Code.gs (2
 *   nơi phải giống hệt nhau). Để trống thì nút "Đăng nhập bằng Google" tự ẩn, chỉ
 *   còn đăng nhập email/mật khẩu như trước — không bắt buộc phải dùng.
 */
window.DGA_CONFIG = {
  GSHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbx5tqUPqL2Hu6Fh9fDjdA_vPsHUbwwNHYnzFTnZsfxVrCAZGXFXTGTtv2WUeSPyuQJ4/exec",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  GOOGLE_CLIENT_ID: "162684736346-spsmoiqgk6sp3k5d8l24h85p1mcd5cja.apps.googleusercontent.com",
};
