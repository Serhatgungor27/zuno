import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getApiAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, trackId, artist, genres, action, timeSpentMs, completion } = body;

    if (!trackId || !action) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Signed in where possible: a session id dies with the app, and taste is
    // the one thing that should outlive a relaunch. Anonymous rows are still
    // accepted rather than dropped.
    const auth = await getApiAuth(req).catch(() => null);

    const { error } = await supabase.from("discover_interactions").insert({
      user_id: auth?.user.id ?? null,
      session_id: sessionId ?? null,
      track_id: trackId,
      artist: artist ?? null,
      genres: genres ?? null,
      action,
      time_spent_ms: timeSpentMs ?? 0,
      completion: typeof completion === "number" ? completion : null,
    });

    // A write that silently fails looks exactly like one that worked, and the
    // whole feed now learns from these rows — a missing column or a missing
    // grant would quietly stop it learning at all.
    if (error) {
      console.error("[discover/interact] write:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
