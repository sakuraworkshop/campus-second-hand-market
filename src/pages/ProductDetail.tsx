import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, ShoppingCart, ChevronLeft, Eye, MapPin, Clock, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { isFavorited, toggleFavorite } from "@/lib/favorites";
import { api } from "@/lib/api";
import type { Product } from "@/types";
import { getMe } from "@/lib/auth";
import { resolveAssetUrl } from "@/lib/assets";
import { normalizeProductImages } from "@/lib/product-images";
import { toast } from "sonner";
import { useUtc8Time } from "@/hooks/use-utc8-time";

const ProductDetail = () => {
  const { formatDateTime } = useUtc8Time();
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImage, setCurrentImage] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isFav, setIsFav] = useState(() => (id ? isFavorited(id) : false));

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getProduct(Number(id))
      .then((data) => {
        // 转换API返回的数据格式以匹配前端类型
        const formattedProduct: Product = {
          id: data.id.toString(),
          title: data.title,
          description: data.description,
          price: data.price,
          originalPrice: data.originalPrice,
          condition: data.condition || "轻微使用",
          images: normalizeProductImages(data.images, data.image_url),
          category: data.category || "其他",
          categoryId: data.category_id || "",
          seller: {
            id: data.owner_id?.toString() || "",
            nickname: data.owner_name || "未知卖家",
            avatar: ""
          },
          status: data.status === "down" || data.status === "deleted" ? "已下架" : "已上架",
          views: data.views || 0,
          favorites: data.favorites || 0,
          campus: data.campus || "",
          createdAt: data.created_at || new Date().toISOString().split('T')[0]
        };
        setProduct(formattedProduct);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">商品不存在或已下架</div>
      </div>
    );
  }

  const handleToggleFavorite = async () => {
    if (!product) return;
    const user = getMe();
    if (!user) {
      toast.info("请先登录");
      return;
    }
    
    try {
      if (isFav) {
        await api.removeFavorite(user.id, Number(product.id));
      } else {
        await api.addFavorite(user.id, Number(product.id));
      }
      const next = toggleFavorite(product.id);
      setIsFav(next);
    } catch (error) {
      toast.error("操作失败");
    }
  };

  const handleContactSeller = () => {
    if (!product) return;
    const user = getMe();
    if (!user) {
      toast.info("请先登录");
      return;
    }
    const targetUserId = Number(product.seller.id);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      toast.error("卖家信息异常，无法发起聊天");
      return;
    }
    api.startConversation({ targetUserId, productId: Number(product.id) })
      .then((r) => navigate(`/chat/${r.id}`))
      .catch((e: any) => toast.error(e?.message || "发起聊天失败"));
  };

  const handleBuyNow = () => {
    if (!product) return;
    const user = getMe();
    if (!user) {
      toast.info("请先登录");
      return;
    }

    api
      .listAddresses()
      .then(async (addresses) => {
        const defaultAddress = addresses.find((a: any) => a.isDefault) || addresses[0];
        if (!defaultAddress) {
          toast.info("请先新增收货地址");
          navigate("/addresses");
          return;
        }

        const deliveryAddress = `${defaultAddress.campus} ${defaultAddress.building} ${defaultAddress.detail}`;
        const deliveryTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const order = await api.createOrder({
          product_id: Number(product.id),
          deliveryAddress,
          deliveryTime,
        });

        const orderId = (order as any)?.id;
        if (orderId) {
          navigate(`/order/${orderId}`);
        } else {
          navigate("/profile?tab=orders");
        }
      })
      .catch((e: any) => {
        toast.error(e?.message || "下单失败，请重试");
      });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-4 md:py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link to="/products" className="flex items-center gap-1 hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> 商品广场
            </Link>
            <span>/</span>
            <span>{product.category}</span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Images */}
            <div className="space-y-3">
              <div
                className="aspect-square rounded-xl overflow-hidden bg-muted cursor-zoom-in"
                onClick={() => setPreviewOpen(true)}
                title="点击放大查看"
              >
                <img src={resolveAssetUrl(product.images[currentImage])} alt={product.title} className="h-full w-full object-cover" />
              </div>
              {product.images.length > 1 && (
                <div className="flex gap-2">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentImage(i);
                        setPreviewOpen(true);
                      }}
                      className={`h-16 w-16 rounded-md overflow-hidden border-2 transition-colors ${i === currentImage ? "border-primary" : "border-transparent"}`}
                      title="点击放大查看"
                    >
                      <img src={resolveAssetUrl(img)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-4">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">{product.title}</h1>
              
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-destructive">¥{product.price}</span>
                {product.originalPrice && (
                  <span className="text-sm text-muted-foreground line-through">原价 ¥{product.originalPrice}</span>
                )}
                {product.originalPrice && (
                  <Badge variant="secondary" className="text-xs">
                    省 ¥{product.originalPrice - product.price}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{product.condition}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{product.campus}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDateTime(product.createdAt)}</span>
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{product.views} 浏览</span>
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{product.favorites} 收藏</span>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="font-medium text-foreground mb-2">商品描述</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
              </div>

              {/* Seller Info */}
              <div className="border-t border-border pt-4">
                <h3 className="font-medium text-foreground mb-2">卖家信息</h3>
                <div className="flex items-center gap-3">
                  <img src={resolveAssetUrl(product.seller.avatar)} alt="" className="h-10 w-10 rounded-full bg-muted" />
                  <div>
                    <p className="font-medium text-foreground">{product.seller.nickname}</p>
                    <p className="text-xs text-muted-foreground">{product.campus}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleToggleFavorite}
                >
                  <Heart className={`h-4 w-4 ${isFav ? "fill-destructive text-destructive" : ""}`} />
                  {isFav ? "已收藏" : "收藏"}
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleContactSeller}>
                  <MessageCircle className="h-4 w-4" />
                  联系卖家
                </Button>
                <Button className="flex-1 gap-2" onClick={handleBuyNow}>
                  <ShoppingCart className="h-4 w-4" />
                  立即购买
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl w-[95vw] p-2 sm:p-4">
          <div className="w-full flex items-center justify-center bg-muted rounded-md overflow-hidden max-h-[80vh]">
            <img
              src={resolveAssetUrl(product.images[currentImage])}
              alt={product.title}
              className="max-h-[80vh] w-auto object-contain"
            />
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImage(i)}
                  className={`h-14 w-14 rounded-md overflow-hidden border-2 shrink-0 ${i === currentImage ? "border-primary" : "border-transparent"}`}
                >
                  <img src={resolveAssetUrl(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductDetail;
