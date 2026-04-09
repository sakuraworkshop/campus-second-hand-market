import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Ban, RotateCcw, Shield, ShieldCheck, RefreshCw, KeyRound, Upload, Phone, Eye } from "lucide-react";
import { resolveAssetUrl } from "@/lib/assets";
import { useUtc8Time } from "@/hooks/use-utc8-time";
import OrderDetailDialog from "@/components/OrderDetailDialog";

type Detail = Awaited<ReturnType<typeof api.adminGetUserDetail>>;

export default function UserDetail() {
  const { formatDateTime } = useUtc8Time();
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = Number(id);

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  const refresh = async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setError("无效的用户ID");
      setDetail(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [r, l, c, e, ch] = await Promise.all([
        api.adminGetUserDetail(userId),
        api.adminGetUserLogs(userId, 10000).catch(() => []),
        api.adminGetUserComplaints(userId, 10000).catch(() => []),
        api.adminGetUserEvaluations(userId, 10000).catch(() => []),
        api.adminGetUserChats(userId, 10000).catch(() => []),
      ]);
      setDetail(r);
      setLogs(l || []);
      setComplaints(c || []);
      setEvaluations(e || []);
      setChats(ch || []);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "加载失败");
      setDetail(null);
      setLogs([]);
      setComplaints([]);
      setEvaluations([]);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const toggleBan = async () => {
    if (!detail) return;
    const next = detail.user.status === "banned" ? "active" : "banned";
    await api.adminSetUserStatus(detail.user.id, next);
    await refresh();
  };

  const toggleRole = async () => {
    if (!detail) return;
    const next = detail.user.role === "admin" ? "user" : "admin";
    await api.adminSetUserRole(detail.user.id, next);
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")} title="返回用户列表">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
          <Button variant="outline" size="sm" className="gap-1" onClick={refresh} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
          {detail ? (
            <>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { setPwd(""); setPwdOpen(true); }}>
                <KeyRound className="h-4 w-4" />
                重置密码
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setPhone(detail.user.phone || "");
                  setPhoneOpen(true);
                }}
              >
                <Phone className="h-4 w-4" />
                修改手机号
              </Button>
              <Button variant="secondary" size="sm" className="gap-1" onClick={toggleRole}>
                {detail.user.role === "admin" ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Shield className="h-4 w-4" />}
                {detail.user.role === "admin" ? "取消管理员" : "设为管理员"}
              </Button>
              <Button variant={detail.user.status === "banned" ? "secondary" : "destructive"} size="sm" className="gap-1" onClick={toggleBan}>
                {detail.user.status === "banned" ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                {detail.user.status === "banned" ? "解封" : "封禁"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{error}</CardContent>
        </Card>
      ) : loading && !detail ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">加载中...</CardContent>
        </Card>
      ) : detail ? (
        <>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">用户详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none"
                    disabled={avatarUploading}
                    onClick={() => {
                      const el = document.getElementById("admin-user-avatar-file") as HTMLInputElement | null;
                      el?.click();
                    }}
                    title={avatarUploading ? "上传中..." : "点击更换头像"}
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={resolveAssetUrl(detail.user.avatar)} />
                      <AvatarFallback>{(detail.user.nickname || "U")[0]}</AvatarFallback>
                    </Avatar>
                    <span className="pointer-events-none absolute inset-0 rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                      <Upload className="h-4 w-4" />
                    </span>
                    {avatarUploading ? (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-[11px] text-white">
                        上传中...
                      </span>
                    ) : null}
                  </button>
                  <input
                    id="admin-user-avatar-file"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !detail) return;
                      setAvatarUploading(true);
                      try {
                        const r = await api.ossUploadFile(file, "avatars");
                        await api.adminSetUserAvatar(detail.user.id, r.path || r.url);
                        await refresh();
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setAvatarUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <div className="font-semibold text-foreground truncate max-w-[24rem]">
                      {detail.user.nickname}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[20rem]">
                      ID: {detail.user.id}
                    </div>
                    <Badge variant={detail.user.role === "admin" ? "default" : "secondary"}>
                      {detail.user.role === "admin" ? "管理员" : "用户"}
                    </Badge>
                    <Badge variant={detail.user.status === "active" ? "outline" : "destructive"}>
                      {detail.user.status === "active" ? "正常" : "已封禁"}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground mt-1">
                  {detail.user.bio || "-"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div className="rounded-md border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">手机号</div>
                  <div className="mt-0.5 font-medium break-all">{detail.user.phone || "-"}</div>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">性别</div>
                  <div className="mt-0.5 font-medium">{detail.user.gender || "-"}</div>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">注册时间</div>
                  <div className="mt-0.5 font-medium">
                    {formatDateTime(detail.user.created_at)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">详细信息</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="products" className="w-full">
                <div className="px-6 py-2 border-b border-border">
                  <TabsList className="flex flex-wrap justify-start h-auto">
                    <TabsTrigger value="products">商品（{(detail.products || []).length}）</TabsTrigger>
                    <TabsTrigger value="orders">订单（{(detail.orders || []).length}）</TabsTrigger>
                    <TabsTrigger value="logs">日志（{logs.length}）</TabsTrigger>
                    <TabsTrigger value="complaints">投诉（{complaints.length}）</TabsTrigger>
                    <TabsTrigger value="evaluations">评价（{evaluations.length}）</TabsTrigger>
                    <TabsTrigger value="chats">聊天（{chats.length}）</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="products" className="m-0">
                  <div className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground mb-3">发布商品</div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>标题</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>价格</TableHead>
                            <TableHead>发布时间</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detail.products || []).map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.title || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{p.status || "-"}</TableCell>
                              <TableCell className="text-primary font-medium">¥{p.price ?? "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDateTime(p.created_at)}</TableCell>
                            </TableRow>
                          ))}
                          {(detail.products || []).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="orders" className="m-0">
                  <div className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground mb-3">相关订单</div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>订单号</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>商品</TableHead>
                            <TableHead>买家/卖家</TableHead>
                            <TableHead>时间</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(detail.orders || []).map((o: any) => (
                            <TableRow key={o.id}>
                              <TableCell className="font-medium">{o.orderNo || o.id}</TableCell>
                              <TableCell className="text-muted-foreground">{o.status || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {o.product_title ? `${o.product_title}（¥${o.product_price ?? "-"}）` : "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {o.buyer_name || "-"} / {o.seller_name || "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatDateTime(o.created_at)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="查看订单详情"
                                  onClick={() => setActiveOrderId(Number(o.id))}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(detail.orders || []).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logs" className="m-0">
                  <div className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground mb-3">操作日志</div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>时间</TableHead>
                            <TableHead>动作</TableHead>
                            <TableHead>模块</TableHead>
                            <TableHead>内容</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((x: any) => (
                            <TableRow key={x.id}>
                              <TableCell className="text-muted-foreground">{formatDateTime(x.created_at)}</TableCell>
                              <TableCell className="font-medium">{x.action || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{x.module || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{x.content || "-"}</TableCell>
                            </TableRow>
                          ))}
                          {logs.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="complaints" className="m-0">
                  <div className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground mb-3">投诉</div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>时间</TableHead>
                            <TableHead>类型</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>内容</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {complaints.map((x: any) => (
                            <TableRow key={x.id}>
                              <TableCell className="text-muted-foreground">{formatDateTime(x.created_at)}</TableCell>
                              <TableCell className="text-muted-foreground">{x.type || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{x.status || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{x.content || "-"}</TableCell>
                            </TableRow>
                          ))}
                          {complaints.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="evaluations" className="m-0">
                  <div className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground mb-3">评价</div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>时间</TableHead>
                            <TableHead>订单</TableHead>
                            <TableHead>对象</TableHead>
                            <TableHead>评分</TableHead>
                            <TableHead>内容</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {evaluations.map((x: any) => (
                            <TableRow key={x.id}>
                              <TableCell className="text-muted-foreground">{formatDateTime(x.created_at)}</TableCell>
                              <TableCell className="text-muted-foreground">{x.order_id ?? "-"}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {x.target_type || "-"} / {x.target_id ?? "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{x.rating ?? "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{x.content || "-"}</TableCell>
                            </TableRow>
                          ))}
                          {evaluations.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="chats" className="m-0">
                  <div className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground mb-3">聊天记录</div>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>时间</TableHead>
                            <TableHead>对方</TableHead>
                            <TableHead>商品</TableHead>
                            <TableHead>内容</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {chats.map((x: any) => (
                            <TableRow key={x.id}>
                              <TableCell className="text-muted-foreground">
                                {formatDateTime(x.created_at)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {x.other_nickname ? `${x.other_nickname}（ID:${x.other_id}）` : "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {x.product_title ? `${x.product_title}${x.product_id ? `（ID:${x.product_id}）` : ""}` : "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{x.content || "-"}</TableCell>
                            </TableRow>
                          ))}
                          {chats.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                                暂无数据
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">暂无数据</CardContent>
        </Card>
      )}

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置用户密码</DialogTitle>
            <DialogDescription>为该用户设置一个新密码（至少 6 位）。</DialogDescription>
          </DialogHeader>
          <Input value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="输入新密码" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>
              取消
            </Button>
            <Button
              onClick={async () => {
                if (!detail) return;
                setPwdSaving(true);
                try {
                  await api.adminResetUserPassword(detail.user.id, pwd);
                  setPwdOpen(false);
                  await refresh();
                } finally {
                  setPwdSaving(false);
                }
              }}
              disabled={pwdSaving || pwd.trim().length < 6}
            >
              {pwdSaving ? "提交中..." : "确认重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={phoneOpen} onOpenChange={setPhoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改用户手机号</DialogTitle>
            <DialogDescription>直接为该用户更新手机号（需为 11 位大陆手机号且不能被占用）。</DialogDescription>
          </DialogHeader>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="输入新手机号" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneOpen(false)}>
              取消
            </Button>
            <Button
              onClick={async () => {
                if (!detail) return;
                setPhoneSaving(true);
                try {
                  await api.adminSetUserPhone(detail.user.id, phone);
                  setPhoneOpen(false);
                  await refresh();
                } finally {
                  setPhoneSaving(false);
                }
              }}
              disabled={phoneSaving || String(phone || "").trim().length !== 11}
            >
              {phoneSaving ? "提交中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OrderDetailDialog
        open={activeOrderId !== null}
        orderId={activeOrderId}
        onOpenChange={(next) => {
          if (!next) setActiveOrderId(null);
        }}
      />
    </div>
  );
}

