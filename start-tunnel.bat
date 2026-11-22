@echo off
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared belum terpasang.
  echo Install melalui PowerShell: winget install --id Cloudflare.cloudflared
  echo Setelah terpasang, buka kembali file ini.
  pause
  exit /b 1
)
echo Membuka tunnel publik ke server laptop pada port 3000...
echo Salin alamat HTTPS trycloudflare.com yang muncul, lalu masukkan di aplikasi.
echo Jendela ini harus tetap terbuka selama teman bermain dari internet.
cloudflared tunnel --url http://localhost:3000
pause
