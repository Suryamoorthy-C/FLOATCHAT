# Task board

| ID | Task | Owner | Status | Depends On | Notes |
|---|---|---|---|---|---|
| G-01 | Initialize app and env example | Glue | Todo | — | Confirm project name |
| G-02 | Create Supabase project, device tables, and sample telemetry | Glue | Todo | G-01 | Follow SECRETS.md |
| S-01 | Build responsive ocean-device dashboard | Surface | Todo | G-01 | Include all states |
| S-02 | Add anomaly banner, answer card, and examples | Surface | Todo | S-01 | Plain language |
| C-01 | Implement chat Route Handler | Core | Todo | G-01 | Keep keys server-side |
| C-02 | Add provider adapter and fallback | Core | Todo | C-01 | Return stable JSON |
| C-03 | Persist messages | Core | Todo | G-02,C-01 | Scope by user |
| G-03 | Connect UI to API and run QA | Glue | Todo | S-02,C-02 | Device-to-response golden path |
| G-04 | Deploy to Vercel | Glue | Todo | G-03 | Add env vars |
| ALL-01 | Rehearse demo and freeze scope | All | Todo | G-04 | Record backup path |
