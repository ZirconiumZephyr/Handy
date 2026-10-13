# Consult

An independent medical consultation workspace forked from [Handy](https://github.com/cjpais/Handy).

**Development build: use synthetic consultations until native recording, drafting accuracy and Gentu transfer have been validated.**

Consult preserves Handy's local speech recognition engine and adds a clinical workspace with encrypted encounter storage, referral text import, editable notes and letters, two-stage local Ollama drafting, explicit review/filing states, and manual document transfer. Optional OpenMed integration provides a local de-identification preview.

- [Start here: opening the app](docs/START_HERE.md)
- [Development and setup](docs/DEVELOPMENT.md)
- [Scope, architecture and roadmap](docs/CLINICAL_ROADMAP.md)
- [Upstream Handy documentation](docs/HANDY_UPSTREAM.md)

Source is backed up to `origin` on GitHub. Clinical records, recordings, credentials and model weights must never be committed. Clinical data has its own encrypted backup/export workflow and is not backed up by Git.

Consult is not affiliated with or endorsed by Handy, OpenMed or Gentu. Handy code is MIT licensed; its upstream notices are retained in [LICENSE](LICENSE). Consult uses its own name and icons. OpenMed is a separate optional dependency; check the SDK and chosen model licences before distribution.
