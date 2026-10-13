# Consultation workspace scope and roadmap

## Initial implementation

This is the first development foundation, not the completed consultation system.

- Independent Consult branding, native icons, app identity and window layout.
- Handy's audio capture/VAD/transcription retained; output routing changed to avoid unencrypted history and automatic paste.
- Patient identity, encounter date and consent, with explicit encounter recording target.
- Local encrypted encounter vault with lock and manual encrypted backup/restore.
- Referral text import/paste, transcript editor and clinician additions.
- Two-stage local Ollama drafting, editable clinical note and letter, HTML/plain clipboard output and HTML export.
- Draft → reviewed → filed states; source/document edits invalidate review.
- Optional local OpenMed masking preview; no cloud inference.

## Architecture

Tauri/Rust continues to own microphone capture and speech inference. React owns the consultation workspace. Browser WebCrypto encrypts the workspace before persistence. Native Rust commands provide fixed loopback access to Ollama and the optional Python OpenMed worker. Patient demographics remain outside the LLM prompt. Model-produced document HTML is never accepted: exports escape plain text and apply deterministic paragraph styling.

The patient ID is entered manually; Gentu matching is not automated. Source data are labelled as referral/transcript/clinician additions for extraction, but the current drafting model does not return validated source spans. Clinician verification remains essential.

## Next acceptance work

1. Test macOS onboarding, microphone start/stop, cancel, device loss and representative long consultations using synthetic audio. Ensure the stop-to-transcript path works reliably, including silence and processing errors.
2. Choose a local drafting model based on this Mac's memory and measured fidelity/latency. Validate negatives, drug doses, attribution, clinical uncertainty, laterality and chronology.
3. Test HTML and plain text paste in the actual Gentu editor and establish the preferred letter template.
4. Validate OpenMed with local model weights, Australian direct identifiers and indirect identifying contexts. Add Australian rules and known-patient-identifier matching. Do not enable cloud processing merely because the preview looks anonymised.
5. Replace the encrypted WebView vault with an encrypted native database/keychain-backed storage, recovery and retention strategy before broader deployment. Consider audio recovery only with protected storage and an explicit retention policy.

## Later features

- Referral PDF extraction/OCR with page/source references.
- Structured facts editor, source-span references, contradiction review and document revision history.
- Configurable specialty templates and demographic/recipient headers inserted locally.
- Appointment imports and appointment display; authorised Gentu synchronisation only if access is available.
- Reviewed longitudinal patient summaries linked to source encounters, without silently propagating old errors.
- Separate microphone and remote audio capture for telehealth, with tested speaker attribution.
- Packaged OpenMed runtime, local clinical entity extraction and a measured identifier test suite.
- Optional cloud drafting only after a complete privacy assessment, outbound preview, tested de-identification and explicit user selection.
- Signed/notarised releases, security review, audit events, recovery and clinical validation before routine use or distribution.

Gentu's public developer page currently limits API access to Marketplace partners and excludes custom practice integrations. Appointment/letter API work is therefore a dependency, not part of this build's promised capabilities: https://www.magentus.com/practice-management/developer-partners/
