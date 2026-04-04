/**
 * Whether `href` should show as active for the current pathname.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/marketplace") {
    return pathname.startsWith("/marketplace") || pathname.startsWith("/agents");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
