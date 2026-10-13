# Open Consult

## The easy way

1. In Finder, open `/Users/jamesthomas/Projects/medical-letters/Handy`.
2. Double-click **Start Consult.command**. A Terminal window may appear briefly. It launches Consult with its Dock icon available.
3. Look for a window titled **Consult**. If it is behind another window, click the teal pulse icon in the Dock.

You can also open the app directly: Finder → the project folder → `src-tauri` → `target` → `debug` → `bundle` → `macos` → **Consult.app**.

## First launch: Permissions Required

- **Microphone Access:** if it says **Granted**, leave it alone. Otherwise use its permission button and approve the macOS microphone request.
- **Accessibility Access:** click **Grant Permission**. In macOS System Settings → Privacy & Security → Accessibility, enable **Consult** if you choose to allow it. This inherited Handy permission allows keyboard shortcuts and typing into other apps; Consult currently retains the upstream setup gate even though clinical output is copied manually.
- Return to Consult. If the permission status does not refresh, quit Consult with Command-Q, then double-click **Start Consult.command** again.

Once permissions are recognised, the next screen lets you download/select a speech transcription model. That one-time model download needs internet access. It is separate from the model used to write letters.

## Open the consultation workspace

1. Select **Consultations** in the left sidebar if it is not already selected.
2. Create your own workspace passphrase, at least 12 characters long, and click **Unlock / create workspace**. Keep the passphrase safe; it cannot be recovered.
3. Click **New consultation**. Start with a fictional patient.
4. Enter name, date of birth and a patient identifier.
5. For a recording, confirm consent and click **Record consultation**, then **Stop recording** when finished. Wait for the transcript.
6. Alternatively, paste synthetic text into **Consultation transcript** to test editing and export without recording.

## Letter writing needs a second model

Ollama is installed on this Mac, but no Ollama drafting models were installed at the initial build. You can edit and export documents without one. Automatic drafting requires an installed local model and a running Ollama service. See [DEVELOPMENT.md](DEVELOPMENT.md) for this setup; downloading a Handy speech model does not enable letter generation.

OpenMed is also an optional separately configured local service. It is not required to open Consult or edit documents.

## If you still see no window

1. Check the Dock for **Consult** and click it.
2. Quit Consult with Command-Q if you can see its menu, then run **Start Consult.command** again.
3. If the launcher reports that the app is missing, rebuild it from the project folder with `npm run tauri -- build --debug --bundles app`.
4. If macOS displays a security or permission message, read it before proceeding. This is a locally built development app, not a notarised release.

Use fictional data while validating this development version. Git backs up source code; **Encrypted backup** inside Consult backs up your local consultation records separately.
