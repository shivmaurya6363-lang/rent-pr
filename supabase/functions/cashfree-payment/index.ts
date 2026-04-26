import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CASHFREE_APP_ID = Deno.env.get("CASHFREE_APP_ID") || "";
const CASHFREE_SECRET_KEY = Deno.env.get("CASHFREE_SECRET_KEY") || "";

// Cashfree API URLs
const CASHFREE_PROD_URL = "https://api.cashfree.com/pg";
const CASHFREE_SANDBOX_URL = "https://sandbox.cashfree.com/pg";

// Now using PRODUCTION URL
const API_BASE = CASHFREE_PROD_URL;
const API_VERSION = "2023-08-01";

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Auth check for non-webhook endpoints
    let userId: string | null = null;
    if (path !== "webhook") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      userId = claimsData.claims.sub as string;
    }

    const body = await req.json();

    // ===== CREATE ORDER (Initiate Payment) =====
    if (path === "initiate" || path === "cashfree-payment") {
      const { orderId, amount, customerName, customerPhone, customerEmail, redirectUrl } = body;

      if (!orderId || !amount) {
        return jsonResponse({ error: "orderId and amount are required" }, 400);
      }

      const cfOrderId = `CF_${Date.now()}_${orderId.substring(0, 8)}`;

      const orderPayload = {
        order_id: cfOrderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: userId || "guest",
          customer_name: customerName || "Customer",
          customer_email: customerEmail || "customer@example.com",
          customer_phone: customerPhone || "9999999999",
        },
        order_meta: {
          return_url: redirectUrl ? `${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}cf_order_id=${cfOrderId}` : "",
          notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/cashfree-payment/webhook`,
        },
      };

      console.log("[Cashfree] Creating order:", JSON.stringify(orderPayload));

      const cfRes = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": API_VERSION,
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
        },
        body: JSON.stringify(orderPayload),
      });

      const cfData = await cfRes.json();
      console.log("[Cashfree] Order response:", JSON.stringify(cfData));

      if (cfData.payment_session_id) {
        return jsonResponse({
          success: true,
          transactionId: cfOrderId,
          paymentSessionId: cfData.payment_session_id,
          cfOrderId: cfData.cf_order_id || cfOrderId,
          redirectUrl: cfData.payment_link || null,
        });
      }

      return jsonResponse({
        success: false,
        error: cfData.message || "Cashfree order creation failed",
        details: cfData,
      }, 400);
    }

    // ===== SETUP SUBSCRIPTION (Autopay) =====
    if (path === "setup-autopay") {
      const { orderId, subscriptionName, monthlyAmount, customerPhone, maxCycles, redirectUrl } = body;

      if (!orderId || !monthlyAmount) {
        return jsonResponse({ error: "orderId and monthlyAmount are required" }, 400);
      }

      const subscriptionId = `SUB_${Date.now()}_${orderId.substring(0, 8)}`;

      const subPayload = {
        subscription_id: subscriptionId,
        plan_id: subscriptionName || "monthly_rental",
        plan_name: subscriptionName || "Monthly Rental Payment",
        plan_type: "PERIODIC",
        plan_max_cycles: maxCycles || 12,
        plan_recurring_amount: monthlyAmount,
        plan_max_amount: monthlyAmount,
        plan_interval_type: "MONTH",
        plan_intervals: 1,
        customer_details: {
          customer_id: userId || "guest",
          customer_phone: customerPhone || "9999999999",
        },
        subscription_meta: {
          return_url: redirectUrl || "",
          notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/cashfree-payment/webhook`,
        },
      };

      const cfRes = await fetch(`${API_BASE}/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": API_VERSION,
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
        },
        body: JSON.stringify(subPayload),
      });

      const cfData = await cfRes.json();

      if (cfData.subscription_id || cfData.status === "INITIALIZED") {
        return jsonResponse({
          success: true,
          subscriptionId,
          redirectUrl: cfData.authorization_link || null,
        });
      }

      return jsonResponse({
        success: false,
        error: cfData.message || "Subscription setup failed",
        details: cfData,
      }, 400);
    }

    // ===== CHECK PAYMENT STATUS =====
    if (path === "status") {
      const { transactionId } = body;

      if (!transactionId) {
        return jsonResponse({ error: "transactionId is required" }, 400);
      }

      const cfRes = await fetch(`${API_BASE}/orders/${transactionId}`, {
        method: "GET",
        headers: {
          "x-api-version": API_VERSION,
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
        },
      });

      const cfData = await cfRes.json();

      return jsonResponse({
        verified: cfData.order_status === "PAID",
        status: cfData.order_status || "UNKNOWN",
        data: cfData,
      });
    }

    // ===== CONFIRM ORDER (after payment verified) =====
    if (path === "confirm-order") {
      const { transactionId, orderData } = body;

      if (!transactionId || !orderData) {
        return jsonResponse({ error: "transactionId and orderData are required" }, 400);
      }

      // Verify payment status with Cashfree first
      const cfRes = await fetch(`${API_BASE}/orders/${transactionId}`, {
        method: "GET",
        headers: {
          "x-api-version": API_VERSION,
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
        },
      });

      const cfData = await cfRes.json();
      console.log("[Cashfree] Payment verification for confirm:", JSON.stringify(cfData));

      if (cfData.order_status !== "PAID") {
        return jsonResponse({
          success: false,
          error: "Payment not verified. Order cannot be created.",
          paymentStatus: cfData.order_status,
        }, 400);
      }

      // Payment verified — create order using service role
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .insert(orderData)
        .select("id, order_number")
        .single();

      if (orderError) {
        console.error("[Cashfree] Order creation error:", orderError);
        return jsonResponse({ success: false, error: orderError.message }, 500);
      }

      // Create payment record as completed
      await adminClient.from("payments").insert({
        order_id: order.id,
        amount: orderData.payable_now_total,
        payment_method: "cashfree",
        status: "completed",
        payment_gateway: "cashfree",
        transaction_id: transactionId,
        payment_date: new Date().toISOString(),
      });

      return jsonResponse({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
      });
    }

    // ===== WEBHOOK CALLBACK =====
    if (path === "webhook") {
      const eventType = body.type || body.event;
      const orderData = body.data?.order || body.data;
      const paymentData = body.data?.payment || {};

      const transactionId = orderData?.order_id || paymentData?.cf_payment_id;
      const paymentStatus = orderData?.order_status || body.data?.payment_status;

      console.log("[Cashfree Webhook]", { eventType, transactionId, paymentStatus });

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      if (transactionId) {
        const { data: payment } = await adminClient
          .from("payments")
          .select("id, order_id")
          .eq("transaction_id", transactionId)
          .maybeSingle();

        if (payment) {
          const newStatus =
            paymentStatus === "PAID" || paymentStatus === "SUCCESS"
              ? "completed"
              : "failed";

          await adminClient
            .from("payments")
            .update({ status: newStatus, payment_date: new Date().toISOString() })
            .eq("id", payment.id);

          if (newStatus === "completed") {
            await adminClient
              .from("orders")
              .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
              .eq("id", payment.order_id);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return jsonResponse({ error: "Unknown endpoint" }, 404);
  } catch (error) {
    console.error("[Cashfree Error]", error);
    return jsonResponse({ error: error.message || "Internal server error" }, 500);
  }
});
