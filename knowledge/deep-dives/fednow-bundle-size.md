---
id: fednow-bundle-size
title: Cutting FedNow's initial bundle from over 15 MB to under 1 MB
role: fednow
highlights: [2]
status: approved
approved: 2026-10-26
source: Interview with Peter, 2026-10-26
---

## Problem

FedNow's applications had an initial bundle of over 15 MB. The first load took an incredibly long time, and the applications were generally not performant. Builds and deployments were slow. The shared packages were CommonJS, so unused code could not be tree-shaken away. For application developers, the developer experience was, in Peter's words, "rough".

## What Peter did

Peter did the initial audit of the application and found what made the bundles so large. He wrote the complete roadmap for the architecture refactor, including every npm package to build, how each would be used and the patterns behind them. He planned the work into the Jira backlog, led it, and took it to leadership. He rebuilt the shared packages as ES modules and set up the code splitting and the new build setup.

## How it worked

The bundle came down through code splitting and lazy loading, micro-frontends, a new build setup, fewer heavy dependencies, and the design system and shared packages rebuilt as tree-shakeable ES modules instead of CommonJS. A Git plugin analyzed module sizes and flagged oversized modules for further splitting.

## Result

The initial bundle went from over 15 MB to under 1 MB across multiple applications, without delaying FedNow's launch. The applications loaded much faster the first time, application developers had a much better experience, and builds and deployments got faster. The Git plugin kept new oversized modules from creeping back in, so the size stayed under control.

## Tools

A bundle analyzer to see what each bundle contained; Lighthouse and browser DevTools to measure load performance; the Git plugin that analyzed module sizes; and the tools of the new architecture: React, React Query and the team's build utilities package.

## Not public

FedNow's security controls, infrastructure and environments, and anything about how FedNow is protected. The names and internals of FedNow applications, internal repositories and code. The names of colleagues and the Federal Reserve's internal team structure.
