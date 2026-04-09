import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, Pin, PinOff } from "lucide-react";
import { api } from "@/lib/api";
import { useUtc8Time } from "@/hooks/use-utc8-time";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  isTop: boolean;
  status: "published" | "draft";
  createdAt: string;
}

const AnnouncementManagement = () => {
  const { formatDateTime } = useUtc8Time();
  const [list, setList] = useState<AnnouncementItem[]>([]);
  const [editItem, setEditItem] = useState<AnnouncementItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", status: "published" as "published" | "draft" });

  const refresh = async () => {
    const rows = await api.adminListAnnouncements();
    setList(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        isTop: r.isTop,
        status: r.status,
        createdAt: (r.created_at || "").slice(0, 10),
      }))
    );
  };

  useEffect(() => {
    refresh().catch(() => setList([]));
  }, []);

  const openNew = () => {
    setForm({ title: "", content: "", status: "published" });
    setEditItem(null);
    setIsNew(true);
  };

  const openEdit = (item: AnnouncementItem) => {
    setForm({ title: item.title, content: item.content, status: item.status });
    setEditItem(item);
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    if (isNew) {
      await api.adminCreateAnnouncement({
        title: form.title,
        content: form.content,
        status: form.status,
      });
    } else if (editItem) {
      await api.adminUpdateAnnouncement(editItem.id, {
        title: form.title,
        content: form.content,
        status: form.status,
      });
    }
    await refresh();
    setEditItem(null);
    setIsNew(false);
  };

  const handleDelete = async (id: string) => {
    await api.adminDeleteAnnouncement(id);
    await refresh();
  };

  const toggleTop = async (id: string) => {
    const item = list.find((a) => a.id === id);
    if (!item) return;
    await api.adminSetAnnouncementTop(id, !item.isTop);
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{list.length} 条公告</Badge>
        <Button size="sm" onClick={openNew} className="gap-1">
          <Plus className="h-4 w-4" /> 新增公告
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>置顶</TableHead>
                <TableHead>发布时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm max-w-[300px] truncate">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "published" ? "default" : "secondary"}>
                      {item.status === "published" ? "已发布" : "草稿"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.isTop && <Badge variant="outline" className="text-primary border-primary">置顶</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleTop(item.id)} title={item.isTop ? "取消置顶" : "置顶"}>
                        {item.isTop ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/New Dialog */}
      <Dialog open={isNew || !!editItem} onOpenChange={() => { setEditItem(null); setIsNew(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "新增公告" : "编辑公告"}</DialogTitle>
            <DialogDescription>{isNew ? "创建一条新的系统公告" : "修改公告内容"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">标题</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="公告标题" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">内容</label>
              <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="公告内容" rows={4} />
            </div>
            <div className="flex gap-2">
              <Button variant={form.status === "published" ? "default" : "outline"} size="sm" onClick={() => setForm((f) => ({ ...f, status: "published" }))}>
                发布
              </Button>
              <Button variant={form.status === "draft" ? "default" : "outline"} size="sm" onClick={() => setForm((f) => ({ ...f, status: "draft" }))}>
                草稿
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditItem(null); setIsNew(false); }}>取消</Button>
            <Button onClick={handleSave} disabled={!form.title.trim() || !form.content.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnnouncementManagement;
