import { createServerFn } from '@tanstack/react-start'

export type DeepDive = { id: string; title: string; body: string }
export type Resume = { name: string; headline: string; deepDives: DeepDive[] }

// Runs only on the server (during prerender at build time).
export const getResume = createServerFn({ method: 'GET' }).handler(async () => {
  const text = await Bun.file(`${process.cwd()}/data/resume.yaml`).text()
  const data = Bun.YAML.parse(text) as Resume
  return { ...data, runtime: `bun ${Bun.version}` }
})
