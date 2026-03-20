import { supabase } from "./supabase";

export type UserRecord = {
  spotify_id: string;
  display_name: string | null;
  image: string | null;
  username: string | null;
};

/**
 * Resolves a URL slug (username or spotify_id) to a user record.
 * Tries username first, then falls back to spotify_id.
 */
export async function resolveUser(slug: string): Promise<UserRecord | null> {
  // Try username first
  const { data: byUsername } = await supabase
    .from("users")
    .select("spotify_id, display_name, image, username")
    .eq("username", slug)
    .single();

  if (byUsername) return byUsername;

  // Fall back to spotify_id
  const { data: bySpotifyId } = await supabase
    .from("users")
    .select("spotify_id, display_name, image, username")
    .eq("spotify_id", slug)
    .single();

  return bySpotifyId ?? null;
}
