import { cn } from "@/lib/utils";

export type ProjectStatus = "discovered" | "contacted" | "replied" | "negotiating" | "listed" | "rejected" | "blacklisted";

const STATUS_CONFIG: Record<ProjectStatus, { label: string; labelCn: string; className: string }> = {
  discovered: { label: "Discovered", labelCn: "已发现", className: "bg-blue-500/20 text-blue-300 border border-blue-500/40" },
  contacted: { label: "Contacted", labelCn: "已联系", className: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" },
  replied: { label: "Replied", labelCn: "已回复", className: "bg-green-500/20 text-green-300 border border-green-500/40" },
  negotiating: { label: "Negotiating", labelCn: "洽谈中", className: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" },
  listed: { label: "Listed ✓", labelCn: "已上币", className: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" },
  rejected: { label: "Rejected", labelCn: "已拒绝", className: "bg-red-500/20 text-red-300 border border-red-500/40" },
  blacklisted: { label: "Blacklisted", labelCn: "已拉黑", className: "bg-gray-500/20 text-gray-400 border border-gray-500/40" },
};

interface StatusBadgeProps {
  status: ProjectStatus;
  showCn?: boolean;
  className?: string;
}

export function StatusBadge({ status, showCn = false, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.discovered;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", config.className, className)}>
      {showCn ? config.labelCn : config.label}
    </span>
  );
}

export function getStatusLabel(status: string, cn = false): string {
  const config = STATUS_CONFIG[status as ProjectStatus];
  if (!config) return status;
  return cn ? config.labelCn : config.label;
}

export type ChannelType = "twitter" | "telegram" | "email" | "discord" | "manual";

const CHANNEL_CONFIG: Record<ChannelType, { label: string; icon: string; color: string }> = {
  twitter: { label: "Twitter/X", icon: "𝕏", color: "text-sky-400" },
  telegram: { label: "Telegram", icon: "✈", color: "text-blue-400" },
  email: { label: "Email", icon: "✉", color: "text-purple-400" },
  discord: { label: "Discord", icon: "◈", color: "text-indigo-400" },
  manual: { label: "Manual", icon: "✎", color: "text-gray-400" },
};

export function ChannelBadge({ channel, className }: { channel: string; className?: string }) {
  const config = CHANNEL_CONFIG[channel as ChannelType] || CHANNEL_CONFIG.manual;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", config.color, className)}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
