import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Activity, FileText, LockKeyhole, Plus, Mic } from "lucide-react";
import { draftDocuments } from "./drafting";
import {
  documentHtml,
  encryptedBackup,
  newEncounter,
  saveVault,
  unlockVault,
  type Encounter,
  type Workspace,
} from "./vault";
import "./clinical.css";

export default function ConsultationWorkspace() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [restore, setRestore] = useState<string | undefined>();
  const [redacted, setRedacted] = useState("");
  const [vault, setVault] = useState<Awaited<
    ReturnType<typeof unlockVault>
  > | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>({ encounters: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState<"note" | "letter">("letter");
  const [model, setModel] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  const target = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const encounter = workspace.encounters.find((e) => e.id === selected);
  const active = useRef(vault);
  active.current = vault;

  useEffect(() => {
    if (!vault) return;
    const currentRevision = ++revision.current;
    setUnsaved(true);
    // Serialize writes so slower encryption cannot overwrite newer edits.
    queue.current = queue.current
      .catch(() => {})
      .then(() => saveVault(workspace, vault.key, vault.salt))
      .then(() => {
        if (currentRevision === revision.current) setUnsaved(false);
      })
      .catch(() => {
        setMessage(t("clinical.saveFailed"));
        setUnsaved(true);
      });
  }, [workspace, vault, t]);

  useEffect(() => {
    if (!isTauri()) return;
    const listeners = [
      listen<string>("clinical-transcript", (event) => {
        const id = target.current;
        if (active.current && id)
          setWorkspace((w) => ({
            encounters: w.encounters.map((e) =>
              e.id === id
                ? {
                    ...e,
                    transcript: [e.transcript, event.payload]
                      .filter(Boolean)
                      .join("\n\n"),
                    status: "draft",
                  }
                : e,
            ),
          }));
        else setMessage(t("clinical.unassigned"));
        target.current = null;
        setPending(false);
        setRecording(false);
      }),
      listen("clinical-finished", () => {
        target.current = null;
        setPending(false);
        setRecording(false);
      }),
      listen("recording-error", () => {
        target.current = null;
        setPending(false);
        setRecording(false);
      }),
      listen("transcription-error", () => {
        target.current = null;
        setPending(false);
        setRecording(false);
      }),
    ];
    const interval = window.setInterval(() => {
      invoke<boolean>("clinical_is_recording")
        .then(setRecording)
        .catch(() => {});
    }, 500);
    return () => {
      clearInterval(interval);
      listeners.forEach((p) => {
        void p.then((fn) => fn());
      });
    };
  }, [t]);

  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (unsaved || recording || pending || busy) event.preventDefault();
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [unsaved, recording, pending, busy]);

  useEffect(() => {
    if (!vault) return;
    let lastActivity = Date.now();
    const activity = () => {
      lastActivity = Date.now();
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    const timer = window.setInterval(() => {
      if (
        Date.now() - lastActivity > 10 * 60 * 1000 &&
        !busy &&
        !recording &&
        !pending &&
        !unsaved
      ) {
        setVault(null);
        setWorkspace({ encounters: [] });
        setSelected(null);
        setRedacted("");
        setMessage(t("clinical.idleLocked"));
      }
    }, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
    };
  }, [vault, busy, recording, pending, unsaved, t]);

  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = import("@tauri-apps/api/window").then(
      ({ getCurrentWindow }) =>
        getCurrentWindow().onCloseRequested((event) => {
          if (unsaved || busy || pending || recording) {
            event.preventDefault();
            setMessage(t("clinical.waitBeforeClose"));
          }
        }),
    );
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [unsaved, busy, pending, recording, t]);

  function patch(values: Partial<Encounter>) {
    setRedacted("");
    setWorkspace((w) => ({
      encounters: w.encounters.map((e) =>
        e.id === selected
          ? { ...e, ...values, status: values.status ?? "draft" }
          : e,
      ),
    }));
  }
  async function unlock() {
    setBusy(true);
    setMessage("");
    try {
      const result = await unlockVault(password, restore);
      setWorkspace(result.workspace);
      setSelected(result.workspace.encounters[0]?.id ?? null);
      setVault(result);
      setPassword("");
      setRestore(undefined);
    } catch {
      setMessage(t("clinical.unlockFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function toggleRecording() {
    if (
      !encounter?.consent ||
      !encounter.name ||
      !encounter.dob ||
      !encounter.patientId
    ) {
      setMessage(t("clinical.identityRequired"));
      return;
    }
    try {
      if (!recording) {
        target.current = encounter.id;
        setPending(true);
      }
      await invoke("clinical_toggle_recording");
      setMessage(t(recording ? "clinical.processing" : "clinical.starting"));
    } catch {
      target.current = null;
      setPending(false);
      setMessage(t("clinical.desktopRequired"));
    }
  }
  async function generate() {
    if (!encounter || !encounter.transcript.trim() || !model.trim()) {
      setMessage(t("clinical.sourceRequired"));
      return;
    }
    const id = encounter.id;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setMessage(t("clinical.generating"));
    try {
      const result = await draftDocuments(
        encounter,
        model.trim(),
        controller.signal,
      );
      setWorkspace((w) => ({
        encounters: w.encounters.map((e) =>
          e.id === id ? { ...e, ...result, status: "draft" } : e,
        ),
      }));
      setMessage(t("clinical.generated"));
    } catch {
      setMessage(t("clinical.generateFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function copy(formatted: boolean) {
    if (!encounter) return;
    try {
      if (formatted)
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([documentHtml(encounter[tab])], {
              type: "text/html",
            }),
            "text/plain": new Blob([encounter[tab]], { type: "text/plain" }),
          }),
        ]);
      else await navigator.clipboard.writeText(encounter[tab]);
      setMessage(t("clinical.copied"));
    } catch {
      setMessage(t("clinical.copyFailed"));
    }
  }
  function download(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const field = (key: "name" | "dob" | "patientId" | "date", type = "text") => (
    <label>
      {t(`clinical.${key}`)}
      <input
        type={type}
        value={encounter?.[key] ?? ""}
        disabled={busy || pending || recording}
        onChange={(e) => patch({ [key]: e.target.value })}
      />
    </label>
  );

  if (!vault)
    return (
      <main className="consult lock-screen">
        <div className="vault-card">
          <Activity size={34} />
          <h1>{t("clinical.brand")}</h1>
          <p>{t("clinical.tagline")}</p>
          <h2>{t("clinical.unlockTitle")}</h2>
          <p>{t("clinical.vaultHelp")}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void unlock();
            }}
          >
            <label>
              {t("clinical.passphrase")}
              <input
                autoFocus
                type="password"
                minLength={12}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button disabled={busy}>{t("clinical.unlock")}</button>
          </form>
          <label>
            {t("clinical.restore")}
            <input
              type="file"
              accept=".consult-vault"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setRestore(await file.text());
                  setMessage(t("clinical.restoreHelp"));
                }
              }}
            />
          </label>
          <p role="status">{message}</p>
          <small>{t("clinical.prototype")}</small>
        </div>
      </main>
    );

  return (
    <main className="consult">
      <header>
        <div className="brand">
          <Activity />
          <div>
            <h1>{t("clinical.brand")}</h1>
            <span>{t("clinical.tagline")}</span>
          </div>
        </div>
        <div className="header-actions">
          <span>{t(unsaved ? "clinical.saving" : "clinical.saved")}</span>
          <button
            disabled={unsaved || busy || recording || pending}
            onClick={async () => {
              await queue.current;
              download(
                encryptedBackup(),
                `consult-${new Date().toISOString().slice(0, 10)}.consult-vault`,
                "application/json",
              );
            }}
          >
            {t("clinical.backup")}
          </button>
          <button
            disabled={unsaved || busy || recording || pending}
            onClick={async () => {
              await queue.current;
              abort.current?.abort();
              setVault(null);
              setWorkspace({ encounters: [] });
              setSelected(null);
            }}
          >
            <LockKeyhole size={16} />
            {t("clinical.lock")}
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside>
          <h2>{t("clinical.consultations")}</h2>
          <button
            disabled={busy || recording || pending}
            onClick={() => {
              const e = newEncounter();
              setWorkspace((w) => ({ encounters: [...w.encounters, e] }));
              setSelected(e.id);
            }}
          >
            <Plus size={16} />
            {t("clinical.new")}
          </button>
          <nav>
            {workspace.encounters.map((e) => (
              <button
                disabled={busy || recording || pending}
                className={e.id === selected ? "selected" : ""}
                key={e.id}
                onClick={() => {
                  setSelected(e.id);
                  setRedacted("");
                }}
              >
                <strong>{e.name || t("clinical.unnamed")}</strong>
                <span>
                  {e.date} · {t(`clinical.${e.status}`)}
                </span>
              </button>
            ))}
          </nav>
          <small>{t("clinical.gentuHelp")}</small>
        </aside>
        {!encounter ? (
          <section className="empty">
            <FileText size={40} />
            <h2>{t("clinical.empty")}</h2>
            <p>{t("clinical.emptyHelp")}</p>
          </section>
        ) : (
          <section className="encounter">
            <div className="patient-banner">
              {field("name")}
              {field("dob", "date")}
              {field("patientId")}
              {field("date", "date")}
            </div>
            <div className="record-controls">
              <label>
                <input
                  type="checkbox"
                  checked={encounter.consent}
                  disabled={pending || recording || busy}
                  onChange={(e) => patch({ consent: e.target.checked })}
                />
                {t("clinical.consent")}
              </label>
              <button
                className={recording ? "recording" : "primary"}
                disabled={busy || (pending && !recording)}
                onClick={() => void toggleRecording()}
              >
                <Mic size={17} />
                {t(
                  recording
                    ? "clinical.stop"
                    : pending
                      ? "clinical.processing"
                      : "clinical.record",
                )}
              </button>
            </div>
            <div className="columns">
              <section className="sources">
                <h2>{t("clinical.sources")}</h2>
                <label>
                  {t("clinical.referral")}
                  <textarea
                    disabled={busy}
                    aria-label={t("clinical.referral")}
                    value={encounter.referral}
                    onChange={(e) => patch({ referral: e.target.value })}
                    placeholder={t("clinical.referralHelp")}
                  />
                </label>
                <label>
                  {t("clinical.importText")}
                  <input
                    type="file"
                    accept=".txt,.md"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) patch({ referral: await file.text() });
                    }}
                  />
                </label>
                <label>
                  {t("clinical.transcript")}
                  <textarea
                    disabled={busy || pending || recording}
                    aria-label={t("clinical.transcript")}
                    value={encounter.transcript}
                    onChange={(e) => patch({ transcript: e.target.value })}
                  />
                </label>
                <label>
                  {t("clinical.additions")}
                  <textarea
                    disabled={busy}
                    aria-label={t("clinical.additions")}
                    value={encounter.additions}
                    onChange={(e) => patch({ additions: e.target.value })}
                  />
                </label>
                <label>
                  {t("clinical.localModel")}
                  <input
                    disabled={busy}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={t("clinical.modelHelp")}
                  />
                </label>
                <button
                  className="primary"
                  disabled={busy || pending || recording || !isTauri()}
                  onClick={() => void generate()}
                >
                  {t(busy ? "clinical.generating" : "clinical.generate")}
                </button>
                <small>{t("clinical.localHelp")}</small>
                <button
                  disabled={busy || !isTauri() || !encounter.transcript}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      setRedacted(
                        await invoke<string>("clinical_deidentify", {
                          text: [
                            encounter.referral,
                            encounter.transcript,
                            encounter.additions,
                          ].join("\n\n"),
                        }),
                      );
                    } catch {
                      setMessage(t("clinical.openmedFailed"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t("clinical.deidentify")}
                </button>
                {redacted && (
                  <label>
                    {t("clinical.redactionPreview")}
                    <textarea readOnly value={redacted} />
                  </label>
                )}
                <small>{t("clinical.openmedHelp")}</small>
              </section>
              <section className="document">
                <div className="tabs">
                  {(["letter", "note"] as const).map((value) => (
                    <button
                      key={value}
                      className={tab === value ? "selected" : ""}
                      onClick={() => setTab(value)}
                    >
                      {t(`clinical.${value}`)}
                    </button>
                  ))}
                </div>
                <p className="review-notice">{t("clinical.reviewHelp")}</p>
                <textarea
                  aria-label={t(`clinical.${tab}`)}
                  className="document-editor"
                  disabled={busy}
                  value={encounter[tab]}
                  onChange={(e) => patch({ [tab]: e.target.value })}
                  placeholder={t("clinical.draftHelp")}
                />
                <div className="export-actions">
                  <button
                    disabled={!encounter[tab] || busy}
                    onClick={() => void copy(true)}
                  >
                    {t("clinical.copyFormatted")}
                  </button>
                  <button
                    disabled={!encounter[tab] || busy}
                    onClick={() => void copy(false)}
                  >
                    {t("clinical.copyPlain")}
                  </button>
                  <button
                    disabled={!encounter[tab] || busy}
                    onClick={() =>
                      download(
                        documentHtml(encounter[tab]),
                        `consult-${encounter.id}-${tab}.html`,
                        "text/html",
                      )
                    }
                  >
                    {t("clinical.export")}
                  </button>
                </div>
                <div className="export-actions">
                  <button
                    disabled={
                      busy ||
                      !encounter.note ||
                      !encounter.letter ||
                      encounter.status === "filed"
                    }
                    onClick={() => patch({ status: "reviewed" })}
                  >
                    {t("clinical.markReviewed")}
                  </button>
                  <button
                    disabled={busy || encounter.status !== "reviewed"}
                    onClick={() => patch({ status: "filed" })}
                  >
                    {t("clinical.markFiled")}
                  </button>
                  <span>{t(`clinical.${encounter.status}`)}</span>
                </div>
              </section>
            </div>
          </section>
        )}
      </div>
      <footer role="status">{message || t("clinical.prototype")}</footer>
    </main>
  );
}
