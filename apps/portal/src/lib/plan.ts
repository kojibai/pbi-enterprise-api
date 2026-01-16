// lib/plan.ts

export type PlanKey = "starter" | "pro" | "enterprise";

/**
 * Normalize any server plan value (including "pending") into:
 * - a safe PlanKey for indexing (pricing, feature flags)
 * - a UI label that won't crash rendering
 */
export function normalizePlan(raw: unknown): { planKey: PlanKey; uiLabel: string } {
  const s = String(raw ?? "").toLowerCase().trim();

  if (s === "starter") return { planKey: "starter", uiLabel: "Starter" };
  if (s === "pro") return { planKey: "pro", uiLabel: "Pro" };
  if (s === "enterprise") return { planKey: "enterprise", uiLabel: "Scale" };

  // common pre-billing state
  if (s === "pending") return { planKey: "starter", uiLabel: "Pending" };

  // fallback: never crash
  return { planKey: "starter", uiLabel: s ? s.toUpperCase() : "Starter" };
}