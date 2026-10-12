// Result consistency only: no source clock, policy lookup or deadline generation.
const fail = message => { throw new Error(message); };
const etParts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
const ymd = parts => `${parts.year}-${parts.month}-${parts.day}`;

export function assertPublicDataInstant(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value)
    fail('Public data requires a canonical serialized source instant');
}

export function assertPublicGrantDates(page, mode) {
  if (page.asOf !== page.generatedAt) fail('Grant source clock echo mismatch');
  const day = ymd(etParts(page.asOf));
  for (const row of page.data) {
    for (const field of ['openDate', 'closeDate']) if (row[field] !== null) {
      assertPublicDataInstant(row[field]);
      if (!row[field].endsWith('T00:00:00.000Z')) fail('Grant date must retain its stored UTC date');
    }
    const rawStatus = row.closeDate === null ? 'unknown' : row.closeDate.slice(0, 10) >= day ? 'open' : 'closed';
    if (row.deadlineStatus !== rawStatus) fail('Grant close-day status does not match its source anchor');
    if (Object.hasOwn(row, 'deadline') !== (mode === 'enforce')) fail('Grant deadline projection does not match trusted policy mode');
    if (mode !== 'enforce') continue;
    const deadline = row.deadline;
    if (deadline.basis === 'unknown') {
      if (['at', 'dateOnly', 'timeZone', 'daysRemaining'].some(key => deadline[key] !== null) || deadline.status !== 'unknown')
        fail('Unknown grant deadline cannot assert a date or status');
      if (!Object.hasOwn(deadline, 'rawText') && row.closeDate !== null)
        fail('Known stored close date needs a structured deadline unless source text qualifies it');
      continue;
    }
    if (Object.hasOwn(deadline, 'rawText') || row.closeDate === null || deadline.at === null ||
        deadline.dateOnly !== row.closeDate.slice(0, 10) || deadline.timeZone !== 'America/New_York')
      fail('Grant structured close-date lineage mismatch');
    assertPublicDataInstant(deadline.at);
    const end = etParts(deadline.at);
    if (ymd(end) !== deadline.dateOnly || end.hour !== '23' || end.minute !== '59' || end.second !== '59' ||
        !deadline.at.endsWith('.999Z')) fail('Grant deadline is not the end of its Eastern calendar day');
    const delta = Date.parse(deadline.at) - Date.parse(page.asOf);
    if (deadline.daysRemaining !== Math.ceil(delta / 86400000) || deadline.status !== (delta >= 0 ? 'open' : 'closed'))
      fail('Grant structured deadline calculation mismatch');
  }
}

export function assertPublicAwardDates(row, mode) {
  const fields = ['actionDate', 'latestActionDate', 'baseAwardSignedDate', 'sourceLastModifiedDate', 'popStartDate', 'popEndDate', 'lastSyncedAt'];
  for (const key of fields) if (row[key] !== null) assertPublicDataInstant(row[key]);
  if (Object.hasOwn(row, 'dates') !== (mode === 'enforce')) fail('Award date projection does not match trusted policy mode');
  if (mode !== 'enforce') return;
  for (const key of fields.filter(key => !['actionDate', 'lastSyncedAt'].includes(key)))
    if (row.dates[key] !== row[key]) fail('Award date kind was substituted');
  if (row.dates.capiroSyncedAt !== row.lastSyncedAt) fail('Award source sync anchor mismatch');
}
