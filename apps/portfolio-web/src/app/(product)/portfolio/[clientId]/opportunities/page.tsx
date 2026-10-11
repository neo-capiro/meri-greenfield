import { OpportunitiesPage } from "@/features/opportunities/OpportunitiesPage";
import { readConfig } from "@/shared/config/config";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <OpportunitiesPage
      clientId={clientId}
      destinations={readConfig(process.env).destinations}
    />
  );
}
