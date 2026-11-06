@echo off
chcp 65001 > nul
title Auditor de Wishlist vs Biblioteca Digital
echo ========================================================
echo   Iniciando Auditor de Wishlist vs Biblioteca Digital...
echo ========================================================
echo.

python "%~dp0scripts\vinyl_scanner.py" %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [Aviso] Hubo un error al ejecutar el script.
)

echo.
echo Presiona cualquier tecla para salir...
pause > nul

