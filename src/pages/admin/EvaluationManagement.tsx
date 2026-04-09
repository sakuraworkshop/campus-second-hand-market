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

const EvaluationManagement = () => {
  const { formatDateTime } = useUtc8Time();
  const [search, setSearch] = useState("");
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await api.adminListEvaluations();
      setEvaluations(list);
    } catch (error) {
      console.error("Failed to load evaluations:", error);
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const renderRating = (rating: number) => {
    return Array(5).fill(0).map((_, index) => (
      <span key={index} className={`text-sm ${index < rating ? "text-yellow-400" : "text-gray-300"}`}>
        ★
      </span>
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索评价..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={refresh} variant="default" size="sm">
          刷新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">评价管理</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>评价ID</TableHead>
                <TableHead>评价人</TableHead>
                <TableHead>被评价人</TableHead>
                <TableHead>订单号</TableHead>
                <TableHead>评分</TableHead>
                <TableHead>评价内容</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : evaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    暂无评价
                  </TableCell>
                </TableRow>
              ) : (
                evaluations.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell className="font-medium">{evaluation.id}</TableCell>
                    <TableCell>{evaluation.user_name}</TableCell>
                    <TableCell>{evaluation.target_name}</TableCell>
                    <TableCell>{evaluation.order_no}</TableCell>
                    <TableCell>{renderRating(evaluation.rating)}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{evaluation.content}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(evaluation.created_at)}</TableCell>
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

export default EvaluationManagement;