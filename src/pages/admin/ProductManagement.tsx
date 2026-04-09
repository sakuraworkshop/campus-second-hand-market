import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Grid2X2, List, Search, ArrowDownToLine, ArrowUpFromLine, Trash2, SquarePen } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { resolveAssetUrl } from "@/lib/assets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeProductImages } from "@/lib/product-images";
import { useUtc8Time } from "@/hooks/use-utc8-time";

type ViewMode = "table" | "grid";
type ProductStatus = "approved" | "down" | "deleted" | string;
type ProductStatusFilter = "all" | "approved" | "down" | "deleted";

type AdminProduct = {
  id: number | string;
  title?: string;
  description?: string;
  price?: number | string;
  image_url?: string | null;
  images?: any;
  condition?: string | null;
  category_id?: string | null;
  campus?: string | null;
  reject_reason?: string | null;
  seller_name?: string | null;
  seller_id?: number | string | null;
  status?: ProductStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

function statusText(s: ProductStatus) {
  if (s === "approved") return "已上架";
  if (s === "down") return "已下架/隐藏";
  if (s === "deleted") return "已删除";
  return s || "-";
}

function statusVariant(s: ProductStatus) {
  if (s === "approved") return "default" as const;
  if (s === "down") return "secondary" as const;
  if (s === "deleted") return "destructive" as const;
  return "outline" as const;
}

const ProductManagement = () => {
  const { formatDate } = useUtc8Time();
  const [view, setView] = useState<ViewMode>("table");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<AdminProduct[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailError, setDetailError] = useState<string>("");
  const [detail, setDetail] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    image_url: "",
    condition: "",
    category_id: "",
    campus: "",
    reject_reason: "",
  });

  const [categories, setCategories] = useState<Array<{ id: string; name: string; parentId?: string | null }>>([]);
  const [conditionOptions, setConditionOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [campusOptions, setCampusOptions] = useState<Array<{ value: string; label: string }>>([]);

  const statusOptions: Array<{ id: ProductStatusFilter; label: string }> = [
    { id: "all", label: "全部" },
    { id: "approved", label: "已上架" },
    { id: "down", label: "已下架/隐藏" },
    { id: "deleted", label: "已删除" },
  ];

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await api.adminListProducts({
        status: statusFilter === "all" ? undefined : statusFilter,
        keyword: keyword.trim() ? keyword.trim() : undefined,
      });
      setList(rows || []);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    api
      .adminListCategories()
      .then((rows: any[]) => {
        setCategories((rows || []).map((c) => ({ id: c.id, name: c.name, parentId: c.parentId ?? null })));
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    api
      .listDicts("condition")
      .then((rows) => setConditionOptions((rows || []).map((x) => ({ value: x.value, label: x.label }))))
      .catch(() => setConditionOptions([]));

    api
      .listDicts("campus")
      .then((rows) => setCampusOptions((rows || []).map((x) => ({ value: x.value, label: x.label }))))
      .catch(() => setCampusOptions([]));
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return list;
    return list.filter((p) => String(p.title || "").includes(kw) || String(p.seller_name || "").includes(kw));
  }, [list, keyword]);

  const setStatus = async (id: number, status: "approved" | "down" | "deleted") => {
    await api.adminSetProductStatus(id, status);
    await refresh();
  };

  const openDetail = async (p: AdminProduct) => {
    const id = Number(p.id);
    setDrawerOpen(true);
    setActiveId(id);
    setDetail(null);
    setDetailError("");

    // 先用列表里的数据做“即时回显”，避免抽屉空白
    setForm({
      title: String(p.title ?? ""),
      description: String(p.description ?? ""),
      price: p.price == null ? "" : String(p.price),
      image_url: String(p.image_url ?? ""),
      condition: String(p.condition ?? ""),
      category_id: String(p.category_id ?? ""),
      campus: String(p.campus ?? ""),
      reject_reason: String((p as any).reject_reason ?? ""),
    });
    setDetail(p);

    setDetailLoading(true);
    try {
      const item = (await api.adminGetProduct(id)) as AdminProduct;
      setDetail(item);
      setForm({
        title: String(item.title ?? ""),
        description: String(item.description ?? ""),
        price: item.price == null ? "" : String(item.price),
        image_url: String(item.image_url ?? ""),
        condition: String(item.condition ?? ""),
        category_id: String(item.category_id ?? ""),
        campus: String(item.campus ?? ""),
        reject_reason: String((item as any).reject_reason ?? ""),
      });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "获取商品详情失败";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDetail = async () => {
    if (!activeId) return;
    setSaving(true);
    try {
      await api.adminUpdateProduct(activeId, {
        title: form.title.trim(),
        description: form.description,
        price: form.price === "" ? undefined : Number(form.price),
        image_url: form.image_url.trim() || undefined,
        condition: form.condition.trim() || undefined,
        category_id: form.category_id.trim() || undefined,
        campus: form.campus.trim() || undefined,
        reject_reason: form.reject_reason.trim() || undefined,
      });
      await refresh();
      const item = (await api.adminGetProduct(activeId)) as AdminProduct;
      setDetail(item);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索商品标题/卖家..."
            className="pl-9"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") refresh();
            }}
          />
        </div>

        <div className="flex gap-1">
          {statusOptions.map((s) => (
            <Button
              key={s.id}
              variant={statusFilter === s.id ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-1">
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => setView("table")}
            title="表格视图"
          >
            <List className="h-4 w-4" />
            表格
          </Button>
          <Button
            variant={view === "grid" ? "default" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => setView("grid")}
            title="卡片视图"
          >
            <Grid2X2 className="h-4 w-4" />
            卡片
          </Button>
        </div>

        <Button onClick={refresh} variant="default" size="sm" disabled={loading}>
          {loading ? "加载中..." : "刷新"}
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">商品管理</CardTitle>
        </CardHeader>
        <CardContent className={cn(view === "table" ? "p-0" : "pb-6")}>
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">暂无商品</div>
          ) : view === "table" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>卖家</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>发布时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const imgs = normalizeProductImages(p.images, p.image_url);
                          const cover = imgs[0];
                          return (
                        <img
                          src={
                            resolveAssetUrl(cover) ||
                            "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=200&h=200&fit=crop"
                          }
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                        />
                          );
                        })()}
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate max-w-[260px]">{p.title}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                            ID: {p.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-primary">¥{p.price}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.seller_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(p.status)}>{statusText(p.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(p.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => openDetail(p)}
                          title="详情/编辑"
                        >
                          <SquarePen className="h-4 w-4" />
                          详情
                        </Button>
                        {p.status !== "approved" && p.status !== "deleted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => setStatus(Number(p.id), "approved")}
                            title="上架"
                          >
                            <ArrowUpFromLine className="h-4 w-4" />
                            上架
                          </Button>
                        )}
                        {p.status === "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => setStatus(Number(p.id), "down")}
                            title="下架/隐藏"
                          >
                            <ArrowDownToLine className="h-4 w-4" />
                            下架
                          </Button>
                        )}
                        {p.status !== "deleted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive"
                            onClick={() => setStatus(Number(p.id), "deleted")}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                            删除
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="aspect-[16/9] bg-muted">
                    {(() => {
                      const imgs = normalizeProductImages(p.images, p.image_url);
                      const cover = imgs[0];
                      return (
                    <img
                      src={
                        resolveAssetUrl(cover) ||
                        "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&h=450&fit=crop"
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                      );
                    })()}
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground">ID: {p.id}</div>
                      </div>
                      <Badge variant={statusVariant(p.status)} className="shrink-0">
                        {statusText(p.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-primary">¥{p.price}</div>
                      <div className="text-muted-foreground truncate max-w-[180px]">
                        卖家：{p.seller_name || "-"}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="secondary" size="sm" className="gap-1" onClick={() => openDetail(p)}>
                        <SquarePen className="h-4 w-4" />
                        详情
                      </Button>
                      {p.status !== "approved" && p.status !== "deleted" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1"
                          onClick={() => setStatus(Number(p.id), "approved")}
                        >
                          <ArrowUpFromLine className="h-4 w-4" />
                          上架
                        </Button>
                      )}
                      {p.status === "approved" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1"
                          onClick={() => setStatus(Number(p.id), "down")}
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          下架
                        </Button>
                      )}
                      {p.status !== "deleted" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1 ml-auto"
                          onClick={() => setStatus(Number(p.id), "deleted")}
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v);
          if (!v) {
            setActiveId(null);
            setDetail(null);
            setUploading(false);
            setSaving(false);
            setDetailLoading(false);
          }
        }}
      >
        <SheetContent side="right" className="w-[95vw] sm:max-w-2xl p-0">
          <SheetHeader className="p-6 pb-3">
            <SheetTitle>商品详情与配置</SheetTitle>
            <SheetDescription>
              {detail?.id ? `ID: ${detail.id}` : activeId ? `ID: ${activeId}` : ""}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-160px)] px-6 pb-6">
            {detailLoading ? (
              <div className="py-16 text-center text-muted-foreground">加载中...</div>
            ) : !activeId ? (
              <div className="py-16 text-center text-muted-foreground">未选择商品</div>
            ) : (
              <div className="space-y-5">
                {detailError ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    详情接口拉取失败：{detailError}。当前显示的是列表里的缓存数据（可能不完整）。
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <img
                    src={
                      resolveAssetUrl(form.image_url) ||
                      "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=240&h=240&fit=crop"
                    }
                    alt=""
                    className="h-24 w-24 rounded-lg object-cover border"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={statusVariant(detail?.status)}>{statusText(detail?.status)}</Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        卖家：{detail?.seller_name || "-"}（{detail?.seller_id ?? "-"}）
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {detail?.status !== "approved" && detail?.status !== "deleted" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1"
                          onClick={async () => {
                            await setStatus(activeId, "approved");
                            const item = (await api.adminGetProduct(activeId)) as AdminProduct;
                            await openDetail(item);
                          }}
                        >
                          <ArrowUpFromLine className="h-4 w-4" />
                          上架
                        </Button>
                      )}
                      {detail?.status === "approved" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1"
                          onClick={async () => {
                            await setStatus(activeId, "down");
                            const item = (await api.adminGetProduct(activeId)) as AdminProduct;
                            await openDetail(item);
                          }}
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          下架
                        </Button>
                      )}
                      {detail?.status !== "deleted" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={async () => {
                            await setStatus(activeId, "deleted");
                            setDrawerOpen(false);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">标题</label>
                    <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">描述</label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="商品描述"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">价格</label>
                      <Input
                        value={form.price}
                        onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                        placeholder="如：99.9"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">成色</label>
                      <Select
                        value={form.condition || ""}
                        onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择成色" />
                        </SelectTrigger>
                        <SelectContent>
                          {form.condition && !conditionOptions.some((x) => x.value === form.condition) ? (
                            <SelectItem value={form.condition}>{form.condition}（历史值）</SelectItem>
                          ) : null}
                          {conditionOptions.map((x) => (
                            <SelectItem key={x.value} value={x.value}>
                              {x.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">分类ID</label>
                      <Select
                        value={form.category_id || ""}
                        onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择分类" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.parentId ? `└ ${cat.name}` : cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-xs text-muted-foreground mt-1">
                        当前：{form.category_id || "-"}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">校区</label>
                      <Select value={form.campus || ""} onValueChange={(v) => setForm((f) => ({ ...f, campus: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择校区" />
                        </SelectTrigger>
                        <SelectContent>
                          {form.campus && !campusOptions.some((x) => x.value === form.campus) ? (
                            <SelectItem value={form.campus}>{form.campus}（历史值）</SelectItem>
                          ) : null}
                          {campusOptions.map((x) => (
                            <SelectItem key={x.value} value={x.value}>
                              {x.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">主图（image_url）</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={form.image_url}
                        onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                        placeholder="上传后自动填充，或粘贴图片URL/相对路径"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={uploading}
                        onClick={() => {
                          const el = document.getElementById("admin-product-image-file") as HTMLInputElement | null;
                          el?.click();
                        }}
                      >
                        {uploading ? "上传中..." : "替换图片"}
                      </Button>
                      <input
                        id="admin-product-image-file"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          try {
                            const r = await api.ossUploadFile(file, "products");
                            // 优先存相对路径，避免把 localhost 写进数据库
                            setForm((f) => ({ ...f, image_url: r.path || r.url }));
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setUploading(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">驳回原因（可选）</label>
                    <Textarea
                      value={form.reject_reason}
                      onChange={(e) => setForm((f) => ({ ...f, reject_reason: e.target.value }))}
                      placeholder="reject_reason"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                      关闭
                    </Button>
                    <Button onClick={saveDetail} disabled={saving || detailLoading}>
                      {saving ? "保存中..." : "保存修改"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProductManagement;

