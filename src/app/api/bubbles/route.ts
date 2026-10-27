import { NextResponse } from "next/server";
import {
  appendBubblePop,
  isValidOnboardingIconId,
  listBubblePops,
  resolveBubblePopIconId,
  setBubblePopsFromDb,
  type BubblePopRecord,
} from "@/lib/bubble-pop-log";
import {
  clearBubbleClicks,
  getBubbleClickTotal,
  incrementBubbleClicks,
  setBubbleClickTotal,
} from "@/lib/bubble-clicks";
import { isMemoryMode } from "@/lib/memory-store";
import { getSupabaseAdmin, hasSupabaseServiceRole } from "@/lib/supabase";

function apiError(err: unknown, fallback: string) {
  const e = err as { message?: string; code?: string; details?: string };
  return NextResponse.json(
    {
      error: e?.message || fallback,
      code: e?.code,
      details: e?.details,
    },
    { status: 500 },
  );
}

async function readSupabaseBubbleClicks(): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scratch_settings")
    .select("bubble_clicks")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (error.code === "42703") return null;
    throw error;
  }
  const n = Number(data?.bubble_clicks);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

async function writeSupabaseBubbleClicks(total: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("scratch_settings")
    .update({ bubble_clicks: total })
    .eq("id", 1);
  if (error?.code === "42703") return false;
  if (error) throw error;
  return true;
}

async function readSupabaseBubblePops(): Promise<BubblePopRecord[] | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bubble_pops")
    .select("id, icon_id, created_at")
    .order("id", { ascending: true })
    .limit(600);
  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    iconId: resolveBubblePopIconId(row.icon_id),
    createdAt: String(row.created_at),
  }));
}

async function readSupabaseBubblePopsSince(
  sinceId: number,
): Promise<BubblePopRecord[] | null> {
  const supabase = getSupabaseAdmin();
  const since = Math.max(0, Math.floor(sinceId));
  const { data, error } = await supabase
    .from("bubble_pops")
    .select("id, icon_id, created_at")
    .gt("id", since)
    .order("id", { ascending: true })
    .limit(48);
  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    iconId: resolveBubblePopIconId(row.icon_id),
    createdAt: String(row.created_at),
  }));
}

function normalizeRpcJson(data: unknown): unknown {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return data;
    }
  }
  return data;
}

function parseRecordBubblePopRpc(data: unknown): {
  total: number;
  pop: BubblePopRecord | null;
} | null {
  const normalized = normalizeRpcJson(data);
  if (!normalized || typeof normalized !== "object") return null;
  const row = normalized as Record<string, unknown>;
  const total = Number(row.total);
  if (!Number.isFinite(total)) return null;
  let pop: BubblePopRecord | null = null;
  const rawPop = row.pop;
  if (rawPop && typeof rawPop === "object") {
    const p = rawPop as Record<string, unknown>;
    const id = Number(p.id);
    if (Number.isFinite(id)) {
      pop = {
        id,
        iconId: resolveBubblePopIconId(p.icon_id),
        createdAt: String(p.created_at ?? new Date().toISOString()),
      };
    }
  }
  return { total: Math.max(0, Math.floor(total)), pop };
}

async function insertSupabaseBubblePop(iconId: string): Promise<BubblePopRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bubble_pops")
    .insert({ icon_id: iconId })
    .select("id, icon_id, created_at")
    .single();
  if (error) {
    if (error.code === "42P01") return null;
    throw error;
  }
  return {
    id: Number(data.id),
    iconId: resolveBubblePopIconId(data.icon_id),
    createdAt: String(data.created_at),
  };
}

function jsonPayload(total: number, pops: BubblePopRecord[]) {
  return NextResponse.json({ total, pops });
}

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get("view");

  if (view === "total") {
    if (isMemoryMode()) {
      return NextResponse.json({ total: getBubbleClickTotal() });
    }
    try {
      const db = await readSupabaseBubbleClicks();
      const total =
        db === null ? getBubbleClickTotal() : setBubbleClickTotal(db);
      return NextResponse.json({ total });
    } catch (err) {
      console.error("bubbles GET total", err);
      return NextResponse.json(
        { error: "Failed to read bubble total" },
        { status: 500 },
      );
    }
  }

  if (view === "recent") {
    const since = Math.max(
      0,
      Math.floor(Number(new URL(request.url).searchParams.get("since") ?? 0)),
    );
    if (isMemoryMode()) {
      const pops = listBubblePops().filter((p) => p.id > since);
      return NextResponse.json({ total: getBubbleClickTotal(), pops });
    }
    try {
      const [db, popRows] = await Promise.all([
        readSupabaseBubbleClicks(),
        readSupabaseBubblePopsSince(since),
      ]);
      const total =
        db === null ? getBubbleClickTotal() : setBubbleClickTotal(db);
      const pops = popRows ?? [];
      return NextResponse.json({ total, pops });
    } catch (err) {
      console.error("bubbles GET recent", err);
      const pops = listBubblePops().filter((p) => p.id > since);
      return NextResponse.json({ total: getBubbleClickTotal(), pops });
    }
  }

  if (isMemoryMode()) {
    return jsonPayload(getBubbleClickTotal(), listBubblePops());
  }

  try {
    const db = await readSupabaseBubbleClicks();
    const popRows = await readSupabaseBubblePops();
    if (popRows !== null) {
      setBubblePopsFromDb(popRows);
    }
    if (db === null) {
      return jsonPayload(getBubbleClickTotal(), listBubblePops());
    }
    setBubbleClickTotal(db);
    return jsonPayload(db, listBubblePops());
  } catch (err) {
    console.error("bubbles GET", err);
    return jsonPayload(getBubbleClickTotal(), listBubblePops());
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const delta = Number(body?.delta ?? 1);
  const step = Number.isFinite(delta) ? Math.max(1, Math.min(5, Math.floor(delta))) : 1;
  const iconId = body?.iconId;
  const logPop = isValidOnboardingIconId(iconId) ? iconId : null;

  if (isMemoryMode()) {
    const total = incrementBubbleClicks(step);
    const pop = logPop ? appendBubblePop(logPop) : null;
    return NextResponse.json({ total, pop });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "record_bubble_pop",
      {
        p_icon_id: logPop ?? "",
        step,
      },
    );

    if (!rpcError) {
      const parsed = parseRecordBubblePopRpc(rpcData);
      if (parsed) {
        setBubbleClickTotal(parsed.total);
        return NextResponse.json({
          total: parsed.total,
          pop: parsed.pop,
        });
      }
      const fromDb = await readSupabaseBubbleClicks();
      if (fromDb !== null) {
        setBubbleClickTotal(fromDb);
        return NextResponse.json({ total: fromDb, pop: null });
      }
    } else if (rpcError.code !== "PGRST202" && rpcError.code !== "42883") {
      console.error("record_bubble_pop", rpcError);
      return apiError(rpcError, "record_bubble_pop failed");
    }

    const { data: incData, error: incError } = await supabase.rpc(
      "increment_bubble_clicks",
      { step },
    );

    let total: number;
    if (!incError && incData !== null && incData !== undefined) {
      total = Math.max(0, Math.floor(Number(incData)));
      setBubbleClickTotal(total);
    } else if (
      incError &&
      incError.code !== "PGRST202" &&
      incError.code !== "42883"
    ) {
      console.error("increment_bubble_clicks", incError);
      return apiError(incError, "increment_bubble_clicks failed");
    } else {
      const current =
        (await readSupabaseBubbleClicks()) ?? getBubbleClickTotal();
      total = current + step;
      const ok = await writeSupabaseBubbleClicks(total);
      if (!ok) {
        return NextResponse.json(
          {
            error:
              "Could not update scratch_settings.bubble_clicks. Set SUPABASE_SERVICE_ROLE_KEY on Vercel or run supabase/migrations.",
          },
          { status: 500 },
        );
      }
      setBubbleClickTotal(total);
    }

    let pop: BubblePopRecord | null = null;
    if (logPop && hasSupabaseServiceRole()) {
      try {
        pop = await insertSupabaseBubblePop(logPop);
      } catch (insertErr) {
        console.error("bubble_pops insert", insertErr);
      }
    }

    return NextResponse.json({ total, pop });
  } catch (err) {
    console.error("bubbles POST", err);
    return apiError(err, "Bubble pop failed");
  }
}
