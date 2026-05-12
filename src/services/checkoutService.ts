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
  pendingPayment?: boolean;
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
    console.error("Error saving address:", error);
    return { addressId: null, error: error.message };
  }
}

/**
 * Resolve the database product/vendor/rental-plan IDs for a cart item.
 * Products must already exist in the DB (created by vendors).
 * Never creates vendors from customer accounts.
 */
async function resolveProductIds(
  item: CartItem
): Promise<{ productId: string; vendorId: string; rentalPlanId: string } | null> {
  // Look up the product by slug
  const { data: product } = await supabase
    .from("products")
    .select("id, vendor_id")
    .eq("slug", item.product.slug)
    .maybeSingle();

  if (!product) {
    console.error(`[Checkout] Product not found in DB: ${item.product.slug}`);
    return null;
  }

  const productId = product.id;
  const vendorId = product.vendor_id;

  // Look up or create the rental plan for this duration
  const { data: existingPlan } = await supabase
    .from("rental_plans")
    .select("id")
    .eq("product_id", productId)
    .eq("duration_months", item.selectedPlan.duration)
    .maybeSingle();

  if (existingPlan) {
    return { productId, vendorId, rentalPlanId: existingPlan.id };
  }

  const { data: newPlan, error: planError } = await supabase
    .from("rental_plans")
    .insert({
      product_id: productId,
      duration_months: item.selectedPlan.duration,
      monthly_rent: item.selectedPlan.monthlyRent,
      security_deposit: item.selectedPlan.securityDeposit,
      label: item.selectedPlan.label,
      delivery_fee: item.product.deliveryFee,
      installation_fee: item.product.installationFee,
      is_active: true,
    })
    .select("id")
    .single();

  if (planError) {
    console.error("[Checkout] Error creating rental plan:", planError);
    return null;
  }

  return { productId, vendorId, rentalPlanId: newPlan.id };
}

/**
 * Full Razorpay Subscription checkout flow for a single cart item:
 * 1. Create Razorpay Plan (monthly rent + GST + protection)
 * 2. Create Subscription with upfront addon (deposit + fees)
 * 3. Open Razorpay Checkout modal (UPI autopay / card / netbanking / QR)
 * 4. On success, verify signature + create confirmed order on backend
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

  const productData = await resolveProductIds(item);
  if (!productData) {
    return { success: false, error: `Product "${item.product.name}" is not available for checkout. Please contact support.` };
  }

  const { productId, vendorId, rentalPlanId } = productData;
  const payableNow = item.selectedPlan.securityDeposit + item.product.deliveryFee + item.product.installationFee;
  const upfrontAmount = Math.max(0, payableNow - couponDiscount);

  // Apply advance-payment discount if selected
  const effectiveMonthlyTotal = item.payAdvance && item.advanceDiscountPercent
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

  // Step 3: Open Razorpay Checkout (all payment methods: UPI, QR, card, netbanking)
  const paymentResult = await openRazorpaySubscriptionCheckout({
    subscriptionId: subResult.subscriptionId,
    keyId: subResult.keyId,
    customerName: formData.fullName,
    customerEmail: formData.email,
    customerPhone: formData.phone,
    description: `${item.product.name} — Monthly Rental`,
  });

  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const orderData = {
    order_number: orderNumber,
    customer_id: userId,
    vendor_id: vendorId,
    product_id: productId,
    rental_plan_id: rentalPlanId,
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
  };

  // Step 4: Confirm order on backend (verifies signature, creates DB records)
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
 * Process checkout for all cart items via Razorpay.
 * Each item gets its own subscription (separate mandate per product).
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

    // Distribute coupon discount evenly across items
    const discountPerItem = items.length > 0 ? Math.floor(couponDiscount / items.length) : 0;

    for (const item of items) {
      const result = await processCartItem(
        userId,
        item,
        addressId,
        formData,
        termsVersion,
        discountPerItem
      );

      if (result.success && result.orderNumber) {
        orderNumbers.push(result.orderNumber);
      } else {
        const errMsg = result.error || "Unknown error";
        errors.push(errMsg);
        // Stop processing remaining items if user cancelled payment
        if (errMsg === "Payment cancelled by user") {
          break;
        }
      }
    }

    if (orderNumbers.length === 0) {
      const firstError = errors[0] || "Failed to create orders after payment";
      if (firstError === "Payment cancelled by user") {
        throw new Error("Payment cancelled by user");
      }
      return { success: false, orderNumbers: [], error: firstError };
    }

    // Partial success: some items paid, some failed
    if (errors.length > 0) {
      console.warn("[Checkout] Partial success. Paid:", orderNumbers, "Errors:", errors);
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
