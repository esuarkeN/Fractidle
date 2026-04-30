import { StatusIcons } from "../../ui/icons";

type Status = "stable" | "growing" | "mutating" | "locked" | "new" | "warning" | "complete";

type Props = {
  status: Status;
  label: string;
};

export function StatusBadge({ status, label }: Props) {
  const Icon = StatusIcons[status];
  return (
    <span className={`status-badge status-${status}`}>
      <Icon size={13} />
      {label}
    </span>
  );
}
