import type {LucideIcon} from "lucide-react";
import {Card} from "@/components/ui/card";
import {number} from "@/lib/utils";

export function MetricCard({label, value, icon: Icon, hint, tone = "navy"}: {label: string; value: number; icon: LucideIcon; hint?: string; tone?: "navy" | "teal" | "amber" | "red"}) {
  return <Card className="metric-card"><div className={`metric-icon metric-${tone}`}><Icon size={20}/></div><div><p className="metric-label">{label}</p><p className="metric-value">{number(value)}</p>{hint && <p className="metric-hint">{hint}</p>}</div></Card>;
}

