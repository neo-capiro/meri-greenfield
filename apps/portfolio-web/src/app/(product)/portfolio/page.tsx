import { PortfolioIndex } from "@/features/portfolio/PortfolioIndex";
import { readConfig } from "@/shared/config/config";
export default function Page() {
  return <PortfolioIndex destinations={readConfig(process.env).destinations} />;
}
