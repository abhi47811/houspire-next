export const TIERS = ["Mid-tier", "Premium"] as const;
export type Tier = typeof TIERS[number];

export const CITIES_WITH_MULTIPLIERS: Record<string, number | null> = {
  "Hyderabad": 1.00, "Davanagere": 0.90, "Kathua": 0.88,
  "Jaipur": 0.92, "Sangli": 0.93, "Bhopal": 0.93, "Hubli": 0.92,
  "Bodeli": 0.88, "Gandhinagar": 0.96, "Jorhat": 0.95,
  "Nashik": 0.95, "Trivandrum": 0.95, "Vadodara": 0.98,
  "Visakhapatnam": 0.98, "Kolkata": 1.02, "Pune": 1.08,
  "Chennai": 1.10, "Bangalore": 1.12, "Noida": 1.18, "Delhi": 1.18,
  "Thane": 1.20, "Mumbai": 1.25, "Other": null,
};
export const CITIES = Object.keys(CITIES_WITH_MULTIPLIERS);

export const ROOM_TYPES = [
  "Living Room", "Master Bedroom", "Bedroom", "Kitchen",
  "Bathroom", "Study / Home Office", "Dining Room",
  "Foyer / Entrance", "Balcony", "Unknown",
];
