// Generated from packages/skills; availability requires a fresh installation receipt.
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export const skillCatalog=freeze({
  "schemaVersion": 1,
  "skills": [
    {
      "skillId": "quick_skill.bill_watch",
      "skillVersion": "1.0.0",
      "manifestSha256": "15eb005afa184bc3773b76d97acdc4605da126a1fc73fd7f7609683a7be48065",
      "proseSha256": "ab862a82247b4bef264f71298d7e4cfa68540d96f48c5e9d2871e769620d1f55",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "bill watch",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client"
      ],
      "windowBases": [
        "explicit",
        "fiscal-year"
      ],
      "requiredSources": [
        {
          "sourceId": "bill_text",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "program_elements",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "artifact_versions",
          "authority": "authoritative",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "read_bill_text",
          "version": "0.2.0"
        },
        {
          "id": "get_bill_status",
          "version": "0.2.0"
        },
        {
          "id": "get_pe_budget_timeline",
          "version": "0.2.0"
        },
        {
          "id": "create_word",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.client_changes",
      "skillVersion": "1.0.1",
      "manifestSha256": "186eb257d00c081781916595ae5d0331091afddfcf76eb96a9d1b3a8bb909621",
      "proseSha256": "a301ff3409d72d822d90a366693ec918288c3c0cf3870cf430759e8905623333",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "client changes",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client"
      ],
      "windowBases": [
        "calendar-week",
        "calendar-month",
        "explicit"
      ],
      "requiredSources": [
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "mail",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "meetings",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_documents",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "tasks",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "action_recommendation",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "client_knowledge_monday",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tracked_bills",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "district_nexus",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "business_development",
          "authority": "authoritative",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "get_client_context",
          "version": "0.3.0"
        },
        {
          "id": "mail.search_messages",
          "version": "0.2.0"
        },
        {
          "id": "mail.read_thread",
          "version": "0.2.0"
        },
        {
          "id": "meeting.read_client_meetings",
          "version": "0.2.0"
        },
        {
          "id": "meeting.query_debriefs",
          "version": "0.2.0"
        },
        {
          "id": "read_client_documents",
          "version": "0.2.0"
        },
        {
          "id": "query_tasks",
          "version": "0.2.0"
        },
        {
          "id": "query_action_items",
          "version": "0.2.0"
        },
        {
          "id": "read_monday_client_boards",
          "version": "0.2.0"
        },
        {
          "id": "search_tracked_bills",
          "version": "0.2.0"
        },
        {
          "id": "get_bill_status",
          "version": "0.2.0"
        },
        {
          "id": "get_district_nexus_changes",
          "version": "0.2.0"
        },
        {
          "id": "get_business_development_recent_changes",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.commitments_audit",
      "skillVersion": "1.0.0",
      "manifestSha256": "30a5b805056de2961a00da0de65152e4d7e918993f05adfbc7bbe456731bef2d",
      "proseSha256": "892dc0dbd9105e88e0cb78097514437f9cb29c0323b9bad168c1999d02a4e3db",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "commitments audit",
      "runtimeSupported": true,
      "available": false,
      "unavailableReason": "CURRENT_INSTALLATION_REQUIRED",
      "subjectKinds": [
        "client"
      ],
      "windowBases": [
        "calendar-week",
        "calendar-month",
        "calendar-year",
        "relative-duration",
        "explicit",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "mail",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "meetings",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_documents",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "tasks",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "action_recommendation",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "client_knowledge_monday",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "mail.search_messages",
          "version": "0.2.0"
        },
        {
          "id": "mail.read_thread",
          "version": "0.2.0"
        },
        {
          "id": "meeting.read_client_meetings",
          "version": "0.2.0"
        },
        {
          "id": "meeting.query_debriefs",
          "version": "0.2.0"
        },
        {
          "id": "read_client_documents",
          "version": "0.2.0"
        },
        {
          "id": "query_tasks",
          "version": "0.2.0"
        },
        {
          "id": "query_action_items",
          "version": "0.2.0"
        },
        {
          "id": "read_monday_client_boards",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.funding_opportunity_match",
      "skillVersion": "1.0.1",
      "manifestSha256": "cda8b0782966822ca2ebfca7dbdde5bbe41a349b1c8dcf5332038e43b54e6e14",
      "proseSha256": "7fcb2c315a84d5b5bb5438b0739672858083c210a15b33490c8ac8a52a262c7e",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "funding opportunity match",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client"
      ],
      "windowBases": [
        "explicit",
        "fiscal-year",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "funding_opportunities",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "stored_public_data",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "sam_opportunities",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "get_client_context",
          "version": "0.3.0"
        },
        {
          "id": "search_funding_opportunities",
          "version": "0.2.0"
        },
        {
          "id": "get_funding_opportunity",
          "version": "0.2.0"
        },
        {
          "id": "get_funding_opportunity_requirements",
          "version": "0.2.0"
        },
        {
          "id": "get_opportunity_client_context",
          "version": "0.2.0"
        },
        {
          "id": "get_opportunity_government_landscape",
          "version": "0.2.0"
        },
        {
          "id": "search_federal_grants",
          "version": "0.2.0"
        },
        {
          "id": "search_federal_awards",
          "version": "0.2.0"
        },
        {
          "id": "search_sam_opportunities",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.hearing_watch",
      "skillVersion": "1.0.1",
      "manifestSha256": "4dd221658c8475c3c81653b0f3dbfaddfdf5621e725f92b037724dc1152b4938",
      "proseSha256": "8113ddb40117410862987ca0d1eded9f911518d2511d14d6b5d28f83332f3999",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "hearing watch",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client",
        "entity"
      ],
      "windowBases": [
        "calendar-week",
        "calendar-month",
        "explicit"
      ],
      "requiredSources": [
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "public_domain_hearings",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "legislative_directory",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tracked_bills",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "bill_text",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "get_client_context",
          "version": "0.3.0"
        },
        {
          "id": "search_committee_hearings",
          "version": "0.2.0"
        },
        {
          "id": "get_committee_roster",
          "version": "0.2.0"
        },
        {
          "id": "list_members",
          "version": "0.2.0"
        },
        {
          "id": "search_tracked_bills",
          "version": "0.2.0"
        },
        {
          "id": "get_bill_status",
          "version": "0.2.0"
        },
        {
          "id": "read_bill_text",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.mail_history",
      "skillVersion": "1.0.0",
      "manifestSha256": "b8ac89b3cf04716a62f8a41f70382987b8a76426c4825a2dd7aeb6fb690903d1",
      "proseSha256": "a6f2508d93e0c1b5f3c723b10038db37adc31f9a08b49a36944c8dcf55308ea4",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "mail history",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client",
        "entity",
        "personal"
      ],
      "windowBases": [
        "calendar-week",
        "calendar-month",
        "calendar-year",
        "relative-duration",
        "explicit",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "entity_candidates",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tenant_contacts",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "mail",
          "authority": "authoritative",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "resolve_entity",
          "version": "0.2.0"
        },
        {
          "id": "find_contacts",
          "version": "0.2.0"
        },
        {
          "id": "mail.list_messages",
          "version": "0.2.0"
        },
        {
          "id": "mail.search_messages",
          "version": "0.2.0"
        },
        {
          "id": "mail.read_thread",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.meeting_prep",
      "skillVersion": "1.0.1",
      "manifestSha256": "8d89bfc58af319ac9467fa9eabafb615201663b2e74e49b171bc132a0ff546ba",
      "proseSha256": "f229e324b2465501c5eb53d6dc0b1084e56c99002a9495bbf1376dbf89eb78ef",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "meeting prep",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client",
        "entity"
      ],
      "windowBases": [
        "calendar-week",
        "calendar-month",
        "relative-duration",
        "explicit",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "entity_candidates",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tenant_contacts",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "mail",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "meetings",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_documents",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_knowledge_memory",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tasks",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "action_recommendation",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "client_knowledge_monday",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tracked_bills",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "public_domain_hearings",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "resolve_entity",
          "version": "0.2.0"
        },
        {
          "id": "find_contacts",
          "version": "0.2.0"
        },
        {
          "id": "get_client_context",
          "version": "0.3.0"
        },
        {
          "id": "mail.search_messages",
          "version": "0.2.0"
        },
        {
          "id": "mail.read_thread",
          "version": "0.2.0"
        },
        {
          "id": "meeting.list_upcoming_meetings",
          "version": "0.2.0"
        },
        {
          "id": "meeting.read_client_meetings",
          "version": "0.2.0"
        },
        {
          "id": "meeting.query_debriefs",
          "version": "0.2.0"
        },
        {
          "id": "read_client_documents",
          "version": "0.2.0"
        },
        {
          "id": "search_memory",
          "version": "0.2.0"
        },
        {
          "id": "query_tasks",
          "version": "0.2.0"
        },
        {
          "id": "query_action_items",
          "version": "0.2.0"
        },
        {
          "id": "read_monday_client_boards",
          "version": "0.2.0"
        },
        {
          "id": "search_tracked_bills",
          "version": "0.2.0"
        },
        {
          "id": "get_bill_status",
          "version": "0.2.0"
        },
        {
          "id": "search_committee_hearings",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.pe_deep_dive",
      "skillVersion": "1.0.0",
      "manifestSha256": "6c39f93daeb9c824cbbd37d0ced433dfa0a14d0454e41bd2ba4d3b0e5f4379d9",
      "proseSha256": "8032b4dcdf812f0b8ba60de5c5f1c9cc2a633aff6f19b71dcf5feadba83b4d8e",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "pe deep dive",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "entity",
        "client"
      ],
      "windowBases": [
        "fiscal-year",
        "explicit"
      ],
      "requiredSources": [
        {
          "sourceId": "program_elements",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "pe_references",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "bill_text",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "stored_public_reports",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "search_program_elements",
          "version": "0.2.0"
        },
        {
          "id": "get_program_element",
          "version": "0.2.0"
        },
        {
          "id": "get_pe_budget_timeline",
          "version": "0.2.0"
        },
        {
          "id": "get_pe_report_language",
          "version": "0.2.0"
        },
        {
          "id": "get_pe_contractors",
          "version": "0.2.0"
        },
        {
          "id": "get_pe_bills",
          "version": "0.2.0"
        },
        {
          "id": "read_bill_text",
          "version": "0.2.0"
        },
        {
          "id": "get_bill_status",
          "version": "0.2.0"
        },
        {
          "id": "search_cbo_cost_estimates",
          "version": "0.2.0"
        },
        {
          "id": "search_gao_reports",
          "version": "0.2.0"
        },
        {
          "id": "search_crs_reports",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.portfolio_changes",
      "skillVersion": "1.0.1",
      "manifestSha256": "1ef88b41f4246a06cd6444716ac703e226e70af6ffa8e4cf4bfb7bd8253b9709",
      "proseSha256": "c6632efe7264570dad0ae7380bb33bd34c187c79631e77d315d22e526725ae3d",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "portfolio changes",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "portfolio"
      ],
      "windowBases": [
        "calendar-week",
        "calendar-month",
        "explicit"
      ],
      "requiredSources": [
        {
          "sourceId": "clients",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "contacts",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "mail",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "meetings",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "tasks",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "monday",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "action_recommendations",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "outreach",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "strategies_work",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "program_elements",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "legiwatch_bills",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "hearings",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "grants",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "contracts_opportunities",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_awards",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "directory",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "district_nexus",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "institutional_knowledge",
          "authority": "approved-memory",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_documents",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "tasks",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "action_recommendation",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "client_knowledge_monday",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tracked_bills",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "business_development",
          "authority": "authoritative",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "search_capiro_data",
          "version": "0.2.0"
        },
        {
          "id": "get_client_context",
          "version": "0.3.0"
        },
        {
          "id": "mail.search_messages",
          "version": "0.2.0"
        },
        {
          "id": "mail.read_thread",
          "version": "0.2.0"
        },
        {
          "id": "meeting.read_client_meetings",
          "version": "0.2.0"
        },
        {
          "id": "meeting.query_debriefs",
          "version": "0.2.0"
        },
        {
          "id": "read_client_documents",
          "version": "0.2.0"
        },
        {
          "id": "query_tasks",
          "version": "0.2.0"
        },
        {
          "id": "query_action_items",
          "version": "0.2.0"
        },
        {
          "id": "read_monday_client_boards",
          "version": "0.2.0"
        },
        {
          "id": "search_tracked_bills",
          "version": "0.2.0"
        },
        {
          "id": "get_bill_status",
          "version": "0.2.0"
        },
        {
          "id": "get_district_nexus_changes",
          "version": "0.2.0"
        },
        {
          "id": "get_business_development_recent_changes",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.portfolio_overlap",
      "skillVersion": "1.0.1",
      "manifestSha256": "5ed004bb0fc21b7348aba360a83cf8be1e5c748e45c0a565ad04ecc3b8a72d2b",
      "proseSha256": "2c3a84fa2a4cd334202a005b6bf2b0253aaf85404d441be0ba2ace44eb009f11",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "portfolio overlap",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "portfolio"
      ],
      "windowBases": [
        "explicit",
        "fiscal-year",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "clients",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "contacts",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "mail",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "meetings",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "tasks",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "monday",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "action_recommendations",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "outreach",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "strategies_work",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "program_elements",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "legiwatch_bills",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "hearings",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "grants",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "contracts_opportunities",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_awards",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "directory",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "district_nexus",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "institutional_knowledge",
          "authority": "approved-memory",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "entity_candidates",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "public_web",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_market",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "tenant_contacts",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "search_capiro_data",
          "version": "0.2.0"
        },
        {
          "id": "get_client_context",
          "version": "0.3.0"
        },
        {
          "id": "resolve_entity",
          "version": "0.2.0"
        },
        {
          "id": "search_public_web",
          "version": "0.2.0"
        },
        {
          "id": "scrape_web_page",
          "version": "0.2.0"
        },
        {
          "id": "search_program_elements",
          "version": "0.2.0"
        },
        {
          "id": "get_program_element",
          "version": "0.2.0"
        },
        {
          "id": "search_federal_contract_awards",
          "version": "0.2.0"
        },
        {
          "id": "search_federal_subawards",
          "version": "0.2.0"
        },
        {
          "id": "find_contacts",
          "version": "0.2.0"
        },
        {
          "id": "get_district_nexus_context",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.regulatory_docket_brief",
      "skillVersion": "1.0.1",
      "manifestSha256": "8c68e30969cdee09f8fac0b6b7c6a85167704d4538ad612392edec4e6933027a",
      "proseSha256": "413fe92d76e3e68282906fc93412e3f06afec07e2cb1e321e8df038e36d86c4e",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "regulatory docket brief",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "entity",
        "client"
      ],
      "windowBases": [
        "calendar-week",
        "calendar-month",
        "explicit",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "entity_candidates",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "regulatory_dockets",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "rule_status",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "research_legal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "public_web",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "resolve_entity",
          "version": "0.2.0"
        },
        {
          "id": "query_regulatory_dockets",
          "version": "0.2.0"
        },
        {
          "id": "get_state_rule_status",
          "version": "0.2.0"
        },
        {
          "id": "get_legal_reference",
          "version": "0.2.0"
        },
        {
          "id": "search_public_web",
          "version": "0.2.0"
        },
        {
          "id": "scrape_web_page",
          "version": "0.2.0"
        },
        {
          "id": "get_client_context",
          "version": "0.3.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.relationship_brief",
      "skillVersion": "1.0.0",
      "manifestSha256": "dc7f9358bd9d646d6d6ca88c9528ad16edbc7552d6765b0d97d945c31d1bc7ed",
      "proseSha256": "3b6a422d87c0a61562fbe2f2ba96b164b282f62d38058e7db0e15a97672d99ee",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "relationship brief",
      "runtimeSupported": true,
      "available": false,
      "unavailableReason": "CURRENT_INSTALLATION_REQUIRED",
      "subjectKinds": [
        "client",
        "entity"
      ],
      "windowBases": [
        "calendar-week",
        "calendar-month",
        "calendar-year",
        "relative-duration",
        "explicit",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "entity_candidates",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tenant_contacts",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "mail",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "meetings",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_documents",
          "authority": "authoritative",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_knowledge_memory",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tasks",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "action_recommendation",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "client_knowledge_monday",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "resolve_entity",
          "version": "0.2.0"
        },
        {
          "id": "find_contacts",
          "version": "0.2.0"
        },
        {
          "id": "mail.search_messages",
          "version": "0.2.0"
        },
        {
          "id": "mail.read_thread",
          "version": "0.2.0"
        },
        {
          "id": "meeting.read_client_meetings",
          "version": "0.2.0"
        },
        {
          "id": "meeting.query_debriefs",
          "version": "0.2.0"
        },
        {
          "id": "read_client_documents",
          "version": "0.2.0"
        },
        {
          "id": "search_memory",
          "version": "0.2.0"
        },
        {
          "id": "query_tasks",
          "version": "0.2.0"
        },
        {
          "id": "query_action_items",
          "version": "0.2.0"
        },
        {
          "id": "read_monday_client_boards",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.representation_lookup",
      "skillVersion": "1.0.1",
      "manifestSha256": "0d9f59f1cd1feb8684c0c8abb0f95b0cb5464d8799ad0c6be2da68efe217d1a9",
      "proseSha256": "d49f44ac5afa0e04f27f516613cda54a1e8813de75090d7f650fc63a2c22e6bf",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "representation lookup",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client",
        "entity"
      ],
      "windowBases": [
        "explicit",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "facility_representation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "state_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "legislative_directory",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "district_nexus",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tenant_contacts",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "get_client_context",
          "version": "0.3.0"
        },
        {
          "id": "get_representation",
          "version": "0.2.0"
        },
        {
          "id": "get_state_legislator",
          "version": "0.2.0"
        },
        {
          "id": "list_members",
          "version": "0.2.0"
        },
        {
          "id": "get_committee_roster",
          "version": "0.2.0"
        },
        {
          "id": "get_district_nexus_context",
          "version": "0.2.0"
        },
        {
          "id": "find_contacts",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.research_company",
      "skillVersion": "1.0.1",
      "manifestSha256": "89d0dd5bf0e773e27b4f3e006b14d7cd4223cb981f9ee68ffffaadbef4cb41a9",
      "proseSha256": "9139d0bed0bb1919386dd26c0407ad2e8e10303865a0c52a418cc6beb3c42929",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "research company",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client",
        "entity"
      ],
      "windowBases": [
        "explicit",
        "fiscal-year",
        "unbounded"
      ],
      "requiredSources": [
        {
          "sourceId": "entity_candidates",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "client_knowledge_profile",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "public_web",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "program_elements",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_market",
          "authority": "authoritative",
          "purpose": "enumeration"
        },
        {
          "sourceId": "stored_public_data",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "funding_opportunities",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "sam_opportunities",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tracked_bills",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "bill_text",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "certification_status",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "tenant_contacts",
          "authority": "derived",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "resolve_entity",
          "version": "0.2.0"
        },
        {
          "id": "get_client_context",
          "version": "0.3.0"
        },
        {
          "id": "search_public_web",
          "version": "0.2.0"
        },
        {
          "id": "scrape_web_page",
          "version": "0.2.0"
        },
        {
          "id": "search_program_elements",
          "version": "0.2.0"
        },
        {
          "id": "get_program_element",
          "version": "0.2.0"
        },
        {
          "id": "get_pe_budget_timeline",
          "version": "0.2.0"
        },
        {
          "id": "search_federal_contract_awards",
          "version": "0.2.0"
        },
        {
          "id": "search_federal_subawards",
          "version": "0.2.0"
        },
        {
          "id": "search_contract_vehicles",
          "version": "0.2.0"
        },
        {
          "id": "search_procurement_forecasts",
          "version": "0.2.0"
        },
        {
          "id": "search_federal_grants",
          "version": "0.2.0"
        },
        {
          "id": "search_funding_opportunities",
          "version": "0.2.0"
        },
        {
          "id": "get_funding_opportunity_requirements",
          "version": "0.2.0"
        },
        {
          "id": "search_sam_opportunities",
          "version": "0.2.0"
        },
        {
          "id": "search_tracked_bills",
          "version": "0.2.0"
        },
        {
          "id": "get_bill_status",
          "version": "0.2.0"
        },
        {
          "id": "read_bill_text",
          "version": "0.2.0"
        },
        {
          "id": "get_certification_status",
          "version": "0.2.0"
        },
        {
          "id": "find_contacts",
          "version": "0.2.0"
        }
      ]
    },
    {
      "skillId": "quick_skill.bill_watch",
      "skillVersion": "1.0.1",
      "manifestSha256": "3aa78e8d41f7a83bb0499fd96660f875cfde3c29956a7c7bfbf2e34bb9d4d67d",
      "proseSha256": "b73c8406c7525a437292ac6055bc60d5f9c1fa6b457158cf45eb125bac18f58c",
      "catalogSha256": "58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c",
      "label": "bill watch",
      "runtimeSupported": false,
      "available": false,
      "unavailableReason": "RUNTIME_NOT_QUALIFIED",
      "subjectKinds": [
        "client"
      ],
      "windowBases": [
        "explicit",
        "fiscal-year"
      ],
      "requiredSources": [
        {
          "sourceId": "bill_text",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "federal_legislation",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "program_elements",
          "authority": "derived",
          "purpose": "evidence"
        },
        {
          "sourceId": "artifact_versions",
          "authority": "authoritative",
          "purpose": "evidence"
        }
      ],
      "operations": [
        {
          "id": "read_bill_text",
          "version": "0.2.0"
        },
        {
          "id": "get_bill_status",
          "version": "0.2.0"
        },
        {
          "id": "get_pe_budget_timeline",
          "version": "0.2.0"
        },
        {
          "id": "create_word",
          "version": "0.2.0"
        }
      ]
    }
  ]
});
