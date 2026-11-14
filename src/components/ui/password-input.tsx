'use client';
import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './input';
import { Tooltip } from './tooltip';
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<'input'>, 'type'>
>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <Input
        {...props}
        placeholder={props.placeholder ?? 'Enter your password'}
        ref={ref}
        type={visible ? 'text' : 'password'}
      />
      <Tooltip label={visible ? 'Hide password' : 'Show password'}>
        <button
          type="button"
          className="icon-btn password-reveal"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          disabled={props.disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </Tooltip>
    </div>
  );
});
