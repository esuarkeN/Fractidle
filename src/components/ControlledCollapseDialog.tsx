import * as Dialog from "@radix-ui/react-dialog";

type Props = {
  open: boolean;
  reward: number;
  requirement?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ControlledCollapseDialog({ open, reward, requirement, onOpenChange, onConfirm }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="collapse-confirm">
          <Dialog.Title>Controlled Collapse Available</Dialog.Title>
          <Dialog.Description>
            Controlled Collapse condenses this run into {reward} Stable Mutation{reward === 1 ? "" : "s"}. Most active cultures, Essence, Genetic Patterns, culture upgrades, and temporary genome state will reset.
          </Dialog.Description>
          <ul className="collapse-reset-list">
            <li>Restart state: one Root Culture in the Root Culture Chamber.</li>
            <li>Stable Mutations and purchased Stable Mutation upgrades persist.</li>
            <li>Retention upgrades can preserve chambers, genes, patterns, research, and starter cultures.</li>
            {requirement && <li>Next runs require deeper extraction. Current requirement: {requirement} run Essence.</li>}
          </ul>
          <div className="collapse-confirm-actions">
            <Dialog.Close>Abort</Dialog.Close>
            <Dialog.Close onClick={onConfirm}>Authorize Collapse</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
