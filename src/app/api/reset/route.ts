import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidStaffToken, staffCookieName } from "@/lib/auth";
import { clearMemoryParticipants, isMemoryMode } from "@/lib/memory-store";
import { clearMemoryScratchProgress } from "@/lib/scratch-progress";
import { getSupabaseAdmin } from "@/lib/supabase";

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
    return NextResponse.json({ success: true, mode: "memory" });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("participants")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }

  await supabase.from("scratch_claims").delete().neq("client_id", "");
  await supabase.from("scratch_counts").update({ count: 0 }).neq("asset", "");
  clearMemoryScratchProgress();

  return NextResponse.json({ success: true });
}
