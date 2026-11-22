@echo off
cd /d "%~dp0server"
if not exist node_modules (
  echo Mengunduh dependency server...
  npm install
  if errorlevel 1 pause & exit /b 1
)
echo.
echo Menjalankan server UNO Party...
echo Jangan tutup jendela ini selama permainan berlangsung.
echo.
npm start
pause
