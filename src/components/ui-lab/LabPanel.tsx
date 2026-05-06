import type { ComponentType, ReactNode } from "react";

type Props = {
  icon?: ComponentType<{ size?: number }>;
  title: string;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function LabPanel({ icon: Icon, title, meta, className = "", children }: Props) {
  return (
    <section className={`lab-panel ${className}`}>
      <header className="lab-panel-header">
        <span>{Icon && <Icon size={16} />} {title}</span>
        {meta && <strong>{meta}</strong>}
      </header>
      {children}
    </section>
  );
}
