import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, trackId, artist, genres, action, timeSpentMs } = body;

    if (!trackId || !action) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await supabase.from("discover_interactions").insert({
      session_id: sessionId ?? null,
      track_id: trackId,
      artist: artist ?? null,
      genres: genres ?? null,
      action,
      time_spent_ms: timeSpentMs ?? 0,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
