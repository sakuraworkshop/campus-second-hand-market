import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import ProductCard from "@/features/public/components/ProductCard";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type { Product } from "@/types";
import { normalizeProductImages } from "@/lib/product-images";

const Products = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("latest");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .listCategories()
      .then((rows) => {
        const top = rows.filter((c) => c.parentId == null).map((c) => ({ id: c.id, name: c.name }));
        setCategories(top);
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
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
          images: normalizeProductImages(p.images, p.image_url),
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
        setProducts(formattedProducts);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = products
    .filter((p) => p.status === "已上架")
    .filter((p) => selectedCategory === "all" || p.category === selectedCategory)
    .filter((p) => conditionFilter === "all" || p.condition === conditionFilter)
    .sort((a, b) => {
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      if (sortBy === "popular") return b.views - a.views;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-4 md:py-6">
          <h1 className="text-xl font-bold text-foreground mb-4">商品广场</h1>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-muted/50">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={selectedCategory === "all" ? "default" : "outline"}
                onClick={() => setSelectedCategory("all")}
                className="h-7 text-xs"
              >
                全部
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.name ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat.name)}
                  className="h-7 text-xs"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="h-8 w-[100px] text-xs">
                  <SelectValue placeholder="成色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部成色</SelectItem>
                  <SelectItem value="全新">全新</SelectItem>
                  <SelectItem value="几乎全新">几乎全新</SelectItem>
                  <SelectItem value="轻微使用">轻微使用</SelectItem>
                  <SelectItem value="明显使用">明显使用</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-[100px] text-xs">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">最新发布</SelectItem>
                  <SelectItem value="popular">最多浏览</SelectItem>
                  <SelectItem value="price-low">价格↑</SelectItem>
                  <SelectItem value="price-high">价格↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results */}
          <p className="text-sm text-muted-foreground mb-3">共 {filteredProducts.length} 件商品</p>
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              加载中...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {filteredProducts.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  暂无符合条件的商品 🔍
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Products;
