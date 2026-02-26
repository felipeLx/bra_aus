export type PricingInput = {
  totalCharterCostAud: number | null;
  cargoRatePerKg: number | null;
  maxPassengers: number | null;
  bookings: { passengerCount: number; status: string }[];
  cargoRequests: { weightKg: number; status: string }[];
};

export type PricingResult = {
  charterCost: number;
  cargoRatePerKg: number;
  approvedCargoKg: number;
  cargoRevenue: number;
  passengerPool: number;
  activePassengers: number;
  pricePerPerson: number | null;
  bestCasePrice: number | null; // if all seats fill
  seatsLeft: number | null;
  seatsTotal: number | null;
  seatsFillPercent: number | null;
};

export function calculatePricing(campaign: PricingInput): PricingResult {
  const charterCost = campaign.totalCharterCostAud ?? 0;
  const cargoRate = campaign.cargoRatePerKg ?? 0;

  const approvedCargoKg = campaign.cargoRequests
    .filter((c) => c.status === "APPROVED")
    .reduce((sum, c) => sum + c.weightKg, 0);

  const cargoRevenue = approvedCargoKg * cargoRate;
  const passengerPool = Math.max(charterCost - cargoRevenue, 0);

  // All non-cancelled bookings count for the live estimate
  const activePassengers = campaign.bookings
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => sum + b.passengerCount, 0);

  const pricePerPerson = activePassengers > 0 ? passengerPool / activePassengers : null;

  const seatsTotal = campaign.maxPassengers ?? null;
  const seatsLeft = seatsTotal != null ? seatsTotal - activePassengers : null;
  const seatsFillPercent = seatsTotal != null && seatsTotal > 0 ? (activePassengers / seatsTotal) * 100 : null;

  // Best case: what each person pays if the plane is completely full
  const bestCasePrice = seatsTotal != null && seatsTotal > 0 ? passengerPool / seatsTotal : null;

  return {
    charterCost,
    cargoRatePerKg: cargoRate,
    approvedCargoKg,
    cargoRevenue,
    passengerPool,
    activePassengers,
    pricePerPerson,
    bestCasePrice,
    seatsLeft,
    seatsTotal,
    seatsFillPercent,
  };
}

export function formatAud(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}
