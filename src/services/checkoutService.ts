import { supabase } from "@/integrations/supabase/client";
import { CartItem, CheckoutBreakdown, GST_RATE } from "@/types/product";
import {
  createRazorpayPlan,
  createRazorpaySubscription,
  openRazorpaySubscriptionCheckout,
  confirmOrderAfterPayment,
} from "@/services/razorpayService";

export interface CheckoutFormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: string;
}

export interface OrderResult {
  success: boolean;
  orderNumbers: string[];
  error?: string;
}

/**
 * Save or update the user's default delivery address.
 */
export async function saveAddress(
  userId: string,
  formData: CheckoutFormData
): Promise<{ addressId: string | null; error: string | null }> {
  try {
    const { data: existingAddress } = await supabase
      .from("addresses")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();

    if (existingAddress) {
      const { error } = await supabase
        .from("addresses")
        .update({
          full_name: formData.fullName,
          phone: formData.phone,
          address_line1: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        })
        .eq("id", existingAddress.id);
      if (error) throw error;
      return { addressId: existingAddress.id, error: null };
    } else {
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          user_id: userId,
          full_name: formData.fullName,
          phone: formData.phone,
          address_line1: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          is_default: true,
          label: "Home",
        })
        .select("id")
        .single();
      if (error) throw error;
      return { addressId: data.id, error: null };
    }
  } catch (error: any) {
    console.error("[Checkout] Error saving address:", error);
    return { addressId: null, error: error.message };
  }
}

interface ResolvedProduct {
  productId: string | null;
  vendorId: string | null;
  rentalPlanId: string | null;
  // Full product + plan payload forwarded to edge function when not in DB
  _productSetup: {
    slug: string;
    name: string;
    brand: string;
    description: string;
    features: string[];
    images: string[];
    specifications: Record<string, string>;
    tags: string[];
    rating: number;
    review_count: number;
    in_stock: boolean;
    plan: {
      duration_months: number;
      monthly_rent: number;
      security_deposit: number;
      label: string;
      delivery_fee: number;
      installation_fee: number;
    };
  } | null;
}

/**
 * Try to resolve product/vendor/rentalPlan IDs from the DB.
 * If the product doesn't exist yet (static demo data), return the full
 * product payload so the edge function can create it server-side with
 * service-role access (bypasses RLS).
 */
async function resolveProductIds(item: CartItem): Promise<ResolvedProduct> {
  // 1. Try to find existing product in DB
  const { data: product } = await supabase
    .from("products")
    .select("id, vendor_id")
    .eq("slug", item.product.slug)
    .maybeSingle();

  const planSetup = {
    duration_months: item.selectedPlan.duration,
    monthly_rent: item.selectedPlan.monthlyRent,
    security_deposit: item.selectedPlan.securityDeposit,
    label: item.selectedPlan.label,
    delivery_fee: item.product.deliveryFee,
    installation_fee: item.product.installationFee,
  };

  if (product) {
    // Product exists — try to find rental plan
    const { data: plan } = await supabase
      .from("rental_plans")
      .select("id")
      .eq("product_id", product.id)
      .eq("duration_months", item.selectedPlan.duration)
      .maybeSingle();

    if (plan) {
      // Everything resolved — no edge-function setup needed
      return {
        productId: product.id,
        vendorId: product.vendor_id,
        rentalPlanId: plan.id,
        _productSetup: null,
      };
    }

    // Product exists but plan is missing — let edge function create the plan
    return {
      productId: product.id,
      vendorId: product.vendor_id,
      rentalPlanId: null,
      _productSetup: {
        slug: item.product.slug,
        name: item.product.name,
        brand: item.product.brand || "",
        description: item.product.description || "",
        features: item.product.features || [],
        images: item.product.images || [],
        specifications: item.product.specifications || {},
        tags: item.product.tags || [],
        rating: item.product.rating,
        review_count: item.product.reviewCount,
        in_stock: item.product.inStock,
        plan: planSetup,
      },
    };
  }

  // Product not in DB — forward full data so edge function creates it
  return {
    productId: null,
    vendorId: null,
    rentalPlanId: null,
    _productSetup: {
      slug: item.product.slug,
      name: item.product.name,
      brand: item.product.brand || "",
      description: item.product.description || "",
      features: item.product.features || [],
      images: item.product.images || [],
      specifications: item.product.specifications || {},
      tags: item.product.tags || [],
      rating: item.product.rating,
      review_count: item.product.reviewCount,
      in_stock: item.product.inStock,
      plan: planSetup,
    },
  };
}

/**
 * Process a single cart item through the full Razorpay subscription flow.
 */
async function processCartItem(
  userId: string,
  item: CartItem,
  addressId: string,
  formData: CheckoutFormData,
  termsVersion: number | undefined,
  couponDiscount: number
): Promise<{ success: boolean; orderNumber?: string; error?: string }> {
  const monthlyRent = item.selectedPlan.monthlyRent;
  const gst = Math.round(monthlyRent * GST_RATE);
  const protectionFee = item.addProtectionPlan ? 99 : 0;
  const monthlyTotal = monthlyRent + gst + protectionFee;
  const commissionRate = 0.30;
  const platformCommission = Math.round(monthlyRent * commissionRate);
  const vendorPayout = monthlyRent - platformCommission;

  const resolved = await resolveProductIds(item);

  const payableNow = item.selectedPlan.securityDeposit + item.product.deliveryFee + item.product.installationFee;
  const upfrontAmount = Math.max(0, payableNow - couponDiscount);

  const effectiveMonthlyTotal =
    item.payAdvance && item.advanceDiscountPercent
      ? Math.round(monthlyTotal * (1 - item.advanceDiscountPercent / 100))
      : monthlyTotal;

  // Step 1: Create Razorpay Plan
  const planResult = await createRazorpayPlan({
    period: "monthly",
    interval: 1,
    item: {
      name: `${item.product.name} — ${item.selectedPlan.label} Rental`,
      amount: effectiveMonthlyTotal,
      currency: "INR",
      description: `Monthly rental for ${item.product.name} (${item.selectedPlan.duration} months)`,
    },
    notes: { productSlug: item.product.slug, userId },
  });

  if (!planResult.success || !planResult.planId) {
    return { success: false, error: planResult.error || `Failed to create payment plan for ${item.product.name}` };
  }

  // Step 2: Create Razorpay Subscription
  const subResult = await createRazorpaySubscription({
    plan_id: planResult.planId,
    total_count: item.selectedPlan.duration,
    quantity: item.quantity,
    upfront_amount: upfrontAmount,
    notes: { userId, productName: item.product.name },
  });

  if (!subResult.success || !subResult.subscriptionId || !subResult.keyId) {
    return { success: false, error: subResult.error || `Failed to create subscription for ${item.product.name}` };
  }

  // Step 3: Open Razorpay Checkout (UPI / QR / Card / Netbanking)
  const paymentResult = await openRazorpaySubscriptionCheckout({
    subscriptionId: subResult.subscriptionId,
    keyId: subResult.keyId,
    customerName: formData.fullName,
    customerEmail: formData.email,
    customerPhone: formData.phone,
    description: `${item.product.name} — Monthly Rental`,
  });

  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Build order data; include _productSetup when product isn't in DB yet
  // The edge function's confirm-order will create product/vendor/plan using
  // service-role access (bypasses RLS) before inserting the order row.
  const orderData: Record<string, unknown> = {
    order_number: orderNumber,
    customer_id: userId,
    // These will be null when product isn't in DB; edge function resolves them
    vendor_id: resolved.vendorId,
    product_id: resolved.productId,
    rental_plan_id: resolved.rentalPlanId,
    address_id: addressId,
    quantity: item.quantity,
    security_deposit: item.selectedPlan.securityDeposit,
    delivery_fee: item.product.deliveryFee,
    installation_fee: item.product.installationFee,
    payable_now_total: upfrontAmount,
    monthly_rent: monthlyRent,
    monthly_gst: gst,
    protection_plan_fee: protectionFee,
    monthly_total: effectiveMonthlyTotal,
    rental_duration_months: item.selectedPlan.duration,
    platform_commission: platformCommission,
    vendor_payout: vendorPayout,
    status: "pending",
    terms_accepted_at: termsVersion ? new Date().toISOString() : null,
    terms_version: termsVersion || null,
    // Forwarded to edge function for server-side product/vendor/plan creation
    _productSetup: resolved._productSetup,
  };

  // Step 4: Confirm order on backend
  const result = await confirmOrderAfterPayment({
    razorpay_subscription_id: paymentResult.razorpay_subscription_id,
    razorpay_payment_id: paymentResult.razorpay_payment_id,
    razorpay_signature: paymentResult.razorpay_signature,
    orderData,
  });

  if (result.success && result.orderNumber) {
    return { success: true, orderNumber: result.orderNumber };
  }
  return { success: false, error: result.error || "Order confirmation failed after payment" };
}

/**
 * Process checkout for all cart items via Razorpay subscriptions.
 */
export async function processCheckout(
  userId: string,
  items: CartItem[],
  breakdown: CheckoutBreakdown,
  formData: CheckoutFormData,
  termsVersion?: number,
  couponDiscount: number = 0
): Promise<OrderResult> {
  try {
    const { addressId, error: addressError } = await saveAddress(userId, formData);
    if (addressError || !addressId) {
      return { success: false, orderNumbers: [], error: addressError || "Failed to save address" };
    }

    const orderNumbers: string[] = [];
    const errors: string[] = [];
    const discountPerItem = items.length > 0 ? Math.floor(couponDiscount / items.length) : 0;

    for (const item of items) {
      const result = await processCartItem(userId, item, addressId, formData, termsVersion, discountPerItem);

      if (result.success && result.orderNumber) {
        orderNumbers.push(result.orderNumber);
      } else {
        const errMsg = result.error || "Unknown error";
        errors.push(errMsg);
        if (errMsg === "Payment cancelled by user") break;
      }
    }

    if (orderNumbers.length === 0) {
      const firstError = errors[0] || "Failed to create orders after payment";
      if (firstError === "Payment cancelled by user") throw new Error("Payment cancelled by user");
      return { success: false, orderNumbers: [], error: firstError };
    }

    return { success: true, orderNumbers };
  } catch (error: any) {
    console.error("[Checkout] Error:", error);
    if (error.message === "Payment cancelled by user") {
      return { success: false, orderNumbers: [], error: "Payment cancelled by user" };
    }
    return { success: false, orderNumbers: [], error: error.message };
  }
}
