import { Link, useLocation } from "react-router-dom";
import { Search, Heart, MessageCircle, User, Menu, X, Plus, Sun, Moon, Package, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { clearAuth, getMe, getToken, type Me } from "@/lib/auth";
import { useTheme } from "@/hooks/useTheme";

const Header = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<Me | null>(null);
  const { resolvedTheme, toggle } = useTheme();

  useEffect(() => {
    setUser(getMe());
  }, [location.pathname]);

  useEffect(() => {
    // 消息图标红点应基于会话未读数，而非系统通知未读数
    if (!getToken()) {
      setUnreadCount(0);
      return;
    }
    api
      .getMessages()
      .then((res) => {
        const total = (res.conversations || []).reduce(
          (sum, c) => sum + (Number(c.unreadCount) > 0 ? Number(c.unreadCount) : 0),
          0
        );
        setUnreadCount(total);
      })
      .catch(() => {
        setUnreadCount(0);
      });
  }, [location.pathname]);

  const navItems = [
    { path: "/", label: "首页" },
    { path: "/products", label: "商品广场" },
    { path: "/publish", label: "发布闲置", icon: Plus },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isLoggedIn = !!user && !!getToken();

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setUnreadCount(0);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container flex h-14 items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/logos/logo_black.svg" alt="校园二手" className="h-6 w-auto dark:hidden" loading="eager" decoding="async" />
          <img src="/logos/logo_white.svg" alt="校园二手" className="h-6 w-auto hidden dark:block" loading="eager" decoding="async" />
          <span className="sr-only">校园二手</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive(item.path) ? "default" : "ghost"}
                size="sm"
                className="gap-1.5"
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索闲置好物..."
              className="pl-9 h-9 bg-muted/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={toggle}
            aria-label={resolvedTheme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            title={resolvedTheme === "dark" ? "浅色模式" : "深色模式"}
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Link to="/favorites">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Heart className="h-4 w-4" />
            </Button>
          </Link>
          {isLoggedIn && (
            <Link to="/messages">
              <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                <MessageCircle className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          )}
          <Link to="/profile">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <User className="h-4 w-4" />
            </Button>
          </Link>
          {isLoggedIn ? (
            <div className="relative ml-1 group">
              <button
                type="button"
                className="h-9 px-2 rounded-md text-sm text-muted-foreground hover:text-foreground max-w-24 truncate"
                title={user.nickname}
              >
                {user.nickname}
              </button>
              <div className="absolute right-0 top-full pt-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                <div className="min-w-28 rounded-md border border-border bg-popover shadow-md p-1">
                  {user?.role === "admin" && (
                    <Link to="/admin">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        进入管理后台
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    退出登录
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Link to="/login">
              <Button size="sm" className="ml-1">登录</Button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card p-4 animate-fade-in">
          <div className="flex flex-col gap-2">
            {/* 用户信息（置顶） */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {isLoggedIn ? user?.nickname : "未登录"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {isLoggedIn ? "欢迎回来" : "登录后可查看消息、收藏等"}
                  </div>
                </div>
                {isLoggedIn ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={handleLogout}
                  >
                    退出
                  </Button>
                ) : (
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="shrink-0">
                    <Button size="sm">登录</Button>
                  </Link>
                )}
              </div>

              {isLoggedIn && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {user?.role === "admin" && (
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="col-span-2">
                      <Button variant="outline" className="w-full justify-start gap-2">
                        进入管理后台
                      </Button>
                    </Link>
                  )}
                  <Link to="/profile" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <User className="h-4 w-4" />
                      个人中心
                    </Button>
                  </Link>
                  <Link to="/my-products" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Package className="h-4 w-4" />
                      我的发布
                    </Button>
                  </Link>
                  <Link to="/favorites" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Heart className="h-4 w-4" />
                      我的收藏
                    </Button>
                  </Link>
                  {isLoggedIn && (
                    <Link to="/messages" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full justify-start gap-2 relative">
                        <MessageCircle className="h-4 w-4" />
                        消息
                        {unreadCount > 0 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </Button>
                    </Link>
                  )}
                  <Link to="/profile?tab=orders" onClick={() => setMobileMenuOpen(false)} className="col-span-2">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      我的订单
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => {
                toggle();
              }}
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {resolvedTheme === "dark" ? "浅色模式" : "深色模式"}
            </Button>
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                <Button variant={isActive(item.path) ? "default" : "ghost"} className="w-full justify-start gap-2">
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
