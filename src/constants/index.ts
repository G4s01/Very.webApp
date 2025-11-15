export const API_BASE = (process.env.API_BASE || 'https://apigw.verymobile.it/api').replace(/\/+$/, '');
export const SESSION_WARN_SECONDS =
  Number(process.env.NEXT_PUBLIC_SESSION_WARN_SECONDS || process.env.SESSION_WARN_SECONDS || 300) || 300;
export { windHeaders } from './windHeaders';