import { CalendarPage } from "@/features/calendar/CalendarPage";
import { Shell } from "@/shared/shell/Shell";
import { readConfig } from "@/shared/config/config";
export default function Page() {
  const { destinations } = readConfig(process.env);
  return (
    <Shell destinations={destinations}>
      <CalendarPage destinations={destinations} />
    </Shell>
  );
}
