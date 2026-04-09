import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { setMe, setToken } from "@/lib/auth";
import { toast } from "sonner";

type AuthTab = "login" | "register" | "forgot";

function tabFromPathname(pathname: string): AuthTab {
  if (pathname === "/register") return "register";
  if (pathname === "/forgot-password") return "forgot";
  return "login";
}

function pathnameFromTab(tab: AuthTab): string {
  if (tab === "register") return "/register";
  if (tab === "forgot") return "/forgot-password";
  return "/login";
}

const Auth = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const initialTab = useMemo(() => tabFromPathname(location.pathname), [location.pathname]);
  const [tab, setTab] = useState<AuthTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const onTabChange = (next: string) => {
    const t = next as AuthTab;
    setTab(t);
    const nextPath = pathnameFromTab(t);
    if (location.pathname !== nextPath) navigate(nextPath, { replace: true });
  };

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // login
  const [loginMode, setLoginMode] = useState<"password" | "sms">("password");
  const [phoneLogin, setPhoneLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginSending, setLoginSending] = useState(false);
  const [loginSendCoolDownUntil, setLoginSendCoolDownUntil] = useState<number>(0);

  // register
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [regSending, setRegSending] = useState(false);
  const [regSendCoolDownUntil, setRegSendCoolDownUntil] = useState<number>(0);

  // forgot
  const [forgotAccount, setForgotAccount] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSendCoolDownUntil, setForgotSendCoolDownUntil] = useState<number>(0);

  const getErrorMessage = (e: unknown, fallback: string) => {
    if (e && typeof e === "object" && "message" in e) {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    return fallback;
  };

  const onLogin = async () => {
    const p = phoneLogin.trim();
    if (!p) return;
    setLoading(true);
    try {
      const resp =
        loginMode === "password"
          ? await api.login({ phone: p, password })
          : await api.authLoginBySms({ phone: p, code: loginCode.trim() });
      setToken(resp.token);
      setMe({ id: resp.user.id, nickname: resp.user.nickname, role: resp.user.role });
      navigate(resp.user.role === "admin" ? "/admin" : "/", { replace: true });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "登录失败"));
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async () => {
    if (regPassword !== confirmPassword) return toast.error("两次密码不一致");
    if (!nickname.trim() || !phone.trim() || !regCode.trim() || !regPassword) return;
    setLoading(true);
    try {
      const resp = await api.register({
        nickname: nickname.trim(),
        phone: phone.trim(),
        code: regCode.trim(),
        password: regPassword,
      });
      setToken(resp.token);
      setMe({ id: resp.user.id, nickname: resp.user.nickname, role: resp.user.role });
      navigate("/", { replace: true });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "注册失败"));
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    const v = forgotAccount.trim();
    if (!v) return;
    if (forgotNewPassword !== forgotConfirmPassword) return toast.error("两次密码不一致");
    if (!forgotCode.trim() || !forgotNewPassword) return;
    setLoading(true);
    try {
      await api.authResetPasswordBySms({
        phone: v,
        code: forgotCode.trim(),
        newPassword: forgotNewPassword,
      });
      toast.success("密码已重置，请使用新密码登录");
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src="/logos/logo_with_slogan_black.svg"
            alt="校园二手交易平台"
            className="mx-auto h-16 w-auto mb-3 dark:hidden"
            loading="eager"
            decoding="async"
          />
          <img
            src="/logos/logo_with_slogan_white.svg"
            alt="校园二手交易平台"
            className="mx-auto h-16 w-auto mb-3 hidden dark:block"
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <Tabs value={tab} onValueChange={onTabChange}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
              <TabsTrigger value="forgot">忘记密码</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">登录方式</div>
                <Tabs value={loginMode} onValueChange={(v) => setLoginMode(v as "password" | "sms")}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="password">密码登录</TabsTrigger>
                    <TabsTrigger value="sms">验证码登录</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-phone">手机号</Label>
                <Input
                  id="login-phone"
                  placeholder="请输入手机号"
                  value={phoneLogin}
                  onChange={(e) => setPhoneLogin(e.target.value)}
                />
              </div>

              {loginMode === "password" ? (
                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="login-code">验证码</Label>
                  <div className="flex gap-2">
                    <Input
                      id="login-code"
                      placeholder="请输入验证码"
                      value={loginCode}
                      onChange={(e) => setLoginCode(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        loginSending || !phoneLogin.trim() || Date.now() < loginSendCoolDownUntil
                      }
                      onClick={async () => {
                        const p = phoneLogin.trim();
                        if (!p) return;
                        setLoginSending(true);
                        try {
                          await api.authSendSmsCode({ phone: p, scene: "login" });
                          toast.success("验证码已发送");
                          setLoginSendCoolDownUntil(Date.now() + 60 * 1000);
                        } catch (e: unknown) {
                          toast.error(getErrorMessage(e, "发送失败"));
                        } finally {
                          setLoginSending(false);
                        }
                      }}
                    >
                      {Date.now() < loginSendCoolDownUntil
                        ? `${Math.ceil((loginSendCoolDownUntil - Date.now()) / 1000)}s`
                        : loginSending
                          ? "发送中..."
                          : "发送验证码"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" className="rounded border-border" /> 记住我
                </label>
                <Link to="/forgot-password" className="text-primary hover:underline">
                  忘记密码？
                </Link>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={onLogin}
                disabled={
                  loading ||
                  !phoneLogin.trim() ||
                  (loginMode === "password" ? !password : !loginCode.trim())
                }
              >
                {loading ? "登录中..." : "登录"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                还没有账号？
                <Link to="/register" className="text-primary hover:underline ml-1">
                  立即注册
                </Link>
              </p>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="reg-nickname">昵称</Label>
                <Input
                  id="reg-nickname"
                  placeholder="取个昵称"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-phone">手机号</Label>
                <Input
                  id="reg-phone"
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-code">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="reg-code"
                    placeholder="请输入验证码"
                    value={regCode}
                    onChange={(e) => setRegCode(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={regSending || !phone.trim() || Date.now() < regSendCoolDownUntil}
                    onClick={async () => {
                      const p = phone.trim();
                      if (!p) return;
                      setRegSending(true);
                      try {
                        await api.authSendSmsCode({ phone: p, scene: "register" });
                        toast.success("验证码已发送");
                        setRegSendCoolDownUntil(Date.now() + 60 * 1000);
                      } catch (e: unknown) {
                        toast.error(getErrorMessage(e, "发送失败"));
                      } finally {
                        setRegSending(false);
                      }
                    }}
                  >
                    {Date.now() < regSendCoolDownUntil
                      ? `${Math.ceil((regSendCoolDownUntil - Date.now()) / 1000)}s`
                      : regSending
                        ? "发送中..."
                        : "发送验证码"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">密码</Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="请输入密码"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-confirm">确认密码</Label>
                <Input
                  id="reg-confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="请再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={onRegister}
                disabled={loading || !nickname.trim() || !phone.trim() || !regCode.trim() || !regPassword || !confirmPassword}
              >
                {loading ? "注册中..." : "注册"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                已有账号？
                <Link to="/login" className="text-primary hover:underline ml-1">
                  立即登录
                </Link>
              </p>
            </TabsContent>

            <TabsContent value="forgot" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-account">手机号</Label>
                <Input
                  id="forgot-account"
                  placeholder="请输入手机号"
                  value={forgotAccount}
                  onChange={(e) => setForgotAccount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-code">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="forgot-code"
                    placeholder="请输入验证码"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={forgotSending || !forgotAccount.trim() || Date.now() < forgotSendCoolDownUntil}
                    onClick={async () => {
                      const p = forgotAccount.trim();
                      if (!p) return;
                      setForgotSending(true);
                      try {
                        await api.authSendSmsCode({ phone: p, scene: "reset_password" });
                        toast.success("验证码已发送");
                        setForgotSendCoolDownUntil(Date.now() + 60 * 1000);
                      } catch (e: unknown) {
                        toast.error(getErrorMessage(e, "发送失败"));
                      } finally {
                        setForgotSending(false);
                      }
                    }}
                  >
                    {Date.now() < forgotSendCoolDownUntil
                      ? `${Math.ceil((forgotSendCoolDownUntil - Date.now()) / 1000)}s`
                      : forgotSending
                        ? "发送中..."
                        : "发送验证码"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-new">新密码</Label>
                <Input
                  id="forgot-new"
                  type="password"
                  placeholder="请输入新密码"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-confirm">确认新密码</Label>
                <Input
                  id="forgot-confirm"
                  type="password"
                  placeholder="请再次输入新密码"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                onClick={onForgot}
                disabled={
                  loading ||
                  !forgotAccount.trim() ||
                  !forgotCode.trim() ||
                  !forgotNewPassword ||
                  !forgotConfirmPassword
                }
              >
                {loading ? "提交中..." : "重置密码"}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                想起来了？
                <Link to="/login" className="text-primary hover:underline ml-1">
                  返回登录
                </Link>
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;

