import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useUtc8Time } from "@/hooks/use-utc8-time";
import OrderDetailDialog from "@/components/OrderDetailDialog";

const OrderManagement = () => {
  const { formatDateTime } = useUtc8Time();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "全部">("全部");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  const statusFilters = ["全部", "pending", "confirmed", "completed", "cancelled"];

  const mapStatus = (status: string): string => {
    if (status === "pending") return "待确认";
    if (status === "confirmed") return "待交付";
    if (status === "completed") return "已完成";
    if (status === "cancelled") return "已取消";
    return status;
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.adminListOrders({
        status: statusFilter === "全部" ? undefined : statusFilter,
        keyword: search || undefined,
      });
      setOrders(list);
    } catch (error) {
      console.error("Failed to load orders:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索订单号、商品名称、买家或卖家..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {statusFilters.map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s}
            </Button>
          ))}
        </div>
        <Button onClick={refresh} variant="default" size="sm">
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">订单管理</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>商品</TableHead>
                <TableHead>价格</TableHead>
                <TableHead>买家</TableHead>
                <TableHead>卖家</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    暂无订单
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNo}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{order.product_title}</TableCell>
                    <TableCell className="text-primary">¥{order.product_price}</TableCell>
                    <TableCell>{order.buyer_name}</TableCell>
                    <TableCell>{order.seller_name}</TableCell>
                    <TableCell>
                      <Badge variant={
                        order.status === "completed" ? "default" :
                        order.status === "pending" ? "secondary" :
                        order.status === "cancelled" ? "destructive" : "outline"
                      }>
                        {mapStatus(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(order.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setActiveOrderId(Number(order.id))}
                        title="查看订单详情"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <OrderDetailDialog
        open={activeOrderId !== null}
        orderId={activeOrderId}
        onOpenChange={(next) => {
          if (!next) setActiveOrderId(null);
        }}
      />
    </div>
  );
};

export default OrderManagement;