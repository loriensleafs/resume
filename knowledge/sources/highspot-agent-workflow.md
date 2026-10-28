---
id: highspot-agent-workflow
title: The agent workflow system for Highspot's platform team
kind: deep-dive
subject: project
roles: [highspot]
highlights: [highlight:highspot.3, highlight:highspot.4]
summary: How Peter designed the team's agent workflow, wrote its agents and skills, built its tooling in TypeScript on Bun, and how the team used it to build a streaming Markdown component and a data table.
links: []
status: approved
approved: 2026-10-27
source: Interview with Peter, 2026-10-26
---

## Problem

Before the agent workflow system, developers on the team simply wrote custom prompts every time they worked with an AI agent. There was no workflow framework or system, and no spec-driven development or anything like it.

## What Peter did

Peter designed the workflow, wrote its agents and skills, built its tooling in TypeScript on Bun, and introduced it to the team. Because the approach was so new to the team, he introduced it in a standalone session for the whole team, then ran one-on-one sessions with each developer who started using it in their development workflow.

## How it worked

The agents and skills were based on a forked and enhanced version of the open-source ai-agents project (rjmurillo/ai-agents). It provided a library of specialist agents (analyst, architect, implementer, QA, security, critic and others) and skills, plus an orchestrator agent that routed work to the right agents automatically. Developers were moved through the right parts of the workflow for the specific needs of what they were working on. Its quality gates, such as critic reviews and QA passes, meant the team did not take agents at their word: an agent's work was independently validated before it was accepted and the work moved on.

Peter did not use ai-agents' own memory solution. For the workflow's memory he used Basic Memory, run locally. Basic Memory stores knowledge as plain Markdown files; each file is a node, and its observations and relations together form a knowledge graph. The memory files lived in the codebase. On startup, Basic Memory ran locally for each developer and provided semantic search over that knowledge through MCP, alongside the code; reading and writing the Markdown files also went through MCP. This let the team work on a project over many sessions and rehydrate each session's context in a targeted way through MCP search.

The enhanced agents and skills, together with an MCP wrapper around the Basic Memory MCP, were packaged as a Claude plugin that unified the tooling and made it easy to use. Specs became dependency-mapped plans in which plans and tasks both carried dependencies, so up to four developers and their agents could see which work was unblocked, claimed, or safe to run in parallel.

## Result

The team used the system to build two major components: the streaming Markdown component and the data table, which was defined by 21 specs and 189 requirement documents. It supported up to four developers and their agents, and in Peter's words it "could easily support more". Several developers and their agents could work on one feature at the same time without collisions. Specs, plans and code came out as consistent, reviewable artifacts, and long features kept their context across many sessions through the shared memory. The team's velocity and quality went up. The system also shaped Peter's later work, including his brain plugin.

## Tools

TypeScript and Bun; a Claude plugin; a forked and enhanced version of the open-source ai-agents project (rjmurillo/ai-agents) for agents, skills and the orchestrator; Basic Memory (Markdown files, a knowledge graph, semantic search) for memory; and MCP, including a wrapper around the Basic Memory MCP.

## Not public

The source code of the team's ai-agents fork, and the plugin's code and configuration. What the team's specs, plans and memory files said about Highspot's work. The names of colleagues and Highspot's internal team structure.
