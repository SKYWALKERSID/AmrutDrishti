---
trigger: always_on
---

### Automatic `.gitignore` Management

- Inspect and maintain `.gitignore` whenever adding dependencies, frameworks, tools, generated files, datasets, model artifacts, or deployment configuration.
- Add appropriate exclusions for build outputs, caches, virtual environments, local IDE files, logs, secrets, and temporary files.
- Preserve existing rules and never overwrite `.gitignore` blindly.
- Never commit `.env` files, API keys, credentials, private datasets, or other sensitive information. Keep `.env.example` with placeholder values.
- Do not ignore source code, required configuration, lockfiles, migrations, or documentation needed for reproducible builds.
- Before every commit or push, inspect `git status` and review staged files for secrets, large artifacts, and unintended files.
- If a sensitive file is already tracked, adding it to `.gitignore` is insufficient. Remove it from Git tracking safely and rotate exposed credentials when necessary.
- Update `.gitignore` incrementally and explain significant changes in the development summary.
- Never claim the repository is secure merely because `.gitignore` exists.
