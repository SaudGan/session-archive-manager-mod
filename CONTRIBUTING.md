# 🤝 Contributing

Thanks for helping make Session Archive Manager better!

## 🐛 Report a bug or ask for a feature

[Open an issue](https://github.com/SaudGan/session-archive-manager-mod/issues/new/choose) and pick a template. Screenshots of the pane help a lot.

## 🛠️ Work on the code

1. Fork this repository and clone your fork.
2. Load your copy in a session:

   ```bash
   claude --plugin-dir /path/to/session-archive-manager-mod
   ```

3. Check the mod and run the tests before you open a pull request:

   ```bash
   claude plugin validate .
   claude plugin test .
   ```

## 📁 Where things are

| Path | What it holds |
|---|---|
| `hooks/register.tsx` | The pane, the `/sessions` command and the Apply logic |
| `types/index.d.ts` | The shape of the values the pane keeps |
| `tests/` | Automated tests |
| `.claude-plugin/` | The plugin and marketplace manifests |

## ✅ Pull request checklist

- The tests pass.
- New behavior has a test.
- The mod still never deletes a session.
