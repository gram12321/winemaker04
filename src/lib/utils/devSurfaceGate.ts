export function isLoopbackHostname(hostname: string | undefined | null): boolean {
  if (!hostname) return false;

  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');

  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function isDevSurfaceAvailable(
  locationLike: Pick<Location, 'hostname'> | undefined = typeof window !== 'undefined' ? window.location : undefined,
  isDev = import.meta.env.DEV
): boolean {
  return Boolean(isDev && locationLike && isLoopbackHostname(locationLike.hostname));
}
