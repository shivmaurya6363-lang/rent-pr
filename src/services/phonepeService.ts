/**
 * PhonePe Payment Gateway - Live Integration
 * 
 * Calls the backend edge function for secure payment processing.
 * Supports one-time payments and autopay subscription setup.
 */

import { supabase } from "@/integrations/supabase/client";

export interface PhonePePaymentRequest {
  orderId: string;
  amount: number; // in rupees
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  redirectUrl: string;
}

export interface PhonePePaymentResponse {
  success: boolean;
  transactionId?: string;
  redirectUrl?: string;
  error?: string;
}

export interface AutopaySetupRequest {
  orderId: string;
  subscriptionName?: string;
  monthlyAmount: number; // in rupees
  customerPhone: string;
  maxCycles?: number;
  startDate?: string;
  redirectUrl: string;
}

export interface AutopaySetupResponse {
  success: boolean;
  subscriptionId?: string;
  redirectUrl?: string;
  error?: string;
}

/**
 * Initiate a one-time PhonePe payment (security deposit + delivery + installation)
 */
export async function initiatePhonePePayment(
  request: PhonePePaymentRequest
): Promise<PhonePePaymentResponse> {
  console.log("[PhonePe] Initiating payment:", request);

  try {
    const { data, error } = await supabase.functions.invoke("phonepe-payment", {
      body: {
        ...request,
      },
    });

    if (error) {
      console.error("[PhonePe] Edge function error:", error);
      return { success: false, error: error.message || "Payment initiation failed" };
    }

    return {
      success: data.success,
      transactionId: data.transactionId,
      redirectUrl: data.redirectUrl,
      error: data.error,
    };
  } catch (err: any) {
    console.error("[PhonePe] Network error:", err);
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Setup autopay subscription for monthly rent payments
 * Called after the initial one-time payment succeeds
 */
export async function setupAutopaySubscription(
  request: AutopaySetupRequest
): Promise<AutopaySetupResponse> {
  console.log("[PhonePe] Setting up autopay:", request);

  try {
    const { data, error } = await supabase.functions.invoke("phonepe-payment/setup-autopay", {
      body: {
        ...request,
      },
    });

    if (error) {
      console.error("[PhonePe] Autopay setup error:", error);
      return { success: false, error: error.message || "Autopay setup failed" };
    }

    return {
      success: data.success,
      subscriptionId: data.subscriptionId,
      redirectUrl: data.redirectUrl,
      error: data.error,
    };
  } catch (err: any) {
    console.error("[PhonePe] Autopay network error:", err);
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Verify PhonePe payment status
 */
export async function verifyPhonePePayment(
  transactionId: string
): Promise<{ verified: boolean; status: string }> {
  console.log("[PhonePe] Verifying payment:", transactionId);

  try {
    const { data, error } = await supabase.functions.invoke("phonepe-payment/status", {
      body: { transactionId },
    });

    if (error) {
      console.error("[PhonePe] Verification error:", error);
      return { verified: false, status: "ERROR" };
    }

    return {
      verified: data.verified,
      status: data.status,
    };
  } catch (err: any) {
    console.error("[PhonePe] Verify network error:", err);
    return { verified: false, status: "ERROR" };
  }
}
