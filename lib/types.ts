export interface RoomAnalysis {
  room_type: string;
  estimated_sqft: number;
  confidence: "high" | "medium" | "low";
  design_elements: string;
  image_filename: string;
}

export type BOQPhase =
  | "Phase 1: Civil & Flooring"
  | "Phase 2: Carpentry"
  | "Phase 3: Electrical & MEP"
  | "Phase 4: Finishes & Furnishings";

export interface BOQRow {
  category: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  confidence?: "high" | "medium" | "low";
  phase?: BOQPhase;
}

export interface RateSource {
  item: string;
  basis: string;
  source: string;
}

export interface VendorRow {
  category: string;
  vendor: string;
  specialty: string;
  area: string;
  lat: number;
  lng: number;
  rating: string;
  phone: string;
}

export interface ProjectData {
  id: string;
  client_name: string;
  city: string;
  pincode: string;
  tier: string;
  created_at: string;
  status?: string;
  client_email?: string;
}

export interface GenerateResult {
  boq_rows: BOQRow[];
  rate_sources: RateSource[];
  vendors: VendorRow[];
  notes: string;
  project_id?: string;
}
