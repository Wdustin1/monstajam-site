export class AdminSaveError extends Error {
  constructor(message: string, readonly fields: Record<string, string> = {}, readonly status?: number) {
    super(message);
  }
}

// Metadata requests are small; a stalled response must not lock the editor.
// Blob uploads have their own lifecycle and do not use this deadline.
export function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(30_000) });
}

export async function readAdminResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (response.status === 401) {
    throw new AdminSaveError('Your session expired. Your edits are still here. Sign in in a new tab, then retry.', {}, 401);
  }
  if (!response.ok) {
    const fields: Record<string, string> = {};
    if (body?.details && typeof body.details === 'object') {
      for (const [field, messages] of Object.entries(body.details)) {
        if (Array.isArray(messages) && typeof messages[0] === 'string') fields[field] = messages[0];
      }
    }
    throw new AdminSaveError(
      response.status === 422 ? 'Check the highlighted fields and retry.' :
        typeof body?.error === 'string' ? body.error : 'The request failed. Please retry.',
      fields,
      response.status,
    );
  }
  if (!body) throw new AdminSaveError('The server response was interrupted. Reload the library to check whether the save completed before retrying.');
  return body as T;
}

export function formChanged<T extends object>(current: T, saved: T): boolean {
  return (Object.keys(current) as (keyof T)[]).some((key) => current[key] !== saved[key]);
}
