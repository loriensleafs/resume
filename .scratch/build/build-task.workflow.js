export const meta = {
  name: 'build-task',
  description: 'Build one plan task in its own worktree, review it with its tiered reviewers, and merge their reports into one decisions.md',
  whenToUse: 'Each task of a /brain:build auto run, after Peter opted in to workflows (decision record row 165)',
  phases: [
    { title: 'Build', detail: 'one builder in its own git worktree' },
    { title: 'Review', detail: 'the tiered reviewers in parallel (rows 162 and 163)', model: 'sonnet' },
    { title: 'Merge', detail: 'one merge agent writes decisions.md', model: 'sonnet' },
  ],
}

// args: { id, title, kind, builderPrompt, spec, libraries, docsServer, reviewPoints, reviewFolder, build? }
// kind is one of: code, docs or deletion, agent files, spike, security fix check, fix check (rows 162 and 163;
// a fix check is the conductor's extra correctness review of one fix commit).
// A workflow agent has no Agent tool (found on D6's run, 2026-10-27), so this script starts
// the reviewers itself instead of handing them to one review agent.

const BRIEFS = '/Users/peterkloss/Dev/resume/.scratch/build'

// The plain-talk block (brain 0.6.0, plain-talk/AGENTS-block.md): the output style never reaches
// a sub-agent, so every builder prompt starts with it. Reviewers get it from review-brief.md.
const PLAIN_TALK = `## Talk plain

Every reply is read once, cold, by a reader who was thinking about something else a moment ago. Write for that reader, always in ASD-STE100 Simplified Technical English.

## Shape of a reply

1. Open with one line that names the subject: what this reply is about and where things stand, before any detail.
2. Give the answer or the outcome.
3. Add only what the reader needs in order to act. Leave the rest out.

## Sentences

Write ASD-STE100 Simplified Technical English:

- One idea per sentence, about 20 words at most.
- Active voice. Simple present tense where the fact is current.
- One word per concept, and the same word every time. Take each domain word from \`CONTEXT.md\`, the project's glossary. When \`CONTEXT-MAP.md\` exists at the root, the repo has several contexts and the map points to the \`CONTEXT.md\` for each. A word the glossary marks _Avoid_ stays out. A concept the glossary lacks is a gap to note for the domain-modeling skill, not a synonym to coin.
- Plain words. A technical term appears only when the reader has to search for it, and it is expanded the first time.

## Structure

- A table for a choice. A list for a sequence or for parallel items. Prose for a single line of argument.
- One or two sentences per bullet.
- Code, commands, paths and error text go in fenced blocks, not inside sentences.
- Headers only past about 300 words, and at most three.

## Before you send

Read the draft as that reader and check:

1. The first line says what this is about.
2. Every paragraph is four sentences or fewer.
3. Parallel items are a list, and a choice is a table.
4. Every term is one the reader already uses.

Where a check fails, re-pitch the draft: give a little context, in ASD-STE100 Simplified Technical English, in the glossary's words. Then check again. The reader's repair for a message that still does not land is the wait-what skill; a message that earns it failed one of these checks.`

const BUILD_RESULT = {
  type: 'object',
  properties: {
    worktree: { type: 'string', description: 'The absolute path of your git worktree' },
    branch: { type: 'string', description: 'The branch your commits are on' },
    base: { type: 'string', description: 'The commit you built on, after git merge --ff-only main' },
    tip: { type: 'string', description: 'Your last commit' },
    reportPath: { type: 'string', description: 'The absolute path of your full report file' },
    tests: { type: 'string', description: 'The counts of bun test: pass, fail, skip' },
    questions: { type: 'array', items: { type: 'string' }, description: 'Each question for Peter, with options and your recommendation' },
    stopped: { type: 'boolean', description: 'true when you stopped before your commit; the reason is in your report' },
  },
  required: ['worktree', 'branch', 'base', 'tip', 'reportPath', 'tests', 'questions', 'stopped'],
}

const REVIEW_RESULT = {
  type: 'object',
  properties: {
    reportPath: { type: 'string', description: 'The absolute path of your report file' },
    capability: { type: 'string', description: "Your report's first line, word for word: the skills you loaded through the Skill tool, and the docs server" },
    counts: { type: 'string', description: 'The count of findings by severity' },
  },
  required: ['reportPath', 'capability', 'counts'],
}

const MERGE_RESULT = {
  type: 'object',
  properties: {
    decisionsPath: { type: 'string', description: 'The absolute path of decisions.md' },
    counts: { type: 'string', description: 'The counts by severity after merging' },
    critical: { type: 'boolean', description: 'true when any finding is Critical' },
    forPeter: { type: 'boolean', description: 'true when the "For Peter" section holds a question' },
  },
  required: ['decisionsPath', 'counts', 'critical', 'forPeter'],
}

// One entry per reviewer: its report name, its axis files, and its axis skill.
const AXES = {
  correctness: { files: ['correctness.md'], skills: ['brain:test-driven-development'] },
  security: { files: ['security.md'], skills: ['brain:security-and-hardening'] },
  architecture: { files: ['architecture.md', 'structural-remedies.md'], skills: ['brain:codebase-design'] },
  'readability-performance': {
    files: ['readability.md', 'performance.md'],
    skills: ['brain:code-simplification', 'brain:performance-optimization'],
  },
}

const REVIEWERS = {
  code: ['correctness', 'security', 'architecture', 'readability-performance'],
  'docs or deletion': ['correctness', 'architecture'],
  'agent files': ['correctness', 'architecture', 'security'],
  spike: ['correctness', 'security', 'architecture'],
  'security fix check': ['security'],
  'fix check': ['correctness'],
}

const t = args
const folder = `${t.reviewFolder}/${t.id}`

// args.build, when given, is an earlier run's build result: only the review runs again.
phase('Build')
const build = t.build || await agent(`${PLAIN_TALK}\n\n${t.builderPrompt}`, {
  label: `build:${t.id}`,
  phase: 'Build',
  isolation: 'worktree',
  schema: BUILD_RESULT,
})
if (t.build) log(`${t.id}: review only, of the build at ${t.build.tip}`)

if (!build || build.stopped) {
  log(`${t.id}: no review, because the build ${build ? 'stopped' : 'returned nothing'}`)
  return { id: t.id, build, reviews: [], merge: null }
}

const axes = REVIEWERS[t.kind]
if (!axes) {
  log(`${t.id}: unknown kind "${t.kind}", so no review ran`)
  return { id: t.id, build, reviews: [], merge: null }
}

const diff = t.kind === 'security fix check' || t.kind === 'fix check'
  ? `git show ${build.tip}`
  : `git diff ${build.base}..${build.tip}`

function reviewerPrompt(axis, retry) {
  const a = AXES[axis]
  const name = axis === 'readability-performance' ? 'readability and performance' : axis
  return [
    `You are the ${name} reviewer of task ${t.id} (${t.title}) in Peter Kloss's resume repository.`,
    '',
    `First read ${BRIEFS}/review-brief.md to its last line and follow it exactly. Your axis files: ${a.files.map(f => `${BRIEFS}/axes/${f}`).join(' and ')}.`,
    '',
    `- Skills to load through the Skill tool, before you read any file: ask-user-question:ask-user-question, brain:code-review-and-quality, ${a.skills.join(', ')}.`,
    `- Library skills: ${t.libraries || 'none'}. Docs server: ${t.docsServer || 'not needed'}.`,
    `- Worktree (run every command inside it): ${build.worktree}`,
    `- Diff: ${diff}`,
    `- Spec and task body: ${t.spec}`,
    `- Points to judge: ${t.reviewPoints || 'none beyond the brief'}`,
    `- The builder's report: ${build.reportPath}`,
    `- Report file: ${folder}/${axis}.md`,
    retry ? '- Your first report was rejected: its first line did not name the skills you loaded through the Skill tool. Load them now, recheck the diff, and rewrite the report.' : '',
  ].filter(Boolean).join('\n')
}

// Row 147: a report whose first line does not name the skills loaded is rejected once.
function capabilityHolds(review) {
  if (!review || !review.capability) return false
  return review.capability.includes('brain:code-review-and-quality')
    && review.capability.includes('ask-user-question')
}

phase('Review')
const reviews = await parallel(axes.map(axis => async () => {
  const opts = { label: `review:${t.id}:${axis}`, phase: 'Review', model: 'sonnet', schema: REVIEW_RESULT }
  const first = await agent(reviewerPrompt(axis, false), opts)
  if (capabilityHolds(first)) return { axis, ...first }
  log(`${t.id}: the ${axis} report misses its capability line; one rerun`)
  const second = await agent(reviewerPrompt(axis, true), { ...opts, label: `review:${t.id}:${axis}:rerun` })
  return second ? { axis, ...second, rerun: true } : null
}))

const done = reviews.filter(Boolean)
const missing = axes.filter(axis => !done.some(r => r.axis === axis))
if (missing.length) log(`${t.id}: no report from ${missing.join(', ')}`)

phase('Merge')
const mergePrompt = [
  `Read ${BRIEFS}/merge-brief.md to its last line and follow it exactly.`,
  '',
  `- Task: ${t.id} (${t.title}). Kind: ${t.kind}.`,
  `- Review folder, with the reports: ${folder}/ (${done.map(r => `${r.axis}.md`).join(', ')})`,
  missing.length ? `- No report came from: ${missing.join(', ')}. Say so on line 2 of decisions.md.` : '',
  `- Spec and task body: ${t.spec}`,
  `- Worktree, to read the diff where a row needs it: ${build.worktree} (${diff})`,
  `- The builder's report: ${build.reportPath}`,
  `- The builder's questions for Peter (keep each one in "For Peter"): ${build.questions.length ? build.questions.map((q, i) => `(${i + 1}) ${q}`).join(' ') : 'none'}`,
].filter(Boolean).join('\n')

const merge = await agent(mergePrompt, {
  label: `merge:${t.id}`,
  phase: 'Merge',
  model: 'sonnet',
  schema: MERGE_RESULT,
})

return { id: t.id, build, reviews: done, missing, merge }
