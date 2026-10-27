import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidStaffToken, staffCookieName } from "@/lib/auth";
import { clearMemoryParticipants, isMemoryMode } from "@/lib/memory-store";
import { clearBubbleClicks } from "@/lib/bubble-clicks";
import { clearBubblePopLog } from "@/lib/bubble-pop-log";
import { clearMemoryScratchProgress } from "@/lib/scratch-progress";
import { getSupabaseAdmin, hasSupabaseServiceRole } from "@/lib/supabase";

async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (isValidStaffToken(bearer)) return true;
  const jar = await cookies();
  return isValidStaffToken(jar.get(staffCookieName())?.value);
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return NextResponse.json(
      { error: "Send { confirm: true } to reset" },
      { status: 400 },
    );
  }

  if (isMemoryMode()) {
    clearMemoryParticipants();
    clearMemoryScratchProgress();
    clearBubbleClicks();
    clearBubblePopLog();
    return NextResponse.json({ success: true, mode: "memory" });
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      {
        error:
          "Server missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel env (Supabase → Project Settings → API → service_role). Reset cannot run with the anon key only.",
      },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { error: participantsErr } = await supabase
    .from("participants")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (participantsErr) {
    console.error("reset participants", participantsErr);
    return NextResponse.json(
      {
        error: "Reset failed clearing participants",
        detail: participantsErr.message,
      },
      { status: 500 },
    );
  }

  const { error: claimsErr } = await supabase
    .from("scratch_claims")
    .delete()
    .neq("client_id", "");
  if (claimsErr) {
    console.error("reset scratch_claims", claimsErr);
    return NextResponse.json(
      { error: "Reset failed clearing scratch claims", detail: claimsErr.message },
      { status: 500 },
    );
  }

  const { error: countsErr } = await supabase
    .from("scratch_counts")
    .update({ count: 0 })
    .neq("asset", "");
  if (countsErr) {
    console.error("reset scratch_counts", countsErr);
    return NextResponse.json(
      { error: "Reset failed clearing scratch counts", detail: countsErr.message },
      { status: 500 },
    );
  }

  const { error: settingsErr } = await supabase
    .from("scratch_settings")
    .update({
      complete: false,
      fill_started_at: null,
      fill_minutes: null,
      bubble_clicks: 0,
    })
    .eq("id", 1);
  if (settingsErr) {
    console.error("reset scratch_settings", settingsErr);
    return NextResponse.json(
      { error: "Reset failed clearing bubble progress", detail: settingsErr.message },
      { status: 500 },
    );
  }

  clearMemoryScratchProgress();
  clearBubbleClicks();
  clearBubblePopLog();

  const { error: popClearErr } = await supabase
    .from("bubble_pops")
    .delete()
    .neq("id", 0);
  if (popClearErr && popClearErr.code !== "42P01") {
    console.error("reset bubble_pops", popClearErr);
    return NextResponse.json(
      { error: "Reset failed clearing bubble pops", detail: popClearErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
