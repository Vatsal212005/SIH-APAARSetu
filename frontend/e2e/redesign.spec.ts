import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
const output = "../docs/screenshots/ui-redesign";
const evidence = "../docs/ui-accessibility.json";
test.beforeAll(async () => {
  await fs.mkdir(output, { recursive: true });
  await fs.access(evidence).catch(() => fs.writeFile(evidence, "[]"));
});
async function login(page: Page, role = "aicte_admin") {
  await page.goto("/login");
  await page.getByLabel("Workspace / role").selectOption(role);
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", {
      name:
        role === "student"
          ? "My Academic Records"
          : role === "verifier"
            ? "Academic Credential Verification"
            : role.startsWith("institution_")
              ? "Institution Student Data Management"
              : "Student Enrolment Monitoring Dashboard",
      exact: true,
    }),
  ).toBeVisible();
}
async function settled(page: Page) {
  if (!(await page.getByRole("dialog").count()))
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 30000 });
}
async function scan(page: Page, name: string) {
  await settled(page);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const records = JSON.parse(await fs.readFile(evidence, "utf8"));
  records.push({
    name,
    url: new URL(page.url()).pathname,
    checkedAt: new Date().toISOString(),
    passes: result.passes.length,
    incomplete: result.incomplete.length,
    incompleteDetails: result.incomplete.map((i) => ({
      id: i.id,
      nodes: i.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  await fs.writeFile(evidence, JSON.stringify(records, null, 2));
  expect(
    result.violations,
    JSON.stringify(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      null,
      2,
    ),
  ).toEqual([]);
}
test("public gateway, login and Hindi controls are real and accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await scan(page, "public-home");
  await page.screenshot({ path: output + "/home-1440.png", fullPage: true });
  await page
    .getByRole("link", { name: "Student Login", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Workspace / role")).toHaveValue("student");
  await expect(page.getByLabel("Email address")).toHaveValue(
    "student@apaarsetu.demo",
  );
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await page.getByLabel("Email address").fill("invalid");
  await page.getByRole("button", { name: "Secure sign in" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await page.getByLabel("Email address").fill("student@apaarsetu.demo");
  await scan(page, "login");
  await page.screenshot({ path: output + "/login-1440.png", fullPage: true });
  await page.getByLabel("Language", { exact: true }).selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(
    page.getByRole("heading", { name: "अपने पोर्टल में साइन इन करें" }),
  ).toBeVisible();
  await scan(page, "login-hindi");
  await page.screenshot({ path: output + "/login-hindi.png", fullPage: true });
  await page.getByRole("button", { name: "Increase text size" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  expect(
    await page.locator("html").evaluate((e) => getComputedStyle(e).fontSize),
  ).toBe("18px");
  expect(errors).toEqual([]);
});
test("all seven role choices authenticate to actual server roles", async ({
  page,
}) => {
  for (const role of [
    "aicte_admin",
    "regional_officer",
    "institution_admin",
    "institution_operator",
    "student",
    "verifier",
    "auditor",
  ]) {
    await login(page, role);
    const response = await page.request.get(
      "http://localhost:8001/api/v1/auth/me",
    );
    expect((await response.json()).user.role).toBe(role);
    await settled(page);
    await expect(
      page.getByText(
        "SIH 2026 Prototype | Synthetic Data | Not an Official Government Portal",
        { exact: true },
      ),
    ).toBeVisible();
    if (role === "student")
      await expect(
        page.getByRole("heading", { name: "My Academic Records", exact: true }),
      ).toBeVisible();
    if (role === "verifier")
      await expect(
        page.getByRole("heading", {
          name: "Academic Credential Verification",
          exact: true,
        }),
      ).toBeVisible();
    if (role === "regional_officer") {
      await page.goto("/anomalies");
      await expect(
        page.getByRole("heading", { name: "Validation & Compliance Review" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Run anomaly engine", exact: true }),
      ).toHaveCount(0);
    }
    if (role === "auditor") {
      await page.goto("/settings");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Run maintenance job" }),
      ).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
  }
});
test("all administrative modules pass live accessibility and console checks", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await login(page);
  for (const route of [
    "/dashboard",
    "/institutions",
    "/students",
    "/intakes",
    "/enrolments",
    "/anomalies",
    "/manage",
    "/reports",
    "/notifications",
    "/audit",
    "/settings",
    "/demo",
  ]) {
    await page.goto(route);
    await scan(page, route.slice(1));
    await page.screenshot({
      path: output + "/" + route.slice(1) + "-1440.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      route + " mobile overflow",
    ).toBeTruthy();
    await page.screenshot({
      path: output + "/" + route.slice(1) + "-375.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  expect(errors).toEqual([]);
});
test("dashboard filters query real cohorts and institutional case tabs load records", async ({
  page,
}) => {
  await login(page);
  await expect(page.locator("#dash-year")).toHaveValue("2025-26");
  await expect(
    page.getByRole("link", { name: "View total enrolments" }),
  ).toBeVisible();
  await page
    .getByLabel("Academic year", { exact: true })
    .selectOption("2024-25");
  await expect(
    page
      .locator(".metric-card")
      .filter({ hasText: "Total Enrolments" })
      .locator(".metric-value"),
  ).toHaveText("1,000");
  await page
    .getByLabel("Academic year", { exact: true })
    .selectOption("2025-26");
  await page.getByRole("link", { name: "Institutions", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Institution Registry", exact: true }),
  ).toBeVisible();
  const registry = page.getByRole("table", {
    name: "Institution registry",
    exact: true,
  });
  await registry.locator("tbody tr").first().getByRole("link").first().click();
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Programmes & Intake",
    "Student Enrolment",
    "Submissions",
    "Compliance",
    "Verification Activity",
    "Audit History",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".skeleton")).toHaveCount(0);
    await expect(page.locator(".error-panel")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await scan(page, "institution-case");
});
test("cross-institution review shows scoped comparison and records a justified assignment", async ({
  page,
}) => {
  await login(page);
  await page.goto("/anomalies");
  await page
    .getByRole("button", {
      name: "Regular intake exceeded by 15 admissions",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Affected programme/year cohort",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Enrolments supporting the intake review" })
      .locator("tbody tr"),
  ).toHaveCount(50);
  await scan(page, "intake-cohort-evidence");
  await page.screenshot({
    path: output + "/intake-cohort-evidence.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Potential concurrent cross-institution enrolment",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cross-Institution Enrolment Review" }),
  ).toBeVisible();
  await expect(page.locator(".comparison-panel")).toHaveCount(2);
  await page.getByRole("button", { name: "Assign review to me" }).click();
  await expect(
    page.getByText("Reviewer assigned", { exact: true }).first(),
  ).toBeVisible();
  await scan(page, "cross-institution-evidence");
  await page.screenshot({
    path: output + "/cross-institution-review.png",
    fullPage: true,
  });
});
test("student record, wallet and institution upload screens use accessible controls", async ({
  page,
}) => {
  await login(page, "student");
  await scan(page, "student-dashboard");
  await page.screenshot({
    path: output + "/student-dashboard-1440.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Credential Wallet", exact: true })
    .click();
  await expect(page).toHaveURL(/credentials/);
  await expect(
    page.getByRole("heading", {
      name: "Academic Credential Wallet",
      exact: true,
    }),
  ).toBeVisible();
  await scan(page, "student-wallet");
  await page
    .getByRole("button", { name: "Share / Verify", exact: true })
    .first()
    .click();
  await scan(page, "consent-fields");
  await page.screenshot({
    path: output + "/student-wallet-1440.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "institution_admin");
  await scan(page, "institution-dashboard");
  await page.screenshot({
    path: output + "/institution-dashboard-1440.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Data Ingestion", exact: true }).click();
  await expect(page).toHaveURL(/imports/);
  await expect(
    page.getByRole("heading", { name: "Student Data Submission", exact: true }),
  ).toBeVisible();
  await scan(page, "institution-upload");
  await page.screenshot({ path: output + "/upload-1440.png", fullPage: true });
  await page
    .getByRole("link", { name: "Credential Wallet", exact: true })
    .click();
  await expect(page).toHaveURL(/credentials/);
  await expect(
    page.getByRole("heading", {
      name: "Academic Credential Wallet",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revoke credential", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Confirm credential revocation",
  });
  await expect(dialog).toBeVisible();
  await scan(page, "credential-revocation-dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
test("responsive layouts fit four sizes and navigation works by keyboard", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await settled(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: output + `/home-${width}.png`,
      fullPage: true,
    });
  }
  await login(page);
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await settled(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: output + `/dashboard-${width}.png`,
      fullPage: true,
    });
  }
  const toggle = page.getByRole("button", { name: "Workspace menu" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("link", { name: "Student Registry", exact: true })
    .focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await scan(page, "mobile-dashboard");
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto("/reports");
  await settled(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: output + "/report-200-percent-reflow.png",
    fullPage: true,
  });
});
test("public guidance and denied verification retain clear bilingual trust boundaries", async ({
  page,
}) => {
  for (const path of [
    "/about",
    "/help",
    "/privacy",
    "/accessibility",
    "/verify/invalid-reference-000000000",
  ]) {
    await page.goto(path);
    await scan(page, path.split("/")[1]);
  }
  await page.getByLabel("Language", { exact: true }).selectOption("hi");
  await expect(
    page.getByRole("heading", { name: "सत्यापन अस्वीकृत", exact: true }),
  ).toBeVisible();
  await scan(page, "verification-hindi");
});

test("student case-file view and read-only role links remain scoped", async ({
  page,
}) => {
  await login(page);
  await page.goto("/students");
  await expect(
    page.getByRole("heading", { name: "Student Register", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("table", { name: "Student register", exact: true })
    .locator("tbody tr")
    .first()
    .getByRole("link")
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Personal & academic identity",
      exact: true,
    }),
  ).toBeVisible();
  const recordPath = new URL(page.url()).pathname;
  await scan(page, "student-case");
  await expect(
    page.getByRole("link", { name: "Open credential workspace" }),
  ).toBeVisible();
  await page.screenshot({ path: output + "/student-case.png", fullPage: true });
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "auditor");
  await page.goto(recordPath);
  await expect(
    page.getByRole("heading", {
      name: "Personal & academic identity",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open credential workspace" }),
  ).toHaveCount(0);
  await scan(page, "student-case-auditor");
});
