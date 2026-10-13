# Consult development

## Repository and builds

- Fork: https://github.com/ZirconiumZephyr/Handy
- Development branch: `feat/consultation-workspace`
- Upstream remote: `https://github.com/cjpais/Handy.git`
- Baseline: `14ae9c6b42d729371c443c8617ad02c89c4c8061`
- Desktop identity: `au.com.zirconiumzephyr.consult`

Use npm with the committed package-lock.json for this fork. Original Handy supports Bun; do not mix lockfile updates when maintaining Consult.

```sh
npm ci --ignore-scripts
npm run tauri -- dev
```

The repository already includes its VAD model. Build the local macOS application:

```sh
npm run tauri -- build --debug --bundles app
```

The app bundle is created at `src-tauri/target/debug/bundle/macos/Consult.app`. This is an unsigned development build, not a signed/notarised clinical release. Existing Handy settings and models are not migrated into Consult's separate application directory. Choose/download a transcription model in the inherited onboarding UI.

For a browser preview without microphone or native inference:

```sh
npm run dev
```

Open `http://localhost:1420/consult-preview.html`. Browser and desktop previews have different storage origins; use encrypted export/restore to transfer synthetic test records.

## Local drafting

Install/run Ollama and install a model suitable for the machine. Consult calls only `http://127.0.0.1:11434/api/show` and `/api/chat`, disables redirects and proxy routing, and rejects models marked `:cloud` or reporting a remote host. Keep Ollama configured for local-only operation. No model is downloaded by Consult's drafting feature.

Enter the exact installed model name in the encounter. The first request extracts supported clinical facts and the second produces JSON with `note` and `letter` fields. Invalid responses preserve existing drafts. There is a five-minute request timeout. Generation currently replaces both document drafts; preserve any edits you need before regenerating. There is no source-span UI or automatic clinical correctness guarantee.

This development machine has Ollama installed but no inference models installed at the time of the initial build. Real inference performance and clinical fidelity require a subsequent model/hardware validation run.

## Optional local OpenMed

Create a separate Python environment outside tracked source data. Install OpenMed's Hugging Face extra and download an appropriate PII model **before** working with patient text. This setup is intentionally not automatic: Python dependencies and model weights can be large and require licence/version review.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install 'openmed[hf]'
```

Point the worker to the downloaded model directory:

```sh
CONSULT_OPENMED_MODEL=/absolute/path/to/local/pii-model .venv/bin/python scripts/clinical/openmed_worker.py
```

The worker binds only to `127.0.0.1:8766`, disables Hugging Face/Transformers online loading, rejects browser Origin requests, and suppresses request logging. Consult invokes it through Rust with proxies and redirects disabled. It returns a masking preview, never sends data to a cloud model, and does not insert redacted text into the patient documents. Australian identifier recall, clinical context preservation and the real model runtime still require validation. No Python model dependency is bundled into the macOS app yet.

## Records and backups

The clinical workspace uses AES-256-GCM, random nonces and a PBKDF2-SHA256 passphrase-derived key (600,000 iterations). Only the encrypted envelope is written to WebView local storage. The passphrase and key are held in memory while unlocked. Losing the passphrase means losing access; there is no recovery key.

Use **Encrypted backup** regularly, and restore from the lock screen with its original passphrase. Restore replaces the current local vault only after successful decryption. Keep a separate backup of the current vault before restoring an older one. Backups are manual, not automatic off-device copies. Browser storage limits apply, and this vault design is a single-device prototype rather than an enterprise database.

Native transcription now emits text to the active encounter without creating WAV files, writing plaintext transcript history, running upstream post-processing, or automatically pasting. Recordings are held in memory and cannot be replayed after transcription. A crash during recording can therefore lose that recording. Text diagnostics are redacted in debug and release builds.

Recording through inherited global shortcuts without an active workspace recording target is discarded rather than assigned to whichever patient happens to be open. Use the workspace Record button for encounter capture. Closing/locking/changing patients is blocked during recording or pending workspace operations; the unlocked workspace remains mounted when visiting settings. Idle lock occurs after ten minutes without activity, when saving/recording/drafting have finished.

HTML export and clipboard copying create plaintext outside the encrypted vault. Clipboard history, external exports and Gentu must be managed separately. A copied document is not automatically marked as filed.

## Verification

```sh
npm run build
npm run lint
npx playwright install chromium
npx playwright test tests/clinical.spec.ts --reporter=list
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --no-default-features
```

The browser tests exercise encrypted persistence, incorrect-passphrase rejection, patient separation, review state invalidation, backup restore and HTML escaping. Browser tests do not exercise macOS microphone permissions, a real speech model, real Ollama/OpenMed inference, telehealth or Gentu paste rendering. Those require separate hands-on acceptance checks.

## Git backup workflow

Commit source changes using conventional commit messages and push the development branch to `origin`. Use `upstream` only to fetch original Handy changes. Do not push this clinical fork's changes upstream without a separate decision.

The ignore rules exclude environment secrets, clinical runtime directories, encrypted exports, databases, recordings, Python environments and model weights. Review `git diff --cached` before pushing; ignore rules are not a complete sensitive-data scanner. Use synthetic examples in code, tests, issues and screenshots.

## Development binding generation

Packaged debug apps do not export source bindings during startup. To explicitly regenerate them during development, run `CONSULT_EXPORT_BINDINGS=1 npm run tauri -- dev`. The export uses an absolute source path and failures are nonfatal.
