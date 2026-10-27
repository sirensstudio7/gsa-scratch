import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

/** Block API traffic in production when Supabase is missing (no silent in-memory mode). */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (isSupabaseConfigured()) {
    return NextResponse.next();
  }
  return NextResponse.json(
    {
      error:
        "Server misconfigured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) in production.",
    },
    { status: 503 },
  );
}

export const config = {
  matcher: "/api/:path*",
};
