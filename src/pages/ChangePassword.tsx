import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { clearAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ChangePassword = () => {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (newPassword !== confirmPassword) return toast.error("两次新密码不一致");
    if (!oldPassword || !newPassword) return;
    setLoading(true);
    try {
      await api.updatePassword({ oldPassword, newPassword });
      toast.success("密码修改成功，请重新登录");
      clearAuth();
      navigate("/login", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "修改失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-md py-4 md:py-6">
          <h1 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Lock className="h-5 w-5" /> 修改密码
          </h1>
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">原密码</Label>
              <Input id="oldPassword" type="password" placeholder="请输入原密码" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input id="newPassword" type="password" placeholder="8位以上，包含数字和字母" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input id="confirmPassword" type="password" placeholder="请再次输入新密码" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button className="w-full" disabled={loading} onClick={onSubmit}>
              {loading ? "提交中..." : "确认修改"}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChangePassword;
