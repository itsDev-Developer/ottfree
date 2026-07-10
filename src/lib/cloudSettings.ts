// Client-side helpers that read shared settings & ads from Lovable Cloud
// (public read via the anon key + RLS SELECT policies).
import { supabase } from "@/integrations/supabase/client";

export interface AdRow {
  id: string;
  slot: string;
  enabled: boolean;
  network: string | null;
  label: string | null;
  image_url: string | null;
  link_url: string | null;
  vast_tag_url: string | null;
  script_code: string | null;
  position: number;
}

export interface SiteSettings {
  site_name?: string;
  tagline?: string;
  logo_url?: string;
  hero_image_url?: string;
  header_html?: string;
  footer_html?: string;
  footer_text?: string;
  primary_color?: string;
  social_links?: { label: string; url: string }[];
}

export interface MaintenanceSettings {
  enabled?: boolean;
  title?: string;
  message?: string;
  eta?: string;
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

async function fetchSetting<T>(key: string): Promise<T> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return {} as T;
  return (data.value ?? {}) as T;
}

export function fetchSiteSettings() {
  return fetchSetting<SiteSettings>("site");
}

export function fetchMaintenanceSettings() {
  return fetchSetting<MaintenanceSettings>("maintenance");
}
