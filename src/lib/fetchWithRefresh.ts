// Minimal wrapper: if the request returns 401, try POST /api/auth/refresh once and retry the original request.
// Returns the final Response.
export default async function fetchWithRefresh(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const withCred: RequestInit = { ...(init || {}), credentials: 'include' as RequestCredentials };

  // first attempt
  const r = await fetch(input, withCred);
  if (r.status !== 401) return r;

  // if 401: attempt refresh
  try {
    const rf = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (rf.ok) {
      // refresh succeeded; retry original request once
      return await fetch(input, withCred);
    }
  } catch (e) {
    // ignore and return original 401
  }

  return r;
}