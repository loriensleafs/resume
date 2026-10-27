import { createFileRoute } from "@tanstack/react-router";

// The workspace (SPEC-site, Views). The page holds only its main landmark until the views fill it.
export const Route = createFileRoute("/")({
  component: Workspace,
});

function Workspace() {
  return <main />;
}
