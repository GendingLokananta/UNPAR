# Status Implementasi UNO Party / UNOLLELE

## Build 1.4.0+6 — objektif spectator, Colorless 10, dan Dragon baru

### Selesai di source
- UNOLLELE menggunakan 146 kartu: 100 kartu angka elemental (Fire/Water/Grass/Electric/Ground, angka 1–10 dua copy), 10 Colorless 10, dan 36 Dragon.
- Colorless 10 hanya dapat menimpa kartu elemental bila nilainya lebih tinggi, tetapi dapat menimpa semua Dragon. Sebaliknya, semua kartu elemental dapat menimpa Colorless tanpa syarat angka; Dragon tidak dapat dimainkan di atas Colorless.
- Dragon Skip menjadi Dragon Skip All; Dragon Reset menjadi Dragon Reroll; Dragon Switch menjadi 3 copy; Dragon +1 All hanya memberi satu kartu kepada pemain aktif selain penggunanya.
- Efek Dragon Discard, Reset All, Revive, dan Block ditambahkan dengan jumlah copy 4, 1, 4, dan 4. Reset All hanya mengenai pemain aktif, termasuk penggunanya, dan mengecualikan pemain yang sudah menjadi spectator.
- Pemain yang menghabiskan kartu dinyatakan menang dan menjadi spectator. Permainan berlanjut sampai satu pemain aktif tersisa sebagai pemain kalah. Berlaku untuk UNO Classic dan UNOLLELE.
- Dragon Block mengikuti urutan giliran aktual dan berakhir saat giliran kembali ke pemain yang memainkan kartu, termasuk ketika arah putaran berubah.
- UI menampilkan panah melingkar clockwise/counter-clockwise, pilihan target/elemen/kartu untuk efek Dragon, status spectator, serta popup kalah dan tombol Main Ulang terpusat.
- Notifikasi berhasil join room dibersihkan otomatis saat server mengirim status permainan `playing`.
- Dragon Switch hanya dapat menargetkan pemain lain yang aktif dan online.
- UNO Classic tetap menggunakan deck 108 kartu dan aturan kartu yang sudah ada.
- Timer server 15 detik per giliran untuk kedua mode. Jika waktu habis, server memberi 2 kartu dan melewati giliran pemain.
- Tombol Main Ulang membuat game baru langsung di room dan kode yang sama; minimal 2 pemain harus online.
- Musik original disertakan sebagai asset lokal: lobby, gameplay normal, dan tension saat salah satu pemain memiliki 1–2 kartu. Ada tombol mute/unmute.

### Verifikasi
- `npm test` — 58/58 tes backend lulus: UNO Classic, UNOLLELE, Colorless 10, efek Dragon lama/baru, spectator/eliminasi, timeout, dan main ulang.
- `node --check server/src/game.js` — lulus.
- `node --check server/src/server.js` — lulus.
- `node --check server/src/room_lifecycle.js` — lulus.
- APK Android belum dapat dibuild di lingkungan ini karena Flutter SDK tidak tersedia. Workflow GitHub Actions `Build Android APK` dapat membangun APK dari source.
- Uji perangkat Android fisik dan sesi Socket.IO live dengan beberapa HP tetap perlu dilakukan setelah APK dibuat.

## Build sebelumnya
- Build 1.3.0+5: efek Dragon tambahan dan perbaikan main ulang.
- Build 1.2.0+4: gameplay timing, voting rematch, audio, dan meja melingkar.
- Build 1.1.0+3: engine awal UNOLLELE dan pemilihan mode.
- Build 1.0.1+2: Tahap 1 integrasi mode di room.
