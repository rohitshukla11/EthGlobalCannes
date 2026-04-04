/**
 * Whether `href` should show as active for the current pathname.
 * Console also matches `/agent/.../interact` so the nav stays coherent.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/console") {
    return (
      pathname === "/console" ||
      (pathname.startsWith("/agent/") && pathname.endsWith("/interact"))
    );
  }
  if (href === "/marketplace") {
    return pathname.startsWith("/marketplace") || pathname.startsWith("/agents");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
