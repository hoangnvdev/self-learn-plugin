# self-learn-plugin

`learning-coach` is a Claude Code plugin for busy software engineers. It helps you improve your English at work and learn software ideas in sessions of about 5 minutes, and saves your progress to a personal notebook repo.

It is in early use: the skills work, but details may change.

## Skills

| Command | What it does |
|---|---|
| `/learning-coach:english-at-work <text>` | Improves a PR description, commit message, Slack message or email, explains why, logs the correction and creates review cards |
| `/learning-coach:spaced-review [number]` | Quizzes you on the cards that are due |
| `/learning-coach:daily [topic]` | Runs a short session: up to 3 cards, 1 software idea and 1 English drill |

Skills run only when you type the command.

## Requirements

- Claude Code
- Node.js 18 or later
- Git
- GitHub CLI (`gh`), only for `english-at-work` on "this PR description"

## Set up

### 1. Create a notebook

The notebook is a separate Git repo on the `main` branch:

```bash
git init -b main ~/code/self-learn-english
mkdir ~/code/self-learn-english/vocab ~/code/self-learn-english/corrections
echo '{ "cards": [] }' > ~/code/self-learn-english/vocab/cards.json
touch ~/code/self-learn-english/profile.md
git -C ~/code/self-learn-english add .
git -C ~/code/self-learn-english commit -m "Create notebook"
```

On Windows, run these commands in Git Bash. Describe your goals, English level and tech stack in `profile.md`.

To keep the notebook elsewhere, set the `LEARNING_NOTEBOOK` environment variable to its path.

### 2. Install the plugin

Clone this repo, then run from its root:

```bash
claude plugin marketplace add ./
claude plugin install learning-coach@self-learn
```

Keep the clone where it is: the plugin loads from that folder.

## Privacy

The notebook stores text from your work. `english-at-work` is told to replace names, customers, internal URLs, ticket numbers and credentials with placeholders, but check what it saves. If the notebook has an `origin` remote, the skills push to it, so keep that remote private and follow your company's policy.

To turn the plugin off in a repo, add this to its `.claude/settings.local.json`:

```json
{ "enabledPlugins": { "learning-coach@self-learn": false } }
```

## Develop

```bash
node --test learning-coach/scripts/test/*.test.mjs
claude plugin validate ./learning-coach --strict
```

Apply edits with `/reload-plugins` or a new session.

- [Agreed design](docs/CONTEXT.md)
- [Usage and decisions](docs/STATUS.md)
