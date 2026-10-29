import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { number } from "@/lib/utils";
import Link from "next/link";

export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = "navy",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
  href?: string;
  tone?: "navy" | "teal" | "amber" | "red";
}) {
  return (
    <Card className="metric-card">
      <div className={`metric-icon metric-${tone}`}>
        <Icon size={18} aria-hidden="true" />
      </div>
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value == null ? "—" : number(value)}</p>
        {hint && <p className="metric-hint">{hint}</p>}
      </div>
      {href && <Link href={href} aria-label={`View ${label.toLowerCase()}`} />}
    </Card>
  );
}
