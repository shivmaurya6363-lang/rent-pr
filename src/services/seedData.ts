import { supabase } from "@/integrations/supabase/client";
import { printerProducts } from "@/data/products";

/**
 * Seed sample printer products into the database
 * This creates a demo vendor and adds all static products to the database
 */
export async function seedSampleProducts(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // First, check if we already have a vendor for this user
    let vendorId: string;
    
    const { data: existingVendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingVendor) {
      vendorId = existingVendor.id;
    } else {
      // Create a demo vendor
      const { data: newVendor, error: vendorError } = await supabase
        .from("vendors")
        .insert({
          user_id: userId,
          business_name: "Demo Printer Rentals",
          business_email: "demo@printerrentals.com",
          business_phone: "+91 9876543210",
          business_address: "123 Demo Street, Mumbai",
          status: "approved",
        })
        .select("id")
        .single();

      if (vendorError) throw vendorError;
      vendorId = newVendor.id;
    }

    // Get Printers category
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", "printers")
      .maybeSingle();

    const categoryId = category?.id || null;

    // Add products
    for (const product of printerProducts) {
      // Check if product already exists
      const { data: existingProduct } = await supabase
        .from("products")
        .select("id")
        .eq("slug", product.slug)
        .maybeSingle();

      if (existingProduct) continue; // Skip if already exists

      // Create product
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({
          vendor_id: vendorId,
          category_id: categoryId,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          description: product.description,
          features: product.features,
          images: product.images,
          specifications: product.specifications,
          tags: product.tags,
          rating: product.rating,
          review_count: product.reviewCount,
          in_stock: product.inStock,
          stock_quantity: 10,
          status: "approved",
        })
        .select("id")
        .single();

      if (productError) throw productError;

      // Create rental plans for this product
      for (const plan of product.rentalPlans) {
        const { error: planError } = await supabase
          .from("rental_plans")
          .insert({
            product_id: newProduct.id,
            duration_months: plan.duration,
            label: plan.label,
            monthly_rent: plan.monthlyRent,
            security_deposit: plan.securityDeposit,
            delivery_fee: product.deliveryFee,
            installation_fee: product.installationFee,
            is_active: true,
          });

        if (planError) throw planError;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error seeding products:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if database has products
 */
export async function hasProducts(): Promise<boolean> {
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });
  
  return (count || 0) > 0;
}
