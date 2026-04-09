import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Megaphone } from "lucide-react";
import { useUtc8Time } from "@/hooks/use-utc8-time";

type Announcement = {
  id: string;
  title: string;
  content: string;
  isTop: boolean;
  status: "published" | "draft";
  created_at: string;
};

const Announcements = () => {
  const { formatDateTime } = useUtc8Time();
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .listAnnouncements()
      .then((data) => setList(data))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">平台公告</h1>
        </div>
        <Link to="/">
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">加载中...</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            暂无公告
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {item.isTop ? <span className="text-primary">[置顶]</span> : null}
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-foreground whitespace-pre-wrap">{item.content}</p>
                <p className="text-xs text-muted-foreground">
                  发布时间：{formatDateTime(item.created_at)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Announcements;
