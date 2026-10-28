import { createFileRoute } from "@tanstack/react-router";
import siteData from "virtual:site-data";
import { AppBar } from "../shell/AppBar";
import { ResumeView } from "../shell/ResumeView";

// The workspace (SPEC-site, Views). Until the workspace's own views arrive, it shows the resume view. The loader reads
// the module made at build time, so the page needs no server, also after a click from another page (decision 0023).
export const Route = createFileRoute("/")({
  loader: () => siteData.resume,
  component: Workspace,
});

function Workspace() {
  const resume = Route.useLoaderData();
  return (
    <>
      <AppBar basics={resume.basics} />
      <main>
        <ResumeView resume={resume} />
      </main>
    </>
  );
}
