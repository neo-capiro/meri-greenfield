"use client";
import { useChangeTeam } from "./mutations";
import { Dialog } from "@/shared/ui/Dialog";
import { QueryState } from "@/shared/ui/QueryState";
import { useMemberOptions, memberName } from "@/features/portfolio/public";
import { useIdentity, canAdminister } from "@/shared/auth/identity";
import { useTeam } from "./queries";
export function TeamDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const team = useTeam(clientId);
  const options = useMemberOptions();
  const identity = useIdentity();
  const canEdit = canAdminister(identity.data?.role);
  const mutation = useChangeTeam(clientId);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Account team"
      description="The firm's members assigned to this client."
    >
      <QueryState
        pending={team.isPending}
        error={team.error}
        retry={() => void team.refetch()}
      />
      <ul className="stack">
        {team.data?.map((member) => (
          <li className="row between" key={member.userId}>
            <span>
              <strong>{memberName({ ...member, id: member.userId })}</strong>
              <small>
                {" "}
                ·{" "}
                {member.isOwner
                  ? "Account owner"
                  : (member.role ?? "Team member")}
              </small>
            </span>
            {canEdit && !member.isOwner && (
              <button
                className="button ghost"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    kind: "remove",
                    userId: member.userId,
                  })
                }
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <>
          <QueryState
            error={options.error}
            retry={() => void options.refetch()}
          />
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              mutation.mutate({
                kind: "add",
                userId: String(form.get("userId")),
                role: String(form.get("role")),
              });
            }}
          >
            <label>
              Add team member
              <select name="userId" required disabled={!options.data}>
                <option value="">Choose a member</option>
                {options.data?.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberName(member)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Role
              <input name="role" maxLength={120} />
            </label>
            <button
              className="button"
              disabled={mutation.isPending || !options.data}
            >
              Add member
            </button>
          </form>
          <label>
            Account owner
            <select
              disabled={mutation.isPending || !options.data}
              value={team.data?.find((m) => m.isOwner)?.userId ?? ""}
              onChange={(event) =>
                mutation.mutate({
                  kind: "owner",
                  userId: event.target.value || null,
                })
              }
            >
              <option value="">Unassigned</option>
              {options.data?.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberName(member)}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <small>Account team changes require an administrator.</small>
      )}
      <QueryState error={mutation.error} />
      {mutation.isSuccess && <p role="status">Team updated.</p>}
    </Dialog>
  );
}
