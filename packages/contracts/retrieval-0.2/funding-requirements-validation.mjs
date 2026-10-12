/** Requirement reads preserve extraction and tenant review as separate facts. */
import { fundingInstant } from './funding-envelope-validation.mjs';
const fail = message => { throw new Error(message); };
export function assertFundingRequirements(data, envelope, input) {
  if (envelope.truncated) fail('Requirement pagination is not envelope truncation');
  if (data.source !== input.source || data.sourceRecordId !== input.sourceRecordId || data.generatedAt !== envelope.asOf)
    fail('Requirement source/clock substitution');
  fundingInstant(data.generatedAt);
  const page = data.pagination, count = data.requirements.length;
  if (page.offset !== input.offset || page.limit !== input.limit || count > page.limit ||
      page.nextOffset !== (page.hasMore ? page.offset + count : null) || page.hasMore && count === 0)
    fail('Requirement page substitution or non-progressing continuation');
  // A short returned page proves the extra-fetched-row branch did not fire.
  // Only a later count showing more rows can justify its continuation.
  if (count < page.limit && page.hasMore !== (count > 0 && page.total !== null && page.offset + count < page.total))
    fail('Short requirement page has no source basis for continuation');
  if (page.total !== null && count > 0 && page.offset + count < page.total && !page.hasMore)
    fail('Requirement page hides known continuation');
  if ((count > 0 || (page.total !== null && page.total > 0)) !== (data.coverage === 'available'))
    fail('Requirement coverage cannot turn an exhausted page into no conditions');
  for (const row of data.requirements) {
    if (!row.id.trim() || !row.statement.trim() || !row.extractionModel.trim() ||
        row.sourceExcerpt.length === 0 || row.sourceExcerpt.length > 2000 ||
        row.excerptEnd <= row.excerptStart || row.excerptEnd - row.excerptStart !== row.sourceExcerpt.length)
      fail('Requirement quoted UTF-16 span is malformed');
    if (row.supersededAt !== null) fundingInstant(row.supersededAt);
  }
  // No document text or content hash appears in this read projection. Shape and
  // span checks cannot verify the quote, establish a current mandatory condition,
  // elevate pending/rejected reviews, or undo supersession. Count reads and page
  // reads may race; do not invent snapshot consistency from total alone.
}
