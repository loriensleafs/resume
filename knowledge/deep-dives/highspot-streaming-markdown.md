---
id: highspot-streaming-markdown
title: The streaming Markdown component in the Polar UI design system
role: highspot
highlights: [4]
status: approved
approved: 2026-10-26
source: Interview with Peter, 2026-10-26
---

## Problem

Highspot's AI features streamed model answers in as Markdown, and the Polar UI design system had no component for it. A design-system component was needed so that streamed Markdown rendered correctly and efficiently, and in line with the design system's styles. Elsewhere in the application, several existing Markdown parsing and rendering libraries were already in use.

## What Peter did

Peter designed the component's API, built its streaming renderer, styled it with Polar UI, and wrote its tests and documentation. The component consolidated the Markdown functionality that was spread across the application into a single component, so the Markdown experience was consistent for users and developers across the application, whether the Markdown streamed into an AI chat or was rendered all at once elsewhere.

## How it worked

The component rendered both streamed and non-streamed Markdown through the same path. It handled unfinished syntax while a stream was still arriving, and it re-rendered only new text instead of the whole document. Several caching mechanisms inside it gave it very high rendering performance. It was built on existing Markdown parsers.

Building it was not just a matter of picking a library. Highspot's application was on React 17, as Peter recalls, and the more modern, high-performance Markdown renderers needed a newer React. Few existed at the time, and the only new streaming renderer was very new and did not support Highspot's React version.

## Result

The component shipped as part of Polar UI and gave Highspot one consistent Markdown experience across the application, streamed or not, with very high rendering performance. Highspot's AI features adopted it, and all new functionality was required to use it. That was easy to follow, because it was part of Polar UI: every part of the application being updated to Polar UI used it as the Markdown component.

## Tools

React and TypeScript, Jest, Storybook, and Chromatic, which the design system used for visual regression testing. It was built on existing Markdown parsers; Peter built it some time ago, no longer has access to the code, and does not remember which parsers they were.

## Not public

The component's source code, its caching implementation and Highspot's internal repositories. The names of colleagues and Highspot's internal team structure.
