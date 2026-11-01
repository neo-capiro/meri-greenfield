# What the model receives for the data, memory and mail reads

Rendered from the production composition (`reads/server.mjs`, `reads/tools.mjs`, `reads/options.mjs`, `reads/results.mjs`) by `reads/test/model-view-fixture.mjs`. Reads: `mail_read_thread`, `mail_list_messages`, `mail_search_messages`, `search_memory`, `describe_capiro_data`, `query_capiro_data`.

## System prompt sentence (`readPromptSentence`)

Only the read-only institutional source tools listed for this activity are enabled; every other institutional source is unavailable. Use text-to-SQL as the primary retrieval path for structured Capiro questions covered by the published relations. describe_capiro_data first supplies the available relations, fields, keys and coverage; then author SELECT SQL for query_capiro_data with bound parameters using its returned contract grammar and limits when present, otherwise the sql argument guidance. Public data is the default. For saved client business records use source client_records, preserving the current conversation scope; clientId only narrows access and never grants it. Join on full declared relationship keys and page by keyset on the complete ordered key. Keep integer and decimal strings exact, preserve nulls, and report rowLimitReached, byteTruncated and authored LIMIT separately. Query coverage is not source-universe completeness. Keep canonical IDs and source locators; derived SQL rows and aggregates are not immutable source passages. Use retained decisive readers for bill text, report excerpts and consolidated PE funding. The legacy global query tools still cover twelve datasets that the SQL relations do not replace. Before querying, clarify any ambiguity that changes the answer: client, jurisdiction, measure, fiscal versus calendar period, currency or units. Use declared grains and full join keys; aggregate parent amounts before joining child rows. An INVALID_QUERY, UNSUPPORTED_SQL, UNKNOWN_RELATION, UNKNOWN_FIELD or PARAMETER_MISMATCH refusal names the correction: rewrite the SQL within the stated grammar and run it again. A denied, unavailable, timed-out or invalid SQL query is not an empty result and must not trigger broader or unscoped retrieval; explain the failure without switching sources to evade it. Use another enabled authorized reader only when the described relations do not cover the question or original document/web evidence is needed, and disclose that coverage boundary. Ground totals in the returned rows and exact query parameters; preserve canonical IDs, source locators and truncation. generatedAt is query time, not source freshness; missing sourceAsOf/sourceVersion stays unknown.

## `meri_reads` server instructions

Read-only Meri institutional sources for this conversation. Preserve exact source IDs, versions, hashes and scopes; separate inference; disclose partial or unavailable evidence. An error result establishes no evidence, absence or completeness. No write, external action or artifact is exposed here.
Result states are distinct and never collapse: ACCESS_DENIED is a denied scope (user, client or conversation), not absent data; UNAVAILABLE is a read that is not enabled, installed or served here (unsupported operation); SOURCE_UNAVAILABLE is a served read whose source did not answer this call; INVALID_RESULT is a withheld malformed result. Only a successful result can show absent data, and only within the coverage it declares: an empty list is absence inside that page, window and source set, never proof of global absence. Partial or stale coverage is declared by the result fields each tool names (coverage, truncated, hasMore, nextCursor/nextPage, limitations, freshness, asOf). Cite the freshness or version field each tool names; a missing one stays unknown.
In General, client profile, documents, meeting sources, knowledge search and tracked bills require one explicit client UUID. Resolve a named client with lookup_client_registry first and use its returned UUID; ask the user to disambiguate multiple matches. A registry result does not grant access and these reads do not search across all clients. In a selected-client conversation, keep that selected client.
Available: Read stored mail thread sections; List stored mail message candidates; Search stored mail message candidates; Search memory; Describe Capiro data; Query Capiro data.
Other institutional sources are not available in this conversation.

## Tool `mail_read_thread`

### Description

Read stored mail thread sections. Prepare a typed stored-thread read after trusted current mailbox and client authorization.
Covers: Stored mailbox mail for the current actor (and an authorized client): list or search message candidates, and read one stored thread in bounded body sections.
Returns: Message candidates with asOf and record/snapshot versions; thread sections with UTF-16 offsets and body completeness; every message carries a decisive-read handle.
Result states: coverage and hasMore/continuation declare an incomplete page; missing versus empty body text is explicit; an empty page never proves an email or commitment did not exist.
Limits: UTF-16 code-unit offsets; source order has unspecified null and tied-date behavior. Stored eligibility is independent of connection status; removal and current authorization still apply. Snapshot and immutable record versions are unproven; incomplete transport never establishes evidence or absence.
Do not: Prove no commitment exists from an empty or partial thread.
Do not: Send or reply to email.
Canonical input schema urn:meri:retrieval:mail:0.2.0#/$defs/MailThreadInput, SHA256 e2be34336f7c9f370c3f9e3b8db7f99e92c2d16399716266f1e27eb6819811aa.
Supply literal arguments only; credentials and scope authority remain with the gateway.

### Input schema (`arguments`)

```json
{
 "type": "object",
 "properties": {
  "subject": {
   "oneOf": [
    {
     "type": "object",
     "properties": {
      "kind": {
       "type": "string",
       "const": "client"
      },
      "entityId": {
       "type": "string",
       "minLength": 1,
       "maxLength": 256
      }
     },
     "required": [
      "kind",
      "entityId"
     ],
     "additionalProperties": false
    },
    {
     "type": "object",
     "properties": {
      "kind": {
       "type": "string",
       "const": "personal"
      }
     },
     "required": [
      "kind"
     ],
     "additionalProperties": false
    }
   ]
  },
  "threadId": {
   "type": "string",
   "format": "uuid",
   "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
  },
  "messageId": {
   "anyOf": [
    {
     "type": "string",
     "format": "uuid",
     "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
    },
    {
     "type": "null"
    }
   ]
  },
  "messageOffset": {
   "type": "integer",
   "minimum": 0,
   "maximum": 10000
  },
  "bodyOffset": {
   "type": "integer",
   "minimum": 0,
   "maximum": 10000000
  },
  "limit": {
   "type": "integer",
   "minimum": 1,
   "maximum": 10
  },
  "maxCharacters": {
   "type": "integer",
   "minimum": 1,
   "maximum": 6000
  }
 },
 "required": [
  "subject",
  "threadId"
 ],
 "additionalProperties": false
}
```

## Tool `mail_list_messages`

### Description

List stored mail message candidates. Prepare incomplete stored message candidates under current trusted mailbox and client authorization.
Covers: Stored mailbox mail for the current actor (and an authorized client): list or search message candidates, and read one stored thread in bounded body sections.
Returns: Message candidates with asOf and record/snapshot versions; thread sections with UTF-16 offsets and body completeness; every message carries a decisive-read handle.
Result states: coverage and hasMore/continuation declare an incomplete page; missing versus empty body text is explicit; an empty page never proves an email or commitment did not exist.
Limits: Inclusive query anchor is separate from exclusive requester window. Preview only; deduplicated stored totals/page groups do not establish completeness or absence. Unknown snapshots and immutable versions remain null; connection status does not authenticate stored access.
Do not: Prove absence from exhausted previews.
Do not: Send email or bypass current authorization.
Canonical input schema urn:meri:retrieval:mail:0.2.0#/$defs/MailListInput, SHA256 e2be34336f7c9f370c3f9e3b8db7f99e92c2d16399716266f1e27eb6819811aa.
Supply literal arguments only; credentials and scope authority remain with the gateway.

### Input schema (`arguments`)

```json
{
 "type": "object",
 "properties": {
  "subject": {
   "oneOf": [
    {
     "type": "object",
     "properties": {
      "kind": {
       "type": "string",
       "const": "client"
      },
      "entityId": {
       "type": "string",
       "minLength": 1,
       "maxLength": 256
      }
     },
     "required": [
      "kind",
      "entityId"
     ],
     "additionalProperties": false
    },
    {
     "type": "object",
     "properties": {
      "kind": {
       "type": "string",
       "const": "personal"
      }
     },
     "required": [
      "kind"
     ],
     "additionalProperties": false
    }
   ]
  },
  "folder": {
   "type": "string",
   "enum": [
    "all",
    "inbox",
    "sent"
   ]
  },
  "withinDays": {
   "anyOf": [
    {
     "type": "integer",
     "minimum": 1,
     "maximum": 3650
    },
    {
     "type": "null"
    }
   ]
  },
  "limit": {
   "type": "integer",
   "minimum": 1,
   "maximum": 50
  },
  "offset": {
   "type": "integer",
   "minimum": 0,
   "maximum": 10000
  },
  "asOf": {
   "type": "string",
   "format": "date-time",
   "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"
  }
 },
 "required": [
  "subject"
 ],
 "additionalProperties": false
}
```

## Tool `mail_search_messages`

### Description

Search stored mail message candidates. Prepare incomplete stored message candidates under current trusted mailbox and client authorization.
Covers: Stored mailbox mail for the current actor (and an authorized client): list or search message candidates, and read one stored thread in bounded body sections.
Returns: Message candidates with asOf and record/snapshot versions; thread sections with UTF-16 offsets and body completeness; every message carries a decisive-read handle.
Result states: coverage and hasMore/continuation declare an incomplete page; missing versus empty body text is explicit; an empty page never proves an email or commitment did not exist.
Limits: Inclusive query anchor is separate from exclusive requester window. Preview only; deduplicated stored totals/page groups do not establish completeness or absence. Unknown snapshots and immutable versions remain null; connection status does not authenticate stored access.
Do not: Prove absence from exhausted previews.
Do not: Send email or bypass current authorization.
Canonical input schema urn:meri:retrieval:mail:0.2.0#/$defs/MailSearchInput, SHA256 e2be34336f7c9f370c3f9e3b8db7f99e92c2d16399716266f1e27eb6819811aa.
Supply literal arguments only; credentials and scope authority remain with the gateway.

### Input schema (`arguments`)

```json
{
 "type": "object",
 "properties": {
  "subject": {
   "oneOf": [
    {
     "type": "object",
     "properties": {
      "kind": {
       "type": "string",
       "const": "client"
      },
      "entityId": {
       "type": "string",
       "minLength": 1,
       "maxLength": 256
      }
     },
     "required": [
      "kind",
      "entityId"
     ],
     "additionalProperties": false
    },
    {
     "type": "object",
     "properties": {
      "kind": {
       "type": "string",
       "const": "personal"
      }
     },
     "required": [
      "kind"
     ],
     "additionalProperties": false
    }
   ]
  },
  "folder": {
   "type": "string",
   "enum": [
    "all",
    "inbox",
    "sent"
   ]
  },
  "withinDays": {
   "anyOf": [
    {
     "type": "integer",
     "minimum": 1,
     "maximum": 3650
    },
    {
     "type": "null"
    }
   ]
  },
  "limit": {
   "type": "integer",
   "minimum": 1,
   "maximum": 50
  },
  "offset": {
   "type": "integer",
   "minimum": 0,
   "maximum": 10000
  },
  "asOf": {
   "type": "string",
   "format": "date-time",
   "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"
  },
  "query": {
   "type": "string",
   "maxLength": 200
  },
  "from": {
   "type": "string",
   "maxLength": 200
  },
  "participant": {
   "type": "string",
   "maxLength": 200
  }
 },
 "required": [
  "subject"
 ],
 "additionalProperties": false
}
```

## Tool `search_memory`

### Description

Search memory. Inspect the declared source projection through a qualified source owner under current authorization.
Covers: Approved governed memory for the current actor or selected client: search active recall items under current eligibility.
Returns: Memory items with sourceVersion, asOf and updatedAt; nextCursor continues.
Result states: coverage and status declare eligibility and truncation; excluded proposal states are not recall; an empty search is absence within active recall only.
Limits: Trusted context is an adapter assertion for projection correlation, never a current grant, source attestation or authorization decision. Local validation does not qualify identity, source access, completeness, cursor authentication, result release or runtime. Personal, client and firm recall preserves separate result/status/limitation projections. Tenant and user facts correlate legacy context hashes only; current memory policy and approval semantics are external.
Do not: Treat a model selector, empty page, cursor, timestamp or reported coverage as proof of authorization, freshness or exhaustive absence.
Canonical input schema urn:meri:retrieval:client-knowledge-memory:0.2.0#/$defs/ClientKnowledgeMemoryRequest, SHA256 589d07bbffa8923116071a3d6d2770e4feaa4180e9a1cf67f58ca1d0483d748d.
Supply literal arguments only; credentials and scope authority remain with the gateway.

### Input schema (`arguments`)

```json
{
 "type": "object",
 "properties": {
  "query": {
   "type": [
    "string",
    "null"
   ]
  },
  "clientId": {
   "type": [
    "string",
    "null"
   ]
  },
  "k": {
   "type": [
    "number",
    "string",
    "null"
   ]
  },
  "cursor": {
   "type": [
    "string",
    "null"
   ]
  },
  "memoryItemId": {
   "type": [
    "string",
    "null"
   ]
  },
  "contentCursor": {
   "type": [
    "string",
    "null"
   ]
  }
 },
 "additionalProperties": false
}
```

## Tool `describe_capiro_data`

### Description

Describe Capiro data. List the SQL relations query_capiro_data can read, with each relation's columns (name, type, PostgreSQL pgType, nullable, unit, enum values, meaning), primary key, declared join relationships, grain, coverage limitations and freshness field. Call it once before the first query of a conversation, or with relations:[...] to re-read specific relations after an UNKNOWN_RELATION or UNKNOWN_FIELD refusal (its candidates name the nearest published relations or columns); the public catalog is static, so do not repeat it for every query. Public relations (the default) currently cover federal bills, bill subjects, cosponsors and members and DoD program elements, projects and budget positions; the list this tool returns is authoritative. source client_records lists the fifteen client projections the current conversation may read. Publication is not evidence of populated rows or current grants. source research_portfolio reads only the conversation-captured portfolio and its saved members. source classic_outreach reads the actor-owned Classic records eligible in the actual General or selected-client context. Neither accepts a model portfolio or client selector; no fallback crosses sources.
Covers: Text-to-SQL over published public Capiro relations and currently authorized client records, the captured Research portfolio and actor-owned Classic Outreach: describe relations, keys and coverage, then run bound-parameter SELECT SQL.
Returns: Rows or relation metadata with generatedAt (query time), sourceAsOf and sourceVersion when known, exact integer and decimal strings.
Result states: rowLimitReached and byteTruncated declare clipped output; coverage and limitations declare relation coverage; a denied, timed-out or invalid query is a failure, never an empty result.
Structured questions: for counts, totals, rankings, trends or cross-record filters over this data, call describe_capiro_data first and query_capiro_data when the published relations cover it; use this read for the typed record, evidence or citation path, or when the described relations do not cover the question, and say which path you used.
Limits: Current installation, authorization and source availability are required; publication alone enables nothing. Coverage is ingested and query-bounded with unknown (null) freshness; an empty result is not proof of absence. Derived rows are not immutable source evidence; use canonical readers for decisive bill text, report passages and consolidated PE funding. Client-record SQL covers the fifteen published projections of the current authorized scope; General may narrow with clientId, selected-client chat cannot broaden, saved jobs have no private SQL admission.
Do not: Treat a model selector, empty page, cursor, timestamp or reported coverage as proof of authorization, freshness or exhaustive absence.
Canonical input schema urn:meri:retrieval:capiro-data:0.5.0#/$defs/CapiroDataDescribeRequest, SHA256 fe7d7233c877742c39990c7bf6685359f8c2e13f32f95e59f5a62924ee64be25.
Supply literal arguments only; credentials and scope authority remain with the gateway.

### Input schema (`arguments`)

```json
{
 "anyOf": [
  {
   "type": "object",
   "properties": {
    "relations": {
     "uniqueItems": true,
     "description": "Relation names to describe; omit to list every published relation of the selected source. Names are lowercase and must be spelled exactly as query_capiro_data uses them.",
     "minItems": 1,
     "maxItems": 15,
     "type": "array",
     "items": {
      "type": "string",
      "maxLength": 128,
      "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$"
     }
    },
    "source": {
     "type": "string",
     "enum": [
      "public",
      "client_records"
     ],
     "description": "Omit for public relations. Client records require current interactive authority."
    },
    "clientId": {
     "type": "string",
     "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$",
     "description": "Allowed only with source client_records. Optional narrowing in General; selected-client conversations cannot select another client."
    }
   },
   "additionalProperties": false
  },
  {
   "type": "object",
   "properties": {
    "relations": {
     "uniqueItems": true,
     "description": "Relation names to describe; omit to list every published relation of the selected source. Names are lowercase and must be spelled exactly as query_capiro_data uses them.",
     "minItems": 1,
     "maxItems": 2,
     "type": "array",
     "items": {
      "type": "string",
      "enum": [
       "research_portfolios",
       "research_portfolio_members"
      ]
     }
    },
    "source": {
     "type": "string",
     "const": "research_portfolio",
     "description": "The original conversation-captured portfolio under current authority. No model portfolio or client selector."
    }
   },
   "required": [
    "source"
   ],
   "additionalProperties": false
  },
  {
   "type": "object",
   "properties": {
    "relations": {
     "uniqueItems": true,
     "description": "Relation names to describe; omit to list every published relation of the selected source. Names are lowercase and must be spelled exactly as query_capiro_data uses them.",
     "minItems": 1,
     "maxItems": 1,
     "type": "array",
     "items": {
      "type": "string",
      "const": "classic_outreach_records"
     }
    },
    "source": {
     "type": "string",
     "const": "classic_outreach",
     "description": "Actor-owned Classic Outreach under the actual General or selected-client context. No model client selector."
    }
   },
   "required": [
    "source"
   ],
   "additionalProperties": false
  }
 ]
}
```

## Tool `query_capiro_data`

### Description

Query Capiro data. Run one read-only PostgreSQL 16 SELECT or WITH ... SELECT over the relations describe_capiro_data lists: public by default, or source client_records for the authorized client projections; one query reads one source. The statement runs verbatim under a read-only role, so ordinary PostgreSQL (joins, subqueries, CASE, casts, functions, window functions, IN, LIKE/ILIKE, string literals, UNION) works; the sql argument states the few hard limits. A refusal (ok:false with error code INVALID_QUERY, UNSUPPORTED_SQL, UNKNOWN_RELATION, UNKNOWN_FIELD or PARAMETER_MISMATCH) carries PostgreSQL's own message, 1-based character position, hint, SQLSTATE and nearest published names: fix the SQL and run again, do not switch sources. Bind text, date, UUID and decimal values as $1..$n. A result carries typed columns (name, type, pgType), rows as objects with exact-string integer, decimal and timestamp cells and explicit nulls, rowCount, relationsUsed, rowLimitReached (rowLimit default 200, max 1000, applied as an outer LIMIT) and byteTruncated (256 KiB cap). Page by keyset: ORDER BY the full key and WHERE key > $n. Filter value_kind, position_cycle and asserted_fy before summing budget positions, aggregate parent amounts before joining projects, and join on canonical bill IDs and Bioguide IDs, not names. source research_portfolio reads only the conversation-captured portfolio and its saved members. source classic_outreach reads the actor-owned Classic records eligible in the actual General or selected-client context. Neither accepts a model portfolio or client selector; no fallback crosses sources.
Covers: Text-to-SQL over published public Capiro relations and currently authorized client records, the captured Research portfolio and actor-owned Classic Outreach: describe relations, keys and coverage, then run bound-parameter SELECT SQL.
Returns: Rows or relation metadata with generatedAt (query time), sourceAsOf and sourceVersion when known, exact integer and decimal strings.
Result states: rowLimitReached and byteTruncated declare clipped output; coverage and limitations declare relation coverage; a denied, timed-out or invalid query is a failure, never an empty result.
Structured questions: for counts, totals, rankings, trends or cross-record filters over this data, call describe_capiro_data first and query_capiro_data when the published relations cover it; use this read for the typed record, evidence or citation path, or when the described relations do not cover the question, and say which path you used.
Limits: Current installation, authorization and source availability are required; publication alone enables nothing. Coverage is ingested and query-bounded with unknown (null) freshness; an empty result is not proof of absence. Derived rows are not immutable source evidence; use canonical readers for decisive bill text, report passages and consolidated PE funding. Client-record SQL covers the fifteen published projections of the current authorized scope; General may narrow with clientId, selected-client chat cannot broaden, saved jobs have no private SQL admission.
Do not: Treat a model selector, empty page, cursor, timestamp or reported coverage as proof of authorization, freshness or exhaustive absence.
Canonical input schema urn:meri:retrieval:capiro-data:0.5.0#/$defs/CapiroDataQueryRequest, SHA256 fe7d7233c877742c39990c7bf6685359f8c2e13f32f95e59f5a62924ee64be25.
Supply literal arguments only; credentials and scope authority remain with the gateway.

### Input schema (`arguments`)

```json
{
 "anyOf": [
  {
   "type": "object",
   "properties": {
    "sql": {
     "type": "string",
     "minLength": 1,
     "maxLength": 16384,
     "description": "One read-only PostgreSQL statement over the relations describe_capiro_data returns. Use its optional versioned contract for the current grammar, blocked keywords/functions and limits; the descriptor is metadata, never an authorization grant. Bind values as $1..$n and alias expression columns. Core owns SQL admission and returns diagnostic refusals to correct and retry; Meri does not parse SQL. When an older Core omits contract, use one SELECT or WITH ... SELECT and follow its refusal message. Public and client_records are separate sources."
    },
    "parameters": {
     "minItems": 0,
     "maxItems": 64,
     "type": "array",
     "items": {
      "type": [
       "string",
       "number",
       "boolean",
       "null"
      ]
     },
     "description": "Values bound to $1..$n in order; required, so pass [] when the SQL binds nothing; $1..$n must be contiguous and every entry referenced. Use strings for text, dates (YYYY-MM-DD), timestamps (ISO 8601 or PostgreSQL text, UTC), UUIDs and exact decimals or large integers; numbers only for safe integers; booleans; null (compare nulls with IS NULL, not = $n). PostgreSQL infers each parameter's type from where it is used; cast it ($1::date) when the context does not fix the type."
    },
    "rowLimit": {
     "type": "integer",
     "minimum": 1,
     "maximum": 1000,
     "description": "Maximum rows returned, 1-1000 (default 200), applied as an outer LIMIT around the SQL. rowLimitReached in the result reports that more rows matched; page by keyset (ORDER BY the full key, WHERE key > $n) instead of OFFSET."
    },
    "source": {
     "type": "string",
     "enum": [
      "public",
      "client_records"
     ],
     "description": "Omit for public relations. Client records require current interactive authority."
    },
    "clientId": {
     "type": "string",
     "pattern": "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$",
     "description": "Allowed only with source client_records. Optional narrowing in General; selected-client conversations cannot select another client."
    }
   },
   "required": [
    "sql",
    "parameters"
   ],
   "additionalProperties": false
  },
  {
   "type": "object",
   "properties": {
    "sql": {
     "type": "string",
     "minLength": 1,
     "maxLength": 16384,
     "description": "One read-only PostgreSQL statement over the relations describe_capiro_data returns. Use its optional versioned contract for the current grammar, blocked keywords/functions and limits; the descriptor is metadata, never an authorization grant. Bind values as $1..$n and alias expression columns. Core owns SQL admission and returns diagnostic refusals to correct and retry; Meri does not parse SQL. When an older Core omits contract, use one SELECT or WITH ... SELECT and follow its refusal message. Each query reads exactly one source. Public, client_records, research_portfolio and classic_outreach never share relation scope."
    },
    "parameters": {
     "minItems": 0,
     "maxItems": 64,
     "type": "array",
     "items": {
      "type": [
       "string",
       "number",
       "boolean",
       "null"
      ]
     },
     "description": "Values bound to $1..$n in order; required, so pass [] when the SQL binds nothing; $1..$n must be contiguous and every entry referenced. Use strings for text, dates (YYYY-MM-DD), timestamps (ISO 8601 or PostgreSQL text, UTC), UUIDs and exact decimals or large integers; numbers only for safe integers; booleans; null (compare nulls with IS NULL, not = $n). PostgreSQL infers each parameter's type from where it is used; cast it ($1::date) when the context does not fix the type."
    },
    "rowLimit": {
     "type": "integer",
     "minimum": 1,
     "maximum": 1000,
     "description": "Maximum rows returned, 1-1000 (default 200), applied as an outer LIMIT around the SQL. rowLimitReached in the result reports that more rows matched; page by keyset (ORDER BY the full key, WHERE key > $n) instead of OFFSET."
    },
    "source": {
     "type": "string",
     "const": "research_portfolio",
     "description": "The original conversation-captured portfolio under current authority. No model portfolio or client selector."
    }
   },
   "required": [
    "sql",
    "parameters",
    "source"
   ],
   "additionalProperties": false
  },
  {
   "type": "object",
   "properties": {
    "sql": {
     "type": "string",
     "minLength": 1,
     "maxLength": 16384,
     "description": "One read-only PostgreSQL statement over the relations describe_capiro_data returns. Use its optional versioned contract for the current grammar, blocked keywords/functions and limits; the descriptor is metadata, never an authorization grant. Bind values as $1..$n and alias expression columns. Core owns SQL admission and returns diagnostic refusals to correct and retry; Meri does not parse SQL. When an older Core omits contract, use one SELECT or WITH ... SELECT and follow its refusal message. Each query reads exactly one source. Public, client_records, research_portfolio and classic_outreach never share relation scope."
    },
    "parameters": {
     "minItems": 0,
     "maxItems": 64,
     "type": "array",
     "items": {
      "type": [
       "string",
       "number",
       "boolean",
       "null"
      ]
     },
     "description": "Values bound to $1..$n in order; required, so pass [] when the SQL binds nothing; $1..$n must be contiguous and every entry referenced. Use strings for text, dates (YYYY-MM-DD), timestamps (ISO 8601 or PostgreSQL text, UTC), UUIDs and exact decimals or large integers; numbers only for safe integers; booleans; null (compare nulls with IS NULL, not = $n). PostgreSQL infers each parameter's type from where it is used; cast it ($1::date) when the context does not fix the type."
    },
    "rowLimit": {
     "type": "integer",
     "minimum": 1,
     "maximum": 1000,
     "description": "Maximum rows returned, 1-1000 (default 200), applied as an outer LIMIT around the SQL. rowLimitReached in the result reports that more rows matched; page by keyset (ORDER BY the full key, WHERE key > $n) instead of OFFSET."
    },
    "source": {
     "type": "string",
     "const": "classic_outreach",
     "description": "Actor-owned Classic Outreach under the actual General or selected-client context. No model client selector."
    }
   },
   "required": [
    "sql",
    "parameters",
    "source"
   ],
   "additionalProperties": false
  }
 ]
}
```

## Result notices and failure texts

### describe_capiro_data: Core 362 describe envelope

_(no notice)_

### describe_capiro_data: unknown relation refusal

> Notice: describe_capiro_data refused this request with UNKNOWN_RELATION. Use a relation name exactly as describe_capiro_data lists it (lowercase, unqualified); one query reads one source. Use the same source on describe and query and never mix relations from different sources. PostgreSQL: congress_bill is not a published relation. Did you mean: congress_bills. No evidence, absence or completeness is established.

### query_capiro_data: two rows

> Notice: 2 row(s) returned of rowLimit 2 from program_elements.

### query_capiro_data: zero rows

> Notice: 0 row(s) returned of rowLimit 2 from program_elements. Zero rows is not proof of absence: check parameter values, ILIKE wildcards (%) and the relation coverage limitations before concluding.

### query_capiro_data: PostgreSQL unknown column (42703)

> Notice: query_capiro_data refused this request with UNKNOWN_FIELD. Use column names exactly as describe_capiro_data lists them, qualified by the relation alias when two relations share a name. Re-read the relation with describe_capiro_data relations:[...] when unsure. PostgreSQL 42703: column b.titel does not exist at character 8. Hint: Perhaps you meant "b.title". Did you mean: title. No evidence, absence or completeness is established.

### query_capiro_data: gate refusal UNSUPPORTED_SQL

> Notice: query_capiro_data refused this request with UNSUPPORTED_SQL. Use the current describe_capiro_data contract grammar and Core refusal message to correct the statement. If an older Core omits contract, send exactly one read-only SELECT or WITH ... SELECT. Rewrite the statement and run it again. No evidence, absence or completeness is established.

### query_capiro_data: PARAMETER_MISMATCH

> Notice: query_capiro_data refused this request with PARAMETER_MISMATCH. parameters must bind $1..$n contiguously with every entry referenced; use strings for exact decimals, large integers, dates and UUIDs and numbers only for safe integers. No evidence, absence or completeness is established.

### query_capiro_data: QUERY_TIMEOUT

> Notice: query_capiro_data refused this request with QUERY_TIMEOUT. The query exceeded its time budget; add selective WHERE filters, join fewer relations, aggregate instead of listing or lower LIMIT, then run it again. No evidence, absence or completeness is established.

### search_memory: one approved item

_(no notice)_

### search_memory: empty recall

_(no notice)_

### search_memory: Core argument error

_(no notice)_

### mail_search_messages: one candidate from a disconnected mailbox

_(no notice)_

### mail_search_messages: empty page

_(no notice)_

### mail_search_messages: UNAVAILABLE (no mailbox)

> UNAVAILABLE: mcp__meri_reads__mail_search_messages is not enabled, installed or served for this request in this conversation (an unsupported operation or a source-side refusal that is neither a denied scope nor an outage). No evidence, absence or completeness is established.

### mail_search_messages: ACCESS_DENIED

> ACCESS_DENIED: mcp__meri_reads__mail_search_messages is not permitted for this user, client or conversation now (denied scope, not absent data). No evidence, absence or completeness is established.

### search_memory: ACCESS_DENIED

> ACCESS_DENIED: mcp__meri_reads__search_memory is not permitted for this user, client or conversation now (denied scope, not absent data). No evidence, absence or completeness is established.

### search_memory: UNAVAILABLE

> UNAVAILABLE: mcp__meri_reads__search_memory is not enabled, installed or served for this request in this conversation (an unsupported operation or a source-side refusal that is neither a denied scope nor an outage). No evidence, absence or completeness is established.

### query_capiro_data: INVALID_ARGUMENTS

> INVALID_ARGUMENTS: mcp__meri_reads__query_capiro_data refused these arguments; supply literal arguments matching its input schema. query_capiro_data takes sql (1-16384 bytes) and parameters (required; [] when nothing is bound; at most 64 strings, finite safe-integer numbers, booleans or nulls), plus optional rowLimit (integer 1-1000), source (from the installed tool schema) and clientId (UUID, client_records only). No evidence, absence or completeness is established.
