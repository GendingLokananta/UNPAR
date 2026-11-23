# Status Implementasi UNO Party / UNOLLELE

## Build 1.2.0+4 — gameplay timing, rematch, audio dan meja melingkar

### Selesai di source
- UNOLLELE menggunakan 126 kartu: 100 kartu angka Fire/Water/Grass/Electric/Ground (masing-masing angka 1–10 dua copy), 10 Colorless (angka 1–10 satu copy), dan 16 Dragon.
- Setiap pemain UNOLLELE menerima 7 kartu awal.
- Dragon dapat dimainkan di atas setiap kartu angka, tetapi tidak dapat dimainkan di atas Dragon.
- Colorless dapat dimainkan di atas semua elemen angka dan di atas Dragon; saat top pile sudah Colorless, Colorless berikutnya harus bernomor lebih tinggi.
- Pemain UNOLLELE boleh mengambil satu kartu meskipun memiliki kartu valid; setelah mengambil, giliran langsung dilewati.
- Timer server 15 detik per giliran untuk kedua mode. Jika waktu habis, server memberi 2 kartu dan melewati giliran pemain.
- Countdown timer ditampilkan di meja dan dihitung oleh client berdasarkan deadline server.
- Voting rematch tersedia setelah pertandingan selesai. Mayoritas pemain yang online dapat memulai permainan baru dalam room dan kode yang sama; suara tidak dapat diberikan dua kali.
- UI permainan diganti dengan meja oval/melingkar. Posisi pemain mengikuti urutan giliran dan berubah sesuai arah (clockwise/counter-clockwise); pemain aktif disorot.
- Musik original disertakan sebagai asset lokal: lobby, gameplay normal, dan tension saat salah satu pemain memiliki 1–2 kartu. Ada tombol mute/unmute.
- UNO Classic tetap menggunakan deck/aturan sebelumnya, ditambah timer global dan opsi rematch.

### Verifikasi
- `npm test` — 40/40 tes backend lulus (UNO Classic, UNOLLELE, timer, timeout, dan voting rematch).
- `node --check server/src/game.js` — lulus.
- `node --check server/src/server.js` — lulus.
- `node --check server/src/room_lifecycle.js` — lulus.
- APK Android belum dapat dibuild di lingkungan ini karena Flutter SDK tidak tersedia. Workflow GitHub Actions `Build Android APK` dapat membangun APK dari source.
- Uji perangkat Android fisik dan sesi Socket.IO live dengan beberapa HP tetap perlu dilakukan setelah APK dibuat.

## Build sebelumnya
- Build 1.1.0+3: engine awal UNOLLELE dan pemilihan mode.
- Build 1.0.1+2: Tahap 1 integrasi mode di room.
