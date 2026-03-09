import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

const SCENARIO_CONFIG = {
  first_contact: { label: "首次联系 / First Contact", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  follow_up: { label: "跟进 / Follow-up", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
  quote: { label: "报价 / Quote", color: "bg-green-500/20 text-green-300 border-green-500/40" },
  negotiation: { label: "洽谈 / Negotiation", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  closing: { label: "成交 / Closing", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
};

type TemplateForm = {
  name: string;
  scenario: "first_contact" | "follow_up" | "quote" | "negotiation" | "closing";
  channel: "twitter" | "telegram" | "email" | "all";
  subject?: string;
  bodyEn: string;
  bodyCn?: string;
  isDefault: boolean;
};

export default function Templates() {
  const [scenario, setScenario] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: templates, refetch } = trpc.templates.list.useQuery({ scenario: scenario === "all" ? undefined : scenario });

  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => { toast.success("模板已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">沟通模板 / Templates</h1>
          <p className="text-muted-foreground text-sm">管理英文沟通模板 / Manage English outreach templates</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>+ 新建模板</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ value: "all", label: "全部" }, ...Object.entries(SCENARIO_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))].map((opt) => (
          <Button
            key={opt.value}
            variant={scenario === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setScenario(opt.value)}
            className={scenario === opt.value ? "" : "border-border text-muted-foreground"}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(templates || []).map((t) => {
          const scenarioCfg = SCENARIO_CONFIG[t.scenario as keyof typeof SCENARIO_CONFIG];
          return (
            <Card key={t.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
                      {t.isDefault && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">默认</span>}
                    </div>
                    <div className="flex gap-1 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${scenarioCfg?.color}`}>
                        {scenarioCfg?.label}
                      </span>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded border border-border capitalize">
                        {t.channel}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-primary"
                      onClick={() => setEditingId(t.id)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-400 hover:text-red-300"
                      onClick={() => { if (confirm("确认删除？")) deleteMutation.mutate({ id: t.id }); }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {t.subject && (
                  <div className="mb-2">
                    <span className="text-xs text-muted-foreground">Subject: </span>
                    <span className="text-xs text-foreground">{t.subject}</span>
                  </div>
                )}
                <div className="bg-secondary/50 rounded p-2 text-xs text-foreground/80 whitespace-pre-wrap line-clamp-6 font-mono leading-relaxed">
                  {t.bodyEn}
                </div>
                {t.bodyCn && (
                  <div className="mt-2 bg-secondary/30 rounded p-2 text-xs text-muted-foreground line-clamp-3">
                    {t.bodyCn}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>使用次数 / Used: {t.usageCount}</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(!templates || templates.length === 0) && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-4xl mb-3">📝</p>
            <p>暂无模板 / No templates yet</p>
            <p className="text-xs mt-1">系统会自动创建默认模板 / Default templates will be created automatically</p>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建模板 / Create Template</DialogTitle>
          </DialogHeader>
          <TemplateForm onSuccess={() => { setShowCreate(false); refetch(); }} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingId && (
        <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
          <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑模板 / Edit Template</DialogTitle>
            </DialogHeader>
            <TemplateForm
              templateId={editingId}
              onSuccess={() => { setEditingId(null); refetch(); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function TemplateForm({ templateId, onSuccess }: { templateId?: number; onSuccess: () => void }) {
  const { data: existing } = trpc.templates.get.useQuery({ id: templateId! }, { enabled: !!templateId });

  const { register, handleSubmit, watch, setValue } = useForm<TemplateForm>({
    defaultValues: {
      scenario: "first_contact",
      channel: "all",
      isDefault: false,
    },
  });

  // Populate form when editing
  if (existing && !watch("bodyEn")) {
    setValue("name", existing.name);
    setValue("scenario", existing.scenario as any);
    setValue("channel", existing.channel as any);
    setValue("subject", existing.subject || "");
    setValue("bodyEn", existing.bodyEn);
    setValue("bodyCn", existing.bodyCn || "");
    setValue("isDefault", existing.isDefault);
  }

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => { toast.success("模板已创建"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => { toast.success("模板已更新"); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = (data: TemplateForm) => {
    if (templateId) {
      updateMutation.mutate({ id: templateId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">模板名称 *</Label>
        <Input {...register("name", { required: true })} className="bg-input border-border mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">场景 Scenario *</Label>
          <Select value={watch("scenario")} onValueChange={(v: any) => setValue("scenario", v)}>
            <SelectTrigger className="bg-input border-border mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="first_contact">首次联系</SelectItem>
              <SelectItem value="follow_up">跟进</SelectItem>
              <SelectItem value="quote">报价</SelectItem>
              <SelectItem value="negotiation">洽谈</SelectItem>
              <SelectItem value="closing">成交</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">渠道 Channel</Label>
          <Select value={watch("channel")} onValueChange={(v: any) => setValue("channel", v)}>
            <SelectTrigger className="bg-input border-border mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">全渠道 All</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">邮件主题 Subject (Email only)</Label>
        <Input {...register("subject")} className="bg-input border-border mt-1" placeholder="Listing Opportunity for {{projectName}}" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">英文正文 English Body * (支持变量: {"{{projectName}} {{symbol}} {{contactName}}"})</Label>
        <Textarea {...register("bodyEn", { required: true })} className="bg-input border-border mt-1 font-mono text-xs" rows={10} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">中文翻译 Chinese Translation (可选)</Label>
        <Textarea {...register("bodyCn")} className="bg-input border-border mt-1 text-xs" rows={6} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={watch("isDefault")} onCheckedChange={(v) => setValue("isDefault", v)} />
        <Label className="text-xs text-muted-foreground">设为默认模板 / Set as default</Label>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "保存中..." : (templateId ? "更新模板" : "创建模板")}
      </Button>
    </form>
  );
}
