'use client';

import { Tooltip } from '@/components/ui/tooltip';
import * as Popover from '@radix-ui/react-popover';
import { useRef, useState, type KeyboardEvent } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from 'lucide-react';
import { Select, type ValueChange } from './select';
import { localDateLabel, localDateValue, timeZoneLabel } from '@/lib/time';
type Props = {
  value: string;
  onChange: (event: ValueChange) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
};
const emit = (value: string): ValueChange => ({
  target: { value },
  currentTarget: { value },
});
export function DatePicker({
  value,
  onChange,
  placeholder = 'Choose date',
  disabled,
  id,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  });
  const grid = useRef<HTMLDivElement>(null);
  const today = localDateValue(new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  const days = Array.from(
    { length: 42 },
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
  const focusDay = days.some((day) => localDateValue(day) === value)
    ? value
    : days.some((day) => localDateValue(day) === today)
      ? today
      : localDateValue(first);
  const localeMonths = Array.from({ length: 12 }, (_, i) =>
    new Date(2026, i, 1).toLocaleDateString(undefined, { month: 'long' }),
  );
  function choose(date: string) {
    onChange(emit(date));
    setOpen(false);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    const next = new Date(date);
    switch (event.key) {
      case 'ArrowLeft':
        next.setDate(next.getDate() - 1);
        break;
      case 'ArrowRight':
        next.setDate(next.getDate() + 1);
        break;
      case 'ArrowUp':
        next.setDate(next.getDate() - 7);
        break;
      case 'ArrowDown':
        next.setDate(next.getDate() + 7);
        break;
      case 'Home':
        next.setDate(next.getDate() - next.getDay());
        break;
      case 'End':
        next.setDate(next.getDate() + 6 - next.getDay());
        break;
      case 'PageUp':
        next.setMonth(next.getMonth() - 1);
        break;
      case 'PageDown':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    requestAnimationFrame(() =>
      grid.current
        ?.querySelector<HTMLButtonElement>(
          `[data-day="${localDateValue(next)}"]`,
        )
        ?.focus(),
    );
  }
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next && value) {
          const date = new Date(`${value}T00:00:00`);
          setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        }
        setOpen(next);
      }}
    >
      <Tooltip label={ariaLabel}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className={`vs-date-trigger ${value ? '' : 'is-placeholder'}`}
          >
            <CalendarDays size={17} />
            <span>{value ? localDateLabel(value) : placeholder}</span>
            <ChevronRight size={14} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          className="vs-calendar"
          sideOffset={8}
          align="start"
          collisionPadding={12}
          aria-label="Choose a date"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() =>
              grid.current
                ?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
                ?.focus(),
            );
          }}
        >
          <div className="vs-calendar-header">
            <Tooltip label="Previous month">
              <button
                className="icon-btn"
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
              >
                <ChevronLeft size={17} />
              </button>
            </Tooltip>
            <Select
              aria-label="Calendar month"
              value={monthIndex}
              onChange={(e) =>
                setMonth(new Date(year, Number(e.target.value), 1))
              }
            >
              {localeMonths.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Calendar year"
              value={year}
              onChange={(e) =>
                setMonth(new Date(Number(e.target.value), monthIndex, 1))
              }
            >
              {Array.from({ length: 101 }, (_, i) => year - 50 + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Tooltip label="Next month">
              <button
                className="icon-btn"
                type="button"
                aria-label="Next month"
                onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
              >
                <ChevronRight size={17} />
              </button>
            </Tooltip>
          </div>
          <div className="vs-calendar-weekdays" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) =>
              new Date(2026, 0, 4 + i).toLocaleDateString(undefined, {
                weekday: 'short',
              }),
            ).map((day) => (
              <span key={day}>{day.slice(0, 2)}</span>
            ))}
          </div>
          <div
            ref={grid}
            className="vs-calendar-grid"
            role="grid"
            aria-label={month.toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          >
            {Array.from({ length: 6 }, (_, week) => (
              <div role="row" className="vs-calendar-week" key={week}>
                {days.slice(week * 7, week * 7 + 7).map((day) => {
                  const key = localDateValue(day);
                  return (
                    <Tooltip
                      key={key}
                      label={day.toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    >
                      <button
                        key={key}
                        type="button"
                        role="gridcell"
                        data-day={key}
                        aria-selected={key === value}
                        aria-current={key === today ? 'date' : undefined}
                        aria-label={day.toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                        className={`vs-calendar-day ${day.getMonth() !== monthIndex ? 'outside' : ''} ${key === value ? 'selected' : ''} ${key === today ? 'today' : ''}`}
                        tabIndex={key === focusDay ? 0 : -1}
                        onKeyDown={(e) => keyboard(e, day)}
                        onClick={() => choose(key)}
                      >
                        {day.getDate()}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="vs-calendar-footer">
            <button className="tab" type="button" onClick={() => choose(today)}>
              Today
            </button>
            <span>Your local date</span>
            <button
              className="tab"
              type="button"
              disabled={!value}
              onClick={() => choose('')}
            >
              <X size={12} />
              Clear
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function DateTimePicker({ value, onChange, ...props }: Props) {
  const [day, time] = value.split('T');
  const [hour = '09', minute = '00'] = (time ?? '').split(':');
  function setDate(date: string) {
    if (!date) {
      onChange(emit(''));
      return;
    }
    const now = new Date();
    const future = Math.min(1439, now.getHours() * 60 + now.getMinutes() + 60);
    const fallback = `${String(Math.floor(future / 60)).padStart(2, '0')}:${String(future % 60).padStart(2, '0')}`;
    onChange(emit(`${date}T${time || fallback}`));
  }
  function setTime(nextHour: string, nextMinute: string) {
    if (day) onChange(emit(`${day}T${nextHour}:${nextMinute}`));
  }
  return (
    <div className="vs-datetime">
      <DatePicker
        {...props}
        value={day ?? ''}
        onChange={(e) => setDate(e.target.value)}
      />
      <div className="vs-time-row">
        <Clock3 size={16} />
        <Select
          aria-label="Expiration hour"
          value={hour}
          disabled={!day || props.disabled}
          onChange={(e) => setTime(e.target.value, minute)}
        >
          {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')).map(
            (h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ),
          )}
        </Select>
        <span>:</span>
        <Select
          aria-label="Expiration minute"
          value={minute}
          disabled={!day || props.disabled}
          onChange={(e) => setTime(hour, e.target.value)}
        >
          {Array.from({ length: 60 }, (_, m) => String(m).padStart(2, '0')).map(
            (m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ),
          )}
        </Select>
        <span className="muted">{timeZoneLabel()}</span>
      </div>
    </div>
  );
}
