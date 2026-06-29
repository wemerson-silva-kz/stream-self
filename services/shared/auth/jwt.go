// Package auth valida o JWT de viewer emitido pelo Laravel.
// O Go nunca emite esse token — apenas confia na assinatura HS256 compartilhada.
package auth

import (
	"errors"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

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

// Verifier valida tokens com um segredo HS256.
type Verifier struct {
	secret []byte
}

func NewVerifier(secret string) *Verifier {
	return &Verifier{secret: []byte(secret)}
}

// Parse valida assinatura + expiração e devolve as claims.
func (v *Verifier) Parse(token string) (*ViewerClaims, error) {
	claims := &ViewerClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("alg inesperado")
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
