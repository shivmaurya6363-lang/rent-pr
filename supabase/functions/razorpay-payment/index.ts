import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") || "";
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error("[Razorpay] CRITICAL: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set!");
}

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAuthHeader(): string {
  return "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
}

function requiresAuthForPath(path: string) {
  return !["webhook", "create-order", "create-plan", "create-subscription", "razorpay-payment", "verify-payment"].includes(path);
}

async function verifySignature(payload: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(RAZORPAY_KEY_SECRET);
  const msgData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const expectedSignature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSignature === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return jsonResponse({
        error: "Razorpay credentials are not configured in edge function secrets",
      }, 500);
    }

    // Auth check for protected endpoints
    let userId: string | null = null;
    if (path && requiresAuthForPath(path)) {
      const requestAuthHeader = req.headers.get("Authorization");
      if (!requestAuthHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized: missing bearer token" }, 401);
      }

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return jsonResponse({ error: "Supabase auth secrets are not configured" }, 500);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: requestAuthHeader } },
      });

      const token = requestAuthHeader.replace("Bearer ", "").trim();
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      const claimUserId = claimsData?.claims?.sub;

      if (claimsError || !claimUserId) {
        return jsonResponse({ error: "Unauthorized: invalid or expired token" }, 401);
      }

      userId = claimUserId;
    }

    const body = await req.json();

    // ===== CREATE RAZORPAY PLAN =====
    if (path === "create-plan") {
      const { period, interval, item } = body;

      if (!period || !interval || !item?.name || !item?.amount) {
        return jsonResponse({ error: "period, interval, and item (name, amount) are required" }, 400);
      }

      const planPayload = {
        period: period, // "monthly", "weekly", "yearly", "daily"
        interval: interval, // e.g. 1 for every month
        item: {
          name: item.name,
          amount: Math.round(Number(item.amount) * 100), // Convert to paise
          currency: item.currency || "INR",
          description: item.description || "",
        },
        notes: body.notes || {},
      };

      console.log("[Razorpay] Creating plan:", JSON.stringify(planPayload));

      const rzpRes = await fetch(`${RAZORPAY_API_BASE}/plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify(planPayload),
      });

      const rzpData = await rzpRes.json();
      console.log("[Razorpay] Plan response:", JSON.stringify(rzpData));

      if (rzpData.id) {
        return jsonResponse({
          success: true,
          planId: rzpData.id,
          period: rzpData.period,
          interval: rzpData.interval,
          item: rzpData.item,
        });
      }

      return jsonResponse({
        success: false,
        error: rzpData.error?.description || "Razorpay plan creation failed",
        details: rzpData,
      }, 400);
    }

    // ===== CREATE RAZORPAY SUBSCRIPTION =====
    if (path === "create-subscription") {
      const { plan_id, total_count, quantity, notes, customer_notify, upfront_amount } = body;

      if (!plan_id || !total_count) {
        return jsonResponse({ error: "plan_id and total_count are required" }, 400);
      }

      const subscriptionPayload: Record<string, unknown> = {
        plan_id,
        total_count: Number(total_count),
        quantity: quantity || 1,
        customer_notify: customer_notify !== undefined ? customer_notify : 1,
        notes: notes || {},
      };

      // Add upfront amount (security deposit + delivery + installation) as addons
      if (upfront_amount && Number(upfront_amount) > 0) {
        subscriptionPayload.addons = [
          {
            item: {
              name: "Upfront Payment (Security Deposit + Fees)",
              amount: Math.round(Number(upfront_amount) * 100), // paise
              currency: "INR",
            },
          },
        ];
      }

      console.log("[Razorpay] Creating subscription:", JSON.stringify(subscriptionPayload));

      const rzpRes = await fetch(`${RAZORPAY_API_BASE}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify(subscriptionPayload),
      });

      const rzpData = await rzpRes.json();
      console.log("[Razorpay] Subscription response:", JSON.stringify(rzpData));

      if (rzpData.id) {
        return jsonResponse({
          success: true,
          subscriptionId: rzpData.id,
          status: rzpData.status,
          shortUrl: rzpData.short_url,
          keyId: RAZORPAY_KEY_ID,
        });
      }

      return jsonResponse({
        success: false,
        error: rzpData.error?.description || "Razorpay subscription creation failed",
        details: rzpData,
      }, 400);
    }

    // ===== CREATE RAZORPAY ORDER (legacy/one-time) =====
    if (path === "create-order" || path === "razorpay-payment") {
      const { amount, currency, receipt, notes } = body;

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return jsonResponse({ error: "amount must be a positive number" }, 400);
      }

      const orderPayload = {
        amount: Math.round(numericAmount * 100),
        currency: currency || "INR",
        receipt: receipt || `rcpt_${Date.now()}`,
        notes: notes || {},
      };

      console.log("[Razorpay] Creating order:", JSON.stringify(orderPayload));

      const rzpRes = await fetch(`${RAZORPAY_API_BASE}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: getAuthHeader(),
        },
        body: JSON.stringify(orderPayload),
      });

      const rzpData = await rzpRes.json();
      console.log("[Razorpay] Order response:", JSON.stringify(rzpData));

      if (rzpData.id) {
        return jsonResponse({
          success: true,
          orderId: rzpData.id,
          amount: rzpData.amount,
          currency: rzpData.currency,
          keyId: RAZORPAY_KEY_ID,
        });
      }

      return jsonResponse({
        success: false,
        error: rzpData.error?.description || "Razorpay order creation failed",
        details: rzpData,
      }, 400);
    }

    // ===== VERIFY PAYMENT SIGNATURE =====
    if (path === "verify-payment") {
      const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature,
              razorpay_order_id } = body;

      // Subscription flow: subscription_id|payment_id
      // Order flow: order_id|payment_id
      const entityId = razorpay_subscription_id || razorpay_order_id;

      if (!entityId || !razorpay_payment_id || !razorpay_signature) {
        return jsonResponse({ error: "All payment fields are required" }, 400);
      }

      const message = `${entityId}|${razorpay_payment_id}`;
      const isValid = await verifySignature(message, razorpay_signature);

      console.log("[Razorpay] Signature verification:", { isValid, razorpay_payment_id, entityId });

      if (!isValid) {
        return jsonResponse({ success: false, error: "Payment signature verification failed" }, 400);
      }

      return jsonResponse({
        success: true,
        verified: true,
        paymentId: razorpay_payment_id,
        subscriptionId: razorpay_subscription_id || null,
        orderId: razorpay_order_id || null,
      });
    }

    // ===== CONFIRM ORDER (after payment verified — supports both subscription & order flows) =====
    if (path === "confirm-order") {
      const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature,
              razorpay_order_id, orderData } = body;

      const entityId = razorpay_subscription_id || razorpay_order_id;

      if (!entityId || !razorpay_payment_id || !razorpay_signature || !orderData) {
        return jsonResponse({ error: "All fields are required" }, 400);
      }

      // Step 1: Verify signature
      const message = `${entityId}|${razorpay_payment_id}`;
      const isValid = await verifySignature(message, razorpay_signature);

      if (!isValid) {
        return jsonResponse({ success: false, error: "Payment verification failed. Signature mismatch." }, 400);
      }

      // Step 2: Double-check payment status with Razorpay API
      const paymentRes = await fetch(`${RAZORPAY_API_BASE}/payments/${razorpay_payment_id}`, {
        headers: { Authorization: getAuthHeader() },
      });
      const paymentData = await paymentRes.json();

      if (paymentData.status !== "captured" && paymentData.status !== "authorized") {
        return jsonResponse({
          success: false,
          error: `Payment not completed. Status: ${paymentData.status}`,
        }, 400);
      }

      // Step 3: Create order using service role
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      if (userId && orderData.customer_id && orderData.customer_id !== userId) {
        return jsonResponse({ success: false, error: "Unauthorized customer_id mismatch" }, 403);
      }

      const safeOrderData = {
        ...orderData,
        customer_id: userId ?? orderData.customer_id,
      };

      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .insert(safeOrderData)
        .select("id, order_number")
        .single();

      if (orderError) {
        console.error("[Razorpay] Order creation error:", orderError);
        return jsonResponse({ success: false, error: orderError.message }, 500);
      }

      // Step 4: Create payment record
      await adminClient.from("payments").insert({
        order_id: order.id,
        amount: safeOrderData.payable_now_total,
        payment_method: "razorpay",
        status: "completed",
        payment_gateway: "razorpay",
        transaction_id: razorpay_payment_id,
        payment_date: new Date().toISOString(),
        metadata: {
          razorpay_subscription_id: razorpay_subscription_id || null,
          razorpay_order_id: razorpay_order_id || null,
          razorpay_payment_id,
          razorpay_signature,
        },
      });

      return jsonResponse({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
      });
    }

    // ===== WEBHOOK =====
    if (path === "webhook") {
      const event = body.event;
      const payload = body.payload;

      console.log("[Razorpay Webhook]", { event });

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Payment captured
      if (event === "payment.captured" && payload?.payment?.entity) {
        const payment = payload.payment.entity;
        const rzpPaymentId = payment.id;

        const { data: existingPayment } = await adminClient
          .from("payments")
          .select("id, order_id")
          .eq("transaction_id", rzpPaymentId)
          .maybeSingle();

        if (existingPayment) {
          await adminClient
            .from("payments")
            .update({ status: "completed", payment_date: new Date().toISOString() })
            .eq("id", existingPayment.id);

          await adminClient
            .from("orders")
            .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
            .eq("id", existingPayment.order_id);
        }
      }

      // Payment failed
      if (event === "payment.failed" && payload?.payment?.entity) {
        const payment = payload.payment.entity;
        const rzpPaymentId = payment.id;

        const { data: existingPayment } = await adminClient
          .from("payments")
          .select("id")
          .eq("transaction_id", rzpPaymentId)
          .maybeSingle();

        if (existingPayment) {
          await adminClient
            .from("payments")
            .update({ status: "failed" })
            .eq("id", existingPayment.id);
        }
      }

      // Subscription authenticated (first payment authorized)
      if (event === "subscription.authenticated" && payload?.subscription?.entity) {
        console.log("[Razorpay Webhook] Subscription authenticated:", payload.subscription.entity.id);
      }

      // Subscription activated
      if (event === "subscription.activated" && payload?.subscription?.entity) {
        console.log("[Razorpay Webhook] Subscription activated:", payload.subscription.entity.id);
      }

      // Subscription charged (recurring payment success)
      if (event === "subscription.charged" && payload?.subscription?.entity) {
        const sub = payload.subscription.entity;
        const paymentEntity = payload.payment?.entity;
        console.log("[Razorpay Webhook] Subscription charged:", sub.id, paymentEntity?.id);

        // Find order by subscription ID in payment metadata
        if (paymentEntity?.id) {
          const { data: existingPayment } = await adminClient
            .from("payments")
            .select("id, order_id, metadata")
            .eq("metadata->>razorpay_subscription_id", sub.id)
            .limit(1)
            .maybeSingle();

          if (existingPayment) {
            // Record the recurring payment in monthly_payments
            await adminClient.from("monthly_payments").insert({
              order_id: existingPayment.order_id,
              billing_month: new Date().toISOString().slice(0, 10),
              monthly_rent: (paymentEntity.amount || 0) / 100,
              gst: 0,
              total_amount: (paymentEntity.amount || 0) / 100,
              status: "completed",
              paid_at: new Date().toISOString(),
              transaction_id: paymentEntity.id,
            });
          }
        }
      }

      // Subscription cancelled
      if (event === "subscription.cancelled" && payload?.subscription?.entity) {
        console.log("[Razorpay Webhook] Subscription cancelled:", payload.subscription.entity.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return jsonResponse({ error: "Unknown endpoint" }, 404);
  } catch (error) {
    console.error("[Razorpay Error]", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
