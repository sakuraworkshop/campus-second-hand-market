import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { setMe, setToken } from "@/lib/auth";
import { toast } from "sonner";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [coolDownUntil, setCoolDownUntil] = useState<number>(0);

  const getErrorMessage = (e: unknown) => {
    if (e && typeof e === "object" && "message" in e) {
      const msg = (e as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    return "注册失败";
  };

  const onRegister = async () => {
    if (password !== confirmPassword) return toast.error("两次密码不一致");
    if (!nickname.trim() || !phone.trim() || !code.trim() || !password) return;
    setLoading(true);
    try {
      const resp = await api.register({
        nickname: nickname.trim(),
        phone: phone.trim(),
        code: code.trim(),
        password,
      });
      setToken(resp.token);
      setMe({
        id: resp.user.id,
        nickname: resp.user.nickname,
        role: resp.user.role,
      });
      navigate("/", { replace: true });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
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

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">昵称</Label>
            <Input id="nickname" placeholder="取个昵称" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input id="phone" type="tel" placeholder="请输入手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">验证码</Label>
            <div className="flex gap-2">
              <Input id="code" placeholder="请输入验证码" value={code} onChange={(e) => setCode(e.target.value)} />
              <Button
                type="button"
                variant="outline"
                disabled={sending || !phone.trim() || Date.now() < coolDownUntil}
                onClick={async () => {
                  const p = phone.trim();
                  if (!p) return;
                  setSending(true);
                  try {
                    await api.authSendSmsCode({ phone: p, scene: "register" });
                    toast.success("验证码已发送");
                    setCoolDownUntil(Date.now() + 60 * 1000);
                  } catch (e: any) {
                    toast.error(e?.message || "发送失败");
                  } finally {
                    setSending(false);
                  }
                }}
              >
                {Date.now() < coolDownUntil ? `${Math.ceil((coolDownUntil - Date.now()) / 1000)}s` : sending ? "发送中..." : "发送验证码"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="8位以上，包含数字和字母"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button className="w-full" size="lg" disabled={loading || !nickname.trim() || !phone.trim() || !code.trim() || !password || !confirmPassword} onClick={onRegister}>
            {loading ? "注册中..." : "注册"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            已有账号？
            <Link to="/login" className="text-primary hover:underline ml-1">立即登录</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
