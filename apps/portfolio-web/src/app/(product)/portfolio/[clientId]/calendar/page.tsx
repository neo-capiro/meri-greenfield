import { CalendarPage } from "@/features/calendar/CalendarPage";
import { readConfig } from "@/shared/config/config";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <CalendarPage
      clientId={clientId}
      destinations={readConfig(process.env).destinations}
    />
  );
}
