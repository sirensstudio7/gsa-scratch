import { cookies } from "next/headers";

const STAFF_COOKIE = "gsa_staff";

export function getStaffToken() {
  return process.env.STAFF_TOKEN || "gsa-staff-2026";
}

export function isValidStaffToken(token: string | null | undefined) {
  if (!token) return false;
  return token === getStaffToken();
}

export async function isStaffAuthenticated() {
  const jar = await cookies();
  return isValidStaffToken(jar.get(STAFF_COOKIE)?.value);
}

export function staffCookieName() {
  return STAFF_COOKIE;
}

/** Grid + jitter wall positions in percentage space */
export function generateWallPosition(indexHint = Math.random() * 300) {
  const cols = 10;
  const rows = 8;
  const col = Math.floor(indexHint) % cols;
  const row = Math.floor(indexHint / cols) % rows;
  const jitterX = (Math.random() - 0.5) * 6;
  const jitterY = (Math.random() - 0.5) * 6;

  const pos_x = Math.min(92, Math.max(8, 8 + col * 9 + jitterX));
  const pos_y = Math.min(88, Math.max(12, 12 + row * 9 + jitterY));

  return { pos_x, pos_y };
}

export function sanitizeName(raw: unknown) {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

export function sanitizeGender(raw: unknown) {
  if (raw === "Pria" || raw === "Wanita" || raw === "Lainnya") return raw;
  // backward-compatible aliases
  if (raw === "Male") return "Pria";
  if (raw === "Female") return "Wanita";
  if (raw === "Other") return "Lainnya";
  return null;
}
