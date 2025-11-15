export const WARN_SECONDS =
  Number(process.env.NEXT_PUBLIC_SESSION_WARN_SECONDS ||
    process.env.SESSION_WARN_SECONDS ||
    300) || 300;