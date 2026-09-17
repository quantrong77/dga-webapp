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
  GSHEET_WEBAPP_URL:"https://script.google.com/macros/s/AKfycbzZM6-fkFkWvfX1G4WHMhzT7p5VFB5ZsT3KBHaO-BLJWtKiNoW9qTDy4RonOSyx4hyp/exec",
  GSHEET_SHEET_URL: "https://docs.google.com/spreadsheets/d/1Pm5Nq5wY-1sBDUl5DFNBtxfGqH_Ij_SsZIAJQJ0WaAU/edit", // Dán link Google Sheet (docs.google.com/spreadsheets/d/...) để bấm badge "Database" mở nhanh Sheet
  SUPABASE_URL: "https://sfnnbdyazqguwnubzjhg.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbm5iZHlhenFndXdudWJ6amhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MDQ2MDEsImV4cCI6MjEwNTE4MDYwMX0.8mAzu7EGp8vsiglPFIL7Y70yCUg-qt7g2Gt_PbXF0xk",
  GOOGLE_CLIENT_ID: "162684736346-spsmoiqgk6sp3k5d8l24h85p1mcd5cja.apps.googleusercontent.com",
};
