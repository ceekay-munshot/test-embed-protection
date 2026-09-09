---
name: dashboard-skill
description: Build Munshot embedded financial dashboards with standard color palette, SDK/auth context, datasource, and export rules.
---

# Dashboard Skill

Use this skill when building or reviewing Munshot embedded dashboards. It defines how dashboards should look, how they communicate with the Munshot host, which APIs they may call, and how common financial dashboard types should be structured.

Dashboards built with this skill should feel native to Munshot: iframe-ready, consistent, source-aware, and suitable for repeated financial analysis.

## How To Use This Skill

Read only the reference files needed for the task, then follow them strictly.

Recommended order for building a new dashboard:

1. `reference/ui-standards.md`
2. `reference/auth-standards.md`
3. `reference/datasource-registry.md`
4. `reference/embed-protection.md`

## Reference Files

- `reference/ui-standards.md`
  - category badge colors
  - design token color palette (primary, backgrounds, borders, text, error colors)

- `reference/auth-standards.md`
  - Munshot Dashboard SDK requirements
  - host context contract
  - JWT/session handling
  - selected ticker handling
  - `useHostContext`
  - SDK communication patterns
  - visual snapshot request channel

- `reference/datasource-registry.md`
  - registered datasources
  - backend service mapping
  - base URLs
  - request and response fields
  - auth and rate-limit expectations

- `reference/embed-protection.md`
  - required `_headers` and `_middleware.js` files
  - placement constraints and allowed host origins
  - post-deploy verification

## Non-Negotiable Rules

- Build the actual dashboard as the first screen, not a landing page.
- Use the color palette from `ui-standards.md`.
- Use the Munshot Dashboard SDK and host context; do not create standalone auth.
- Read bearer token from `context.session.token`.
- Read ticker from `context.market.selectedTicker`.
- Use only datasources registered in `datasource-registry.md`.
- Always create the `_headers` and `_middleware.js` embed-protection files in the dashboard repo, following `embed-protection.md`.
- Show source/provenance for web, news, document, AI, or extracted data.
- Implement loading, empty, error, partial-data, and visual export states.
