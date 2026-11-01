# What the model receives for the data, memory and mail reads

Rendered from the production composition (`reads/server.mjs`, `reads/tools.mjs`, `reads/options.mjs`, `reads/results.mjs`) by `reads/test/model-view-fixture.mjs`. Reads: `mail_read_thread`, `mail_list_messages`, `mail_search_messages`, `search_memory`, `describe_capiro_data`, `query_capiro_data`.

## System prompt sentence (`readPromptSentence`)

Only the read-only institutional source tools listed for this activity are enabled; every other institutional source is unavailable. Structured questions about Capiro data (counts, totals, rankings, trends and filters over federal bills, cosponsors, members, program elements and budget positions, or over the saved client records of source client_records) go to describe_capiro_data once per conversation and then query_capiro_data; public is the default source and clientId only narrows access. Before querying, settle any ambiguity that changes the answer (client, fiscal versus calendar period, units, budget cycle). A refusal names its correction: fix the SQL and run it again, and never switch to another source to evade a refusal or a timeout. Use a typed reader only when the described relations do not cover the question or original bill text, report passages or consolidated PE funding are needed, and say which path you used. Query results are query-bounded rows, not source completeness; generatedAt is query time, not source freshness. Saved knowledge: when the user asks what Meri, they or the firm have saved, noted or remembered (including "what do we have on client X"), call search_memory first and attribute each item as saved memory by title, scope and approval date, then use SQL or typed readers for current records and say which came from memory. Saving or correcting memory is a write request that only prepares a proposal for the user's approval: never say a memory was saved or remembered. Email: what someone emailed, the latest threads with a client, or an email's contents come from the mail tools, never from memory or SQL: mail_search_messages (from, participant or query words) or mail_list_messages (recent mail), then mail_read_thread for a thread's body before quoting it. Mail is stored mail of the connected mailbox up to its last synchronization, not the live inbox, and an empty page is not proof that no email exists.

## `meri_reads` server instructions

Read-only Meri institutional sources for this conversation. Preserve exact source IDs, versions, hashes and scopes; separate inference; disclose partial or unavailable evidence. An error result establishes no evidence, absence or completeness. No write, external action or artifact is exposed here.
Result states are distinct and never collapse: ACCESS_DENIED is a denied scope (user, client or conversation), not absent data; UNAVAILABLE is a read that is not enabled, installed or served here (unsupported operation); SOURCE_UNAVAILABLE is a served read whose source did not answer this call; INVALID_RESULT is a withheld malformed result. Only a successful result can show absent data, and only within the coverage it declares: an empty list is absence inside that page, window and source set, never proof of global absence. Partial or stale coverage is declared by the result fields each tool names (coverage, truncated, hasMore, nextCursor/nextPage, limitations, freshness, asOf). Cite the freshness or version field each tool names; a missing one stays unknown.
In General, client profile, documents, meeting sources, knowledge search and tracked bills require one explicit client UUID. Resolve a named client with lookup_client_registry first and use its returned UUID; ask the user to disambiguate multiple matches. A registry result does not grant access and these reads do not search across all clients. In a selected-client conversation, keep that selected client.
Available: Read stored mail thread sections; List stored mail message candidates; Search stored mail message candidates; Search memory; Describe Capiro data; Query Capiro data.
Other institutional sources are not available in this conversation.

## Tool `mail_read_thread`

### Description

Read stored mail thread sections. Prepare a typed stored-thread read after trusted current mailbox and client authorization.
Covers: Stored mail of the user's connected mailbox, personally or for the selected client: list or search message candidates (subject, sender, participants, date, preview), then read one thread's message bodies in bounded sections.
Returns: Candidates with subjectText, from, to/cc, sentAt/receivedAt, preview.text, threadId, messageId, connectionStatus, totalMatches, hasMore and nextOffset; thread sections with bodyCompleteness, UTF-16 offsets and nextBodyOffsets.
Result states: hasMore/nextOffset and coverage.truncated declare an incomplete page; bodyCompleteness distinguishes missing, preview and truncated bodies; connectionStatus other than connected means possibly stale stored mail; an empty page never proves an email did not exist.
Stored mail of the user's connected mailbox (Microsoft 365 or Google Workspace) as last synchronized into Capiro: never the live inbox and never a send. subject is {kind:"personal"} in General (the user's own mailbox view) or {kind:"client", entityId:<the selected client's UUID>} in a selected-client conversation (mail associated with that client).
Arguments: subject (as above), threadId (UUID of a candidate from a list or search), messageId (optional: start at this message), messageOffset (skip messages, default 0), limit (1-10 messages per read, default 3), bodyOffset and maxCharacters (1-6000, default 2000 UTF-16 code units of each message body).
Result: messages[] oldest first, each with from, to, cc, sentAt or receivedAt, bodyCompleteness (full, preview, truncated, missing or unknown) and section {start, endExclusive, totalCodeUnits, text, hasMore}; nextMessageOffset and nextBodyOffsets continue a bounded read and coverage.truncated declares one. Quote or summarize only text that was returned; a missing or truncated body is reported, never inferred.
Limits: Candidates are previews of stored mail up to the mailbox's last synchronization; an empty or exhausted page is absence within that folder, window and filter only, never proof that no email or commitment exists.
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
Covers: Stored mail of the user's connected mailbox, personally or for the selected client: list or search message candidates (subject, sender, participants, date, preview), then read one thread's message bodies in bounded sections.
Returns: Candidates with subjectText, from, to/cc, sentAt/receivedAt, preview.text, threadId, messageId, connectionStatus, totalMatches, hasMore and nextOffset; thread sections with bodyCompleteness, UTF-16 offsets and nextBodyOffsets.
Result states: hasMore/nextOffset and coverage.truncated declare an incomplete page; bodyCompleteness distinguishes missing, preview and truncated bodies; connectionStatus other than connected means possibly stale stored mail; an empty page never proves an email did not exist.
Stored mail of the user's connected mailbox (Microsoft 365 or Google Workspace) as last synchronized into Capiro: never the live inbox and never a send. subject is {kind:"personal"} in General (the user's own mailbox view) or {kind:"client", entityId:<the selected client's UUID>} in a selected-client conversation (mail associated with that client).
Arguments: subject (as above), folder (all, inbox or sent; default all), withinDays (1-3650; null, the default, for no window), limit (1-50 candidates per page, default 15), offset (nextOffset of the previous page) and asOf (ISO timestamp anchoring the page). Returns the newest stored candidates first; use mail_search_messages to filter by sender, participant or words.
Result: messages[] newest first with subjectText, from {name, email}, to and cc (up to 8 each; toTruncated/ccTruncated), sentAt, receivedAt, preview.text (an incomplete excerpt, never the full body), threadId, messageId, clientId, connectionStatus and readHandle; totalMatches, hasMore and nextOffset (pass it as offset to continue); threadGroups groups a list page by thread. Read a thread's body with mail_read_thread using its threadId. connectionStatus other than connected (disabled, error, needs_configuration) means the mailbox stopped synchronizing: say the mail may be stale and that the user can reconnect it in Capiro's mail integration settings.
Limits: Candidates are previews of stored mail up to the mailbox's last synchronization; an empty or exhausted page is absence within that folder, window and filter only, never proof that no email or commitment exists.
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
Covers: Stored mail of the user's connected mailbox, personally or for the selected client: list or search message candidates (subject, sender, participants, date, preview), then read one thread's message bodies in bounded sections.
Returns: Candidates with subjectText, from, to/cc, sentAt/receivedAt, preview.text, threadId, messageId, connectionStatus, totalMatches, hasMore and nextOffset; thread sections with bodyCompleteness, UTF-16 offsets and nextBodyOffsets.
Result states: hasMore/nextOffset and coverage.truncated declare an incomplete page; bodyCompleteness distinguishes missing, preview and truncated bodies; connectionStatus other than connected means possibly stale stored mail; an empty page never proves an email did not exist.
Stored mail of the user's connected mailbox (Microsoft 365 or Google Workspace) as last synchronized into Capiro: never the live inbox and never a send. subject is {kind:"personal"} in General (the user's own mailbox view) or {kind:"client", entityId:<the selected client's UUID>} in a selected-client conversation (mail associated with that client).
Arguments: subject (as above), query (words in subject or body, up to 200 characters), from (sender name or address), participant (any sender or recipient), folder (all, inbox or sent; default all), withinDays (1-3650; null, the default, for no window), limit (1-50, default 20), offset (nextOffset of the previous page) and asOf. At least one of query, from, participant, withinDays or a folder other than all is required. For "what did X last email us about" search from X (or participant X) with a small limit and read the newest thread; for "the last N threads with client Y" search or list under the client subject, take the N newest distinct threadIds and read each.
Result: messages[] newest first with subjectText, from {name, email}, to and cc (up to 8 each; toTruncated/ccTruncated), sentAt, receivedAt, preview.text (an incomplete excerpt, never the full body), threadId, messageId, clientId, connectionStatus and readHandle; totalMatches, hasMore and nextOffset (pass it as offset to continue); threadGroups groups a list page by thread. Read a thread's body with mail_read_thread using its threadId. connectionStatus other than connected (disabled, error, needs_configuration) means the mailbox stopped synchronizing: say the mail may be stale and that the user can reconnect it in Capiro's mail integration settings.
Limits: Candidates are previews of stored mail up to the mailbox's last synchronization; an empty or exhausted page is absence within that folder, window and filter only, never proof that no email or commitment exists.
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
Covers: Approved governed memory the user may recall (personal, firm and, in a selected-client conversation, that client's items): what was saved and approved earlier, searched by topic under current eligibility.
Returns: Items with title, type, scope, governance (status, approvedAt, stale, validUntil), content text with nextRead, updatedAt and provenance; contentStatus and nextCursor.
Result states: contentStatus and contentTruncated declare partial content; pending proposals and retired items are never recall; an empty search is absence within approved active memory only.
Recall of approved governed memory: what the user, the firm or Meri previously saved and a reviewer approved (facts, preferences, playbooks, client notes). Arguments: query (required text naming the topic or client to recall), clientId (in a selected-client conversation the selected client's UUID, which returns that client's items and the firm-wide items the user may recall; null in General, which returns tenant-neutral personal and firm memory; never another client), k (requested page size 1-15, default 8; Core returns at most 3 items per page and nextCursor continues), cursor (continue a search), memoryItemId with contentCursor (read one item's complete content, taken from content.nextRead).
Result: results[] (memoryItemId, title, type, clientId, relevance) and records[] whose payload carries title, type, scope (personal, client or firm), governance (status, approvedAt, approvedByUserId, stale, validUntil) and content (value text, truncated, nextRead); plus summary, contentStatus (available, metadata_only, empty, unavailable or unavailable_or_ineligible), contentTruncated and nextCursor. Attribute each item as saved memory by title, scope and approvedAt: it records what was approved, not a fact verified now.
Only approved active memory is recall: pending proposals, rejected, withdrawn, revoked and superseded items are excluded, so an empty result is not proof that nothing was saved or proposed. Saving or correcting memory never happens here: a save is a write request that only prepares a proposal for the user's approval, so never say a memory was saved or remembered.
Limits: Core checks current eligibility of every returned item before release: an item the user may no longer recall fails the whole call as ACCESS_DENIED rather than being dropped silently.
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
Limits: Current installation, authorization and source availability are required; publication alone enables nothing. Coverage is ingested and query-bounded with unknown (null) freshness; an empty result is not proof of absence. Derived rows are not immutable source evidence; use canonical readers for decisive bill text, report passages and consolidated PE funding. Client-record SQL covers the fifteen published projections of the current authorized scope; General may narrow with clientId, selected-client chat cannot broaden, saved jobs have no private SQL admission.
Do not: Treat a model selector, empty page, cursor, timestamp or reported coverage as proof of authorization, freshness or exhaustive absence.
Canonical input schema urn:meri:retrieval:capiro-data:0.5.0#/$defs/CapiroDataDescribeRequest, SHA256 5cda580bf5ec1a8203248fc0d66e2c23cd4844a8b0dd7e4154a89d8fce4d0e30.
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
Limits: Current installation, authorization and source availability are required; publication alone enables nothing. Coverage is ingested and query-bounded with unknown (null) freshness; an empty result is not proof of absence. Derived rows are not immutable source evidence; use canonical readers for decisive bill text, report passages and consolidated PE funding. Client-record SQL covers the fifteen published projections of the current authorized scope; General may narrow with clientId, selected-client chat cannot broaden, saved jobs have no private SQL admission.
Do not: Treat a model selector, empty page, cursor, timestamp or reported coverage as proof of authorization, freshness or exhaustive absence.
Canonical input schema urn:meri:retrieval:capiro-data:0.5.0#/$defs/CapiroDataQueryRequest, SHA256 5cda580bf5ec1a8203248fc0d66e2c23cd4844a8b0dd7e4154a89d8fce4d0e30.
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
     "description": "One read-only PostgreSQL statement over the relations describe_capiro_data returns: exactly one SELECT or WITH ... SELECT, run verbatim under a read-only role inside an outer LIMIT wrapper. Not allowed: a second statement, SET, SHOW, EXPLAIN, COPY, transaction control, INSERT, UPDATE, DELETE, MERGE, SELECT INTO, data-modifying CTEs, and administrative, sleep, lock, file or dblink functions. Bind values as $1..$n and alias expression columns. Core admits the statement and PostgreSQL reports its own errors with message, character position, hint, SQLSTATE and nearest published names; fix the SQL and run it again. Public and client_records are separate sources."
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
     "description": "One read-only PostgreSQL statement over the relations describe_capiro_data returns: exactly one SELECT or WITH ... SELECT, run verbatim under a read-only role inside an outer LIMIT wrapper. Not allowed: a second statement, SET, SHOW, EXPLAIN, COPY, transaction control, INSERT, UPDATE, DELETE, MERGE, SELECT INTO, data-modifying CTEs, and administrative, sleep, lock, file or dblink functions. Bind values as $1..$n and alias expression columns. Core admits the statement and PostgreSQL reports its own errors with message, character position, hint, SQLSTATE and nearest published names; fix the SQL and run it again. Each query reads exactly one source. Public, client_records, research_portfolio and classic_outreach never share relation scope."
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
     "description": "One read-only PostgreSQL statement over the relations describe_capiro_data returns: exactly one SELECT or WITH ... SELECT, run verbatim under a read-only role inside an outer LIMIT wrapper. Not allowed: a second statement, SET, SHOW, EXPLAIN, COPY, transaction control, INSERT, UPDATE, DELETE, MERGE, SELECT INTO, data-modifying CTEs, and administrative, sleep, lock, file or dblink functions. Bind values as $1..$n and alias expression columns. Core admits the statement and PostgreSQL reports its own errors with message, character position, hint, SQLSTATE and nearest published names; fix the SQL and run it again. Each query reads exactly one source. Public, client_records, research_portfolio and classic_outreach never share relation scope."
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

> Notice: 1 public relation(s) described: program_elements. Spell relation and column names exactly as listed, filter enum columns by their listed values, join on the listed relationships, and respect each relation's grain and limitations; rowLimit default 200, max 1000.

### describe_capiro_data: unknown relation refusal

> Notice: describe_capiro_data refused this request with UNKNOWN_RELATION. Use a relation name exactly as describe_capiro_data lists it (lowercase, unqualified); one query reads one source. Use the same source on describe and query and never mix relations from different sources. PostgreSQL: congress_bill is not a published relation. Did you mean: congress_bills. No evidence, absence or completeness is established.

### query_capiro_data: two rows

> Notice: 2 row(s) returned of rowLimit 2 from program_elements.

### query_capiro_data: zero rows

> Notice: 0 row(s) returned of rowLimit 2 from program_elements. Zero rows is not proof of absence: check parameter values, ILIKE wildcards (%) and the relation coverage limitations before concluding.

### query_capiro_data: PostgreSQL unknown column (42703)

> Notice: query_capiro_data refused this request with UNKNOWN_FIELD. Use column names exactly as describe_capiro_data lists them, qualified by the relation alias when two relations share a name. Re-read the relation with describe_capiro_data relations:[...] when unsure. PostgreSQL 42703: column b.titel does not exist at character 8. Hint: Perhaps you meant "b.title". Did you mean: title. No evidence, absence or completeness is established.

### query_capiro_data: gate refusal UNSUPPORTED_SQL

> Notice: query_capiro_data refused this request with UNSUPPORTED_SQL. Send exactly one statement that starts with SELECT or WITH ... SELECT: no second statement, no SET, SHOW, EXPLAIN, COPY or transaction control, no INSERT, UPDATE, DELETE, MERGE, SELECT INTO or data-modifying CTE, and no administrative, sleep, lock, file or dblink function. Rewrite the statement and run it again. No evidence, absence or completeness is established.

### query_capiro_data: PARAMETER_MISMATCH

> Notice: query_capiro_data refused this request with PARAMETER_MISMATCH. parameters must bind $1..$n contiguously with every entry referenced; use strings for exact decimals, large integers, dates and UUIDs and numbers only for safe integers, and cast a parameter ($1::date) when PostgreSQL cannot infer its type. No evidence, absence or completeness is established.

### query_capiro_data: QUERY_TIMEOUT

> Notice: query_capiro_data refused this request with QUERY_TIMEOUT. The query exceeded its time budget; add selective WHERE filters, join fewer relations, aggregate instead of listing or lower LIMIT, then run it again. No evidence, absence or completeness is established.

### search_memory: one approved item

> Notice: 1 approved memory item(s) returned (at most 3 per page); contentStatus available. Attribute each item as saved memory by its title, scope and approvedAt from records[].payload; it records what was approved, not a fact verified now, and nothing here saves or changes memory. Content is partial: read an item's complete text with memoryItemId and the contentCursor from content.nextRead before quoting it.

### search_memory: empty recall

> Notice: 0 approved memory item(s) returned (at most 3 per page); contentStatus empty. Pending proposals and retired items are never recall, so this is not proof that nothing was saved or proposed: say that no approved memory matched. Content is partial: read an item's complete text with memoryItemId and the contentCursor from content.nextRead before quoting it.

### search_memory: Core argument error

> Notice: search_memory refused the arguments: Provide a search query. Pass the topic or client as query text; clientId only in a selected-client conversation.

### mail_search_messages: one candidate from a disconnected mailbox

> Notice: 1 stored message candidate(s) of 2 matching; more exist, continue with offset 1. Previews are incomplete excerpts: read a thread with mail_read_thread before quoting or summarizing its content. Mailbox connection status disconnected: stored mail up to the last synchronization, possibly stale; the user can reconnect the mailbox in Capiro's mail integration settings.

### mail_search_messages: empty page

> Notice: 0 stored message candidate(s) of 0 matching. An empty page is absence within this subject, folder, window and filter only, not proof that no email exists; widen withinDays or the folder, or search by from or participant.

### mail_search_messages: UNAVAILABLE (no mailbox)

> UNAVAILABLE: mcp__meri_reads__mail_search_messages is not enabled, installed or served for this request in this conversation (an unsupported operation or a source-side refusal that is neither a denied scope nor an outage). No connected Microsoft 365 or Google Workspace mailbox is available for this user, or stored mail is not served in this conversation. Tell the user to connect their mailbox in Capiro's mail integration settings; do not say that no email exists. No evidence, absence or completeness is established.

### mail_search_messages: ACCESS_DENIED

> ACCESS_DENIED: mcp__meri_reads__mail_search_messages is not permitted for this user, client or conversation now (denied scope, not absent data). This mailbox or client subject is not authorized for this conversation: use {kind:"personal"} in General and {kind:"client", entityId} only for the selected client. Do not retry with another client. No evidence, absence or completeness is established.

### search_memory: ACCESS_DENIED

> ACCESS_DENIED: mcp__meri_reads__search_memory is not permitted for this user, client or conversation now (denied scope, not absent data). Memory recall was refused for this subject: in a selected-client conversation clientId must be that client's UUID, in General it must be null, and every returned item must pass Core's current eligibility check. Do not retry with another clientId; tell the user which scope was refused. No evidence, absence or completeness is established.

### search_memory: UNAVAILABLE

> UNAVAILABLE: mcp__meri_reads__search_memory is not enabled, installed or served for this request in this conversation (an unsupported operation or a source-side refusal that is neither a denied scope nor an outage). Governed memory recall is not served in this conversation (disabled, not installed or refused at the source); say nothing about what is or is not saved. No evidence, absence or completeness is established.

### query_capiro_data: INVALID_ARGUMENTS

> INVALID_ARGUMENTS: mcp__meri_reads__query_capiro_data refused these arguments; supply literal arguments matching its input schema. query_capiro_data takes sql (1-16384 bytes) and parameters (required; [] when nothing is bound; at most 64 strings, finite safe-integer numbers, booleans or nulls), plus optional rowLimit (integer 1-1000), source (from the installed tool schema) and clientId (UUID, client_records only). No evidence, absence or completeness is established.
