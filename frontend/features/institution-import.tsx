"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export function InstitutionImport() {
  const [file, setFile] = useState<File | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a CSV file");
      const body = new FormData();
      body.append("file", file);
      return api<{ accepted: number; rejected: number; rows: unknown[] }>(
        "/institutions/import",
        { method: "POST", body },
      );
    },
    onSuccess: () => client.invalidateQueries(),
  });
  return (
    <Card style={{ marginTop: 18 }}>
      <CardHeader>
        <CardTitle>Import institution registry CSV</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          Columns: permanent_id, name, institution_type, address, city, state,
          region, contact_email.
        </p>
        <input
          aria-label="Institution CSV file"
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button
          disabled={!file || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Import institutions
        </Button>
        {mutation.error && (
          <Alert title="Registry import failed" tone="danger">
            {mutation.error.message}
          </Alert>
        )}
        {mutation.data && (
          <>
            <Alert title="Registry import persisted" tone="success">
              {mutation.data.accepted} accepted; {mutation.data.rejected}{" "}
              rejected or duplicate.
            </Alert>
            <pre className="result-panel">
              {JSON.stringify(mutation.data.rows, null, 2)}
            </pre>
          </>
        )}
      </CardContent>
    </Card>
  );
}
