@echo off
chcp 65001 > nul
title DGA-Webapp On-Premise Local Server (PTC3)

echo ===================================================================
echo    ỨNG DỤNG ĐÁNH GIÁ DGA VÀ THÍ NGHIỆM DẦU CÁCH ĐIỆN - PTC3
echo    MÁY CHỦ CƠ SỞ DỮ LIỆU NỘI BỘ (ON-PREMISE LOCALHOST)
echo ===================================================================
echo.
echo [1/2] Đang khởi động Máy chủ CSDL nội bộ tại cổng 8080...
echo       - Địa chỉ Web:      http://localhost:8080
echo       - API CSDL nội bộ:  http://localhost:8080/api
echo       - Thư mục dữ liệu:  ./data/ (database.json & uploads/)
echo       - Tài khoản Admin:  admin@ptc3.evnnpt.vn / admin123456
echo.
echo [2/2] Đang mở trình duyệt web...
start "" "http://localhost:8080"

echo.
echo Máy chủ đang hoạt động. (HOÀN TOÀN KHÔNG CẦN KẾT NỐI INTERNET)
echo Để dừng máy chủ, vui lòng đóng cửa sổ này hoặc nhấn phím Ctrl + C.
echo ===================================================================
echo.

node scripts/serve.js
pause
