import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { StatusBadge, type ProjectStatus } from "@/components/StatusBadge";
import { useForm } from "react-hook-form";

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态 / All" },
  { value: "discovered", label: "已发现 / Discovered" },
  { value: "contacted", label: "已联系 / Contacted" },
  { value: "replied", label: "已回复 / Replied" },
  { value: "negotiating", label: "洽谈中 / Negotiating" },
  { value: "listed", label: "已成交 / Listed" },
  { value: "rejected", label: "已拒绝 / Rejected" },
];

export default function Projects() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [isMeme, setIsMeme] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const limit = 20;
  const { data, refetch } = trpc.projects.list.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    isMeme: isMeme,
    limit,
    offset: page * limit,
  });

  const discoverMutation = trpc.projects.discover.useMutation({
    onSuccess: (d) => {
      toast.success(`发现 ${d.discovered} 个新项目`);
      refetch();
      setDiscovering(false);
    },
    onError: (e) => { toast.error(e.message); setDiscovering(false); },
  });

  const projects = data?.items || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目管理 / Projects</h1>
          <p className="text-muted-foreground text-sm">共 {total} 个项目 / {total} total projects</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setDiscovering(true); discoverMutation.mutate({ source: "coingecko" }); }}
            disabled={discovering}
            className="border-primary/40 text-primary hover:bg-primary/10"
          >
            {discovering ? "扫描中..." : "🔍 扫描新项目"}
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm">+ 手动添加</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle>添加项目 / Add Project</DialogTitle>
              </DialogHeader>
              <CreateProjectForm onSuccess={() => { setShowCreate(false); refetch(); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="搜索项目名称或代币 / Search..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-64 bg-input border-border"
        />
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <SelectTrigger className="w-48 bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={isMeme === true ? "default" : "outline"}
          size="sm"
          onClick={() => setIsMeme(isMeme === true ? undefined : true)}
          className={isMeme === true ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : "border-border"}
        >
          🐸 Meme Only
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">项目 / Project</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">状态 / Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">联系渠道 / Channels</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">来源 / Source</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">发现时间 / Discovered</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">操作 / Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      暂无项目 / No projects found
                      <br />
                      <span className="text-xs">点击"扫描新项目"开始发现 / Click "Scan" to discover projects</span>
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/50 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {p.logoUrl && (
                            <img src={p.logoUrl} alt={p.name} className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          )}
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-1">
                              {p.name}
                              {p.isMeme && <span className="text-xs bg-orange-500/20 text-orange-300 px-1 rounded">MEME</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">{p.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={p.status as ProjectStatus} />
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {p.twitterUrl && <span className="text-xs text-sky-400">𝕏</span>}
                          {p.telegramUrl && <span className="text-xs text-blue-400">✈</span>}
                          {p.officialEmail && <span className="text-xs text-purple-400">✉</span>}
                          {p.discordUrl && <span className="text-xs text-indigo-400">◈</span>}
                          {!p.twitterUrl && !p.telegramUrl && !p.officialEmail && !p.discordUrl && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-muted-foreground capitalize">{p.source}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-muted-foreground">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                        </span>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-primary/40 text-primary hover:bg-primary/10 h-7"
                          onClick={() => navigate(`/projects/${p.id}`)}
                        >
                          详情
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>显示 {page * limit + 1}-{Math.min((page + 1) * limit, total)} / {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>上一页</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total}>下一页</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateProjectForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<{
    name: string; symbol: string; website?: string;
    twitterHandle?: string; telegramUrl?: string; officialEmail?: string;
    contactPersonName?: string; category?: string; notes?: string;
  }>();

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => { toast.success("项目已添加"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">项目名称 *</Label>
          <Input {...register("name", { required: true })} className="bg-input border-border mt-1" placeholder="e.g. Pepe Coin" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">代币符号 *</Label>
          <Input {...register("symbol", { required: true })} className="bg-input border-border mt-1" placeholder="e.g. PEPE" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">官网 Website</Label>
        <Input {...register("website")} className="bg-input border-border mt-1" placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Twitter Handle</Label>
          <Input {...register("twitterHandle")} className="bg-input border-border mt-1" placeholder="@username" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Telegram URL</Label>
          <Input {...register("telegramUrl")} className="bg-input border-border mt-1" placeholder="https://t.me/..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">联系人 Contact</Label>
          <Input {...register("contactPersonName")} className="bg-input border-border mt-1" placeholder="Name" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">邮箱 Email</Label>
          <Input {...register("officialEmail")} className="bg-input border-border mt-1" placeholder="team@..." />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">备注 Notes</Label>
        <Textarea {...register("notes")} className="bg-input border-border mt-1 text-sm" rows={2} />
      </div>
      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
        {createMutation.isPending ? "添加中..." : "添加项目"}
      </Button>
    </form>
  );
}
