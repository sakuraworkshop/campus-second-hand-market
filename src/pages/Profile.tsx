
import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Settings,
  MapPin,
  Package,
  Heart,
  ShoppingCart,
  LogOut,
  ArrowUpDown,
  Trash2,
  Eye,
  Plus,
  CheckCircle,
  Coins,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/auth";
import { clearAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PointsCenterContent from "@/components/PointsCenterContent";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Address, Order, Product } from "@/types";
import { resolveAssetUrl } from "@/lib/assets";
import { normalizeProductImages } from "@/lib/product-images";
import { toast } from "sonner";
import { useUtc8Time } from "@/hooks/use-utc8-time";

const Profile = () => {
  const { formatDateTime } = useUtc8Time();
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMeState] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [stats, setStats] = useState<{
    published: number;
    favorites: number;
    bought: number;
    sold: number;
    trades: number;
  } | null>(null);

  // tabs data
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [myProductsLoading, setMyProductsLoading] = useState(false);
  const [myProductsStatusFilter, setMyProductsStatusFilter] = useState("全部");

  const [favProducts, setFavProducts] = useState<Product[]>([]);
  const [favLoading, setFavLoading] = useState(false);

  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState("全部");
  const [orderRoleFilter, setOrderRoleFilter] = useState<"全部" | "买到" | "卖出">("全部");

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addrForm, setAddrForm] = useState({
    contact: "",
    phone: "",
    campus: "东校区",
    building: "",
    detail: "",
  });

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [newPhone, setNewPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [coolDownUntil, setCoolDownUntil] = useState<number>(0);
  const [pendingDeleteProductId, setPendingDeleteProductId] = useState<number | null>(null);
  const [pendingDeleteAddressId, setPendingDeleteAddressId] = useState<number | null>(null);

  useEffect(() => {
    api
      .me()
      .then((u) => {
        if (!u || typeof u !== "object") {
          throw new Error("获取用户信息格式异常");
        }
        const next = u as unknown as Me;
        setMeState(next);
        return next;
      })
      .then(async (u) => {
        if (!u?.id) return;
        // 优先使用后端聚合统计；失败时退化为前端计算，避免页面一直显示 "-"
        try {
          const s = await api.meStats();
          setStats(s);
          return;
        } catch {
          // ignore
        }

        try {
          const [favorites, products, orders] = await Promise.all([
            api.listFavorites(u.id),
            api.listProducts(),
            api.listOrders(u.id),
          ]);
          const published = products.filter((p: any) => Number(p.owner_id) === Number(u.id) && p.status !== "deleted")
            .length;
          const favCount = favorites.length;
          const buyerCount = orders.filter((o: any) => String(o.buyer_id) === String(u.id) || String(o.buyer?.id) === String(u.id)).length;
          const sellerCount = orders.filter((o: any) => String(o.seller_id) === String(u.id) || String(o.seller?.id) === String(u.id)).length;
          setStats({
            published,
            favorites: favCount,
            bought: buyerCount,
            sold: sellerCount,
            trades: buyerCount + sellerCount,
          });
        } catch {
          setStats(null);
        }
      })
      .catch((err) => {
        console.error("获取用户信息失败:", err);
        setMeState(null);
        setStats(null);
      });
  }, []);

  const user = me
    ? {
        nickname: me.nickname,
        avatar: me.avatar,
        bio: me.bio,
        phone: me.phone,
      }
    : null;

  const refreshStats = async () => {
    try {
      const s = await api.meStats();
      setStats(s);
    } catch {
      // ignore
    }
  };

  const coolDownText = useMemo(() => {
    if (Date.now() >= coolDownUntil) return null;
    return `${Math.ceil((coolDownUntil - Date.now()) / 1000)}s`;
  }, [coolDownUntil]);

  const statusColorMap: Record<string, string> = {
    已上架: "bg-success/10 text-success border-success/20",
    已下架: "bg-muted text-muted-foreground",
    已售出: "bg-primary/10 text-primary border-primary/20",
  };

  const orderStatuses = ["全部", "待确认", "待交付", "已完成", "已取消"];
  const orderStatusText: Record<string, string> = {
    pending: "待确认",
    confirmed: "待交付",
    completed: "已完成",
    cancelled: "已取消",
  };
  const orderStatusVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "confirmed":
        return "default";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const ensureMyProductsLoaded = async () => {
    if (!me || myProductsLoading || myProducts.length > 0) return;
    setMyProductsLoading(true);
    try {
      const products = await api.listProducts();
      const mine = products
        .filter((p: any) => Number(p.owner_id) === Number(me.id))
        .map((p: any) => ({
          id: Number(p.id),
          title: p.title,
          images: normalizeProductImages(p.images, p.image_url),
          price: Number(p.price || 0),
          views: p.views || 0,
          favorites: p.favorites || 0,
          createdAt: p.created_at || "",
          rawStatus: p.status,
          status:
            p.status === "approved" ? "已上架" : p.status === "completed" ? "已售出" : "已下架",
        }));
      setMyProducts(mine);
    } catch {
      setMyProducts([]);
    } finally {
      setMyProductsLoading(false);
    }
  };

  const ensureFavoritesLoaded = async () => {
    if (!me || favLoading || favProducts.length > 0) return;
    setFavLoading(true);
    try {
      const [favorites, products] = await Promise.all([api.listFavorites(me.id), api.listProducts()]);
      const favSet = new Set(favorites.map((f) => String(f.product_id)));
      const mapped: Product[] = products
        .filter((p: any) => favSet.has(String(p.id)))
        .map((p: any) => ({
          id: String(p.id),
          title: p.title,
          description: p.description || "",
          price: Number(p.price || 0),
          originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
          condition: p.condition || "轻微使用",
          images: normalizeProductImages(p.images, p.image_url),
          category: p.category || "其他",
          categoryId: p.category_id || "",
          seller: {
            id: String(p.owner_id || ""),
            nickname: p.owner_name || "未知卖家",
            avatar: "",
          },
          status: p.status === "approved" ? "已上架" : "已下架",
          views: p.views || 0,
          favorites: p.favorites || 0,
          campus: p.campus || "",
          createdAt: p.created_at || "",
          isFavorited: true,
        }));
      setFavProducts(mapped);
    } catch {
      setFavProducts([]);
    } finally {
      setFavLoading(false);
    }
  };

  const ensureOrdersLoaded = async () => {
    if (!me || ordersLoading || buyerOrders.length + sellerOrders.length > 0) return;
    setOrdersLoading(true);
    try {
      const response = await api.listOrders(me.id);
      const formattedOrders: Order[] = response.map((o: any) => ({
        id: o.id.toString(),
        orderNo:
          o.orderNo ||
          `TX${new Date().toISOString().slice(0, 10).replace(/-/g, "")}${String(o.id).padStart(3, "0")}`,
        product: {
          id: o.product?.id?.toString() || "",
          title: o.product?.title || o.title || "",
          images: normalizeProductImages(o.product?.images, o.product?.image_url),
          price: o.product?.price || o.price || 0,
          description: "",
          originalPrice: 0,
          condition: "轻微使用",
          category: "",
          categoryId: "",
          seller: { id: "", nickname: "", avatar: "" },
          status: "已上架",
          views: 0,
          favorites: 0,
          campus: "",
          createdAt: "",
        },
        buyer: {
          id: o.buyer?.id?.toString() || o.buyer_id?.toString() || "",
          nickname: o.buyer?.nickname || "未知买家",
          avatar: o.buyer?.avatar || "",
        },
        seller: {
          id: o.seller?.id?.toString() || o.seller_id?.toString() || "",
          nickname: o.seller?.nickname || "未知卖家",
          avatar: o.seller?.avatar || "",
        },
        status: o.status,
        amount: o.amount || o.price || 0,
        createdAt: o.created_at || new Date().toISOString().split("T")[0],
        deliveryAddress: o.deliveryAddress || "",
        deliveryTime: o.deliveryTime || "",
        timeline: o.timeline || [],
      }));
      setBuyerOrders(formattedOrders.filter((o) => o.buyer.id === me.id.toString()));
      setSellerOrders(formattedOrders.filter((o) => o.seller.id === me.id.toString()));
    } catch {
      setBuyerOrders([]);
      setSellerOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const refreshAddresses = async () => {
    const list = await api.listAddresses();
    setAddresses(list as Address[]);
  };

  const ensureAddressesLoaded = async () => {
    if (addressesLoading || addresses.length > 0) return;
    setAddressesLoading(true);
    try {
      await refreshAddresses();
    } catch {
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  };

  const filteredMyProducts = useMemo(() => {
    if (myProductsStatusFilter === "全部") return myProducts;
    return myProducts.filter((p) => p.status === myProductsStatusFilter);
  }, [myProducts, myProductsStatusFilter]);

  const filterOrdersByStatus = (orders: Order[]) => {
    if (orderStatusFilter === "全部") return orders;
    const statusMap: Record<string, string> = {
      待确认: "pending",
      待交付: "confirmed",
      已完成: "completed",
      已取消: "cancelled",
    };
    return orders.filter((o) => o.status === statusMap[orderStatusFilter]);
  };

  const defaultTab = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const tab = q.get("tab");
    const allowed = new Set(["info", "my-products", "favorites", "orders", "addresses", "points"]);
    if (tab && allowed.has(tab)) return tab;
    return "info";
  }, [location.search]);

  const mergedOrders = useMemo(() => {
    type X = Order & { _role: "buyer" | "seller" };
    const list: X[] = [
      ...buyerOrders.map((o) => ({ ...(o as Order), _role: "buyer" as const })),
      ...sellerOrders.map((o) => ({ ...(o as Order), _role: "seller" as const })),
    ];
    const seen = new Set<string>();
    const uniq = list.filter((o) => {
      const k = String(o.id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return uniq.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [buyerOrders, sellerOrders]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-3xl py-4 md:py-6">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full justify-start mb-6 flex-wrap h-auto">
              <TabsTrigger value="info" className="gap-1.5">
                <Settings className="h-4 w-4" /> 个人信息
              </TabsTrigger>
              <TabsTrigger value="my-products" className="gap-1.5" onClick={ensureMyProductsLoaded}>
                <Package className="h-4 w-4" /> 我的发布
                <span className="text-xs text-muted-foreground">({stats ? stats.published : "-"})</span>
              </TabsTrigger>
              <TabsTrigger value="favorites" className="gap-1.5" onClick={ensureFavoritesLoaded}>
                <Heart className="h-4 w-4" /> 我的收藏
                <span className="text-xs text-muted-foreground">({stats ? stats.favorites : "-"})</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5" onClick={ensureOrdersLoaded}>
                <ShoppingCart className="h-4 w-4" /> 我的订单
                <span className="text-xs text-muted-foreground">({stats ? stats.trades : "-"})</span>
              </TabsTrigger>
              <TabsTrigger value="addresses" className="gap-1.5" onClick={ensureAddressesLoaded}>
                <MapPin className="h-4 w-4" /> 收货地址
              </TabsTrigger>
              <TabsTrigger value="points" className="gap-1.5">
                <Coins className="h-4 w-4" /> 积分中心
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              {/* Profile Card */}
              <div className="rounded-xl border border-border bg-card p-6 mb-6">
                {user ? (
                  <div className="flex items-center gap-4 mb-6">
                    <div className="shrink-0">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={resolveAssetUrl(user.avatar)} />
                        <AvatarFallback>{user.nickname?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground">{user.nickname}</h2>
                        {me?.hasStudentId && (
                          <CheckCircle className="h-4 w-4 text-green-500" title="已认证" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{user.bio}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={avatarUploading}
                        onClick={() => {
                          const el = document.getElementById("profile-avatar-file") as HTMLInputElement | null;
                          el?.click();
                        }}
                      >
                        {avatarUploading ? "上传中..." : "更换头像"}
                      </Button>
                      <input
                        id="profile-avatar-file"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setAvatarUploading(true);
                          try {
                            const r = await api.ossUploadFile(file, "avatars");
                            const avatar = r.path || r.url;
                            // 先更新本地态，再点“保存修改”会一起提交；这里也直接提交一次，减少用户困惑
                            setMeState((prev) => (prev ? { ...prev, avatar } : prev));
                            await api.updateProfile({
                              nickname: user.nickname,
                              avatar,
                              bio: user.bio,
                            });
                            await api.me().then((u) => setMeState(u as unknown as Me));
                            toast.success("头像已更新");
                          } catch (err: any) {
                            console.error(err);
                            toast.error(err?.message || "头像上传失败");
                          } finally {
                            setAvatarUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-muted-foreground">加载中...</div>
                )}

                <div className="grid grid-cols-3 gap-4 text-center py-4 border-t border-b border-border">
                  <div>
                    <span className="text-lg font-bold text-foreground">{stats ? stats.published : "-"}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">发布</span>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-foreground">{stats ? stats.favorites : "-"}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">收藏</span>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-foreground">{stats ? stats.trades : "-"}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">交易</span>
                  </div>
                </div>
              </div>

              {/* Edit Form */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-semibold text-foreground">编辑资料</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nickname">昵称</Label>
                    <Input id="nickname" value={user?.nickname || ""} onChange={(e) => setMeState((prev) => (prev ? { ...prev, nickname: e.target.value } : prev))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">个人简介</Label>
                  <Textarea id="bio" value={user?.bio || ""} onChange={(e) => setMeState((prev) => (prev ? { ...prev, bio: e.target.value } : prev))} rows={3} maxLength={100} />
                </div>
                <Button
                  disabled={saving || !user}
                  onClick={async () => {
                    if (!user) return;
                    setSaving(true);
                    try {
                      await api.updateProfile({
                        nickname: user.nickname,
                        avatar: user.avatar,
                        bio: user.bio,
                      });
                      await refreshStats();
                      toast.success("保存成功");
                    } catch (e: any) {
                      toast.error(e?.message || "保存失败");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  保存修改
                </Button>
              </div>



              <div className="rounded-xl border border-border bg-card p-6 mt-6 space-y-4">
                <h3 className="font-semibold text-foreground">安全设置</h3>

                <div className="flex flex-wrap gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">修改密码</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>修改密码</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="oldPassword">原密码</Label>
                          <Input
                            id="oldPassword"
                            type="password"
                            placeholder="请输入原密码"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newPassword">新密码</Label>
                          <Input
                            id="newPassword"
                            type="password"
                            placeholder="至少 6 位"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">确认新密码</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="请再次输入新密码"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </div>
                        <Button
                          className="w-full"
                          disabled={passwordLoading}
                          onClick={async () => {
                            if (newPassword !== confirmPassword) return toast.error("两次新密码不一致");
                            if (!oldPassword || !newPassword) return;
                            setPasswordLoading(true);
                            try {
                              await api.updatePassword({ oldPassword, newPassword });
                              toast.success("密码修改成功，请重新登录");
                              clearAuth();
                              navigate("/login", { replace: true });
                            } catch (e: any) {
                              toast.error(e?.message || "修改失败");
                            } finally {
                              setPasswordLoading(false);
                            }
                          }}
                        >
                          {passwordLoading ? "提交中..." : "确认修改"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">更换手机号</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>更换手机号</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="newPhone">新手机号</Label>
                          <Input
                            id="newPhone"
                            type="tel"
                            placeholder="请输入新手机号"
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="code">验证码</Label>
                          <div className="flex gap-2">
                            <Input
                              id="code"
                              placeholder="请输入验证码"
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              disabled={sending || !newPhone.trim() || Date.now() < coolDownUntil}
                              onClick={async () => {
                                const p = newPhone.trim();
                                if (!p) return;
                                setSending(true);
                                try {
                                  await api.sendChangePhoneCode({ newPhone: p });
                                  toast.success("验证码已发送");
                                  setCoolDownUntil(Date.now() + 60 * 1000);
                                } catch (e: any) {
                                  toast.error(e?.message || "发送失败");
                                } finally {
                                  setSending(false);
                                }
                              }}
                            >
                              {coolDownText || (sending ? "发送中..." : "发送验证码")}
                            </Button>
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          disabled={phoneLoading || !newPhone.trim() || !code.trim()}
                          onClick={async () => {
                            setPhoneLoading(true);
                            try {
                              await api.confirmChangePhone({ newPhone: newPhone.trim(), code: code.trim() });
                              toast.success("手机号已更新");
                              setNewPhone("");
                              setCode("");
                              await api.me().then((u) => setMeState(u as unknown as Me));
                            } catch (e: any) {
                              toast.error(e?.message || "更换失败");
                            } finally {
                              setPhoneLoading(false);
                            }
                          }}
                        >
                          {phoneLoading ? "提交中..." : "确认更换"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 mt-6">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    clearAuth();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出登录
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="my-products">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">我的发布</h2>
                <Button size="sm" className="gap-1.5" onClick={() => navigate("/publish")}>
                  <Plus className="h-4 w-4" /> 发布闲置
                </Button>
              </div>

              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {["全部", "已上架", "已下架", "已售出"].map((s) => (
                  <Button
                    key={s}
                    variant={s === myProductsStatusFilter ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 h-7 text-xs"
                    onClick={() => setMyProductsStatusFilter(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>

              <div className="space-y-3">
                {myProductsLoading ? (
                  <div className="text-center py-16 text-muted-foreground">加载中...</div>
                ) : filteredMyProducts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">暂无发布记录</div>
                ) : (
                  filteredMyProducts.map((product) => (
                    <div key={product.id} className="rounded-lg border border-border bg-card p-4 flex gap-4">
                      <div className="shrink-0">
                        <img
                          src={resolveAssetUrl(product.images?.[0])}
                          alt=""
                          className="h-20 w-20 rounded-md object-cover bg-muted"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium text-foreground line-clamp-1">{product.title}</h3>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-xs ${statusColorMap[product.status]}`}
                          >
                            {product.status}
                          </Badge>
                        </div>
                        <p className="text-lg font-bold text-destructive mt-1">¥{product.price}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {product.views}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Heart className="h-3 w-3" />
                            {product.favorites}
                          </span>
                          <span>{formatDateTime(product.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="上/下架"
                          disabled={product.status === "已售出"}
                          onClick={async () => {
                            const next = product.status === "已上架" ? "down" : "up";
                            try {
                              await api.changeProductStatus?.(product.id, next);
                              const nextStatus = next === "up" ? "已上架" : "已下架";
                              setMyProducts((list) =>
                                list.map((p) => (p.id === product.id ? { ...p, status: nextStatus } : p))
                              );
                              await refreshStats();
                            } catch (e: any) {
                              toast.error(e?.message || "操作失败");
                            }
                          }}
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title="删除"
                          onClick={() => setPendingDeleteProductId(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="favorites">
              <h2 className="text-lg font-bold text-foreground mb-4">我的收藏</h2>
              {favLoading ? (
                <div className="text-center py-16 text-muted-foreground">加载中...</div>
              ) : favProducts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">还没有收藏商品</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {favProducts.map((p) => (
                    <Card key={p.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <img
                          src={resolveAssetUrl(p.images?.[0])}
                          alt=""
                          className="h-28 w-full object-cover bg-muted"
                        />
                        <div className="p-3 space-y-1.5">
                          <div className="text-sm font-medium text-foreground line-clamp-1">{p.title}</div>
                          <div className="text-sm font-bold text-destructive">¥{p.price}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">我的订单</h2>
                <div className="flex gap-1 flex-wrap">
                  {(["全部", "买到", "卖出"] as const).map((x) => (
                    <Button
                      key={x}
                      variant={orderRoleFilter === x ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOrderRoleFilter(x)}
                    >
                      {x}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-1 mb-3 flex-wrap">
                {orderStatuses.map((s) => (
                  <Button
                    key={s}
                    variant={orderStatusFilter === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOrderStatusFilter(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>

              <OrderList
                orders={filterOrdersByStatus(
                  (orderRoleFilter === "全部"
                    ? mergedOrders
                    : mergedOrders.filter((o: any) => (orderRoleFilter === "买到" ? o._role === "buyer" : o._role === "seller"))) as unknown as Order[]
                )}
                loading={ordersLoading}
                statusText={orderStatusText}
                statusVariant={orderStatusVariant}
                onOpen={(id) => navigate(`/order/${id}`)}
                formatDateTime={formatDateTime}
              />
            </TabsContent>

            <TabsContent value="addresses">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">收货地址</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      <Plus className="h-4 w-4" /> 新增地址
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>新增收货地址</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>联系人</Label>
                          <Input
                            placeholder="收货人姓名"
                            value={addrForm.contact}
                            onChange={(e) => setAddrForm((f) => ({ ...f, contact: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>手机号</Label>
                          <Input
                            placeholder="联系电话"
                            value={addrForm.phone}
                            onChange={(e) => setAddrForm((f) => ({ ...f, phone: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>校区</Label>
                          <Select
                            value={addrForm.campus}
                            onValueChange={(v) => setAddrForm((f) => ({ ...f, campus: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择校区" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="东校区">东校区</SelectItem>
                              <SelectItem value="西校区">西校区</SelectItem>
                              <SelectItem value="南校区">南校区</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>楼栋</Label>
                          <Input
                            placeholder="如：6号宿舍楼"
                            value={addrForm.building}
                            onChange={(e) => setAddrForm((f) => ({ ...f, building: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>详细地址</Label>
                        <Input
                          placeholder="如：A503"
                          value={addrForm.detail}
                          onChange={(e) => setAddrForm((f) => ({ ...f, detail: e.target.value }))}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={addressesLoading}
                        onClick={async () => {
                          const isDefault = addresses.length === 0;
                          try {
                            await api.addAddress({
                              contact: addrForm.contact,
                              phone: addrForm.phone,
                              campus: addrForm.campus,
                              building: addrForm.building,
                              detail: addrForm.detail,
                              isDefault,
                            });
                            setAddrForm({ contact: "", phone: "", campus: "东校区", building: "", detail: "" });
                            await refreshAddresses();
                          } catch (e: any) {
                            toast.error(e?.message || "保存失败");
                          }
                        }}
                      >
                        保存地址
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-3">
                {addressesLoading ? (
                  <div className="text-center py-12 text-muted-foreground">加载中...</div>
                ) : addresses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">暂无收货地址，请添加</div>
                ) : (
                  addresses.map((addr) => (
                    <div
                      key={String(addr.id)}
                      className={`rounded-lg border bg-card p-4 ${
                        addr.isDefault ? "border-primary" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <MapPin
                            className={`h-5 w-5 mt-0.5 shrink-0 ${
                              addr.isDefault ? "text-primary" : "text-muted-foreground"
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">{addr.contact}</span>
                              <span className="text-sm text-muted-foreground">{addr.phone}</span>
                              {addr.isDefault && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  默认
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {addr.campus} · {addr.building} · {addr.detail}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {!addr.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={async () => {
                                await api.setDefaultAddress(Number(addr.id));
                                await refreshAddresses();
                              }}
                            >
                              设为默认
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setPendingDeleteAddressId(Number(addr.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="points">
              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-semibold text-foreground mb-4">积分中心</h3>
                  <PointsCenterContent />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <AlertDialog
            open={pendingDeleteProductId !== null}
            onOpenChange={(open) => {
              if (!open) setPendingDeleteProductId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除该商品？</AlertDialogTitle>
                <AlertDialogDescription>
                  删除后将无法恢复，该操作会同步更新你的发布列表。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (pendingDeleteProductId === null) return;
                    try {
                      await api.deleteProduct?.(pendingDeleteProductId);
                      setMyProducts((list) => list.filter((p) => p.id !== pendingDeleteProductId));
                      await refreshStats();
                      toast.success("删除成功");
                    } catch (e: any) {
                      toast.error(e?.message || "删除失败");
                    } finally {
                      setPendingDeleteProductId(null);
                    }
                  }}
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog
            open={pendingDeleteAddressId !== null}
            onOpenChange={(open) => {
              if (!open) setPendingDeleteAddressId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除该地址？</AlertDialogTitle>
                <AlertDialogDescription>
                  删除后该地址不可恢复，请确认是否继续。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (pendingDeleteAddressId === null) return;
                    try {
                      await api.deleteAddress(pendingDeleteAddressId);
                      await refreshAddresses();
                      toast.success("删除成功");
                    } catch (e: any) {
                      toast.error(e?.message || "删除失败");
                    } finally {
                      setPendingDeleteAddressId(null);
                    }
                  }}
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;

function OrderList({
  orders,
  loading,
  statusText,
  statusVariant,
  onOpen,
  formatDateTime,
}: {
  orders: Order[];
  loading: boolean;
  statusText: Record<string, string>;
  statusVariant: (s: string) => any;
  onOpen: (id: string) => void;
  formatDateTime: (date: any) => string;
}) {
  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">加载中...</div>;
  }
  if (orders.length === 0) {
    return <div className="text-center py-16 text-muted-foreground">暂无订单</div>;
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <button key={order.id} className="w-full text-left" onClick={() => onOpen(order.id)}>
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">订单号：{order.orderNo}</span>
                <Badge variant={statusVariant(order.status)}>
                  {statusText[order.status] || order.status}
                </Badge>
              </div>
              <div className="flex gap-3">
                <img
                  src={resolveAssetUrl(order.product.images?.[0])}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover shrink-0 bg-muted"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{order.product.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-primary">¥{order.amount}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}
