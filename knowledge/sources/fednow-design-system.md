---
id: fednow-design-system
title: The FedNow design system and shared npm packages
kind: deep-dive
subject: project
roles: [fednow]
highlights: [highlight:fednow.3]
summary: How Peter led the team that built the FedNow design system to 1.0, with custom accessible components on Chakra UI, and then FedNow's shared routing, query, form and build utilities packages.
links: []
status: approved
approved: 2026-10-27
source: Interview with Peter, 2026-10-26
---

## Problem

FedNow had no design system. Each application built its own UI components, so the applications looked and behaved differently, the same components and utilities were rewritten in several places, and federal accessibility requirements had to be met one application at a time. Each application team had its own hand-rolled solutions, including hand-rolled Redux implementations and a massive number of context wrappers around the entire application. State was all over the place and inconsistent, nothing was co-located, and the application was very fragile. In Peter's words, "it was brutal".

## What Peter did

Peter led the FedNow Design System platform team from when he joined, and led the building of the design system to its 1.0 version. He built components himself, defined design tokens and theming, set up the publishing and versioning of the npm packages, and wrote the documentation and guided application teams onto the packages. After the design system, the team built FedNow's shared front-end packages: routing, query, form and build utilities.

## How it worked

The core of the design system was built on Chakra UI, but all of its components were the team's own custom UI components, themed with FedNow's design tokens. It was published as tree-shakeable ES modules, so applications shipped only what they used, and its components were accessible by default, so applications got accessibility without building it each time. Storybook documented the components for the design system team, a separate, more polished and complete documentation site served application developers, and further documentation lived in Confluence.

## Result

FedNow's internal and external applications used the design system and shared packages, as did its internal platform tools, including several QA applications. The applications got a consistent, accessible UI, they became less fragile as shared, tested components replaced hand-rolled ones, and teams built UI faster. The design system also became the foundation for the shared packages and the new front-end architecture.

## Tools

React and TypeScript, with Chakra UI at the core; Storybook; npm publishing and versioning; and Jest for unit tests. QA handled visual testing manually.

## Not public

FedNow's security controls, infrastructure and environments, and anything about how FedNow is protected. The names and internals of FedNow applications, internal repositories and code. The names of colleagues and the Federal Reserve's internal team structure.
