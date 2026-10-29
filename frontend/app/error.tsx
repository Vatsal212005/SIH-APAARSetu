"use client";
export default function ErrorBoundary({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="page">
      <h1>This page could not be loaded</h1>
      <p>
        Your records have not been reset. Retry this view or return to your
        dashboard.
      </p>
      <button className="btn btn-primary btn-md" onClick={reset}>
        Try again
      </button>
      <a className="btn btn-secondary btn-md" href="/dashboard">
        Dashboard
      </a>
    </main>
  );
}
