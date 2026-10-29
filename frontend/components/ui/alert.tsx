import {AlertCircle, CheckCircle2, Info} from "lucide-react";
import {cn} from "@/lib/utils";

export function Alert({title, children, tone = "info"}: {title: string; children: React.ReactNode; tone?: "info" | "success" | "warning" | "danger"}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return <div className={cn("alert", `alert-${tone}`)}><Icon size={19}/><div><strong>{title}</strong><div>{children}</div></div></div>;
}

