# Linux PostgreSQL 17.11 artifact discovery

Status: CLOSED — exact official Linux/amd64 candidate identified from retained
public metadata. Acquisition and runtime admission remain with the owner. No OCI
layer, installation, native executable, Docker, database, AWS, provider or Capiro
action occurred. G1 remains open.

The outline recorded before work was to retain the official index, selected
manifest/config, bind their packaging source/license, inspect TLS requirements,
then propose a disposable synthetic boundary. Only this report and ignored data
were owned. Worktree base: `ac5ff8dfcce177aa978e7b38fb4ecf444dda7ff2`; branch:
`task/g1-proxy-linux-postgres-artifact-discovery`.

## Exact candidate

Public captures span **2026-10-11 02:59:18.548324–03:00:16.704446 UTC**
(2026-10-10 evening in America/New_York). These separate HTTP observations are
not an atomic capture or independent signature/build attestation. Mutable tag is
navigation only; a later admitted amd64 pull must use the platform digest.

| Record | Exact value | Bytes |
|---|---|---:|
| Tag | `docker.io/library/postgres:17.11-trixie` | — |
| OCI index | `sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3` | 10,237 |
| Linux/amd64 manifest | `sha256:3cec7eb015ba8adb28139fa5c83b8489cdf0e666e53dfdf20f598ae0cc8739e3` | 3,628 |
| Config | `sha256:327daa8fae7178d61f93142f146b098467b345e10997b9eb79f63bd58e5c8f3c` | 10,143 |
| Base annotation | `debian:trixie-slim@sha256:918311b7b6c4c6f68b232ba516584925f6c78ad82b6fd534b98979df6438e483` | not fetched |
| Official-images library commit | `e45c28e390e9952b44c6bee310c6bf5ecf8feca9` | library 4,959 |
| Packaging commit/directory | `2603e26e245e558218728ee14e0a42dcb020dc7f:17/trixie` | — |
| PostgreSQL package version | `17.11-1.pgdg13+2` | metadata/source |

Index/manifest/config media types are respectively
`application/vnd.oci.image.index.v1+json`,
`application/vnd.oci.image.manifest.v1+json` and
`application/vnd.oci.image.config.v1+json`. Exactly one descriptor has platform
`{architecture:amd64, os:linux}`; manifest/config sizes and SHA256 match their
descriptors. Config created: `2026-10-06T01:33:02.828687149Z`; platform creation
annotation: `2026-10-06T01:32:29Z`.

The [pinned official library stanza](https://github.com/docker-library/official-images/blob/e45c28e390e9952b44c6bee310c6bf5ecf8feca9/library/postgres)
lists `17.11, 17, 17.11-trixie, 17-trixie` and the same packaging commit as the
platform annotation. The
[pinned Dockerfile](https://github.com/docker-library/postgres/blob/2603e26e245e558218728ee14e0a42dcb020dc7f/17/trixie/Dockerfile)
uses trixie-slim and, on amd64, PGDG's signed apt repository
`http://apt.postgresql.org/pub/repos/apt trixie-pgdg main 17`, key fingerprint
`B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8`. It installs
`postgresql-17=17.11-1.pgdg13+2`; postgresql-common/other OS dependencies are not
version-pinned in the recipe. The alternate local source-build branch does not
apply to amd64. This is the official trixie image, not a rebuilt project Debian
snapshot. Recipe signatures were not independently verified; no package binary
or dpkg inventory was read.

All 14 ordered layer descriptors have media type
`application/vnd.oci.image.layer.v1.tar+gzip`, totalling **161,335,873 compressed
bytes**. The full exact digest/size list and 14 declared uncompressed diff IDs
are retained in both `discovery.json` and `data-reconciliation.json` (selection
object). No layer was fetched or expanded. Compact ordered descriptor inventory:

| Layer | SHA256 | Bytes |
|---:|---|---:|
| 1 | `ecc510c1e359bdc007b39802570bb7e4dec7d6ebccf357c3201a74299113e05e` | 29843350 |
| 2 | `fcdd3a48135944f09d0d9f83d68d3356222480b32ef7acf7a2789ffb4b509c79` | 1169 |
| 3 | `b86134c2eeb652f8580951a9ff263dcd4631c14f81cb59947f388d6e5bb361de` | 6442904 |
| 4 | `57644501a07fabeb73163875049d59967093363293b1f3464d7933fdd2fa8523` | 1256707 |
| 5 | `affbe3357b390687f917fd756602160257e2b8b25c76046fcfcfe13c29b5480b` | 8203797 |
| 6 | `3be737420556ae9d92e2aa46d59b692358fbaa9357079fc45f6a401607ed4f2f` | 1311688 |
| 7 | `e30751283c57bcc108c3b276bb491a281f17d59c6ac3716760f17d0811c6c47b` | 116 |
| 8 | `c5602f014e9e17fbdce40a548c7e33662e6c1fb12d6fabe89c94f5907d02495e` | 3143 |
| 9 | `c9432d362cca11561d47d905a22448c01ed96b3f5a91bb4c42e00fe12d275f7d` | 114255956 |
| 10 | `dc30f2779c660e9fd93aa4d065bd4fa70a406be2d2c30ac71cf19de320734dbd` | 10453 |
| 11 | `d43ee31e40df0061615da84f4493daa5a4b07b04c4dc51e615e5c60957236803` | 128 |
| 12 | `8aebe6431dc8bf2a382a406bf6121b32866f22f0a4d3c54a7efe80926796cc43` | 168 |
| 13 | `52fc2be321a4aff5c6dfdedaef66d2a6f4bd47629161fef538fccc6f5c0b5bbf` | 6108 |
| 14 | `99ce35cabaf9528ec0b489a86b09f1809bd398fd0756a5bdeb1288f1add11730` | 186 |

## Runtime/TLS facts and limits

Raw config has **no User key**, so this is not nonroot-by-default. Entrypoint is
`["docker-entrypoint.sh"]`, command `["postgres"]`, exposed port `5432/tcp`,
stop signal `SIGINT`, declared volume `/var/lib/postgresql/data`. Source creates
postgres UID/GID **999:999**. The
[pinned entrypoint](https://github.com/docker-library/postgres/blob/2603e26e245e558218728ee14e0a42dcb020dc7f/17/trixie/docker-entrypoint.sh)
reexecutes through gosu when started as root. Future fixture should explicitly
select 999:999 and prepare owned writable data/runtime directories. Permissions
and read-only-root compatibility remain unmeasured. Explicitly bind the data
mount; do not leave an unaccounted anonymous volume.

Packaging sets listen_addresses to all interfaces. Entrypoint appends generic
password host authentication, initializes from environment/file parameters, and
executes/sources matching init-directory files when supplied. Its temporary init
server uses Unix sockets with TCP disabled. No TLS certificate, key, ssl=on or
TLS-only HBA policy is supplied here. Future args/init inputs must be fixed trusted
data, including the eval-using POSTGRES_INITDB_ARGS boundary.

[PostgreSQL 17 TLS documentation](https://www.postgresql.org/docs/17/ssl-tcp.html)
requires an SSL-capable build and server certificate/key. Enabling SSL alone still
accepts plain TCP. A server-owned key normally requires 0600; the documented
root/group alternative differs. Metadata does not prove this PGDG binary's OpenSSL
linkage or a successful TLS handshake. Those remain native checks.

The future fixed [HBA policy](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html)
must reject non-TLS host connections, allow only synthetic database/role and
fixture client via hostssl with SCRAM, and reject remaining IPv4/IPv6 access.
Private fixed CA/certificate SAN must bind the literal fixture DNS name. Clients
use [`sslmode=verify-full`](https://www.postgresql.org/docs/17/libpq-ssl.html) with
that CA/hostname. No certificate or secret was created or read.

## License/source evidence

Retained packaging LICENSE is MIT, copyright
`2014, Docker PostgreSQL Authors (See AUTHORS)`, **1084 bytes**, SHA256
`87ffd2c45e3f90cfa3407b5c40ef8333e87c3e875e4895f8b64df758198deafc`.
[PostgreSQL project license](https://www.postgresql.org/about/licence/) official
HTML is retained: 8073 bytes, SHA256
`ecc2a8f75f01bde9763c906fe1b1da7f7c3fb1c3f9a4a13bcb736678be8ed80c`.
These source references do not clear every Debian/PGDG/gosu/OpenSSL/image notice.
Installed licenses, package inventory and current security disposition remain
unmeasured. No existing security finding/hold is waived.

Dockerfile: 9730 bytes, SHA256
`e20926ed861c597360c45b11b5c06a098fd31db26f9e39c18dbc0feeb46036a5`.
Entrypoint: 14577 bytes, SHA256
`9c440299ae04a0a79d55b8bf03307036d890a40979d2fb698073c9050d4b20a5`.
The [official 17.11 release page](https://www.postgresql.org/docs/17/release-17-11.html)
was retained; no different PostgreSQL version was selected.

## Proposed disposable TLS-only boundary

Linux artifact identity is concrete. Owner must next freeze exact platform digest,
proxy Linux runtime, synthetic roles/schema, TLS configuration and disposable run
identity before acquisition/execution. Smallest proposed boundary:

1. At most one DB and one proxy fixture; synthetic data only; no Capiro, public
   host port, worker credential or ambient cloud/provider credential. Permit only
   fixed proxy-to-DB TLS with measured enforcement; network name is not isolation
   proof. Bootstrap and nonowner application roles stay separate; native auth
   requirements determine reviewed grants.
2. Nonroot 999:999, read-only root, capabilities dropped, no-new-privileges, fresh
   bounded writable data/runtime/temp mounts. Freeze CPU/memory/disk and external
   controller-independent deadline before execution. Proposed maximum: 900s work
   plus 180s cleanup; not admitted, and no existing native D720/C900 identity changes.
3. Fixed empty/pinned init directory, exact command/env allowlist, private ephemeral
   password/key files with no secret logging. Socket-only bootstrap precedes the
   restricted TLS listener. No startup package fetching/engine generation. Freeze
   CA/SAN/expiry/key permissions.
4. Measure server 17.11, UID, SSL support and negotiated TLS; verify CA/hostname and
   reject plain TCP, wrong CA/hostname and foreign role before application evidence.
   Those controls need no model call.
5. Project migration allocation stays only
   `apps/proxy/qualification/state/migrations/0001_qualification_state.sql`.
   PostgresQualificationStore enforces qualification DB names and verify-full+CA
   except historical literal 127.0.0.1. Linux must use verified DNS/TLS rather than
   that exception. Native LiteLLM Prisma/schema/bootstrap still needs an exact
   separately reviewed disposable input. No extra migration/substitute auth is
   allocated here.
6. One-time ownership, finite capture bounds and cleanup evidence for processes,
   containers and all mounts. Stop ACK is not physical absence. Unknown cleanup
   blocks another fixture. Exact supervisor/fallback/authority still need review;
   no new lifecycle framework is proposed.

Old state/dependencies.json explicitly binds Windows PostgreSQL 17.11-3 and
Windows psycopg-binary, not this Linux lock. Linux client selection, actual TLS,
generated Prisma/native auth, grants, image security/notices and cleanup remain
prerequisites. Deployment scope and SessionStore remain unchanged.

## Evidence and failures

Absolute evidence directory:
`C:/dev/main/meri-greenfield-worktrees/g1-proxy-linux-postgres-artifact-discovery/.task-inputs/linux-postgres-artifact-discovery-1`.
discovery.json: 25838 bytes, SHA256
`8149922532f088583904f1c07a3cbe856f73e5076036793a5faf100ff197816e`.
One local stdlib DATA reconciliation exited0: 15 HTTP receipts, descriptor/config
hashes/sizes, ordered layers/diff IDs, source agreement and six repo inputs against
base raw Git. data-reconciliation.json: 10279 bytes, SHA256
`ea66d9a0806bdb7c221c3a6f047a7061bdef65bec5418c57186927b7a753ea62`.
These are metadata assertions, not runtime tests.

First capture refused HTTP307 config redirect and exited1; zero-byte body, receipt
and original script remain. New bounded follow-up fetched only the small config
from Docker's returned CDN URL without forwarding registry Authorization, then
pinned official sources/docs. No tag/index replay. Anonymous token body was never
retained. Original ignored redirect receipt retains public signed delivery URL;
it is not copied here. Fetches had 25s/2MiB and scripts 240s cooperative bounds.
Two editorial patch attempts failed before final report text replacement; no
source/runtime operation followed. FINAL-MANIFEST.json seals finite retained data;
postcommit readback is supplementary. No OS sandbox, isolation, attestation,
package bytes or complete future runtime closure follows from these hashes/bounds.
