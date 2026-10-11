/** Project only the current catalog; new cards retain the supplied canonical default order. */
export function orderedClientIds(
  saved: readonly string[],
  clients: readonly string[],
) {
  const current = new Set(clients);
  const result = [
    ...new Set(
      saved.map((token) => token.slice(7)).filter((id) => current.has(id)),
    ),
  ];
  return [...result, ...clients.filter((id) => !result.includes(id))];
}
export function moveClient(
  ids: readonly string[],
  id: string,
  position: number,
) {
  const from = ids.indexOf(id);
  if (from < 0 || position < 0 || position >= ids.length) return [...ids];
  const next = ids.filter((value) => value !== id);
  next.splice(position, 0, id);
  return next;
}
export function sameOrder(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((id, index) => right[index] === id)
  );
}
