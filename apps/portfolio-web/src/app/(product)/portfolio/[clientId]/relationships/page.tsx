import { RelationshipsPage } from "@/features/relationships/RelationshipsPage";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return <RelationshipsPage clientId={clientId} />;
}
