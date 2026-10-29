"use client";
import { parseTimestamp } from "@/lib/utils";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { api, downloadUrl } from "@/lib/api";
import { WorkflowForm } from "@/features/management";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { User } from "@/lib/types";
export function IssuanceTools() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const canIssue = ["institution_admin", "aicte_admin"].includes(
    me.data?.user.role ?? "",
  );
  const enrolments = useQuery({
    queryKey: ["enrolments"],
    enabled: canIssue,
    queryFn: () =>
      api<{
        items: {
          id: string;
          student: string;
          status: string;
          institution_student_id: string;
        }[];
      }>("/enrolments"),
  });
  if (!canIssue) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <WorkflowForm
        title="Issue institution credential"
        path="/credentials/issue"
        fields={[
          {
            name: "enrolment_id",
            options: (enrolments.data?.items ?? [])
              .filter((e) =>
                ["accepted", "enrolled", "completed"].includes(e.status),
              )
              .map((e) => ({
                value: e.id,
                label: `${e.student} · ${e.institution_student_id}`,
              })),
          },
          { name: "expires_in_days", type: "number" },
        ]}
      />
    </div>
  );
}
export function AccessHistory() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const query = useQuery({
    queryKey: ["verification-events"],
    enabled: me.data?.user.role === "student",
    queryFn: () =>
      api<{
        items: {
          id: string;
          verifier_name: string;
          outcome: string;
          created_at: string;
        }[];
      }>("/verification-events"),
  });
  if (me.data?.user.role !== "student") return null;
  return (
    <Card style={{ marginTop: 18 }}>
      <CardHeader>
        <CardTitle>Verification access history</CardTitle>
      </CardHeader>
      <CardContent>
        {query.data?.items.map((e) => (
          <div className="check-row" key={e.id}>
            <span>{e.verifier_name}</span>
            <span>
              {e.outcome} ·{" "}
              {parseTimestamp(e.created_at).toLocaleString("en-IN")}
            </span>
          </div>
        ))}
        {!query.data?.items.length && <p>No verification events yet.</p>}
      </CardContent>
    </Card>
  );
}
export function ShareQr({
  token,
  credentialId,
}: {
  token: string;
  credentialId?: string;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <Image
        unoptimized
        alt="Consent-based credential verification QR"
        width={140}
        height={140}
        src={downloadUrl(`/disclosure-qr/${token}`)}
      />
      {credentialId && (
        <a
          href={downloadUrl(
            `/credentials/${credentialId}/certificate.pdf?disclosure_token=${token}`,
          )}
        >
          Download certificate with this consent QR
        </a>
      )}
    </div>
  );
}
export function CredentialRevoke({ id }: { id: string }) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirm && !dialog.current?.open) dialog.current?.showModal();
    if (!confirm && dialog.current?.open) dialog.current.close();
  }, [confirm]);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User }>("/auth/me"),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api(
        `/credentials/${id}/revoke?reason=Institution%20revoked%20the%20demonstration%20credential`,
        { method: "POST" },
      ),
    onSuccess: () => {
      client.invalidateQueries();
      setConfirm(false);
    },
  });
  if (!["institution_admin", "aicte_admin"].includes(me.data?.user.role ?? ""))
    return null;
  return (
    <div style={{ display: "inline-block" }}>
      <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
        Revoke credential
      </Button>
      <dialog
        ref={dialog}
        className="government-dialog"
        aria-labelledby={`revoke-title-${id}`}
        aria-describedby={`revoke-description-${id}`}
        onCancel={(event) => {
          event.preventDefault();
          setConfirm(false);
        }}
        onClose={() => setConfirm(false)}
      >
        <h2 id={`revoke-title-${id}`}>Confirm credential revocation</h2>
        <p id={`revoke-description-${id}`}>
          Revocation will block all future verification of this local
          demonstration credential.
        </p>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          Confirm revoke
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>
          Cancel
        </Button>
      </dialog>
      {mutation.error && <span>{mutation.error.message}</span>}
    </div>
  );
}
export function CertificateDownload({ id }: { id: string }) {
  const [full, setFull] = useState(false);
  const config = useQuery({
    queryKey: ["privacy-config"],
    queryFn: () =>
      api<{ certificate_full_identifier: boolean }>("/privacy-config"),
  });
  return (
    <span>
      {config.data?.certificate_full_identifier && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={full}
            onChange={(e) => setFull(e.target.checked)}
          />
          Print full identifier on this permitted PDF
        </label>
      )}
      <a
        className="btn btn-secondary btn-sm"
        href={downloadUrl(
          `/credentials/${id}/certificate.pdf?include_full_identifier=${full}`,
        )}
      >
        Download certificate
      </a>
    </span>
  );
}
