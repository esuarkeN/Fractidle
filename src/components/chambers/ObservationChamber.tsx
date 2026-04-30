import type { ReactNode } from "react";
import { Activity, FlaskConical } from "lucide-react";
import { StatusBadge } from "../ui-lab/StatusBadge";

type Props = {
  title: string;
  description: string;
  specimenCount: number;
  extractionPerSecond: string;
  status: "STABLE" | "GROWING" | "MUTATING" | "COLLAPSE READY";
  children: ReactNode;
  overlays?: ReactNode;
  className?: string;
};

export function ObservationChamber({ title, description, specimenCount, extractionPerSecond, status, children, overlays, className = "" }: Props) {
  const badgeStatus = status === "COLLAPSE READY" ? "warning" : status === "MUTATING" ? "mutating" : status === "GROWING" ? "growing" : "stable";
  return (
    <section className={`observation-chamber fractal-stage ${className}`}>
      <div className="corner-brackets" />
      <div className="scanner-overlay" />
      <div className="observation-topline">
        <div>
          <span>LIVE CULTURE FEED</span>
          <strong>{title}</strong>
        </div>
        <StatusBadge status={badgeStatus} label={status} />
      </div>
      {children}
      <div className="chamber-status">
        <span>CONTAINMENT: ACTIVE</span>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <div className="observation-metrics">
        <span><FlaskConical size={13} /> Specimens: {specimenCount}</span>
        <span><Activity size={13} /> Extraction: {extractionPerSecond}/s</span>
      </div>
      {overlays}
    </section>
  );
}
