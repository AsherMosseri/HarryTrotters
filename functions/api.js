// One always-warm callable, `api`, that answers for the app's other callables.
//
// Every callable is its own Cloud Run service, and each one sleeps when idle,
// so the first tap after a quiet spell waited seconds for it to start. Keeping
// one instance of each awake costs too much, so the app sends { fn, data }
// here instead and this one function stays awake (minInstances: 1).
//
// It runs the very same handler as the named function: firebase-functions
// v2's onCall result has .run(request), the handler itself, which gets the
// same request ({ data, auth, app, instanceIdToken, rawRequest,
// acceptsStreaming }) with data swapped for the inner data. The HTTP side
// (checking the sign-in token) already happened here, the same way it does
// for the named function. Its answer and its HttpsErrors come back unchanged.
//
// Only the names in API_FNS (functions/shared/api.js) can be reached: never a
// helper, a trigger or a schedule. Anything else is invalid-argument.
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { API_FNS } from './shared/api.js';

// One vCPU, so an instance can take many requests at once (Cloud Run needs a
// whole vCPU for concurrency above 1). With CPU only allocated during
// requests, an idle instance costs about $0.0000025 per vCPU-second plus
// $0.0000025 per GiB-second: 2,628,000 s a month × (1 + 0.5) × $0.0000025 ≈
// $9.86. 512 MiB (the others run on 256) leaves room for every kind of
// request landing on the same instance.
export const API_OPTIONS = {
  invoker: 'public',
  minInstances: 1,
  maxInstances: 10,
  concurrency: 80,
  cpu: 1,
  memory: '512MiB',
};

// callables: { name: the onCall function } for (at least) every name in API_FNS.
export function apiFunction(callables) {
  const routes = new Map(
    API_FNS.map((name) => {
      const fn = callables[name];
      // Fail the deploy loudly rather than answer "unknown" later.
      if (typeof fn?.run !== 'function') throw new Error(`api: ${name} is not a callable with .run()`);
      return [name, fn];
    }),
  );
  return onCall(API_OPTIONS, async (req) => {
    const body = req.data && typeof req.data === 'object' ? req.data : {};
    const { fn } = body;
    // The app's check that this function is live, and which names it takes.
    if (fn === 'ping') return { ok: true, fns: API_FNS };
    const target = typeof fn === 'string' ? routes.get(fn) : null;
    if (!target) throw new HttpsError('invalid-argument', 'Unknown function.', { unknownFn: true });
    // A missing data is null, as when the app calls the function directly.
    return target.run({ ...req, data: body.data ?? null });
  });
}
