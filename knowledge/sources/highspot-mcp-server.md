---
id: highspot-mcp-server
title: The polar-ui MCP server, the design system's contract for AI coding agents
kind: deep-dive
subject: project
roles: [highspot]
highlights: [highlight:highspot.1]
summary: How Peter led the organization-wide effort on the polar-ui MCP server, designed and built it, and how it became a standard part of every Cursor and Claude Code setup for front-end work at Highspot.
links: []
status: approved
approved: 2026-10-27
source: Interview with Peter, 2026-10-26
---

## Problem

Before the polar-ui MCP server, AI coding agents at Highspot often sampled the Highspot app at random and copied the legacy UI components they found there, instead of using the Polar UI design system. Sometimes they did not know Polar UI existed. When agents did use Polar UI, they guessed props, variants and patterns that do not exist. Agents could read designs through the Figma MCP but could not map them to the right Polar UI components. Complex components, such as the data table, were assembled inconsistently, with poor architecture and an inconsistent user experience.

## What Peter did

Peter led the organization-wide effort. He designed and built the server, and he defined what it exposes to agents. He made sure the official Figma MCP, provided by Figma, worked together with the polar-ui MCP: agents picked up designs through the Figma MCP, then used the polar-ui MCP to build them. He gave the organization-wide introduction to the polar-ui MCP, showing how it worked and why the team built it, and he demoed it to the executive team. He also wrote the Confluence documentation that explained to every team how to install and use it.

## How it worked

The server gave agents each component's API (props, variants and types), usage rules, and working examples and composition patterns. It lived in the Polar UI codebase. It was built on an enhanced version of Polar UI's public API export, which was generated from the components' TypeScript types and doc comments. Because of that, every new component was included in the MCP automatically, and the MCP was always fully up to date. Peter also wrote the rules that went into the application's AGENTS.md, telling its agents how to use the polar-ui MCP.

## Result

The polar-ui MCP became a standard part of every Cursor and Claude Code setup for front-end work at Highspot, used by about 100 people across all application teams, design and product. Agent-written UI used Polar UI components instead of legacy ones, building screens from Figma designs got faster, and code reviews needed fewer design-system fixes. Application developers moved much faster: agents built full Figma designs accurately with Polar UI components, so developers could focus on their application-specific logic. Product owners built much more accurate prototypes and answered Polar UI questions for themselves and their teams. The Polar UI platform team also used the MCP when it built new design-system components on top of existing ones.

## Tools

TypeScript with the official Model Context Protocol TypeScript SDK, Bun, and Polar UI's generated public API export. The MCP worked alongside the official Figma MCP, in Cursor and Claude Code.

## Not public

The server's source code, its internal tool names and its configuration. Highspot's application code, its legacy components and its internal repositories. The names of colleagues and executives, and Highspot's internal team structure.
