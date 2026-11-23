# UNO Party — Android + laptop server

UNO Party adalah game kartu multiplayer untuk Android. Aplikasi Flutter terhubung ke server Node.js menggunakan Socket.IO. Satu room dapat menggunakan mode UNO Classic atau UNOLLELE.

## Fitur

### Sistem bersama
- Room privat dengan kode 6 karakter.
- Host memilih mode UNO Classic atau UNOLLELE saat membuat room.
- 2 sampai 8 pemain per room; host dapat mulai setelah minimal 2 pemain terhubung.
- Lobby menampilkan mode, kode room, pemain, status koneksi, dan host.
- Socket.IO realtime, reconnect dan rejoin room.
- Server menjadi sumber kebenaran untuk validasi kartu, giliran, efek, dan pemenang.
- Setiap HP hanya menerima isi kartu miliknya; isi kartu lawan tidak dikirim ke perangkat lain.
- Tombol UNO dan Tangkap UNO (+2).

### UNO Classic
- Deck klasik 108 kartu dan 7 kartu awal per pemain.
- Angka, Skip, Reverse, Draw Two, Wild, dan Wild Draw Four.
- Draw, pass turn, dan validasi mengikuti implementasi UNO Classic yang sudah ada.
- Draw Two / Wild Draw Four tidak dapat ditumpuk.

### UNOLLELE
- Deck 136 kartu: 120 kartu angka + 16 kartu Dragon.
- Enam elemen angka: Fire, Water, Grass, Electric, Ground, Colorless; angka 1–10, dua copy per kombinasi.
- Empat efek Dragon, masing-masing empat copy: Skip, Switch Direction, +2, Reset.
- Lima kartu awal untuk setiap pemain.
- Sistem weakness, angka lebih tinggi untuk tipe yang sama, dan Colorless bernomor lebih tinggi di atas elemen lain.
- Dragon hanya dapat dimainkan di atas Colorless; di atas Dragon, kartu angka dari semua enam elemen dapat dimainkan.
- Dragon Skip, Dragon Switch Direction, Dragon +2, dan Dragon Reset diproses oleh server.
- Jika tidak ada kartu valid, pemain mengambil satu kartu dan giliran langsung dilewati.
- UI kartu elemental/Dragon dan petunjuk aturan kartu aktif.

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

Tes saat build 1.1.0+3: 30 tes lulus (10 UNO Classic, 20 UNOLLELE). Pengujian mencakup transisi giliran dan state untuk beberapa pemain; pengujian Socket.IO live serta APK tetap perlu dijalankan pada lingkungan perangkat/build Flutter.

## Batasan yang masih ada

- Data room disimpan di memori server; restart server menghapus room dan pertandingan.
- Belum ada akun permanen, matchmaking publik, chat, statistik, leaderboard, bot, atau database persisten.
- Build dan pengujian UI Android perlu dijalankan melalui Flutter SDK/GitHub Actions; lingkungan penyusunan source ini tidak menyediakan Flutter SDK.
