import { createRootRoute, HeadContent, Outlet, Scripts, createFileRoute, lazyRouteComponent, createRouter } from "@tanstack/react-router";
import { jsxs, jsx } from "react/jsx-runtime";
const Route$1 = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JSONL Smart Viewer" }
    ]
  }),
  component: RootComponent
});
function RootComponent() {
  return /* @__PURE__ */ jsxs("html", { lang: "zh-CN", className: "dark", children: [
    /* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxs("body", { className: "bg-background text-foreground antialiased", children: [
      /* @__PURE__ */ jsx(Outlet, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const $$splitComponentImporter = () => import("./index-C0OmvIBb.js");
const Route = createFileRoute("/")({
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const IndexRoute = Route.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$1
});
const rootRouteChildren = {
  IndexRoute
};
const routeTree = Route$1._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true
  });
}
export {
  getRouter
};
