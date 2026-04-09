import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ChangePhone = () => {
  const navigate = useNavigate();
  const [newPhone, setNewPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coolDownUntil, setCoolDownUntil] = useState<number>(0);

  const coolDownText = useMemo(() => {
    if (Date.now() >= coolDownUntil) return null;
    return `${Math.ceil((coolDownUntil - Date.now()) / 1000)}s`;
  }, [coolDownUntil]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-4 md:py-6">
          <h1 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Phone className="h-5 w-5" /> 更换手机号
          </h1>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPhone">新手机号</Label>
              <Input
                id="newPhone"
                type="tel"
                placeholder="请输入新手机号"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">验证码</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  placeholder="请输入验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={sending || !newPhone.trim() || Date.now() < coolDownUntil}
                  onClick={async () => {
                    const p = newPhone.trim();
                    if (!p) return;
                    setSending(true);
                    try {
                      await api.sendChangePhoneCode({ newPhone: p });
                      toast.success("验证码已发送");
                      setCoolDownUntil(Date.now() + 60 * 1000);
                    } catch (e: any) {
                      toast.error(e?.message || "发送失败");
                    } finally {
                      setSending(false);
                    }
                  }}
                >
                  {coolDownText || (sending ? "发送中..." : "发送验证码")}
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={loading || !newPhone.trim() || !code.trim()}
              onClick={async () => {
                setLoading(true);
                try {
                  await api.confirmChangePhone({ newPhone: newPhone.trim(), code: code.trim() });
                  toast.success("手机号已更新");
                  navigate("/profile", { replace: true });
                } catch (e: any) {
                  toast.error(e?.message || "更换失败");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "提交中..." : "确认更换"}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChangePhone;

