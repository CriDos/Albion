@echo off
echo Запуск сервера для приложения Albion Market Analyzer...
echo.

REM Пробуем запустить через Python
echo 1. Попытка запуска через Python...
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo Python найден! Запускаем сервер...
    start "" http://localhost:8000
    python -m http.server 8000
    goto :eof
)

REM Если Python не найден, пробуем Python3
echo Python не найден. Пробуем Python3...
where python3 >nul 2>&1
if %errorlevel% equ 0 (
    echo Python3 найден! Запускаем сервер...
    start "" http://localhost:8000
    python3 -m http.server 8000
    goto :eof
)

REM Если Python не найден, пробуем Node.js http-server
echo Python3 не найден. Пробуем Node.js http-server...
where npx >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js найден! Запускаем сервер через npx...
    start "" http://localhost:8080
    npx http-server -p 8080
    goto :eof
)

REM Если ничего не нашлось
echo.
echo Не удалось найти подходящий веб-сервер.
echo Пожалуйста, установите один из следующих:
echo 1. Python: https://www.python.org/downloads/
echo 2. Node.js: https://nodejs.org/
echo.
echo После установки запустите этот скрипт повторно.
pause
