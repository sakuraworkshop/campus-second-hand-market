import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { useUtc8Time } from "@/hooks/use-utc8-time";

const FavoriteManagement = () => {
  const { formatDateTime } = useUtc8Time();
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [userId, setUserId] = useState("");
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await api.adminListFavorites({
        product_id: productId ? Number(productId) : undefined,
        user_id: userId ? Number(userId) : undefined,
      });
      setFavorites(list);
    } catch (error) {
      console.error("Failed to load favorites:", error);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [productId, userId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索收藏..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Input type="number" placeholder="商品ID" value={productId} onChange={(e) => setProductId(e.target.value)} className="w-32" />
          <Input type="number" placeholder="用户ID" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-32" />
        </div>
        <Button onClick={refresh} variant="default" size="sm">
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">收藏管理</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>收藏ID</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>商品价格</TableHead>
                <TableHead>收藏时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : favorites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    暂无收藏记录
                  </TableCell>
                </TableRow>
              ) : (
                favorites.map((favorite) => (
                  <TableRow key={favorite.id}>
                    <TableCell className="font-medium">{favorite.id}</TableCell>
                    <TableCell>{favorite.user_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{favorite.product_title}</TableCell>
                    <TableCell className="text-primary">¥{favorite.product_price}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(favorite.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FavoriteManagement;