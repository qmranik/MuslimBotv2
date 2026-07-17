// Authentik-delegated auth config.
//
// Identity is owned by Authentik (OIDC + Traefik ForwardAuth) — GenUI never
// collects passwords. These helpers build the URLs for Authentik's hosted
// login / enrollment / logout flows. All are env-overridable.

const AUTHENTIK_URL = (process.env.NEXT_PUBLIC_AUTHENTIK_URL || '').replace(/\/$/, '');
const LOGIN_FLOW = process.env.NEXT_PUBLIC_AUTHENTIK_LOGIN_FLOW || 'default-authentication-flow';
const ENROLL_FLOW = process.env.NEXT_PUBLIC_AUTHENTIK_ENROLLMENT_FLOW || 'default-enrollment-flow';
const INVALIDATION_FLOW = process.env.NEXT_PUBLIC_AUTHENTIK_INVALIDATION_FLOW || 'default-invalidation-flow';

// Where to land after a successful sign-in.
export const POST_LOGIN_PATH = '/command-center';

export const authConfigured = Boolean(AUTHENTIK_URL);

function returnTo() {
  if (typeof window === 'undefined') return '';
  return encodeURIComponent(window.location.origin + POST_LOGIN_PATH);
}

function flowUrl(slug, withNext) {
  // No Authentik URL configured (e.g. local dev behind ForwardAuth): just
  // navigate into the app — ForwardAuth will trigger Authentik if required.
  if (!AUTHENTIK_URL) return POST_LOGIN_PATH;
  const base = `${AUTHENTIK_URL}/if/flow/${slug}/`;
  return withNext ? `${base}?next=${returnTo()}` : base;
}

export function getLoginUrl() {
  return flowUrl(LOGIN_FLOW, true);
}

export function getSignupUrl() {
  return flowUrl(ENROLL_FLOW, true);
}

export function getLogoutUrl() {
  if (!AUTHENTIK_URL) return '/login';
  return flowUrl(INVALIDATION_FLOW, false);
}
