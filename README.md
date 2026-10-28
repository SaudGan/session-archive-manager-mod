# Session Archive Manager

**Your Claude Code sessions, finally under control.**

Run Claude Code for a few weeks and your sidebar fills up. Finished tasks sit next to live ones, old experiments bury the work you need, and you can't tell at a glance which session still needs you. Session Archive Manager fixes that with one pane and one command.

Type `/sessions` and see every session you have, archived ones included, grouped exactly like your sidebar. Flip a toggle, press **Apply**, and the sessions are archived or brought back. Nothing is ever deleted.

## What you get

- **One list for every session.** Active and archived, in the same sections you already use. Open a section to see what's inside, close it to keep things tidy.
- **A toggle on every row.** ON means the session is shown in your sidebar. OFF means it's archived. One press of **Apply** makes all your changes at once.
- **Archived sessions stay in their section.** Archive a session now and you'll still find it under the right heading, ready to bring back whenever you want.
- **Restore to where it belongs.** A restored session goes back into its original sidebar section, not into a pile of ungrouped sessions.
- **Color-coded status.** **Needs you** (red), **Done** (green) or **Not reviewed** (gray), so you can tell at a glance what still needs your attention and what has served its purpose.
- **Claude fills in the statuses.** The mod adds a `set_session_status` tool. Ask Claude to review your sessions and it can mark each one for you.
- **Newest first.** Inside every section, your most recent sessions come first.

## How it fits your workflow

1. **Work as usual.** Start as many sessions as you like, for different projects or ideas.
2. **Run a review.** Ask Claude to look through your sessions and mark which are done and which still need you.
3. **Open `/sessions`.** Your sections are listed, with status colors showing where to look first.
4. **Clean up in seconds.** Turn OFF everything that's finished, then press **Apply**. Your sidebar is clear, and nothing is lost.
5. **Need one back?** Turn it ON and press **Apply**. It returns to its original section.

## Who it's for

- Anyone who runs many Claude Code sessions in parallel and loses track of them.
- People who organize sessions into sections and want archiving that respects that order.
- Teams and solo builders who want a calm sidebar without the fear of deleting something they might need.

## Safe by design

- It only archives, restores and moves sessions into sidebar sections. It never deletes a session.
- It reads your session list on your own computer. Nothing is sent anywhere else.
- Free and open source under the MIT license.

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

Then type `/sessions` to open the pane.

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
