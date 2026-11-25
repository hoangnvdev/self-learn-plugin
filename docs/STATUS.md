# Usage and decisions

Last updated: 2026-11-25. [CONTEXT.md](CONTEXT.md) is the agreed design; this file records how to use and develop what is built, and where it differs. Progress is logged in `development-status/`, which is local and ignored by git.

## Use

| Command | Purpose |
|---|---|
| `/learning-coach:english-at-work <text>` | Correct work text, log it, create cards |
| `/learning-coach:spaced-review [number]` | Review due cards |
| `/learning-coach:daily [topic]` | 5 minutes: up to 3 cards, 1 idea, 1 drill |

The notebook is `LEARNING_NOTEBOOK` if set, otherwise `~/code/self-learn-english`. The card script needs Node.js and Git.

To turn the plugin off in a sensitive repo, put this in its `.claude/settings.local.json`:

```json
{ "enabledPlugins": { "learning-coach@self-learn": false } }
```

## Develop

The plugin loads in place from this folder, so edits apply at the next session, or after `/reload-plugins`. Moving or renaming the folder breaks the install.

```bash
node --test learning-coach/scripts/test/*.test.mjs
claude plugin validate ./learning-coach --strict
```

To uninstall:

```bash
claude plugin uninstall learning-coach@self-learn
claude plugin marketplace remove self-learn
```

## Decisions

| Decision | Reason |
|---|---|
| Plugin in `learning-coach/`, marketplace at the repo root | Matches `--plugin-dir ./learning-coach`; the marketplace file must be at the root of the repo people add |
| Local marketplace in phase 1, not phase 3 | A user-scope install needs one |
| Review ladder of 1, 3, 7, 14, 30, 60 days | Simple and predictable. `good` moves up, `hard` repeats, `again` returns to 1 day. `ease` is kept unused, so SM-2 remains possible |
| A script sets dates and edits cards during reviews | Models make mistakes with date arithmetic and JSON |
| Notebook format is inside `english-at-work/SKILL.md` | Reading a separate plugin file asked for permission and blocked logging |
| `daily` records ideas in commit messages (`Daily: ...`) | Avoids repeats without another file |
| Sensitive details become placeholders before logging | The notebook holds work text |

## Differences from CONTEXT.md section 3

Checked against the Claude Code docs on 2026-11-25.

- `skillOverrides` does not apply to plugin skills. Use `enabledPlugins` or `/plugin`.
- `claude plugin details` counts manual-only skills in its always-on figure. Use `/skill-doctor` instead.
- Plugin agents also accept `autoCompactWindow`, `omitClaudeMd`, `color` and `experimental.cacheTtl`. `permissionMode`, `hooks`, `mcpServers` and `initialPrompt` are ignored. `isolation` can only be `worktree`.
- `disable-model-invocation` also stops a skill being preloaded into agents, so `examiner` and `curriculum-builder` cannot preload these skills.
- Plugins added to a claude.ai account stay on in cloud sessions.
- `userConfig` in `plugin.json` can ask each user for the notebook path.
