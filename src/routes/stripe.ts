import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import type { PortalAuthedRequest } from "../middleware/portalSession.js";
import { requirePortalSession } from "../middleware/portalSession.js";

export const stripeRouter = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const portalBaseUrl = process.env.PORTAL_BASE_URL ?? "http://localhost:3000";

// Let the installed Stripe SDK pick its supported API version
const stripe = stripeSecretKey.length > 0 ? new Stripe(stripeSecretKey) : null;

type UnknownRecord = Record<string, unknown>;

function isRecord(x: unknown): x is UnknownRecord {
  return typeof x === "object" && x !== null;
}

function asString(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

function asNumber(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function getPath(obj: unknown, path: readonly (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[String(key)];
  }
  return cur;
}

type Plan = "starter" | "pro" | "enterprise";

function priceToPlan(priceId: string): Plan | null {
  const starter = process.env.STRIPE_PRICE_STARTER ?? "";
  const pro = process.env.STRIPE_PRICE_PRO ?? "";
  const ent = process.env.STRIPE_PRICE_ENTERPRISE ?? "";

  if (priceId === starter) return "starter";
  if (priceId === pro) return "pro";
  if (priceId === ent) return "enterprise";
  return null;
}

function quotaForPlan(plan: Plan): bigint {
  const v =
    plan === "starter"
      ? process.env.PBI_QUOTA_STARTER
      : plan === "pro"
        ? process.env.PBI_QUOTA_PRO
        : process.env.PBI_QUOTA_ENTERPRISE;

  if (!v || !/^\d+$/.test(v)) {
    return plan === "starter" ? 100000n : plan === "pro" ? 500000n : 5000000n;
  }
  return BigInt(v);
}

type SubExtract = {
  stripeSubId: string;
  stripeCustomerId: string;
  status: string;
  priceId: string | null;
  currentPeriodEnd: number | null;
};

function extractSubscription(eventObj: unknown): SubExtract | null {
  if (!isRecord(eventObj)) return null;

  const stripeSubId = asString(eventObj["id"]);
  const stripeCustomerId = asString(eventObj["customer"]);
  const status = asString(eventObj["status"]);
  const currentPeriodEnd = asNumber(eventObj["current_period_end"]);

  // items.data[0].price.id
  const priceId = asString(getPath(eventObj, ["items", "data", 0, "price", "id"]));

  if (!stripeSubId || !stripeCustomerId || !status) return null;

  return {
    stripeSubId,
    stripeCustomerId,
    status,
    priceId,
    currentPeriodEnd
  };
}

// Create checkout session (portal-authenticated)
stripeRouter.post("/checkout", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  if (!stripe) {
    res.status(500).json({ error: "stripe_not_configured" });
    return;
  }

  const Body = z.object({
    priceId: z.string().min(1)
  });
  const { priceId } = Body.parse(req.body);

  const customerId = req.portalCustomer!.id;

  // Ensure stripe customer mapping
  const existing = await pool.query(
    `SELECT stripe_customer_id FROM stripe_customers WHERE customer_id=$1 LIMIT 1`,
    [customerId]
  );

  let stripeCustomerId: string;

  if ((existing.rowCount ?? 0) === 0) {
    const created = await stripe.customers.create({
      email: req.portalCustomer!.email,
      metadata: { pbiCustomerId: customerId }
    });

    stripeCustomerId = created.id;

    await pool.query(
      `INSERT INTO stripe_customers (customer_id, stripe_customer_id) VALUES ($1, $2)`,
      [customerId, stripeCustomerId]
    );
  } else {
    stripeCustomerId = (existing.rows[0] as { stripe_customer_id: string }).stripe_customer_id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${portalBaseUrl}/billing/success`,
    cancel_url: `${portalBaseUrl}/billing/canceled`
  });

  res.json({ url: session.url });
});

// Stripe webhook (raw body required)
stripeRouter.post(
  "/webhook",
  (req, _res, next) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      (req as unknown as { rawBody?: string }).rawBody = data;
      next();
    });
  },
  async (req, res) => {
    if (!stripe) {
      res.status(500).json({ error: "stripe_not_configured" });
      return;
    }
    if (stripeWebhookSecret.length === 0) {
      res.status(500).json({ error: "stripe_webhook_not_configured" });
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (typeof sig !== "string") {
      res.status(400).send("missing_signature");
      return;
    }

    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? "";

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret);
    } catch {
      res.status(400).send("bad_signature");
      return;
    }

    const applyPlanQuota = async (stripeCustomerId: string, status: string, priceId: string | null): Promise<void> => {
      const map = await pool.query(
        `SELECT customer_id FROM stripe_customers WHERE stripe_customer_id=$1 LIMIT 1`,
        [stripeCustomerId]
      );

      if ((map.rowCount ?? 0) === 0) return;

      const customerId = (map.rows[0] as { customer_id: string }).customer_id;

      const isGood = status === "active" || status === "trialing";

      let plan: Plan = "starter";
      if (isGood && priceId) {
        plan = priceToPlan(priceId) ?? "enterprise";
      }

      const quota = quotaForPlan(plan);

      // Update customer
      await pool.query(
        `UPDATE customers SET plan=$1, quota_per_month=$2 WHERE id=$3`,
        [plan, quota.toString(), customerId]
      );

      // Keep keys in sync (your apiKeyAuth uses api_keys.plan/quota_per_month)
      await pool.query(
        `UPDATE api_keys SET plan=$1, quota_per_month=$2 WHERE customer_id=$3`,
        [plan, quota.toString(), customerId]
      );
    };

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const sub = extractSubscription(event.data.object);
      if (!sub) {
        res.status(400).send("bad_payload");
        return;
      }

      await applyPlanQuota(sub.stripeCustomerId, sub.status, sub.priceId);

      const id = randomUUID();
      await pool.query(
        `INSERT INTO subscriptions (id, customer_id, stripe_subscription_id, status, current_period_end)
         VALUES (
           $1,
           (SELECT customer_id FROM stripe_customers WHERE stripe_customer_id=$2 LIMIT 1),
           $3,
           $4,
           CASE WHEN $5::double precision IS NULL THEN NULL ELSE to_timestamp($5) END
         )
         ON CONFLICT (stripe_subscription_id)
         DO UPDATE SET status=EXCLUDED.status, current_period_end=EXCLUDED.current_period_end`,
        [id, sub.stripeCustomerId, sub.stripeSubId, sub.status, sub.currentPeriodEnd ?? null]
      );
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = extractSubscription(event.data.object);
      if (!sub) {
        res.status(400).send("bad_payload");
        return;
      }

      // Revert to starter on delete
      await applyPlanQuota(sub.stripeCustomerId, "canceled", null);

      await pool.query(
        `UPDATE subscriptions SET status='canceled' WHERE stripe_subscription_id=$1`,
        [sub.stripeSubId]
      );
    }

    res.json({ received: true });
  }
);