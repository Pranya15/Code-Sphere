import { formatDistanceToNow } from "date-fns";
import { Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function Panel({ children, className = "" }) {
  return <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className={`glass-card min-w-0 rounded-xl p-4 shadow-panel transition hover:-translate-y-0.5 hover:shadow-glow ${className}`}>{children}</motion.section>;
}

export function Button({ children, className = "", variant = "primary", size = "md", ...props }) {
  const sizes = {
    sm: "min-h-8 px-2.5 text-xs",
    md: "min-h-10 px-3 text-sm"
  };
  const baseStyles = `inline-flex min-w-0 items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size] || sizes.md}`;
  const styles = variant === "ghost"
    ? "border border-[var(--line)] bg-white/50 text-slate-700 hover:border-violet-300 hover:bg-white/75 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/12"
    : "aurora-gradient text-white shadow-[0_12px_34px_rgba(124,58,237,0.28)] hover:brightness-110";
  return <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className={`${baseStyles} ${styles} ${className}`} {...props}>{children}</motion.button>;
}

export function Input({ className = "", ...props }) {
  return <input className={`min-h-10 w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 text-sm text-[var(--text)] outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-[var(--ring)] focus-visible:ring-violet-500 dark:bg-white/10 dark:text-[var(--text)] ${className}`} {...props} />;
}

export function Select({ className = "", ...props }) {
  return <select className={`min-h-10 w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 text-sm text-[var(--text)] outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-[var(--ring)] focus-visible:ring-violet-500 dark:bg-carbon dark:text-[var(--text)] ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={`min-h-28 w-full rounded-lg border border-[var(--line)] bg-white/70 p-3 text-sm text-[var(--text)] outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-[var(--ring)] focus-visible:ring-violet-500 dark:bg-white/10 dark:text-[var(--text)] ${className}`} {...props} />;
}

export function Badge({ children, tone = "slate", className = "" }) {
  const tones = { red: "bg-rose-500/10 text-rose-600 dark:text-rose-300", rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300", amber: "bg-amber-400/15 text-amber-700 dark:text-amber-200", green: "bg-emerald-400/15 text-emerald-700 dark:text-emerald-200", teal: "bg-cyan-400/15 text-cyan-700 dark:text-cyan-200", violet: "bg-violet-500/10 text-violet-700 dark:text-violet-200", slate: "bg-violet-500/10 text-violet-700 dark:text-violet-200" };
  return <span className={`inline-flex max-w-full items-center rounded-full border border-white/20 px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate} ${className}`}><span className="truncate">{children}</span></span>;
}

export function Loading() {
  return <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]"><div className="glass-card rounded-2xl p-6"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></div></div>;
}

export function Empty({ title, action }) {
  return <div className="rounded-xl border border-dashed border-violet-300/50 bg-violet-500/5 p-8 text-center text-sm text-slate-500 dark:border-violet-400/25 dark:text-slate-400"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl aurora-gradient text-white"><Sparkles className="h-5 w-5" /></div><p className="font-semibold text-[var(--text)]">{title}</p>{action}</div>;
}

export function Skeleton({ className = "" }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function timeAgo(value) {
  return value ? formatDistanceToNow(new Date(value), { addSuffix: true }) : "";
}
