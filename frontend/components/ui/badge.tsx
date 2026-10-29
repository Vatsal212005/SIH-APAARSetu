import {cn, titleCase} from "@/lib/utils";

export function Badge({children, tone = "slate", className}: {children: React.ReactNode; tone?: "slate" | "blue" | "teal" | "amber" | "red" | "green"; className?: string}) {
  return <span className={cn("badge", `badge-${tone}`, className)}>{typeof children === "string" ? titleCase(children) : children}</span>;
}

export function statusTone(value: string): "slate" | "blue" | "teal" | "amber" | "red" | "green" {
  if (["critical", "high", "rejected", "denied", "revoked"].some((item) => value.includes(item))) return "red";
  if (["warning", "pending", "flagged", "open", "medium"].some((item) => value.includes(item))) return "amber";
  if (["accepted", "approved", "verified", "resolved", "success", "enrolled"].some((item) => value.includes(item))) return "green";
  if (["info", "submitted", "format"].some((item) => value.includes(item))) return "blue";
  return "slate";
}

