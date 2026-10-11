import { BillTrackerPage } from "@/features/bill-tracker/BillTrackerPage";
import { readConfig } from "@/shared/config/config";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const config = readConfig(process.env);
  return (
    <BillTrackerPage
      clientId={clientId}
      backend={config.trackerBackend}
      destinations={config.destinations}
    />
  );
}
