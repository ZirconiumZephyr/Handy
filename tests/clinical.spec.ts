import { test, expect, type Page } from "@playwright/test";
const password = "synthetic-test-passphrase";
async function unlock(page: Page) {
  await page.getByLabel("Workspace passphrase").fill(password);
  await page.getByRole("button", { name: "Unlock / create workspace" }).click();
  await expect(
    page.getByRole("button", { name: "New consultation", exact: true }),
  ).toBeVisible();
}
async function create(page: Page, name = "Synthetic Patient") {
  await page
    .getByRole("button", { name: "New consultation", exact: true })
    .click();
  await page.getByLabel("Patient name", { exact: true }).fill(name);
  await page.getByLabel("Date of birth", { exact: true }).fill("1980-01-02");
  await page.getByLabel("Patient identifier", { exact: true }).fill("TEST-001");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/consult-preview.html");
});
test("encrypts records, rejects wrong password, restores edits after reload", async ({
  page,
}) => {
  await unlock(page);
  await create(page);
  await page
    .getByLabel("Consultation transcript", { exact: true })
    .fill("Synthetic clinical transcript: no weakness.");
  await expect(
    page.getByText("Encrypted records saved", { exact: true }),
  ).toBeVisible();
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain("Synthetic Patient");
  expect(storage).not.toContain("no weakness");
  await page
    .getByRole("button", { name: "Lock workspace", exact: true })
    .click();
  await page.getByLabel("Workspace passphrase").fill("incorrect-passphrase");
  await page.getByRole("button", { name: "Unlock / create workspace" }).click();
  await expect(page.getByRole("status")).toContainText("Unable to unlock");
  await unlock(page);
  await expect(
    page.getByLabel("Consultation transcript", { exact: true }),
  ).toHaveValue("Synthetic clinical transcript: no weakness.");
  await page.reload();
  await unlock(page);
  await expect(page.getByLabel("Patient name", { exact: true })).toHaveValue(
    "Synthetic Patient",
  );
});
test("keeps patients separate and returns edited reviewed documents to draft", async ({
  page,
}) => {
  await unlock(page);
  await create(page, "Synthetic A");
  await page
    .getByRole("textbox", { name: "Letter", exact: true })
    .fill("Letter A");
  await page
    .getByRole("button", { name: "Clinical note", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Clinical note", exact: true })
    .fill("Note A");
  await page
    .getByRole("button", { name: "Mark reviewed", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm filed in Gentu" }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Clinical note", exact: true })
    .fill("Note A corrected");
  await expect(
    page.getByRole("button", { name: "Confirm filed in Gentu" }),
  ).toBeDisabled();
  await create(page, "Synthetic B");
  await expect(
    page.getByRole("textbox", { name: "Clinical note", exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: /Synthetic A/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Clinical note", exact: true }),
  ).toHaveValue("Note A corrected");
});
test("backup round trip and HTML export escape untrusted text", async ({
  page,
}) => {
  await unlock(page);
  await create(page);
  await page
    .getByRole("textbox", { name: "Letter", exact: true })
    .fill('<script>alert("x")</script>\n\nClinical paragraph.');
  await expect(
    page.getByText("Encrypted records saved", { exact: true }),
  ).toBeVisible();
  const htmlPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export HTML", exact: true }).click();
  const htmlDownload = await htmlPromise;
  const { readFile } = await import("node:fs/promises");
  const html = await readFile((await htmlDownload.path())!, "utf8");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  const backupPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Encrypted backup", exact: true })
    .click();
  const backup = await backupPromise;
  const backupPath = (await backup.path())!;
  await page
    .getByRole("button", { name: "Lock workspace", exact: true })
    .click();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("Restore encrypted backup").setInputFiles(backupPath);
  await unlock(page);
  await expect(
    page.getByRole("textbox", { name: "Letter", exact: true }),
  ).toHaveValue('<script>alert("x")</script>\n\nClinical paragraph.');
  await page.screenshot({
    path: "test-results/consult-workspace.png",
    fullPage: true,
  });
});
