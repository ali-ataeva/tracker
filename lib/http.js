// Small helpers shared by every file in /api.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

/** Wraps a handler so any error becomes a friendly JSON response. */
export function route(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
      console.error(err);
      return json({ error: 'Something went wrong on the server. Please try again.' }, { status: 500 });
    }
  };
}

export async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected a JSON request.');
  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'That request was not valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'That request was not in the expected format.');
  }
  return body;
}

/**
 * Blocks changes sent from other websites. Browsers always attach an Origin
 * header to POST/PATCH/DELETE requests, so if it's there it must be us.
 */
export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Request blocked.');
  }
  const hosts = [request.headers.get('x-forwarded-host'), request.headers.get('host')];
  if (!hosts.includes(originHost)) throw new HttpError(403, 'Request blocked.');
}
