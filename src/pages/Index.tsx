import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import HeroCarousel from "@/features/public/components/HeroCarousel";
import CategoryNav from "@/features/public/components/CategoryNav";
import ProductCard from "@/features/public/components/ProductCard";
import { Link } from "react-router-dom";
import { ArrowRight, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/types";

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    // 获取公告
    api
      .listAnnouncements()
      .then((data) => {
        if (data.length > 0) {
          setAnnouncement({ title: data[0].title, content: data[0].content });
        }
      })
      .catch(() => setAnnouncement(null));

    // 获取最新商品
    setLoading(true);
    api
      .listProducts()
      .then((data) => {
        // 转换API返回的数据格式以匹配前端类型
        const formattedProducts: Product[] = data.map((p: any) => ({
          id: p.id.toString(),
          title: p.title,
          description: p.description,
          price: p.price,
          originalPrice: p.originalPrice,
          condition: p.condition || "轻微使用",
          images: p.images || (p.image_url ? [p.image_url] : []),
          category: p.category || "其他",
          categoryId: p.category_id || "",
          seller: {
            id: p.owner_id.toString(),
            nickname: p.owner_name || "未知卖家",
            avatar: ""
          },
          status: p.status === "down" || p.status === "deleted" ? "已下架" : "已上架",
          views: p.views || 0,
          favorites: p.favorites || 0,
          campus: p.campus || "",
          createdAt: p.created_at || new Date().toISOString().split('T')[0]
        }));
        setProducts(formattedProducts.filter(p => p.status === "已上架").slice(0, 8));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-4 md:py-6 space-y-6">
          {/* Announcements */}
          {announcement && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm">
              <Megaphone className="h-4 w-4 shrink-0" />
              <div className="flex-1 truncate">
                {announcement.title} — {announcement.content}
              </div>
              <Link to="/announcements" className="text-primary hover:underline shrink-0 text-xs">更多</Link>
            </div>
          )}

          {/* Hero + Categories */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <HeroCarousel />
            </div>
            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
              <h2 className="text-lg font-semibold text-foreground mb-3">商品分类</h2>
              <CategoryNav />
            </div>
          </section>

          {/* Products */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">最新闲置</h2>
              <Link to="/products">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  查看全部 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {loading ? (
              <div className="text-center py-16 text-muted-foreground">
                加载中...
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
