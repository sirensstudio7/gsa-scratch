import { NextResponse } from "next/server";
import {
  generateWallPosition,
  sanitizeGender,
  sanitizeName,
} from "@/lib/auth";
import {
  addMemoryParticipant,
  getMemoryParticipants,
  isMemoryMode,
} from "@/lib/memory-store";
import { checkSubmitRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Participant } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const body = await request.json();
    const clientId =
      typeof body?.clientId === "string" ? body.clientId : null;

    const limited = checkSubmitRateLimit({ ip, clientId });
    if (!limited.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Terlalu cepat. Tunggu sebentar.",
          retryAfterSec: limited.retryAfterSec,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const name = sanitizeName(body?.name);
    const gender = sanitizeGender(body?.gender);
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nama wajib diisi (2-80 karakter)." },
        { status: 400 },
      );
    }
    if (!gender) {
      return NextResponse.json(
        { success: false, error: "Gender wajib dipilih." },
        { status: 400 },
      );
    }

    const now = Date.now();
    const { pos_x, pos_y } = generateWallPosition(
      getMemoryParticipants().length + now,
    );

    if (isMemoryMode()) {
      const participant: Participant = {
        id: crypto.randomUUID(),
        name,
        gender,
        pos_x,
        pos_y,
        submitted_at: new Date().toISOString(),
      };
      addMemoryParticipant(participant);
      return NextResponse.json({
        success: true,
        participantId: participant.id,
        mode: "memory",
      });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("participants")
      .insert({ name, gender, pos_x, pos_y })
      .select("id")
      .single();

    if (error || !data) {
      console.error(error);
      return NextResponse.json(
        { success: false, error: "Gagal menyimpan data." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, participantId: data.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: "Request tidak valid." },
      { status: 400 },
    );
  }
}
