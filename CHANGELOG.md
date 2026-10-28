# Changelog

All notable changes to this project are listed here.

## [0.3.0] - 2026-10-28

### Changed

- 🔘 **Claude-style switches.** On the desktop each session has a smooth rounded switch with a round knob and an ON or OFF label, orange when on and gray when off.
- 🟠 **Apply lights up.** Apply turns orange the moment a change is waiting, and goes quiet gray at zero.
- ✨ **Refresh on hover.** Refresh is the same size as Apply and turns orange under the mouse.
- 🖥️ **Section names match the sidebar.** Sessions with no section now sit under **This Computer**, as in the sidebar.

### Added

- 📱 **Remote Control sessions.** Sessions you run on claude.ai or your phone show in their own **Remote Control** section, with online or offline. Local sessions with Remote Control on get an orange label.
- 🔒 **The current session is listed** and marked "This session". It has no switch, so you can't archive the session you are working in.

## [0.2.0] - 2026-10-28

### Changed

- 🔘 The ON/OFF toggle is now a real pill, drawn by the mod itself: a filled orange pill with white "ON ●" when a session is shown, a dim gray pill with "● OFF" when it is archived, just like the preview picture. It brightens under the mouse, and one click flips it.

## [0.1.1] - 2026-10-28

### Changed

- 🎨 The pane now looks like the pictures on this page: each session sits in its own rounded card, with its title in medium weight and a small colored status under it, and the toggle pill on the right. Cards light up when you hover over them.
- 🎨 Status colors follow your Claude theme (error red, success green, inactive gray) instead of fixed terminal colors.

## [0.1.0] - 2026-10-28

### Added

- 📋 The `/sessions` pane lists every session, archived ones included, grouped like the sidebar.
- 🔘 An ON/OFF toggle on every row, applied together with one **Apply** button.
- 📁 Archived sessions stay under their section, and restored ones go back into it.
- 🚦 Color-coded status: Needs you, Done and Not reviewed.
- 🤖 A `set_session_status` tool so Claude can mark each session.
- ✅ 14 automated tests covering the pane in the terminal and desktop surfaces.

[0.3.0]: https://github.com/SaudGan/session-archive-manager-mod/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/SaudGan/session-archive-manager-mod/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/SaudGan/session-archive-manager-mod/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/SaudGan/session-archive-manager-mod/releases/tag/v0.1.0
