# Dev Server Reliability

This repo uses a guarded startup path to reduce local Next.js instability (stale chunks, missing CSS/assets, startup 500s).

## Default behavior

Run:

```bash
npm run dev
```

What this now does:

1. Stops any process currently bound to port 3000.
2. Removes `apps/web/.next`.
3. Starts the web app dev server.
4. Verifies homepage readiness.
5. Validates emitted `/_next/static/*` asset URLs return HTTP 200.
6. Automatically retries once from a clean state if validation fails.

## Extra scripts

- `npm run dev:raw`: starts the web app directly with no cleanup/validation.
- `npm run dev:reset`: same guarded startup path as `dev`.

## Failure signature to watch

If you see errors like the following, it indicates stale server build artifacts:

- `Cannot find module './<chunk>.js'`
- stack paths referencing `.next/server/webpack-runtime.js`

The guarded startup script is designed to self-heal this path automatically.

## If issues still persist

1. Ensure no parallel dev server is running from another terminal.
2. Run `npm run dev:reset`.
3. If still broken, run `npm run type-check` to rule out compile-time regressions unrelated to cache/chunks.
