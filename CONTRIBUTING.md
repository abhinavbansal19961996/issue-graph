# Contributing

Issues and focused pull requests are welcome.

Unless explicitly stated otherwise, contributions submitted for inclusion in
this project are licensed under Apache-2.0.

## Setup

Use pnpm and Node.js 20.19.x or 22.12+ for source development; Node.js 24 is recommended. The compiled CLI still targets Node.js 20 or later. Cloning the INTERNAL `vercel-labs/issue-graph` repository requires access and an authenticated GitHub CLI.

```bash
gh auth login
gh repo clone vercel-labs/issue-graph
cd issue-graph
pnpm install --frozen-lockfile
```

## Verify changes

```bash
pnpm check
```

Add or update tests for behavior changes. Keep the graph core runtime-agnostic,
and keep filesystem or subprocess dependencies out of the main package entry
point.

For transport changes, also compare both implementations against a live public
repository:

```bash
pnpm exec tsx scripts/verify-transports.ts <number> <owner/repo> <depth>
```
