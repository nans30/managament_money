import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Inisialisasi Supabase Client untuk sisi klien (Browser).
 * Aturan Keamanan Wajib:
 * - HANYA menggunakan NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * - JANGAN PERNAH mengekspos service_role key di kode klien!
 * - Jika env belum diisi (mode murni offline lokal), fungsi mengembalikan null
 *   agar aplikasi tetap berjalan 100% di IndexedDB tanpa crash.
 */
let supabaseInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      anonKey &&
      url.startsWith('http') &&
      !url.includes('project-id-anda.supabase.co')
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseInstance;
}

/**
 * Helper Auth: Login dengan Email & Password
 */
export async function signInWithEmail(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase belum dikonfigurasi di .env.local');
  }
  return client.auth.signInWithPassword({ email, password });
}

/**
 * Helper Auth: Daftar akun baru dengan Email & Password
 */
export async function signUpWithEmail(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase belum dikonfigurasi di .env.local');
  }
  return client.auth.signUp({ email, password });
}

/**
 * Helper Auth: Login dengan Google OAuth
 */
export async function signInWithGoogle() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase belum dikonfigurasi di .env.local');
  }
  return client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
}

/**
 * Helper Auth: Logout
 */
export async function signOutUser() {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}
