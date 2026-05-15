@echo off
title Vinyl Stock Manager | Cloud
echo ==========================================
echo   INICIANDO VINYL STOCK MANAGER...
echo   (Version Cloud 💿)
echo ==========================================
echo.
echo [1/2] Iniciando servidor (Puerto 3005)...
start /b node server.js
echo.
echo [2/2] Abriendo aplicacion en el navegador...
timeout /t 2 >nul
start http://localhost:3005
echo.
echo ==========================================
echo   LISTO! No cierres esta ventana.
echo   La data se carga desde Firebase.
echo ==========================================
echo.
pause

