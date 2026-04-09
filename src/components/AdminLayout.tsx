import { Outlet, Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Users,
  Package,
  Megaphone,
  Image,
  LogOut,
  Menu,
  ListTree,
  ShoppingCart,
  AlertTriangle,
  Star,
  Heart,
  FileText,
  Sun,
  Moon,
  ArrowLeftRight,
  BookOpenCheck,
  BrainCircuit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clearAuth, getMe, getToken, type Me } from "@/lib/auth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";

const menuItems = [
  { path: "/admin", label: "数据大盘", icon: BarChart3, end: true },
  { path: "/admin/users", label: "用户管理", icon: Users },
  { path: "/admin/products", label: "商品管理", icon: Package },
  { path: "/admin/orders", label: "订单管理", icon: ShoppingCart },
  { path: "/admin/complaints", label: "投诉处理", icon: AlertTriangle },
  { path: "/admin/evaluations", label: "评价管理", icon: Star },
  { path: "/admin/favorites", label: "收藏管理", icon: Heart },
  { path: "/admin/logs", label: "操作日志", icon: FileText },
  { path: "/admin/categories", label: "分类管理", icon: ListTree },
  { path: "/admin/dicts", label: "字典管理", icon: BookOpenCheck },
  { path: "/admin/ai", label: "AI中心", icon: BrainCircuit },
  { path: "/admin/announcements", label: "公告管理", icon: Megaphone },
  { path: "/admin/banners", label: "轮播图管理", icon: Image },
];

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, toggle: toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // 移动端默认收起，PC 端默认展开
    if (typeof window === "undefined") return true;
    return window.matchMedia?.("(min-width: 768px)").matches ?? true;
  });
  const [user, setUser] = useState<Me | null>(null);

  const isLoggedIn = !!user && !!getToken();

  useEffect(() => {
    setUser(getMe());
  }, [location.pathname]);

  useEffect(() => {
    const mql = window.matchMedia?.("(min-width: 768px)");
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => {
      // 宽度切换时回到“默认行为”
      setSidebarOpen(e.matches);
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const activeTitle = useMemo(() => {
    const m = menuItems.find((x) => (x.end ? location.pathname === x.path : location.pathname.startsWith(x.path)));
    return m?.label || "管理后台";
  }, [location.pathname]);

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const closeSidebarOnMobile = () => {
    if (window.matchMedia?.("(max-width: 767px)").matches) setSidebarOpen(false);
  };

  const onLogout = () => {
    clearAuth();
    setUser(null);
    setSidebarOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex bg-muted/30">
      {/* Sidebar */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="关闭侧边栏"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "bg-card flex flex-col transition-all duration-200 overflow-hidden",
          "fixed inset-y-0 left-0 z-40 md:z-auto md:shrink-0 md:border-r md:border-border md:sticky md:top-0 md:h-screen",
          sidebarOpen ? "w-56" : "w-0 md:w-0",
          !sidebarOpen && "md:border-r-0"
        )}
        aria-hidden={!sidebarOpen}
      >
        <div className="h-14 flex items-center justify-center px-4 border-b border-border shrink-0">
          <Link to="/admin" className="flex w-full items-center justify-center" onClick={closeSidebarOnMobile}>
            <img src="/logos/logo_dashboard_black.svg" alt="校园二手管理端" className="h-5 w-auto dark:hidden" loading="eager" decoding="async" />
            <img src="/logos/logo_dashboard_white.svg" alt="校园二手管理端" className="h-5 w-auto hidden dark:block" loading="eager" decoding="async" />
          </Link>
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="flex flex-col gap-1 px-2">
            {menuItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={closeSidebarOnMobile}>
                <Button
                  variant={isActive(item.path, item.end) ? "secondary" : "ghost"}
                  className={cn(
                    "w-full gap-2",
                    "justify-start",
                    isActive(item.path, item.end) && "font-medium"
                  )}
                  size="sm"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border p-2">
          <Link to="/">
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 justify-start"
              onClick={closeSidebarOnMobile}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>返回前台</span>
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 md:overflow-hidden">
        <div className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 md:px-6 shrink-0 justify-between gap-3 md:sticky md:top-0 md:z-20">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "收起侧边栏" : "打开侧边栏"}
              title={sidebarOpen ? "收起侧边栏" : "打开侧边栏"}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <h2 className="font-semibold text-foreground truncate">{activeTitle}</h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="max-w-40 truncate">
                  {isLoggedIn ? user?.nickname : "未登录"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem
                  onClick={() => {
                    setSidebarOpen(false);
                    navigate("/", { replace: false });
                  }}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  切换至用户端
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    toggleTheme();
                  }}
                >
                  {resolvedTheme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {resolvedTheme === "dark" ? "切换浅色" : "切换深色"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
