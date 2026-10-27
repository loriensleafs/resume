import { createFileRoute } from "@tanstack/react-router";

// The standalone resume page (SPEC-site, Standalone pages). The page holds only its main landmark until the
// resume view fills it.
export const Route = createFileRoute("/resume")({
  component: ResumePage,
});

function ResumePage() {
  return <main />;
}
