import Header from "@/features/public/components/Header";
import Footer from "@/features/public/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, MapPin, Trash2, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

const Addresses = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    contact: "",
    phone: "",
    campus: "东校区",
    building: "",
    detail: "",
  });

  const refresh = useCallback(async () => {
    const list = await api.listAddresses();
    setAddresses(list as Address[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, [refresh]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container max-w-2xl py-4 md:py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-foreground">收货地址</h1>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> 新增地址</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增收货地址</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>联系人</Label>
                      <Input
                        placeholder="收货人姓名"
                        value={form.contact}
                        onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>手机号</Label>
                      <Input
                        placeholder="联系电话"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>校区</Label>
                      <Select value={form.campus} onValueChange={(v) => setForm((f) => ({ ...f, campus: v }))}>
                        <SelectTrigger><SelectValue placeholder="选择校区" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="东校区">东校区</SelectItem>
                          <SelectItem value="西校区">西校区</SelectItem>
                          <SelectItem value="南校区">南校区</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>楼栋</Label>
                      <Input
                        placeholder="如：6号宿舍楼"
                        value={form.building}
                        onChange={(e) => setForm((f) => ({ ...f, building: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>详细地址</Label>
                    <Input
                      placeholder="如：A503"
                      value={form.detail}
                      onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        const isDefault = addresses.length === 0;
                        await api.addAddress({
                          contact: form.contact,
                          phone: form.phone,
                          campus: form.campus,
                          building: form.building,
                          detail: form.detail,
                          isDefault,
                        });
                        setForm({ contact: "", phone: "", campus: "东校区", building: "", detail: "" });
                        await refresh();
                        setDialogOpen(false);
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    {submitting ? "保存中..." : "保存地址"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {addresses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {loading ? "加载中..." : "暂无收货地址，请添加"}
              </div>
            ) : (
              addresses.map((addr) => (
              <div key={addr.id} className={`rounded-lg border bg-card p-4 ${addr.isDefault ? "border-primary" : "border-border"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <MapPin className={`h-5 w-5 mt-0.5 shrink-0 ${addr.isDefault ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{addr.contact}</span>
                        <span className="text-sm text-muted-foreground">{addr.phone}</span>
                        {addr.isDefault && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">默认</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {addr.campus} · {addr.building} · {addr.detail}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!addr.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={async () => {
                          await api.setDefaultAddress(Number(addr.id));
                          await refresh();
                        }}
                      >
                        <Star className="h-3 w-3" /> 设为默认
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        await api.deleteAddress(Number(addr.id));
                        await refresh();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">最多可保存 10 个收货地址</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Addresses;
