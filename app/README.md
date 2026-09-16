# ABCtross — app

The real implementation. Start with [`../docs/README.md`](../docs/README.md)
for what this is and why it's built this way — especially
[`../docs/09-roadmap.md`](../docs/09-roadmap.md) for what's real vs. still
a placeholder right now.

```bash
npm install
npm run dev      # http://localhost:5173 (or the next free port)
npm run build    # type-checks (tsc -b) then builds
npm run lint
```

No backend, no accounts — everything persists to `localStorage` in the
browser. Delete the browser's site data for this origin to reset
progress during development.
