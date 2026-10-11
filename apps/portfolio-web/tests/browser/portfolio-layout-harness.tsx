import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  PortfolioLayoutEditor,
  usePortfolioLayout,
} from "@/features/portfolio/layout/public";
import { ProfileCard } from "@/features/portfolio/ProfileResults";
import { clientSchema } from "@/features/portfolio/contracts";
export const layoutClients = ["Aerospace One", "Civic Two", "Energy Three"].map(
  (name, index) =>
    clientSchema.parse({
      id: `10000000-0000-4000-8000-00000000000${index + 1}`,
      name,
      profileType: "CLIENT",
      profileStatus: "ACTIVE",
      status: "active",
      sectorTag: "Synthetic sector",
      website: null,
      logoUrl: null,
    }),
);
export function PortfolioLayoutHarness() {
  const cache = useQueryClient();
  const [cards, setCards] = useState(layoutClients);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const actor = () =>
      cache.setQueryData(["identity"], {
        user: {
          id: "30000000-0000-4000-8000-000000000002",
          email: "other@example.test",
        },
        tenant: {
          id: "20000000-0000-4000-8000-000000000002",
          name: "Other synthetic tenant",
        },
        role: "standard_user",
      });
    const catalog = () => setCards((values) => values.slice(1));
    const unmount = () => setShown(false);
    const invalidate = () =>
      void cache.invalidateQueries({
        queryKey: ["identity"],
        refetchType: "none",
      });
    window.addEventListener("layout-actor-change", actor);
    window.addEventListener("layout-catalog-change", catalog);
    window.addEventListener("layout-unmount", unmount);
    window.addEventListener("layout-authority-invalidate", invalidate);
    return () => {
      window.removeEventListener("layout-actor-change", actor);
      window.removeEventListener("layout-catalog-change", catalog);
      window.removeEventListener("layout-unmount", unmount);
      window.removeEventListener("layout-authority-invalidate", invalidate);
    };
  }, [cache]);
  return (
    <main className="page">
      <h1>Portfolio</h1>
      {shown && <Ordering cards={cards} />}
    </main>
  );
}
function Ordering({ cards }: { cards: typeof layoutClients }) {
  const layout = usePortfolioLayout(cards.map((card) => card.id));
  return (
    <PortfolioLayoutEditor
      cards={cards}
      layout={layout}
      renderCard={(id) => {
        const client = cards.find((card) => card.id === id);
        return client ? <ProfileCard client={client} /> : null;
      }}
    />
  );
}
