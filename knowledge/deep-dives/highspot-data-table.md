---
id: highspot-data-table
title: The Polar UI data table, built on TanStack Table
role: highspot
highlights: [4]
status: approved
approved: 2026-10-26
source: Interview with Peter, 2026-10-26
---

## Problem

Polar UI had no data table component. The AI chat being built into the Highspot app needed advanced table rendering, and other teams needed it too: sorting, filtering, selection and large data across many screens. The old table component had an extremely poorly put-together API that was very difficult to use, so teams avoided building new table features. The table could not be built on AG Grid, because an AG Grid Enterprise license was blocked.

## What Peter did

Peter wrote the table's specs, 21 specs and 189 requirement documents, through the agent workflow system. He designed its API and built it on TanStack Table. Because of the way the polar-ui MCP was built, exporting the data table from Polar UI's public API was enough to make it available to every agent through the MCP.

## How it worked

The table was built on TanStack Table and styled with Polar UI. It supported sorting; filtering, including filters by data type (text, number, date, boolean and sets of values, with operators); pagination and filtering with both server-side and client-side data; row selection with bulk actions; CSV export; editing; custom cell rendering; grouping, with saved column and filter state; virtualization for large data; column resizing and pinning; programmatic column ordering and visibility; customizable theming; and keyboard and screen reader accessibility.

## Result

The AI chat in the Highspot app used the table for its advanced tables, and Highspot got these capabilities without an AG Grid Enterprise license. Other teams very quickly started planning features around adopting it, because they no longer felt limited by the old table: the new one was easy to use and in line with Polar UI.

## Tools

React and TypeScript with Polar UI; TanStack Table, with TanStack Virtual for virtualization; Jest, Storybook and Chromatic for unit, story and visual regression tests. The specs were written through the agent workflow system.

## Not public

The contents of Highspot's internal product spec for the table: its people, internal links, licensing, estimates, targets and rollout plans. The table's source code, the old table's code and Highspot's internal repositories. The names of colleagues and Highspot's internal team structure.
