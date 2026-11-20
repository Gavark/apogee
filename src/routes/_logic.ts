/** `/` has no page of its own: the site root and the PWA start_url land on the app or the login. */
export function rootRedirectTarget(user: unknown): '/app' | '/login' {
  return user ? '/app' : '/login';
}
