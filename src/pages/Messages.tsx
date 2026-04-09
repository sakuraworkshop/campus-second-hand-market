import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageCircle } from "lucide-react";
import { api } from "@/lib/api";
import { getMe } from "@/lib/auth";
import { resolveAssetUrl } from "@/lib/assets";
import { Button } from "@/components/ui/button";
import { useUtc8Time } from "@/hooks/use-utc8-time";

interface Conversation {
  id: string;
  contact: {
    id: number;
    nickname: string;
    avatar: string;
  };
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  productTitle?: string;
  productPrice?: number;
  productImage?: string;
  productId?: string;
}

const Messages = () => {
  const { formatDateTime } = useUtc8Time();
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [user] = useState(() => getMe());

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const response = await api.getMessages();
        setConversations(response.conversations);
      } catch (error) {
        console.error("获取消息列表失败", error);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [user]);

  const filtered = conversations.filter((c) =>
    c.contact.nickname.includes(searchQuery) || c.lastMessage.includes(searchQuery)
  );

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-6 max-w-2xl">
          <h1 className="text-xl font-bold text-foreground mb-4">消息</h1>
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-3" />
            <p className="mb-4">登录后才能查看聊天消息</p>
            <Button asChild>
              <Link to="/login">去登录</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-6 max-w-2xl">
          <h1 className="text-xl font-bold text-foreground mb-4">消息</h1>
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-3" />
            <p>加载中...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6 max-w-2xl">
        <h1 className="text-xl font-bold text-foreground mb-4">消息</h1>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索聊天记录..."
            className="pl-9 bg-muted/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-3" />
            <p>暂无消息</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-1">
              {filtered.map((conv) => (
                <Link
                  key={conv.id}
                  to={`/chat/${conv.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={resolveAssetUrl(conv.contact.avatar)} />
                      <AvatarFallback>{conv.contact.nickname[0]}</AvatarFallback>
                    </Avatar>
                    {conv.unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground border-2 border-background">
                        {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground truncate">
                        {conv.contact.nickname}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatDateTime(conv.lastTime)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage}
                    </p>
                    {conv.productTitle && (
                      <p className="text-xs text-primary truncate mt-0.5">
                        {conv.productTitle}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Messages;
