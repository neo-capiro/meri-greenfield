package authorization

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"testing"
	"time"

	"google.golang.org/grpc/credentials"
)

// Build an actual verified client chain. No deployment certificate enters this test.
func meriTestPeer(t *testing.T, name string) *AuthInfo {
	t.Helper()
	pub, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	ca := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "synthetic-ca"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign}
	der, err := x509.CreateCertificate(rand.Reader, ca, ca, pub, key)
	if err != nil {
		t.Fatal(err)
	}
	ca, err = x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	leaf := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: name}, NotBefore: ca.NotBefore, NotAfter: ca.NotAfter, BasicConstraintsValid: true, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}, KeyUsage: x509.KeyUsageDigitalSignature}
	der, err = x509.CreateCertificate(rand.Reader, leaf, ca, pub, key)
	if err != nil {
		t.Fatal(err)
	}
	leaf, err = x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(ca)
	chains, err := leaf.Verify(x509.VerifyOptions{Roots: roots, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}})
	if err != nil {
		t.Fatal(err)
	}
	return &AuthInfo{TLSSubject: &leaf.Subject, TLSConnection: &credentials.TLSInfo{State: tls.ConnectionState{HandshakeComplete: true, PeerCertificates: []*x509.Certificate{leaf}, VerifiedChains: chains}}}
}

func TestMeriCertificateRoles(t *testing.T) {
	for _, name := range []string{"meri-temporal-control", "meri-temporal-worker", "meri-temporal-schedule"} {
		t.Run(name, func(t *testing.T) {
			claims, err := newMeriCertificateClaimMapper().GetClaims(meriTestPeer(t, name))
			if err != nil || claims.System != RoleUndefined || claims.Subject != name || claims.AuthType != "mtls" || len(claims.Namespaces) != 1 || claims.Namespaces["meri"] != RoleWriter {
				t.Fatalf("invalid namespace claims: %v", err)
			}
			for _, target := range []struct {
				api, namespace string
				allowed        bool
			}{
				{"StartWorkflowExecution", "meri", true}, {"PollWorkflowTaskQueue", "meri", true}, {"RespondWorkflowTaskCompleted", "meri", true},
				{"PollActivityTaskQueue", "meri", true}, {"RespondActivityTaskCompleted", "meri", true}, {"DescribeWorkflowExecution", "meri", true},
				{"StartWorkflowExecution", "other", false}, {"PollWorkflowTaskQueue", "other", false}, {"UpdateNamespace", "meri", false}, {"RegisterNamespace", "other", false},
			} {
				result, err := NewDefaultAuthorizer().Authorize(context.Background(), claims, &CallTarget{Namespace: target.namespace, APIName: "/temporal.api.workflowservice.v1.WorkflowService/" + target.api})
				if err != nil || (result.Decision == DecisionAllow) != target.allowed {
					t.Errorf("%s %s allowed=%v: %v", target.api, target.namespace, result.Decision, err)
				}
			}
		})
	}
}

func TestMeriCertificateRefusals(t *testing.T) {
	for name, mutate := range map[string]func(*AuthInfo){
		"unverified":                 func(i *AuthInfo) { i.TLSConnection.State.VerifiedChains = nil },
		"no-peer":                    func(i *AuthInfo) { i.TLSConnection.State.PeerCertificates = nil },
		"incomplete-handshake":       func(i *AuthInfo) { i.TLSConnection.State.HandshakeComplete = false },
		"expired-on-open-connection": func(i *AuthInfo) { i.TLSConnection.State.VerifiedChains[0][0].NotAfter = time.Now().Add(-time.Second) },
		"not-yet-valid":              func(i *AuthInfo) { i.TLSConnection.State.VerifiedChains[0][0].NotBefore = time.Now().Add(time.Hour) },
		"ca":                         func(i *AuthInfo) { i.TLSConnection.State.VerifiedChains[0][0].IsCA = true },
		"token":                      func(i *AuthInfo) { i.AuthToken = "Bearer synthetic-old-token" },
		"no-tls":                     func(i *AuthInfo) { i.TLSConnection = nil },
		"subject-only":               func(i *AuthInfo) { i.TLSConnection.State.VerifiedChains[0][0].Subject.CommonName = "unknown-client" },
		"substituted-peer": func(i *AuthInfo) {
			i.TLSConnection.State.PeerCertificates = meriTestPeer(t, "other").TLSConnection.State.PeerCertificates
		},
	} {
		t.Run(name, func(t *testing.T) {
			i := meriTestPeer(t, "meri-temporal-worker")
			mutate(i)
			if claims, err := newMeriCertificateClaimMapper().GetClaims(i); err == nil || claims != nil {
				t.Fatal("unauthorized peer accepted")
			}
		})
	}
	if claims, err := newMeriCertificateClaimMapper().GetClaims(nil); err == nil || claims != nil {
		t.Fatal("missing peer accepted")
	}
}
