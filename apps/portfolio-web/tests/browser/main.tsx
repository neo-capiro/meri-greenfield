import { createRoot } from "react-dom/client";
import { DataProvider } from "@/shared/api/provider";
import { Shell } from "@/shared/shell/Shell";
import { ClientFrame } from "@/features/client-profile/ClientFrame";
import { ClientOverview } from "@/features/client-profile/ClientOverview";
import { PastPerformance } from "@/features/client-profile/past-performance/public";
import { PortfolioIndex } from "@/features/portfolio/PortfolioIndex";
import { ObjectivesPage } from "@/features/objectives/ObjectivesPage";
import { WorkPage } from "@/features/work/WorkPage";
import { RelationshipsPage } from "@/features/relationships/RelationshipsPage";
import { CapabilitiesPage } from "@/features/capabilities/CapabilitiesPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { FilesPage } from "@/features/files/FilesPage";
import { ProspectsIndex } from "@/features/prospects/ProspectsIndex";
import { ProspectDetail } from "@/features/prospects/ProspectDetail";
import { BillTrackerPage } from "@/features/bill-tracker/BillTrackerPage";
import { OpportunitiesPage } from "@/features/opportunities/OpportunitiesPage";
import { RegistrantIntakeHarness } from "./registrant-intake-harness";
import { EmailComposeHarness } from "./email-compose-harness";
import { MeetingDocumentsHarness } from "./meeting-documents-harness";
import { ProfileToolsHarness } from "./profile-tools-harness";
import { VoiceHarness } from "./voice-harness";
import { ThreadMailHarness } from "./thread-mail-harness";
import { PortfolioLayoutHarness } from "./portfolio-layout-harness";
import { CalendarSyncHarness } from "./calendar-sync-harness";
import { GlobalObjectiveHarness } from "./global-objective-harness";
import { ProfileCapacityHarness } from "./profile-capacity-harness";
import { MemberNotesHarness } from "./member-notes-harness";
import { BillingSummaryHarness } from "./billing-summary-harness";
import { MeetingReviewHarness } from "./meeting-review-harness";
import {
  PublicEventHarness,
  PublicEventCalendarHarness,
} from "./public-event-harness";
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
  if (path === "/__test/registrant-intake") return <RegistrantIntakeHarness />;
  if (path === "/__test/email-compose") return <EmailComposeHarness />;
  if (path === "/__test/meeting-documents") return <MeetingDocumentsHarness />;
  if (path === "/__test/profile-tools") return <ProfileToolsHarness />;
  if (path === "/__test/voice-source") return <VoiceHarness />;
  if (path === "/__test/thread-mail") return <ThreadMailHarness />;
  if (path === "/__test/public-event") return <PublicEventHarness />;
  if (path === "/__test/portfolio-layout") return <PortfolioLayoutHarness />;
  if (path === "/__test/calendar-sync") return <CalendarSyncHarness />;
  if (path === "/__test/global-objective") return <GlobalObjectiveHarness />;
  if (path === "/__test/profile-capacity") return <ProfileCapacityHarness />;
  if (path === "/__test/member-notes") return <MemberNotesHarness />;
  if (path === "/__test/billing-summary") return <BillingSummaryHarness />;
  if (path === "/__test/meeting-review") return <MeetingReviewHarness />;
  if (path === "/__test/past-performance")
    return (
      <Shell destinations={destinations}>
        <PastPerformance
          clientId="10000000-0000-4000-8000-000000000001"
          clientName="Test Aerospace"
        />
      </Shell>
    );
  const [, , clientId, tab] = path.split("/");
  if (clientId === "prospects")
    return tab ? (
      <ProspectDetail id={tab} destinations={destinations} />
    ) : (
      <ProspectsIndex destinations={destinations} />
    );
  if (path === "/calendar")
    return (
      <Shell destinations={destinations}>
        <PublicEventCalendarHarness />
      </Shell>
    );
  if (!clientId) return <PortfolioIndex destinations={destinations} />;
  const content =
    tab === "opportunities" ? (
      <OpportunitiesPage clientId={clientId} destinations={destinations} />
    ) : tab === "bills" ? (
      <BillTrackerPage
        clientId={clientId}
        backend={
          new URLSearchParams(window.location.search).get("testBackend") ===
          "core"
            ? "core"
            : "intelligence"
        }
        destinations={destinations}
      />
    ) : tab === "files" ? (
      <FilesPage clientId={clientId} destinations={destinations} />
    ) : tab === "objectives" ? (
      <ObjectivesPage clientId={clientId} />
    ) : tab === "work" ? (
      <WorkPage clientId={clientId} destinations={destinations} />
    ) : tab === "relationships" ? (
      <RelationshipsPage clientId={clientId} destinations={destinations} />
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
