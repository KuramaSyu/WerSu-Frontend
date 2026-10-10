/**
 * True when the viewer is on a public share route (/public/*).
 * One predicate, imported by hooks, components, and Bootstrap.
 */
export const isPublicPathname = (pathname: string): boolean =>
  pathname.startsWith("/public/");
