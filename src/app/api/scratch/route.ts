import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  claimMemoryScratch,
  emptyCounts,
  getMemoryScratchProgress,
  isScratchId,
  setForceComplete,
  setRevealTarget,
  toProgressPayload,
  type ScratchCounts,
} from "@/lib/scratch-progress";
import { isMemoryMode } from "@/lib/memory-store";
import { isValidStaffToken, staffCookieName } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ScratchId } from "@/lib/types";

async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (isValidStaffToken(bearer)) return true;
  const jar = await cookies();
  return isValidStaffToken(jar.get(staffCookieName())?.value);
}

async function readSupabaseCounts(): Promise<ScratchCounts> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scratch_counts")
    .select("asset, count");
  if (error) throw error;
  const counts = emptyCounts();
  for (const row of data ?? []) {
    if (isScratchId(row.asset)) counts[row.asset] = Number(row.count) || 0;
  }
  return counts;
}

export async function GET() {
  try {
    if (isMemoryMode()) {
      return NextResponse.json({
        ...getMemoryScratchProgress(),
        mode: "memory",
      });
    }

    try {
      const counts = await readSupabaseCounts();
      return NextResponse.json({
        ...toProgressPayload(counts),
        mode: "supabase",
      });
    } catch (err) {
      console.error("scratch GET supabase fallback", err);
      return NextResponse.json({
        ...getMemoryScratchProgress(),
        mode: "memory-fallback",
      });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** Staff: set expected total, or force the wall to 100%. */
export async function PATCH(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if (body?.complete === true) {
    setForceComplete(true);
    return NextResponse.json({
      success: true,
      complete: true,
      ...getMemoryScratchProgress(),
    });
  }

  if (body?.complete === false) {
    setForceComplete(false);
    return NextResponse.json({
      success: true,
      complete: false,
      ...getMemoryScratchProgress(),
    });
  }

  const raw = Number(body?.target ?? body?.totalParticipants);
  if (!Number.isFinite(raw) || raw < 1) {
    return NextResponse.json(
      { error: "target must be a positive number" },
      { status: 400 },
    );
  }

  const target = setRevealTarget(raw);
  return NextResponse.json({
    success: true,
    ...getMemoryScratchProgress(),
    target,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const asset = body?.asset;
    const clientId =
      typeof body?.clientId === "string" ? body.clientId.slice(0, 80) : "";

    if (!isScratchId(asset)) {
      return NextResponse.json(
        { success: false, error: "Invalid asset" },
        { status: 400 },
      );
    }
    if (!clientId || clientId.length < 8) {
      return NextResponse.json(
        { success: false, error: "clientId required" },
        { status: 400 },
      );
    }

    if (isMemoryMode()) {
      const result = claimMemoryScratch(asset, clientId);
      return NextResponse.json({ success: true, ...result, mode: "memory" });
    }

    try {
      const supabase = getSupabaseAdmin();
      const { error: claimErr } = await supabase.from("scratch_claims").insert({
        client_id: clientId,
        asset,
      });

      if (claimErr) {
        if (claimErr.code === "23505") {
          const counts = await readSupabaseCounts();
          return NextResponse.json({
            success: true,
            accepted: false,
            ...toProgressPayload(counts),
            mode: "supabase",
          });
        }
        throw claimErr;
      }

      const { data: existing } = await supabase
        .from("scratch_counts")
        .select("count")
        .eq("asset", asset)
        .maybeSingle();

      const next = (existing?.count ?? 0) + 1;
      const { error: upsertErr } = await supabase.from("scratch_counts").upsert({
        asset,
        count: next,
      });
      if (upsertErr) throw upsertErr;

      const counts = await readSupabaseCounts();
      return NextResponse.json({
        success: true,
        accepted: true,
        ...toProgressPayload(counts),
        mode: "supabase",
      });
    } catch (err) {
      console.error("scratch POST supabase fallback", err);
      const result = claimMemoryScratch(asset as ScratchId, clientId);
      return NextResponse.json({
        success: true,
        ...result,
        mode: "memory-fallback",
      });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
