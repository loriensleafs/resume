import { createFileRoute } from "@tanstack/react-router";
import siteData from "virtual:site-data";
import { AppBar } from "../shell/AppBar";
import { ResumeView } from "../shell/ResumeView";

// The standalone resume page (SPEC-site, Standalone pages). The loader reads the module made at build time, so the page
// needs no server, also after a click from another page (decision 0023).
export const Route = createFileRoute("/resume")({
  loader: () => siteData.resume,
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
