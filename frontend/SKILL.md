---
name: novara-frontend
description: Frontend implementation guidance for Novara's Next.js App Router application. Use when changing frontend routes, dashboards, POS, shared UI, client state, or API integration.
---

# Novara frontend development

Use this skill when implementing or reviewing code in `frontend/`.

## Project conventions

- Inspect the existing frontend structure and follow its established components, hooks, API clients, schemas, and naming conventions. Extend working code instead of replacing it wholesale.
- Before changing Next.js behavior, read the relevant documentation shipped with the installed Next.js version under `node_modules/next/dist/docs` as required by `frontend/AGENTS.md`.
- Keep route-specific code with its feature. Put genuinely shared UI in the existing shared component locations; do not create duplicate navigation, dialogs, tables, or form primitives.
- Use the installed shadcn/ui components and Tailwind design tokens. Preserve the Novara visual system, responsive layouts, accessible labels, keyboard interaction, and touch-sized controls.
- Use React Hook Form and existing Zod schemas for validated forms where those patterns are established.

## Data, permissions, and tenancy

- Use the existing typed API client and query conventions. Confirm backend routes and response types instead of inventing endpoint shapes.
- Include selected tenant and branch through established API client/context mechanisms. Never trust identifiers supplied only by the browser; the backend must authorize and scope every request.
- Treat frontend role checks as presentation and navigation hints. The backend remains authoritative for authorization and tenant isolation.
- Do not expose owner-only financial details to roles lacking the corresponding capability. Kitchen views must not display payment or price data unless requirements explicitly allow it.
- Keep POS cart state in the existing POS store. Do not introduce a competing source of truth for orders or session state.

## Implementation and verification

- Preserve server/client component boundaries. Add client components only where browser interaction or client state requires them.
- Handle loading, empty, error, and success states for asynchronous views and actions. Give users a useful retry path without hiding failures.
- Make mutations resilient to duplicate submissions and display actionable validation/API errors using existing patterns.
- Avoid dependencies unless the current stack cannot meet the requirement.
- After changes, run the narrowest relevant typecheck, lint, tests, or build command available in `frontend/package.json`; report checks that cannot run and why.
