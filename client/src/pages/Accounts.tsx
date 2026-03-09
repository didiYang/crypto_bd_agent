import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

const TYPE_CONFIG = {
  twitter: { icon: "𝕏", label: "Twitter / X", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/30" },
  telegram: { icon: "✈", label: "Telegram", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  email: { icon: "✉", label: "Email", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
};

export default function Accounts() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: accounts, refetch } = trpc.accounts.list.useQuery();

  const deleteMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => { toast.success("账号已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.accounts.update.useMutation({
    onSuccess: () => { toast.success("已更新"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const resetMutation = trpc.accounts.resetDailyCounts.useMutation({
    onSuccess: () => { toast.success("每日计数已重置"); refetch(); },
  });

  const grouped = {
    twitter: (accounts || []).filter((a) => a.type === "twitter"),
    telegram: (accounts || []).filter((a) => a.type === "telegram"),
    email: (accounts || []).filter((a) => a.type === "email"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">账号管理 / Accounts</h1>
          <p className="text-muted-foreground text-sm">管理用于联系项目方的多个账号 / Manage outreach accounts</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            className="border-border text-muted-foreground"
          >
            🔄 重置每日计数
          </Button>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm">+ 添加账号</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>添加账号 / Add Account</DialogTitle>
              </DialogHeader>
              <AddAccountForm onSuccess={() => { setShowAdd(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(["twitter", "telegram", "email"] as const).map((type) => {
          const cfg = TYPE_CONFIG[type];
          const accs = grouped[type];
          const active = accs.filter((a) => a.isActive).length;
          const totalSent = accs.reduce((s, a) => s + (a.sentToday || 0), 0);
          const totalLimit = accs.reduce((s, a) => s + (a.dailyLimit || 0), 0);
          return (
            <Card key={type} className={`border ${cfg.bg}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xl ${cfg.color}`}>{cfg.icon}</span>
                  <span className="font-medium text-sm">{cfg.label}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{accs.length}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {active} active · {totalSent}/{totalLimit} sent today
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Account Lists */}
      {(["twitter", "telegram", "email"] as const).map((type) => {
        const cfg = TYPE_CONFIG[type];
        const accs = grouped[type];
        if (accs.length === 0) return null;
        return (
          <Card key={type} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className={cfg.color}>{cfg.icon}</span>
                {cfg.label} ({accs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs">标签 / Label</th>
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs">账号 / Handle</th>
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs">今日发送 / Today</th>
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs">每日上限 / Limit</th>
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs">状态 / Status</th>
                    <th className="text-left p-3 text-muted-foreground font-medium text-xs">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {accs.map((acc) => (
                    <tr key={acc.id} className="border-b border-border/50 hover:bg-accent/20">
                      <td className="p-3 font-medium">{acc.label}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{acc.handle}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-secondary rounded-full h-1.5 max-w-16">
                            <div
                              className="bg-primary rounded-full h-1.5 transition-all"
                              style={{ width: `${Math.min(100, ((acc.sentToday || 0) / (acc.dailyLimit || 50)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{acc.sentToday || 0}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{acc.dailyLimit}</td>
                      <td className="p-3">
                        <Switch
                          checked={acc.isActive}
                          onCheckedChange={(v) => updateMutation.mutate({ id: acc.id, isActive: v })}
                        />
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-6"
                          onClick={() => {
                            if (confirm("确认删除此账号？")) deleteMutation.mutate({ id: acc.id });
                          }}
                        >
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}

      {(!accounts || accounts.length === 0) && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-4xl mb-3">📱</p>
            <p>暂无账号 / No accounts yet</p>
            <p className="text-xs mt-1">添加Twitter、Telegram或邮箱账号用于联系项目方</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddAccountForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, watch } = useForm<{
    type: "twitter" | "telegram" | "email";
    label: string;
    handle: string;
    dailyLimit: number;
    notes?: string;
  }>({ defaultValues: { type: "telegram", dailyLimit: 50 } });

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => { toast.success("账号已添加"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">账号类型 *</Label>
        <Select defaultValue="telegram" onValueChange={(v) => {}}>
          <SelectTrigger className="bg-input border-border mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="telegram">✈ Telegram</SelectItem>
            <SelectItem value="twitter">𝕏 Twitter / X</SelectItem>
            <SelectItem value="email">✉ Email</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" {...register("type")} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">标签 Label *</Label>
        <Input {...register("label", { required: true })} className="bg-input border-border mt-1" placeholder="e.g. Main TG Account" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">账号 Handle *</Label>
        <Input {...register("handle", { required: true })} className="bg-input border-border mt-1" placeholder="@username or email@domain.com" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">每日上限 Daily Limit</Label>
        <Input type="number" {...register("dailyLimit", { valueAsNumber: true })} className="bg-input border-border mt-1" />
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "添加中..." : "添加账号"}
      </Button>
    </form>
  );
}
