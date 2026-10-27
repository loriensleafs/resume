import { createFileRoute, Link } from '@tanstack/react-router'
import { getResume } from '../resume'
import { DsButton } from '../ds-button'

export const Route = createFileRoute('/')({
  loader: () => getResume(),
  component: Home,
})

function Home() {
  const resume = Route.useLoaderData()
  return (
    <main>
      <h1>{resume.name}</h1>
      <p id="headline">{resume.headline}</p>
      <p id="runtime">Built with {resume.runtime}</p>
      <ul>
        {resume.deepDives.map((d) => (
          <li key={d.id}>
            <Link to="/deep-dives/$id" params={{ id: d.id }}>{d.title}</Link>
          </li>
        ))}
      </ul>
      <p>
        <a href="/resume.pdf">PDF</a> · <a href="/resume.docx">Word</a> · <a href="/resume.txt">Text</a>
      </p>
      <DsButton />
    </main>
  )
}
