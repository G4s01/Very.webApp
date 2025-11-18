// Esteso: ora integra prettyError e un helper accessibile

export function prettyError(e: any): string {
  if (!e) return 'Errore sconosciuto';
  if (typeof e === 'string') return e;
  if (e.message) return String(e.message);
  if (e.error) return String(e.error);
  try {
    return JSON.stringify(e);
  } catch {
    return 'Errore inatteso';
  }
}

// Facoltativo: per UI aria-live, ritorna id univoco (potresti espanderlo)
export function errorId(): string {
  return 'err-' + Math.random().toString(36).slice(2, 8);
}