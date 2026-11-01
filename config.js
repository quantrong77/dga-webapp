/*
 * config.js — chọn chế độ lưu trữ:
 *
 * 1) MÁY CHỦ NỘI BỘ ON-PREMISE (Localhost / Mạng LAN Intranet PTC3 - Ưu tiên hàng đầu):
 *    Điền LOCAL_SERVER_URL = "/api" (hoặc URL máy chủ nội bộ http://10.x.x.x:8080/api).
 *    Mặc định tự động nhận diện khi chạy trên localhost hoặc 127.0.0.1 để phục vụ thử nghiệm nội bộ.
 *
 * 2) GOOGLE SHEETS (khi truy cập đám mây qua GitHub Pages):
 *    Điền GSHEET_WEBAPP_URL = URL Web App deploy từ Google Apps Script (gsheet/Code.gs).
 *
 * 3) SUPABASE (Postgres Cloud / Self-hosted):
 *    Điền SUPABASE_URL và SUPABASE_ANON_KEY.
 *
 * 4) KHÔNG ĐIỀN GÌ: dữ liệu tự động lưu vào localStorage của trình duyệt (chế độ thử nghiệm Offline).
 *
 * Thứ tự ưu tiên: On-Premise Local Server > Google Sheets > Supabase > localStorage.
 */
window.DGA_CONFIG = {
  // Máy chủ nội bộ On-Premise (Tự động kích hoạt khi chạy trên máy localhost/127.0.0.1)
  LOCAL_SERVER_URL:
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? "/api"
      : "",

  // Google Sheets (khi chạy Online trên Cloud/GitHub Pages)
  GSHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbzZM6-fkFkWvfX1G4WHMhzT7p5VFB5ZsT3KBHaO-BLJWtKiNoW9qTDy4RonOSyx4hyp/exec",
  GSHEET_SHEET_URL: "https://docs.google.com/spreadsheets/d/1Pm5Nq5wY-1sBDUl5DFNBtxfGqH_Ij_SsZIAJQJ0WaAU/edit",

  // Supabase (PostgreSQL dự phòng)
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  GOOGLE_CLIENT_ID: "162684736346-spsmoiqgk6sp3k5d8l24h85p1mcd5cja.apps.googleusercontent.com",
};
