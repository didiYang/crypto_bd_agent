import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ExternalLink, Send, CheckSquare, Square, Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type DiscoveredProject = {
  id: number;
  name: string;
  symbol: string;
  isMeme: boolean;
  logoUrl: string | null;
  twitterUrl: string | null;
  telegramUrl: string | null;
  discordUrl: string | null;
  officialEmail: string | null;
  website: string | null;
  marketCap: string | null;
  source: string;
  category: string | null;
};

type Channel = "telegram" | "twitter" | "email" | "discord" | "manual";

interface ScanResultDialogProps {
  open: boolean;
  onClose: () => void;
  projects: DiscoveredProject[];
  daysBack: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getAvailableChannels(p: DiscoveredProject): Channel[] {
  const ch: Channel[] = [];
  if (p.telegramUrl) ch.push("telegram");
  if (p.twitterUrl) ch.push("twitter");
  if (p.officialEmail) ch.push("email");
  if (p.discordUrl) ch.push("discord");
  if (ch.length === 0) ch.push("manual");
  return ch;
}

function formatMarketCap(mc: string | null): string {
  if (!mc) return "—";
  const n = parseFloat(mc);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const CHANNEL_ICONS: Record<Channel, string> = {
  telegram: "✈️",
  twitter: "🐦",
  email: "📧",
  discord: "💬",
  manual: "📝",
};

const CHANNEL_LABELS: Record<Channel, string> = {
  telegram: "Telegram",
  twitter: "Twitter/X",
  email: "Email",
  discord: "Discord",
  manual: "Manual",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ScanResultDialog({
  open,
  onClose,
  projects,
  daysBack,
}: ScanResultDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [globalChannel, setGlobalChannel] = useState<Channel>("telegram");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [filterMeme, setFilterMeme] = useState<"all" | "meme" | "non-meme">("all");

  const utils = trpc.useUtils();

  const sendMutation = trpc.messages.send.useMutation();

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (filterMeme === "meme") return projects.filter((p) => p.isMeme);
    if (filterMeme === "non-meme") return projects.filter((p) => !p.isMeme);
    return projects;
  }, [projects, filterMeme]);

  const memeCount = projects.filter((p) => p.isMeme).length;
  const nonMemeCount = projects.length - memeCount;

  // Select / deselect
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredProjects.map((p) => p.id)));
  const selectMeme = () => setSelectedIds(new Set(projects.filter((p) => p.isMeme).map((p) => p.id)));
  const clearAll = () => setSelectedIds(new Set());

  const selectedProjects = filteredProjects.filter((p) => selectedIds.has(p.id));

  // Batch send first contact
  const handleBatchSend = async () => {
    if (selectedProjects.length === 0) {
      toast.warning("请先选择至少一个项目 / Please select at least one project");
      return;
    }

    setSending(true);
    setSentCount(0);
    let successCount = 0;
    let failCount = 0;

    for (const project of selectedProjects) {
      try {
        // Determine best channel for this project
        const available = getAvailableChannels(project);
        const channel = available.includes(globalChannel) ? globalChannel : available[0];

        const bodyEn = `Hi ${project.name} Team,

I hope this message finds you well! My name is [Your Name] from MGBX Exchange, one of the leading cryptocurrency exchanges with a strong global user base.

I came across ${project.name} (${project.symbol}) and I'm very impressed with your project. We would love to explore the opportunity of listing ${project.symbol} on MGBX Exchange, which would significantly increase your token's visibility and liquidity.

Our listing process is straightforward and we offer competitive listing fees with excellent post-listing support including:
• Marketing campaigns and announcements
• Liquidity support
• 24/7 trading pairs

Would you be interested in discussing this opportunity further? I'd be happy to share more details about our listing packages.

Looking forward to hearing from you!

Best regards,
[Your Name]
BD Manager | MGBX Exchange`;

        await sendMutation.mutateAsync({
          projectId: project.id,
          channel,
          bodyEn,
          isFollowUp: false,
          followUpNumber: 1,
        });

        successCount++;
        setSentCount((c) => c + 1);
        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 200));
      } catch (err: any) {
        failCount++;
        console.warn(`Failed to send to project ${project.id}:`, err.message);
      }
    }

    setSending(false);
    utils.analytics.summary.invalidate();
    utils.projects.list.invalidate();

    if (successCount > 0) {
      toast.success(
        `成功发送 ${successCount} 条首次联系消息${failCount > 0 ? `，${failCount} 条失败` : ""}`,
        { description: `Successfully sent ${successCount} first-contact messages` }
      );
    }
    if (failCount > 0 && successCount === 0) {
      toast.error(`发送失败 ${failCount} 条 / Failed to send ${failCount} messages`);
    }

    if (successCount > 0) {
      setTimeout(() => onClose(), 1500);
    }
  };

  const periodLabel: Record<number, string> = {
    1: "过去24小时 / Last 24h",
    3: "过去3天 / Last 3 days",
    7: "过去一周 / Last 7 days",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col bg-[#0f1117] border-border/40 text-foreground">
        {/* Header */}
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-yellow-400" />
            扫描结果 / Scan Results
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {periodLabel[daysBack] || `Last ${daysBack} days`} · 共发现{" "}
            <span className="text-foreground font-semibold">{projects.length}</span> 个新项目（
            <span className="text-orange-400">{memeCount} Meme</span> ·{" "}
            <span className="text-blue-400">{nonMemeCount} 其他</span>）
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 py-2 border-b border-border/30">
          {/* Filter tabs */}
          <div className="flex rounded-md overflow-hidden border border-border/40 text-xs">
            {(["all", "meme", "non-meme"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterMeme(f)}
                className={`px-3 py-1.5 transition-colors ${
                  filterMeme === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted/30"
                }`}
              >
                {f === "all" ? `全部 (${projects.length})` : f === "meme" ? `Meme (${memeCount})` : `其他 (${nonMemeCount})`}
              </button>
            ))}
          </div>

          {/* Select shortcuts */}
          <div className="flex gap-1 ml-auto">
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectAll}>
              <CheckSquare className="h-3 w-3 mr-1" /> 全选
            </Button>
            {memeCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-orange-400 hover:text-orange-300" onClick={selectMeme}>
                🔥 选Meme
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground" onClick={clearAll}>
              <Square className="h-3 w-3 mr-1" /> 清除
            </Button>
          </div>

          {/* Channel selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">发送渠道:</span>
            <Select value={globalChannel} onValueChange={(v) => setGlobalChannel(v as Channel)}>
              <SelectTrigger className="h-7 text-xs w-32 border-border/40 bg-muted/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["telegram", "twitter", "email", "discord", "manual"] as Channel[]).map((ch) => (
                  <SelectItem key={ch} value={ch} className="text-xs">
                    {CHANNEL_ICONS[ch]} {CHANNEL_LABELS[ch]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Project list */}
        <ScrollArea className="flex-1 min-h-0">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <span className="text-4xl mb-3">🔍</span>
              <p className="text-sm">该分类下暂无新项目</p>
            </div>
          ) : (
            <div className="space-y-1 pr-2">
              {filteredProjects.map((project) => {
                const isSelected = selectedIds.has(project.id);
                const channels = getAvailableChannels(project);
                return (
                  <div
                    key={project.id}
                    onClick={() => toggleSelect(project.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                      isSelected
                        ? "bg-primary/10 border-primary/40"
                        : "bg-muted/10 border-transparent hover:bg-muted/20 hover:border-border/30"
                    }`}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(project.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />

                    {/* Logo */}
                    {project.logoUrl ? (
                      <img
                        src={project.logoUrl}
                        alt={project.name}
                        className="h-9 w-9 rounded-full object-cover shrink-0 bg-muted"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                        {project.symbol.slice(0, 2)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate">{project.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{project.symbol}</span>
                        {project.isMeme && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-orange-500/20 text-orange-400 border-orange-500/30 shrink-0">
                            🔥 MEME
                          </Badge>
                        )}
                        {project.category && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/40 text-muted-foreground shrink-0">
                            {project.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          MCap: <span className="text-foreground/70">{formatMarketCap(project.marketCap)}</span>
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {project.source === "coingecko" ? "🦎 CoinGecko" : "📊 CMC"}
                        </span>
                        {/* Available channels */}
                        <div className="flex gap-1">
                          {channels.map((ch) => (
                            <span
                              key={ch}
                              title={CHANNEL_LABELS[ch]}
                              className={`text-xs px-1.5 py-0.5 rounded-sm ${
                                ch === globalChannel
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted/30 text-muted-foreground"
                              }`}
                            >
                              {CHANNEL_ICONS[ch]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* External link */}
                    {project.website && (
                      <a
                        href={project.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <Separator className="shrink-0 opacity-30" />

        {/* Footer */}
        <DialogFooter className="shrink-0 flex-row items-center gap-3 pt-1">
          <div className="flex-1 text-sm text-muted-foreground">
            {sending ? (
              <span className="text-primary animate-pulse">
                发送中 {sentCount}/{selectedProjects.length}...
              </span>
            ) : selectedIds.size > 0 ? (
              <span>
                已选 <span className="text-foreground font-semibold">{selectedIds.size}</span> 个项目，
                将通过 <span className="text-primary">{CHANNEL_ICONS[globalChannel]} {CHANNEL_LABELS[globalChannel]}</span> 发送首次联系
              </span>
            ) : (
              <span className="text-muted-foreground/60">请勾选要联系的项目</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
            关闭 / Close
          </Button>
          <Button
            size="sm"
            onClick={handleBatchSend}
            disabled={sending || selectedIds.size === 0}
            className="bg-primary hover:bg-primary/90 gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {sending
              ? `发送中 ${sentCount}/${selectedProjects.length}...`
              : `批量发送首次联系 (${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
