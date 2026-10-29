"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/portal";
export function VerifierEntry() {
  const [value, setValue] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <div className="page">
      <PageHeader
        title="Academic Credential Verification"
        description="Verify the integrity and permitted disclosure of institution-issued demonstration academic records."
      />
      <section className="card" style={{ padding: 24, maxWidth: 820 }}>
        <h2>Enter a student-authorized reference</h2>
        <p>
          Paste the reference or the verification link supplied by the student.
          A QR on the shared certificate opens the same service.
        </p>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const token = value.includes("/verify/")
              ? value.split("/verify/")[1]?.split(/[?#]/)[0]
              : value.trim();
            if (token && /^[A-Za-z0-9_-]{20,100}$/.test(token)) {
              setError("");
              router.push("/verify/" + token);
            } else
              setError(
                "Enter the complete opaque reference from the student's sharing link, not an academic identifier.",
              );
          }}
        >
          <div>
            <Label htmlFor="disclosure">
              Student-authorized disclosure reference
            </Label>
            <Input
              id="disclosure"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              aria-describedby="reference-hint"
            />
            <p id="reference-hint" className="record-subtitle">
              No unrestricted student lookup is available. The reference is
              sensitive and expires with its consent.
            </p>
          </div>
          <Button type="submit">Open verification</Button>
          {error && (
            <Alert title="Reference needs correction" tone="danger">
              {error}
            </Alert>
          )}
        </form>
        <Alert title="Official APAAR Identity Verification: Not Available in Demonstration Mode">
          Digital signature validity, credential expiry, credential revocation
          and student consent are checked separately.
        </Alert>
      </section>
    </div>
  );
}
