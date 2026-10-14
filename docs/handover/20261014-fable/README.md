# Start here: Fable's Meri handoff

Neo has transferred **Meri implementation only** to Fable. Dot/Codex continues Core/backend and unified frontend implementation and independently validates Fable's returned commits. The Meri workstream is stopped safely; no scan remediation was implemented.

1. Read [the complete handoff](HANDOFF.md) for repositories, exact pins, architecture, current status, first authenticated chat, the full remaining R2 plan and acceptance.
2. Use [the 91-file context index](CONTEXT-INDEX.md) and [context hashes](CONTEXT-MANIFEST.json) to locate governing plans, source owners and receipts.
3. Read [scan and investigated-remedy status](SCAN-STATUS.md) and [safe-stop state](SAFE-STOP.json).
4. Read [the public-safe shipping appendix](SHIPPING-APPENDIX.md) and [exact source/repository state](SOURCE-STATE.json).
5. Obtain the shipping owner's **private** appendix through an approved private channel. This public repository intentionally excludes raw AWS receipts, private resource bodies, credentials and customer data.

Repositories:
- https://github.com/neo-capiro/meri-greenfield.git — new Meri runtime and trusted stack.
- https://github.com/neo-capiro/capiro-frontend.git — unified Meri/Portfolio/Modules UI, owned by dot.
- https://github.com/neo-capiro/capiro-backend.git — selected domain/auth/backend successor, owned by dot.
- https://github.com/neo-capiro/capirov2.git — legacy/live reference only; no wholesale import or deletion.

Verified runtime base is **PR86 c6053e24b465be677cc5980533009b4aab03beab**. Existing Meri main 8b123bea is stale relative to that draft stack. This documentation PR changes no runtime source/hash, dependency, migration, recipe or native helper.

Shared preview: https://portfolio-preview.app.capiro.ai/ . Parent reports frontend PR48 live on task revision 7 with proposals GET 200 and current identity/tenant checks passed. **Meri chat is not thereby live.** PR47/49 desktop content remains separate.

G0 historically accepted; G1 open; G2–G7 unaccepted. A first usable authenticated chat is a nearer milestone than complete R2. Fixing the image scan is not the remaining product plan.
