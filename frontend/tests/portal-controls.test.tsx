import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import { Input, Label } from "../components/ui/input";
import { DataTable } from "../components/data-table";
import { LocaleProvider, useLocale } from "../lib/locale";
import {parseTimestamp} from "../lib/utils";
const pathname = vi.hoisted(() => ({ value: "/login" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  pathname.value = "/login";
});
function Translated() {
  const { t, setLanguage, setSize } = useLocale();
  return (
    <>
      <h1>{t("signTitle")}</h1>
      <button onClick={() => setLanguage("hi")}>Hindi</button>
      <button onClick={() => setSize("large")}>Larger</button>
    </>
  );
}
describe("government portal controls", () => {
  it("interprets SQLite timestamps as UTC without changing explicit offsets",()=>{expect(parseTimestamp("2026-10-29T10:00:00").toISOString()).toBe("2026-10-29T10:00:00.000Z");expect(parseTimestamp("2026-10-29T15:30:00+05:30").toISOString()).toBe("2026-10-29T10:00:00.000Z");});
  it("associates existing adjacent form labels with their actual input", () => {
    render(
      <div>
        <Label>Recipient name</Label>
        <Input />
      </div>,
    );
    expect(screen.getByLabelText("Recipient name").tagName).toBe("INPUT");
  });
  it("sorts with semantic header buttons and exposes sort state", () => {
    render(
      <DataTable
        columns={[{ accessorKey: "name", header: "Name" }]}
        data={[{ name: "Zeta" }, { name: "Alpha" }]}
        caption="Names"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe(
      "ascending",
    );
    expect(
      within(screen.getAllByRole("row")[1]).getByText("Alpha"),
    ).toBeTruthy();
  });
  it("paginates local report groups without discarding later rows", () => {
    render(
      <DataTable
        pageSize={1}
        columns={[{ accessorKey: "name", header: "Name" }]}
        data={[{ name: "First" }, { name: "Second" }]}
        caption="Names"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next results" }));
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.queryByText("First")).toBeNull();
  });
  it("changes real page text and document language and persists text size", async () => {
    render(
      <LocaleProvider>
        <Translated />
      </LocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hindi" }));
    await waitFor(() => expect(document.documentElement.lang).toBe("hi"));
    expect(screen.getByRole("heading").textContent).toContain("साइन इन");
    fireEvent.click(screen.getByRole("button", { name: "Larger" }));
    await waitFor(() =>
      expect(document.documentElement.dataset.textSize).toBe("large"),
    );
    expect(localStorage.getItem("apaarsetu_text_size")).toBe("large");
  });
  it("keeps untranslated administrative workspaces explicitly in English", () => {
    pathname.value = "/dashboard";
    localStorage.setItem("apaarsetu_language", "hi");
    render(
      <LocaleProvider>
        <Translated />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading").textContent).toBe(
      "Sign in to your portal",
    );
    expect(document.documentElement.lang).toBe("en");
  });
});
