export interface Encounter {
  id: string;
  name: string;
  dob: string;
  patientId: string;
  date: string;
  consent: boolean;
  referral: string;
  transcript: string;
  additions: string;
  note: string;
  letter: string;
  status: "draft" | "reviewed" | "filed";
}
export interface Workspace {
  encounters: Encounter[];
}
const STORAGE = "consult.vault.v1";
interface Envelope {
  version: 1;
  salt: number[];
  iv: number[];
  ciphertext: number[];
}
export async function unlockVault(password: string, backup?: string) {
  if (password.length < 12) throw new Error("clinical.passwordLength");
  const stored = backup ?? localStorage.getItem(STORAGE);
  const envelope: Envelope | null = stored ? JSON.parse(stored) : null;
  if (envelope && envelope.version !== 1)
    throw new Error("clinical.vaultVersion");
  const salt = envelope
    ? new Uint8Array(envelope.salt)
    : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const workspace: Workspace = envelope
    ? JSON.parse(
        new TextDecoder().decode(
          await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(envelope.iv) },
            key,
            new Uint8Array(envelope.ciphertext),
          ),
        ),
      )
    : { encounters: [] };
  if (!Array.isArray(workspace.encounters))
    throw new Error("clinical.vaultVersion");
  return { key, salt, workspace };
}
export async function saveVault(
  workspace: Workspace,
  key: CryptoKey,
  salt: Uint8Array,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(workspace)),
  );
  const envelope: Envelope = {
    version: 1,
    salt: Array.from(salt),
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertext)),
  };
  localStorage.setItem(STORAGE, JSON.stringify(envelope));
}
export function encryptedBackup(): string {
  const value = localStorage.getItem(STORAGE);
  if (!value) throw new Error("clinical.noBackup");
  return value;
}
export function newEncounter(): Encounter {
  const date = new Date();
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return {
    id: crypto.randomUUID(),
    name: "",
    dob: "",
    patientId: "",
    date: localDate,
    consent: false,
    referral: "",
    transcript: "",
    additions: "",
    note: "",
    letter: "",
    status: "draft",
  };
}
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function documentHtml(text: string) {
  return `<article style="font-family:Arial,sans-serif;font-size:11pt;line-height:1.5">${text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("")}</article>`;
}
