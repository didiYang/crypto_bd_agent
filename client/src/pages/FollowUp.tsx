import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { StatusBadge, type ProjectStatus } from "@/components/StatusBadge";

export default function FollowUp() {
  const [, navigate] = useLocation();
  const { data: projects, refetch } = trpc.followUp.pending.useQuery();

  const triggerMutation = trpc.followUp.trigger.useMutation({
    onSuccess: (data) => {
      toast.success(`已向 ${data.project.name} 发送跟进消息`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const autoMutation = trpc.followUp.runAutoFollowUp.useMutation({
    onSuccess: (data) => {
      toast.success(`批量跟进完成，处理了 ${data.processed} 个项目`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const count = projects?.length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">跟进管理 / Follow-up</h1>
          <p className="text-muted-foreground text-sm">
            {count > 0
              ? `${count} 个项目超过2天未回复，需要跟进`
              : "所有项目跟进状态良好 / All projects are up to date"}
          </p>
        </div>
        {count > 0 && (
          <Button
            onClick={() => autoMutation.mutate()}
            disabled={autoMutation.isPending}
            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40"
          >
            {autoMutation.isPending ? "处理中..." : `⚡ 一键批量跟进 (${count})`}
          </Button>
        )}
      </div>

      {count === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-lg font-medium text-foreground">无需跟进 / No Follow-ups Needed</p>
            <p className="text-sm text-muted-foreground mt-2">所有已联系的项目都在2天内有过互动</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects!.map((p) => {
            const daysSince = p.lastContactAt
              ? Math.floor((Date.now() - new Date(p.lastContactAt).getTime()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <Card key={p.id} className="bg-card border-border border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {p.logoUrl && (
                        <img src={p.logoUrl} alt={p.name} className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-sm">({p.symbol})</span>
                          {p.isMeme && <span className="text-xs bg-orange-500/20 text-orange-300 px-1 rounded">MEME</span>}
                          <StatusBadge status={p.status as ProjectStatus} />
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>首次联系: {p.firstContactAt ? new Date(p.firstContactAt).toLocaleDateString() : "—"}</span>
                          <span>最后联系: {p.lastContactAt ? new Date(p.lastContactAt).toLocaleDateString() : "—"}</span>
                          {daysSince !== null && (
                            <span className="text-yellow-400 font-medium">⏰ {daysSince}天前 / {daysSince} days ago</span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {p.twitterUrl && <span className="text-xs text-sky-400">𝕏 Twitter</span>}
                          {p.telegramUrl && <span className="text-xs text-blue-400">✈ Telegram</span>}
                          {p.officialEmail && <span className="text-xs text-purple-400">✉ Email</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border text-muted-foreground hover:text-foreground"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        查看详情
                      </Button>
                      <Button
                        size="sm"
                        className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40"
                        onClick={() => triggerMutation.mutate({ projectId: p.id })}
                        disabled={triggerMutation.isPending}
                      >
                        {triggerMutation.isPending ? "发送中..." : "📤 发送跟进"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
