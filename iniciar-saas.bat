@echo off
title Antigravity SaaS Starter
echo ===================================================
echo   Antigravity SaaS - Iniciando Entorno de Desarrollo
echo ===================================================
echo.

:: Check if Node is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor, instala Node.js desde https://nodejs.org/ e intenta de nuevo.
    echo.
    pause
    exit /b 1
)

echo [1/3] Entrando al directorio antigravity-saas...
cd "%~dp0antigravity-saas"

echo [2/3] Instalando dependencias de Node.js...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Hubo un error al instalar las dependencias.
    pause
    exit /b 1
)

echo [3/3] Iniciando el servidor de desarrollo en http://localhost:3000...
echo.
echo ===================================================
echo   El servidor se abrira en tu navegador predeterminado.
echo   Presiona CTRL+C en esta ventana para detenerlo.
echo ===================================================
echo.
start http://localhost:3000
call npm run dev
