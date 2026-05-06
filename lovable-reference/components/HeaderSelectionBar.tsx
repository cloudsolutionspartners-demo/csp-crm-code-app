import { useEffect } from 'react';
import { useHeaderActions } from '@/components/AppLayout';
import { SelectionActionBar } from '@/components/SelectionActionBar';

interface HeaderSelectionBarProps {
  count: number;
  onClearSelection: () => void;
  entityLabel?: string;
  showActivate?: boolean;
  showDeactivate?: boolean;
  showDelete?: boolean;
  showDownload?: boolean;
  extraActions?: React.ReactNode;
}

export function HeaderSelectionBar(props: HeaderSelectionBarProps) {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    if (props.count > 0) {
      setActions(
        <SelectionActionBar {...props} />
      );
    } else {
      setActions(null);
    }
    return () => setActions(null);
  }, [props.count, props.entityLabel, props.showActivate, props.showDeactivate, props.showDelete, props.showDownload]);

  return null;
}
