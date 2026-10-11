import { Dialog } from "@/shared/ui/Dialog";
import styles from "./preparation.module.css";

export function PreparationProgress({
  saved,
  stage,
  canCancel,
  onClose,
  onCancel,
}: {
  saved: boolean;
  stage?: string;
  canCancel: boolean;
  onClose: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Preparing your briefing"
      description="Meri is reading the meeting’s evidence."
      className={styles.dialog}
    >
      <p className="muted" role="status">
        {saved
          ? "Progress is saved. You can close this page while preparation runs."
          : "Waiting for the saved job receipt."}
        {stage && ` Current stage: ${stage.replaceAll("_", " ")}.`}
      </p>
      <footer className="row">
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button className="button" disabled={!canCancel} onClick={onCancel}>
          Cancel preparation
        </button>
      </footer>
    </Dialog>
  );
}
