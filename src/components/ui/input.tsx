'use client';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';
export const Input = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<'input'>
>(function Input({ className, placeholder, ...props }, ref) {
  const supportsPlaceholder = ![
    'checkbox',
    'radio',
    'range',
    'file',
    'hidden',
    'color',
  ].includes(props.type ?? 'text');
  const hint =
    props.type === 'email'
      ? 'you@example.com'
      : props.type === 'search'
        ? 'Search...'
        : props.type === 'number'
          ? 'Enter a number'
          : props.type === 'password'
            ? 'Enter your password'
            : props['aria-label']
              ? `Enter ${props['aria-label'].toLowerCase()}`
              : 'Enter text';
  return (
    <input
      ref={ref}
      placeholder={supportsPlaceholder ? (placeholder ?? hint) : undefined}
      data-slot="input"
      className={cn('vs-input', className)}
      {...props}
    />
  );
});
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<'textarea'>
>(function Textarea(
  { className, placeholder = 'Write a note or description...', ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      placeholder={placeholder}
      data-slot="textarea"
      className={cn('vs-textarea', className)}
      {...props}
    />
  );
});
