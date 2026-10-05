/**
 * The build exports with `trailingSlash: true`, so the router reports
 * "/calendar/" rather than "/calendar". A plain `pathname === href` therefore
 * only ever matched Home, which is the one route whose slash cannot move.
 */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return trim(pathname) === trim(href);
}

function trim(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}
