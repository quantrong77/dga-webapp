/*
 * config.js — TỰ CHỌN chế độ lưu trữ theo nơi đang mở app (không cần sửa tay khi đổi môi trường):
 *
 * 1) ON-PREMISE (máy chủ nội bộ server/api.js, KHÔNG kết nối Internet) — khi mở bằng:
 *      - file:///.../index.html                  -> gọi http://localhost:8080/api
 *      - http://localhost / 127.0.0.1 / IP LAN   -> gọi "/api" cùng máy chủ (chay_dga_offline.bat)
 *    Ở chế độ này Google Sheets/Google Sign-In bị TẮT hẳn, không gửi request nào ra ngoài.
 *
 * 2) ONLINE (GitHub Pages hoặc domain công khai khác) — dùng Google Sheets (Apps Script
 *    gsheet/Code.gs) làm database + đăng ký/đăng nhập bằng Google (Google Identity Services).
 *    GOOGLE_CLIENT_ID phải khớp với hằng số GOOGLE_CLIENT_ID đã điền trong Apps Script đang
 *    deploy, và "Authorized JavaScript origins" của OAuth Client phải có domain GitHub Pages.
 *
 * Supabase để TRỐNG: chế độ Supabase CHƯA có đăng nhập/phân quyền; Supabase chạy SONG SONG làm
 * bản sao do gsheet/Code.gs ghi ở máy chủ (README mục 2c), không cần điền gì ở đây.
 */
(function () {
  var loc = typeof window !== "undefined" ? window.location : null;
  var host = loc ? String(loc.hostname || "") : "";
  var isFile = !!loc && loc.protocol === "file:";
  // localhost, 127.x, ::1, *.local và dải IP nội bộ (10.x, 172.16-31.x, 192.168.x) = máy chủ nội bộ
  var isPrivateHost =
    host === "" ||
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    /\.local$/i.test(host) ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  var onPremise = isFile || isPrivateHost;

  window.DGA_CONFIG = onPremise
    ? {
        DEPLOY_MODE: "on-premise",
        LOCAL_SERVER_URL: isFile ? "http://localhost:8080/api" : "/api",
        GSHEET_WEBAPP_URL: "",
        GSHEET_SHEET_URL: "",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        GOOGLE_CLIENT_ID: "", // để trống -> không tải accounts.google.com khi offline
      }
    : {
        DEPLOY_MODE: "online",
        LOCAL_SERVER_URL: "",
        GSHEET_WEBAPP_URL:
          "https://script.google.com/macros/s/AKfycbzZM6-fkFkWvfX1G4WHMhzT7p5VFB5ZsT3KBHaO-BLJWtKiNoW9qTDy4RonOSyx4hyp/exec",
        // Link Google Sheet để bấm badge "Database" mở nhanh Sheet
        GSHEET_SHEET_URL:
          "https://docs.google.com/spreadsheets/d/1Pm5Nq5wY-1sBDUl5DFNBtxfGqH_Ij_SsZIAJQJ0WaAU/edit",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        GOOGLE_CLIENT_ID: "162684736346-spsmoiqgk6sp3k5d8l24h85p1mcd5cja.apps.googleusercontent.com",
      };
})();
