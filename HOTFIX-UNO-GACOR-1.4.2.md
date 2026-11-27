# UNO GACOR 1.4.2 — Flutter build and Dragon Revive hotfix

## Changes
- Replaced invalid `Colors.white80` with Flutter's supported `Colors.white70`.
- Moved `_showCardDescriptions` into `GameScreen`, where its button invokes it.
- Changed visible product branding from `UNO PARTY` to `UNO GACOR`.
- Kept the Dart package identifier `uno_party` unchanged so existing `package:uno_party/...` imports remain valid.
- Hardened Dragon Revive target validation so the card being played cannot be selected from discard as its own recovery target.
- Added a regression test: Dragon Revive as the last card wins, leaves the hand empty, and does not recover any card from discard.

## Validation
- `node --test` in `server`: 61 tests passed.
- Flutter/Dart SDK was not available in this environment, so an Android release build could not be run here.
- The supplied archive does not include the Android Gradle/Manifest scaffold; launcher-label configuration must be applied in the full Flutter Android project if present.
