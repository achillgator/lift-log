// Tiny hash router: refreshes never 404 on static hosting.
export function currentRoute(): string {
  return location.hash.replace(/^#\/?/, '') || 'home';
}

export function onRouteChange(fn: (route: string) => void): () => void {
  const handler = () => fn(currentRoute());
  addEventListener('hashchange', handler);
  return () => removeEventListener('hashchange', handler);
}

export function go(route: string): void {
  location.hash = `#/${route}`;
}
