import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

import 'game_controller.dart';

class MusicManager extends ChangeNotifier {
  MusicManager(this._controller) {
    _controller.addListener(_handleStateChange);
  }

  final GameController _controller;
  final AudioPlayer _player = AudioPlayer();
  String _activeTrack = 'lobby_theme.wav';
  bool _muted = false;
  bool _ready = false;

  bool get muted => _muted;

  Future<void> initialize() async {
    try {
      await _player.setReleaseMode(ReleaseMode.loop);
      await _player.setVolume(0.32);
      _ready = true;
      await _playActiveTrack();
    } catch (_) {
      // Audio should never prevent the game from starting on unsupported devices.
    }
  }

  void _handleStateChange() {
    final state = _controller.state;
    final room = GameController.mapData(state?['room']);
    final players = (room['players'] as List? ?? [])
        .map((item) => GameController.mapData(item));
    final isPlaying = room['status'] == 'playing';
    final hasLowHand = players.any((player) {
      final count = player['cardCount'];
      return count is num && count > 0 && count <= 2;
    });

    final nextTrack = isPlaying
        ? (hasLowHand ? 'tension_theme.wav' : 'game_theme.wav')
        : 'lobby_theme.wav';
    if (nextTrack == _activeTrack) return;
    _activeTrack = nextTrack;
    if (!_muted && _ready) unawaited(_playActiveTrack());
    notifyListeners();
  }

  Future<void> _playActiveTrack() async {
    if (!_ready || _muted) return;
    try {
      await _player.stop();
      await _player.play(AssetSource('audio/$_activeTrack'));
    } catch (_) {
      // Keep gameplay available even if a device cannot play audio.
    }
  }

  Future<void> toggleMuted() async {
    _muted = !_muted;
    if (_muted) {
      await _player.stop();
    } else {
      await _playActiveTrack();
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _controller.removeListener(_handleStateChange);
    unawaited(_player.dispose());
    super.dispose();
  }
}
