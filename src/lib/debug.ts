export function dlog(...args: any[]) {
  if (process.env.DEBUG_AUTH === '1' || process.env.NEXT_PUBLIC_DEBUG === '1') {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}