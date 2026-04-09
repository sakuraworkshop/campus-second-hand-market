import { useState, useRef, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Image, MoreVertical } from "lucide-react";
import { api } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/assets";
import { getMe } from "@/lib/auth";

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  type: "text" | "image" | "product-card";
  time: string;
  isMe: boolean;
  productCard?: {
    title: string;
    price: number;
    image: string;
  };
}

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

const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!id) return;
      const user = getMe();
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      
      setLoading(true);
      try {
        const convRes = await api.getMessages();
        const currentConv = convRes.conversations.find((c) => c.id === id) || null;
        setConversation(currentConv);
        
        // 获取聊天消息
        const response = await api.getChatMessages(id);
        setMessages(response.messages);
      } catch (error) {
        console.error("获取聊天消息失败", error);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [id, navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !id) return;
    
    setSending(true);
    try {
      const response = await api.sendChatMessage(id, {
        content: inputValue.trim(),
        type: "text"
      });
      
      setMessages((prev) => [...prev, response]);
      setInputValue("");
    } catch (error) {
      console.error("发送消息失败", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">会话不存在</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <Link to="/messages">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Avatar className="h-9 w-9">
          <AvatarImage src={resolveAssetUrl(conversation.contact.avatar)} />
          <AvatarFallback>{conversation.contact.nickname[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">
            {conversation.contact.nickname}
          </p>
          {conversation.productTitle && (
            <p className="text-xs text-primary truncate">{conversation.productTitle}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Product card banner */}
      {conversation.productTitle && (
        <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-2 flex items-center gap-3">
          <img
            src={resolveAssetUrl(conversation.productImage)}
            alt=""
            className="h-10 w-10 rounded-md object-cover"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{conversation.productTitle}</p>
            <p className="text-sm font-semibold text-primary">¥{conversation.productPrice}</p>
          </div>
          <Link to={`/product/${conversation.productId}`}>
            <Button variant="outline" size="sm">查看商品</Button>
          </Link>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage
                  src={
                    msg.isMe
                      ? "https://api.dicebear.com/7.x/adventurer/svg?seed=Me"
                      : resolveAssetUrl(conversation.contact.avatar)
                  }
                />
                <AvatarFallback>{msg.isMe ? "我" : conversation.contact.nickname[0]}</AvatarFallback>
              </Avatar>
              <div className={`max-w-[70%] ${msg.isMe ? "items-end" : "items-start"} flex flex-col`}>
                {msg.type === "product-card" && msg.productCard ? (
                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <div className="flex gap-2">
                      <img
                        src={resolveAssetUrl(msg.productCard.image)}
                        alt=""
                        className="h-14 w-14 rounded-md object-cover bg-muted"
                      />
                      <div>
                        <p className="text-sm text-foreground line-clamp-2">{msg.productCard.title}</p>
                        <p className="text-sm font-bold text-primary mt-1">¥{msg.productCard.price}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      msg.isMe
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground mt-1 px-1">{msg.time}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
            <Image className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Input
            placeholder="输入消息..."
            className="flex-1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
