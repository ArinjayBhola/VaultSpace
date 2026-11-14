'use client';

import { Tooltip } from '@/components/ui/tooltip';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { X } from 'lucide-react';
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className="dialog-content"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            heading.current?.focus();
          }}
        >
          <DialogPrimitive.Title asChild>
            <h2 ref={heading} tabIndex={-1} className="dialog-title">
              {title}
            </h2>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            className="muted"
            style={{
              fontSize: 'max(9px, calc(12px * var(--vault-font-scale, 1)))',
              lineHeight: 1.7,
            }}
          >
            {description}
          </DialogPrimitive.Description>
          <Tooltip label="Close dialog">
            <DialogPrimitive.Close
              className="icon-btn dialog-close"
              aria-label="Close dialog"
              style={{ position: 'absolute', right: 14, top: 14 }}
            >
              <X size={17} />
            </DialogPrimitive.Close>
          </Tooltip>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
