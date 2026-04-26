import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { LocationProvider } from "@/contexts/LocationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LocationPopupWrapper from "@/components/LocationPopupWrapper";
import ScrollToTop from "@/components/ScrollToTop";

// Public pages
import Index from "./pages/Index";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import MyOrders from "./pages/MyOrders";
import MyAccount from "./pages/MyAccount";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import HowItWorks from "./pages/HowItWorks";
import NotFound from "./pages/NotFound";
import LegalPage from "./pages/LegalPage";

// Vendor pages
import VendorDashboard from "./pages/VendorDashboard";
import VendorRegister from "./pages/VendorRegister";
import VendorPending from "./pages/VendorPending";
import VendorRejected from "./pages/VendorRejected";
import VendorProducts from "./pages/vendor/VendorProducts";
import VendorProductForm from "./pages/vendor/VendorProductForm";
import VendorProductView from "./pages/vendor/VendorProductView";
import VendorOrders from "./pages/vendor/VendorOrders";
import VendorPayouts from "./pages/vendor/VendorPayouts";
import VendorSettings from "./pages/vendor/VendorSettings";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminVendors from "./pages/admin/AdminVendors";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminPayouts from "./pages/admin/AdminPayouts";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMonthlyRent from "./pages/admin/AdminMonthlyRent";
import AdminSlider from "./pages/admin/AdminSlider";
import AdminFooter from "./pages/admin/AdminFooter";
import AdminLegal from "./pages/admin/AdminLegal";
import AdminCancellations from "./pages/admin/AdminCancellations";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminCoupons from "./pages/admin/AdminCoupons";
import OrderDocuments from "./pages/OrderDocuments";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <LocationProvider>
            <CartProvider>
              <ScrollToTop />
              <Toaster />
              <Sonner />
              <LocationPopupWrapper />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<Products />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/legal/:slug" element={<LegalPage />} />
              
              {/* Guest checkout allowed */}
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route
                path="/my-orders"
                element={
                  <ProtectedRoute>
                    <MyOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-account"
                element={
                  <ProtectedRoute>
                    <MyAccount />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/order-documents/:orderId"
                element={
                  <ProtectedRoute>
                    <OrderDocuments />
                  </ProtectedRoute>
                }
              />
              {/* Vendor routes */}
              <Route
                path="/vendor"
                element={
                  <ProtectedRoute requiredRoles={['vendor']} requireApprovedVendor>
                    <VendorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/products"
                element={
                  <ProtectedRoute requiredRoles={['vendor']} requireApprovedVendor>
                    <VendorProducts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/products/new"
                element={
                  <ProtectedRoute requiredRoles={['vendor']} requireApprovedVendor>
                    <VendorProductForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/products/:id"
                element={
                  <ProtectedRoute requiredRoles={['vendor']} requireApprovedVendor>
                    <VendorProductView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/products/:id/edit"
                element={
                  <ProtectedRoute requiredRoles={['vendor']} requireApprovedVendor>
                    <VendorProductForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/orders"
                element={
                  <ProtectedRoute requiredRoles={['vendor']} requireApprovedVendor>
                    <VendorOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/payouts"
                element={
                  <ProtectedRoute requiredRoles={['vendor']} requireApprovedVendor>
                    <VendorPayouts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/settings"
                element={
                  <ProtectedRoute requiredRoles={['vendor']} requireApprovedVendor>
                    <VendorSettings />
                  </ProtectedRoute>
                }
              />
              {/* Vendor Register is public (separate vendor auth) */}
              <Route path="/vendor/register" element={<VendorRegister />} />
              <Route path="/vendor/login" element={<VendorRegister />} />
              <Route
                path="/vendor/pending"
                element={
                  <ProtectedRoute requiredRoles={['vendor']}>
                    <VendorPending />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor/rejected"
                element={
                  <ProtectedRoute requiredRoles={['vendor']}>
                    <VendorRejected />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/vendors"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminVendors />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/products"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminProducts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminCategories />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminOrders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/payouts"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminPayouts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminReports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/slider"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminSlider />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/monthly-rent"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminMonthlyRent />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/footer"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminFooter />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/legal"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminLegal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/cancellations"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminCancellations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/documents"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminDocuments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/coupons"
                element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <AdminCoupons />
                  </ProtectedRoute>
                }
              />
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
