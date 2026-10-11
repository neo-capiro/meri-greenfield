import { WorkPage } from "@/features/work/WorkPage";
import { readConfig } from "@/shared/config/config";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <WorkPage
      clientId={clientId}
      destinations={readConfig(process.env).destinations}
    />
  );
}
