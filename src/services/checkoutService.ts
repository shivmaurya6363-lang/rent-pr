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
 * Save or update user address in the database
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
 * Ensure product exists in database
 */
async function ensureProductExists(
  userId: string,
  item: CartItem
): Promise<{ productId: string; vendorId: string; rentalPlanId: string } | null> {
  const productSlug = item.product.slug;
  
  let { data: existingProduct } = await supabase
    .from("products")
    .select("id, vendor_id")
    .eq("slug", productSlug)
    .maybeSingle();

  let vendorId: string;
  let productId: string;

  if (existingProduct) {
    productId = existingProduct.id;
    vendorId = existingProduct.vendor_id;
  } else {
    let { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!vendor) {
      const { data: anyVendor } = await supabase
        .from("vendors")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (anyVendor) {
        vendorId = anyVendor.id;
      } else {
        const { data: newVendor, error: vendorError } = await supabase
          .from("vendors")
          .insert({
            user_id: userId,
            business_name: "Demo Rentals",
            business_email: "demo@rentals.com",
            status: "approved",
          })
          .select("id")
          .single();

        if (vendorError) {
          console.error("Error creating vendor:", vendorError);
          return null;
        }
        vendorId = newVendor.id;
      }
    } else {
      vendorId = vendor.id;
    }

    const { data: newProduct, error: productError } = await supabase
      .from("products")
      .insert({
        vendor_id: vendorId,
        name: item.product.name,
        slug: productSlug,
        brand: item.product.brand,
        description: item.product.description,
        features: item.product.features,
        images: item.product.images,
        specifications: item.product.specifications,
        tags: item.product.tags,
        rating: item.product.rating,
        review_count: item.product.reviewCount,
        in_stock: item.product.inStock,
        stock_quantity: 10,
        status: "approved",
      })
      .select("id")
      .single();

    if (productError) {
      console.error("Error creating product:", productError);
      return null;
    }
    productId = newProduct.id;
  }

  let { data: existingPlan } = await supabase
    .from("rental_plans")
    .select("id")
    .eq("product_id", productId)
    .eq("duration_months", item.selectedPlan.duration)
    .maybeSingle();

  let rentalPlanId: string;

  if (existingPlan) {
    rentalPlanId = existingPlan.id;
  } else {
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
      console.error("Error creating rental plan:", planError);
      return null;
    }
    rentalPlanId = newPlan.id;
  }

  return { productId, vendorId, rentalPlanId };
}

/**
 * Razorpay Subscription Payment Flow:
 * 1. Create Razorpay Plan (monthly rent + GST + protection)
 * 2. Create Razorpay Subscription with upfront addons (deposit + fees)
 * 3. Open Razorpay Checkout with subscription_id
 * 4. On success, verify signature + create order on backend
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
    // Save address first
    const { addressId, error: addressError } = await saveAddress(userId, formData);
    if (addressError || !addressId) {
      return { success: false, orderNumbers: [], error: addressError || "Failed to save address" };
    }

    // Prepare pending order data
    const pendingOrders: Array<{
      item: CartItem;
      orderData: Record<string, unknown>;
      payableNow: number;
      monthlyTotal: number;
    }> = [];

    for (const item of items) {
      const monthlyRent = item.selectedPlan.monthlyRent;
      const gst = Math.round(monthlyRent * GST_RATE);
      const protectionFee = item.addProtectionPlan ? 99 : 0;
      const monthlyTotal = monthlyRent + gst + protectionFee;
      const commissionRate = 0.30;
      const platformCommission = Math.round(monthlyRent * commissionRate);
      const vendorPayout = monthlyRent - platformCommission;

      const productData = await ensureProductExists(userId, item);
      if (!productData) {
        throw new Error(`Failed to process product: ${item.product.name}. Please try again.`);
      }

      const { productId, vendorId, rentalPlanId } = productData;
      const payableNow = item.selectedPlan.securityDeposit + item.product.deliveryFee + item.product.installationFee;
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      pendingOrders.push({
        item,
        payableNow,
        monthlyTotal,
        orderData: {
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
          payable_now_total: payableNow,
          monthly_rent: monthlyRent,
          monthly_gst: gst,
          protection_plan_fee: protectionFee,
          monthly_total: monthlyTotal,
          rental_duration_months: item.selectedPlan.duration,
          platform_commission: platformCommission,
          vendor_payout: vendorPayout,
          status: "pending",
          terms_accepted_at: termsVersion ? new Date().toISOString() : null,
          terms_version: termsVersion || null,
        },
      });
    }

    // For subscription flow, process each item as a separate subscription
    const orderNumbers: string[] = [];

    for (const po of pendingOrders) {
      const item = po.item;
      const monthlyRent = item.selectedPlan.monthlyRent;
      const gst = Math.round(monthlyRent * GST_RATE);
      const protectionFee = item.addProtectionPlan ? 99 : 0;
      const monthlyTotal = monthlyRent + gst + protectionFee;

      // Step 1: Create Razorpay Plan
      const planResult = await createRazorpayPlan({
        period: "monthly",
        interval: 1,
        item: {
          name: `${item.product.name} - ${item.selectedPlan.label} Rental`,
          amount: monthlyTotal, // monthly rent + GST + protection
          currency: "INR",
          description: `Monthly rental for ${item.product.name} (${item.selectedPlan.duration} months)`,
        },
        notes: { productSlug: item.product.slug, userId },
      });

      if (!planResult.success || !planResult.planId) {
        throw new Error(planResult.error || `Failed to create plan for ${item.product.name}`);
      }

      // Step 2: Create Razorpay Subscription
      const upfrontAmount = po.payableNow - (couponDiscount / pendingOrders.length);

      const subResult = await createRazorpaySubscription({
        plan_id: planResult.planId,
        total_count: item.selectedPlan.duration,
        quantity: item.quantity,
        upfront_amount: Math.max(0, upfrontAmount),
        notes: { userId, productName: item.product.name },
      });

      if (!subResult.success || !subResult.subscriptionId || !subResult.keyId) {
        throw new Error(subResult.error || `Failed to create subscription for ${item.product.name}`);
      }

      // Step 3: Open Razorpay Checkout with subscription_id
      const paymentResult = await openRazorpaySubscriptionCheckout({
        subscriptionId: subResult.subscriptionId,
        keyId: subResult.keyId,
        customerName: formData.fullName,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        description: `${item.product.name} - Monthly Rental`,
      });

      // Step 4: Confirm order on backend
      const result = await confirmOrderAfterPayment({
        razorpay_subscription_id: paymentResult.razorpay_subscription_id,
        razorpay_payment_id: paymentResult.razorpay_payment_id,
        razorpay_signature: paymentResult.razorpay_signature,
        orderData: po.orderData,
      });

      if (result.success && result.orderNumber) {
        orderNumbers.push(result.orderNumber);
      } else {
        console.error("Failed to confirm order:", result.error);
      }
    }

    if (orderNumbers.length === 0) {
      return { success: false, orderNumbers: [], error: "Failed to create orders after payment" };
    }

    return { success: true, orderNumbers };
  } catch (error: any) {
    console.error("Checkout error:", error);
    if (error.message === "Payment cancelled by user") {
      return { success: false, orderNumbers: [], error: "Payment was cancelled. No order was created." };
    }
    return { success: false, orderNumbers: [], error: error.message };
  }
}
