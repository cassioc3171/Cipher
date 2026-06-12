/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { savePendingShare, type PendingShareTargetPayload } from './lib/shareTarget';

declare let self: ServiceWorkerGlobalScope;

const appScopeUrl = new URL(self.registration.scope);
const shareTargetUrl = new URL('share-target', appScopeUrl.href);

function asString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

async function persistSharedRequest(request: Request): Promise<Response> {
  const formData = await request.formData();
  const files = formData.getAll('sharedFiles')
    .filter((entry): entry is File => entry instanceof File)
    .map((file) => ({
      blob: file,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
    }));

  const payload: PendingShareTargetPayload = {
    title: asString(formData.get('title')),
    text: asString(formData.get('text')),
    url: asString(formData.get('url')),
    files,
    receivedAt: Date.now(),
  };

  await savePendingShare(payload);

  const redirectUrl = new URL(appScopeUrl.href);
  redirectUrl.searchParams.set('share-target', '1');
  return Response.redirect(redirectUrl.toString(), 303);
}

/* ── Precache (static build assets) ── */
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== shareTargetUrl.pathname) return;
  event.respondWith(persistSharedRequest(event.request));
});

/* ── Google Fonts stylesheets (stale-while-revalidate) ── */
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' }),
);

/* ── Google Fonts webfont files (cache-first, long-lived) ── */
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

/* ── Images in same origin (cache-first) ── */
registerRoute(
  ({ request, url }) => request.destination === 'image' && url.origin === self.location.origin,
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

/* ── Prompt SW skip-waiting from client ── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
