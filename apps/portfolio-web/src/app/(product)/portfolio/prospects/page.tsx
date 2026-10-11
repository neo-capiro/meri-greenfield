import { readConfig } from "@/shared/config/config";
import { ProspectsIndex } from "@/features/prospects/ProspectsIndex";
export default function Page() {
  return <ProspectsIndex destinations={readConfig(process.env).destinations} />;
}
