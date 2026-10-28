import { createFileRoute } from "@tanstack/react-router";
import siteData from "virtual:site-data";
import { pageHead } from "../page-head";
import { AppBar } from "../shell/AppBar";
import { CareerTimeline } from "../shell/CareerTimeline";
import { ResumeView } from "../shell/ResumeView";

// The workspace (SPEC-site, Views). Until the workspace's own views arrive, it shows the career timeline band, then the
// resume view. The loader reads the module made at build time, so the page needs no server, also after a click from
// another page (decision 0023).
export const Route = createFileRoute("/")({
  loader: () => ({ resume: siteData.resume, timeline: siteData.timeline }),
  // The title is Peter's name alone, as the installed-app board draws it in the app's title bar; the description is
  // the lead. head() reads the same build-time module as the loader.
  head: () =>
    pageHead({ path: "/", title: siteData.resume.basics.name, description: siteData.resume.basics.summary }),
  component: Workspace,
});

function Workspace() {
  const { resume, timeline } = Route.useLoaderData();
  return (
    <>
      <AppBar basics={resume.basics} />
      <main>
        <CareerTimeline timeline={timeline} />
        <ResumeView resume={resume} />
      </main>
    </>
  );
}
