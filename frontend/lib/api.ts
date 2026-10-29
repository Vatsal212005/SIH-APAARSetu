export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") {
    const csrf = window.localStorage.getItem("apaarsetu_csrf");
    if (csrf && (init.method ?? "GET") !== "GET") headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(`${API_URL}${path}`, {...init, headers, credentials: "include", cache: "no-store"});
  if (!response.ok) {
    const body = await response.json().catch(() => ({detail: response.statusText}));
    const detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    throw new ApiError(response.status, detail || "Request failed");
  }
  return response.json() as Promise<T>;
}

export function downloadUrl(path: string) {
  return `${API_URL}${path}`;
}

