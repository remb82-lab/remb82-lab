# Codex Bootstrap — remb82-lab

Updated: 2026-09-23

This is the zero-context entry point for Codex.

## Identity

- GitHub owner/login: `remb82-lab`
- Public profile repository: `remb82-lab/remb82-lab`
- Central private control repository: `remb82-lab/AI-Software-Factory`
- Current full-context handoff: draft PR `remb82-lab/AI-Software-Factory#90`

## First-run procedure on Windows

1. Verify GitHub CLI exists:

```powershell
gh --version
```

If missing:

```powershell
winget install --id GitHub.cli -e
```

2. Verify authentication:

```powershell
gh auth status
```

If not authenticated, run:

```powershell
gh auth login
```

Use the GitHub account that owns or can access `remb82-lab` private repositories. Never paste tokens into source files or chat logs if browser/device authentication is available.

3. Verify access to the Factory repository:

```powershell
gh repo view remb82-lab/AI-Software-Factory
```

4. Clone the central Factory repository if not already present:

```powershell
gh repo clone remb82-lab/AI-Software-Factory
cd AI-Software-Factory
```

If already cloned:

```powershell
cd <path-to-AI-Software-Factory>
git fetch --all --prune
```

5. Fetch the current global Codex handoff from PR #90 without merging it:

```powershell
gh pr checkout 90
```

6. Read in this exact order:

```text
CODEX_START_HERE.md
docs/CODEX_GLOBAL_CONTEXT_20260923.md
README.md
factory/registry/projects.json
```

7. Then return to the repository/branch required for the actual task. The global handoff is background context only; current GitHub state and Factory Gateway/PostgreSQL are the source of live truth.

## Important operating rules

- Do not assume similarly named repositories are the same project.
- `remb82-lab/tikgameapp` is quarantined and must never be auto-associated with `TikGame-Engine-APP`.
- Do not commit secrets, tokens, passwords, SSH keys, Android keystores or `.env` values.
- Do not write directly to managed-project `main` by default.
- Do not merge, release, deploy, enable production or expand privileges without the applicable explicit authorization/gate.
- CI PASS does not replace required physical/device/user QA.

## Core repositories Codex should know exist

Factory/orchestration:
- `remb82-lab/AI-Software-Factory`
- `remb82-lab/DigitalProductFactory`
- `remb82-lab/ai_zavod_studio`
- `remb82-lab/Lab-Dash`

Major products:
- `remb82-lab/Home-Kitchen`
- `remb82-lab/Home-Kitchen-Client`
- `remb82-lab/BY-Auto-Inspector`
- `remb82-lab/NailFlow`
- `remb82-lab/Stretch-Ceiling-Calculator`
- `remb82-lab/TikGame-Engine-APP`
- `remb82-lab/TikGame-Engine-Demo`
- `remb82-lab/TikTok-Interactive-Battle-Studio`

Reusable skills/kits:
- `remb82-lab/Telegram-Bot-Factory`
- `remb82-lab/rb-payments-kit`
- `remb82-lab/Website-Design-Skill`
- `remb82-lab/Capacitor-Mobile-Skill`
- `remb82-lab/Server-VPS-Skill`

The full project map, architecture, historical decisions, machine/VPS context and workflow rules are in PR #90 of `AI-Software-Factory`.
