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
import { getSupabaseAdmin } from "@/lib/supabase";

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

function parseRecordBubblePopRpc(data: unknown): {
  total: number;
  pop: BubblePopRecord | null;
} | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
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
      return NextResponse.json({ total: getBubbleClickTotal() });
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
    const parsed = !rpcError ? parseRecordBubblePopRpc(rpcData) : null;
    if (parsed) {
      setBubbleClickTotal(parsed.total);
      const pop =
        parsed.pop ??
        (logPop ? appendBubblePop(logPop) : null);
      return NextResponse.json({ total: parsed.total, pop });
    }

    if (
      rpcError &&
      rpcError.code !== "PGRST202" &&
      rpcError.code !== "42883"
    ) {
      throw rpcError;
    }

    const { data, error } = await supabase.rpc("increment_bubble_clicks", {
      step,
    });
    let total: number;
    if (!error && data !== null && data !== undefined) {
      total = Math.max(0, Math.floor(Number(data)));
      setBubbleClickTotal(total);
    } else {
      if (error && error.code !== "PGRST202" && error.code !== "42883") {
        throw error;
      }
      const current = (await readSupabaseBubbleClicks()) ?? getBubbleClickTotal();
      total = current + step;
      const ok = await writeSupabaseBubbleClicks(total);
      if (!ok) {
        const mem = incrementBubbleClicks(step);
        const pop = logPop ? appendBubblePop(logPop) : null;
        return NextResponse.json({ total: mem, pop, mode: "memory-fallback" });
      }
      setBubbleClickTotal(total);
    }

    let pop: BubblePopRecord | null = null;
    if (logPop) {
      pop = (await insertSupabaseBubblePop(logPop)) ?? appendBubblePop(logPop);
    }

    return NextResponse.json({ total, pop });
  } catch (err) {
    console.error("bubbles POST", err);
    const total = incrementBubbleClicks(step);
    const pop = logPop ? appendBubblePop(logPop) : null;
    return NextResponse.json({ total, pop, mode: "memory-fallback" });
  }
}
