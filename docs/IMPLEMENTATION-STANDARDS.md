Implementation standards — ownership, modularity, and verification

Apply these rules throughout implementation. The goal is cohesive modules with clear ownership, stable interfaces, and verifiable behavior. Avoid both oversized files that accumulate unrelated responsibilities and excessive fragmentation that makes a workflow difficult to follow.

Discovery and coordination

1. Read the repository instructions, approved deployment plan, shared contracts, and relevant architecture decisions before editing. Inspect the existing implementation and affected callers. Establish whether the task requires new behavior, integration, or restructuring.

2. Search for existing implementations, SDK capabilities, adopted open-source packages, shared helpers, contracts, registries, fixtures, and configuration before creating new ones. Identify the canonical owner of each responsibility and extend it.

   For standalone Meri, search the new Meri repository first. Current Capiro/Meri code is a behavioral and integration reference; do not import or copy its agent, retrieval, planner, UI, queues, or infrastructure implementation. Access authoritative Capiro data through approved connectors and contracts.

3. Check for overlapping work with active development sessions. Use a dedicated branch/worktree for assigned implementation. Respect claimed paths, coordinate shared-interface changes and integration order, and preserve other authors’ work. Do not reorganize another session’s owned files without coordination.

Design before implementation

4. For a new subsystem or a substantial change, record a short implementation outline in the task handoff before coding:
   - Responsibilities and their canonical owners.
   - Proposed modules and public interfaces.
   - Dependency direction and external boundaries.
   - State, persistence, authorization, and failure ownership.
   - Existing code or packages being reused.
   - Verification required.

   Keep this proportionate to the change. A small fix does not require a new architecture document. Resolve routine design choices autonomously.

5. Organize code by cohesive domain responsibility. Keep related behavior close enough to understand together. Introduce a shared abstraction only when real callers share semantics; preserve meaningful domain differences.

   Avoid generic utils/helpers/services dumping grounds, speculative frameworks, and splitting code into many tiny files solely to satisfy a line count.

Structure and prevention of oversized files

6. Keep entry points, controllers, route handlers, queue consumers, and UI containers thin. They may validate input, establish trusted context, invoke the appropriate service, and translate the result. Put business rules, persistence, provider integration, and rendering logic in their respective cohesive modules.

   Do not combine HTTP handling, tenant authorization, retrieval, model orchestration, database access, artifact generation, and UI/event formatting in one service.

7. Before adding responsibility to an existing module, inspect its current responsibilities and dependencies. If the addition introduces a separate reason for the module to change, create or extract a cohesive module behind the existing public interface.

   Preserve interfaces and behavior during extraction unless the task explicitly requires changing them. Avoid unrelated repository-wide restructuring.

8. Treat these as mandatory design-review triggers:
   - A file handles multiple unrelated domains or lifecycle stages.
   - A class requires unrelated dependencies to perform independent tasks.
   - Business rules are duplicated across handlers or workflows.
   - Growing switch/conditional chains select tools, providers, or workflows.
   - Tests for one behavior require mocking unrelated subsystems.
   - One change repeatedly requires edits across unrelated parts of a file.

   Address the responsibility problem rather than moving the same monolith into several unnamed helpers.

9. Use repository-approved complexity and file-size checks. If none exist, propose and document proportionate review thresholds for new or changed code. Size thresholds are review signals, not proof of good design.

   Where useful, enforce dependency boundaries, cycles, restricted imports, and registry consistency with existing lint/architecture tooling. Scope new enforcement to owned code; do not block the task on unrelated legacy cleanup or invent exceptions merely to pass.

Boundaries and canonical implementations

10. Respect application and package boundaries. Cross-application contracts belong in the approved shared contracts package. Validate untrusted input at external boundaries; keep transport DTOs separate from internal domain behavior where their semantics differ.

    Avoid circular dependencies, imports into another package’s private implementation, and business logic hidden in shared contract packages. Keep public exports deliberate and limited.

11. Reuse canonical logic instead of copying DTOs, validators, configuration, transport code, or fixtures. Extend typed registries/descriptors where they already exist instead of adding parallel switch chains or hardcoded vocabularies.

    Give each catalog and registry one owner. Derive dependent representations from that owner where practical, and verify that schemas, handlers, descriptions, availability, and authorization metadata agree.

12. Preserve approved domain decisions. For defense-budget work, keep separate family/chamber pipelines and share only genuinely common kernels. Verify shared semantics with meaningful contract tests.

    Mirror rules apply only when editing an actual mirrored source tree. If a change touches source mirrored under apps/defense-api/runtime-source, update both sides in the same commit and run mirror verification. Do not introduce that mirror into standalone Meri or replace it with a forbidden apps/api import.

    Regenerate generated artifacts through their generators.

Standalone Meri responsibilities

13. Preserve these ownership boundaries using the approved repository structure:
    - Claude Agent SDK owns the agent execution loop and supported runtime capabilities.
    - The trusted control layer owns run lifecycle and versioned skill-manifest enforcement.
    - The gateway owns authorization, typed tool execution, and source access.
    - Source adapters own source-specific querying, pagination, normalization, and failure handling.
    - Governed memory owns memory proposal/review behavior.
    - Artifact services own generation, verification, immutable versions, previews, and filing.
    - The UI event adapter owns translation into the application’s display contract.
    - UI components own presentation and local interaction.

    Assign one owner per responsibility. Do not build a second orchestration loop, parallel authorization system, generic unrestricted query tool, or universal Meri service that absorbs every subsystem.

14. Adopt supported SDK and established open-source capabilities before writing replacements. Wrap them only where an application boundary requires it. Record versions and licenses.

    Keep wrappers small and specific. Do not recreate provider internals or conceal materially different provider behavior behind a misleading generic interface.

Configuration, security, and resources

15. Use the repository’s validated configuration, feature flags, HTTP clients, tenant-scoped persistence, and dependency-injection patterns. Preserve tenant isolation, credential scoping, deadlines, retries, cancellation, and resource budgets.

    Bind trusted actor/tenant/client context server-side. Model arguments and UI scope hints do not establish authority. Recheck authorization at execution and after resume.

    Inject clocks, randomness, model clients, and persistence dependencies when reproducibility or testing depends on them.

16. Keep reusable modules safe to import. Importing must not start jobs, connect to services, terminate the process, or require ambient CLI configuration.

    Put initialization and configuration checks in the appropriate entry point. Make resource ownership explicit: clean up resources you create, including on initialization failure; never dispose resources borrowed from a caller.

17. For new or changed CLI tools, provide usage/help and documented exit codes. Validate arguments and configuration before resource allocation. Missing configuration must return a bounded, handled failure without database/network attempts or unintended writes.

    Integrate new entry points with the existing smoke-discovery mechanism.

Behavior and verification

18. Identify intentional behavior and contract changes explicitly. Preserve unrelated defaults, error behavior, ordering, numerical precision, and UI behavior. Before restructuring logic, establish meaningful characterization coverage for behavior at risk.

19. Preserve independent assertions and meaningful edge cases. Test observable contracts and domain outcomes; do not copy production algorithms into tests or test only that mocks were called.

    For consolidation, map removed/renamed cases to surviving equivalent coverage. Do not skip, weaken, or rewrite assertions merely to pass checks. Report optional integration/live gates that were not exercised.

20. Run checks appropriate to changed surfaces and repository policy: relevant tests, typechecking, lint, architecture guards, and applicable mirror, CLI, coverage, integration, and visual checks.

    Use targeted checks during development and required broader gates before completion. A mocked adapter, static success message, or process exit is not evidence of working integration.

21. Review intentional UI changes before updating visual baselines. Do not regenerate screenshots or snapshots to hide unexplained failures. Include new packages, routes, and entry points in the appropriate discovery and verification mechanisms.

Completion

22. Keep unrelated baseline failures separate. Diagnose and report them; fix authorized prerequisites in separate commits or PRs. Do not weaken gates or silently omit failing surfaces.

23. Review the final diff for:
    - Unrelated responsibilities accumulated in one module.
    - Duplicate implementations or registries.
    - Dependency-boundary violations and cycles.
    - Accidental behavior changes.
    - Generated-file mistakes.
    - Unnecessary abstractions or fragmentation.
    - Interference with concurrent work.

24. Report:
    - What changed and where each canonical implementation lives.
    - Module boundaries introduced or preserved.
    - Intentional behavior, contract, or dependency changes.
    - Checks actually run and their results.
    - Remaining failures, unverified behavior, and coordination needs.

Proceed autonomously with routine implementation decisions. Ask only when a missing decision materially affects behavior, ownership, compatibility, or scope. Do not declare completion until the requested implementation and required verification are finished.