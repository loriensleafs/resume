---
id: fednow-architecture
title: FedNow's front-end architecture and its migration
kind: deep-dive
subject: project
roles: [fednow]
highlights: [highlight:fednow.1]
summary: How Peter led the design of FedNow's routing-based front-end architecture, with its shared packages, and how the whole application moved to it without delaying any features or the launch.
links: []
status: approved
approved: 2026-10-27
source: Interview with Peter, 2026-10-26
---

## Problem

The Federal Reserve had no standardized front-end tooling, standards, architecture or patterns for FedNow. The FedNow internal and external applications had no standards and were not scalable: every team did everything differently. Product, UX, back-end, QA and security were not aligned on the front end, security requirements shaped every decision, and all of it happened under the pressure of FedNow's launch.

## What Peter did

When Peter joined, he became the lead for the FedNow Design System platform team and led that team in building the FedNow Design System. Once its 1.0 version was built, the team took on FedNow's front-end tooling: all of its npm packages. The team was then charged with auditing the FedNow internal and external applications. From that audit, Peter led the team in designing a modern, scalable, performant architecture, completely different from what existed. They set the standard, wrote a roadmap, built and published the suite of packages it needed, and planned the migration to the new architecture.

## How it worked

The architecture combined micro-frontends, shared packages, one build and tooling setup, and standard application patterns. The team wrote a standardized routing package; a standardized query package built on React Query, but more opinionated, with standards built in; a form package; and a build utilities package that generated and compiled front-end applications consistently.

It was a routing-based architecture: applications were organized by routes instead of pages, in a standardized, recursive, nested routing structure that every application used. Each further level of sub-routes repeated the same structure. That made it easy to split bundles by route, and it introduced a container-based architecture: complex logic was hoisted up into containers, and simple presentational ("dumb") components were rendered into them.

React Query was standardized across the entire application, which enabled prefetching, query deduplication and query caching, and gave a large increase in performance. Routing patterns were standardized too, including route queries and query parameters, and the team introduced the idea of query or route as state. The team also standardized linting and its rules, and the patterns for form state. All of it was documented in detail in Confluence.

The new architecture was implemented incrementally, a little at a time, alongside ongoing feature work.

## Result

The entire application was migrated to the new architecture without delaying any features or the FedNow launch. Performance increased dramatically. Every application worked the same way, features were delivered faster, and there were fewer bugs. Because everything was documented and standardized, working with other teams became much easier. The team introduced weekly office hours, and the standardization made troubleshooting other developers' problems much easier. Other teams ramped up much more quickly and learned how to build these more complex front ends.

## Tools

React and TypeScript; React Query, under the team's opinionated query package; React Router, Formik and Chakra UI, used under the hood; and webpack, Rollup and Vite for builds. These are some of the main tools, not a complete list.

## Not public

FedNow's security controls, infrastructure and environments, and anything about how FedNow is protected. The names and internals of FedNow applications, internal repositories and code. The names of colleagues and the Federal Reserve's internal team structure.
