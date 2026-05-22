/// <reference types="node" />
import type { IncomingMessage } from 'http';

export function isLoopbackHostname(hostname: string | undefined | null): boolean {
  if (!hostname) return false;

  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');

  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function getHostnameFromHostHeader(hostHeader: string | string[] | undefined): string | null {
  const value = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!value) return null;

  if (value.startsWith('[')) {
    const bracketEnd = value.indexOf(']');
    return bracketEnd >= 0 ? value.slice(1, bracketEnd) : value;
  }

  return value.split(':')[0] || null;
}

export function isLoopbackRequest(req: IncomingMessage): boolean {
  const hostname = getHostnameFromHostHeader(req.headers.host);
  return isLoopbackHostname(hostname);
}
