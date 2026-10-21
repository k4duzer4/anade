'use client';

import { createContext, useContext, type ReactElement } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

// Keep floating controls inside the native dialog's top layer when a modal is open.
export const FloatingLayerContext = createContext<HTMLElement | null>(null);

export function Tooltip({ content, children }: { content: string; children: ReactElement }) {
  const container = useContext(FloatingLayerContext);
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal container={container}>
        <TooltipPrimitive.Content className="anade-tooltip" sideOffset={9} collisionPadding={12}>
          {content}
          <TooltipPrimitive.Arrow className="anade-tooltip-arrow" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
