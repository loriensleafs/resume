---
id: highspot-ai-standards
title: The AI development standards Peter introduced at Highspot
kind: deep-dive
subject: project
roles: [highspot]
highlights: [highlight:highspot.2]
summary: "How Peter introduced many of the team's AI development standards: spec-driven development, shared skills and agents, agent context files, and rules that keep agents on Polar UI components."
links: []
status: approved
approved: 2026-10-27
source: Interview with Peter, 2026-10-26
---

## Problem

The engineers had been given a mandate to lean into AI agents, but no framework or direction for doing it. Many did not know how to use AI deeply and powerfully in development, so they still wrote much of their code by hand, or used agents only minimally. In Peter's view, giving developers tools to use agents well is critical for a mandate like that; the polar-ui MCP served the same purpose.

AI coding agents also started each session without the project's context, and every developer's agent setup differed. Agents looked everything up from scratch every time, because research and analysis from earlier work were not kept anywhere they could find.

## What Peter did

Peter introduced many of the team's AI development standards. He wrote the repository's agent context files (CLAUDE.md and AGENTS.md), checked shared skills and agents into the repository for everyone, and made specs the starting point for agent work. He also taught the standards to the team and reviewed their adoption.

## How it worked

The standards were spec-driven development, shared skills and agents checked into the repository, agent context files (CLAUDE.md, AGENTS.md), and rules that keep agents on Polar UI components. Shared artifacts, such as analysis and research, were persisted into the project and made available through semantic search over MCP. Agents searched those memories instead of looking everything up from scratch every time, and the knowledge built up over time.

## Result

Agents gave consistent results for every developer on the team. They used fewer tokens, because they searched the shared memories instead of starting over; for a component as large as the data table, which does a great many things, Peter calls this "really powerful". Developers began using their specs to have agents create the Jira epics, stories and tasks, which made backlog planning much easier. The team could communicate, plan and deliver more work, more reliably.

## Tools

Claude Code and Cursor, with CLAUDE.md, AGENTS.md, shared skills, agents and rules; Basic Memory's MCP for semantic search over the shared analysis and research; and Jira, where agents created epics, stories and tasks from specs.

## Not public

What Highspot's CLAUDE.md, AGENTS.md, skills and rules actually say. The names of colleagues and Highspot's internal team structure.
