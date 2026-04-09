import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Edit, ArrowUpDown, Trash2, Eye, Heart, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { resolveAssetUrl } from "@/lib/assets";
import { normalizeProductImages } from "@/lib/product-images";
import { useUtc8Time } from "@/hooks/use-utc8-time";

const statusColorMap: Record<string, string> = {
  "已上架": "bg-success/10 text-success border-success/20",
  "已下架": "bg-muted text-muted-foreground",
  "已售出": "bg-primary/10 text-primary border-primary/20",
};

const MyProducts = () => {
  const { formatDateTime } = useUtc8Time();
  const [statusFilter, setStatusFilter] = useState("全部");
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMine = async () => {
      const me = getMe();
      if (!me) return;
      setLoading(true);
      try {
        const products = await api.listProducts();
        const mine = products
          .filter((p: any) => Number(p.owner_id) === Number(me.id))
          .map((p: any) => ({
            id: String(p.id),
            title: p.title,
            images: normalizeProductImages(p.images, p.image_url),
            price: Number(p.price || 0),
            views: p.views || 0,
            favorites: p.favorites || 0,
            createdAt: p.created_at || "",
            status:
              p.status === "approved"
                ? "已上架"
                : p.status === "completed"
                ? "已售出"
                : "已下架",
          }));
        setMyProducts(mine);
      } catch {
        setMyProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMine();
  }, []);

  const filteredProducts = useMemo(() => {
    if (statusFilter === "全部") return myProducts;
    return myProducts.filter((p) => p.status === statusFilter);
  }, [myProducts, statusFilter]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-3xl py-4 md:py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-foreground">我的发布</h1>
            <Link to="/publish">
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> 发布闲置</Button>
            </Link>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {["全部", "已上架", "已下架", "已售出"].map((s) => (
              <Button
                key={s}
                variant={s === statusFilter ? "default" : "outline"}
                size="sm"
                className="shrink-0 h-7 text-xs"
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          {/* Product List */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-16 text-muted-foreground">加载中...</div>
            ) : (
              filteredProducts.map((product) => (
              <div key={product.id} className="rounded-lg border border-border bg-card p-4 flex gap-4">
                <Link to={`/product/${product.id}`} className="shrink-0">
                  <img
                    src={resolveAssetUrl(product.images?.[0])}
                    alt=""
                    className="h-20 w-20 rounded-md object-cover bg-muted"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/product/${product.id}`}>
                      <h3 className="text-sm font-medium text-foreground line-clamp-1 hover:text-primary">
                        {product.title}
                      </h3>
                    </Link>
                    <Badge variant="outline" className={`shrink-0 text-xs ${statusColorMap[product.status]}`}>
                      {product.status}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold text-destructive mt-1">¥{product.price}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{product.views}</span>
                    <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{product.favorites}</span>
                    <span>{formatDateTime(product.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="编辑">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="上/下架">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="删除">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MyProducts;
