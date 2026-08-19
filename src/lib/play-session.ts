import { SESSION_KEYS } from "@/lib/types";

/** Shared kiosk: next student gets white cards and a new scratch identity. */
export function resetPlayStation(opts?: { keepName?: boolean }) {
  try {
    sessionStorage.removeItem(SESSION_KEYS.scratches);
    sessionStorage.removeItem(SESSION_KEYS.reportedScratches);
    sessionStorage.removeItem(SESSION_KEYS.submitted);
    sessionStorage.removeItem(SESSION_KEYS.gender);
    if (!opts?.keepName) sessionStorage.removeItem(SESSION_KEYS.name);
    sessionStorage.setItem(SESSION_KEYS.clientId, crypto.randomUUID());
  } catch {
    /* ignore */
  }
}
