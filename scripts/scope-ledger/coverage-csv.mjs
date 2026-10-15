/** Strict decoder for the audit's TOOL-COVERAGE-96.csv evidence. Pure; no IO. */

export const COVERAGE_HEADER = Object.freeze(['legacy_id', 'canonical_id', 'version', 'side_effect', 'declared_by_skills',
  'declared_current_contract', 'fable_group', 'legacy_source_line', 'source_url']);

const fail = message => { throw Object.assign(new Error(message), {code: 'COVERAGE_CSV_INVALID'}); };

/**
 * The supplied file is CRLF-terminated, unquoted and comma-separated; skill lists use ';'. Anything else
 * (quotes, a bare LF, a wrong column count, a duplicate legacy id) is refused rather than guessed.
 */
export function decodeCoverageCsv(text) {
  if (!text.endsWith('\r\n')) fail('Coverage CSV must end with CRLF');
  const lines = text.slice(0, -2).split('\r\n');
  if (lines.some(line => line.includes('\n') || line.includes('\r'))) fail('Coverage CSV mixes line endings');
  if (text.includes('"')) fail('Coverage CSV must be unquoted');
  const [header, ...body] = lines.map(line => line.split(','));
  if (header.join(',') !== COVERAGE_HEADER.join(',')) fail('Unexpected coverage CSV header');
  const rows = body.map((cells, index) => {
    if (cells.length !== COVERAGE_HEADER.length) fail(`Coverage CSV row ${index + 2} has ${cells.length} columns`);
    const row = Object.fromEntries(COVERAGE_HEADER.map((name, i) => [name, cells[i]]));
    if (!['True', 'False'].includes(row.declared_current_contract)) fail(`Bad declared flag for ${row.legacy_id}`);
    return {
      legacyId: row.legacy_id, canonicalId: row.canonical_id, version: row.version, sideEffect: row.side_effect,
      declaredBySkills: row.declared_by_skills ? row.declared_by_skills.split(';') : [],
      declaredCurrentContract: row.declared_current_contract === 'True', group: row.fable_group,
      legacySourceLine: Number(row.legacy_source_line), sourceUrl: row.source_url,
    };
  });
  if (new Set(rows.map(r => r.legacyId)).size !== rows.length) fail('Duplicate legacy id in coverage CSV');
  return {rows, lineCount: lines.length};
}
