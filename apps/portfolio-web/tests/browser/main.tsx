import { createRoot } from "react-dom/client";
import { DataProvider } from "@/shared/api/provider";
import { Shell } from "@/shared/shell/Shell";
import { ClientFrame } from "@/features/client-profile/ClientFrame";
import { ClientOverview } from "@/features/client-profile/ClientOverview";
import { PortfolioIndex } from "@/features/portfolio/PortfolioIndex";
import { ObjectivesPage } from "@/features/objectives/ObjectivesPage";
import { WorkPage } from "@/features/work/WorkPage";
import { RelationshipsPage } from "@/features/relationships/RelationshipsPage";
import { CapabilitiesPage } from "@/features/capabilities/CapabilitiesPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { FilesPage } from "@/features/files/FilesPage";
import { usePathname } from "./navigation";
import "@/app/globals.css";
import "./test-font.css";
// Deliberately only loopback destinations; intercepts cannot reach live APIs.
const destinations = {
  existingApp: "http://127.0.0.1:5191/existing",
  meri: "http://127.0.0.1:5191/meri",
};
function App() {
  const path = usePathname();
  const [, , clientId, tab] = path.split("/");
  if (path === "/calendar")
    return (
      <Shell destinations={destinations}>
        <CalendarPage destinations={destinations} />
      </Shell>
    );
  if (!clientId) return <PortfolioIndex destinations={destinations} />;
  const content =
    tab === "files" ? (
      <FilesPage clientId={clientId} destinations={destinations} />
    ) : tab === "objectives" ? (
      <ObjectivesPage clientId={clientId} />
    ) : tab === "work" ? (
      <WorkPage clientId={clientId} destinations={destinations} />
    ) : tab === "relationships" ? (
      <RelationshipsPage clientId={clientId} />
    ) : tab === "capabilities" ? (
      <CapabilitiesPage clientId={clientId} destinations={destinations} />
    ) : tab === "calendar" ? (
      <CalendarPage clientId={clientId} destinations={destinations} />
    ) : (
      <ClientOverview clientId={clientId} />
    );
  return (
    <ClientFrame clientId={clientId} destinations={destinations}>
      {content}
    </ClientFrame>
  );
}
createRoot(document.getElementById("root")!).render(
  <DataProvider>
    <App />
  </DataProvider>,
);
