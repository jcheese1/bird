

export interface TwitterCookies {
  authToken: string | null;
  ct0: string | null;
  cookieHeader: string | null;
  source: string | null;
}

export interface CookieExtractionResult {
  cookies: TwitterCookies;
  warnings: string[];
}

export type CookieSource = 'safari' | 'chrome' | 'firefox';

const TWITTER_COOKIE_NAMES = ['auth_token', 'ct0'] as const;
const TWITTER_URL = 'https://x.com/';
const TWITTER_ORIGINS: string[] = ['https://x.com/', 'https://twitter.com/'];
const DEFAULT_COOKIE_TIMEOUT_MS = 30_000;

function normalizeValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cookieHeader(authToken: string, ct0: string): string {
  return `auth_token=${authToken}; ct0=${ct0}`;
}

function buildEmpty(): TwitterCookies {
  return { authToken: null, ct0: null, cookieHeader: null, source: null };
}

function readEnvCookie(cookies: TwitterCookies, keys: readonly string[], field: 'authToken' | 'ct0'): void {
  if (cookies[field]) {
    return;
  }
  for (const key of keys) {
    const value = normalizeValue(process.env[key]);
    if (!value) {
      continue;
    }
    cookies[field] = value;
    if (!cookies.source) {
      cookies.source = `env ${key}`;
    }
    break;
  }
}

function resolveSources(cookieSource?: CookieSource | CookieSource[]): CookieSource[] {
  if (Array.isArray(cookieSource)) {
    return cookieSource;
  }
  if (cookieSource) {
    return [cookieSource];
  }
  return ['safari', 'chrome', 'firefox'];
}

function labelForSource(source: CookieSource, profile?: string): string {
  if (source === 'safari') {
    return 'Safari';
  }
  if (source === 'chrome') {
    return profile ? `Chrome profile "${profile}"` : 'Chrome default profile';
  }
  return profile ? `Firefox profile "${profile}"` : 'Firefox default profile';
}

function pickCookieValue(
  cookies: Array<{ name?: string; value?: string; domain?: string }>,
  name: (typeof TWITTER_COOKIE_NAMES)[number],
): string | null {
  const matches = cookies.filter((c) => c?.name === name && typeof c.value === 'string');
  if (matches.length === 0) {
    return null;
  }

  const preferred = matches.find((c) => (c.domain ?? '').endsWith('x.com'));
  if (preferred?.value) {
    return preferred.value;
  }

  const twitter = matches.find((c) => (c.domain ?? '').endsWith('twitter.com'));
  if (twitter?.value) {
    return twitter.value;
  }

  return matches[0]?.value ?? null;
}

/**
 * Resolve Twitter credentials from multiple sources.
 * Priority: CLI args > environment variables > browsers (ordered).
 */
export async function resolveCredentials(options: {
  authToken: string;
  ct0: string;
}): Promise<CookieExtractionResult> {
  const warnings: string[] = [];
  const cookies = buildEmpty();
 
  cookies.authToken = options.authToken;
  cookies.source = 'CLI argument';

  cookies.ct0 = options.ct0;
  if (!cookies.source) {
    cookies.source = 'CLI argument';
  }

  readEnvCookie(cookies, ['AUTH_TOKEN', 'TWITTER_AUTH_TOKEN'], 'authToken');
  readEnvCookie(cookies, ['CT0', 'TWITTER_CT0'], 'ct0');

  if (cookies.authToken && cookies.ct0) {
    cookies.cookieHeader = cookieHeader(cookies.authToken, cookies.ct0);
    return { cookies, warnings };
  }

  return { cookies, warnings };
}
