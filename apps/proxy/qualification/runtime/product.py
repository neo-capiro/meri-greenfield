"""Import-inert product proxy owners over the canonical product ledger.

The trusted server supplies an independently observed peer and the exact issued
model capability digest. This factory neither issues credentials nor activates
grants, migrates a database, opens a socket or makes a provider call.
"""
from dataclasses import dataclass
from .ingress import IngressAdmission, PeerLease
from ..state.admission import GrantAdmission
from ..state.ledger import PostgresLedger
from ..state.namespace import store_namespace
from ..state.pricing import StateDenied


@dataclass(frozen=True)
class ProductRequestOwners:
    ingress: IngressAdmission
    ledger: PostgresLedger


def product_request_owners(*, store, peer, capability_sha256, raw_request_sha256, pricing):
    if store_namespace(store) != 'product' or type(peer) is not PeerLease:
        raise StateDenied('PRODUCT_PROXY_BINDING_REQUIRED')
    authority = GrantAdmission(store, peer.grant_id, peer.binding, capability_sha256)
    return ProductRequestOwners(
        IngressAdmission(authority, peer),
        PostgresLedger(store, grant_id=peer.grant_id, binding=peer.binding,
                       capability_sha256=capability_sha256, raw_request_sha256=raw_request_sha256,
                       pricing=pricing, expected_count_origin='aws-counttokens'))
