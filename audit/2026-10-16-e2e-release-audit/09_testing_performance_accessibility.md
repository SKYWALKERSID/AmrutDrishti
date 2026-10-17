# Testing, performance, and accessibility

| Command | Result |
|---|---|
| `npm test` | 152 passed, 0 failed/skipped; 7.89s |
| `npx tsc --noEmit` | passed |
| `npm run build` | passed; Next.js 15.5.27; 11 static pages |
| `python -m pytest tests_py -q` | blocked: pytest missing |

Node emitted `MODULE_TYPELESS_PACKAGE_JSON` warnings. The build reports `/monitoring` at 242 kB first-load JS, the largest listed route. No browser profiling, Lighthouse, low-bandwidth, keyboard, screen-reader or responsive measurement was conducted.

`F-007` Medium: Python ML tests cannot execute in the supplied environment. Provide a pinned non-production Python environment and record the rerun.
