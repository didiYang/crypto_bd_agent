import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#fbbf24", "#f87171", "#94a3b8"];

export default function Analytics() {
  const [days, setDays] = useState(30);

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: summary } = trpc.analytics.summary.useQuery();
  const { data: rangeData } = trpc.analytics.range.useQuery({ startDate, endDate });

  const stats = summary?.projects;
  const msgStats = summary?.messages;

  const total = Number(stats?.total || 0);
  const contacted = Number(stats?.contacted || 0);
  const replied = Number(stats?.replied || 0);
  const listed = Number(stats?.listed || 0);
  const rejected = Number(stats?.rejected || 0);

  const replyRate = contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : "0.0";
  const conversionRate = contacted > 0 ? ((listed / contacted) * 100).toFixed(1) : "0.0";
  const totalFees = Number(stats?.totalFees || 0);

  const chartData = (rangeData || []).map((d) => ({
    date: d.date.slice(5),
    contacted: d.projectsContacted,
    replied: d.projectsReplied,
    listed: d.projectsListed,
    messages: d.messagesSent,
  }));

  const funnelData = [
    { name: "Discovered", value: total, color: "#6366f1" },
    { name: "Contacted", value: contacted, color: "#22d3ee" },
    { name: "Replied", value: replied, color: "#34d399" },
    { name: "Negotiating", value: Number((stats as any)?.negotiating || 0), color: "#fbbf24" },
    { name: "Listed", value: listed, color: "#10b981" },
  ];

  const channelData = [
    { name: "Telegram", value: Number((msgStats as any)?.telegram || 0), color: "#3b82f6" },
    { name: "Twitter", value: Number((msgStats as any)?.twitter || 0), color: "#0ea5e9" },
    { name: "Email", value: Number((msgStats as any)?.email || 0), color: "#8b5cf6" },
    { name: "Discord", value: Number((msgStats as any)?.discord || 0), color: "#6366f1" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">数据分析 / Analytics</h1>
          <p className="text-muted-foreground text-sm">BD工作效率与转化率分析 / BD performance metrics</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
              className={days !== d ? "border-border text-muted-foreground" : ""}
            >
              {d}天
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="总项目数" titleEn="Total Projects" value={total} color="text-blue-400" icon="📊" />
        <MetricCard title="回复率" titleEn="Reply Rate" value={`${replyRate}%`} color="text-green-400" icon="💬" sub={`${replied} replied / ${contacted} contacted`} />
        <MetricCard title="转化率" titleEn="Conversion Rate" value={`${conversionRate}%`} color="text-yellow-400" icon="🏆" sub={`${listed} listed / ${contacted} contacted`} />
        <MetricCard title="总收入" titleEn="Total Revenue" value={`$${totalFees.toLocaleString()}`} color="text-emerald-400" icon="💰" sub="Listing Fees" />
      </div>

      {/* Trend Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {days}天趋势 / {days}-Day Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gContacted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gReplied" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} labelStyle={{ color: "#94a3b8" }} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
              <Area type="monotone" dataKey="contacted" stroke="#6366f1" fill="url(#gContacted)" name="Contacted" />
              <Area type="monotone" dataKey="replied" stroke="#34d399" fill="url(#gReplied)" name="Replied" />
              <Area type="monotone" dataKey="listed" stroke="#fbbf24" fill="none" strokeDasharray="4 2" name="Listed" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">转化漏斗 / Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {funnelData.map((item, i) => {
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium" style={{ color: item.color }}>{item.value} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="bg-secondary rounded-full h-2">
                      <div
                        className="rounded-full h-2 transition-all"
                        style={{ width: `${pct}%`, background: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">渠道分布 / Channel Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={channelData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                      {channelData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {channelData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}: {d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
                暂无消息数据 / No message data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Messages Bar Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">每日发送量 / Daily Messages Sent</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} labelStyle={{ color: "#94a3b8" }} />
              <Bar dataKey="messages" fill="#6366f1" radius={[4, 4, 0, 0]} name="Messages Sent" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, titleEn, value, color, icon, sub }: {
  title: string; titleEn: string; value: string | number; color: string; icon: string; sub?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title} / {titleEn}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <span className="text-2xl opacity-60">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}
