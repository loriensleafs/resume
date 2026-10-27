import { createFileRoute } from "@tanstack/react-router";
import { resume } from "virtual:site-data";
import { ResumeView } from "../shell/ResumeView";

// The standalone resume page (SPEC-site, Standalone pages). The loader reads the module made at build time, so the page
// needs no server, also after a click from another page (decision 0023).
export const Route = createFileRoute("/resume")({
  loader: () => resume,
  component: ResumePage,
});

function ResumePage() {
  return (
    <main>
      <ResumeView resume={Route.useLoaderData()} />
    </main>
  );
}
