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

async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(payload: string, signature: string): Promise<boolean> {
  const expected = await computeHmacSha256(RAZORPAY_KEY_SECRET, payload);
  return expected === signature;
}

// Verify Razorpay webhook X-Razorpay-Signature header
async function verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || RAZORPAY_KEY_SECRET;
  const expected = await computeHmacSha256(webhookSecret, rawBody);
  return expected === signature;
}

// Endpoints that do NOT require a user JWT
const PUBLIC_PATHS = new Set(["webhook"]);

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized: missing bearer token" }, 401);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "Supabase auth secrets are not configured" }, 500);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "").trim();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return jsonResponse({ error: "Unauthorized: invalid or expired token" }, 401);
  }
  return { userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return jsonResponse({ error: "Razorpay credentials are not configured" }, 500);
    }

    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const path = segments[segments.length - 1] ?? "";

    // ===== AUTH =====
    let userId: string | null = null;
    if (!PUBLIC_PATHS.has(path)) {
      const authResult = await authenticate(req);
      if (authResult instanceof Response) return authResult;
      userId = authResult.userId;
    }

    // For webhook we need the raw body for signature verification
    let rawBody = "";
    let body: Record<string, unknown> = {};

    if (path === "webhook") {
      rawBody = await req.text();
      try { body = JSON.parse(rawBody); } catch { body = {}; }
    } else {
      body = await req.json();
    }

    // ===== CREATE RAZORPAY PLAN =====
    if (path === "create-plan") {
      const { period, interval, item } = body as any;

      if (!period || !interval || !item?.name || !item?.amount) {
        return jsonResponse({ error: "period, interval, and item (name, amount) are required" }, 400);
      }

      const planPayload = {
        period,
        interval: Number(interval),
        item: {
          name: item.name,
          amount: Math.round(Number(item.amount) * 100), // rupees → paise
          currency: item.currency || "INR",
          description: item.description || "",
        },
        notes: (body as any).notes || {},
      };

      console.log("[Razorpay] Creating plan:", JSON.stringify(planPayload));

      const rzpRes = await fetch(`${RAZORPAY_API_BASE}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: getAuthHeader() },
        body: JSON.stringify(planPayload),
      });
      const rzpData = await rzpRes.json();

      if (rzpData.id) {
        return jsonResponse({ success: true, planId: rzpData.id, period: rzpData.period, interval: rzpData.interval, item: rzpData.item });
      }
      return jsonResponse({ success: false, error: rzpData.error?.description || "Plan creation failed", details: rzpData }, 400);
    }

    // ===== CREATE RAZORPAY SUBSCRIPTION =====
    if (path === "create-subscription") {
      const { plan_id, total_count, quantity, notes, customer_notify, upfront_amount } = body as any;

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
        headers: { "Content-Type": "application/json", Authorization: getAuthHeader() },
        body: JSON.stringify(subscriptionPayload),
      });
      const rzpData = await rzpRes.json();

      if (rzpData.id) {
        return jsonResponse({
          success: true,
          subscriptionId: rzpData.id,
          status: rzpData.status,
          shortUrl: rzpData.short_url,
          keyId: RAZORPAY_KEY_ID,
        });
      }
      return jsonResponse({ success: false, error: rzpData.error?.description || "Subscription creation failed", details: rzpData }, 400);
    }

    // ===== CREATE RAZORPAY ORDER (one-time payment) =====
    if (path === "create-order" || path === "razorpay-payment") {
      const { amount, currency, receipt, notes } = body as any;

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

      const rzpRes = await fetch(`${RAZORPAY_API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: getAuthHeader() },
        body: JSON.stringify(orderPayload),
      });
      const rzpData = await rzpRes.json();

      if (rzpData.id) {
        return jsonResponse({ success: true, orderId: rzpData.id, amount: rzpData.amount, currency: rzpData.currency, keyId: RAZORPAY_KEY_ID });
      }
      return jsonResponse({ success: false, error: rzpData.error?.description || "Order creation failed", details: rzpData }, 400);
    }

    // ===== VERIFY PAYMENT SIGNATURE =====
    if (path === "verify-payment") {
      const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, razorpay_order_id } = body as any;
      const entityId = razorpay_subscription_id || razorpay_order_id;

      if (!entityId || !razorpay_payment_id || !razorpay_signature) {
        return jsonResponse({ error: "All payment fields are required" }, 400);
      }

      const isValid = await verifySignature(`${entityId}|${razorpay_payment_id}`, razorpay_signature);
      if (!isValid) {
        return jsonResponse({ success: false, error: "Payment signature verification failed" }, 400);
      }

      return jsonResponse({ success: true, verified: true, paymentId: razorpay_payment_id });
    }

    // ===== CONFIRM ORDER (subscription or one-time) =====
    if (path === "confirm-order") {
      const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, razorpay_order_id, orderData } = body as any;
      const entityId = razorpay_subscription_id || razorpay_order_id;

      if (!entityId || !razorpay_payment_id || !razorpay_signature || !orderData) {
        return jsonResponse({ error: "All fields are required" }, 400);
      }

      // Step 1: Verify signature
      const isValid = await verifySignature(`${entityId}|${razorpay_payment_id}`, razorpay_signature);
      if (!isValid) {
        return jsonResponse({ success: false, error: "Payment verification failed. Signature mismatch." }, 400);
      }

      // Step 2: Confirm payment status with Razorpay API
      const paymentRes = await fetch(`${RAZORPAY_API_BASE}/payments/${razorpay_payment_id}`, {
        headers: { Authorization: getAuthHeader() },
      });
      const paymentData = await paymentRes.json();

      if (paymentData.status !== "captured" && paymentData.status !== "authorized") {
        return jsonResponse({ success: false, error: `Payment not completed. Status: ${paymentData.status}` }, 400);
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Validate customer_id matches the authenticated user
      if (userId && orderData.customer_id && orderData.customer_id !== userId) {
        return jsonResponse({ success: false, error: "Unauthorized: customer_id mismatch" }, 403);
      }

      // Step 3: Idempotency — check if this payment was already processed
      const { data: existingPayment } = await adminClient
        .from("payments")
        .select("id, order_id")
        .eq("transaction_id", razorpay_payment_id)
        .maybeSingle();

      if (existingPayment?.order_id) {
        const { data: existingOrder } = await adminClient
          .from("orders")
          .select("id, order_number")
          .eq("id", existingPayment.order_id)
          .maybeSingle();
        if (existingOrder) {
          return jsonResponse({ success: true, orderId: existingOrder.id, orderNumber: existingOrder.order_number });
        }
      }

      // Step 4: Resolve product / vendor / rental-plan IDs when the product
      //   wasn't already in the DB (comes from static frontend data).
      //   We use service-role here so we can insert regardless of RLS.
      const { _productSetup, ...restOrderData } = orderData as any;

      let resolvedVendorId   = restOrderData.vendor_id;
      let resolvedProductId  = restOrderData.product_id;
      let resolvedPlanId     = restOrderData.rental_plan_id;

      if (_productSetup) {
        // --- Find or create vendor ---
        // Prefer any existing approved vendor; never use the customer as vendor
        let { data: vendor } = await adminClient
          .from("vendors")
          .select("id")
          .eq("status", "approved")
          .limit(1)
          .maybeSingle();

        if (!vendor) {
          // No approved vendor yet — create a "Platform Vendor" placeholder
          // Use a fixed well-known email so it's idempotent across checkouts
          const { data: existingPlatform } = await adminClient
            .from("vendors")
            .select("id")
            .eq("business_email", "platform@rentpr.in")
            .maybeSingle();

          if (existingPlatform) {
            vendor = existingPlatform;
          } else {
            // Need a real auth user for user_id — use the customer's id as owner
            // but mark clearly as a platform/system vendor
            const { data: newVendor, error: vendorErr } = await adminClient
              .from("vendors")
              .insert({
                user_id: userId ?? restOrderData.customer_id,
                business_name: "RentPR Platform",
                business_email: "platform@rentpr.in",
                status: "approved",
                commission_rate: 0,
              })
              .select("id")
              .single();
            if (vendorErr) {
              console.error("[Razorpay] Vendor creation error:", vendorErr);
              return jsonResponse({ success: false, error: "Could not resolve vendor: " + vendorErr.message }, 500);
            }
            vendor = newVendor;
          }
        }
        resolvedVendorId = vendor.id;

        // --- Find or create product ---
        let { data: product } = await adminClient
          .from("products")
          .select("id")
          .eq("slug", _productSetup.slug)
          .maybeSingle();

        if (!product) {
          const { data: newProduct, error: productErr } = await adminClient
            .from("products")
            .insert({
              vendor_id: resolvedVendorId,
              name: _productSetup.name,
              slug: _productSetup.slug,
              brand: _productSetup.brand,
              description: _productSetup.description,
              features: _productSetup.features,
              images: _productSetup.images,
              specifications: _productSetup.specifications,
              tags: _productSetup.tags,
              rating: _productSetup.rating,
              review_count: _productSetup.review_count,
              in_stock: _productSetup.in_stock,
              stock_quantity: 10,
              status: "approved",
            })
            .select("id")
            .single();
          if (productErr) {
            console.error("[Razorpay] Product creation error:", productErr);
            return jsonResponse({ success: false, error: "Could not resolve product: " + productErr.message }, 500);
          }
          product = newProduct;
        }
        resolvedProductId = product.id;

        // --- Find or create rental plan ---
        let { data: plan } = await adminClient
          .from("rental_plans")
          .select("id")
          .eq("product_id", resolvedProductId)
          .eq("duration_months", _productSetup.plan.duration_months)
          .maybeSingle();

        if (!plan) {
          const { data: newPlan, error: planErr } = await adminClient
            .from("rental_plans")
            .insert({
              product_id: resolvedProductId,
              duration_months: _productSetup.plan.duration_months,
              monthly_rent: _productSetup.plan.monthly_rent,
              security_deposit: _productSetup.plan.security_deposit,
              label: _productSetup.plan.label,
              delivery_fee: _productSetup.plan.delivery_fee,
              installation_fee: _productSetup.plan.installation_fee,
              is_active: true,
            })
            .select("id")
            .single();
          if (planErr) {
            console.error("[Razorpay] Plan creation error:", planErr);
            return jsonResponse({ success: false, error: "Could not resolve rental plan: " + planErr.message }, 500);
          }
          plan = newPlan;
        }
        resolvedPlanId = plan.id;
      }

      // Build clean order row (strip _productSetup, fill resolved IDs)
      const safeOrderData = {
        ...restOrderData,
        customer_id: userId ?? restOrderData.customer_id,
        vendor_id: resolvedVendorId,
        product_id: resolvedProductId,
        rental_plan_id: resolvedPlanId,
        status: "confirmed",
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

      // Step 5: Create payment record
      await adminClient.from("payments").insert({
        order_id: order.id,
        amount: safeOrderData.payable_now_total,
        payment_method: "razorpay",
        payment_gateway: "razorpay",
        transaction_id: razorpay_payment_id,
        status: "completed",          // column is 'status', typed payment_status enum
        payment_date: new Date().toISOString(),
        metadata: {
          razorpay_subscription_id: razorpay_subscription_id || null,
          razorpay_order_id: razorpay_order_id || null,
          razorpay_payment_id,
          razorpay_signature,
        },
      });

      return jsonResponse({ success: true, orderId: order.id, orderNumber: order.order_number });
    }

    // ===== WEBHOOK =====
    if (path === "webhook") {
      // Verify webhook signature before processing
      const webhookSig = req.headers.get("X-Razorpay-Signature") || "";
      if (webhookSig) {
        const isValid = await verifyWebhookSignature(rawBody, webhookSig);
        if (!isValid) {
          console.error("[Razorpay Webhook] Signature verification failed");
          return jsonResponse({ error: "Webhook signature verification failed" }, 400);
        }
      }

      const event = (body as any).event;
      const payload = (body as any).payload;

      console.log("[Razorpay Webhook]", { event });

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Payment captured (one-time order)
      if (event === "payment.captured" && payload?.payment?.entity) {
        const payment = payload.payment.entity;

        const { data: existingPayment } = await adminClient
          .from("payments")
          .select("id, order_id")
          .eq("transaction_id", payment.id)
          .maybeSingle();

        if (existingPayment) {
          await adminClient
            .from("payments")
            .update({ status: "completed", payment_date: new Date().toISOString() })
            .eq("id", existingPayment.id);

          await adminClient
            .from("orders")
            .update({ status: "confirmed" })
            .eq("id", existingPayment.order_id);
        }
      }

      // Payment failed
      if (event === "payment.failed" && payload?.payment?.entity) {
        const payment = payload.payment.entity;

        const { data: existingPayment } = await adminClient
          .from("payments")
          .select("id")
          .eq("transaction_id", payment.id)
          .maybeSingle();

        if (existingPayment) {
          await adminClient
            .from("payments")
            .update({ status: "failed" })
            .eq("id", existingPayment.id);
        }
      }

      // Subscription activated (mandate registered, ready to charge)
      if (event === "subscription.activated" && payload?.subscription?.entity) {
        const sub = payload.subscription.entity;
        console.log("[Razorpay Webhook] Subscription activated:", sub.id);

        // Ensure the order is confirmed once mandate is active
        const { data: existingPayment } = await adminClient
          .from("payments")
          .select("order_id")
          .eq("metadata->>razorpay_subscription_id", sub.id)
          .maybeSingle();

        if (existingPayment?.order_id) {
          await adminClient
            .from("orders")
            .update({ status: "confirmed" })
            .eq("id", existingPayment.order_id);
        }
      }

      // Subscription charged (recurring monthly debit succeeded)
      if (event === "subscription.charged" && payload?.subscription?.entity) {
        const sub = payload.subscription.entity;
        const paymentEntity = payload.payment?.entity;
        console.log("[Razorpay Webhook] Subscription charged:", sub.id, paymentEntity?.id);

        if (paymentEntity?.id) {
          // Find the original order via the subscription_id stored in payment metadata
          const { data: originalPayment } = await adminClient
            .from("payments")
            .select("id, order_id")
            .eq("metadata->>razorpay_subscription_id", sub.id)
            .maybeSingle();

          if (originalPayment?.order_id) {
            // Get order details for monthly amount
            const { data: order } = await adminClient
              .from("orders")
              .select("monthly_rent, monthly_gst, protection_plan_fee, monthly_total")
              .eq("id", originalPayment.order_id)
              .maybeSingle();

            // Record recurring monthly payment in the payments table
            const { data: existingRecurring } = await adminClient
              .from("payments")
              .select("id")
              .eq("transaction_id", paymentEntity.id)
              .maybeSingle();

            if (!existingRecurring) {
              const totalAmount = (paymentEntity.amount || 0) / 100;
              const monthlyRent = order?.monthly_rent ?? 0;
              const monthlyGst = order?.monthly_gst ?? 0;
              const protectionFee = order?.protection_plan_fee ?? 0;

              // Record in monthly_payments (subscription-based recurring charges)
              await adminClient.from("monthly_payments").insert({
                order_id: originalPayment.order_id,
                billing_month: new Date().toISOString().slice(0, 10), // DATE format YYYY-MM-DD
                monthly_rent: monthlyRent,
                gst: monthlyGst,
                protection_plan_fee: protectionFee,
                total_amount: totalAmount,
                status: "completed",
                paid_at: new Date().toISOString(),
                transaction_id: paymentEntity.id,
              });
            }
          }
        }
      }

      // Subscription cancelled
      if (event === "subscription.cancelled" && payload?.subscription?.entity) {
        const sub = payload.subscription.entity;
        console.log("[Razorpay Webhook] Subscription cancelled:", sub.id);

        const { data: originalPayment } = await adminClient
          .from("payments")
          .select("order_id")
          .eq("metadata->>razorpay_subscription_id", sub.id)
          .maybeSingle();

        if (originalPayment?.order_id) {
          await adminClient
            .from("orders")
            .update({ status: "cancelled" })
            .eq("id", originalPayment.order_id);
        }
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown endpoint" }, 404);
  } catch (error: any) {
    console.error("[Razorpay Error]", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
