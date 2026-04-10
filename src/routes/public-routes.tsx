import { Route } from "react-router-dom";
import RequireAuth from "@/components/auth/RequireAuth";
import {
  AnnouncementsPage,
  AddressesPage,
  ChangePasswordPage,
  ChangePhonePage,
  ChatPage,
  FavoritesPage,
  ForgotPasswordPage,
  IndexPage,
  LoginPage,
  MessagesPage,
  MyProductsPage,
  NotFoundPage,
  OrderDetailPage,
  OrderEvaluatePage,
  OrdersPage,
  ProductDetailPage,
  ProductsPage,
  ProfilePage,
  PublishProductPage,
  RegisterPage,
} from "@/features/public/pages";

export const publicRoutes = (
  <>
    <Route path="/" element={<IndexPage />} />
    <Route path="/products" element={<ProductsPage />} />
    <Route path="/product/:id" element={<ProductDetailPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/announcements" element={<AnnouncementsPage />} />
    <Route path="/publish" element={<RequireAuth><PublishProductPage /></RequireAuth>} />
    <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
    <Route path="/my-products" element={<RequireAuth><MyProductsPage /></RequireAuth>} />
    <Route path="/favorites" element={<RequireAuth><FavoritesPage /></RequireAuth>} />
    <Route path="/addresses" element={<RequireAuth><AddressesPage /></RequireAuth>} />
    <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
    <Route path="/change-phone" element={<RequireAuth><ChangePhonePage /></RequireAuth>} />
    <Route path="/messages" element={<RequireAuth><MessagesPage /></RequireAuth>} />
    <Route path="/chat/:id" element={<RequireAuth><ChatPage /></RequireAuth>} />
    <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
    <Route path="/order/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
    <Route path="/order/:id/evaluate" element={<RequireAuth><OrderEvaluatePage /></RequireAuth>} />
    <Route path="*" element={<NotFoundPage />} />
  </>
);
