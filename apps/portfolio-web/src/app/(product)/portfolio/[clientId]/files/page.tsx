import { FilesPage } from "@/features/files/FilesPage";
import { readConfig } from "@/shared/config/config";
export default async function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  return (
    <FilesPage
      clientId={clientId}
      destinations={readConfig(process.env).destinations}
    />
  );
}
