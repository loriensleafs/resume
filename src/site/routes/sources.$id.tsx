import { createFileRoute, notFound } from "@tanstack/react-router";
import siteData from "virtual:site-data";
import sourceJsonFiles from "virtual:site-source-json";
import { pageHead } from "../page-head";
import { AppBar } from "../shell/AppBar";
import { SourceView } from "../shell/SourceView";

// The standalone source page (SPEC-site, Standalone pages): one approved source at /sources/<id>, readable without
// JavaScript. The prerender writes one page per approved source (vite.config.ts). The loader reads the module made at
// build time and the source's JSON file, so the page needs no server, also after a click from another page
// (decision 0023). An unknown id is not found; the static output answers it with 404.html (SPEC-site, Workspace
// addresses).
export const Route = createFileRoute("/sources/$id")({
  loader: async ({ params }) => {
    // A Map and an array, never an object's property, so an id such as "constructor" names no source (SPEC-knowledge).
    const source = siteData.sources.find((approved) => approved.id === params.id);
    const loadJson = sourceJsonFiles.get(params.id);
    if (!source || !loadJson) throw notFound();
    const { kind, summary, passages } = await loadJson();
    // The build checks that each role of an approved source is in resume.yaml (SPEC-knowledge, Sources: Roles).
    const roles = source.roles.map((roleId) => {
      const role = siteData.resume.work.find((work) => work.id === roleId);
      if (!role) throw new Error(`source ${source.id}: the role ${roleId} is not in resume.yaml`);
      return { short: role.short, years: role.years };
    });
    return {
      basics: siteData.resume.basics,
      source: { id: source.id, title: source.title, kind, passages },
      summary,
      roles,
    };
  },
  // The title names the source, then Peter; the description is the source's summary, which Peter approves with it.
  head: ({ loaderData }) =>
    loaderData
      ? pageHead({
          path: `/sources/${loaderData.source.id}`,
          title: `${loaderData.source.title} — ${loaderData.basics.name}`,
          description: loaderData.summary,
        })
      : {},
  component: SourcePage,
});

function SourcePage() {
  const { basics, source, roles } = Route.useLoaderData();
  return (
    <>
      <AppBar basics={basics} />
      <main>
        <SourceView source={source} roles={roles} />
        {/* A plain link, not the router's: the workspace reads ?source= when the page loads (task S18), the page works
            without JavaScript, and the prerender's crawler follows it, so the build test proves that the prerender
            filter keeps /?source=<id> from overwriting index.html and from the sitemap (vite.config.ts). */}
        <p className="text-label-14">
          <a href={`/?source=${source.id}`}>Ask the chat about this</a>
        </p>
      </main>
    </>
  );
}
