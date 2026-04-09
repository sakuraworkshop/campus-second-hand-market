import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Check, X, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useUtc8Time } from "@/hooks/use-utc8-time";

const ComplaintManagement = () => {
  const { formatDateTime } = useUtc8Time();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "全部">("全部");
  const [typeFilter, setTypeFilter] = useState<string | "全部">("全部");
  const [complaints, setComplaints] = useState<any[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [handling, setHandling] = useState(false);

  const statusFilters = ["全部", "pending", "processed", "closed"];
  const typeFilters = ["全部", "product", "user", "order"];

  const mapStatus = (status: string): string => {
    if (status === "pending") return "待处理";
    if (status === "processed") return "处理中";
    if (status === "closed") return "已处理";
    return status;
  };

  const mapType = (type: string): string => {
    if (type === "product") return "商品"; 
    if (type === "user") return "用户";
    if (type === "order") return "订单";
    return type;
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.adminListComplaints({
        status: statusFilter === "全部" ? undefined : statusFilter,
        type: typeFilter === "全部" ? undefined : typeFilter,
      });
      setComplaints(list);
    } catch (error) {
      console.error("Failed to load complaints:", error);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleProcess = async () => {
    if (!selectedComplaint || !result.trim()) return;
    
    setHandling(true);
    try {
      await api.adminHandleComplaint(selectedComplaint.id, {
        status: "closed",
        result: result.trim(),
      });
      setSelectedComplaint(null);
      setResult("");
      await refresh();
    } catch (error) {
      console.error("Failed to process complaint:", error);
    } finally {
      setHandling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索投诉..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {statusFilters.map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {typeFilters.map((t) => (
            <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm" onClick={() => setTypeFilter(t)}>
              {t}
            </Button>
          ))}
        </div>
        <Button onClick={refresh} variant="default" size="sm">
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">投诉处理</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>投诉ID</TableHead>
                <TableHead>投诉类型</TableHead>
                <TableHead>投诉人</TableHead>
                <TableHead>目标ID</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : complaints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    暂无投诉
                  </TableCell>
                </TableRow>
              ) : (
                complaints.map((complaint) => (
                  <TableRow key={complaint.id}>
                    <TableCell className="font-medium">{complaint.id}</TableCell>
                    <TableCell>{mapType(complaint.type)}</TableCell>
                    <TableCell>{complaint.user_name}</TableCell>
                    <TableCell>{complaint.target_id}</TableCell>
                    <TableCell>
                      <Badge variant={
                        complaint.status === "pending" ? "secondary" :
                        complaint.status === "processed" ? "outline" : "default"
                      }>
                        {mapStatus(complaint.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(complaint.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedComplaint(complaint)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {complaint.status === "pending" && (
                          <Button variant="default" size="sm" onClick={() => setSelectedComplaint(complaint)}>
                            处理
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 处理投诉对话框 */}
      <Dialog open={!!selectedComplaint} onOpenChange={() => {
        setSelectedComplaint(null);
        setResult("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>处理投诉</DialogTitle>
            <DialogDescription>请填写处理结果</DialogDescription>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">投诉信息</h3>
                <div className="bg-muted/50 p-3 rounded-md">
                  <p><span className="text-muted-foreground">投诉类型：</span>{mapType(selectedComplaint.type)}</p>
                  <p><span className="text-muted-foreground">投诉人：</span>{selectedComplaint.user_name}</p>
                  <p><span className="text-muted-foreground">目标ID：</span>{selectedComplaint.target_id}</p>
                  <p><span className="text-muted-foreground">投诉内容：</span>{selectedComplaint.content}</p>
                  {selectedComplaint.evidence && selectedComplaint.evidence.length > 0 && (
                    <p><span className="text-muted-foreground">证据：</span>{selectedComplaint.evidence.join(', ')}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-1">处理结果</h3>
                <Textarea placeholder="请输入处理结果..." value={result} onChange={(e) => setResult(e.target.value)} rows={4} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedComplaint(null);
              setResult("");
            }}>
              取消
            </Button>
            <Button variant="default" onClick={handleProcess} disabled={!result.trim() || handling}>
              {handling ? "处理中..." : "确认处理"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintManagement;