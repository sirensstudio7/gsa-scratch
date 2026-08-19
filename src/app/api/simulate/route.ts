import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateWallPosition, isValidStaffToken, staffCookieName } from "@/lib/auth";
import {
  addMemoryParticipant,
  getMemoryParticipants,
  isMemoryMode,
} from "@/lib/memory-store";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Gender, Participant } from "@/lib/types";

const FIRST = [
  "Ayu",
  "Bima",
  "Citra",
  "Dimas",
  "Eka",
  "Farah",
  "Galih",
  "Hana",
  "Irwan",
  "Jihan",
  "Kirana",
  "Luthfi",
  "Maya",
  "Naufal",
  "Olivia",
  "Putra",
  "Qori",
  "Raka",
  "Salsa",
  "Tegar",
];
const LAST = [
  "Pratama",
  "Wijaya",
  "Saputra",
  "Lestari",
  "Nugroho",
  "Santoso",
  "Wulandari",
  "Hidayat",
  "Sari",
  "Putri",
];
const GENDERS: Gender[] = ["Pria", "Wanita", "Lainnya"];

async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (isValidStaffToken(bearer)) return true;
  const jar = await cookies();
  return isValidStaffToken(jar.get(staffCookieName())?.value);
}

function fakeStudent(index: number) {
  const first = FIRST[index % FIRST.length]!;
  const last = LAST[Math.floor(index / FIRST.length) % LAST.length]!;
  const name = `${first} ${last} ${String(index + 1).padStart(2, "0")}`;
  const gender = GENDERS[index % 3]!;
  const { pos_x, pos_y } = generateWallPosition(index * 13 + Date.now() / 1000);
  return { name, gender, pos_x, pos_y };
}

/** Staff-only: inject fake submits so /wall can be load-tested. */
export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const raw = Number(body?.count ?? 1);
  const count = Math.max(
    1,
    Math.min(20, Math.floor(Number.isFinite(raw) ? raw : 1)),
  );
  const start = Math.max(0, Math.floor(Number(body?.offset) || 0));
  const rows = Array.from({ length: count }, (_, i) => fakeStudent(start + i));

  if (isMemoryMode()) {
    const added: Participant[] = rows.map((row) => ({
      id: crypto.randomUUID(),
      ...row,
      submitted_at: new Date().toISOString(),
    }));
    for (const p of added) addMemoryParticipant(p);
    return NextResponse.json({
      success: true,
      added: added.length,
      total: getMemoryParticipants().length,
      mode: "memory",
    });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("participants")
    .insert(rows)
    .select("id");

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Simulate insert failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    added: data?.length ?? count,
    mode: "supabase",
  });
}
