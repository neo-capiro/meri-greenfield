"use client";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, GripVertical } from "lucide-react";
import type { PortfolioLayoutState } from "./usePortfolioLayout";
import { moveClient, sameOrder } from "./ordering";
import styles from "./layout.module.css";

export type PortfolioLayoutCard = { id: string; name: string };
/** Inline current organization cards; parent owns the single layout read hook. */
export function PortfolioLayoutEditor({
  cards,
  renderCard,
  layout,
}: {
  cards: readonly PortfolioLayoutCard[];
  renderCard: (id: string) => ReactNode;
  layout: PortfolioLayoutState;
}) {
  return (
    <EditorSession
      key={layout.scope}
      cards={cards}
      renderCard={renderCard}
      layout={layout}
    />
  );
}
function EditorSession({
  cards,
  renderCard,
  layout,
}: {
  cards: readonly PortfolioLayoutCard[];
  renderCard: (id: string) => ReactNode;
  layout: PortfolioLayoutState;
}) {
  const [draft, setDraft] = useState<{ scope: string; ids: string[] } | null>(
    null,
  );
  const [dragged, setDragged] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const ids = draft?.scope === layout.scope ? draft.ids : layout.orderedIds;
  const changed =
    draft?.scope === layout.scope && !sameOrder(draft.ids, layout.orderedIds);
  const blocked =
    !layout.allowed || layout.saving || layout.uncertain || layout.conflict;
  const move = (id: string, position: number) => {
    if (blocked) return;
    setDraft({ scope: layout.scope, ids: moveClient(ids, id, position) });
    setAnnouncement(
      `${cards.find((card) => card.id === id)?.name ?? "Profile"} moved to position ${position + 1} of ${ids.length}.`,
    );
  };
  return (
    <section className={styles.surface} aria-label="Organization profile order">
      {layout.pending && <p role="status">Loading saved profile order…</p>}
      {layout.unavailable && (
        <p className="status" role="status">
          Saved profile ordering is unavailable in this environment. Profiles
          use their default order.
          <button className="button" onClick={() => void layout.retry()}>
            Retry saved order
          </button>
        </p>
      )}
      {layout.permissionDenied && (
        <p className="status" role="status">
          Your role does not allow changing saved profile order.
        </p>
      )}
      {layout.error && !layout.unavailable && (
        <div className="status error" role="alert">
          <p>{layout.error.message}</p>
          {!layout.uncertain && !layout.conflict && (
            <button className="button" onClick={() => void layout.retry()}>
              Retry saved order
            </button>
          )}
        </div>
      )}
      <div className={styles.grid}>
        {ids.map((id, index) => {
          const name = cards.find((card) => card.id === id)?.name ?? "Profile";
          return (
            <div
              key={id}
              className={styles.item}
              data-client-id={id}
              onDragOver={(event) => {
                if (!blocked && dragged) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged) move(dragged, index);
                setDragged(null);
              }}
            >
              {renderCard(id)}
              <div className={styles.controls}>
                <button
                  className="button ghost"
                  aria-label={`Drag ${name} to rearrange`}
                  draggable={!blocked}
                  disabled={blocked}
                  onDragStart={(event) => {
                    setDragged(id);
                    event.dataTransfer.setData("text/plain", id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragged(null)}
                >
                  <GripVertical size={14} aria-hidden="true" />
                </button>
                <span className="muted">
                  {index + 1} of {ids.length}
                </span>
                <button
                  className="button ghost"
                  aria-label={`Move ${name} earlier`}
                  disabled={blocked || index === 0}
                  onClick={() => move(id, index - 1)}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                </button>
                <button
                  className="button ghost"
                  aria-label={`Move ${name} later`}
                  disabled={blocked || index === ids.length - 1}
                  onClick={() => move(id, index + 1)}
                >
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.hint}>
        Drag any card to rearrange · your layout is saved to your profile
      </p>
      <p className="srOnly" role="status" aria-live="polite">
        {announcement}
      </p>
      {layout.uncertain && (
        <div className="status" role="alert">
          <p>
            The save may have completed. Check the saved order before making
            another change.
          </p>
          <button
            className="button"
            disabled={layout.saving}
            onClick={() =>
              void layout.reconcile().then((resolved) => {
                if (resolved) {
                  setDraft(null);
                  setAnnouncement("Saved order confirmed.");
                }
              })
            }
          >
            Check saved order
          </button>
        </div>
      )}
      {layout.conflict && (
        <div className="status" role="alert">
          <p>
            The saved order changed. Your unsaved order is retained. Review the
            latest saved order before continuing.
          </p>
          {layout.latestAvailable && (
            <ol aria-label="Latest saved profile order">
              {layout.orderedIds.map((id) => (
                <li key={id}>
                  {cards.find((card) => card.id === id)?.name ?? "Profile"}
                </li>
              ))}
            </ol>
          )}
          <button
            className="button"
            disabled={layout.saving || !layout.latestAvailable}
            onClick={() => {
              setDraft(null);
              layout.acceptLatest();
              setAnnouncement(
                "Latest saved order loaded. Review before rearranging.",
              );
            }}
          >
            Use latest saved order
          </button>
          <button
            className="button"
            disabled={layout.saving}
            onClick={() => void layout.reconcile()}
          >
            Reload latest saved order
          </button>
        </div>
      )}
      {changed && !layout.uncertain && !layout.conflict && (
        <div className={styles.actions}>
          <button
            className="button"
            disabled={layout.saving}
            onClick={() => {
              setDraft(null);
              setAnnouncement("Reordering canceled.");
            }}
          >
            Cancel reorder
          </button>
          <button
            className="button primary"
            disabled={blocked}
            onClick={() =>
              void layout.save(ids).then((saved) => {
                if (saved) {
                  setDraft(null);
                  setAnnouncement("Profile order saved.");
                }
              })
            }
          >
            {layout.saving ? "Saving…" : "Save order"}
          </button>
        </div>
      )}
    </section>
  );
}
