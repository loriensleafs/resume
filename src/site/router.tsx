// TanStack Start calls getRouter() for each request and once in the browser, so each call returns a new router.
// https://tanstack.com/start/latest/docs/framework/react/guide/routing#the-router
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true });
}
