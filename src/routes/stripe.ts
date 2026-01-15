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

// ✅ Let the installed Stripe SDK pick its supported API version
const stripe = stripeSecretKey.length > 0 ? new Stripe(stripeSecretKey) : null;

type StripeSubPayload = {
  id?: unknown;
  customer?: unknown;
  status?: unknown;
  current_period_end?: unknown;
  items?: unknown;
};

function asStripeSubPayload(x: unknown): StripeSubPayload | null {
  if (typeof x !== "object" || x === null) return null;
  return x as StripeSubPayload;
}

function asString(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

function asNumber(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

// Create checkout session (portal-authenticated)
stripeRouter.post("/checkout", requirePortalSession, async (req: PortalAuthedRequest, res) => {
  if (!stripe) {
    res.status(500).json({ error: "stripe_not_configured" });
    return;
  }

  const Body = z.object({
    priceId: z.string().min(1) // Stripe Price ID
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

    // Subscription created/updated -> update plan/quota
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const payload = asStripeSubPayload(event.data.object);
      if (!payload) {
        res.status(400).send("bad_payload");
        return;
      }

      const stripeSubId = asString(payload.id);
      const stripeCustomerId = asString(payload.customer);
      const status = asString(payload.status);
      const currentPeriodEnd = asNumber(payload.current_period_end);

      if (!stripeSubId || !stripeCustomerId || !status) {
        res.status(400).send("missing_fields");
        return;
      }

      const map = await pool.query(
        `SELECT customer_id FROM stripe_customers WHERE stripe_customer_id=$1 LIMIT 1`,
        [stripeCustomerId]
      );

      if ((map.rowCount ?? 0) > 0) {
        const customerId = (map.rows[0] as { customer_id: string }).customer_id;

        // TODO: map Stripe price -> plan/quota.
        // For now: enterprise on active, fallback to starter on non-active.
        if (status === "active") {
          await pool.query(`UPDATE customers SET plan='enterprise', quota_per_month=1000000 WHERE id=$1`, [customerId]);
        } else {
          await pool.query(`UPDATE customers SET plan='starter', quota_per_month=100000 WHERE id=$1`, [customerId]);
        }

        const id = randomUUID();
        await pool.query(
          `INSERT INTO subscriptions (id, customer_id, stripe_subscription_id, status, current_period_end)
           VALUES ($1, $2, $3, $4, CASE WHEN $5::double precision IS NULL THEN NULL ELSE to_timestamp($5) END)
           ON CONFLICT (stripe_subscription_id)
           DO UPDATE SET status=EXCLUDED.status, current_period_end=EXCLUDED.current_period_end`,
          [id, customerId, stripeSubId, status, currentPeriodEnd ?? null]
        );
      }
    }

    res.json({ received: true });
  }
);