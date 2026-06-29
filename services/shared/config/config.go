package config

import (
	"os"
	"strconv"
)

// Env lê uma variável de ambiente com fallback.
func Env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// EnvInt lê uma variável de ambiente inteira com fallback.
func EnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
