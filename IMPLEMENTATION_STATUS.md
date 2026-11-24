# Status Implementasi UNO Party / UNOLLELE

## Build 1.3.0+5 — efek Dragon tambahan dan perbaikan main ulang

### Selesai di source
- UNOLLELE menggunakan 132 kartu: 100 kartu angka Fire/Water/Grass/Electric/Ground (masing-masing angka 1–10 dua copy), 10 Colorless (angka 1–10 satu copy), dan 22 Dragon.
- Setiap pemain UNOLLELE menerima 7 kartu awal.
- Dragon dapat dimainkan di atas semua tipe kecuali Colorless, termasuk di atas Dragon lain.
- Colorless dapat dimainkan di atas semua tipe, termasuk Dragon. Jika top pile sudah Colorless, kartu Colorless berikutnya harus bernomor lebih tinggi.
- Dragon Switch (2 copy) menukar seluruh sisa kartu tangan pengguna dengan seluruh kartu tangan pemain online yang dipilih.
- Dragon +1 All (4 copy) membuat semua pemain, termasuk pengguna kartu, mengambil satu kartu.
- Empat efek Dragon sebelumnya tetap tersedia: Skip, Switch Direction, +2, dan Reset (masing-masing 4 copy).
- Pemain UNOLLELE boleh mengambil satu kartu meskipun memiliki kartu valid; setelah draw, giliran langsung dilewati.
- Timer server 15 detik per giliran untuk kedua mode. Jika waktu habis, server memberi 2 kartu dan melewati giliran pemain.
- Countdown timer ditampilkan di meja dan dihitung oleh client berdasarkan deadline server.
- Tombol Main Ulang memulai game baru langsung di room dan kode yang sama tanpa voting atau memasukkan kode lagi; minimal 2 pemain harus online.
- UI Dragon Switch meminta pengguna memilih pemain online sebelum menukar kartu tangan.
- UI permainan menggunakan meja oval/melingkar. Posisi pemain mengikuti urutan giliran dan berubah sesuai arah (clockwise/counter-clockwise); pemain aktif disorot.
- Musik original disertakan sebagai asset lokal: lobby, gameplay normal, dan tension saat salah satu pemain memiliki 1–2 kartu. Ada tombol mute/unmute.
- UNO Classic tetap menggunakan deck/aturan sebelumnya, ditambah timer global dan opsi main ulang.
### Verifikasi
- `npm test` — 47/47 tes backend lulus (UNO Classic, UNOLLELE, efek Dragon baru, timer, timeout, rematch lama, dan main ulang langsung).
- `node --check server/src/game.js` — lulus.
- `node --check server/src/server.js` — lulus.
- `node --check server/src/room_lifecycle.js` — lulus.
- APK Android belum dapat dibuild di lingkungan ini karena Flutter SDK tidak tersedia. Workflow GitHub Actions `Build Android APK` dapat membangun APK dari source.
- Uji perangkat Android fisik dan sesi Socket.IO live dengan beberapa HP tetap perlu dilakukan setelah APK dibuat.

## Build sebelumnya
- Build 1.2.0+4: gameplay timing, voting rematch, audio, dan meja melingkar.
- Build 1.1.0+3: engine awal UNOLLELE dan pemilihan mode.
- Build 1.0.1+2: Tahap 1 integrasi mode di room.
