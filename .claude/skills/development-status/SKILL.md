---
name: development-status
description: Load where this project's development stands. Use at the start of every new conversation in this repo, before the first reply, and when the user asks about progress or next steps, or when work changes the status.
---

# Development status

The logs in `${CLAUDE_PROJECT_DIR}/development-status/` carry the project from one conversation to the next. Git ignores that folder, so use direct paths: searches may skip it.

## At the start of a conversation

1. Read `${CLAUDE_PROJECT_DIR}/development-status/README.md`.
2. Read the file of the phase listed under "Right now". Read other phase files only if the request involves them.
3. If the request depends on the current state, check it against the real files: the log may be out of date. Trust the files and correct the log.
4. Tell the user in 2–3 lines which phase is active, how it is going and the next step. Then do what they asked. If they only greeted you, stop after the summary.

Follow "Working agreements" in the README. A next step in the log is information, not permission to start it.

If the folder is missing, say so and continue from `docs/CONTEXT.md` and `docs/STATUS.md`. Do not invent a history.

## When the status changes

Update the logs in the same turn, without being asked, when a task is finished, a decision is made, a bug is found or fixed, a test gives a new result, or the user reports on the trial.

- Phase file: update the task state, process, results, how it is going and next step. Keep problems and failed attempts. Mark proposals as not agreed until the user agrees.
- `README.md`: update the date, "Right now", the phase table, agreements and open questions. Keep it short.
- Record only what happened. Say what was not tested.
- Use absolute dates. Leave out secrets and confidential work text.
