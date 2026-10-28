# Session Archive Manager

A Claude Code mod that lists every Claude Code session on your computer, archived ones included, grouped by their sidebar section.

- Each session has an **ON/OFF toggle**. ON means shown in the sidebar, OFF means archived.
- Press **Apply** to archive or restore every session you flipped. A restored session goes back into its sidebar section.
- Each session shows a colored status: **Needs you** (red), **Done** (green) or **Not reviewed** (gray). Claude sets the status with the `set_session_status` tool the mod adds; ask Claude to review your sessions and it can fill them in.
- Click a section's name to open or close it. New sessions appear when you press **Refresh**.

Type `/sessions` to open it.

## Install

At the prompt of a terminal session:

```
/plugin install session-manager --marketplace SaudGandeh/session-archive-manager-mod
```

From a shell:

```
claude plugin install session-manager --marketplace SaudGandeh/session-archive-manager-mod
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `SaudGandeh/session-archive-manager-mod`, then Add plugin.

## Let Apply work in auto mode

In auto mode, Claude Code's safety check refuses actions that you didn't ask for in the chat, and a button press doesn't count. To let Apply work, add these three rules to `permissions.allow` in `~/.claude/settings.json`:

```json
"mcp__ccd_session_mgmt__archive_session",
"mcp__ccd_session_mgmt__unarchive_session",
"mcp__ccd_sidebar__move_sessions"
```

They allow archiving, restoring and moving sessions into sidebar sections. They never allow deleting. Without them, switch the chat to a mode that asks first, and click Allow on each change.

## License

MIT
