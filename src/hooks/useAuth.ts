// src/hooks/useAuth.ts
// Thin re-export — all logic lives in AuthContext (singleton provider).
// Every screen that calls useAuth() now reads from the SAME shared state,
// so a role change via Realtime updates ALL screens simultaneously.

export { useAuth, AuthProvider } from '../contexts/AuthContext';
