import { ClientOverview } from "@/features/client-profile/ClientOverview";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <ClientOverview clientId={clientId} />;
}
