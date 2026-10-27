import { NextResponse } from "next/server";
import {
  getStaffToken,
  isStaffTokenConfigured,
  isValidStaffToken,
  staffCookieName,
  staffSessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token =
    typeof body?.token === "string" ? body.token.trim() : "";

  if (!isStaffTokenConfigured()) {
    return NextResponse.json(
      { error: "STAFF_TOKEN is not configured on the server" },
      { status: 503 },
    );
  }

  if (!isValidStaffToken(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(
    staffCookieName(),
    getStaffToken(),
    staffSessionCookieOptions(),
  );
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(staffCookieName(), "", {
    ...staffSessionCookieOptions(0),
    maxAge: 0,
  });
  return res;
}
