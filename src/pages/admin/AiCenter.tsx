import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useUtc8Time } from "@/hooks/use-utc8-time";

type PromptRow = {
  id: string;
  name: string;
  scene: string;
  content: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export default function AiCenter() {
  const { formatDateTime } = useUtc8Time();
  const [list, setList] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");

  const [editing, setEditing] = useState<PromptRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", scene: "", content: "", enabled: true });

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return list;
    return list.filter(
      (x) =>
        x.name?.includes(kw) ||
        x.scene?.includes(kw) ||
        x.content?.includes(kw) ||
        x.id?.includes(kw)
    );
  }, [list, keyword]);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = (await api.adminListAiPrompts({ keyword: keyword.trim() || undefined })) as PromptRow[];
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
  }, []);

  const openCreate = () => {
    setIsNew(true);
    setEditing(null);
    setForm({ name: "", scene: "", content: "", enabled: true });
  };

  const openEdit = (row: PromptRow) => {
    setIsNew(false);
    setEditing(row);
    setForm({
      name: row.name || "",
      scene: row.scene || "",
      content: row.content || "",
      enabled: !!row.enabled,
    });
  };

  const save = async () => {
    if (!form.name.trim() || !form.scene.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await api.adminCreateAiPrompt({
          name: form.name.trim(),
          scene: form.scene.trim(),
          content: form.content,
          enabled: form.enabled,
        });
      } else if (editing) {
        await api.adminUpdateAiPrompt(editing.id, {
          name: form.name.trim(),
          scene: form.scene.trim(),
          content: form.content,
          enabled: form.enabled,
        });
      }
      await refresh();
      setIsNew(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filtered.length} 条</Badge>
          <div className="relative">
            <Input
              placeholder="搜索名称/场景/内容/ID..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") refresh();
              }}
              className="w-72"
            />
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            {loading ? "加载中..." : "刷新"}
          </Button>
        </div>
        <Button size="sm" className="gap-1" onClick={openCreate}>
          <Plus className="h-4 w-4" /> 新增提示词
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">AI中心 - 提示词管理</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead className="w-44">场景（scene）</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="w-36">更新时间</TableHead>
                  <TableHead className="text-right w-44">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div className="truncate max-w-[220px]" title={row.name}>
                          {row.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]" title={row.id}>
                          {row.id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.scene}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="line-clamp-2 max-w-[520px]" title={row.content}>
                        {row.content}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.enabled ? "default" : "secondary"}>{row.enabled ? "启用" : "禁用"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.updated_at || row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await api.adminSetAiPromptEnabled(row.id, !row.enabled);
                            await refresh();
                          }}
                        >
                          {row.enabled ? "禁用" : "启用"}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="编辑">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            await api.adminDeleteAiPrompt(row.id);
                            await refresh();
                          }}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isNew || !!editing}
        onOpenChange={() => {
          setIsNew(false);
          setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isNew ? "新增提示词" : "编辑提示词"}</DialogTitle>
            <DialogDescription>用于统一管理不同 AI 场景的提示词模板（可启停）。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">名称</label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">场景（scene）</label>
                <Input
                  value={form.scene}
                  onChange={(e) => setForm((f) => ({ ...f, scene: e.target.value }))}
                  placeholder="例如：generate_product_v1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">提示词内容</label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="在这里编写提示词模板..."
                className="min-h-48"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">是否启用</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={form.enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, enabled: true }))}
                >
                  启用
                </Button>
                <Button
                  type="button"
                  variant={!form.enabled ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, enabled: false }))}
                >
                  禁用
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsNew(false);
                setEditing(null);
              }}
            >
              取消
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim() || !form.scene.trim() || !form.content.trim()}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

