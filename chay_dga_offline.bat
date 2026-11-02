@echo off
setlocal
cd /d "%~dp0"

title DGA-Webapp On-Premise Local Server - PTC3

echo ===================================================================
echo    UNG DUNG DANH GIA DGA VA THI NGHIEM DAU CACH DIEN - PTC3
echo    MAY CHU CO SO DU LIEU NOI BO [ON-PREMISE LOCALHOST]
echo ===================================================================
echo.
echo [1/2] Dang khoi dong May chu CSDL noi bo tai cong 8080...
echo       * Thu muc du an:    %~dp0
echo       * Dia chi Web:      http://localhost:8080
echo       * API CSDL noi bo:  http://localhost:8080/api
echo       * Thu muc CSDL:     ./data/ [database.json va uploads]
echo       * Tai khoan Admin:  admin@ptc3.evnnpt.vn / admin123456
echo.
echo [2/2] Dang mo trinh duyet web...
start "" "http://localhost:8080"

echo.
echo May chu dang hoat dong [HOAN TOAN KHONG CAN MANG INTERNET].
echo De dung may chu, dong cua so nay hoac nhan Ctrl+C.
echo ===================================================================
echo.

node scripts/serve.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] Khong the khoi dong node scripts/serve.js
    echo Vui long kiem tra Node.js tren may tinh.
)
pause
