import { readConfig } from "@/shared/config/config";
import { ProspectDetail } from "@/features/prospects/ProspectDetail";
export default async function Page({
  params,
}: {
  params: Promise<{ prospectId: string }>;
}) {
  const { prospectId } = await params;
  return (
    <ProspectDetail
      id={prospectId}
      destinations={readConfig(process.env).destinations}
    />
  );
}
