import type { ComponentType, ReactNode } from "react";
import { motion } from "motion/react";

type Props = {
  icon?: ComponentType<{ size?: number }>;
  title: string;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function LabPanel({ icon: Icon, title, meta, className = "", children }: Props) {
  return (
    <motion.section className={`lab-panel ${className}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <header className="lab-panel-header">
        <span>{Icon && <Icon size={16} />} {title}</span>
        {meta && <strong>{meta}</strong>}
      </header>
      {children}
    </motion.section>
  );
}
