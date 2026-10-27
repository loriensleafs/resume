import { createFileRoute, notFound } from '@tanstack/react-router'
import { getResume } from '../../resume'

export const Route = createFileRoute('/deep-dives/$id')({
  loader: async ({ params }) => {
    const resume = await getResume()
    const dive = resume.deepDives.find((d) => d.id === params.id)
    if (!dive) throw notFound()
    return dive
  },
  component: DeepDive,
})

function DeepDive() {
  const dive = Route.useLoaderData()
  return (
    <article>
      <h1>{dive.title}</h1>
      <p className="body">{dive.body}</p>
    </article>
  )
}
