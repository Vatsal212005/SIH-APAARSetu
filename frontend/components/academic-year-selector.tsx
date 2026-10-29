"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Label } from "@/components/ui/input";
export function AcademicYearSelector({
  id,
  value,
  onChange,
  all = false,
}: {
  id: string;
  value: string;
  onChange: (year: string) => void;
  all?: boolean;
}) {
  const query = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => api<{ items: string[] }>("/academic-years"),
  });
  return (
    <div>
      <Label htmlFor={id}>Academic year</Label>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {all && <option value="">All academic years</option>}
        {Array.from(
          new Set([...(query.data?.items ?? []), ...(value ? [value] : [])]),
        )
          .sort()
          .reverse()
          .map((y) => (
            <option key={y}>{y}</option>
          ))}
      </select>
      {query.error && (
        <p role="alert" className="field-error">
          {query.error.message}
        </p>
      )}
    </div>
  );
}
