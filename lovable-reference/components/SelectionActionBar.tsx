import { Button } from '@/components/ui/button';
import { CheckSquare, Power, PowerOff, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';

interface SelectionActionBarProps {
  count: number;
  onClearSelection: () => void;
  entityLabel?: string;
  showActivate?: boolean;
  showDeactivate?: boolean;
  showDelete?: boolean;
  showDownload?: boolean;
  extraActions?: React.ReactNode;
}

export function SelectionActionBar({
  count, onClearSelection, entityLabel = 'records',
  showActivate = true, showDeactivate = true, showDelete = true, showDownload = true,
  extraActions,
}: SelectionActionBarProps) {
  const confirm = useConfirm();
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground mr-1">
        <CheckSquare className="h-4 w-4 inline mr-1" />{count} selected
      </span>
      {showActivate && (
        <Button size="sm" variant="outline" onClick={() => { toast.success(`${count} ${entityLabel} activated`); onClearSelection(); }}>
          <Power className="h-3.5 w-3.5 mr-1" />Activate
        </Button>
      )}
      {showDeactivate && (
        <Button size="sm" variant="outline" onClick={() => { toast.success(`${count} ${entityLabel} deactivated`); onClearSelection(); }}>
          <PowerOff className="h-3.5 w-3.5 mr-1" />Deactivate
        </Button>
      )}
      {showDelete && (
        <Button size="sm" variant="destructive" onClick={async () => {
          const ok = await confirm({
            title: 'Delete records',
            description: `Are you sure you want to delete ${count} ${entityLabel}? This action cannot be undone.`,
          });
          if (!ok) return;
          toast.success(`${count} ${entityLabel} deleted`);
          onClearSelection();
        }}>
          <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
        </Button>
      )}
      {showDownload && (
        <Button size="sm" variant="outline" onClick={() => toast.success(`Downloading ${count} ${entityLabel} to Excel`)}>
          <Download className="h-3.5 w-3.5 mr-1" />Download
        </Button>
      )}
      {extraActions}
    </div>
  );
}
