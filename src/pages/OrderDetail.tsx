import { useParams, Link, useNavigate } from "react-router-dom";
import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, MessageCircle, Package, MapPin, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getMe } from "@/lib/auth";
import type { Order } from "@/types";
import { resolveAssetUrl } from "@/lib/assets";
import { toast } from "sonner";

const statusSteps = ["待确认", "待交付", "已完成"];
const statusMap: Record<string, string> = {
  "pending": "待确认",
  "confirmed": "待交付",
  "completed": "已完成",
  "cancelled": "已取消"
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [myEvaluation, setMyEvaluation] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await api.getOrder(Number(id));
        // 转换API返回的数据格式以匹配前端类型
        const formattedOrder: Order = {
          id: response.id.toString(),
          orderNo: response.orderNo || `TX${new Date().toISOString().slice(0, 10).replace(/-/g, "")}${String(response.id).padStart(3, "0")}`,
          product: {
            id: response.product?.id?.toString() || "",
            title: response.product?.title || "",
            images: response.product?.images || (response.product?.image_url ? [response.product.image_url] : []),
            price: response.product?.price || 0,
            description: response.product?.description || "",
            originalPrice: response.product?.originalPrice || 0,
            condition: response.product?.condition || "轻微使用",
            category: response.product?.category || "",
            categoryId: response.product?.category_id || "",
            seller: {
              id: response.product?.owner_id?.toString() || "",
              nickname: response.product?.owner_name || "未知卖家",
              avatar: ""
            },
            status: response.product?.status === "approved" ? "已上架" : "已下架",
            views: response.product?.views || 0,
            favorites: response.product?.favorites || 0,
            campus: response.product?.campus || "",
            createdAt: response.product?.created_at || ""
          },
          buyer: {
            id: response.buyer?.id?.toString() || response.buyer_id?.toString() || "",
            nickname: response.buyer?.nickname || "未知买家",
            avatar: response.buyer?.avatar || ""
          },
          seller: {
            id: response.seller?.id?.toString() || response.seller_id?.toString() || "",
            nickname: response.seller?.nickname || "未知卖家",
            avatar: response.seller?.avatar || ""
          },
          status: response.status,
          amount: response.amount || response.product?.price || 0,
          createdAt: response.created_at || new Date().toISOString().split('T')[0],
          deliveryAddress: response.deliveryAddress || "",
          deliveryTime: response.deliveryTime || "",
          timeline: response.timeline || []
        };
        setOrder(formattedOrder);
        if (response.status === "completed") {
          try {
            const e = await api.getMyEvaluation(Number(id));
            setMyEvaluation(e);
          } catch {
            setMyEvaluation(null);
          }
        } else {
          setMyEvaluation(null);
        }
      } catch (error) {
        console.error("获取订单详情失败", error);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          加载中...
        </div>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          订单不存在
        </div>
        <Footer />
      </div>
    );
  }

  const user = getMe();
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          请先登录
        </div>
        <Footer />
      </div>
    );
  }

  const isBuyer = order.buyer.id === user.id.toString();
  const otherParty = isBuyer ? order.seller : order.buyer;
  const isCancelled = order.status === "cancelled";
  const currentStep = isCancelled ? -1 : Object.values(statusMap).indexOf(statusMap[order.status]);

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      await api.updateOrderStatus(Number(id), newStatus);
      // 刷新订单信息
      const response = await api.getOrder(Number(id));
      const formattedOrder: Order = {
        ...order,
        status: response.status,
        timeline: response.timeline || []
      };
      setOrder(formattedOrder);
      toast.success("操作成功");
    } catch (error) {
      toast.error("操作失败，请重试");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 max-w-2xl">
        {/* Back */}
        <Link to="/profile?tab=orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> 返回订单列表
        </Link>

        {/* Status */}
        <Card className="mb-4">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-lg font-bold text-foreground">{statusMap[order.status]}</p>
                <p className="text-xs text-muted-foreground mt-1">订单号：{order.orderNo}</p>
              </div>
              <Badge variant={
                order.status === "completed" ? "outline" :
                order.status === "cancelled" ? "destructive" : "default"
              } className="text-sm px-3 py-1">
                {statusMap[order.status]}
              </Badge>
            </div>

            {/* Progress */}
            {!isCancelled && (
              <div className="flex items-center gap-0">
                {statusSteps.map((step, i) => (
                  <div key={step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i <= currentStep ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {i + 1}
                      </div>
                      <span className={`text-xs mt-1 ${i <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {step}
                      </span>
                    </div>
                    {i < statusSteps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${i < currentStep ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Package className="h-4 w-4" /> 商品信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to={`/product/${order.product.id}`} className="flex gap-3">
              <img
                src={resolveAssetUrl(order.product.images?.[0]) || "https://via.placeholder.com/100"}
                alt=""
                className="h-20 w-20 rounded-lg object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{order.product.title}</p>
                <p className="text-xs text-muted-foreground mt-1">成色：{order.product.condition}</p>
                <p className="text-lg font-bold text-primary mt-2">¥{order.amount}</p>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Other party */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{isBuyer ? "卖家信息" : "买家信息"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={resolveAssetUrl(otherParty.avatar)} />
                  <AvatarFallback>{otherParty.nickname[0]}</AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{otherParty.nickname}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  const targetUserId = Number(otherParty.id);
                  if (!Number.isFinite(targetUserId) || targetUserId <= 0) return toast.error("对方用户信息异常");
                  api.startConversation({ targetUserId, productId: Number(order.product.id) })
                    .then((r) => navigate(`/chat/${r.id}`))
                    .catch((e: any) => toast.error(e?.message || "发起聊天失败"));
                }}
              >
                <MessageCircle className="h-4 w-4" /> 联系{isBuyer ? "卖家" : "买家"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delivery info */}
        {order.deliveryAddress && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> 交付信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{order.deliveryAddress}</p>
              <p className="text-xs text-muted-foreground mt-1">{order.deliveryTime}</p>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> 订单动态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.timeline.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    {i < order.timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm text-foreground">{item.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {order.status === "pending" && !isBuyer && (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => handleUpdateStatus("cancelled")} disabled={updating}>
              {updating ? "处理中..." : "拒绝订单"}
            </Button>
            <Button className="flex-1" onClick={() => handleUpdateStatus("confirmed")} disabled={updating}>
              {updating ? "处理中..." : "确认订单"}
            </Button>
          </div>
        )}
        {order.status === "confirmed" && isBuyer && (
          <Button className="w-full" onClick={() => handleUpdateStatus("completed")} disabled={updating}>
            {updating ? "处理中..." : "确认收货"}
          </Button>
        )}
        {order.status === "completed" && (
          <Button
            variant={myEvaluation ? "secondary" : "outline"}
            className="w-full"
            disabled={!!myEvaluation}
            onClick={() => navigate(`/order/${order.id}/evaluate`)}
          >
            {myEvaluation ? "已评价" : "评价订单"}
          </Button>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default OrderDetail;
