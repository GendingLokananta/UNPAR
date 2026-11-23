import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'game_controller.dart';

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
  runApp(UnoPartyApp(controller: controller));
}

class UnoPartyApp extends StatelessWidget {
  const UnoPartyApp({super.key, required this.controller});
  final GameController controller;

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
          if (current == null) return HomeScreen(controller: controller);
          final room = GameController.mapData(current['room']);
          if (room['status'] == 'lobby') return LobbyScreen(controller: controller);
          return GameScreen(controller: controller);
        },
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller});
  final GameController controller;

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
                  const SizedBox(height: 18),
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
                  const Text('UNO PARTY', textAlign: TextAlign.center, style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 2.2)),
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
  const LobbyScreen({super.key, required this.controller});
  final GameController controller;

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
        actions: [IconButton(tooltip: 'Keluar room', onPressed: controller.leaveRoom, icon: const Icon(Icons.exit_to_app_rounded))],
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
                    child: const Text('UNOLLELE: 6 tipe elemental, sistem weakness, dan 4 efek kartu Dragon. Setiap pemain akan mendapat 5 kartu.', style: TextStyle(color: Color(0xFFE2D5FF), height: 1.45, fontSize: 12)),
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
  const GameScreen({super.key, required this.controller});
  final GameController controller;

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

  @override
  Widget build(BuildContext context) {
    final room = controller.room;
    final game = controller.game;
    final isUnollele = room['gameMode'] == 'unollele';
    final players = (room['players'] as List? ?? []).map((item) => GameController.mapData(item)).toList();
    final hand = (game['hand'] as List? ?? []).map((item) => GameController.mapData(item)).toList();
    final playableIds = (game['playableCardIds'] as List? ?? []).map((item) => item.toString()).toSet();
    final myTurn = game['currentPlayerId'] == controller.myId && room['status'] == 'playing';
    final pendingUno = game['pendingUno']?.toString();
    final isWinner = game['winnerId'] == controller.myId;
    final topCard = GameController.mapData(game['topCard']);
    final currentPlayer = players.where((player) => player['id'] == game['currentPlayerId']).firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [Text(isUnollele ? 'UNOLLELE' : 'UNO PARTY', style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)), const SizedBox(width: 10), Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4), decoration: BoxDecoration(color: panelColor, borderRadius: BorderRadius.circular(7)), child: Text(room['code']?.toString() ?? '', style: const TextStyle(fontSize: 11, letterSpacing: 1.5, color: accentColor, fontWeight: FontWeight.bold)))]),
        actions: [IconButton(onPressed: () => controller.leaveRoom(), icon: const Icon(Icons.exit_to_app_rounded), tooltip: 'Keluar permainan')],
      ),
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
              child: Column(children: [
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: players.where((player) => player['id'] != controller.myId).map((player) {
                    final active = player['id'] == game['currentPlayerId'];
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                      decoration: BoxDecoration(color: active ? const Color(0xFF35412F) : panelColor, borderRadius: BorderRadius.circular(13), border: Border.all(color: active ? accentColor.withOpacity(.7) : Colors.white10)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        CircleAvatar(radius: 12, backgroundColor: _avatarColor(player['name']?.toString() ?? ''), child: Text((player['name']?.toString() ?? '?').characters.first.toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.black, fontWeight: FontWeight.w900))),
                        const SizedBox(width: 7),
                        Text(player['name']?.toString() ?? 'Player', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 7),
                        Text('${player['cardCount'] ?? 0} kartu', style: const TextStyle(fontSize: 10, color: Colors.white60)),
                        if (player['connected'] != true) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.wifi_off, size: 12, color: Colors.orangeAccent)),
                      ]),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(16, 15, 16, 16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFF202B39), Color(0xFF182330)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Column(children: [
                    Text(room['status'] == 'finished' ? (isWinner ? 'KAMU MENANG!' : 'PERMAINAN SELESAI') : (myTurn ? 'GILIRANMU' : 'GILIRAN ${currentPlayer?['name']?.toString().toUpperCase() ?? 'PEMAIN'}'), style: TextStyle(color: room['status'] == 'finished' ? accentColor : myTurn ? accentColor : Colors.white70, fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 1.6)),
                    const SizedBox(height: 12),
                    Row(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [
                      Column(children: [
                        Container(width: 67, height: 100, decoration: BoxDecoration(color: const Color(0xFF30384A), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white24, width: 2)), child: const Center(child: Icon(Icons.style_rounded, size: 35, color: accentColor))),
                        const SizedBox(height: 5),
                        Text('DECK  ${game['deckCount'] ?? 0}', style: const TextStyle(fontSize: 9, color: Colors.white54, fontWeight: FontWeight.bold)),
                      ]),
                      const SizedBox(width: 28),
                      Column(children: [
                        Text('KARTU AKTIF', style: const TextStyle(fontSize: 9, color: Colors.white54, letterSpacing: 1.1, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        CardFace(card: topCard, width: 82, height: 120),
                        const SizedBox(height: 8),
                        if (isUnollele) ...[
                          Text('TIPE: ${(topCard['element'] ?? '-').toString().toUpperCase()}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFD6C1FF))),
                          const SizedBox(height: 4),
                          SizedBox(width: 150, child: Text(_unolleleRuleHint(topCard), textAlign: TextAlign.center, style: const TextStyle(fontSize: 9, color: Colors.white60, height: 1.25))),
                        ] else
                          Row(children: [const Text('Warna: ', style: TextStyle(color: Colors.white54, fontSize: 11)), Container(width: 13, height: 13, decoration: BoxDecoration(color: _colorFor(game['currentColor']?.toString()), shape: BoxShape.circle, border: Border.all(color: Colors.white38))), const SizedBox(width: 5), Text(game['currentColor']?.toString().toUpperCase() ?? '-', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold))]),
                      ]),
                      const SizedBox(width: 28),
                      Column(children: [
                        Container(width: 67, height: 100, decoration: BoxDecoration(color: panelColor, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white24, width: 2)), child: Center(child: Transform.rotate(angle: game['direction'] == -1 ? 3.14159 : 0, child: const Icon(Icons.sync_alt_rounded, size: 34, color: Colors.white70)))),
                        const SizedBox(height: 5),
                        Text(game['direction'] == -1 ? 'REVERSE' : 'ARAH', style: const TextStyle(fontSize: 9, color: Colors.white54, fontWeight: FontWeight.bold)),
                      ]),
                    ]),
                    const SizedBox(height: 13),
                    Text(game['lastMove']?.toString() ?? 'Permainan dimulai', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    if (pendingUno != null) ...[
                      const SizedBox(height: 10),
                      Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7), decoration: BoxDecoration(color: const Color(0xFF513A1C), borderRadius: BorderRadius.circular(10)), child: Text(pendingUno == controller.myId ? 'JANGAN LUPA PANGGIL UNO!' : 'PEMAIN BELUM MEMANGGIL UNO', style: const TextStyle(fontSize: 10, color: accentColor, fontWeight: FontWeight.w900, letterSpacing: .7))),
                    ],
                  ]),
                ),
                const SizedBox(height: 14),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('KARTUMU', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2)),
                  Text('${hand.length} kartu', style: const TextStyle(color: Colors.white54, fontSize: 12)),
                ]),
                const SizedBox(height: 8),
                SizedBox(
                  height: 132,
                  child: hand.isEmpty
                      ? const Center(child: Text('Tidak ada kartu di tangan.', style: TextStyle(color: Colors.white54)))
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
                                  controller.playCard(id, chosenColor: chosenColor);
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
              if (room['status'] == 'finished')
                FilledButton.icon(onPressed: controller.leaveRoom, icon: const Icon(Icons.home_rounded), label: const Text('KEMBALI KE BERANDA'), style: FilledButton.styleFrom(backgroundColor: accentColor, foregroundColor: Colors.black, minimumSize: const Size.fromHeight(48)))
              else ...[
                if (isUnollele) ...[
                  SizedBox(width: double.infinity, child: FilledButton.icon(
                    onPressed: myTurn && game['canDraw'] == true ? controller.drawCard : null,
                    icon: const Icon(Icons.add_card_rounded),
                    label: const Text('AMBIL 1 KARTU  •  GILIRAN LANGSUNG DILEWATI'),
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFFB58BFF), foregroundColor: const Color(0xFF211D29), disabledBackgroundColor: Colors.white12, disabledForegroundColor: Colors.white30, minimumSize: const Size.fromHeight(48), textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900)),
                  )),
                  if (myTurn && playableIds.isNotEmpty)
                    const Padding(padding: EdgeInsets.only(top: 7), child: Text('Pilih salah satu kartu yang menyala; kamu masih memiliki kartu valid.', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: Colors.white54))),
                ] else
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
                if (pendingUno != null) ...[
                  const SizedBox(height: 8),
                  SizedBox(width: double.infinity, child: FilledButton(
                    onPressed: pendingUno == controller.myId ? controller.callUno : controller.catchUno,
                    style: FilledButton.styleFrom(backgroundColor: pendingUno == controller.myId ? yellowCard : redCard, foregroundColor: Colors.black, minimumSize: const Size.fromHeight(42)),
                    child: Text(pendingUno == controller.myId ? 'UNO!' : 'TANGKAP UNO (+2)', style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)),
                  )),
                ],
              ],
              if (controller.notice.isNotEmpty) ...[const SizedBox(height: 8), NoticeBanner(text: controller.notice, isError: controller.noticeIsError)],
            ]),
          ),
        ]),
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
      'skip' => 'SKIP',
      'switch_direction' => 'REVERSE',
      'draw_two' => '+2',
      'reset' => 'RESET',
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
  if (topCard['type'] == 'dragon') return 'Semua kartu angka dapat dimainkan; Dragon tidak dapat ditumpuk.';
  final element = topCard['element']?.toString() ?? '';
  final number = topCard['number']?.toString() ?? '';
  const weakness = {
    'fire': 'Water / Ground',
    'water': 'Grass / Electric',
    'grass': 'Fire',
    'electric': 'Ground',
    'ground': 'Water / Grass',
    'colorless': 'Semua elemen + Dragon',
  };
  final weakTypes = weakness[element] ?? '-';
  return 'Angka $element / Colorless harus lebih tinggi dari $number; weakness: $weakTypes';
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
