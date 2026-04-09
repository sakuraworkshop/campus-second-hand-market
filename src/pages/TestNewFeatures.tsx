import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { useUtc8Time } from "@/hooks/use-utc8-time";

const TestNewFeatures = () => {
  const { formatDateTime } = useUtc8Time();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 检查是否有token
    if (getToken()) {
      setUser({ id: 1, nickname: "测试用户" });
      loadNotifications();
      loadOrders();
    }
  }, []);

  const loadNotifications = async () => {
    try {
      const list = await api.listNotifications();
      setNotifications(list);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  const loadOrders = async () => {
    try {
      const response = await fetch("/api/users/me/orders", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      const allOrders = [...(data.buyerOrders || []), ...(data.sellerOrders || [])];
      setOrders(allOrders.filter(o => o.status === "completed"));
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
  };

  const handleCreateEvaluation = async (orderId: number) => {
    try {
      setLoading(true);
      const response = await api.createEvaluation(orderId, {
        rating: 5,
        content: "商品质量很好，卖家服务态度也很棒！",
        target_type: "seller",
      });
      toast.success(response.message);
      loadOrders();
    } catch (error) {
      console.error("Failed to create evaluation:", error);
      toast.error("评价失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateComplaint = async () => {
    try {
      setLoading(true);
      const response = await api.createComplaint({
        type: "product",
        target_id: 1,
        content: "商品与描述不符",
        evidence: [],
      });
      toast.success(response.message);
    } catch (error) {
      console.error("Failed to create complaint:", error);
      toast.error("投诉失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationAsRead(id);
      loadNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      loadNotifications();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>请先登录</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-6">测试新功能</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 系统通知测试 */}
        <Card>
          <CardHeader>
            <CardTitle>系统通知</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={handleMarkAllAsRead} variant="outline" size="sm">
                全部标记为已读
              </Button>
              {notifications.length === 0 ? (
                <p className="text-muted-foreground">暂无通知</p>
              ) : (
                notifications.map((notification) => (
                  <div key={notification.id} className={`p-3 rounded-md ${notification.is_read ? "bg-muted/30" : "bg-primary/10"}`}>
                    <h3 className="font-medium">{notification.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{notification.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(notification.created_at)}</p>
                    {!notification.is_read && (
                      <Button 
                        onClick={() => handleMarkAsRead(notification.id)} 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2"
                      >
                        标记为已读
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 交易评价测试 */}
        <Card>
          <CardHeader>
            <CardTitle>交易评价</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orders.length === 0 ? (
                <p className="text-muted-foreground">暂无已完成的订单</p>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="p-3 rounded-md bg-muted/30">
                    <h3 className="font-medium">{order.product?.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">订单号: {order.orderNo}</p>
                    <p className="text-sm text-muted-foreground">状态: {order.status}</p>
                    <Button 
                      onClick={() => handleCreateEvaluation(order.id)} 
                      variant="default" 
                      size="sm" 
                      className="mt-2" 
                      disabled={loading}
                    >
                      {loading ? "评价中..." : "评价此订单"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 投诉与反馈测试 */}
        <Card>
          <CardHeader>
            <CardTitle>投诉与反馈</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={handleCreateComplaint} 
                variant="default" 
                size="sm" 
                disabled={loading}
              >
                {loading ? "提交中..." : "提交投诉"}
              </Button>
              <p className="text-sm text-muted-foreground">
                点击按钮提交一个测试投诉，投诉类型为商品，目标ID为1
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestNewFeatures;