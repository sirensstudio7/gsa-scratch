export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    console.error(
      "[gsa] Production is missing Supabase env vars — /api routes will return 503 until configured.",
    );
  }

  if (!process.env.STAFF_TOKEN?.trim()) {
    console.error(
      "[gsa] STAFF_TOKEN is not set — staff login and protected APIs will reject all tokens.",
    );
  }
}
