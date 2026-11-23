# Status Implementasi UNO Party / UNOLLELE

## Build 1.1.0+3 — Engine UNOLLELE v1

### Selesai
- Host dapat memilih UNO Classic atau UNOLLELE saat membuat room.
- Server menyimpan dan menyinkronkan mode ke semua pemain, termasuk saat rejoin.
- Server memilih engine berdasarkan `room.gameMode` saat host memulai permainan.
- UNO Classic tetap menggunakan deck 108 kartu, 7 kartu awal, dan aturan sebelumnya.
- Deck UNOLLELE terdiri dari 136 kartu: 120 kartu angka dan 16 kartu Dragon.
- Setiap kombinasi dari 6 elemen x angka 1-10 memiliki 2 copy.
- Masing-masing dari 4 efek Dragon memiliki 4 copy.
- Setiap pemain UNOLLELE menerima 5 kartu; kartu awal di discard pile selalu kartu angka.
- Validasi angka, weakness, Colorless (angka harus lebih tinggi saat ditempatkan di atas elemen lain), Dragon, dan top pile Dragon ditangani server.
- Dragon Skip, Dragon Switch Direction, Dragon +2, dan Dragon Reset telah diimplementasikan.
- Dragon +2 sebagai kartu terakhir tetap memenangkan pemain, sekaligus menerapkan penalti 2 kartu.
- Dragon Reset tidak dapat memenangkan permainan; kartu tangan dikocok kembali ke draw pile dan pemain menerima 4 kartu baru.
- UNOLLELE draw hanya diizinkan ketika tidak ada kartu valid; setelah mengambil 1 kartu giliran langsung berpindah.
- UNO / Tangkap UNO tetap memakai alur server yang sudah tersedia.
- Public state hanya mengirim isi kartu milik pemain penerima; kartu pemain lain tetap tersembunyi.
- Lobby kini mengizinkan host memulai kedua mode.
- UI menampilkan kartu elemental dan Dragon dengan visual berbeda, warna, ikon, angka, nama efek, serta petunjuk rule untuk kartu teratas.
- Tombol draw pada UNOLLELE mengikuti `canDraw` dari server; tombol pass klasik disembunyikan pada mode ini.

### Verifikasi
- `node --check server/src/game.js` — lulus.
- `node --check server/src/server.js` — lulus.
- `npm test` — 30 tes lulus, termasuk 20 tes khusus UNOLLELE dan 10 tes UNO Classic.
- Tes khusus mencakup jumlah kartu/copy, distribusi 5 kartu, seluruh weakness, validasi Dragon, empat efek Dragon, draw otomatis, kondisi kemenangan, privasi kartu, dan simulasi sinkronisasi giliran/state untuk beberapa pemain.
- Uji klik/perangkat Android dan build APK belum dapat dijalankan di lingkungan ini karena Flutter SDK tidak tersedia. Uji Socket.IO melalui koneksi HP/server secara live juga belum dijalankan; tes multiplayer yang tersedia menguji transisi giliran dan public state server untuk beberapa pemain. Source Flutter telah diperbarui; gunakan workflow **Build Android APK** di GitHub Actions untuk compile APK.

### Catatan aturan implementasi
- Jumlah copy kartu angka: 2 untuk setiap kombinasi elemen/angka, sesuai komposisi GDD.
- Dragon hanya dapat dimainkan di atas Colorless.
- Di atas Dragon, semua kartu angka (enam elemen) valid; kartu Dragon lain tidak valid. Colorless dapat dimainkan di atas elemen lain jika angkanya lebih tinggi.
- Switch Direction pada duel dua pemain memberi giliran kembali ke pemain yang memainkannya.
- Bila draw/discard yang tersedia tidak cukup untuk memenuhi jumlah kartu yang diminta, server mengambil kartu yang tersedia saja; server tidak mengambil kartu dari tangan pemain lain.

## Build 1.0.1+2 — Tahap 1: pemilihan game mode
Tahap ini sudah menjadi dasar dan dipertahankan dalam build 1.1.0+3.
