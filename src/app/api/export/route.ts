import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidStaffToken, staffCookieName } from "@/lib/auth";
import { getMemoryParticipants, isMemoryMode } from "@/lib/memory-store";
import { getSupabaseAdmin } from "@/lib/supabase";

async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (isValidStaffToken(bearer)) return true;
  const jar = await cookies();
  return isValidStaffToken(jar.get(staffCookieName())?.value);
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  type Row = { id: string; name: string; gender: string; submitted_at: string };
  let rows: Row[] = [];

  if (isMemoryMode()) {
    rows = getMemoryParticipants().map((p) => ({
      id: p.id,
      name: p.name,
      gender: p.gender,
      submitted_at: p.submitted_at,
    }));
  } else {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("participants")
      .select("id, name, gender, submitted_at")
      .order("submitted_at", { ascending: true });
    if (error) {
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
    rows = data ?? [];
  }

  const header = "id,name,gender,submitted_at";
  const lines = rows.map((r) => {
    const safeName = `"${r.name.replace(/"/g, '""')}"`;
    return `${r.id},${safeName},${r.gender},${r.submitted_at}`;
  });
  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gsa-participants.csv"`,
    },
  });
}
