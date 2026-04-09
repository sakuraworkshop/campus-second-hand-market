import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/assets";
import { normalizeProductImages } from "@/lib/product-images";
import { useUtc8Time } from "@/hooks/use-utc8-time";

type OrderDetailDialogProps = {
  orderId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const statusMap: Record<string, string> = {
  pending: "待确认",
  confirmed: "待交付",
  completed: "已完成",
  cancelled: "已取消",
};

function statusVariant(status: string) {
  if (status === "completed") return "default" as const;
  if (status === "pending") return "secondary" as const;
  if (status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

export default function OrderDetailDialog({ orderId, open, onOpenChange }: OrderDetailDialogProps) {
  const { formatDateTime } = useUtc8Time();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    api
      .getOrder(orderId)
      .then((res) => setDetail(res))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, orderId]);

  const cover = useMemo(() => {
    const images = normalizeProductImages(detail?.product?.images, detail?.product?.image_url);
    return images[0] || "";
  }, [detail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>订单详情</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground">加载中...</div>
        ) : !detail ? (
          <div className="py-10 text-center text-muted-foreground">订单不存在或加载失败</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">订单号</div>
                  <div className="font-medium">{detail.orderNo || detail.id}</div>
                </div>
                <Badge variant={statusVariant(detail.status)}>
                  {statusMap[detail.status] || detail.status || "-"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-muted-foreground text-xs">买家 / 卖家</div>
                  <div className="mt-1">
                    {(detail.buyer?.nickname || "-")} / {(detail.seller?.nickname || "-")}
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-muted-foreground text-xs">下单时间</div>
                  <div className="mt-1">{formatDateTime(detail.created_at)}</div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-muted-foreground text-xs">订单金额</div>
                  <div className="mt-1 font-medium text-primary">¥{detail.amount ?? detail.product?.price ?? "-"}</div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-muted-foreground text-xs">交付时间</div>
                  <div className="mt-1">{formatDateTime(detail.deliveryTime)}</div>
                </div>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="text-muted-foreground text-xs">交付地址</div>
                <div className="mt-1 break-all">{detail.deliveryAddress || "-"}</div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="text-sm font-medium mb-3">商品信息</div>
              <div className="flex gap-3">
                <img
                  src={resolveAssetUrl(cover)}
                  alt=""
                  className="h-20 w-20 rounded-md object-cover bg-muted shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{detail.product?.title || "-"}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    商品ID：{detail.product?.id || "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    状态：{detail.product?.status || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="text-sm font-medium mb-3">订单时间轴</div>
              {Array.isArray(detail.timeline) && detail.timeline.length > 0 ? (
                <div className="space-y-3">
                  {detail.timeline.map((item: any, idx: number) => (
                    <div key={`${item?.time || ""}-${idx}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-2.5 w-2.5 rounded-full ${idx === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                        {idx < detail.timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="pb-2">
                        <div className="text-sm">{item?.content || "-"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatDateTime(item?.time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">暂无时间轴数据</div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

