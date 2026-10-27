import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidStaffToken, staffCookieName } from "@/lib/auth";
import type { BubblePopRecord } from "@/lib/bubble-pop-log";
import { getOnboardingLayout } from "@/lib/onboarding-layout";
import { isMemoryMode } from "@/lib/memory-store";

async function authorize(request: Request) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (isValidStaffToken(bearer)) return true;
  const jar = await cookies();
  return isValidStaffToken(jar.get(staffCookieName())?.value);
}

function shuffledIconIds(studentIndex: number): string[] {
  const ids = getOnboardingLayout().icons.map((i) => i.id);
  let s = ((studentIndex + 1) * 0x9e3779b9) >>> 0;
  for (let i = ids.length - 1; i > 0; i -= 1) {
    s =
      (Math.imul(s ^ (s >>> 16), 0x85ebca6b) ^
        Math.imul(s >>> 13, 0xc2b2ae35)) >>>
      0;
    const j = s % (i + 1);
    const tmp = ids[i]!;
    ids[i] = ids[j]!;
    ids[j] = tmp;
  }
  return ids;
}

/** Staff: satu siswa pop semua bubble welcome — tiap pop = POST /api/bubbles yang sama. */
export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const studentIndex = Math.max(0, Math.floor(Number(body?.studentIndex) || 0));
  const order = shuffledIconIds(studentIndex);
  const pops: BubblePopRecord[] = [];
  let total = 0;

  const origin = new URL(request.url).origin;
  for (const iconId of order) {
    const res = await fetch(`${origin}/api/bubbles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta: 1, iconId }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Bubble pop failed", studentIndex, total, pops },
        { status: 500 },
      );
    }
    const data = (await res.json()) as {
      total?: number;
      pop?: BubblePopRecord;
    };
    if (typeof data.total === "number") total = data.total;
    if (data.pop) pops.push(data.pop);
  }

  return NextResponse.json({
    studentIndex,
    total,
    pops,
    bubblesPerStudent: order.length,
    mode: isMemoryMode() ? "memory" : "live",
  });
}
