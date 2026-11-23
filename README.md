# UNO Party — Android + laptop server

UNO Party adalah game kartu multiplayer untuk Android. Aplikasi Flutter terhubung ke server Node.js menggunakan Socket.IO. Satu room dapat menggunakan mode UNO Classic atau UNOLLELE.

## Fitur

### Sistem bersama
- Room privat dengan kode 6 karakter.
- Host memilih mode UNO Classic atau UNOLLELE saat membuat room.
- 2 sampai 8 pemain per room; host dapat mulai setelah minimal 2 pemain terhubung.
- Lobby menampilkan mode, kode room, pemain, status koneksi, dan host.
- Socket.IO realtime, reconnect dan rejoin room.
- Server menjadi sumber kebenaran untuk validasi kartu, giliran, efek, timer, voting rematch, dan pemenang.
- Setiap HP hanya menerima isi kartu miliknya; isi kartu lawan tetap tersembunyi.
- Timer 15 detik per giliran untuk kedua mode; jika habis, pemain otomatis mengambil 2 kartu dan gilirannya dilewati.
- Setelah permainan selesai, pemain melakukan voting rematch. Jika suara setuju mencapai mayoritas pemain online, pertandingan baru dimulai di room dan kode yang sama.
- Musik latar lobby, musik pertandingan, dan musik lebih intens ketika ada pemain aktif dengan 1–2 kartu tersisa; musik dapat dimatikan dari tombol volume.

### UNO Classic
- Deck klasik 108 kartu dan 7 kartu awal per pemain.
- Angka, Skip, Reverse, Draw Two, Wild, dan Wild Draw Four.
- Draw, pass turn, dan validasi mengikuti implementasi UNO Classic yang sudah ada.
- Draw Two / Wild Draw Four tidak dapat ditumpuk.

### UNOLLELE
- Deck 126 kartu: 100 kartu Fire/Water/Grass/Electric/Ground (masing-masing angka 1–10, dua copy), 10 kartu Colorless (angka 1–10, satu copy), dan 16 kartu Dragon.
- Setiap pemain menerima 7 kartu awal.
- Lima elemen dasar mengikuti aturan weakness; Colorless merupakan kartu universal yang dapat melawan semua tipe angka. Pada Colorless yang menjadi top pile, kartu Colorless berikutnya harus memiliki angka lebih tinggi.
- Semua kartu angka memiliki weakness terhadap Dragon: Dragon dapat dimainkan di atas semua kartu angka. Dragon tidak dapat ditumpuk di atas Dragon.
- Di atas Dragon, semua kartu angka dari enam elemen dapat dimainkan.
- Empat efek Dragon, masing-masing empat copy: Skip, Switch Direction, +2, Reset.
- Pemain boleh memilih mengambil 1 kartu walaupun masih memiliki kartu yang bisa dimainkan; setelah draw, giliran langsung dilewati.
- Kartu elemental dan Dragon memiliki desain visual khusus.
- Meja bermain menempatkan pemain melingkar sesuai urutan dan arah permainan, dengan penanda giliran dan countdown.

## Menjalankan server di Windows

1. Install Node.js 22 atau lebih baru.
2. Ekstrak folder proyek.
3. Klik dua kali `start-server.bat` (dependency diinstal otomatis saat pertama dijalankan).
4. Pastikan terminal menunjukkan server berjalan pada port 3000.
5. Tes endpoint `http://localhost:3000/health`.

Jangan tutup terminal server selama pertandingan.

## Bermain melalui Wi-Fi lokal

1. Hubungkan laptop dan HP ke Wi-Fi yang sama.
2. Jalankan `ipconfig` di laptop dan cari IPv4 adapter Wi-Fi.
3. Izinkan Node.js di Windows Firewall untuk jaringan Private bila diminta.
4. Isi URL server di aplikasi, contoh `http://192.168.1.20:3000`.
5. Semua pemain memasukkan URL server yang sama.

## Bermain melalui internet

1. Jalankan server.
2. Jalankan `start-tunnel.bat` dengan `cloudflared` terpasang.
3. Masukkan URL HTTPS `trycloudflare.com` yang ditampilkan ke aplikasi.
4. Bagikan URL dan kode room kepada teman.

Quick Tunnel bersifat sementara untuk testing; alamat berubah saat tunnel dibuat ulang. Jangan bagikan URL server ke publik.

## Build APK melalui GitHub Actions

1. Push isi proyek ke repository GitHub.
2. Buka **Actions**.
3. Pilih **Build Android APK**, lalu **Run workflow**.
4. Unduh artifact `uno-party-android-apk` setelah workflow sukses.

APK release belum memakai signing key khusus; cocok untuk pengujian langsung, bukan publikasi Play Store.

## Tes backend

Di folder `server/` jalankan:

```bash
npm install
npm test
```

Tes backend pada build ini mencakup UNO Classic, deck/aturan UNOLLELE, timeout, dan voting rematch; jalankan `npm test` untuk hasil terkini. Pengujian mencakup transisi giliran dan state untuk beberapa pemain; pengujian Socket.IO live serta APK tetap perlu dijalankan pada lingkungan perangkat/build Flutter.

## Batasan yang masih ada

- Data room disimpan di memori server; restart server menghapus room dan pertandingan.
- Belum ada akun permanen, matchmaking publik, chat, statistik, leaderboard, bot, atau database persisten.
- Build dan pengujian UI Android perlu dijalankan melalui Flutter SDK/GitHub Actions; lingkungan penyusunan source ini tidak menyediakan Flutter SDK.
