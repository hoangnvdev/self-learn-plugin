# Learning Coach Plugin: Project Context

> Paste this into Claude Code (or save it in the repo as `docs/CONTEXT.md` and ask Claude Code to read it).
> It sums up a design discussion. Claude Code features change, so check the specific
> settings and frontmatter fields below against the current docs (https://code.claude.com/docs) before relying on them.

---

## 1. Goal

Build a Claude Code **plugin** ("learning-coach") that helps a busy software engineer:

- fill gaps in software development knowledge, and
- improve English used at work (PR descriptions, commit messages, Slack messages, emails),

in **short sessions (about 5 minutes)**, ideally **while doing real work**, not as a separate study routine.
Later the plugin will be **shared with teammates**.

## 2. Key decisions (already made)

1. **Plugin = several focused skills + a couple of sub-agents + slash entry points.** Not one giant skill.
   - Skills: reusable teaching methods (how to quiz, how to correct English, how to run a kata).
   - Sub-agents: separate, heavier work in their own context (curriculum research, unbiased grading).
   - Hooks: **none in v1** (they run on every matching event and would get in the way of normal work).
2. **Two repos:**
   - `learning-coach`: the plugin (later also the git marketplace). Shareable.
   - `self-learn-english`: a **private** personal "notebook" repo that stores learner progress.
3. **The repo is the notebook; the plugin lives everywhere you write.** The plugin is installed at **user scope**
   in VS Code so it's available in every work repo, and it always writes progress back to the notebook repo.
4. **Manual-only by default.** Learning skills use `disable-model-invocation: true` so they add **zero context**
   to normal work sessions and run only when typed (e.g. `/learning-coach:fix-english`).
   At most **one** skill may start automatically, with a very narrow description.
5. **Build and test locally in VS Code / terminal Claude Code**, not in Claude Code on the web.

## 3. Platform facts that shaped the design

- VS Code extension, terminal and desktop-app local sessions share the same settings files; a plugin installed at
  user scope in one is available in the others.
- **Claude Code on the web (cloud sessions) does NOT load** plugins installed on your own machine, nor plugins a
  repo turns on via `enabledPlugins` / `extraKnownMarketplaces` in `.claude/settings.json`. `/plugin` isn't available there.
- Cloud sessions **do** load anything committed to the repo: `CLAUDE.md`, `.claude/skills/`, `.claude/agents/`,
  `.claude/commands/`, and hooks in `.claude/settings.json` (single-repo sessions). Skills enabled on the claude.ai
  account also load. Org-distributed plugins come through server-managed settings.
- User-level `~/.claude/...` config does NOT carry over to cloud sessions, and each cloud session starts from a fresh VM.
  So **learner progress must live in a git repo**, not in `~/.learning/`.
- Cloud sessions usually push to a new branch, so progress can spread across branches. Have skills commit progress
  to `main` in the notebook repo, or only update progress from local sessions.
- Project-scope plugin install: committing `enabledPlugins` turns it on for collaborators but each one still runs
  `claude plugin install <name>@<marketplace> --scope project` once.

### Skill loading and context cost

| Frontmatter | User can invoke | Claude can invoke | Description always in context |
|---|---|---|---|
| (default) | yes | yes | yes |
| `disable-model-invocation: true` | yes | no | **no** |
| `user-invocable: false` | no | yes | yes |

- Only descriptions are always loaded; the full SKILL.md loads when invoked and then stays in context.
- `description` + `when_to_use` are truncated at **1,536 characters**: put the key use case first.
- Keep each `SKILL.md` **under ~500 lines**; move detail into supporting files loaded on demand.
- `skillOverrides` can set a skill to `"name-only"` or `"off"` without editing it.
- `/skill-doctor` shows each skill's context cost and usage; `claude plugin details <name>` shows a plugin's always-on token cost.
- Plugin manifest supports `defaultEnabled: false` (installs switched off).
- Plugin agent frontmatter supports: `name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, isolation`.
- Load a plugin for one session without installing: `claude --plugin-dir ./learning-coach`. Apply edits with `/reload-plugins`.

## 4. Architecture

### 4.1 Plugin repo: `learning-coach/`

```
learning-coach/
├── .claude-plugin/
│   ├── plugin.json            # name, version, description, (defaultEnabled: false when shared)
│   └── marketplace.json       # added in phase 3 so teammates can install from this repo
├── skills/
│   ├── learning-router/       # works out what the learner needs, sends them to a sub-skill
│   ├── gap-assessment/        # diagnostic questions → writes skill-map.md
│   ├── socratic-tutor/        # explains by asking (system design, concurrency, ...), short exchanges
│   ├── code-kata/             # small practice tasks at the learner's level, in their stack
│   ├── spaced-review/         # flashcards + review schedule from mistakes
│   ├── english-at-work/       # rewrites PR/commit/Slack/email text, explains WHY, logs corrections
│   ├── vocab-from-context/    # turns phrases from real work into review cards
│   └── daily/                 # 5-min session: 3 due cards + 1 new idea + 1 English drill
├── agents/
│   ├── curriculum-builder.md  # researches docs, writes a week-by-week plan
│   └── examiner.md            # grades quiz answers WITHOUT access to the tutor's hints
└── README.md
```

Entry points are skills with `disable-model-invocation: true` (they show up as `/learning-coach:<skill>`),
so a separate `commands/` folder isn't needed.

| Skill | Invocation | Notes |
|---|---|---|
| `daily` | manual only | main habit loop |
| `english-at-work` (`/fix-english` style) | manual only | paste text or point at the last commit/PR |
| `spaced-review` | manual only | |
| `socratic-tutor` | manual only | |
| `code-kata` | manual only | |
| `gap-assessment` | manual only | run on first use, then occasionally |
| `vocab-from-context` | manual only, or the single auto skill | if auto: description = "Only when the user explicitly asks to check or improve English wording." |
| `learning-router` | manual only | `/learning-coach:learn <topic>` |

Example frontmatter:

```yaml
---
name: daily
description: 5-minute English and dev micro-lesson with flashcard review. Use when the user runs /daily.
disable-model-invocation: true
---
```

### 4.2 Notebook repo: `self-learn-english/` (private)

```
self-learn-english/
├── CLAUDE.md                 # "You are my learning coach. Always log progress to this repo." + coaching style
├── .claude/skills/           # copy of core skills, so Claude Code on the web works without installing anything
├── profile.md                # goals, English level, tech stack, weak spots, time available per day
├── skill-map.md              # dev knowledge gaps (written by gap-assessment)
├── vocab/cards.json          # spaced-repetition queue: front, back, example, due date, interval, ease
└── corrections/YYYY-MM.md    # every correction: original → improved → why → phrase to remember
```

The plugin's skills need to know where the notebook lives (e.g. a configured path such as
`~/code/self-learn-english`, or an env var like `LEARNING_NOTEBOOK`). When a skill runs from a work repo, it
reads and writes there, then commits (and pushes) to `main`.

## 5. Rules that keep normal work clean

1. All learning skills are manual-only (`disable-model-invocation: true`).
2. At most one auto-triggering skill, with a narrow description.
3. No hooks in v1. If added later, each hook first checks a switch (e.g. only runs when `ENGLISH_COACH=on`).
4. To turn the plugin off in a sensitive work repo, set it to `false` under `enabledPlugins` in that repo's
   `.claude/settings.local.json` (not committed).
5. Check regularly with `/skill-doctor` and `claude plugin details learning-coach`.

## 6. Other concerns

- **Privacy:** the English coach sees real work text. Keep the notebook repo private; check team/company
  policy before logging work content.
- **Accuracy:** AI tutors can be confidently wrong. The tutor should point to official docs for anything the
  learner will rely on.
- **Model choice:** `/model` works on every surface. Use a strong model (e.g. Opus) for explanations and nuance,
  a faster one for flashcard drills; can later be set per agent via the `model` frontmatter.
- **Skill descriptions must not overlap**, or Claude picks the wrong one. Ambiguous requests go to the router.

## 7. Roadmap

| Phase | What | Done when |
|---|---|---|
| 1. Personal skills | `plugin.json` + `english-at-work`, `spaced-review`, `daily`; notebook repo with `profile.md`, `CLAUDE.md`, `vocab/cards.json`, `corrections/` | used daily for 1–2 weeks and actually useful |
| 2. State + agents | define the card schema and spaced-repetition intervals; add `gap-assessment`, `socratic-tutor`, `code-kata`, `curriculum-builder`, `examiner` | progress survives across sessions/devices; reviews come due correctly |
| 3. Package | add `marketplace.json`, README, versioning; make everything personal configurable (path, stack, level) | a teammate installs with `/plugin marketplace add <org>/learning-coach` + `/plugin install` |
| 4. Share | git marketplace for VS Code/terminal users; claude.ai org plugin library (if on a Team/Enterprise plan) for web + chat; `defaultEnabled: false` | teammates opt in; no one's work sessions get noisier |

## 8. First tasks for Claude Code (phase 1)

1. Scaffold `learning-coach/` with `.claude-plugin/plugin.json` and the `skills/english-at-work/SKILL.md` skill (manual-only).
   - Input: pasted text, or "my last commit message" / "this PR description".
   - Output: improved version, 1–3 short "why" notes (grammar/tone/clarity), 1–2 phrases worth remembering.
   - Side effect: append to `corrections/YYYY-MM.md` and add phrases to `vocab/cards.json` in the notebook repo.
2. Scaffold `self-learn-english/` with `CLAUDE.md`, `profile.md` (template with questions to fill in), an empty
   `vocab/cards.json` with a documented schema, and `corrections/`.
3. Add `skills/spaced-review/` (review due cards, update interval/due date, commit) and `skills/daily/`.
4. Test with `claude --plugin-dir ./learning-coach`, iterate with `/reload-plugins`, check cost with `/skill-doctor`.
5. Then install at user scope and use it from real work repos.

## 9. Open questions

- Is the team on a Claude Team/Enterprise plan? (Decides whether the org plugin library is the main sharing route.)
- Notebook location convention for teammates (fixed path vs env var).
- Card schema details and spaced-repetition algorithm (simple Leitner boxes vs SM-2).
