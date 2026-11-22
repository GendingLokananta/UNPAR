# UNO Party — Android + laptop server

UNO Party adalah game kartu gaya UNO untuk Android. Aplikasi Flutter terhubung ke server Node.js yang dijalankan di laptop menggunakan Socket.IO.

## Yang sudah ada di versi awal

- Room privat dengan kode 6 karakter.
- 2 sampai 8 pemain per room.
- Host bisa mulai saat minimal 2 pemain terhubung; tidak perlu menunggu 8 slot terisi.
- Kartu klasik 108 kartu dan 7 kartu awal per pemain.
- Angka, Skip, Reverse, Draw Two, Wild, dan Wild Draw Four.
- Giliran dan validasi kartu ditangani server.
- Setiap HP hanya menerima isi tangan kartunya sendiri; kartu lawan tidak dikirim ke perangkat lain.
- Tombol UNO dan Tangkap UNO (+2).
- Reconnect otomatis saat koneksi terputus di tengah pertandingan, selama server laptop tetap hidup.
- APK dapat dibangun melalui GitHub Actions.

Versi ini memakai aturan dasar klasik: kartu Draw Two / Wild Draw Four tidak bisa ditumpuk. Belum ada akun permanen, random matchmaking, chat, statistik, atau sistem ranking.

## A. Jalankan server di Windows

1. Install Node.js LTS dari <https://nodejs.org/>. Node.js 22 atau yang lebih baru didukung.
2. Ekstrak folder proyek ini di laptop.
3. Klik dua kali `start-server.bat`.
4. Saat pertama dijalankan, script akan mengunduh dependency melalui `npm install`.
5. Pastikan terminal menampilkan `UNO Party server berjalan di http://0.0.0.0:3000`.
6. Tes di browser laptop: buka `http://localhost:3000/health`. Hasil yang benar adalah JSON dengan `"ok": true`.

Jangan tutup terminal server selama pertandingan berlangsung.

## B. Main dari HP dalam Wi-Fi yang sama

1. Pastikan laptop dan semua HP memakai jaringan Wi-Fi yang sama.
2. Di laptop, buka Command Prompt dan ketik `ipconfig`.
3. Cari `IPv4 Address` pada adapter Wi-Fi, misalnya `192.168.1.20`.
4. Jika Windows Firewall bertanya, izinkan Node.js untuk jaringan Private.
5. Di aplikasi, isi **Alamat server laptop** dengan alamat seperti `http://192.168.1.20:3000`.
6. Semua teman memasukkan alamat server yang sama.

Alamat IP di atas hanya contoh. Gunakan alamat IPv4 yang muncul di laptopmu.

## C. Main dari jaringan internet yang berbeda

Untuk tes awal, proyek ini menyertakan `start-tunnel.bat` yang menggunakan Cloudflare Quick Tunnel.

1. Biarkan server Node.js tetap berjalan.
2. Install `cloudflared` di Windows. Panduan resmi: <https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/>
3. Klik dua kali `start-tunnel.bat`.
4. Salin alamat HTTPS `https://....trycloudflare.com` yang muncul di terminal.
5. Masukkan alamat HTTPS tersebut ke kolom **Alamat server laptop** di aplikasi. Jangan tambahkan `:3000` pada alamat tunnel.
6. Bagikan alamat server dan kode room kepada teman.
7. Biarkan kedua jendela terminal (server dan tunnel) tetap terbuka.

Quick Tunnel memberikan alamat sementara yang berubah saat tunnel dibuat ulang. Tunnel berhenti bekerja saat proses `cloudflared` ditutup. Cloudflare menyebut Quick Tunnel sebagai fitur untuk testing/development, tanpa jaminan uptime; gunakan tunnel permanen atau server hosting untuk penggunaan jangka panjang. Detail: <https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/>.

Siapa pun yang mengetahui URL Quick Tunnel dapat mencoba mengakses server. Bagikan hanya kepada teman yang kamu percaya.

## D. Build APK dengan GitHub Actions

1. Buat repository GitHub baru.
2. Upload seluruh isi folder proyek ini ke repository (jangan upload `node_modules`).
3. Buka tab **Actions**.
4. Pilih workflow **Build Android APK** lalu tekan **Run workflow**. Workflow juga berjalan saat ada perubahan pada folder `mobile/` yang di-push ke branch `main` atau `master`.
5. Setelah selesai, buka hasil run dan unduh artifact `uno-party-android-apk`.
6. Di dalam artifact ada `app-release.apk`.

Workflow membuat kerangka Android dengan Flutter, mengambil dependency, lalu membangun APK release. Belum ada signing key khusus, jadi APK ini cocok untuk instalasi dan pengujian langsung. Untuk distribusi Play Store, siapkan signing key sendiri.

## E. Tes server

Di folder `server/`, jalankan:

```bash
npm install
npm test
```

Tes backend saat proyek ini disusun: 6 tes lulus.

## Catatan penting

- Laptop bertindak sebagai server. Laptop harus menyala, tidak sleep, terhubung internet, dan proses Node.js tetap berjalan agar teman dari luar jaringan bisa bermain.
- Data room disimpan di memori server. Mematikan atau restart server akan menghapus semua room dan pertandingan yang sedang berjalan.
- Jika laptop tidur, mati, atau koneksi internet putus, permainan online ikut terhenti.
- Versi ini belum memakai database persisten atau autentikasi akun. Gunakan kode room privat dan jangan bagikan URL server ke publik.
- Aplikasi Android harus memakai URL yang dapat dijangkau HP: `http://IP-LAPTOP:3000` untuk Wi-Fi lokal, atau URL HTTPS tunnel untuk internet.
