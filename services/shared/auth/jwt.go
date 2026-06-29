// Package auth valida o JWT de viewer emitido pelo Laravel.
// O Go nunca emite esse token — apenas confia na assinatura HS256 compartilhada.
package auth

import (
	"crypto/rsa"
	"errors"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// VerifierFromEnv monta o Verifier a partir do ambiente:
//   - STREAM_JWT_ALG (default HS256)
//   - HS256: STREAM_JWT_SECRET (segredo compartilhado)
//   - RS256: STREAM_JWT_PUBLIC_KEY (caminho de arquivo PEM ou o próprio PEM inline)
func VerifierFromEnv() (*Verifier, error) {
	alg := os.Getenv("STREAM_JWT_ALG")
	if alg == "" {
		alg = "HS256"
	}
	if strings.HasPrefix(alg, "RS") {
		pem := os.Getenv("STREAM_JWT_PUBLIC_KEY")
		if data, err := os.ReadFile(pem); err == nil {
			pem = string(data) // era um caminho de arquivo
		}
		return NewVerifierFromConfig(alg, pem)
	}
	return NewVerifier(os.Getenv("STREAM_JWT_SECRET")), nil
}

// ViewerClaims espelha o payload emitido por ViewerTokenService (Laravel).
type ViewerClaims struct {
	Sub   string `json:"sub"`   // "user:123" | "anon:<uuid>"
	Live  string `json:"live"`  // "live:678"
	Tier  string `json:"tier"`  // "free" | "paid"
	Fsec  int    `json:"fsec"`  // freemium_seconds resolvido
	Scope string `json:"scope"` // "watch chat"
	Name  string `json:"name"`
	jwt.RegisteredClaims
}

// HasScope verifica se o token concede um escopo (ex.: "chat", "watch").
func (c *ViewerClaims) HasScope(s string) bool {
	for _, p := range strings.Fields(c.Scope) {
		if p == s {
			return true
		}
	}
	return false
}

// Verifier valida tokens HS256 (segredo compartilhado) ou RS256 (chave pública).
// Em RS256 o Go nunca consegue emitir tokens — só validar.
type Verifier struct {
	alg    string
	secret []byte
	pub    *rsa.PublicKey
}

// NewVerifier mantém a compatibilidade HS256 (segredo).
func NewVerifier(secret string) *Verifier {
	return &Verifier{alg: "HS256", secret: []byte(secret)}
}

// NewVerifierFromConfig escolhe o algoritmo. Para RS256, key é o PEM da chave
// pública; para HS256, é o segredo compartilhado.
func NewVerifierFromConfig(alg, key string) (*Verifier, error) {
	if strings.HasPrefix(alg, "RS") {
		pub, err := jwt.ParseRSAPublicKeyFromPEM([]byte(key))
		if err != nil {
			return nil, err
		}
		return &Verifier{alg: alg, pub: pub}, nil
	}
	return &Verifier{alg: "HS256", secret: []byte(key)}, nil
}

// Parse valida assinatura + expiração e devolve as claims.
func (v *Verifier) Parse(token string) (*ViewerClaims, error) {
	claims := &ViewerClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if strings.HasPrefix(v.alg, "RS") {
			if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, errors.New("alg inesperado (esperado RSA)")
			}
			return v.pub, nil
		}
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("alg inesperado (esperado HMAC)")
		}
		return v.secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !parsed.Valid {
		return nil, errors.New("token inválido")
	}
	return claims, nil
}
