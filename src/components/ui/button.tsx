import { Tooltip } from './tooltip';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
export const buttonVariants = cva('btn', {
  variants: {
    variant: {
      default: 'primary',
      outline: '',
      destructive: 'danger',
      ghost: 'icon-btn',
    },
    size: { default: '', sm: 'text-xs px-3 py-2', icon: 'h-9 w-9 p-0' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <Tooltip label={props['aria-label']}>
      <button
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    </Tooltip>
  );
}
