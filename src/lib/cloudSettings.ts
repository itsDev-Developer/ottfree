// Client-side helpers that read shared settings & ads from Lovable Cloud
// (public read via the anon key + RLS SELECT policies).
import { supabase } from "@/integrations/supabase/client";

export interface AdRow {
  id: string;
  slot: string;
  enabled: boolean;
  image_url: string | null;
  link_url: string | null;
  vast_tag_url: string | null;
  position: number;
}

export interface SiteSettings {
  site_name?: string;
  tagline?: string;
  logo_url?: string;
  hero_image_url?: string;
}

export async function fetchAdsBySlot(slot: string): Promise<AdRow[]> {
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("slot", slot)
    .eq("enabled", true)
    .order("position", { ascending: true });
  if (error) return [];
  return (data ?? []) as AdRow[];
}

export async function fetchAllAds(): Promise<AdRow[]> {
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .order("slot", { ascending: true })
    .order("position", { ascending: true });
  if (error) return [];
  return (data ?? []) as AdRow[];
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "site")
    .maybeSingle();
  if (error || !data) return {};
  return (data.value ?? {}) as SiteSettings;
}
