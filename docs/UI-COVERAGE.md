# Meri UI coverage ledger — captured design inventory

Status: **classification and proposed mapping only**. Every implementation, behavior, visual, accessibility and Playwright check below is PENDING. No row is accepted product behavior and no agreed v1 capability is silently deferred. Read [UI-SPEC](UI-SPEC.md) for current contract boundaries and the initial Home control table. The complete control audit outside Home remains OPEN.

## Pinned baseline and counting rules

Use [inventory.json](design/meri/20261010T004355Z/inventory.json) (SHA256 `6b04fb2b28ed90c17247a4722d671f8af8b7890534b7c5f83dd309d49b29ec6a`), [capture-manifest.json](design/meri/20261010T004355Z/capture-manifest.json) (SHA256 `cd5fed106532eccce57de84dd9013e7e30108de16bd4c7e4afa861a9f8bd02e6`) and [SUMMARY](design/meri/20261010T004355Z/SUMMARY.md). File `Zc2dEN5aLU47dVdsewDmiJ` / page `411:40601` / section `439:81406` are the owned reference. The non-atomic multi-call capture spans **2026-10-10T00:43:55.609Z–00:54:02.016Z**; an immutable Figma version was unavailable. Only direct-root metadata fingerprints matched during part of that window. Later nested edits are not excluded. Full reaction graph/overlay controls remain incomplete. The original baseline omitted 18 referenced style definitions and its dark PNG download failed MIME validation; those historical facts remain unchanged. The original snapshot contains 10 files; its manifest lists 9 payload files and excludes its own self-hash.

The separately adopted later [extension](design/meri/20261010T012511Z-extension/SUMMARY.md) spans **2026-10-10T01:25:11.846Z–01:26:23.924Z** and contains 8 files / 7 manifest payloads. Its [manifest](design/meri/20261010T012511Z-extension/capture-manifest.json), SHA256 `229c5d7082f33e366277aa20b042d389db2f85b7a4dd75f3f9ae3b9369295f85`, binds all 18 exact [style definitions](design/meri/20261010T012511Z-extension/styles.json) (15 text / 2 effect / 1 paint; SHA256 `9ecb24384a628aa7a28ff75e2d27ec454ad8bcd6871956568bb1b999c9ef4ff3`) and an inspected [dark PNG](design/meri/20261010T012511Z-extension/dark-448-89992.png) (1440×1040; SHA256 `d5c921e681e918b02cdb5b705347798d3d554570faf1f026aa295169c718b674`). Dark content/sidebar coexist with a light shared header. This later live capture is non-atomic with no immutable Figma revision; matching original/start/end direct-root metadata does not exclude nested/style edits. The original snapshot is not rewritten or merged with it. Six new extension capture text files deliberately preserve source EOF blank lines, like the six original capture text files, to maintain exact hashes; this capture-only exception is not a clean-whitespace claim.

Font licensing/files/runtime availability, live theme switching, full controls and all UI behavior/visual/accessibility checks remain OPEN or PENDING. Ledger counts, frozen contracts and D008 are unchanged.

| Inventory category | Captured | Classified here | Implemented / passing |
| --- | --- | --- | --- |
| Main roots | 85 (80 screens + 5 state boards) | 85 | 0; PENDING |
| Overlay roots | 29 | 29 | 0; PENDING |
| State examples | 60 | 60 | 0; PENDING |
| Component families / variants | 15 / 70 | 15 families; all 70 exact variant IDs linked to inventory | 0; PENDING |
| Named walkthrough starts | 11 | 11 | 0; PENDING |
| Review map root | 1 | 1 supporting board | Reference only |

Main roots are direct FRAME children named NN.NN; overlays are direct FRAME children named Overlay; state cards are State frames inside the five 11.xx boards. Nested layout frames are not additional screens. Components are nested owned metadata; references to main components outside the section do not authorize outside-section traversal or source reuse.

C means **proposed Lane C UI owner**; A is runtime/broker/durability, B authorization/data/selected mutations, D independent verification. Shared notation C+A/B/D proposes collaboration, not an already dispatched Hermes ticket. All route URLs are UNRESOLVED. Names below are proposed logical components/fixtures, not existing exports, files, working routes or verified package APIs. Each future Playwright ID is a reserved scenario label, with no test implementation. Main screens, overlays, state cards and component families are v1 planned unless classified supporting board. Supporting boards remain required fixture/reference inputs; they are not capability deferrals.

## Main screens and supporting state boards — 85 exact IDs

| Figma ID | Exact captured name | Release class | Owner proposed | Route / component proposal | Future Playwright | Implementation/checks |
| --- | --- | --- | --- | --- | --- | --- |
| 442:81437 | 01.01 · Home | v1 planned | C+B | Route UNRESOLVED; HomeView (proposed) | PW-SCREEN-01-01 | PENDING |
| 442:81682 | 01.02 · Cited answer | v1 planned | C+B | Route UNRESOLVED; CitedAnswerView (proposed) | PW-SCREEN-01-02 | PENDING |
| 442:81953 | 01.03 · Choose client and data scope | v1 planned | C+B | Route UNRESOLVED; ChooseClientAndDataScopeView (proposed) | PW-SCREEN-01-03 | PENDING |
| 442:82205 | 01.04 · Conversation history | v1 planned | C+B | Route UNRESOLVED; ConversationHistoryView (proposed) | PW-SCREEN-01-04 | PENDING |
| 442:82465 | 01.05 · Search and command palette | v1 planned | C+B | Route UNRESOLVED; SearchAndCommandPaletteView (proposed) | PW-SCREEN-01-05 | PENDING |
| 443:82027 | 02.01 · Research in progress | v1 planned | C+A | Route UNRESOLVED; ResearchInProgressView (proposed) | PW-SCREEN-02-01 | PENDING |
| 443:82286 | 02.02 · Parallel specialist activity | v1 planned | C+A | Route UNRESOLVED; ParallelSpecialistActivityView (proposed) | PW-SCREEN-02-02 | PENDING |
| 443:82547 | 02.03 · Run detail | v1 planned | C+A | Route UNRESOLVED; RunDetailView (proposed) | PW-SCREEN-02-03 | PENDING |
| 443:82819 | 02.04 · Background runs | v1 planned | C+A | Route UNRESOLVED; BackgroundRunsView (proposed) | PW-SCREEN-02-04 | PENDING |
| 443:83910 | 02.05 · Steer and stop a run | v1 planned | C+A | Route UNRESOLVED; SteerAndStopARunView (proposed) | PW-SCREEN-02-05 | PENDING |
| 443:84112 | 02.06 · Checkpoint and verified restore | v1 planned | C+A | Route UNRESOLVED; CheckpointAndVerifiedRestoreView (proposed) | PW-SCREEN-02-06 | PENDING |
| 443:84316 | 02.07 · Tool activity and receipts | v1 planned | C+A | Route UNRESOLVED; ToolActivityAndReceiptsView (proposed) | PW-SCREEN-02-07 | PENDING |
| 443:84534 | 02.08 · Interrupted run and fork | v1 planned | C+A | Route UNRESOLVED; InterruptedRunAndForkView (proposed) | PW-SCREEN-02-08 | PENDING |
| 443:84733 | 03.01 · Workspace files | v1 planned | C+A | Route UNRESOLVED; WorkspaceFilesView (proposed) | PW-SCREEN-03-01 | PENDING |
| 443:85000 | 03.02 · Word document workspace | v1 planned | C+A | Route UNRESOLVED; WordDocumentWorkspaceView (proposed) | PW-SCREEN-03-02 | PENDING |
| 443:85315 | 03.03 · PDF and multi-page preview | v1 planned | C+A | Route UNRESOLVED; PDFAndMultiPagePreviewView (proposed) | PW-SCREEN-03-03 | PENDING |
| 444:83270 | 03.04 · Spreadsheet preview | v1 planned | C+A | Route UNRESOLVED; SpreadsheetPreviewView (proposed) | PW-SCREEN-03-04 | PENDING |
| 444:83586 | 03.05 · Presentation preview | v1 planned | C+A | Route UNRESOLVED; PresentationPreviewView (proposed) | PW-SCREEN-03-05 | PENDING |
| 444:83833 | 03.06 · Generated web preview | v1 planned | C+A | Route UNRESOLVED; GeneratedWebPreviewView (proposed) | PW-SCREEN-03-06 | PENDING |
| 444:88256 | 03.07 · Code and execution activity | v1 planned | C+A | Route UNRESOLVED; CodeAndExecutionActivityView (proposed) | PW-SCREEN-03-07 | PENDING |
| 444:88450 | 03.08 · Analysis outputs | v1 planned | C+A | Route UNRESOLVED; AnalysisOutputsView (proposed) | PW-SCREEN-03-08 | PENDING |
| 444:88705 | 03.09 · Versions and comparison | v1 planned | C+A | Route UNRESOLVED; VersionsAndComparisonView (proposed) | PW-SCREEN-03-09 | PENDING |
| 444:88936 | 03.10 · Revise an artifact | v1 planned | C+A | Route UNRESOLVED; ReviseAnArtifactView (proposed) | PW-SCREEN-03-10 | PENDING |
| 445:84258 | 04.01 · Upload and attachment menu | v1 planned | C+A+B | Route UNRESOLVED; UploadAndAttachmentMenuView (proposed) | PW-SCREEN-04-01 | PENDING |
| 445:84498 | 04.02 · Attach an authorized Capiro file | v1 planned | C+A+B | Route UNRESOLVED; AttachAnAuthorizedCapiroFileView (proposed) | PW-SCREEN-04-02 | PENDING |
| 445:84716 | 04.03 · Upload and extraction progress | v1 planned | C+A+B | Route UNRESOLVED; UploadAndExtractionProgressView (proposed) | PW-SCREEN-04-03 | PENDING |
| 445:84926 | 04.04 · File artifact to client | v1 planned | C+A+B | Route UNRESOLVED; FileArtifactToClientView (proposed) | PW-SCREEN-04-04 | PENDING |
| 445:85964 | 04.05 · Download exact artifact version | v1 planned | C+A+B | Route UNRESOLVED; DownloadExactArtifactVersionView (proposed) | PW-SCREEN-04-05 | PENDING |
| 445:86178 | 04.06 · Revision progress and verification | v1 planned | C+A+B | Route UNRESOLVED; RevisionProgressAndVerificationView (proposed) | PW-SCREEN-04-06 | PENDING |
| 445:86377 | 04.07 · Filing and download receipts | v1 planned | C+A+B | Route UNRESOLVED; FilingAndDownloadReceiptsView (proposed) | PW-SCREEN-04-07 | PENDING |
| 446:84960 | 05.01 · Evidence and citations | v1 planned | C+B | Route UNRESOLVED; EvidenceAndCitationsView (proposed) | PW-SCREEN-05-01 | PENDING |
| 446:85206 | 05.02 · Data coverage and capabilities | v1 planned | C+B | Route UNRESOLVED; DataCoverageAndCapabilitiesView (proposed) | PW-SCREEN-05-02 | PENDING |
| 446:85469 | 05.03 · Freshness, partial and historical results | v1 planned | C+B | Route UNRESOLVED; FreshnessPartialAndHistoricalResultsView (proposed) | PW-SCREEN-05-03 | PENDING |
| 446:85688 | 05.04 · Institutional Memory recall | v1 planned | C+B | Route UNRESOLVED; InstitutionalMemoryRecallView (proposed) | PW-SCREEN-05-04 | PENDING |
| 446:87422 | 05.05 · Memory detail and provenance | v1 planned | C+B | Route UNRESOLVED; MemoryDetailAndProvenanceView (proposed) | PW-SCREEN-05-05 | PENDING |
| 446:87639 | 05.06 · Memory update proposal | v1 planned | C+B | Route UNRESOLVED; MemoryUpdateProposalView (proposed) | PW-SCREEN-05-06 | PENDING |
| 446:87838 | 05.07 · Access changed and clean recovery | v1 planned | C+B | Route UNRESOLVED; AccessChangedAndCleanRecoveryView (proposed) | PW-SCREEN-05-07 | PENDING |
| 459:90479 | 05.08 · Approved memory outcome | v1 planned | C+B | Route UNRESOLVED; ApprovedMemoryOutcomeView (proposed) | PW-SCREEN-05-08 | PENDING |
| 466:91138 | 05.09 · Funding evidence detail | v1 planned | C+B | Route UNRESOLVED; FundingEvidenceDetailView (proposed) | PW-SCREEN-05-09 | PENDING |
| 447:85660 | 06.01 · Approval center | v1 planned | C+A+B | Route UNRESOLVED; ApprovalCenterView (proposed) | PW-SCREEN-06-01 | PENDING |
| 447:85887 | 06.02 · Memory approval review | v1 planned | C+A+B | Route UNRESOLVED; MemoryApprovalReviewView (proposed) | PW-SCREEN-06-02 | PENDING |
| 447:86100 | 06.03 · Draft a client task | v1 planned | C+A+B | Route UNRESOLVED; DraftAClientTaskView (proposed) | PW-SCREEN-06-03 | PENDING |
| 447:86303 | 06.04 · Review exact task action | v1 planned | C+A+B | Route UNRESOLVED; ReviewExactTaskActionView (proposed) | PW-SCREEN-06-04 | PENDING |
| 447:87361 | 06.05 · Review artifact filing | v1 planned | C+A+B | Route UNRESOLVED; ReviewArtifactFilingView (proposed) | PW-SCREEN-06-05 | PENDING |
| 447:87582 | 06.06 · Approved action receipts | v1 planned | C+A+B | Route UNRESOLVED; ApprovedActionReceiptsView (proposed) | PW-SCREEN-06-06 | PENDING |
| 447:87788 | 06.07 · Reject or request changes | v1 planned | C+A+B | Route UNRESOLVED; RejectOrRequestChangesView (proposed) | PW-SCREEN-06-07 | PENDING |
| 447:87985 | 07.01 · Public browser activity | v1 planned | C+A+B | Route UNRESOLVED; PublicBrowserActivityView (proposed) | PW-SCREEN-07-01 | PENDING |
| 447:88214 | 07.02 · Site connection and sign-in | v1 planned | C+A+B | Route UNRESOLVED; SiteConnectionAndSignInView (proposed) | PW-SCREEN-07-02 | PENDING |
| 447:88418 | 07.03 · Browser files and receipts | v1 planned | C+A+B | Route UNRESOLVED; BrowserFilesAndReceiptsView (proposed) | PW-SCREEN-07-03 | PENDING |
| 447:88639 | 07.04 · Browser connection states | v1 planned | C+A+B | Route UNRESOLVED; BrowserConnectionStatesView (proposed) | PW-SCREEN-07-04 | PENDING |
| 447:88833 | 08.01 · Schedules | v1 planned | C+A+B | Route UNRESOLVED; SchedulesView (proposed) | PW-SCREEN-08-01 | PENDING |
| 447:89078 | 08.02 · Create or edit schedule | v1 planned | C+A+B | Route UNRESOLVED; CreateOrEditScheduleView (proposed) | PW-SCREEN-08-02 | PENDING |
| 447:89296 | 08.03 · Schedule detail | v1 planned | C+A+B | Route UNRESOLVED; ScheduleDetailView (proposed) | PW-SCREEN-08-03 | PENDING |
| 447:89525 | 08.04 · Schedule history and authority changes | v1 planned | C+A+B | Route UNRESOLVED; ScheduleHistoryAndAuthorityChangesView (proposed) | PW-SCREEN-08-04 | PENDING |
| 448:87360 | 09.01 · Personal preferences | v1 planned | C+B | Route UNRESOLVED; PersonalPreferencesView (proposed) | PW-SCREEN-09-01 | PENDING |
| 448:87595 | 09.02 · Connector accounts and permissions | v1 planned | C+B | Route UNRESOLVED; ConnectorAccountsAndPermissionsView (proposed) | PW-SCREEN-09-02 | PENDING |
| 448:87836 | 09.03 · Usage and workspace limits | v1 planned | C+B | Route UNRESOLVED; UsageAndWorkspaceLimitsView (proposed) | PW-SCREEN-09-03 | PENDING |
| 448:88066 | 09.04 · Skills and artifact templates | v1 planned | C+B | Route UNRESOLVED; SkillsAndArtifactTemplatesView (proposed) | PW-SCREEN-09-04 | PENDING |
| 448:89130 | 09.05 · Notifications and account menu | v1 planned | C+B | Route UNRESOLVED; NotificationsAndAccountMenuView (proposed) | PW-SCREEN-09-05 | PENDING |
| 448:89371 | 09.06 · Privacy and deletion | v1 planned | C+B | Route UNRESOLVED; PrivacyAndDeletionView (proposed) | PW-SCREEN-09-06 | PENDING |
| 448:89562 | 09.07 · Help, shortcuts and feedback | v1 planned | C+B | Route UNRESOLVED; HelpShortcutsAndFeedbackView (proposed) | PW-SCREEN-09-07 | PENDING |
| 448:89779 | 09.08 · Conversation management and branches | v1 planned | C+B | Route UNRESOLVED; ConversationManagementAndBranchesView (proposed) | PW-SCREEN-09-08 | PENDING |
| 448:89992 | 10.01 · Dark workspace | v1 planned | C | Route UNRESOLVED; DarkWorkspaceView (proposed) | PW-SCREEN-10-01 | PENDING |
| 448:90209 | 10.02 · Tablet conversation | v1 planned | C | Route UNRESOLVED; TabletConversationView (proposed) | PW-SCREEN-10-02 | PENDING |
| 448:90399 | 10.03 · Tablet artifact drawer | v1 planned | C | Route UNRESOLVED; TabletArtifactDrawerView (proposed) | PW-SCREEN-10-03 | PENDING |
| 449:88256 | 10.04 · Mobile home | v1 planned | C | Route UNRESOLVED; MobileHomeView (proposed) | PW-SCREEN-10-04 | PENDING |
| 449:88373 | 10.05 · Mobile conversation | v1 planned | C | Route UNRESOLVED; MobileConversationView (proposed) | PW-SCREEN-10-05 | PENDING |
| 449:88504 | 10.06 · Mobile artifact | v1 planned | C | Route UNRESOLVED; MobileArtifactView (proposed) | PW-SCREEN-10-06 | PENDING |
| 449:88625 | 10.07 · Mobile task approval | v1 planned | C | Route UNRESOLVED; MobileTaskApprovalView (proposed) | PW-SCREEN-10-07 | PENDING |
| 449:88715 | 10.08 · Mobile navigation | v1 planned | C | Route UNRESOLVED; MobileNavigationView (proposed) | PW-SCREEN-10-08 | PENDING |
| 458:90135 | 10.09 · Mobile sources | v1 planned | C | Route UNRESOLVED; MobileSourcesView (proposed) | PW-SCREEN-10-09 | PENDING |
| 458:90218 | 10.10 · Mobile artifact actions | v1 planned | C | Route UNRESOLVED; MobileArtifactActionsView (proposed) | PW-SCREEN-10-10 | PENDING |
| 458:90320 | 10.11 · Mobile artifact revision | v1 planned | C | Route UNRESOLVED; MobileArtifactRevisionView (proposed) | PW-SCREEN-10-11 | PENDING |
| 458:90397 | 10.12 · Mobile versions | v1 planned | C | Route UNRESOLVED; MobileVersionsView (proposed) | PW-SCREEN-10-12 | PENDING |
| 458:90494 | 10.13 · Mobile filing review | v1 planned | C | Route UNRESOLVED; MobileFilingReviewView (proposed) | PW-SCREEN-10-13 | PENDING |
| 459:90168 | 10.14 · Mobile scope picker | v1 planned | C | Route UNRESOLVED; MobileScopePickerView (proposed) | PW-SCREEN-10-14 | PENDING |
| 459:90251 | 10.15 · Mobile upload | v1 planned | C | Route UNRESOLVED; MobileUploadView (proposed) | PW-SCREEN-10-15 | PENDING |
| 459:90349 | 10.16 · Mobile research progress | v1 planned | C | Route UNRESOLVED; MobileResearchProgressView (proposed) | PW-SCREEN-10-16 | PENDING |
| 454:90810 | 10.17 · Mobile filing receipt | v1 planned | C | Route UNRESOLVED; MobileFilingReceiptView (proposed) | PW-SCREEN-10-17 | PENDING |
| 454:90889 | 10.18 · Mobile revision progress | v1 planned | C | Route UNRESOLVED; MobileRevisionProgressView (proposed) | PW-SCREEN-10-18 | PENDING |
| 450:88532 | 11.01 · Run and recovery state board | supporting board | C+D | Route UNRESOLVED; StateBoardFixture/RunAndRecoveryStateBoard (proposed) | PW-BOARD-11-01 | PENDING |
| 450:88823 | 11.02 · File and artifact error state board | supporting board | C+D | Route UNRESOLVED; StateBoardFixture/FileAndArtifactErrorStateBoard (proposed) | PW-BOARD-11-02 | PENDING |
| 450:89113 | 11.03 · Approval and permission state board | supporting board | C+D | Route UNRESOLVED; StateBoardFixture/ApprovalAndPermissionStateBoard (proposed) | PW-BOARD-11-03 | PENDING |
| 450:90240 | 11.04 · Conversation and memory lifecycle states | supporting board | C+D | Route UNRESOLVED; StateBoardFixture/ConversationAndMemoryLifecycleStates (proposed) | PW-BOARD-11-04 | PENDING |
| 450:90530 | 11.05 · Empty, search and success states | supporting board | C+D | Route UNRESOLVED; StateBoardFixture/EmptySearchAndSuccessStates (proposed) | PW-BOARD-11-05 | PENDING |

## Overlays — 29 exact IDs

All are v1 planned. Toast/success copy must follow a real local outcome or authorized server receipt. A prototype success overlay is not an executable receipt. Dialog close/cancel/focus and exact scope/version binding follow UI-SPEC.

| Figma ID | Exact captured name | Release class | Owner proposed | Route / component proposal | Future Playwright | Implementation/checks |
| --- | --- | --- | --- | --- | --- | --- |
| 459:90684 | Overlay · Copied | v1 planned | C+A+B | Route UNRESOLVED; CopiedOverlay (proposed) | PW-OVERLAY-459-90684 | PENDING |
| 459:90696 | Overlay · Saved | v1 planned | C+A+B | Route UNRESOLVED; SavedOverlay (proposed) | PW-OVERLAY-459-90696 | PENDING |
| 459:90708 | Overlay · Download ready | v1 planned | C+A+B | Route UNRESOLVED; DownloadReadyOverlay (proposed) | PW-OVERLAY-459-90708 | PENDING |
| 459:90720 | Overlay · Conversation deleted | v1 planned | C+A+B | Route UNRESOLVED; ConversationDeletedOverlay (proposed) | PW-OVERLAY-459-90720 | PENDING |
| 459:90731 | Overlay · Schedule paused | v1 planned | C+A+B | Route UNRESOLVED; SchedulePausedOverlay (proposed) | PW-OVERLAY-459-90731 | PENDING |
| 459:90750 | Overlay · Cancel future runs? | v1 planned | C+A+B | Route UNRESOLVED; CancelFutureRunsOverlay (proposed) | PW-OVERLAY-459-90750 | PENDING |
| 459:90767 | Overlay · Research account connected | v1 planned | C+A+B | Route UNRESOLVED; ResearchAccountConnectedOverlay (proposed) | PW-OVERLAY-459-90767 | PENDING |
| 459:90780 | Overlay · Stop remaining work? | v1 planned | C+A+B | Route UNRESOLVED; StopRemainingWorkOverlay (proposed) | PW-OVERLAY-459-90780 | PENDING |
| 459:90798 | Overlay · Task created | v1 planned | C+A+B | Route UNRESOLVED; TaskCreatedOverlay (proposed) | PW-OVERLAY-459-90798 | PENDING |
| 459:90811 | Overlay · Artifact filed | v1 planned | C+A+B | Route UNRESOLVED; ArtifactFiledOverlay (proposed) | PW-OVERLAY-459-90811 | PENDING |
| 467:90607 | Overlay · Run cancelled | v1 planned | C+A+B | Route UNRESOLVED; RunCancelledOverlay (proposed) | PW-OVERLAY-467-90607 | PENDING |
| 468:90614 | Overlay · Revise funding analysis | v1 planned | C+A+B | Route UNRESOLVED; ReviseFundingAnalysisOverlay (proposed) | PW-OVERLAY-468-90614 | PENDING |
| 468:90641 | Overlay · File funding analysis | v1 planned | C+A+B | Route UNRESOLVED; FileFundingAnalysisOverlay (proposed) | PW-OVERLAY-468-90641 | PENDING |
| 468:90694 | Overlay · Revising funding analysis | v1 planned | C+A+B | Route UNRESOLVED; RevisingFundingAnalysisOverlay (proposed) | PW-OVERLAY-468-90694 | PENDING |
| 468:90715 | Overlay · Funding analysis filed | v1 planned | C+A+B | Route UNRESOLVED; FundingAnalysisFiledOverlay (proposed) | PW-OVERLAY-468-90715 | PENDING |
| 468:90737 | Overlay · Revise client update | v1 planned | C+A+B | Route UNRESOLVED; ReviseClientUpdateOverlay (proposed) | PW-OVERLAY-468-90737 | PENDING |
| 468:90764 | Overlay · File client update | v1 planned | C+A+B | Route UNRESOLVED; FileClientUpdateOverlay (proposed) | PW-OVERLAY-468-90764 | PENDING |
| 468:90817 | Overlay · Revising client update | v1 planned | C+A+B | Route UNRESOLVED; RevisingClientUpdateOverlay (proposed) | PW-OVERLAY-468-90817 | PENDING |
| 468:90838 | Overlay · Client update filed | v1 planned | C+A+B | Route UNRESOLVED; ClientUpdateFiledOverlay (proposed) | PW-OVERLAY-468-90838 | PENDING |
| 468:90860 | Overlay · Revise signal summary | v1 planned | C+A+B | Route UNRESOLVED; ReviseSignalSummaryOverlay (proposed) | PW-OVERLAY-468-90860 | PENDING |
| 468:90887 | Overlay · File signal summary | v1 planned | C+A+B | Route UNRESOLVED; FileSignalSummaryOverlay (proposed) | PW-OVERLAY-468-90887 | PENDING |
| 468:90940 | Overlay · Revising signal summary | v1 planned | C+A+B | Route UNRESOLVED; RevisingSignalSummaryOverlay (proposed) | PW-OVERLAY-468-90940 | PENDING |
| 468:90961 | Overlay · Signal summary filed | v1 planned | C+A+B | Route UNRESOLVED; SignalSummaryFiledOverlay (proposed) | PW-OVERLAY-468-90961 | PENDING |
| 468:91832 | Overlay · Download Funding analysis | v1 planned | C+A+B | Route UNRESOLVED; DownloadFundingAnalysisOverlay (proposed) | PW-OVERLAY-468-91832 | PENDING |
| 468:91858 | Overlay · Download ready sheet | v1 planned | C+A+B | Route UNRESOLVED; DownloadReadySheetOverlay (proposed) | PW-OVERLAY-468-91858 | PENDING |
| 468:91870 | Overlay · Download Client update | v1 planned | C+A+B | Route UNRESOLVED; DownloadClientUpdateOverlay (proposed) | PW-OVERLAY-468-91870 | PENDING |
| 468:91902 | Overlay · Download ready slides | v1 planned | C+A+B | Route UNRESOLVED; DownloadReadySlidesOverlay (proposed) | PW-OVERLAY-468-91902 | PENDING |
| 468:91914 | Overlay · Download Signal summary | v1 planned | C+A+B | Route UNRESOLVED; DownloadSignalSummaryOverlay (proposed) | PW-OVERLAY-468-91914 | PENDING |
| 468:91939 | Overlay · Download ready html | v1 planned | C+A+B | Route UNRESOLVED; DownloadReadyHtmlOverlay (proposed) | PW-OVERLAY-468-91939 | PENDING |

## State examples — 60 exact IDs

All states remain v1 planned fixtures. Labels are captured design copy, not new schema enums. Cancelling, Changes requested, offline draft persistence and other unmapped outcomes need explicit local/contract decisions before implementation acceptance. Board IDs preserve the containing reference.

| Figma ID | Exact captured name | Board ID | Release class | Owner proposed | Component proposal | Future Playwright | Implementation/checks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 450:88686 | State · Queued | 450:88532 | v1 planned | C+A+D | StateFixture/Queued (proposed; route UNRESOLVED) | PW-STATE-450-88686 | PENDING |
| 450:88697 | State · Starting | 450:88532 | v1 planned | C+A+D | StateFixture/Starting (proposed; route UNRESOLVED) | PW-STATE-450-88697 | PENDING |
| 450:88708 | State · Running | 450:88532 | v1 planned | C+A+D | StateFixture/Running (proposed; route UNRESOLVED) | PW-STATE-450-88708 | PENDING |
| 450:88720 | State · Waiting for approval | 450:88532 | v1 planned | C+A+D | StateFixture/WaitingForApproval (proposed; route UNRESOLVED) | PW-STATE-450-88720 | PENDING |
| 450:88731 | State · Paused | 450:88532 | v1 planned | C+A+D | StateFixture/Paused (proposed; route UNRESOLVED) | PW-STATE-450-88731 | PENDING |
| 450:88742 | State · Cancelling | 450:88532 | v1 planned | C+A+D | StateFixture/Cancelling (proposed; route UNRESOLVED) | PW-STATE-450-88742 | PENDING |
| 450:88754 | State · Cancelled | 450:88532 | v1 planned | C+A+D | StateFixture/Cancelled (proposed; route UNRESOLVED) | PW-STATE-450-88754 | PENDING |
| 450:88765 | State · Budget reached | 450:88532 | v1 planned | C+A+D | StateFixture/BudgetReached (proposed; route UNRESOLVED) | PW-STATE-450-88765 | PENDING |
| 450:88776 | State · Deadline reached | 450:88532 | v1 planned | C+A+D | StateFixture/DeadlineReached (proposed; route UNRESOLVED) | PW-STATE-450-88776 | PENDING |
| 450:88788 | State · Provider unavailable | 450:88532 | v1 planned | C+A+D | StateFixture/ProviderUnavailable (proposed; route UNRESOLVED) | PW-STATE-450-88788 | PENDING |
| 450:88799 | State · Workspace not persisted | 450:88532 | v1 planned | C+A+D | StateFixture/WorkspaceNotPersisted (proposed; route UNRESOLVED) | PW-STATE-450-88799 | PENDING |
| 450:88810 | State · Restore failed | 450:88532 | v1 planned | C+A+D | StateFixture/RestoreFailed (proposed; route UNRESOLVED) | PW-STATE-450-88810 | PENDING |
| 450:88976 | State · Uploading | 450:88823 | v1 planned | C+A+D | StateFixture/Uploading (proposed; route UNRESOLVED) | PW-STATE-450-88976 | PENDING |
| 450:88987 | State · Partial extraction | 450:88823 | v1 planned | C+A+D | StateFixture/PartialExtraction (proposed; route UNRESOLVED) | PW-STATE-450-88987 | PENDING |
| 450:88998 | State · Unsupported type | 450:88823 | v1 planned | C+A+D | StateFixture/UnsupportedType (proposed; route UNRESOLVED) | PW-STATE-450-88998 | PENDING |
| 450:89010 | State · Upload limit exceeded | 450:88823 | v1 planned | C+A+D | StateFixture/UploadLimitExceeded (proposed; route UNRESOLVED) | PW-STATE-450-89010 | PENDING |
| 450:89021 | State · Password-protected or corrupt | 450:88823 | v1 planned | C+A+D | StateFixture/PasswordProtectedOrCorrupt (proposed; route UNRESOLVED) | PW-STATE-450-89021 | PENDING |
| 450:89032 | State · Page limit reached | 450:88823 | v1 planned | C+A+D | StateFixture/PageLimitReached (proposed; route UNRESOLVED) | PW-STATE-450-89032 | PENDING |
| 450:89044 | State · Duplicate attachment | 450:88823 | v1 planned | C+A+D | StateFixture/DuplicateAttachment (proposed; route UNRESOLVED) | PW-STATE-450-89044 | PENDING |
| 450:89055 | State · Attachment access denied | 450:88823 | v1 planned | C+A+D | StateFixture/AttachmentAccessDenied (proposed; route UNRESOLVED) | PW-STATE-450-89055 | PENDING |
| 450:89066 | State · Preview rendering failed | 450:88823 | v1 planned | C+A+D | StateFixture/PreviewRenderingFailed (proposed; route UNRESOLVED) | PW-STATE-450-89066 | PENDING |
| 450:89078 | State · Stale version | 450:88823 | v1 planned | C+A+D | StateFixture/StaleVersion (proposed; route UNRESOLVED) | PW-STATE-450-89078 | PENDING |
| 450:89089 | State · Output saving failed | 450:88823 | v1 planned | C+A+D | StateFixture/OutputSavingFailed (proposed; route UNRESOLVED) | PW-STATE-450-89089 | PENDING |
| 450:89100 | State · Verification failed | 450:88823 | v1 planned | C+A+D | StateFixture/VerificationFailed (proposed; route UNRESOLVED) | PW-STATE-450-89100 | PENDING |
| 450:89266 | State · Pending review | 450:89113 | v1 planned | C+B+D | StateFixture/PendingReview (proposed; route UNRESOLVED) | PW-STATE-450-89266 | PENDING |
| 450:89277 | State · Approved | 450:89113 | v1 planned | C+B+D | StateFixture/Approved (proposed; route UNRESOLVED) | PW-STATE-450-89277 | PENDING |
| 450:89288 | State · Executing | 450:89113 | v1 planned | C+B+D | StateFixture/Executing (proposed; route UNRESOLVED) | PW-STATE-450-89288 | PENDING |
| 450:89300 | State · Succeeded | 450:89113 | v1 planned | C+B+D | StateFixture/Succeeded (proposed; route UNRESOLVED) | PW-STATE-450-89300 | PENDING |
| 450:89311 | State · Rejected | 450:89113 | v1 planned | C+B+D | StateFixture/Rejected (proposed; route UNRESOLVED) | PW-STATE-450-89311 | PENDING |
| 450:89322 | State · Changes requested | 450:89113 | v1 planned | C+B+D | StateFixture/ChangesRequested (proposed; route UNRESOLVED) | PW-STATE-450-89322 | PENDING |
| 450:89334 | State · Expired | 450:89113 | v1 planned | C+B+D | StateFixture/Expired (proposed; route UNRESOLVED) | PW-STATE-450-89334 | PENDING |
| 450:89345 | State · Permission revoked | 450:89113 | v1 planned | C+B+D | StateFixture/PermissionRevoked (proposed; route UNRESOLVED) | PW-STATE-450-89345 | PENDING |
| 450:89356 | State · Already completed | 450:89113 | v1 planned | C+B+D | StateFixture/AlreadyCompleted (proposed; route UNRESOLVED) | PW-STATE-450-89356 | PENDING |
| 450:89368 | State · Action denied | 450:89113 | v1 planned | C+B+D | StateFixture/ActionDenied (proposed; route UNRESOLVED) | PW-STATE-450-89368 | PENDING |
| 450:89379 | State · Destination unavailable | 450:89113 | v1 planned | C+B+D | StateFixture/DestinationUnavailable (proposed; route UNRESOLVED) | PW-STATE-450-89379 | PENDING |
| 450:89390 | State · Read-only role | 450:89113 | v1 planned | C+B+D | StateFixture/ReadOnlyRole (proposed; route UNRESOLVED) | PW-STATE-450-89390 | PENDING |
| 450:90393 | State · Streaming answer | 450:90240 | v1 planned | C+A+B+D | StateFixture/StreamingAnswer (proposed; route UNRESOLVED) | PW-STATE-450-90393 | PENDING |
| 450:90404 | State · Scrolled away | 450:90240 | v1 planned | C+A+B+D | StateFixture/ScrolledAway (proposed; route UNRESOLVED) | PW-STATE-450-90404 | PENDING |
| 450:90415 | State · Offline | 450:90240 | v1 planned | C+A+B+D | StateFixture/Offline (proposed; route UNRESOLVED) | PW-STATE-450-90415 | PENDING |
| 450:90427 | State · Reconnecting | 450:90240 | v1 planned | C+A+B+D | StateFixture/Reconnecting (proposed; route UNRESOLVED) | PW-STATE-450-90427 | PENDING |
| 450:90438 | State · Unsent draft saved | 450:90240 | v1 planned | C+A+B+D | StateFixture/UnsentDraftSaved (proposed; route UNRESOLVED) | PW-STATE-450-90438 | PENDING |
| 450:90449 | State · Conversation access revoked | 450:90240 | v1 planned | C+A+B+D | StateFixture/ConversationAccessRevoked (proposed; route UNRESOLVED) | PW-STATE-450-90449 | PENDING |
| 450:90461 | State · Personal memory | 450:90240 | v1 planned | C+A+B+D | StateFixture/PersonalMemory (proposed; route UNRESOLVED) | PW-STATE-450-90461 | PENDING |
| 450:90472 | State · Superseded memory | 450:90240 | v1 planned | C+A+B+D | StateFixture/SupersededMemory (proposed; route UNRESOLVED) | PW-STATE-450-90472 | PENDING |
| 450:90483 | State · Conflicting evidence | 450:90240 | v1 planned | C+A+B+D | StateFixture/ConflictingEvidence (proposed; route UNRESOLVED) | PW-STATE-450-90483 | PENDING |
| 450:90495 | State · Memory proposal expired | 450:90240 | v1 planned | C+A+B+D | StateFixture/MemoryProposalExpired (proposed; route UNRESOLVED) | PW-STATE-450-90495 | PENDING |
| 450:90506 | State · Grant expired | 450:90240 | v1 planned | C+A+B+D | StateFixture/GrantExpired (proposed; route UNRESOLVED) | PW-STATE-450-90506 | PENDING |
| 450:90517 | State · Conversation export | 450:90240 | v1 planned | C+A+B+D | StateFixture/ConversationExport (proposed; route UNRESOLVED) | PW-STATE-450-90517 | PENDING |
| 450:90683 | State · No conversations | 450:90530 | v1 planned | C+B+D | StateFixture/NoConversations (proposed; route UNRESOLVED) | PW-STATE-450-90683 | PENDING |
| 450:90694 | State · No workspace files | 450:90530 | v1 planned | C+B+D | StateFixture/NoWorkspaceFiles (proposed; route UNRESOLVED) | PW-STATE-450-90694 | PENDING |
| 450:90705 | State · No pending approvals | 450:90530 | v1 planned | C+B+D | StateFixture/NoPendingApprovals (proposed; route UNRESOLVED) | PW-STATE-450-90705 | PENDING |
| 450:90717 | State · No schedules | 450:90530 | v1 planned | C+B+D | StateFixture/NoSchedules (proposed; route UNRESOLVED) | PW-STATE-450-90717 | PENDING |
| 450:90728 | State · No memory matches | 450:90530 | v1 planned | C+B+D | StateFixture/NoMemoryMatches (proposed; route UNRESOLVED) | PW-STATE-450-90728 | PENDING |
| 450:90739 | State · No search results | 450:90530 | v1 planned | C+B+D | StateFixture/NoSearchResults (proposed; route UNRESOLVED) | PW-STATE-450-90739 | PENDING |
| 450:90751 | State · No source matches | 450:90530 | v1 planned | C+B+D | StateFixture/NoSourceMatches (proposed; route UNRESOLVED) | PW-STATE-450-90751 | PENDING |
| 450:90762 | State · No authorized client | 450:90530 | v1 planned | C+B+D | StateFixture/NoAuthorizedClient (proposed; route UNRESOLVED) | PW-STATE-450-90762 | PENDING |
| 450:90773 | State · Saving | 450:90530 | v1 planned | C+B+D | StateFixture/Saving (proposed; route UNRESOLVED) | PW-STATE-450-90773 | PENDING |
| 450:90785 | State · Saved | 450:90530 | v1 planned | C+B+D | StateFixture/Saved (proposed; route UNRESOLVED) | PW-STATE-450-90785 | PENDING |
| 450:90796 | State · Object deleted | 450:90530 | v1 planned | C+B+D | StateFixture/ObjectDeleted (proposed; route UNRESOLVED) | PW-STATE-450-90796 | PENDING |
| 450:90807 | State · Duplicate prevented | 450:90530 | v1 planned | C+B+D | StateFixture/DuplicatePrevented (proposed; route UNRESOLVED) | PW-STATE-450-90807 | PENDING |

## Reusable component families — 15 exact IDs / 70 variants

All 70 exact variant IDs, property definitions and bounds are retained in [inventory.componentFamilies](design/meri/20261010T004355Z/inventory.json). No variant is dropped. AI Elements source candidate `8d2cd17584f85fd87e010d1592dc13dc7e8aa27a` is **accepted OFFLINE for source/pins/API/plain-text fixture preparation only**, integrated at `d442885` after separate actual Hermes review2 `84d28013` (preserved at `31acba1`) and the owner's independent strict-compile/12-test pass. See [the owner decision](coordination/reports/W02-09-OFFLINE-ACCEPTANCE.md). Component/source APIs are unchanged; the thin diagnostic repair caches the first SSR outcome and permits no automatic second child. Original `636bf87` strict-compile/8-of-10 history, two SSR timeouts and review1's 40-turn closure without a report remain retained. Later passes are not guaranteed cold-cache runs and do not establish the timeout cause or resolve cold-start reliability. Seven notice gaps, unsigned upstream tag and retained skipLibCheck remain explicit limits. Browser/CSS/hydration/theme/plugin behavior, the consuming component mappings and product UI acceptance remain open; this source decision advances no deployment gate. Appearance does not prove backend authorization or behavior.

| Figma ID | Exact family name | Variants linked | Release class | Owner proposed | Component proposal | Future Playwright | Implementation/checks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 441:81425 | Meri/Mode switch | 2 | v1 planned | C (shared UI) | shadcn ButtonGroup / owned mode handoff (proposed; route UNRESOLVED) | PW-COMPONENT-441-81425 | PENDING |
| 441:81475 | Meri/Status | 4 | v1 planned | C (shared UI) | shadcn Badge / supported status adapter (proposed; route UNRESOLVED) | PW-COMPONENT-441-81475 | PENDING |
| 441:81484 | Meri/Field | 4 | v1 planned | C (shared UI) | shadcn Input + Label / validation (proposed; route UNRESOLVED) | PW-COMPONENT-441-81484 | PENDING |
| 456:90479 | Meri/Action interaction | 15 | v1 planned | C (shared UI) | shadcn Button / interaction states (proposed; route UNRESOLVED) | PW-COMPONENT-456-90479 | PENDING |
| 456:90586 | Meri/AI Elements/PromptInput | 8 | v1 planned | C (shared UI) | AI Elements PromptInput; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-90586 | PENDING |
| 456:90811 | Meri/AI Elements/Tool | 6 | v1 planned | C (shared UI) | AI Elements Tool; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-90811 | PENDING |
| 456:90897 | Meri/AI Elements/Artifact | 4 | v1 planned | C (shared UI) | AI Elements Artifact; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-90897 | PENDING |
| 456:90974 | Meri/AI Elements/Attachment | 4 | v1 planned | C (shared UI) | AI Elements Attachments; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-90974 | PENDING |
| 456:91042 | Meri/AI Elements/Confirmation | 5 | v1 planned | C (shared UI) | AI Elements Confirmation; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-91042 | PENDING |
| 456:91137 | Meri/AI Elements/Plan | 3 | v1 planned | C (shared UI) | AI Elements Plan; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-91137 | PENDING |
| 456:91195 | Meri/AI Elements/Sources | 3 | v1 planned | C (shared UI) | AI Elements Sources; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-91195 | PENDING |
| 456:91216 | Meri/AI Elements/Queue | 3 | v1 planned | C (shared UI) | AI Elements Queue; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-91216 | PENDING |
| 456:91253 | Meri/AI Elements/Checkpoint | 3 | v1 planned | C (shared UI) | AI Elements Checkpoint; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-91253 | PENDING |
| 456:91287 | Meri/AI Elements/Context | 3 | v1 planned | C (shared UI) | AI Elements Context; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-91287 | PENDING |
| 456:91308 | Meri/AI Elements/FileTree | 3 | v1 planned | C (shared UI) | AI Elements FileTree; API/adoption acceptance pending (proposed; route UNRESOLVED) | PW-COMPONENT-456-91308 | PENDING |

## Named walkthrough entry points — 11

Translate each into fixture-backed interaction paths, including adverse states, exact-version actions and current authorization. Figma starts are review paths, not passing E2E scenarios.

| Start node ID | Exact name | Release class | Owner proposed | Future Playwright | Status |
| --- | --- | --- | --- | --- | --- |
| 442:81437 | Meri · 01 — Conversation and evidence | v1 planned review path | C+D | PW-WALKTHROUGH-01 | PENDING |
| 443:82027 | Meri · 02 — Research and specialists | v1 planned review path | C+D | PW-WALKTHROUGH-02 | PENDING |
| 443:85000 | Meri · 03 — Artifact workspace | v1 planned review path | C+D | PW-WALKTHROUGH-03 | PENDING |
| 445:84258 | Meri · 04 — Upload and filing | v1 planned review path | C+D | PW-WALKTHROUGH-04 | PENDING |
| 446:85688 | Meri · 05 — Governed memory | v1 planned review path | C+D | PW-WALKTHROUGH-05 | PENDING |
| 447:85660 | Meri · 06 — Approvals | v1 planned review path | C+D | PW-WALKTHROUGH-06 | PENDING |
| 447:87985 | Meri · 07 — Browser work | v1 planned review path | C+D | PW-WALKTHROUGH-07 | PENDING |
| 447:88833 | Meri · 08 — Schedules | v1 planned review path | C+D | PW-WALKTHROUGH-08 | PENDING |
| 449:88256 | Meri · 09 — Phone review | v1 planned review path | C+D | PW-WALKTHROUGH-09 | PENDING |
| 448:89992 | Meri · 10 — Dark workspace | v1 planned review path | C+D | PW-WALKTHROUGH-10 | PENDING |
| 450:88532 | Meri · 11 — Recovery states | v1 planned review path | C+D | PW-WALKTHROUGH-11 | PENDING |

The remaining direct root is review map `439:81407` (Meri · Review map), classified **supporting board**, owner proposed C+D, component proposed ReviewMapFixture, route UNRESOLVED. No application behavior is claimed. Together 85 main roots + 29 overlays + 1 review map account for all 115 direct owned roots.

## Controls, open work and acceptance

[UI-SPEC's Home table](UI-SPEC.md#initial-home-control-contract) maps all 30 captured Home reaction nodes (27 ancestor-visible / 3 hidden legacy) plus 4 ancestor-visible no-reaction candidates: New conversation `442:81485`, Meri `I473:92315;469:41451`, Conversations `442:81501` and PromptInput `442:81601`. These 31 ancestor-visible captured control candidates are not a proven semantic distinct-control count or a complete full-product control audit. Decorative descendants reuse their owning control. Every Home behavior and Playwright scenario remains PENDING. Repeated shell controls use one shared contract. Portfolio/Modules disabled placeholders preserve D008 and do not authorize outside-section traversal or guessed routes. All other agreed standalone capabilities remain required before v1 acceptance.

| Open work | Gate/package | Owner proposed | Evidence required / status |
| --- | --- | --- | --- |
| Finish all distinct control IDs, full reaction mapping, overlays and exact node-to-fixture mappings | G0/W00–W01 | Codex+C; D checks | OPEN; full inventory exists, full control map does not |
| Independent authentication entry, identity bridge and versioned shared-shell handoff/destinations; resolve out-of-section Home header pointers | G0/W04/W06 | Codex+B+new frontend owner | OPEN; no destination or permission invented |
| Accept component source/pins/notices/meaningful compatibility tests and final review | G1/W02/W06 | Codex+Hermes+D | Source preparation accepted OFFLINE8d2cd17/d442885 after actual review2 and parent12; consuming component/browser/CSS, cold performance and full release notices/security OPEN |
| Implement every v1 planned screen/overlay/state/family using adopted components and real authorized services; preserve selected tenant/client/conversation/run/artifact/version | W06–W08/G4–G5 | C+A+B | PENDING; proposed component names are not implementation |
| Keyboard/accessibility, theme/token/font verification, long content, responsive views and reference comparisons | W06/W09/G6 | C; D independently verifies | PENDING; desktop/tablet/phone references plus the later 1440×1040 dark PNG exist; application comparisons remain unqualified |
| All 11 walkthroughs, 100% distinct accepted controls, disabled execution checks, reconnection/background/stop/steer/resume/fork, stale approvals, upload failures, revisions/exact downloads/filing, schedule lifecycle and revocation | W09/G6 | D; C+A+B fix | PENDING on exact immutable staging candidate |

Capture/classification is not a functional pass. No unilateral capability deferral is recorded. Versioned owner decisions must resolve discrepancies between design, adopted APIs and executable contracts; record any approved existing-scope deferral explicitly rather than silently dropping a row. These docs advance no deployment gate and authorize no cutover.
