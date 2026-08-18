import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidStaffToken, staffCookieName } from "@/lib/auth";
import { getMemoryParticipants, isMemoryMode } from "@/lib/memory-store";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Gender } from "@/lib/types";

async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (isValidStaffToken(bearer)) return true;
  const jar = await cookies();
  return isValidStaffToken(jar.get(staffCookieName())?.value);
}

function countByGender(list: { gender: Gender | string }[]) {
  return {
    male: list.filter((p) => p.gender === "Pria" || p.gender === "Male").length,
    female: list.filter((p) => p.gender === "Wanita" || p.gender === "Female")
      .length,
    other: list.filter((p) => p.gender === "Lainnya" || p.gender === "Other")
      .length,
  };
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isMemoryMode()) {
    const list = getMemoryParticipants();
    return NextResponse.json({
      total: list.length,
      ...countByGender(list),
      mode: "memory",
    });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("participants").select("gender");

  if (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const list = (data ?? []) as { gender: Gender }[];
  return NextResponse.json({
    total: list.length,
    ...countByGender(list),
  });
}
