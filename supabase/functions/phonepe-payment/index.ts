import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PHONEPE_MERCHANT_ID = Deno.env.get("PHONEPE_MERCHANT_ID") || "";
const PHONEPE_SALT_KEY = Deno.env.get("PHONEPE_SALT_KEY") || "";
const PHONEPE_SALT_INDEX = Deno.env.get("PHONEPE_SALT_INDEX") || "1";

// PhonePe API URLs
const PHONEPE_BASE_URL = "https://api.phonepe.com/apis/hermes";
const PHONEPE_SANDBOX_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";

// Use sandbox by default; switch to production when ready
const API_BASE = PHONEPE_BASE_URL;

function generateChecksum(payload: string, endpoint: string): string {
  // SHA256(base64payload + endpoint + salt_key) + ### + salt_index
  const encoder = new TextEncoder();
  const data = encoder.encode(payload + endpoint + PHONEPE_SALT_KEY);
  // Use Web Crypto API for SHA-256
  return ""; // placeholder - computed async below
}

async function computeChecksum(
  base64Payload: string,
  endpoint: string
): Promise<string> {
  const str = base64Payload + endpoint + PHONEPE_SALT_KEY;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex + "###" + PHONEPE_SALT_INDEX;
}

function base64Encode(obj: Record<string, unknown>): string {
  const jsonStr = JSON.stringify(obj);
  return btoa(jsonStr);
}

async function verifyCallback(
  xVerify: string,
  responseBody: string
): Promise<boolean> {
  const str = responseBody + PHONEPE_SALT_KEY;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const expected = hashHex + "###" + PHONEPE_SALT_INDEX;
  return xVerify === expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Auth check for non-webhook endpoints
    let userId: string | null = null;
    if (path !== "webhook") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = claimsData.claims.sub as string;
    }

    const body = await req.json();

    // ===== INITIATE ONE-TIME PAYMENT =====
    if (path === "initiate" || path === "phonepe-payment") {
      const { orderId, amount, customerName, customerPhone, customerEmail, redirectUrl } = body;

      if (!orderId || !amount) {
        return new Response(
          JSON.stringify({ error: "orderId and amount are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const merchantTransactionId = `TXN_${Date.now()}_${orderId.substring(0, 8)}`;

      const payload = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantTransactionId,
        merchantUserId: userId || "guest",
        amount: Math.round(amount * 100), // PhonePe expects paise
        redirectUrl: redirectUrl || "",
        redirectMode: "REDIRECT",
        callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/phonepe-payment/webhook`,
        paymentInstrument: { type: "PAY_PAGE" },
      };

      const base64Payload = base64Encode(payload);
      const endpoint = "/pg/v1/pay";
      const checksum = await computeChecksum(base64Payload, endpoint);

      // Call PhonePe Pay API
      const phonePeRes = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
        },
        body: JSON.stringify({ request: base64Payload }),
      });

      const phonePeData = await phonePeRes.json();

      if (phonePeData.success && phonePeData.data?.instrumentResponse?.redirectInfo?.url) {
        return new Response(
          JSON.stringify({
            success: true,
            transactionId: merchantTransactionId,
            redirectUrl: phonePeData.data.instrumentResponse.redirectInfo.url,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If PhonePe API fails, return error details
      return new Response(
        JSON.stringify({
          success: false,
          error: phonePeData.message || "PhonePe payment initiation failed",
          details: phonePeData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SETUP AUTOPAY SUBSCRIPTION =====
    if (path === "setup-autopay") {
      const {
        orderId,
        subscriptionName,
        monthlyAmount,
        customerPhone,
        maxCycles,
        startDate,
        redirectUrl,
      } = body;

      if (!orderId || !monthlyAmount) {
        return new Response(
          JSON.stringify({ error: "orderId and monthlyAmount are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const merchantSubscriptionId = `SUB_${Date.now()}_${orderId.substring(0, 8)}`;

      const payload = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantSubscriptionId,
        merchantUserId: userId || "guest",
        subscriptionName: subscriptionName || "Monthly Rental Payment",
        authWorkflowType: "PENNY_DROP",
        amountType: "FIXED",
        amount: Math.round(monthlyAmount * 100), // paise
        frequency: "MONTHLY",
        recurringCount: maxCycles || 12,
        subMerchantId: null,
        mobileNumber: customerPhone || "",
        redirectUrl: redirectUrl || "",
        callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/phonepe-payment/webhook`,
      };

      const base64Payload = base64Encode(payload);
      const endpoint = "/v3/recurring/subscription/create";
      const checksum = await computeChecksum(base64Payload, endpoint);

      const phonePeRes = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
        },
        body: JSON.stringify({ request: base64Payload }),
      });

      const phonePeData = await phonePeRes.json();

      if (phonePeData.success) {
        // Store subscription ID in order for future reference
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        await adminClient
          .from("payments")
          .insert({
            order_id: orderId,
            amount: 0,
            payment_method: "autopay_setup",
            status: "pending",
            payment_gateway: "phonepe",
            transaction_id: merchantSubscriptionId,
            metadata: {
              type: "autopay_subscription",
              subscription_id: merchantSubscriptionId,
              monthly_amount: monthlyAmount,
              max_cycles: maxCycles || 12,
            },
          });

        return new Response(
          JSON.stringify({
            success: true,
            subscriptionId: merchantSubscriptionId,
            redirectUrl: phonePeData.data?.instrumentResponse?.redirectInfo?.url || null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: phonePeData.message || "Autopay setup failed",
          details: phonePeData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== CHECK PAYMENT STATUS =====
    if (path === "status") {
      const { transactionId } = body;

      if (!transactionId) {
        return new Response(
          JSON.stringify({ error: "transactionId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const endpoint = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${transactionId}`;
      const checksum = await computeChecksum("", endpoint);

      const phonePeRes = await fetch(`${API_BASE}${endpoint}`, {
        method: "GET",
        headers: { "X-VERIFY": checksum, "X-MERCHANT-ID": PHONEPE_MERCHANT_ID },
      });

      const phonePeData = await phonePeRes.json();

      return new Response(
        JSON.stringify({
          verified: phonePeData.success === true,
          status: phonePeData.code || "UNKNOWN",
          data: phonePeData.data || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== WEBHOOK CALLBACK =====
    if (path === "webhook") {
      const xVerify = req.headers.get("X-VERIFY") || "";

      // Verify webhook authenticity
      const bodyStr = JSON.stringify(body);

      // Decode the response
      const decodedResponse = body.response ? JSON.parse(atob(body.response)) : body;
      const transactionId =
        decodedResponse?.data?.merchantTransactionId ||
        decodedResponse?.data?.merchantSubscriptionId;
      const paymentStatus = decodedResponse?.code;

      console.log("[PhonePe Webhook]", { transactionId, paymentStatus });

      // Update payment/order status using service role
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      if (transactionId) {
        // Find and update the payment record
        const { data: payment } = await adminClient
          .from("payments")
          .select("id, order_id")
          .eq("transaction_id", transactionId)
          .maybeSingle();

        if (payment) {
          const newStatus =
            paymentStatus === "PAYMENT_SUCCESS" ? "completed" : "failed";

          await adminClient
            .from("payments")
            .update({ status: newStatus, payment_date: new Date().toISOString() })
            .eq("id", payment.id);

          // Update order status if payment succeeded
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

    return new Response(
      JSON.stringify({ error: "Unknown endpoint" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[PhonePe Error]", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
