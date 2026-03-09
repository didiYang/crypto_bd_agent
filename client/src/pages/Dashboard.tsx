import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useLocation } from "wouter";

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#94a3b8"];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [discovering, setDiscovering] = useState(false);
  const [scanDays, setScanDays] = useState(1);

  const SCAN_PERIOD_LABELS: Record<number, string> = {
    1: "过去24小时 / Last 24h",
    3: "过去3天 / Last 3 days",
    7: "过去一周 / Last 7 days",
  };

  const { data: summary, refetch: refetchSummary } = trpc.analytics.summary.useQuery();
  const { data: today } = trpc.analytics.today.useQuery();
  const { data: followUpProjects } = trpc.followUp.pending.useQuery();

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: rangeData } = trpc.analytics.range.useQuery({ startDate, endDate });

  const discoverMutation = trpc.projects.discover.useMutation({
    onSuccess: (data) => {
      const periodLabel = SCAN_PERIOD_LABELS[data.daysBack] || `Last ${data.daysBack} days`;
      toast.success(
        data.discovered > 0
          ? `发现 ${data.discovered} 个新项目（${periodLabel}）`
          : `未发现新项目，该时段内项目已全部入库（${periodLabel}）`
      );
      refetchSummary();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setDiscovering(false),
  });

  const autoFollowUpMutation = trpc.followUp.runAutoFollowUp.useMutation({
    onSuccess: (data) => {
      toast.success(`已处理 ${data.processed} 个跟进项目 / Processed ${data.processed} follow-ups`);
    },
    onError: (e) => toast.error(e.message),
  });

  const stats = summary?.projects;
  const msgStats = summary?.messages;

  const total = Number(stats?.total || 0);
  const contacted = Number(stats?.contacted || 0);
  const replied = Number(stats?.replied || 0);
  const listed = Number(stats?.listed || 0);

  const replyRate = contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : "0.0";
  const conversionRate = contacted > 0 ? ((listed / contacted) * 100).toFixed(1) : "0.0";

  const pieData = [
    { name: "Discovered", value: total - contacted, color: "#6366f1" },
    { name: "Contacted", value: contacted - replied, color: "#22d3ee" },
    { name: "Replied", value: replied - listed, color: "#34d399" },
    { name: "Listed", value: listed, color: "#fbbf24" },
    { name: "Rejected", value: Number(stats?.rejected || 0), color: "#f87171" },
  ].filter((d) => d.value > 0);

  const chartData = (rangeData || []).map((d) => ({
    date: d.date.slice(5),
    contacted: d.projectsContacted,
    replied: d.projectsReplied,
    listed: d.projectsListed,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">仪表板 / Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">加密项目BD管理中心 · Crypto BD Management Center</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoFollowUpMutation.mutate()}
            disabled={autoFollowUpMutation.isPending}
            className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10"
          >
            {autoFollowUpMutation.isPending ? "处理中..." : `⏰ 自动跟进 (${followUpProjects?.length || 0})`}
          </Button>
          <div className="flex items-center">
            <Button
              size="sm"
              onClick={() => {
                setDiscovering(true);
                discoverMutation.mutate({ source: "coingecko", daysBack: scanDays });
              }}
              disabled={discovering}
              className="bg-primary hover:bg-primary/90 rounded-r-none border-r border-primary/60"
            >
              {discovering ? "扫描中..." : `🔍 扫描新项目`}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  disabled={discovering}
                  className="bg-primary hover:bg-primary/90 rounded-l-none px-2"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">选择扫描时间范围</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {([1, 3, 7] as const).map((days) => (
                  <DropdownMenuItem
                    key={days}
                    onClick={() => setScanDays(days)}
                    className={scanDays === days ? "bg-primary/20 text-primary font-medium" : ""}
                  >
                    {scanDays === days && <span className="mr-2">✓</span>}
                    {SCAN_PERIOD_LABELS[days]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="总项目数 / Total"
          value={total}
          sub="所有发现的项目"
          color="text-blue-400"
          icon="📊"
        />
        <KpiCard
          title="今日联系 / Today"
          value={today?.projectsContacted || 0}
          sub={`发送 ${today?.messagesSent || 0} 条消息`}
          color="text-cyan-400"
          icon="📤"
        />
        <KpiCard
          title="回复率 / Reply Rate"
          value={`${replyRate}%`}
          sub={`${replied} 个项目回复`}
          color="text-green-400"
          icon="💬"
        />
        <KpiCard
          title="转化率 / Conversion"
          value={`${conversionRate}%`}
          sub={`${listed} 个项目成交`}
          color="text-yellow-400"
          icon="🏆"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="待跟进 / Follow-up" value={followUpProjects?.length || 0} sub="2天无回复" color="text-orange-400" icon="⏰" />
        <KpiCard title="洽谈中 / Negotiating" value={Number(stats?.replied || 0) - listed} sub="进行中的谈判" color="text-purple-400" icon="🤝" />
        <KpiCard title="已成交 / Listed" value={listed} sub="成功上币项目" color="text-emerald-400" icon="✅" />
        <KpiCard
          title="总收入 / Revenue"
          value={`$${Number(stats?.totalFees || 0).toLocaleString()}`}
          sub="Listing Fee Income"
          color="text-yellow-300"
          icon="💰"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                14天趋势 / 14-Day Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cContacted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cReplied" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Area type="monotone" dataKey="contacted" stroke="#6366f1" fill="url(#cContacted)" name="Contacted" />
                  <Area type="monotone" dataKey="replied" stroke="#34d399" fill="url(#cReplied)" name="Replied" />
                  <Area type="monotone" dataKey="listed" stroke="#fbbf24" fill="none" strokeDasharray="4 2" name="Listed" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              项目状态分布 / Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span>{d.name}: {d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
                暂无数据 / No data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Follow-up Alert */}
      {(followUpProjects?.length || 0) > 0 && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏰</span>
                <div>
                  <p className="font-medium text-yellow-300">
                    {followUpProjects!.length} 个项目需要跟进 / {followUpProjects!.length} projects need follow-up
                  </p>
                  <p className="text-sm text-yellow-300/70">这些项目2天内未回复，建议立即跟进</p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40"
                onClick={() => navigate("/follow-up")}
              >
                查看详情
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ title, value, sub, color, icon }: {
  title: string;
  value: string | number;
  sub: string;
  color: string;
  icon: string;
}) {
  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <span className="text-2xl opacity-60">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}
