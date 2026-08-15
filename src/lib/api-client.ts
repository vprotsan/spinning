// Thin fetch wrapper for client components talking to our own /api routes.
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore — use status text
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
