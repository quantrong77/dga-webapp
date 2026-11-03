@echo off
setlocal
cd /d "%~dp0"

title DGA-Webapp On-Premise Local Server - PTC3

echo ===================================================================
echo    UNG DUNG DANH GIA DGA VA THI NGHIEM DAU CACH DIEN - PTC3
echo    MAY CHU CO SO DU LIEU NOI BO [ON-PREMISE LOCALHOST]
echo ===================================================================
echo.
echo [1/3] Kiem tra moi truong Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js de chay ung dung offline.
    pause
    exit /b 1
)

echo [2/3] Chuan bi mo trinh duyet toi http://localhost:8080...
start "" cmd /c "timeout /t 2 /nobreak > nul && start http://localhost:8080"

echo [3/3] Dang khoi dong May chu CSDL noi bo tai cong 8080...
echo       * Thu muc du an:    %~dp0
echo       * Dia chi Web:      http://localhost:8080
echo       * API CSDL noi bo:  http://localhost:8080/api
echo       * Thu muc CSDL:     ./data/ [database.json va uploads]
echo       * Tai khoan Admin:  admin@ptc3.evnnpt.vn / admin123456
echo.
echo ===================================================================
echo [LUU Y QUAN TRONG]
echo 1. GIU NGUYEN CUA SO DEN NAY trong suot thoi gian su dung ung dung!
echo    (Neu dong cua so nay, May chu CSDL se bi ngat ket noi)
echo 2. Neu trinh duyet bao "Failed to fetch" hoac giao dien cu:
echo    Nhan to hop phim Ctrl + F5 (hoac Ctrl + Shift + R) de tai lai moi nhat.
echo 3. De dung may chu khi lam viec xong: Dong cua so nay hoac an Ctrl+C.
echo ===================================================================
echo.

node scripts/serve.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LOI] May chu dung dot ngot voi ma loi %ERRORLEVEL%.
)
pause
