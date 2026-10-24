package authorization

import (
	"bytes"
	"fmt"
	"time"
)

// meriCertificateClaimMapper uses TLS's verified peer identity. The upstream
// default Authorizer still owns API and namespace permissions; no token is minted.
type meriCertificateClaimMapper struct{}

func newMeriCertificateClaimMapper() ClaimMapper { return &meriCertificateClaimMapper{} }

func (*meriCertificateClaimMapper) GetClaims(info *AuthInfo) (*Claims, error) {
	refused := fmt.Errorf("Temporal client certificate refused")
	if info == nil || info.AuthToken != "" || info.TLSConnection == nil {
		return nil, refused
	}
	state := info.TLSConnection.State
	if !state.HandshakeComplete || len(state.PeerCertificates) == 0 || len(state.VerifiedChains) == 0 || len(state.VerifiedChains[0]) < 2 {
		return nil, refused
	}
	leaf := state.VerifiedChains[0][0]
	if leaf == nil || leaf.IsCA || !bytes.Equal(leaf.Raw, state.PeerCertificates[0].Raw) {
		return nil, refused
	}
	// gRPC connections can outlive a certificate: check its lifetime on every RPC.
	now := time.Now()
	if now.Before(leaf.NotBefore) || !now.Before(leaf.NotAfter) {
		return nil, refused
	}
	switch leaf.Subject.CommonName {
	case "meri-temporal-control", "meri-temporal-worker", "meri-temporal-schedule":
		return &Claims{Subject: leaf.Subject.CommonName, AuthType: "mtls", Namespaces: map[string]Role{"meri": RoleWriter}}, nil
	default:
		return nil, refused
	}
}
