import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  claimMemoryScratch,
  emptyCounts,
  getForceComplete,
  getMemoryScratchProgress,
  getRevealTarget,
  isScratchId,
  SCRATCH_IDS,
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

async function readSupabaseSettings() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scratch_settings")
    .select("target, complete")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const target = Number(data.target);
  return {
    target: Number.isFinite(target) && target > 0 ? Math.floor(target) : 20,
    complete: data.complete === true,
  };
}

async function writeSupabaseSettings(patch: {
  target?: number;
  complete?: boolean;
}) {
  const current = (await readSupabaseSettings()) ?? {
    target: getRevealTarget(),
    complete: getForceComplete(),
  };
  const next = {
    id: 1,
    target: patch.target ?? current.target,
    complete: patch.complete ?? current.complete,
  };
  const { error } = await getSupabaseAdmin()
    .from("scratch_settings")
    .upsert(next, { onConflict: "id" });
  if (error) throw error;
  setRevealTarget(next.target);
  setForceComplete(next.complete);
  return next;
}

async function fillSupabaseAssets(target: number) {
  const supabase = getSupabaseAdmin();
  const counts = await readSupabaseCounts();
  for (const asset of SCRATCH_IDS) {
    const next = Math.max(counts[asset], target);
    const { error } = await supabase.from("scratch_counts").upsert({
      asset,
      count: next,
    });
    if (error) throw error;
  }
}

function applySettings(settings: { target: number; complete: boolean } | null) {
  if (!settings) return;
  setRevealTarget(settings.target);
  setForceComplete(settings.complete);
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
      const [counts, settings] = await Promise.all([
        readSupabaseCounts(),
        readSupabaseSettings(),
      ]);
      applySettings(settings);
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
    if (!isMemoryMode()) {
      try {
        await writeSupabaseSettings({ complete: true });
        await fillSupabaseAssets(getRevealTarget());
        const counts = await readSupabaseCounts();
        return NextResponse.json({
          success: true,
          ...toProgressPayload(counts),
          mode: "supabase",
        });
      } catch (err) {
        console.error("scratch PATCH complete supabase fallback", err);
      }
    }
    return NextResponse.json({
      success: true,
      ...getMemoryScratchProgress(),
    });
  }

  if (body?.complete === false) {
    setForceComplete(false);
    if (!isMemoryMode()) {
      try {
        await writeSupabaseSettings({ complete: false });
      } catch (err) {
        console.error("scratch PATCH incomplete supabase fallback", err);
      }
    }
    return NextResponse.json({
      success: true,
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
  if (!isMemoryMode()) {
    try {
      await writeSupabaseSettings({ target });
    } catch (err) {
      console.error("scratch PATCH target supabase fallback", err);
      return NextResponse.json(
        { error: "Gagal menyimpan target" },
        { status: 500 },
      );
    }
  }
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
          const [counts, settings] = await Promise.all([
            readSupabaseCounts(),
            readSupabaseSettings(),
          ]);
          applySettings(settings);
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
      const settings = await readSupabaseSettings();
      applySettings(settings);
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
