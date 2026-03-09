import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { StatusBadge, ChannelBadge, type ProjectStatus } from "@/components/StatusBadge";
import { Streamdown } from "streamdown";

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = Number(params.id);

  const { data: project, refetch } = trpc.projects.get.useQuery({ id });
  const { data: messages, refetch: refetchMessages } = trpc.messages.list.useQuery({ projectId: id });
  const { data: templates } = trpc.templates.list.useQuery({});

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [channel, setChannel] = useState<"twitter" | "telegram" | "email" | "discord" | "manual">("telegram");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyCn, setBodyCn] = useState("");
  const [subject, setSubject] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editStatus, setEditStatus] = useState(false);
  const [llmAnalysis, setLlmAnalysis] = useState<any>(null);

  const previewQuery = trpc.templates.preview.useQuery(
    { templateId: selectedTemplateId!, projectId: id },
    { enabled: !!selectedTemplateId }
  );

  const sendMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      toast.success("消息已发送 / Message sent");
      setBodyEn(""); setBodyCn(""); setSubject(""); setSelectedTemplateId(null);
      refetch(); refetchMessages();
    },
    onError: (e) => toast.error(e.message),
  });

  const replyMutation = trpc.messages.recordReply.useMutation({
    onSuccess: () => {
      toast.success("回复已记录 / Reply recorded");
      setReplyText(""); setShowReplyForm(false);
      refetch(); refetchMessages();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.projects.update.useMutation({
    onSuccess: () => { toast.success("已更新 / Updated"); refetch(); setEditStatus(false); },
    onError: (e) => toast.error(e.message),
  });

  const enrichMutation = trpc.projects.enrichContacts.useMutation({
    onSuccess: (data) => {
      toast.success(`采集到 ${Object.keys(data).length} 个联系渠道`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const llmMutation = trpc.llm.analyzeReply.useMutation({
    onSuccess: (data) => { setLlmAnalysis(data); toast.success("AI分析完成"); },
    onError: (e) => toast.error(e.message),
  });

  const generateMutation = trpc.llm.generatePersonalized.useMutation({
    onSuccess: (data) => {
      setBodyEn(data.bodyEn);
      setBodyCn(data.bodyCn);
      setSubject(data.subject || "");
      toast.success("AI已生成个性化消息");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!project) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      加载中... / Loading...
    </div>
  );

  const handleTemplateSelect = (tid: string) => {
    const id = Number(tid);
    setSelectedTemplateId(id);
    if (previewQuery.data) {
      setBodyEn(previewQuery.data.bodyEn || "");
      setBodyCn(previewQuery.data.bodyCn || "");
      setSubject(previewQuery.data.subject || "");
    }
  };

  // Update body when preview loads
  if (previewQuery.data && selectedTemplateId && !bodyEn) {
    setBodyEn(previewQuery.data.bodyEn || "");
    setBodyCn(previewQuery.data.bodyCn || "");
    setSubject(previewQuery.data.subject || "");
  }

  return (
    <div className="space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="text-muted-foreground">
          ← 返回
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {project.logoUrl && <img src={project.logoUrl} alt={project.name} className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            <h1 className="text-xl font-bold">{project.name} <span className="text-muted-foreground text-base">({project.symbol})</span></h1>
            {project.isMeme && <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">MEME</span>}
            <StatusBadge status={project.status as ProjectStatus} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Project Info */}
        <div className="space-y-4">
          {/* Basic Info */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">项目信息 / Project Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow label="Chain" value={project.chain || "—"} />
              <InfoRow label="Category" value={project.category || "—"} />
              <InfoRow label="Market Cap" value={project.marketCap ? `$${Number(project.marketCap).toLocaleString()}` : "—"} />
              <InfoRow label="Price" value={project.price ? `$${Number(project.price).toFixed(8)}` : "—"} />
              {project.description && (
                <div>
                  <span className="text-muted-foreground text-xs">Description</span>
                  <p className="text-xs mt-1 text-foreground/80 line-clamp-3">{project.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">联系渠道 / Contacts</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-6 text-primary"
                  onClick={() => enrichMutation.mutate({ id })}
                  disabled={enrichMutation.isPending}
                >
                  {enrichMutation.isPending ? "采集中..." : "🔍 自动采集"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {project.website && <ContactLink icon="🌐" label="Website" href={project.website} />}
              {project.twitterUrl && <ContactLink icon="𝕏" label="Twitter" href={project.twitterUrl} />}
              {project.telegramUrl && <ContactLink icon="✈" label="Telegram" href={project.telegramUrl} />}
              {project.discordUrl && <ContactLink icon="◈" label="Discord" href={project.discordUrl} />}
              {project.officialEmail && <ContactLink icon="✉" label="Email" href={`mailto:${project.officialEmail}`} value={project.officialEmail} />}
              {project.contactPersonName && <InfoRow label="联系人" value={project.contactPersonName} />}
              {project.contactPersonTg && <InfoRow label="联系人TG" value={project.contactPersonTg} />}
              {!project.website && !project.twitterUrl && !project.telegramUrl && !project.officialEmail && (
                <p className="text-muted-foreground text-xs">暂无联系渠道 / No contacts yet</p>
              )}
            </CardContent>
          </Card>

          {/* Status Update */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">状态管理 / Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select
                value={project.status}
                onValueChange={(v) => updateMutation.mutate({ id, status: v as ProjectStatus })}
              >
                <SelectTrigger className="bg-input border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {["discovered", "contacted", "replied", "negotiating", "listed", "rejected", "blacklisted"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {project.status === "listed" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Listing Fee (USDT)</Label>
                  <Input
                    type="number"
                    defaultValue={project.listingFee?.toString()}
                    className="bg-input border-border text-sm"
                    onBlur={(e) => updateMutation.mutate({ id, listingFee: e.target.value })}
                  />
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">备注 Notes</Label>
                <Textarea
                  defaultValue={project.notes || ""}
                  className="bg-input border-border text-xs mt-1"
                  rows={2}
                  onBlur={(e) => updateMutation.mutate({ id, notes: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Messages */}
        <div className="lg:col-span-2 space-y-4">
          {/* Send Message */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">发送消息 / Send Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                  <SelectTrigger className="w-36 bg-input border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="telegram">✈ Telegram</SelectItem>
                    <SelectItem value="twitter">𝕏 Twitter</SelectItem>
                    <SelectItem value="email">✉ Email</SelectItem>
                    <SelectItem value="discord">◈ Discord</SelectItem>
                    <SelectItem value="manual">✎ Manual</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="flex-1 bg-input border-border text-sm">
                    <SelectValue placeholder="选择模板 / Select template..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {(templates || []).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10 whitespace-nowrap"
                  onClick={() => generateMutation.mutate({ projectId: id, scenario: "first_contact" })}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? "生成中..." : "✨ AI生成"}
                </Button>
              </div>
              {channel === "email" && (
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject..."
                  className="bg-input border-border text-sm"
                />
              )}
              <div>
                <Label className="text-xs text-muted-foreground">English Message *</Label>
                <Textarea
                  value={bodyEn}
                  onChange={(e) => setBodyEn(e.target.value)}
                  className="bg-input border-border text-sm mt-1 font-mono"
                  rows={6}
                  placeholder="Type your message in English..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">中文翻译 (可选)</Label>
                <Textarea
                  value={bodyCn}
                  onChange={(e) => setBodyCn(e.target.value)}
                  className="bg-input border-border text-sm mt-1"
                  rows={3}
                  placeholder="中文翻译..."
                />
              </div>
              <Button
                className="w-full"
                onClick={() => sendMutation.mutate({ projectId: id, channel, bodyEn, bodyCn: bodyCn || undefined, subject: subject || undefined, templateId: selectedTemplateId || undefined })}
                disabled={!bodyEn || sendMutation.isPending}
              >
                {sendMutation.isPending ? "发送中..." : `📤 发送 via ${channel}`}
              </Button>
            </CardContent>
          </Card>

          {/* Record Reply */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">记录回复 / Record Reply</CardTitle>
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setShowReplyForm(!showReplyForm)}>
                  {showReplyForm ? "收起" : "+ 记录回复"}
                </Button>
              </div>
            </CardHeader>
            {showReplyForm && (
              <CardContent className="space-y-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="bg-input border-border text-sm"
                  rows={4}
                  placeholder="Paste project team's reply here..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => replyMutation.mutate({ projectId: id, channel, bodyEn: replyText })}
                    disabled={!replyText || replyMutation.isPending}
                  >
                    记录
                  </Button>
                  {replyText && messages && messages.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-purple-500/40 text-purple-300"
                      onClick={() => llmMutation.mutate({ messageId: messages[messages.length - 1].id, replyText, projectName: project.name })}
                      disabled={llmMutation.isPending}
                    >
                      {llmMutation.isPending ? "分析中..." : "🤖 AI分析"}
                    </Button>
                  )}
                </div>
                {llmAnalysis && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3 space-y-2">
                    <div className="flex gap-2 text-xs">
                      <span className="text-muted-foreground">Intent:</span>
                      <span className="text-purple-300 font-medium">{llmAnalysis.intent}</span>
                      <span className="text-muted-foreground ml-2">Sentiment:</span>
                      <span className={llmAnalysis.sentiment === "positive" ? "text-green-300" : llmAnalysis.sentiment === "negative" ? "text-red-300" : "text-yellow-300"}>
                        {llmAnalysis.sentiment}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">AI建议 / Suggestion:</p>
                      <p className="text-xs text-foreground">{llmAnalysis.suggestion}</p>
                      <p className="text-xs text-muted-foreground mt-1">{llmAnalysis.suggestionCn}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Message History */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">沟通记录 / Message History ({messages?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!messages || messages.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">暂无沟通记录 / No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg p-3 text-sm ${msg.direction === "outbound"
                        ? "bg-primary/10 border border-primary/20 ml-4"
                        : "bg-green-500/10 border border-green-500/20 mr-4"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={msg.direction === "outbound" ? "text-primary text-xs" : "text-green-400 text-xs"}>
                            {msg.direction === "outbound" ? "📤 Sent" : "📥 Received"}
                          </span>
                          <ChannelBadge channel={msg.channel} />
                          {msg.isFollowUp && <span className="text-xs text-yellow-400">↩ Follow-up #{msg.followUpNumber}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-foreground/90 whitespace-pre-wrap text-xs leading-relaxed">{msg.bodyEn}</div>
                      {msg.bodyCn && (
                        <div className="mt-2 pt-2 border-t border-border/50 text-muted-foreground text-xs">{msg.bodyCn}</div>
                      )}
                      {msg.replyIntent && (
                        <div className="mt-2 flex gap-2 text-xs">
                          <span className="text-purple-400">Intent: {msg.replyIntent}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className={msg.replysentiment === "positive" ? "text-green-400" : msg.replysentiment === "negative" ? "text-red-400" : "text-yellow-400"}>
                            {msg.replysentiment}
                          </span>
                        </div>
                      )}
                      {msg.llmSuggestion && (
                        <div className="mt-2 bg-purple-500/10 rounded p-2 text-xs text-purple-300">
                          💡 {msg.llmSuggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground text-xs font-medium">{value}</span>
    </div>
  );
}

function ContactLink({ icon, label, href, value }: { icon: string; label: string; href: string; value?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
      {value && <span className="text-muted-foreground truncate max-w-32">{value}</span>}
    </a>
  );
}
