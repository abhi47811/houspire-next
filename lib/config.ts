export const TIERS = ["Mid-tier", "Premium"] as const;
export type Tier = typeof TIERS[number];

export const CITIES_WITH_MULTIPLIERS: Record<string, number | null> = {
  // South India
  "Hyderabad": 1.00, "Visakhapatnam": 0.98, "Chennai": 1.10,
  "Bangalore": 1.12, "Mysore": 0.95, "Coimbatore": 1.05,
  "Madurai": 0.95, "Mangalore": 1.02, "Trivandrum": 0.95,
  "Kochi": 1.08, "Davanagere": 0.90, "Hubli": 0.92,
  // West India
  "Mumbai": 1.25, "Thane": 1.20, "Pune": 1.08,
  "Nashik": 0.95, "Nagpur": 0.95, "Sangli": 0.93,
  "Vadodara": 0.98, "Ahmedabad": 1.05, "Surat": 1.00,
  "Rajkot": 0.98, "Bhavnagar": 0.90, "Gandhinagar": 0.96,
  "Bodeli": 0.88,
  // North India
  "Delhi": 1.18, "Noida": 1.18, "Gurgaon": 1.18,
  "Faridabad": 1.05, "Ghaziabad": 1.05, "Meerut": 0.92,
  "Chandigarh": 1.05, "Ludhiana": 0.98, "Amritsar": 0.92,
  "Jalandhar": 0.92, "Jaipur": 0.92, "Agra": 0.90,
  "Lucknow": 0.98, "Kanpur": 0.92, "Dehradun": 0.95,
  "Srinagar": 0.88, "Kathua": 0.88,
  // Central India
  "Bhopal": 0.93, "Indore": 0.95, "Raipur": 0.90,
  // East India
  "Kolkata": 1.02, "Bhubaneswar": 0.95, "Ranchi": 0.90,
  "Patna": 0.90, "Guwahati": 0.95, "Jorhat": 0.95,
  "Siliguri": 0.88,
  "Other": null,
};
export const CITIES = Object.keys(CITIES_WITH_MULTIPLIERS);

export const ROOM_TYPES = [
  "Living Room", "Master Bedroom", "Bedroom", "Kitchen",
  "Bathroom", "Study / Home Office", "Dining Room",
  "Foyer / Entrance", "Balcony", "Unknown",
];
