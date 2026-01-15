type ApiJsonInit = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

export type ApiError = Error & { status?: number };

function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (env) return env.replace(/\/+$/, "");
  return "http://localhost:8080";
}

export async function apiJson<T>(path: string, init: ApiJsonInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${apiBase()}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: ApiError = new Error(`API ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}