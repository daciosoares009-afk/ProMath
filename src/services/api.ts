export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export async function api<T>(action: string, data: object = {}, token?: string): Promise<T> {
  let res: Response
  try {
    res = await fetch('/api/probmath', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...data, action }),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new ApiError('Conexão indisponível. Tente novamente.', 0)
  }
  const result = await res.json().catch(() => null)
  if (!res.ok || !result) throw new ApiError(result?.error ?? 'Serviço temporariamente indisponível. Tente novamente.', res.status)
  return result as T
}

export const message = (error: unknown) => error instanceof Error ? error.message : 'Tente novamente.',
  randomId = () => crypto.randomUUID()

export function newSession() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return { id: randomId(), secret: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') }
}
export type Session = ReturnType<typeof newSession>

