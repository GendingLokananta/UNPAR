import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'game_controller.dart';
import 'music_manager.dart';

const Color pageColor = Color(0xFF10131D);
const Color panelColor = Color(0xFF1C2230);
const Color accentColor = Color(0xFFFFD447);
const Color redCard = Color(0xFFE44747);
const Color yellowCard = Color(0xFFFFC928);
const Color greenCard = Color(0xFF22A66A);
const Color blueCard = Color(0xFF3679E8);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final controller = GameController();
  await controller.initialize();
  final music = MusicManager(controller);
  await music.initialize();
  runApp(UnoPartyApp(controller: controller, music: music));
}

class UnoPartyApp extends StatelessWidget {
  const UnoPartyApp({super.key, required this.controller, required this.music});
  final GameController controller;
  final MusicManager music;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'UNO Party',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: pageColor,
        colorScheme: ColorScheme.fromSeed(seedColor: accentColor, brightness: Brightness.dark),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(backgroundColor: pageColor, foregroundColor: Colors.white),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF252C3B),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFF343D50))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: accentColor, width: 1.5)),
          labelStyle: const TextStyle(color: Colors.white70),
        ),
      ),
      home: AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          final current = controller.state;
          if (current == null) return HomeScreen(controller: controller, music: music);
          final room = GameController.mapData(current['room']);
          if (room['status'] == 'lobby') return LobbyScreen(controller: controller, music: music);
          return GameScreen(controller: controller, music: music);
        },
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller, required this.music});
  final GameController controller;
  final MusicManager music;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final TextEditingController _name;
  late final TextEditingController _server;
  final TextEditingController _code = TextEditingController();

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.controller.nickname);
    _server = TextEditingController(text: widget.controller.serverUrl);
  }

  @override
  void dispose() {
    _name.dispose();
    _server.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<bool> _prepare() async {
    await widget.controller.saveSettings(name: _name.text, url: _server.text);
    if (widget.controller.nickname.isEmpty) {
      widget.controller.setNotice('Masukkan nickname terlebih dahulu.', error: true);
      return false;
    }
    return true;
  }

  Future<void> _create() async {
    final gameMode = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: panelColor,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('PILIH MODE PERMAINAN', textAlign: TextAlign.center, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, letterSpacing: 1.1)),
              const SizedBox(height: 7),
              const Text('Tentukan mode yang akan digunakan di room ini.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 12)),
              const SizedBox(height: 18),
              _gameModeOption(
                sheetContext,
                mode: 'classic',
                title: 'UNO',
                subtitle: 'Aturan dan kartu UNO klasik',
                icon: Icons.style_rounded,
                color: accentColor,
              ),
              const SizedBox(height: 10),
              _gameModeOption(
                sheetContext,
                mode: 'unollele',
                title: 'UNOLLELE',
                subtitle: 'Kartu elemental, weakness, dan Dragon',
                icon: Icons.auto_awesome_rounded,
                color: const Color(0xFFB58BFF),
              ),
            ],
          ),
        ),
      ),
    );
    if (!mounted || gameMode == null) return;
    if (await _prepare()) await widget.controller.createRoom(gameMode: gameMode);
  }

  Widget _gameModeOption(
    BuildContext sheetContext, {
    required String mode,
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Material(
      color: const Color(0xFF252C3B),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => Navigator.pop(sheetContext, mode),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Container(width: 48, height: 48, decoration: BoxDecoration(color: color.withOpacity(.16), borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: color, size: 27)),
            const SizedBox(width: 13),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: .7)),
              const SizedBox(height: 3),
              Text(subtitle, style: const TextStyle(color: Colors.white60, fontSize: 12)),
            ])),
            const Icon(Icons.chevron_right_rounded, color: Colors.white54, size: 25),
          ]),
        ),
      ),
    );
  }

  Future<void> _join() async {
    if (!await _prepare()) return;
    if (_code.text.trim().isEmpty) {
      widget.controller.setNotice('Masukkan kode room temanmu.', error: true);
      return;
    }
    await widget.controller.joinRoom(_code.text);
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 28, 22, 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(alignment: Alignment.centerRight, child: MusicToggleButton(music: widget.music)),
                  const SizedBox(height: 2),
                  Center(
                    child: Container(
                      width: 112,
                      height: 112,
                      decoration: BoxDecoration(
                        color: accentColor,
                        borderRadius: BorderRadius.circular(34),
                        boxShadow: [BoxShadow(color: accentColor.withOpacity(.22), blurRadius: 35, spreadRadius: 2)],
                      ),
                      child: const Icon(Icons.style_rounded, size: 62, color: Color(0xFF25202B)),
                    ),
                  ),
                  const SizedBox(height: 22),
                  const Text('UNO GACOR', textAlign: TextAlign.center, style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 2.2)),
                  const SizedBox(height: 8),
                  const Text('Main kartu bareng teman, kapan saja.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 15)),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _name,
                    maxLength: 18,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Nickname', prefixIcon: Icon(Icons.person_outline), counterText: ''),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _server,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(labelText: 'Alamat server laptop', prefixIcon: Icon(Icons.dns_outlined), hintText: 'https://alamat-tunnel-kamu'),
                  ),
                  const SizedBox(height: 8),
                  const Text('Semua pemain harus memakai alamat server yang sama. Jalankan server di laptop terlebih dahulu.', style: TextStyle(color: Colors.white54, fontSize: 12, height: 1.4)),
                  const SizedBox(height: 22),
                  FilledButton.icon(
                    onPressed: controller.busy ? null : _create,
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('BUAT ROOM'),
                    style: FilledButton.styleFrom(backgroundColor: accentColor, foregroundColor: const Color(0xFF211D29), minimumSize: const Size.fromHeight(54), textStyle: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: .7)),
                  ),
                  const SizedBox(height: 20),
                  Row(children: const [Expanded(child: Divider(color: Colors.white24)), Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('ATAU', style: TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.bold))), Expanded(child: Divider(color: Colors.white24))]),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _code,
                    maxLength: 6,
                    textCapitalization: TextCapitalization.characters,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 6),
                    decoration: const InputDecoration(labelText: 'Kode room teman', counterText: '', hintText: 'ABC123'),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: controller.busy ? null : _join,
                    icon: const Icon(Icons.login_rounded),
                    label: const Text('GABUNG ROOM'),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white30), minimumSize: const Size.fromHeight(52), textStyle: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  if (controller.busy) ...[
                    const SizedBox(height: 18),
                    const Center(child: CircularProgressIndicator(color: accentColor)),
                  ],
                  if (controller.notice.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    NoticeBanner(text: controller.notice, isError: controller.noticeIsError),
                  ],
                  const SizedBox(height: 28),
                  const Text('2–8 pemain  •  Host bebas mulai tanpa menunggu 8 slot penuh', textAlign: TextAlign.center, style: TextStyle(color: Colors.white38, fontSize: 12)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class LobbyScreen extends StatelessWidget {
  const LobbyScreen({super.key, required this.controller, required this.music});
  final GameController controller;
  final MusicManager music;


  @override
  Widget build(BuildContext context) {
    final room = controller.room;
    final players = (room['players'] as List? ?? []).map((item) => GameController.mapData(item)).toList();
    final isHost = room['hostId'] == controller.myId;
    final canStart = isHost && players.where((p) => p['connected'] == true).length >= 2;
    final gameMode = (room['gameMode'] ?? 'classic').toString();
    final isUnollele = gameMode == 'unollele';
    return Scaffold(
      appBar: AppBar(
        title: const Text('ROOM LOBBY', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2)),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: controller.leaveRoom),
        actions: [MusicToggleButton(music: music), IconButton(tooltip: 'Keluar room', onPressed: controller.leaveRoom, icon: const Icon(Icons.exit_to_app_rounded))],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: isUnollele ? const Color(0xFF33264A) : const Color(0xFF3A3420),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: isUnollele ? const Color(0xFF8F6BC4) : accentColor.withOpacity(.45)),
                  ),
                  child: Row(children: [
                    Icon(isUnollele ? Icons.auto_awesome_rounded : Icons.style_rounded, color: isUnollele ? const Color(0xFFB58BFF) : accentColor),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(isUnollele ? 'MODE UNOLLELE' : 'MODE UNO', style: TextStyle(color: isUnollele ? const Color(0xFFD6C1FF) : accentColor, fontWeight: FontWeight.w900, letterSpacing: .8)),
                      Text(isUnollele ? 'Elemental • Weakness • Dragon' : 'Aturan UNO klasik', style: const TextStyle(color: Colors.white60, fontSize: 11)),
                    ])),
                  ]),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(color: panelColor, borderRadius: BorderRadius.circular(22), border: Border.all(color: Colors.white10)),
                  child: Column(children: [
                    const Text('KODE ROOM', style: TextStyle(color: Colors.white54, fontWeight: FontWeight.bold, letterSpacing: 2)),
                    const SizedBox(height: 8),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(room['code']?.toString() ?? '------', style: const TextStyle(fontSize: 34, letterSpacing: 7, fontWeight: FontWeight.w900, color: accentColor)),
                      IconButton(onPressed: () {
                        Clipboard.setData(ClipboardData(text: room['code']?.toString() ?? ''));
                        controller.setNotice('Kode room disalin. Kirim ke temanmu.');
                      }, icon: const Icon(Icons.copy_rounded, color: Colors.white70)),
                    ]),
                    const Text('Bagikan kode ini ke teman yang mau bermain.', style: TextStyle(color: Colors.white54, fontSize: 12)),
                  ]),
                ),
                const SizedBox(height: 24),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('PEMAIN', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2)),
                  Text('${players.length}/8', style: const TextStyle(color: accentColor, fontWeight: FontWeight.w900)),
                ]),
                const SizedBox(height: 12),
                ...players.map((player) => Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                    decoration: BoxDecoration(color: panelColor, borderRadius: BorderRadius.circular(15)),
                    child: Row(children: [
                      CircleAvatar(backgroundColor: _avatarColor(player['name']?.toString() ?? ''), child: Text((player['name']?.toString() ?? '?').characters.first.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.black))),
                      const SizedBox(width: 12),
                      Expanded(child: Text(player['name']?.toString() ?? 'Player', style: const TextStyle(fontWeight: FontWeight.w700))),
                      if (player['id'] == room['hostId']) const Padding(padding: EdgeInsets.only(right: 8), child: Text('HOST', style: TextStyle(color: accentColor, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1))),
                      Icon(player['connected'] == true ? Icons.circle : Icons.circle_outlined, size: 10, color: player['connected'] == true ? greenCard : Colors.white30),
                      const SizedBox(width: 6),
                      Text(player['connected'] == true ? 'Online' : 'Offline', style: const TextStyle(color: Colors.white54, fontSize: 11)),
                    ]),
                  ),
                )),
                const SizedBox(height: 8),
                Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFF252B37), borderRadius: BorderRadius.circular(14)), child: const Text('Permainan bisa dimulai saat minimal 2 pemain sudah masuk. Tidak perlu menunggu sampai 8 pemain.', style: TextStyle(color: Colors.white70, height: 1.4, fontSize: 13))),
                const SizedBox(height: 20),
                if (isUnollele)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: const Color(0xFF33264A), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF8F6BC4).withOpacity(.5))),
                    child: const Text('UNOLLELE: elemental & weakness, 10 kartu Colorless 10, 10 efek Dragon, serta sistem spectator hingga pemain terakhir kalah.', style: TextStyle(color: Color(0xFFE2D5FF), height: 1.45, fontSize: 12)),
                  ),
                if (isHost)
                  FilledButton.icon(
                    onPressed: canStart ? controller.startGame : null,
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: const Text('MULAI PERMAINAN'),
                    style: FilledButton.styleFrom(backgroundColor: isUnollele ? const Color(0xFFB58BFF) : accentColor, foregroundColor: const Color(0xFF211D29), minimumSize: const Size.fromHeight(54), textStyle: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: .8)),
                  )
                else
                  const Padding(padding: EdgeInsets.all(12), child: Text('Menunggu host memulai permainan…', textAlign: TextAlign.center, style: TextStyle(color: Colors.white54))),
                if (controller.notice.isNotEmpty) ...[const SizedBox(height: 12), NoticeBanner(text: controller.notice, isError: controller.noticeIsError)],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class GameScreen extends StatelessWidget {
  const GameScreen({super.key, required this.controller, required this.music});
  final GameController controller;
  final MusicManager music;

  Future<void> _showCardDescriptions(BuildContext context, bool isUnollele) async {
    final entries = isUnollele
        ? <(String, String)>[
            ('Kartu Elemental', 'Mainkan kartu dengan angka lebih tinggi pada elemen yang sama, atau manfaatkan hubungan weakness antar elemen.'),
            ('Colorless 10', 'Dapat melawan Dragon atau kartu elemental dengan angka di bawah 10. Colorless dapat dikalahkan oleh kartu elemental angka berapa pun.'),
            ('Dragon Skip All', 'Melewati pemain lain dan mempertahankan giliran sesuai aturan Dragon Skip All.'),
            ('Dragon Reverse', 'Membalik arah permainan.'),
            ('Dragon +2', 'Pemain berikutnya mengambil 2 kartu dan gilirannya dilewati.'),
            ('Dragon Reroll 4', 'Buang sisa kartu tangan ke deck, kocok, lalu ambil 4 kartu baru.'),
            ('Dragon Switch', 'Tukar seluruh kartu tangan dengan pemain aktif yang dipilih.'),
            ('Dragon +1 All', 'Semua pemain aktif selain pemain yang memainkan kartu mengambil 1 kartu.'),
            ('Dragon Discard', 'Buang hingga 1 kartu dari tangan ke discard pile tanpa mengaktifkan efek kartu yang dibuang.'),
            ('Dragon Reset All', 'Semua pemain aktif membuang tangan lalu mengambil 7 kartu baru. Spectator tidak terkena efek.'),
            ('Dragon Revive', 'Pilih 1 kartu dari discard pile untuk diambil ke tangan. Jika kartu ini menghabiskan tangan, langsung menang.'),
            ('Dragon Block', 'Pilih satu elemen yang tidak boleh dimainkan sampai giliran kembali kepada pemain yang memblokir.'),
          ]
        : <(String, String)>[
            ('Kartu Angka', 'Mainkan jika warna atau angka cocok dengan kartu teratas.'),
            ('Skip', 'Melewati giliran pemain berikutnya.'),
            ('Reverse', 'Membalik arah permainan.'),
            ('Draw 2', 'Pemain berikutnya mengambil 2 kartu dan kehilangan giliran.'),
            ('Wild', 'Pilih warna aktif berikutnya.'),
            ('Wild Draw 4', 'Pilih warna; pemain berikutnya mengambil 4 kartu dan kehilangan giliran.'),
          ];
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: panelColor,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
          child: SizedBox(
            height: MediaQuery.of(sheetContext).size.height * .68,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('DESKRIPSI KARTU', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 1)),
              const SizedBox(height: 12),
              Expanded(child: ListView.separated(
                itemCount: entries.length,
                separatorBuilder: (_, __) => const Divider(color: Colors.white12),
                itemBuilder: (_, index) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(entries[index].$1, style: const TextStyle(fontWeight: FontWeight.w900, color: accentColor)),
                    const SizedBox(height: 4),
                    Text(entries[index].$2, style: const TextStyle(fontSize: 13, height: 1.4, color: Colors.white70)),
                  ]),
                ),
              )),
            ]),
          ),
        ),
      ),
    );
  }


  Future<String?> _chooseColor(BuildContext context) async {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: panelColor,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('PILIH WARNA', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.5)),
            const SizedBox(height: 18),
            Row(children: [
              _colorChoice(context, 'red', redCard),
              _colorChoice(context, 'yellow', yellowCard),
              _colorChoice(context, 'green', greenCard),
              _colorChoice(context, 'blue', blueCard),
            ]),
          ]),
        ),
      ),
    );
  }

  Widget _colorChoice(BuildContext context, String value, Color color) {
    return Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 5), child: InkWell(
      onTap: () => Navigator.pop(context, value),
      borderRadius: BorderRadius.circular(14),
      child: Container(height: 62, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.check, color: Colors.black, size: 28)),
    )));
  }

  Future<String?> _chooseSwitchTarget(
    BuildContext context,
    List<Map<String, dynamic>> players,
    String myId,
  ) async {
    final eligible = players
        .where((player) =>
            player['id'] != myId &&
            player['connected'] == true &&
            player['isSpectator'] != true)
        .toList();
    if (eligible.isEmpty) {
      controller.setNotice('Tidak ada pemain lain yang sedang online untuk ditukar kartunya.', error: true);
      return null;
    }

    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: panelColor,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('DRAGON SWITCH', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.3, color: Color(0xFFD7B8FF))),
            const SizedBox(height: 5),
            const Text('Pilih pemain yang akan bertukar seluruh kartu tangan denganmu.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 12)),
            const SizedBox(height: 12),
            SizedBox(
              height: (MediaQuery.of(sheetContext).size.height * .55).clamp(120.0, 420.0).toDouble(),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: eligible.length,
                separatorBuilder: (_, __) => const Divider(color: Colors.white10, height: 1),
                itemBuilder: (context, index) {
                  final player = eligible[index];
                  final id = player['id'].toString();
                  final name = player['name']?.toString() ?? 'Pemain';
                  return ListTile(
                    leading: CircleAvatar(backgroundColor: const Color(0xFF7043A5), child: Text(name.isEmpty ? '?' : name.characters.first.toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
                    title: Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text('${player['cardCount'] ?? 0} kartu di tangan', style: const TextStyle(color: Colors.white54, fontSize: 11)),
                    trailing: const Icon(Icons.swap_horiz_rounded, color: Color(0xFFD7B8FF)),
                    onTap: () => Navigator.pop(sheetContext, id),
                  );
                },
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Future<String?> _chooseBlockedElement(BuildContext context) {
    const elements = [
      ('fire', 'FIRE', Icons.local_fire_department_rounded),
      ('water', 'WATER', Icons.water_drop_rounded),
      ('grass', 'GRASS', Icons.eco_rounded),
      ('electric', 'ELECTRIC', Icons.bolt_rounded),
      ('ground', 'GROUND', Icons.terrain_rounded),
      ('colorless', 'COLORLESS', Icons.circle_outlined),
      ('dragon', 'DRAGON', Icons.auto_awesome_rounded),
    ];
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: panelColor,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('DRAGON BLOCK', style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFD7B8FF), letterSpacing: 1.2)),
            const SizedBox(height: 5),
            const Text('Pilih elemen yang tidak boleh dimainkan sampai giliranmu kembali.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 12)),
            const SizedBox(height: 10),
            ...elements.map((item) => ListTile(
              dense: true,
              leading: Icon(item.$3, color: _elementColor(item.$1)),
              title: Text(item.$2, style: const TextStyle(fontWeight: FontWeight.w800)),
              trailing: const Icon(Icons.block_rounded, color: Color(0xFFD7B8FF)),
              onTap: () => Navigator.pop(sheetContext, item.$1),
            )),
          ]),
        ),
      ),
    );
  }

  Future<String?> _chooseDiscardHandCard(
    BuildContext context,
    List<Map<String, dynamic>> cards,
  ) {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: panelColor,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('DRAGON DISCARD', style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFD7B8FF), letterSpacing: 1.2)),
            const SizedBox(height: 5),
            const Text('Pilih hingga satu kartu untuk dibuang tanpa mengaktifkan efeknya.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 12)),
            const SizedBox(height: 10),
            SizedBox(
              height: (MediaQuery.of(sheetContext).size.height * .45).clamp(120.0, 340.0).toDouble(),
              child: ListView.separated(
                itemCount: cards.length,
                separatorBuilder: (_, __) => const Divider(color: Colors.white10, height: 1),
                itemBuilder: (context, index) {
                  final card = cards[index];
                  final id = card['id']?.toString() ?? '';
                  return ListTile(
                    leading: CardFace(card: card, width: 34, height: 52),
                    title: Text(_cardDescription(card), style: const TextStyle(fontWeight: FontWeight.w800)),
                    trailing: const Icon(Icons.delete_outline_rounded, color: Color(0xFFD7B8FF)),
                    onTap: () => Navigator.pop(sheetContext, id),
                  );
                },
              ),
            ),
            const SizedBox(height: 6),
            OutlinedButton(
              onPressed: () => Navigator.pop(sheetContext, '__none__'),
              child: const Text('TIDAK MEMBUANG KARTU'),
            ),
          ]),
        ),
      ),
    );
  }

  Future<String?> _chooseReviveCard(
    BuildContext context,
    List<Map<String, dynamic>> cards,
  ) {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: panelColor,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('DRAGON REVIVE', style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFD7B8FF), letterSpacing: 1.2)),
            const SizedBox(height: 5),
            const Text('Lihat discard pile dan pilih satu kartu untuk diambil ke tangan.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 12)),
            const SizedBox(height: 10),
            SizedBox(
              height: (MediaQuery.of(sheetContext).size.height * .58).clamp(150.0, 440.0).toDouble(),
              child: ListView.separated(
                itemCount: cards.length,
                separatorBuilder: (_, __) => const Divider(color: Colors.white10, height: 1),
                itemBuilder: (context, index) {
                  final card = cards[index];
                  final id = card['id']?.toString() ?? '';
                  return ListTile(
                    leading: CardFace(card: card, width: 34, height: 52),
                    title: Text(_cardDescription(card), style: const TextStyle(fontWeight: FontWeight.w800)),
                    trailing: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFFD7B8FF)),
                    onTap: () => Navigator.pop(sheetContext, id),
                  );
                },
              ),
            ),
          ]),
        ),
      ),
    );
  }

  String _cardDescription(Map<String, dynamic> card) {
    if (card['type'] == 'dragon') {
      final effect = card['effect']?.toString() ?? '';
      const labels = {
        'skip': 'Dragon Skip All',
        'switch_direction': 'Dragon Switch Direction',
        'draw_two': 'Dragon +2',
        'reroll': 'Dragon Reroll 4',
        'switch_hand': 'Dragon Switch',
        'draw_one_all': 'Dragon +1 All',
        'discard': 'Dragon Discard',
        'reset_all': 'Dragon Reset All',
        'revive': 'Dragon Revive',
        'block': 'Dragon Block',
      };
      return labels[effect] ?? 'Dragon';
    }
    return '${(card['element'] ?? 'Colorless').toString().toUpperCase()} ${card['number'] ?? ''}';
  }

  @override
  Widget build(BuildContext context) {
    final room = controller.room;
    final game = controller.game;
    final isUnollele = room['gameMode'] == 'unollele';
    final players = (room['players'] as List? ?? []).map((item) => GameController.mapData(item)).toList();
    final hand = (game['hand'] as List? ?? []).map((item) => GameController.mapData(item)).toList();
    final playableIds = (game['playableCardIds'] as List? ?? []).map((item) => item.toString()).toSet();
    final winnerIds = (game['winnerIds'] as List? ?? []).map((item) => item.toString()).toSet();
    final isWinner = game['isSpectator'] == true || winnerIds.contains(controller.myId);
    final myTurn = game['currentPlayerId'] == controller.myId &&
        room['status'] == 'playing' &&
        !isWinner;
    final pendingUno = game['pendingUno']?.toString();
    final topCard = GameController.mapData(game['topCard']);
    final currentPlayer = players.where((player) => player['id'] == game['currentPlayerId']).firstOrNull;
    final loserId = game['loserId']?.toString();
    final loser = players.where((player) => player['id'] == loserId).firstOrNull;
    final loserName = loser?['name']?.toString() ?? 'Pemain';
    final onlinePlayerCount = players.where((player) => player['connected'] == true).length;

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [Text(isUnollele ? 'UNOLLELE' : 'UNO GACOR', style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)), const SizedBox(width: 10), Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4), decoration: BoxDecoration(color: panelColor, borderRadius: BorderRadius.circular(7)), child: Text(room['code']?.toString() ?? '', style: const TextStyle(fontSize: 11, letterSpacing: 1.5, color: accentColor, fontWeight: FontWeight.bold)))]),
        actions: [MusicToggleButton(music: music), IconButton(onPressed: controller.leaveRoom, icon: const Icon(Icons.exit_to_app_rounded), tooltip: 'Keluar permainan')],
      ),
      body: SafeArea(
        child: Stack(children: [
          Column(children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Column(children: [
                CircularGameTable(
                  players: players,
                  turnOrder: (game['turnOrder'] as List? ?? []).map((item) => item.toString()).toList(),
                  myId: controller.myId,
                  currentPlayerId: game['currentPlayerId']?.toString() ?? '',
                  direction: (game['direction'] as num?)?.toInt() ?? 1,
                  center: _buildTableCenter(
                    game: game,
                    topCard: topCard,
                    currentPlayerName: currentPlayer?['name']?.toString() ?? 'PEMAIN',
                    isFinished: room['status'] == 'finished',
                    isWinner: isWinner,
                    isUnollele: isUnollele,
                    myTurn: myTurn,
                  ),
                ),
                const SizedBox(height: 12),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('KARTUMU', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2)),
                  Text('${hand.length} kartu', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                ]),
                const SizedBox(height: 8),
                SizedBox(
                  height: 132,
                  child: hand.isEmpty
                      ? Center(child: Text(isWinner ? 'Kamu sudah menang — sekarang menjadi spectator.' : 'Tidak ada kartu di tangan.', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white54)))
                      : ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: hand.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 7),
                          itemBuilder: (context, index) {
                            final card = hand[index];
                            final id = card['id']?.toString() ?? '';
                            final canPlay = playableIds.contains(id) && myTurn && room['status'] == 'playing';
                            return Opacity(
                              opacity: canPlay ? 1 : .48,
                              child: InkWell(
                                onTap: canPlay ? () async {
                                  String? chosenColor;
                                  if (card['color'] == 'wild') {
                                    chosenColor = await _chooseColor(context);
                                    if (chosenColor == null) return;
                                  }
                                  String? targetPlayerId;
                                  String? discardHandCardId;
                                  String? reviveCardId;
                                  String? blockedElement;
                                  if (isUnollele && card['type'] == 'dragon') {
                                    switch (card['effect']) {
                                      case 'switch_hand':
                                        targetPlayerId = await _chooseSwitchTarget(context, players, controller.myId);
                                        if (targetPlayerId == null) return;
                                        break;
                                      case 'discard':
                                        if (hand.length > 1) {
                                          final choices = hand.where((item) => item['id'] != id).toList();
                                          final selected = await _chooseDiscardHandCard(context, choices);
                                          if (selected == null) return;
                                          if (selected != '__none__') discardHandCardId = selected;
                                        }
                                        break;
                                      case 'revive':
                                        if (hand.length > 1) {
                                          final discardPile = (game['discardPile'] as List? ?? [])
                                              .map((item) => GameController.mapData(item))
                                              .toList();
                                          reviveCardId = await _chooseReviveCard(context, discardPile);
                                          if (reviveCardId == null) return;
                                        }
                                        break;
                                      case 'block':
                                        blockedElement = await _chooseBlockedElement(context);
                                        if (blockedElement == null) return;
                                        break;
                                    }
                                  }
                                  controller.playCard(
                                    id,
                                    chosenColor: chosenColor,
                                    targetPlayerId: targetPlayerId,
                                    discardHandCardId: discardHandCardId,
                                    reviveCardId: reviveCardId,
                                    blockedElement: blockedElement,
                                  );
                                } : null,
                                borderRadius: BorderRadius.circular(12),
                                child: CardFace(card: card, width: 72, height: 112, glow: canPlay),
                              ),
                            );
                          },
                        ),
                ),
              ]),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 14),
            decoration: const BoxDecoration(color: Color(0xFF181D29), border: Border(top: BorderSide(color: Colors.white10))),
            child: Column(children: [
              if (room['status'] == 'playing') ...[
                SizedBox(width: double.infinity, child: OutlinedButton.icon(
                  onPressed: () => _showCardDescriptions(context, isUnollele),
                  icon: const Icon(Icons.info_outline_rounded, size: 18),
                  label: const Text('DESKRIPSI KARTU'),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white30), minimumSize: const Size.fromHeight(38), textStyle: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: .7)),
                )),
                const SizedBox(height: 8),
              ],
              if (room['status'] == 'finished')
                const SizedBox.shrink()
              else if (isWinner)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Text(
                    'KAMU MENANG! Kamu sekarang menjadi spectator sampai permainan selesai.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: accentColor, fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                )
              else ...[
                if (isUnollele)
                  SizedBox(width: double.infinity, child: FilledButton.icon(
                    onPressed: myTurn && game['canDraw'] == true ? controller.drawCard : null,
                    icon: const Icon(Icons.add_card_rounded),
                    label: const Text('AMBIL 1 KARTU  •  LEWATI GILIRAN'),
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFFB58BFF), foregroundColor: const Color(0xFF211D29), disabledBackgroundColor: Colors.white12, disabledForegroundColor: Colors.white30, minimumSize: const Size.fromHeight(48), textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900)),
                  ))
                else
                  Row(children: [
                    Expanded(child: FilledButton.icon(
                      onPressed: myTurn && game['turnHasDrawn'] != true ? controller.drawCard : null,
                      icon: const Icon(Icons.add_card_rounded), label: const Text('AMBIL KARTU'),
                      style: FilledButton.styleFrom(backgroundColor: accentColor, foregroundColor: Colors.black, disabledBackgroundColor: Colors.white12, disabledForegroundColor: Colors.white30, minimumSize: const Size.fromHeight(48), textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                    )),
                    const SizedBox(width: 8),
                    Expanded(child: OutlinedButton.icon(
                      onPressed: myTurn && game['turnHasDrawn'] == true ? controller.passTurn : null,
                      icon: const Icon(Icons.skip_next_rounded), label: const Text('LEWATI'),
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.white, disabledForegroundColor: Colors.white30, side: const BorderSide(color: Colors.white30), minimumSize: const Size.fromHeight(48), textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                    )),
                  ]),
                if (isUnollele && myTurn)
                  const Padding(padding: EdgeInsets.only(top: 6), child: Text('Kamu boleh mengambil kartu meski masih punya kartu yang bisa dimainkan.', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: Colors.white54))),
              ],
              if (pendingUno != null && room['status'] == 'playing' && pendingUno != controller.myId) ...[
                const SizedBox(height: 8),
                UnoShootButton(key: ValueKey('${pendingUno}_${game['pendingUnoDeadline']}'), onShoot: controller.catchUno),
              ] else if (pendingUno != null && room['status'] == 'playing' && pendingUno == controller.myId && !isWinner) ...[
                const SizedBox(height: 8),
                UnoCallButton(onCall: controller.callUno, key: ValueKey('${pendingUno}_${game['pendingUnoDeadline']}')),
              ],
              if (controller.notice.isNotEmpty) ...[const SizedBox(height: 8), NoticeBanner(text: controller.notice, isError: controller.noticeIsError)],
            ]),
          ),
          ]),
          if (room['status'] == 'finished')
            Positioned.fill(
              child: ColoredBox(
                color: Colors.black.withOpacity(.76),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 340),
                    child: Container(
                      margin: const EdgeInsets.all(22),
                      padding: const EdgeInsets.fromLTRB(22, 26, 22, 20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF2B2636), Color(0xFF171B27)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFFFF7777), width: 1.5),
                        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 30, spreadRadius: 2)],
                      ),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.sentiment_very_dissatisfied_rounded, color: Color(0xFFFF7777), size: 46),
                        const SizedBox(height: 10),
                        Text(
                          '$loserName KALAH',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFFFF7777), fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 1),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: controller.connected && onlinePlayerCount >= 2 ? controller.restartGame : null,
                            icon: const Icon(Icons.replay_rounded),
                            label: const Text('MAIN ULANG'),
                            style: FilledButton.styleFrom(
                              backgroundColor: accentColor,
                              foregroundColor: Colors.black,
                              disabledBackgroundColor: Colors.white12,
                              disabledForegroundColor: Colors.white30,
                              minimumSize: const Size.fromHeight(50),
                              textStyle: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: .7),
                            ),
                          ),
                        ),
                        if (onlinePlayerCount < 2)
                          const Padding(
                            padding: EdgeInsets.only(top: 8),
                            child: Text('Minimal 2 pemain harus online untuk memulai ulang.', textAlign: TextAlign.center, style: TextStyle(color: Colors.orangeAccent, fontSize: 11)),
                          ),
                        const SizedBox(height: 6),
                        TextButton.icon(
                          onPressed: controller.leaveRoom,
                          icon: const Icon(Icons.home_rounded, size: 17),
                          label: const Text('KELUAR KE BERANDA'),
                          style: TextButton.styleFrom(foregroundColor: Colors.white70),
                        ),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _buildTableCenter({
    required Map<String, dynamic> game,
    required Map<String, dynamic> topCard,
    required String currentPlayerName,
    required bool isFinished,
    required bool isWinner,
    required bool isUnollele,
    required bool myTurn,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF1C2D37), Color(0xFF17232E)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white24, width: 1.2),
        boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 14, offset: Offset(0, 5))],
      ),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: [
        Text(
          isFinished ? 'PERMAINAN SELESAI' : (isWinner ? 'SPECTATOR' : (myTurn ? 'GILIRANMU' : currentPlayerName.toUpperCase())),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: TextStyle(color: isFinished || isWinner || myTurn ? accentColor : Colors.white70, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: .8),
        ),
        const SizedBox(height: 6),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Column(children: [
            Container(width: 36, height: 54, decoration: BoxDecoration(color: const Color(0xFF30384A), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.white24)), child: const Icon(Icons.style_rounded, color: accentColor, size: 25)),
            const SizedBox(height: 3),
            Text('PILE ${game['deckCount'] ?? 0}', style: const TextStyle(color: Colors.white60, fontSize: 8, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(width: 8),
          Column(children: [
            const Text('TOP CARD', style: TextStyle(color: Colors.white54, fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: .8)),
            const SizedBox(height: 3),
            CardFace(card: topCard, width: 40, height: 58),
          ]),
          const SizedBox(width: 8),
          Column(children: [
            Icon(
              game['direction'] == -1 ? Icons.rotate_left_rounded : Icons.rotate_right_rounded,
              color: Colors.white70,
              size: 26,
            ),
            const SizedBox(height: 4),
            Text(
              game['direction'] == -1 ? 'BERLAWANAN ARAH' : 'SEARAH JARUM JAM',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white54, fontSize: 6.5, fontWeight: FontWeight.bold),
            ),
          ]),
        ]),
        const SizedBox(height: 6),
        TurnCountdown(deadline: (game['turnDeadline'] as num?)?.toInt(), active: !isFinished),
        const SizedBox(height: 4),
        Text(game['lastMove']?.toString() ?? 'Permainan dimulai', maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white60, fontSize: 10, height: 1.3)),
        if (isUnollele && topCard.isNotEmpty)
          Text(_unolleleRuleHint(topCard), maxLines: 3, overflow: TextOverflow.visible, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFD6C1FF), fontSize: 10, height: 1.3)),
        if (isUnollele && game['blockedElement'] != null)
          Text('BLOCK: ${game['blockedElement'].toString().toUpperCase()} • sampai giliran pemain pemblokir', maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFFF9B9B), fontSize: 7, fontWeight: FontWeight.w800, height: 1.15)),
        if (game['pendingUno'] != null)
          const Text('UNO BELUM DIPANGGIL!', style: TextStyle(color: accentColor, fontSize: 8, fontWeight: FontWeight.w900)),
      ]),
    );
  }
}

class UnoCallButton extends StatefulWidget {
  const UnoCallButton({super.key, required this.onCall});
  final VoidCallback onCall;

  @override
  State<UnoCallButton> createState() => _UnoCallButtonState();
}

class _UnoCallButtonState extends State<UnoCallButton> {
  bool _expired = false;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _expired = true);
    });
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: FilledButton(
      onPressed: _expired ? null : widget.onCall,
      style: FilledButton.styleFrom(backgroundColor: yellowCard, foregroundColor: Colors.black, disabledBackgroundColor: Colors.white12, disabledForegroundColor: Colors.white54, minimumSize: const Size.fromHeight(44)),
      child: Text(_expired ? 'WAKTU UNO HABIS' : 'UNO!', style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)),
    ),
  );
}

class UnoShootButton extends StatefulWidget {
  const UnoShootButton({super.key, required this.onShoot});
  final VoidCallback onShoot;

  @override
  State<UnoShootButton> createState() => _UnoShootButtonState();
}

class _UnoShootButtonState extends State<UnoShootButton> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _ready = true);
    });
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: FilledButton.icon(
      onPressed: _ready ? widget.onShoot : null,
      icon: const Icon(Icons.gps_fixed_rounded),
      label: Text(_ready ? 'TEMBAK UNO (+2)' : 'TUNGGU 0,5 DETIK...'),
      style: FilledButton.styleFrom(backgroundColor: redCard, foregroundColor: Colors.white, disabledBackgroundColor: Colors.white12, disabledForegroundColor: Colors.white54, minimumSize: const Size.fromHeight(44), textStyle: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: .6)),
    ),
  );
}

class CircularGameTable extends StatelessWidget {
  const CircularGameTable({
    super.key,
    required this.players,
    required this.turnOrder,
    required this.myId,
    required this.currentPlayerId,
    required this.direction,
    required this.center,
  });

  final List<Map<String, dynamic>> players;
  final List<String> turnOrder;
  final String myId;
  final String currentPlayerId;
  final int direction;
  final Widget center;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 310,
      width: double.infinity,
      child: LayoutBuilder(builder: (context, constraints) {
        final width = constraints.maxWidth;
        const height = 310.0;
        final seatWidth = players.length >= 7 ? 76.0 : players.length >= 5 ? 84.0 : 94.0;
        const seatHeight = 54.0;
        final centerX = width / 2;
        final centerY = height / 2;
        final radiusX = width * .48;
        final radiusY = height * .42;
        final ids = turnOrder.isNotEmpty ? turnOrder : players.map((player) => player['id'].toString()).toList();
        final myIndex = ids.indexOf(myId);
        final count = ids.length;
        final widgets = <Widget>[];

        widgets.add(Positioned.fill(child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 10, 4, 7),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF153D37),
              borderRadius: BorderRadius.circular(170),
              border: Border.all(color: const Color(0xFF4B8E75), width: 2),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 12, spreadRadius: 1)],
            ),
            child: Padding(padding: const EdgeInsets.all(9), child: Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(160), border: Border.all(color: Colors.white.withOpacity(.08), width: 1.2))),),
          ),
        )));

        final centerWidth = math.min(width * .46, 190.0).toDouble();
        widgets.add(Positioned(left: centerX - centerWidth / 2, top: centerY - 75, width: centerWidth, height: 150, child: center));

        for (var i = 0; i < count; i++) {
          final index = (myIndex < 0 ? i : (myIndex + (direction >= 0 ? i : -i) + count * 2) % count);
          final id = ids[index];
          final player = players.where((item) => item['id'] == id).firstOrNull;
          if (player == null) continue;
          final angle = math.pi / 2 + (direction >= 0 ? 1 : -1) * (2 * math.pi * i / count);
          final left = (centerX + radiusX * math.cos(angle) - seatWidth / 2).clamp(0.0, width - seatWidth).toDouble();
          final top = (centerY + radiusY * math.sin(angle) - seatHeight / 2).clamp(0.0, height - seatHeight).toDouble();
          widgets.add(Positioned(
            left: left,
            top: top,
            width: seatWidth,
            height: seatHeight,
            child: PlayerSeat(
              player: player,
              isMe: id == myId,
              isCurrent: id == currentPlayerId,
              compact: players.length >= 7,
            ),
          ));
        }
        return Stack(clipBehavior: Clip.none, children: widgets);
      }),
    );
  }
}

class PlayerSeat extends StatelessWidget {
  const PlayerSeat({super.key, required this.player, required this.isMe, required this.isCurrent, required this.compact});
  final Map<String, dynamic> player;
  final bool isMe;
  final bool isCurrent;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final name = player['name']?.toString() ?? 'Player';
    final spectator = player['isSpectator'] == true;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
      decoration: BoxDecoration(
        color: spectator ? const Color(0xFF26382F) : (isCurrent ? const Color(0xFF4A4529) : const Color(0xFF202A35)),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: spectator ? greenCard : (isCurrent ? accentColor : Colors.white24), width: isCurrent || spectator ? 2 : 1),
        boxShadow: isCurrent ? [const BoxShadow(color: Color(0x66FFD447), blurRadius: 10)] : null,
      ),
      child: Row(children: [
        CircleAvatar(radius: compact ? 10 : 12, backgroundColor: _avatarColor(name), child: Text(name.isEmpty ? '?' : name.characters.first.toUpperCase(), style: TextStyle(fontSize: compact ? 9 : 10, color: Colors.black, fontWeight: FontWeight.w900))),
        const SizedBox(width: 4),
        Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(spectator ? '${isMe ? 'KAMU' : name} • MENANG' : (isMe ? 'KAMU' : name), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: compact ? 8 : 9, fontWeight: FontWeight.w900, color: spectator ? greenCard : (isCurrent ? accentColor : Colors.white))),
          Text(spectator ? 'SPECTATOR' : '${player['cardCount'] ?? 0} kartu${player['connected'] == true ? '' : ' • offline'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 8, color: Colors.white60)),
        ])),
      ]),
    );
  }
}

class TurnCountdown extends StatefulWidget {
  const TurnCountdown({super.key, required this.deadline, required this.active});
  final int? deadline;
  final bool active;

  @override
  State<TurnCountdown> createState() => _TurnCountdownState();
}

class _TurnCountdownState extends State<TurnCountdown> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remaining = widget.active && widget.deadline != null
        ? ((widget.deadline! - DateTime.now().millisecondsSinceEpoch) / 1000).ceil().clamp(0, 15)
        : 0;
    final color = remaining <= 5 ? const Color(0xFFFF6B6B) : accentColor;
    return Row(mainAxisAlignment: MainAxisAlignment.center, mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.timer_outlined, size: 13, color: color),
      const SizedBox(width: 3),
      Text(widget.active ? '$remaining dtk' : '—', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: color)),
    ]);
  }
}

class MusicToggleButton extends StatelessWidget {
  const MusicToggleButton({super.key, required this.music});
  final MusicManager music;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: music,
      builder: (context, _) => IconButton(
        tooltip: music.muted ? 'Aktifkan musik' : 'Matikan musik',
        onPressed: music.toggleMuted,
        icon: Icon(music.muted ? Icons.volume_off_rounded : Icons.volume_up_rounded, color: music.muted ? Colors.white54 : accentColor),
      ),
    );
  }
}

class CardFace extends StatelessWidget {
  const CardFace({super.key, required this.card, required this.width, required this.height, this.glow = false});
  final Map<String, dynamic> card;
  final double width;
  final double height;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    if (card['type'] == 'number' || card['type'] == 'dragon' || card.containsKey('element')) {
      return _buildUnolleleCard();
    }
    return _buildClassicCard();
  }

  Widget _buildUnolleleCard() {
    final element = card['element']?.toString() ?? 'colorless';
    final isDragon = card['type'] == 'dragon' || element == 'dragon';
    final color = _elementColor(element);
    final number = card['number']?.toString() ?? '';
    final effect = card['effect']?.toString() ?? '';
    final effectLabel = switch (effect) {
      'skip' => 'SKIP ALL',
      'switch_direction' => 'REVERSE',
      'draw_two' => '+2',
      'reroll' => 'REROLL 4',
      'switch_hand' => 'SWITCH',
      'draw_one_all' => '+1 OTHERS',
      'discard' => 'DISCARD',
      'reset_all' => 'RESET ALL',
      'revive' => 'REVIVE',
      'block' => 'BLOCK',
      _ => 'DRAGON',
    };
    final icon = isDragon ? Icons.auto_awesome_rounded : _elementIcon(element);

    return Container(
      width: width,
      height: height,
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [color, color.withOpacity(.72), const Color(0xFF171923)]),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: glow ? Colors.white : Colors.white70, width: glow ? 2.2 : 1),
        boxShadow: glow ? [BoxShadow(color: color.withOpacity(.65), blurRadius: 12, spreadRadius: 1)] : const [],
      ),
      child: Stack(children: [
        Positioned(right: -10, top: 12, child: Icon(icon, size: width * .72, color: Colors.white.withOpacity(.10))),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(isDragon ? 'DRAGON' : element.toUpperCase(), maxLines: 1, overflow: TextOverflow.clip, style: TextStyle(color: Colors.white, fontSize: width * .115, fontWeight: FontWeight.w900, letterSpacing: .35)),
          Expanded(child: Center(child: isDragon
            ? Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(icon, size: width * .36, color: Colors.white),
                const SizedBox(height: 3),
                FittedBox(fit: BoxFit.scaleDown, child: Text(effectLabel, style: TextStyle(color: Colors.white, fontSize: width * .18, fontWeight: FontWeight.w900))),
              ])
            : Stack(alignment: Alignment.center, children: [
                Container(width: width * .64, height: height * .60, decoration: BoxDecoration(color: Colors.white.withOpacity(.91), borderRadius: BorderRadius.circular(40), border: Border.all(color: Colors.black.withOpacity(.12), width: 1.2))),
                Text(number, style: TextStyle(color: color.computeLuminance() < .36 ? color : Colors.black87, fontSize: width * .48, fontWeight: FontWeight.w900, height: 1)),
              ]))),
          Text(isDragon ? 'UNIQUE EFFECT' : 'UNOLLELE', textAlign: TextAlign.center, maxLines: 1, style: TextStyle(color: Colors.white.withOpacity(.9), fontSize: width * .085, fontWeight: FontWeight.w800, letterSpacing: .25)),
        ]),
        Positioned(right: 1, top: 0, child: Text(isDragon ? 'D' : number, style: TextStyle(color: Colors.white, fontSize: width * .12, fontWeight: FontWeight.w900))),
      ]),
    );
  }

  Widget _buildClassicCard() {
    final color = _colorFor(card['color']?.toString());
    final value = card['value']?.toString() ?? '?';
    final label = switch (value) {
      'wild' => 'WILD',
      'wild_draw4' => '+4',
      'draw2' => '+2',
      'reverse' => '↔',
      'skip' => '⊘',
      _ => value,
    };
    return Container(
      width: width,
      height: height,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: glow ? Colors.white : Colors.white70, width: glow ? 2 : 1),
        boxShadow: glow ? [BoxShadow(color: color.withOpacity(.55), blurRadius: 10, spreadRadius: 1)] : const [],
      ),
      child: Stack(children: [
        Align(alignment: Alignment.center, child: Transform.rotate(angle: -.22, child: Container(width: width * .65, height: height * .67, decoration: BoxDecoration(color: Colors.white.withOpacity(.92), borderRadius: BorderRadius.circular(50)), child: Center(child: Text(label, style: TextStyle(color: color.computeLuminance() < .45 ? color : Colors.black, fontSize: width * .27, fontWeight: FontWeight.w900, shadows: const [Shadow(color: Colors.black12, blurRadius: 1)])))))),
        Positioned(left: 3, top: 1, child: Text(label, style: TextStyle(color: color.computeLuminance() < .45 ? Colors.white : Colors.black, fontSize: width * .16, fontWeight: FontWeight.w900))),
        Positioned(right: 3, bottom: 1, child: Transform.rotate(angle: 3.14159, child: Text(label, style: TextStyle(color: color.computeLuminance() < .45 ? Colors.white : Colors.black, fontSize: width * .16, fontWeight: FontWeight.w900)))),
      ]),
    );
  }
}

Color _elementColor(String element) => switch (element) {
  'fire' => const Color(0xFFDB492F),
  'water' => const Color(0xFF247BC3),
  'grass' => const Color(0xFF29945D),
  'electric' => const Color(0xFFE0AD20),
  'ground' => const Color(0xFF8B6543),
  'colorless' => const Color(0xFF737B89),
  'dragon' => const Color(0xFF7043A5),
  _ => const Color(0xFF737B89),
};

IconData _elementIcon(String element) => switch (element) {
  'fire' => Icons.local_fire_department_rounded,
  'water' => Icons.water_drop_rounded,
  'grass' => Icons.eco_rounded,
  'electric' => Icons.bolt_rounded,
  'ground' => Icons.terrain_rounded,
  'colorless' => Icons.circle_outlined,
  _ => Icons.style_rounded,
};

String _unolleleRuleHint(Map<String, dynamic> topCard) {
  if (topCard['type'] == 'dragon') {
    return 'Colorless 10 dapat melawan Dragon; elemen lain mengikuti aturan weakness.';
  }
  final element = topCard['element']?.toString() ?? '';
  if (element == 'colorless') {
    return 'Colorless 10: dapat dikalahkan semua kartu elemental (angka berapa pun); Dragon tidak bisa.';
  }
  const weakness = {
    'fire': 'Water / Ground',
    'water': 'Grass / Electric',
    'grass': 'Fire',
    'electric': 'Ground',
    'ground': 'Water / Grass',
  };
  final weakTypes = weakness[element] ?? '-';
  return 'Weakness: $weakTypes • Colorless 10 hanya di atas angka yang lebih rendah atau Dragon';
}

class NoticeBanner extends StatelessWidget {
  const NoticeBanner({super.key, required this.text, this.isError = false});
  final String text;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(color: isError ? const Color(0xFF4A262B) : const Color(0xFF1D463B), borderRadius: BorderRadius.circular(12)),
      child: Text(text, style: TextStyle(color: isError ? const Color(0xFFFFB9B9) : const Color(0xFFB6F2D5), fontSize: 12, height: 1.3)),
    );
  }
}

Color _colorFor(String? value) => switch (value) {
      'red' => redCard,
      'yellow' => yellowCard,
      'green' => greenCard,
      'blue' => blueCard,
      'wild' => const Color(0xFF282B37),
      _ => Colors.grey,
    };

Color _avatarColor(String value) {
  const colors = [redCard, yellowCard, greenCard, blueCard];
  return colors[value.hashCode.abs() % colors.length];
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
