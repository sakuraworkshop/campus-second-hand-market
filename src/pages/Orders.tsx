import { Navigate } from "react-router-dom";

export default function Orders() {
  // 订单列表已合并到个人中心 Tabs：/profile?tab=orders
  return <Navigate to="/profile?tab=orders" replace />;
}
