export function BriefDate({ value }: { value: string | null }) {
  if (!value) return <>Not provided</>;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  const label = Number.isNaN(date.getTime())
    ? value
    : dateOnly
      ? date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })
      : date.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        });
  return (
    <time dateTime={value} title={value}>
      {label}
    </time>
  );
}
