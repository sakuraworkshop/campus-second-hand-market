import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { toast } from "sonner";

function Stars({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const v = i + 1;
        const active = v <= value;
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`text-xl leading-none ${active ? "text-yellow-400" : "text-muted-foreground/40"} ${disabled ? "cursor-not-allowed" : "hover:opacity-80"}`}
            aria-label={`评分 ${v} 星`}
          >
            ★
          </button>
        );
      })}
      <span className="ml-2 text-sm text-muted-foreground">{value ? `${value}/5` : "未评分"}</span>
    </div>
  );
}

export default function OrderEvaluate() {
  const { id } = useParams<{ id: string }>();
  const orderId = useMemo(() => Number(id), [id]);
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<any | null>(null);
  const [existing, setExisting] = useState<any | null>(null);

  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!Number.isFinite(orderId) || orderId <= 0) {
        setLoading(false);
        setOrder(null);
        return;
      }

      setLoading(true);
      try {
        const [o, e] = await Promise.all([api.getOrder(orderId), api.getMyEvaluation(orderId)]);
        setOrder(o);
        setExisting(e);
      } catch (err) {
        console.error("加载订单/评价失败", err);
        setOrder(null);
        setExisting(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [orderId]);

  const me = getMe();
  const isBuyer = me && order ? String(order.buyer?.id ?? order.buyer_id ?? "") === String(me.id) : false;
  const targetType: "buyer" | "seller" = isBuyer ? "seller" : "buyer";
  const targetName = isBuyer ? (order?.seller?.nickname || "卖家") : (order?.buyer?.nickname || "买家");

  const canSubmit = !loading && !!order && order?.status === "completed" && !existing;

  const onSubmit = async () => {
    if (!canSubmit) return;
    const c = content.trim();
    if (!rating || rating < 1 || rating > 5) return toast.error("请先选择评分（1-5星）");
    if (!c) return toast.error("请填写评价内容");
    if (c.length < 3) return toast.error("评价内容至少 3 个字");
    if (c.length > 500) return toast.error("评价内容最多 500 字");

    setSubmitting(true);
    try {
      await api.createEvaluation(orderId, { rating, content: c, target_type: targetType });
      const e = await api.getMyEvaluation(orderId);
      setExisting(e);
      toast.success("评价成功");
      nav(`/order/${orderId}`);
    } catch (err: any) {
      toast.error(err?.message || "评价失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (!me) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">请先登录</div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 max-w-2xl">
        <Link to={`/order/${orderId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          返回订单
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">评价订单</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">加载中...</div>
            ) : !order ? (
              <div className="text-sm text-muted-foreground">订单不存在或无权限</div>
            ) : existing ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">你已评价过该订单。</div>
                <Stars value={Number(existing.rating) || 0} onChange={() => {}} disabled />
                <div className="text-sm whitespace-pre-wrap">{existing.content}</div>
                <Button variant="outline" onClick={() => nav(`/order/${orderId}`)}>返回订单详情</Button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">评价对象：{targetName}</div>
                  <Stars value={rating} onChange={setRating} disabled={!canSubmit || submitting} />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">评价内容</div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="写下你的交易体验（至少 3 个字）"
                    disabled={!canSubmit || submitting}
                    className="min-h-[120px]"
                  />
                  <div className="text-xs text-muted-foreground text-right">{content.trim().length}/500</div>
                </div>

                {order?.status !== "completed" && (
                  <div className="text-sm text-muted-foreground">只有“已完成”的订单可以评价。</div>
                )}

                <Button onClick={onSubmit} disabled={!canSubmit || submitting} className="w-full">
                  {submitting ? "提交中..." : "提交评价"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

