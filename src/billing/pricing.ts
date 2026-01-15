export type Plan = "starter" | "pro" | "enterprise";

export type Pricing = {
  plan: Plan;
  verifyCentsPerUnit: number;      // price per verify unit
  challengeCentsPerUnit: number;   // price per challenge unit
};

export const pricingByPlan: Record<Plan, Pricing> = {
  starter: { plan: "starter", verifyCentsPerUnit: 2, challengeCentsPerUnit: 1 },
  pro: { plan: "pro", verifyCentsPerUnit: 10, challengeCentsPerUnit: 2 },
  enterprise: { plan: "enterprise", verifyCentsPerUnit: 50, challengeCentsPerUnit: 5 }
};