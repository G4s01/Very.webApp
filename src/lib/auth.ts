// Client helpers per il login/OTP

async function jsonOrThrow(r: Response) {
  const text = await r.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!r.ok) {
    const msg = data?.error || data?.message || `HTTP ${r.status}`;
    const err: any = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function credentialsLogin(emailOrUsername: string, password: string) {
  const r = await fetch('/api/auth/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username: emailOrUsername, password }),
  });
  return jsonOrThrow(r);
}

export async function otpGenerate(email: string, customerLine?: string) {
  const body: any = { email };
  if (customerLine) body.customerLine = customerLine;
  const r = await fetch('/api/auth/otp-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return jsonOrThrow(r);
}

export async function otpVerifyEmail(email: string, otp: string) {
  const r = await fetch('/api/auth/otp-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, otp }),
  });
  return jsonOrThrow(r);
}