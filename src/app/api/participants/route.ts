import { NextResponse } from "next/server";
import { getMemoryParticipants, isMemoryMode } from "@/lib/memory-store";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    if (isMemoryMode()) {
      return NextResponse.json({
        participants: getMemoryParticipants(),
        mode: "memory",
      });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("participants")
      .select("id, name, gender, pos_x, pos_y, submitted_at")
      .order("submitted_at", { ascending: true });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Failed to load participants" },
        { status: 500 },
      );
    }

    return NextResponse.json({ participants: data ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
