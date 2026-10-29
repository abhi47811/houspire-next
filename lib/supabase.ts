import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

// Server-side data client (anon key) for Route Handlers and Server Components.
// In the browser the same helper returns a cookie-based client, so sign-in and
// sign-out update the session cookies the API route handlers read.
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (typeof window !== "undefined") {
    return createBrowserClient(url, key);
  }

  return createClient(url, key);
}
