import type { MatterDetail as Detail } from "./contracts";
import type { CorrectionContext } from "./CorrectionDialog";
import { RecordCard } from "./RecordCard";
export function MatterDetail({
  matter,
  canEdit,
  onEdit,
  onAdd,
  onCorrect,
}: {
  matter: Detail;
  canEdit: boolean;
  onEdit: () => void;
  onAdd: () => void;
  onCorrect: (context: CorrectionContext) => void;
}) {
  return (
    <>
      <div className="row">
        <span className="chip">{matter.status.replaceAll("_", " ")}</span>
        {canEdit && (
          <>
            <button className="button" onClick={onEdit}>
              Edit matter
            </button>
            <button className="button" onClick={onAdd}>
              Add advocacy record
            </button>
            <button
              className="button"
              onClick={() => onCorrect({ kind: "merge", matter })}
            >
              Merge another matter
            </button>
          </>
        )}
      </div>
      {matter.summary && <p>{matter.summary}</p>}
      <h3>Records ({matter.records.length})</h3>
      {matter.records.map((record) => (
        <RecordCard
          key={record.id}
          record={record}
          canEdit={canEdit}
          onCorrect={(kind) => onCorrect({ kind, matter, record })}
        />
      ))}
      {matter.records.length === 0 && (
        <p className="muted">No records in this matter.</p>
      )}
      <h3>Linked work ({matter.links.length})</h3>
      {matter.links.map((link) => (
        <p key={link.id}>
          {link.label ?? link.linkType} <code>{link.linkKey}</code>
        </p>
      ))}
    </>
  );
}
