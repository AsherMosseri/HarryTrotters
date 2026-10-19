// Picks the backend: ?demo in the URL runs fully offline with sample data.
export const isDemo = new URLSearchParams(location.search).has('demo');

export async function loadStore() {
  if (isDemo) return (await import('./demoStore.js')).demoStore;
  return (await import('./firebaseStore.js')).firebaseStore;
}
