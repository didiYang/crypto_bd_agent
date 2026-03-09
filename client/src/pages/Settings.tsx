import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useForm } from "react-hook-form";

export default function Settings() {
  const { data: settings, refetch } = trpc.settings.get.useQuery();
  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => { toast.success("设置已保存 / Settings saved"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const testTgMutation = trpc.settings.testTelegram.useMutation({
    onSuccess: () => toast.success("Telegram测试消息已发送 / Test message sent"),
    onError: (e) => toast.error(`Telegram测试失败: ${e.message}`),
  });

  const seedMutation = trpc.settings.seedTemplates.useMutation({
    onSuccess: (d) => toast.success(`已创建 ${d.created} 个默认模板`),
    onError: (e) => toast.error(e.message),
  });

  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      telegramBotToken: "",
      telegramChatId: "",
      telegramNotifyNewProject: true,
      telegramNotifyReply: true,
      telegramNotifyFollowUp: true,
      cgApiKey: "",
      cmcApiKey: "",
      followUpDays: 2,
      autoFollowUp: false,
      autoDiscover: false,
      discoverInterval: 60,
    },
  });

  // Populate when data loads
  if (settings && !watch("telegramBotToken") && settings.telegramBotToken) {
    setValue("telegramBotToken", settings.telegramBotToken || "");
    setValue("telegramChatId", settings.telegramChatId || "");
    setValue("telegramNotifyNewProject", Boolean(settings.telegramNotifyNewProject ?? true));
    setValue("telegramNotifyReply", Boolean(settings.telegramNotifyReply ?? true));
    setValue("telegramNotifyFollowUp", Boolean(settings.telegramNotifyFollowUp ?? true));
    setValue("cgApiKey", settings.cgApiKey || "");
    setValue("cmcApiKey", settings.cmcApiKey || "");
    setValue("followUpDays", Number(settings.followUpDays ?? 2));
    setValue("autoFollowUp", Boolean(settings.autoFollowUp ?? false));
    setValue("autoDiscover", Boolean(settings.autoDiscover ?? false));
    setValue("discoverInterval", Number(settings.discoverInterval ?? 60));
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">系统设置 / Settings</h1>
        <p className="text-muted-foreground text-sm">配置API密钥、通知和自动化参数</p>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
        {/* Telegram */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-blue-400">✈</span> Telegram 通知配置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Bot Token</Label>
              <Input
                {...register("telegramBotToken")}
                className="bg-input border-border mt-1 font-mono text-xs"
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                type="password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                通过 <a href="https://t.me/BotFather" target="_blank" className="text-primary">@BotFather</a> 创建Bot获取Token
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Chat ID (你的Telegram用户ID)</Label>
              <Input
                {...register("telegramChatId")}
                className="bg-input border-border mt-1 font-mono text-xs"
                placeholder="123456789"
              />
              <p className="text-xs text-muted-foreground mt-1">
                通过 <a href="https://t.me/userinfobot" target="_blank" className="text-primary">@userinfobot</a> 获取你的Chat ID
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">通知触发条件</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">发现新项目时通知</span>
                <Switch checked={watch("telegramNotifyNewProject")} onCheckedChange={(v) => setValue("telegramNotifyNewProject", v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">项目方回复时通知</span>
                <Switch checked={watch("telegramNotifyReply")} onCheckedChange={(v) => setValue("telegramNotifyReply", v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">跟进提醒通知</span>
                <Switch checked={watch("telegramNotifyFollowUp")} onCheckedChange={(v) => setValue("telegramNotifyFollowUp", v)} />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
              onClick={() => testTgMutation.mutate()}
              disabled={testTgMutation.isPending}
            >
              {testTgMutation.isPending ? "发送中..." : "🔔 发送测试消息"}
            </Button>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🔑 API 密钥配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">CoinGecko API Key (可选，提高速率限制)</Label>
              <Input
                {...register("cgApiKey")}
                className="bg-input border-border mt-1 font-mono text-xs"
                placeholder="CG-xxxxxxxxxxxxxxxxxxxxxxxx"
                type="password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                免费版无需API Key，Pro版可获得更高请求频率
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">CoinMarketCap API Key</Label>
              <Input
                {...register("cmcApiKey")}
                className="bg-input border-border mt-1 font-mono text-xs"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                type="password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                从 <a href="https://coinmarketcap.com/api/" target="_blank" className="text-primary">CoinMarketCap API</a> 获取免费Key
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Automation */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">⚙️ 自动化配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">自动跟进 / Auto Follow-up</span>
                <p className="text-xs text-muted-foreground">自动向无回复项目发送跟进消息</p>
              </div>
              <Switch checked={watch("autoFollowUp")} onCheckedChange={(v) => setValue("autoFollowUp", v)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">跟进等待天数 / Follow-up After (days)</Label>
              <Input
                type="number"
                {...register("followUpDays", { valueAsNumber: true })}
                className="bg-input border-border mt-1 w-24"
                min={1}
                max={14}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">自动发现项目 / Auto Discover</span>
                <p className="text-xs text-muted-foreground">定时扫描CoinGecko/CMC新项目</p>
              </div>
              <Switch checked={watch("autoDiscover")} onCheckedChange={(v) => setValue("autoDiscover", v)} />
            </div>
            {watch("autoDiscover") && (
              <div>
                <Label className="text-xs text-muted-foreground">扫描间隔 / Scan Interval (minutes)</Label>
                <Input
                  type="number"
                  {...register("discoverInterval", { valueAsNumber: true })}
                  className="bg-input border-border mt-1 w-32"
                  min={15}
                  max={1440}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Default Templates */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📝 默认模板</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              系统预置了基于真实BD经验的英文沟通模板，包括首次联系、跟进、报价等场景。
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? "创建中..." : "🌱 初始化默认模板"}
            </Button>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "保存中..." : "💾 保存所有设置"}
        </Button>
      </form>
    </div>
  );
}
