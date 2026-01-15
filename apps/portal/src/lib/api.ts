export const API_BASE = process.env.NEXT_PUBLIC_PBI_API_BASE ?? "http://localhost:8080";

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include"
  });

  const text = await r.text();
  const json = text.length ? (JSON.parse(text) as T) : ({} as T);

  if (!r.ok) {
    throw new Error(`api_${r.status}`);
  }
  return json;
}