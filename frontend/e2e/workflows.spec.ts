import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
test.beforeAll(async () => {
  await fs.mkdir("../docs/screenshots", { recursive: true });
});
test("central admin reads actual registry, intake and findings", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("central.admin@apaarsetu.demo");
  await page.getByLabel("Password", { exact: true }).fill("Demo@26263");
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Student Enrolment Monitoring Dashboard",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/central-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Programmes & Intake" }).click();
  await expect(
    page.getByText("Excess 15", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Findings & Review" }).click();
  await expect(
    page.getByText("Potential concurrent cross-institution enrolment", {
      exact: true,
    }),
  ).toBeVisible();
});
test("student consent allows verification then revocation blocks disclosure", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("student@apaarsetu.demo");
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await page.getByRole("link", { name: "Credential Wallet" }).click();
  await page.getByRole("button", { name: "Share / Verify" }).first().click();
  await page.getByRole("button", { name: "Grant 24-hour consent" }).click();
  const link = page.getByRole("link", { name: "Verify", exact: true });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  const verifier = await context.newPage();
  await verifier.goto(href!);
  await expect(
    verifier.getByRole("heading", { name: "Credential checks passed" }),
  ).toBeVisible();
  await verifier.screenshot({
    path: "../docs/screenshots/credential-verification.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Revoke access" }).last().click();
  await verifier.reload();
  await expect(
    verifier.getByRole("heading", { name: "Verification denied" }),
  ).toBeVisible();
});

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Demo@26263");
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("institution previews mixed CSV and commits a persistent receipt", async ({
  page,
}) => {
  await login(page, "institution.operator@apaarsetu.demo");
  await page.getByRole("link", { name: "Data Ingestion" }).click();
  const option = page
    .locator("#programme option")
    .filter({ hasText: "Technology Management" })
    .first();
  const value = await option.getAttribute("value");
  await page.getByLabel("Programme", { exact: true }).selectOption(value!);
  const suffix = String(Date.now()).slice(-9);
  const content = (
    await fs.readFile(path.resolve("public/student-import-mixed.csv"), "utf8")
  )
    .replaceAll("799999999901", "780" + suffix)
    .replaceAll("799999999902", "781" + suffix)
    .replaceAll("UPLOAD-", "B" + suffix + "-");
  await page
    .getByLabel("CSV/XLSX file (up to 10 MB)")
    .setInputFiles({
      name: "mixed-" + suffix + ".csv",
      mimeType: "text/csv",
      buffer: Buffer.from(content),
    });
  await page.getByRole("button", { name: "Preview and validate" }).click();
  await expect(
    page.getByText("Validation preview — no records committed"),
  ).toBeVisible();
  await expect(page.getByText("rejected: 4", { exact: true })).toBeVisible();
  await page
    .getByRole("checkbox", { name: /I have reviewed the preview/ })
    .check();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(
    page.getByText("Persisted submission receipt", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download error report", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/import-validation.png",
    fullPage: true,
  });
});

test("all five Demo Center scenarios compute evidence and persist after refresh", async ({
  page,
}) => {
  await login(page, "central.admin@apaarsetu.demo");
  await page.getByRole("link", { name: "SIH Demo Center" }).click();
  const titles = [
    "Approved Intake Violation",
    "Cross-Institution Conflict",
    "Consent-Based Credential Verification",
    "Student Data Upload and Validation",
    "Intelligent Enrolment Anomaly",
  ];
  for (const title of titles) {
    const card = page
      .locator(".scenario-card")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await card
      .getByRole("button", { name: /Start Demo|Repeat \/ refresh/ })
      .click();
    if (title === "Approved Intake Violation") {
      await expect(card.getByText("Computed excess")).toBeVisible();
      await card.getByRole("button", { name: "Record review" }).click();
      await expect(
        card.getByText("request clarification", { exact: true }),
      ).toBeVisible();
    } else if (title === "Consent-Based Credential Verification") {
      await expect(
        card.getByText("Signature passed", { exact: false }),
      ).toBeVisible();
      await card
        .getByRole("button", { name: "Verify signature and consent" })
        .click();
      await expect(
        card.getByText("Verification passed", { exact: true }),
      ).toBeVisible();
      await card
        .getByRole("button", { name: "Revoke and verify denial" })
        .click();
      await expect(
        card.getByText("Verification denied", { exact: true }),
      ).toBeVisible();
    } else if (title === "Student Data Upload and Validation") {
      await expect(
        card.getByRole("link", { name: "Download persisted error report" }),
      ).toBeVisible();
    } else if (title === "Intelligent Enrolment Anomaly") {
      await expect(
        card.getByText("Isolation Forest result", { exact: true }),
      ).toBeVisible();
      await card.getByRole("button", { name: "Record review" }).click();
    } else {
      await expect(card.locator(".check-row")).toHaveCount(2);
      await card.getByRole("button", { name: "Record review" }).click();
    }
  }
  await page.screenshot({
    path: "../docs/screenshots/demo-center.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByText("Computed excess")).toBeVisible();
});

test("student requests correction and institution administrator reviews it", async ({
  page,
}) => {
  await login(page, "student@apaarsetu.demo");
  await page.getByRole("link", { name: "Corrections", exact: true }).click();
  const enrolmentOption = page
    .locator("select option")
    .filter({ hasText: "Synthetic Bengaluru Institute of Technology 001" })
    .filter({ hasText: "2025-26" })
    .first();
  await page
    .getByLabel("enrolment id")
    .selectOption((await enrolmentOption.getAttribute("value"))!);
  await page.getByLabel("field name").selectOption("institution_student_id");
  await page.getByLabel("requested value").fill("SYN-CORRECTED-00001");
  await page
    .getByLabel("reason", { exact: true })
    .fill("Synthetic student requested correction of institutional reference.");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByText("The record and audit event have been persisted."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "institution.admin@apaarsetu.demo");
  await page.getByRole("link", { name: "Corrections", exact: true }).click();
  const review = page
    .locator("form")
    .filter({ has: page.getByLabel("decision") })
    .first();
  await review
    .getByLabel("reason", { exact: true })
    .fill("Institution reviewed the synthetic reference correction.");
  await review.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByText("approved", { exact: false }).first(),
  ).toBeVisible();
});

test("verifier portal requires a disclosure reference", async ({ page }) => {
  await login(page, "verifier@apaarsetu.demo");
  await expect(
    page.getByRole("heading", { name: "Academic Credential Verification" }),
  ).toBeVisible();
  const response = await page.request.get(
    "http://localhost:8001/api/v1/students",
  );
  expect(response.status()).toBe(403);
  await page
    .getByLabel("Student-authorized disclosure reference")
    .fill("invalid-reference-000000000");
  await page.getByRole("button", { name: "Open verification" }).click();
  await expect(
    page.getByRole("heading", { name: "Verification denied" }),
  ).toBeVisible();
});

test("authorized institution issues a credential and exports reconcile", async ({
  page,
}) => {
  await login(page, "institution.admin@apaarsetu.demo");
  await page.getByRole("link", { name: "Credential Wallet" }).click();
  await page.getByLabel("expires in days").fill("365");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(
    page.getByText("The record and audit event have been persisted."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  const csv = await page.request.get(
    "http://localhost:8001/api/v1/reports/enrolment.csv",
  );
  expect(csv.ok()).toBeTruthy();
  expect(await csv.text()).toContain("regular_capacity");
  const pdf = await page.request.get(
    "http://localhost:8001/api/v1/reports/enrolment.pdf",
  );
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});
