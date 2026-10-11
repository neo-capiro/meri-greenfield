import { RelationshipsPage } from "@/features/relationships/RelationshipsPage";
import { readConfig } from "@/shared/config/config";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <RelationshipsPage
      clientId={clientId}
      destinations={readConfig(process.env).destinations}
    />
  );
}
