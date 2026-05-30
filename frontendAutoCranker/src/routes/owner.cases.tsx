import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/owner/cases")({
  component: () => <Outlet />,
});
