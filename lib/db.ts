import { getSupabaseClient } from "./supabase";
import type { BOQRow, RateSource, VendorRow, ProjectData } from "./types";

export async function saveProject(
  clientName: string,
  city: string,
  pincode: string,
  tier: string,
  boqRows: BOQRow[],
  rateSources: RateSource[],
  vendors: VendorRow[],
  notes: string,
): Promise<string | null> {
  const db = getSupabaseClient();
  try {
    const { data: proj, error } = await db
      .from("projects")
      .insert({ client_name: clientName, city, pincode, tier })
      .select()
      .single();
    if (error || !proj) return null;
    const pid = proj.id as string;

    if (boqRows.length > 0) {
      await db.from("boq_rows").insert(
        boqRows.map((r) => ({ project_id: pid, ...r })),
      );
    }
    if (rateSources.length > 0) {
      await db.from("rate_sources").insert(
        rateSources.map((s) => ({ project_id: pid, ...s })),
      );
    }
    if (vendors.length > 0) {
      await db.from("vendors").insert(
        vendors.map((v) => ({ project_id: pid, ...v })),
      );
    }
    if (notes) {
      await db.from("vendor_notes").insert({ project_id: pid, notes });
    }
    return pid;
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<ProjectData[]> {
  const db = getSupabaseClient();
  const { data } = await db
    .from("projects")
    .select("id, client_name, city, pincode, tier, created_at")
    .order("created_at", { ascending: false });
  return (data as ProjectData[]) ?? [];
}

export async function loadProject(id: string) {
  const db = getSupabaseClient();
  const [proj, boq, src, vnd, notes] = await Promise.all([
    db.from("projects").select("*").eq("id", id).single(),
    db.from("boq_rows").select("*").eq("project_id", id),
    db.from("rate_sources").select("*").eq("project_id", id),
    db.from("vendors").select("*").eq("project_id", id),
    db.from("vendor_notes").select("notes").eq("project_id", id),
  ]);
  return {
    project: proj.data,
    boq_rows: (boq.data ?? []) as BOQRow[],
    rate_sources: (src.data ?? []) as RateSource[],
    vendors: (vnd.data ?? []) as VendorRow[],
    notes: (notes.data?.[0] as { notes: string } | undefined)?.notes ?? "",
  };
}

export async function deleteProject(id: string) {
  const db = getSupabaseClient();
  await db.from("projects").delete().eq("id", id);
}
