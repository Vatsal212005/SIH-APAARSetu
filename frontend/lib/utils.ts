import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function number(value: number | undefined) {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

export function dateTime(value: string | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parseTimestamp(value));
}

// SQLite returns UTC timestamps without an offset. Preserve that meaning in browsers.
export function parseTimestamp(value?: string | number) {
  if (value === undefined) return new Date();
  const normalized = typeof value === "string" && value.includes("T") && !/(Z|[+-]\d{2}:\d{2})$/i.test(value) ? `${value}Z` : value;
  return new Date(normalized);
}
