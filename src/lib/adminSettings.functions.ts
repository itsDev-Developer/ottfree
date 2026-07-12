import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const BACKEND = "https://varying-orsa-komi106-7ef913ad.koyeb.app";

async function requireAdmin(): Promise<void> {
  const req = getRequest();
  const cookie = req.headers.get("cookie") ?? "";
  const res = await fetch(`${BACKEND}/`, {
    headers: { cookie, accept: "application/json" },
    redirect: "manual",
  });
  if (!res.ok) throw new Error("Unauthorized");
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    // The backend returned HTML (usually a login page). Treat as unauthenticated
    // rather than crashing on JSON.parse — gives the UI a clear error to show.
    throw new Error("Unauthorized: please sign in to the admin backend");
  }
  const data = (await res.json().catch(() => ({}))) as { is_admin?: boolean };
  if (!data.is_admin) throw new Error("Forbidden: admin only");
}

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((s) => s === "" || /^https?:\/\//i.test(s), "Must be a URL")
  .optional()
  .nullable();

const AdSchema = z.object({
  id: z.string().uuid().optional(),
  slot: z.string().min(1).max(64),
  enabled: z.boolean(),
  network: z.string().max(64).optional().nullable(),
  label: z.string().max(120).optional().nullable(),
  image_url: optionalUrl,
  link_url: optionalUrl,
  vast_tag_url: optionalUrl,
  script_code: z.string().max(20000).optional().nullable(),
  position: z.number().int().min(0).default(0),
});

const SiteSettingsSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.record(z.string(), z.unknown()),
});

export const upsertAd = createServerFn({ method: "POST" })
  .inputValidator((input) => AdSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Strip `id: undefined` on inserts so Postgres/PostgREST generates a UUID
    // rather than choking on an explicit undefined primary key.
    const { id, ...rest } = data;
    const payload: Record<string, unknown> = {
      ...rest,
      network: data.network || null,
      label: data.label || null,
      image_url: data.image_url || null,
      link_url: data.link_url || null,
      vast_tag_url: data.vast_tag_url || null,
      script_code: data.script_code || null,
    };
    if (id) payload.id = id;
    const { data: row, error } = await supabaseAdmin
      .from("ads")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertSiteSetting = createServerFn({ method: "POST" })
  .inputValidator((input) => SiteSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: data.key, value: data.value as never }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
