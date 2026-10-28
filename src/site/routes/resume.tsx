import { createFileRoute } from "@tanstack/react-router";
import siteData from "virtual:site-data";
import { pageHead } from "../page-head";
import { AppBar } from "../shell/AppBar";
import { ResumeView } from "../shell/ResumeView";

// The standalone resume page (SPEC-site, Standalone pages). The loader reads the module made at build time, so the page
// needs no server, also after a click from another page (decision 0023).
export const Route = createFileRoute("/resume")({
  loader: () => siteData.resume,
  // The title is the documents' own, "<name> — Resume" (the Word file's title and the print preview's); the
  // description is the lead. head() reads the same build-time module as the loader.
  head: () =>
    pageHead({
      path: "/resume",
      title: `${siteData.resume.basics.name} — Resume`,
      description: siteData.resume.basics.summary,
    }),
  component: ResumePage,
});

function ResumePage() {
  const resume = Route.useLoaderData();
  return (
    <>
      <AppBar basics={resume.basics} />
      <main>
        {/* The page's heading is Peter's name, as the documents open with it. The app bar already shows the name, and
            no board draws this page, so the heading is for screen readers and search engines only. */}
        <h1 className="visually-hidden">{resume.basics.name}</h1>
        <ResumeView resume={resume} />
      </main>
    </>
  );
}
