import { type RefObject, useRef, useState } from "react";

import { useCloseOnHistoryBack } from "~/hooks/useCloseOnHistoryBack";

interface OverlayRootProps<Details, Actions> {
  readonly open?: boolean | undefined;
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean, details: Details) => void) | undefined;
  readonly actionsRef?: RefObject<Actions | null> | undefined;
}

export function useCloseOnBackRoot<Details, Actions extends { close: () => void }>(
  props: OverlayRootProps<Details, Actions>,
) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(props.defaultOpen ?? false);
  const ownActionsRef = useRef<Actions | null>(null);
  const actionsRef = props.actionsRef ?? ownActionsRef;
  useCloseOnHistoryBack(props.open ?? uncontrolledOpen, () => actionsRef.current?.close());
  return {
    actionsRef,
    onOpenChange: (open: boolean, details: Details) => {
      setUncontrolledOpen(open);
      props.onOpenChange?.(open, details);
    },
  };
}
