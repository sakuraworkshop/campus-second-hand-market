import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Ban, RotateCcw, Shield, ShieldCheck, SquareArrowOutUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { resolveAssetUrl } from "@/lib/assets";
import { useUtc8Time } from "@/hooks/use-utc8-time";

interface AdminUser {
  id: number;
  nickname: string;
  avatar?: string | null;
  phone: string;
  role: "user" | "admin";
  status: "active" | "banned";
  createdAt: string;
  products: number;
  orders: number;
}

const UserManagement = () => {
  const { formatDateTime } = useUtc8Time();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    api
      .adminListUsers()
      .then((list) => setUsers(list))
      .catch(() => {
        // token 无效/无权限时由路由守卫处理；这里兜底即可
        setUsers([]);
      });
  }, []);

  const filtered = users.filter(
    (u) => u.nickname.includes(search) || u.phone.includes(search)
  );

  const toggleBan = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const nextStatus: "active" | "banned" = user.status === "banned" ? "active" : "banned";
    api.adminSetUserStatus(userId, nextStatus).then(() => {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u)));
    });
  };

  const toggleRole = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const nextRole: "user" | "admin" = user.role === "admin" ? "user" : "admin";
    api.adminSetUserRole(userId, nextRole).then(() => {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索昵称或手机号..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Badge variant="secondary">{filtered.length} 位用户</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>发布/订单</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={resolveAssetUrl(user.avatar)} />
                        <AvatarFallback>{user.nickname[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{user.nickname}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.phone}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "管理员" : "用户"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "active" ? "outline" : "destructive"}>
                      {user.status === "active" ? "正常" : "已封禁"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.products} / {user.orders}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="详情"
                        onClick={() => navigate(`/admin/users/${user.id}`)}
                      >
                        <SquareArrowOutUpRight className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={user.role === "admin" ? "取消管理员" : "设为管理员"} onClick={() => toggleRole(user.id)}>
                        {user.role === "admin" ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Shield className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={user.status === "banned" ? "解封" : "封禁"} onClick={() => toggleBan(user.id)}>
                        {user.status === "banned" ? <RotateCcw className="h-4 w-4 text-success" /> : <Ban className="h-4 w-4 text-destructive" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
