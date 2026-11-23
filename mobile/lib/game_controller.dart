import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class GameController extends ChangeNotifier {
  SharedPreferences? _prefs;
  IO.Socket? _socket;
  String _connectedUrl = '';

  String playerId = '';
  String nickname = '';
  String serverUrl = const String.fromEnvironment('SERVER_URL');
  String roomCode = '';
  bool connected = false;
  bool busy = false;
  String notice = '';
  bool noticeIsError = false;
  Map<String, dynamic>? state;

  Map<String, dynamic> get room => mapData(state?['room']);
  Map<String, dynamic> get game => mapData(state?['game']);
  String get myId => playerId;
  bool get inRoom => state != null && room.isNotEmpty;

  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
    playerId = _prefs!.getString('player_id') ?? _makePlayerId();
    nickname = _prefs!.getString('nickname') ?? '';
    if (serverUrl.isEmpty) serverUrl = _prefs!.getString('server_url') ?? '';
    roomCode = _prefs!.getString('room_code') ?? '';
    await _prefs!.setString('player_id', playerId);
    if (roomCode.isNotEmpty && serverUrl.isNotEmpty) {
      unawaited(_connectAndRejoin());
    }
    notifyListeners();
  }

  String _makePlayerId() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final random = Random.secure();
    return List.generate(32, (_) => chars[random.nextInt(chars.length)]).join();
  }

  static Map<String, dynamic> mapData(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  void setNotice(String value, {bool error = false}) {
    notice = value;
    noticeIsError = error;
    notifyListeners();
  }

  Future<void> saveSettings({required String name, required String url}) async {
    nickname = name.trim();
    serverUrl = url.trim().replaceFirst(RegExp(r'/$'), '');
    await _prefs?.setString('nickname', nickname);
    await _prefs?.setString('server_url', serverUrl);
    notifyListeners();
  }

  Future<void> _ensureConnected() async {
    if (serverUrl.isEmpty) {
      throw Exception('Isi alamat server laptop terlebih dahulu.');
    }
    if (_socket != null && _socket!.connected && _connectedUrl == serverUrl) {
      connected = true;
      return;
    }

    _socket?.dispose();
    connected = false;
    final completer = Completer<void>();
    final socket = IO.io(
      serverUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableReconnection()
          .enableForceNew()
          .disableAutoConnect()
          .build(),
    );
    _socket = socket;
    _connectedUrl = serverUrl;

    socket.onConnect((_) {
      connected = true;
      notice = 'Terhubung ke server';
      noticeIsError = false;
      notifyListeners();
      if (!completer.isCompleted) completer.complete();
      if (roomCode.isNotEmpty) {
        _emitAck('rejoin_room', {
          'playerId': playerId,
          'code': roomCode,
        }).then((result) {
          if (result['ok'] == true && result['state'] != null) {
            state = mapData(result['state']);
            notifyListeners();
          } else if (result['ok'] == false) {
            roomCode = '';
            state = null;
            _prefs?.remove('room_code');
            setNotice(result['error']?.toString() ?? 'Tidak bisa masuk kembali ke room.', error: true);
          }
        });
      }
    });
    socket.onDisconnect((_) {
      connected = false;
      notice = 'Koneksi ke server terputus. Mencoba menyambungkan kembali…';
      noticeIsError = true;
      notifyListeners();
    });
    socket.on('connect_error', (error) {
      connected = false;
      notice = 'Gagal terhubung: $error';
      noticeIsError = true;
      notifyListeners();
      if (!completer.isCompleted) completer.completeError(Exception('Tidak bisa terhubung ke server. Periksa URL dan koneksi internet.'));
    });
    socket.on('room_state', (data) {
      state = mapData(data);
      final code = mapData(state?['room'])['code']?.toString() ?? '';
      if (code.isNotEmpty) {
        roomCode = code;
        _prefs?.setString('room_code', code);
      }
      notifyListeners();
    });
    socket.on('action_error', (data) {
      final message = mapData(data)['message']?.toString() ?? 'Aksi gagal.';
      setNotice(message, error: true);
    });
    socket.on('session_replaced', (data) {
      setNotice(mapData(data)['message']?.toString() ?? 'Sesi dipindahkan ke perangkat lain.', error: true);
      socket.disconnect();
    });
    socket.connect();
    await completer.future.timeout(
      const Duration(seconds: 12),
      onTimeout: () => throw Exception('Waktu koneksi habis. Periksa alamat server dan pastikan server laptop aktif.'),
    );
  }

  Future<Map<String, dynamic>> _emitAck(String event, Map<String, dynamic> payload) async {
    final socket = _socket;
    if (socket == null || !socket.connected) throw Exception('Belum terhubung ke server.');
    final completer = Completer<Map<String, dynamic>>();
    socket.emitWithAck(event, payload, ack: (data) {
      if (completer.isCompleted) return;
      completer.complete(mapData(data));
    });
    return completer.future.timeout(const Duration(seconds: 12), onTimeout: () => throw Exception('Server tidak merespons.'));
  }

  Future<void> _connectAndRejoin() async {
    try {
      await _ensureConnected();
    } catch (error) {
      setNotice(error.toString().replaceFirst('Exception: ', ''), error: true);
    }
  }

  Future<void> createRoom({String gameMode = 'classic'}) async {
    await _performBusy(() async {
      await _ensureConnected();
      final result = await _emitAck('create_room', {
        'playerId': playerId,
        'name': nickname,
        'gameMode': gameMode,
      });
      _acceptJoinResult(result);
    });
  }

  Future<void> joinRoom(String code) async {
    await _performBusy(() async {
      await _ensureConnected();
      final result = await _emitAck('join_room', {
        'playerId': playerId,
        'name': nickname,
        'code': code.trim().toUpperCase(),
      });
      _acceptJoinResult(result);
    });
  }

  void _acceptJoinResult(Map<String, dynamic> result) {
    if (result['ok'] != true) throw Exception(result['error']?.toString() ?? 'Tidak bisa masuk ke room.');
    state = mapData(result['state']);
    roomCode = mapData(state?['room'])['code']?.toString() ?? '';
    _prefs?.setString('room_code', roomCode);
    setNotice('Berhasil masuk room $roomCode');
  }

  Future<void> _performBusy(Future<void> Function() action) async {
    if (busy) return;
    busy = true;
    notice = '';
    notifyListeners();
    try {
      await action();
    } catch (error) {
      setNotice(error.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void _send(String event, [Map<String, dynamic> payload = const {}]) {
    if (_socket == null || !_socket!.connected) {
      setNotice('Koneksi ke server terputus.', error: true);
      return;
    }
    _socket!.emitWithAck(event, payload, ack: (data) {
      final result = mapData(data);
      if (result['ok'] == false) setNotice(result['error']?.toString() ?? 'Aksi gagal.', error: true);
    });
  }

  void startGame() => _send('start_game');
  void drawCard() => _send('draw_card');
  void passTurn() => _send('pass_turn');
  void callUno() => _send('call_uno');
  void catchUno() => _send('catch_uno');
  void voteRematch({required bool playAgain}) => _send('vote_rematch', {'choice': playAgain ? 'yes' : 'no'});
  void playCard(String cardId, {String? chosenColor}) => _send('play_card', {
        'cardId': cardId,
        if (chosenColor != null) 'chosenColor': chosenColor,
      });

  Future<void> leaveRoom() async {
    if (_socket?.connected == true) {
      try {
        await _emitAck('leave_room', {});
      } catch (_) {
        // Keluar lokal tetap diizinkan jika koneksi sudah putus.
      }
    }
    roomCode = '';
    state = null;
    await _prefs?.remove('room_code');
    notice = 'Kamu keluar dari room.';
    noticeIsError = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _socket?.dispose();
    super.dispose();
  }
}
