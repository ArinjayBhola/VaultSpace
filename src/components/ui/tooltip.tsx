'use client';
import * as Primitive from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Primitive.Provider delayDuration={250} skipDelayDuration={120}>
      {children}
    </Primitive.Provider>
  );
}
export function Tooltip({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactElement;
}) {
  if (!label) return children;
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className="vault-tooltip"
          side="top"
          sideOffset={7}
          collisionPadding={10}
        >
          {label}
          <Primitive.Arrow
            className="vault-tooltip-arrow"
            width={9}
            height={4}
          />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
