import { CapabilitiesPage } from "@/features/capabilities/CapabilitiesPage";
import { readConfig } from "@/shared/config/config";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <CapabilitiesPage
      clientId={clientId}
      destinations={readConfig(process.env).destinations}
    />
  );
}
