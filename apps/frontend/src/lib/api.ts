export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Cliente HTTP mínimo. Todas las llamadas viajan con `credentials: include`
 * para que la cookie httpOnly `envioya_session` acompañe al request.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined;

  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new ApiError(extractMessage(data) ?? 'Ocurrió un error inesperado', response.status);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(data: unknown): string | undefined {
  if (typeof data === 'string' && data.trim().length > 0) {
    return data;
  }

  if (typeof data !== 'object' || data === null || !('message' in data)) {
    return undefined;
  }

  const message = (data as { message: unknown }).message;

  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string').join('. ');
  }

  return typeof message === 'string' ? message : undefined;
}
