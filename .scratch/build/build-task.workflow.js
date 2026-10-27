export const meta = {
  name: 'build-task',
  description: 'Build one plan task in its own worktree, then review it with its tiered reviewers into one decisions.md',
  whenToUse: 'Each task of a /brain:build auto run, after Peter opted in to workflows (decision record row 165)',
  phases: [
    { title: 'Build', detail: 'one builder in its own git worktree' },
    { title: 'Review', detail: 'one review agent: the tiered reviewers, then decisions.md' },
  ],
}

// args: { id, title, kind, builderPrompt, spec, libraries, docsServer, reviewPoints, reviewFolder }
// kind is one of: code, docs or deletion, agent files, spike (rows 162 and 163).

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

const t = args

phase('Build')
const build = await agent(t.builderPrompt, {
  label: `build:${t.id}`,
  phase: 'Build',
  isolation: 'worktree',
  schema: BUILD_RESULT,
})

if (!build || build.stopped) {
  log(`${t.id}: no review, because the build ${build ? 'stopped' : 'returned nothing'}`)
  return { id: t.id, build, review: null }
}

phase('Review')
const reviewPrompt = [
  'Read /Users/peterkloss/Dev/resume/.scratch/build/review-agent-brief.md to its last line and follow it exactly.',
  '',
  `- Task: ${t.id} (${t.title}). Kind: ${t.kind}.`,
  `- Worktree (every command runs inside it): ${build.worktree}`,
  `- Diff: git diff ${build.base}..${build.tip}`,
  `- Spec and task body: ${t.spec}`,
  `- Library skills: ${t.libraries || 'none'}. Docs server: ${t.docsServer || 'not needed'}.`,
  `- Points to judge: ${t.reviewPoints || 'none beyond the brief'}`,
  `- The builder's report: ${build.reportPath}`,
  `- Review folder: ${t.reviewFolder}/${t.id}/`,
].join('\n')

const review = await agent(reviewPrompt, {
  label: `review:${t.id}`,
  phase: 'Review',
  model: 'sonnet',
})

return { id: t.id, build, review }
