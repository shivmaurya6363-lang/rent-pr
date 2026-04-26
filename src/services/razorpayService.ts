/**
 * Razorpay Payment Gateway - Frontend Integration
 * 
 * Supports both Subscription flow (recurring) and Order flow (one-time).
 * Primary flow: Subscriptions API for rental payments.
 */

import { supabase } from "@/integrations/supabase/client";

// ===== Plan Types =====
export interface RazorpayPlanRequest {
  period: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  item: {
    name: string;
    amount: number; // in rupees
    currency?: string;
    description?: string;
  };
  notes?: Record<string, string>;
}

export interface RazorpayPlanResponse {
  success: boolean;
  planId?: string;
  error?: string;
}

// ===== Subscription Types =====
export interface RazorpaySubscriptionRequest {
  plan_id: string;
  total_count: number;
  quantity?: number;
  customer_notify?: number;
  upfront_amount?: number; // security deposit + fees in rupees
  notes?: Record<string, string>;
}

export interface RazorpaySubscriptionResponse {
  success: boolean;
  subscriptionId?: string;
  status?: string;
  shortUrl?: string;
  keyId?: string;
  error?: string;
}

// ===== Order Types (legacy/one-time) =====
export interface RazorpayOrderRequest {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  error?: string;
}

// ===== Payment Result =====
export interface RazorpayPaymentResult {
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
}

// ===== Confirm Order =====
export interface ConfirmOrderRequest {
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
  orderData: Record<string, unknown>;
}

export interface ConfirmOrderResponse {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

/**
 * Create a Razorpay Plan (for subscription-based billing)
 */
export async function createRazorpayPlan(
  request: RazorpayPlanRequest
): Promise<RazorpayPlanResponse> {
  console.log("[Razorpay] Creating plan:", request);

  try {
    const { data, error } = await supabase.functions.invoke("razorpay-payment/create-plan", {
      body: request,
    });

    if (error) {
      console.error("[Razorpay] Plan creation error:", error);
      return { success: false, error: error.message || "Plan creation failed" };
    }

    return {
      success: data.success,
      planId: data.planId,
      error: data.error,
    };
  } catch (err: any) {
    console.error("[Razorpay] Plan creation network error:", err);
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Create a Razorpay Subscription
 */
export async function createRazorpaySubscription(
  request: RazorpaySubscriptionRequest
): Promise<RazorpaySubscriptionResponse> {
  console.log("[Razorpay] Creating subscription:", request);

  try {
    const { data, error } = await supabase.functions.invoke("razorpay-payment/create-subscription", {
      body: request,
    });

    if (error) {
      console.error("[Razorpay] Subscription creation error:", error);
      return { success: false, error: error.message || "Subscription creation failed" };
    }

    return {
      success: data.success,
      subscriptionId: data.subscriptionId,
      status: data.status,
      shortUrl: data.shortUrl,
      keyId: data.keyId,
      error: data.error,
    };
  } catch (err: any) {
    console.error("[Razorpay] Subscription creation network error:", err);
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Create Razorpay order (legacy one-time payment)
 */
export async function createRazorpayOrder(
  request: RazorpayOrderRequest
): Promise<RazorpayOrderResponse> {
  console.log("[Razorpay] Creating order:", request);

  try {
    const { data, error } = await supabase.functions.invoke("razorpay-payment", {
      body: request,
    });

    if (error) {
      console.error("[Razorpay] Edge function error:", error);
      return { success: false, error: error.message || "Order creation failed" };
    }

    return {
      success: data.success,
      orderId: data.orderId,
      amount: data.amount,
      currency: data.currency,
      keyId: data.keyId,
      error: data.error,
    };
  } catch (err: any) {
    console.error("[Razorpay] Network error:", err);
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Load Razorpay Checkout script dynamically
 */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

/**
 * Open Razorpay Checkout for Subscription payment
 */
export async function openRazorpaySubscriptionCheckout(options: {
  subscriptionId: string;
  keyId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description?: string;
}): Promise<RazorpayPaymentResult> {
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: options.keyId,
      subscription_id: options.subscriptionId,
      name: "RentPR",
      description: options.description || "Rental Subscription",
      prefill: {
        name: options.customerName,
        email: options.customerEmail,
        contact: options.customerPhone,
      },
      theme: {
        color: "#6366f1",
      },
      handler: function (response: any) {
        console.log("[Razorpay] Subscription payment success:", response);
        resolve({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          razorpay_subscription_id: response.razorpay_subscription_id,
        });
      },
      modal: {
        ondismiss: function () {
          reject(new Error("Payment cancelled by user"));
        },
      },
    });

    rzp.on("payment.failed", function (response: any) {
      console.error("[Razorpay] Payment failed:", response.error);
      reject(new Error(response.error?.description || "Payment failed"));
    });

    rzp.open();
  });
}

/**
 * Open Razorpay Checkout for one-time Order payment (legacy)
 */
export async function openRazorpayCheckout(options: {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description?: string;
}): Promise<RazorpayPaymentResult> {
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: options.keyId,
      amount: options.amount,
      currency: options.currency,
      name: "RentPR",
      description: options.description || "Rental Payment",
      order_id: options.orderId,
      prefill: {
        name: options.customerName,
        email: options.customerEmail,
        contact: options.customerPhone,
      },
      theme: {
        color: "#6366f1",
      },
      handler: function (response: any) {
        console.log("[Razorpay] Payment success:", response);
        resolve({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          razorpay_order_id: response.razorpay_order_id,
        });
      },
      modal: {
        ondismiss: function () {
          reject(new Error("Payment cancelled by user"));
        },
      },
    });

    rzp.on("payment.failed", function (response: any) {
      console.error("[Razorpay] Payment failed:", response.error);
      reject(new Error(response.error?.description || "Payment failed"));
    });

    rzp.open();
  });
}

/**
 * Confirm order after payment (server-side verification + order creation)
 */
export async function confirmOrderAfterPayment(
  request: ConfirmOrderRequest
): Promise<ConfirmOrderResponse> {
  console.log("[Razorpay] Confirming order:", request.razorpay_payment_id);

  try {
    const { data, error } = await supabase.functions.invoke("razorpay-payment/confirm-order", {
      body: request,
    });

    if (error) {
      console.error("[Razorpay] Confirm order error:", error);
      return { success: false, error: error.message || "Order confirmation failed" };
    }

    return {
      success: data.success,
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      error: data.error,
    };
  } catch (err: any) {
    console.error("[Razorpay] Confirm order network error:", err);
    return { success: false, error: err.message || "Network error" };
  }
}
