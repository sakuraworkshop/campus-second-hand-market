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

const LogManagement = () => {
  const { formatDateTime } = useUtc8Time();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | "全部">("全部");
  const [moduleFilter, setModuleFilter] = useState<string | "全部">("全部");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await api.adminListLogs({
        action: actionFilter === "全部" ? undefined : actionFilter,
        module: moduleFilter === "全部" ? undefined : moduleFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLogs(list);
    } catch (error) {
      console.error("Failed to load logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [actionFilter, moduleFilter, startDate, endDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索操作..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <Button variant={actionFilter === "全部" ? "default" : "outline"} size="sm" onClick={() => setActionFilter("全部")}>
            全部操作
          </Button>
          <Button variant={actionFilter === "处理投诉" ? "default" : "outline"} size="sm" onClick={() => setActionFilter("处理投诉")}>
            处理投诉
          </Button>
        </div>
        <div className="flex gap-1">
          <Button variant={moduleFilter === "全部" ? "default" : "outline"} size="sm" onClick={() => setModuleFilter("全部")}>
            全部模块
          </Button>
          <Button variant={moduleFilter === "商品管理" ? "default" : "outline"} size="sm" onClick={() => setModuleFilter("商品管理")}>
            商品管理
          </Button>
          <Button variant={moduleFilter === "投诉管理" ? "default" : "outline"} size="sm" onClick={() => setModuleFilter("投诉管理")}>
            投诉管理
          </Button>
        </div>
        <div className="flex gap-2">
          <Input type="date" placeholder="开始日期" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          <Input type="date" placeholder="结束日期" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Button onClick={refresh} variant="default" size="sm">
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">操作日志</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>操作人</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>模块</TableHead>
                <TableHead>内容</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>操作时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    暂无操作日志
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.user_id}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.module}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{log.content}</TableCell>
                    <TableCell>{log.ip}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.created_at)}</TableCell>
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

export default LogManagement;