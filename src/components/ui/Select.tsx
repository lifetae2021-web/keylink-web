'use client';

import {
  Children, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState,
  type ChangeEvent, type CSSProperties, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

// 브라우저/OS가 그리는 기본 <select> 목록은 모양을 바꿀 수 없고 기기 설정(다크 모드 등)에 따라 달라진다.
// 기존 <select> 사용법(value / onChange(e.target.value) / <option>)을 그대로 쓰면서
// 목록을 사이트 디자인으로 직접 그리는 드롭다운.

interface OptionItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

const textOf = (node: ReactNode): string =>
  Children.toArray(node).map(c => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('');

function collectOptions(children: ReactNode): OptionItem[] {
  const out: OptionItem[] = [];
  Children.forEach(children, child => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (child.type === 'option') {
      out.push({ value: String(props.value ?? textOf(props.children)), label: props.children, disabled: props.disabled });
    } else if (props.children) {
      out.push(...collectOptions(props.children)); // Fragment 등 감싸진 옵션
    }
  });
  return out;
}

interface SelectProps {
  value: string | number | null | undefined;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  id?: string;
  title?: string;
  autoFocus?: boolean;
  // 기본 폼 검증은 동작하지 않으므로(버튼이라서) 표시용으로만 받는다. 필수 검사는 제출 핸들러에서 해야 한다.
  required?: boolean;
  // 호출하는 쪽에서 이미 화살표를 그려 둔 경우 내장 화살표를 숨긴다
  hideChevron?: boolean;
  'aria-label'?: string;
}

interface ListPos { top: number; left: number; minWidth: number; maxHeight: number }

export default function Select({ value, onChange, children, className = '', style, disabled, id, title, autoFocus, hideChevron, ...rest }: SelectProps) {
  const options = useMemo(() => collectOptions(children), [children]);
  const current = String(value ?? '');
  const selected = options.find(o => o.value === current);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<ListPos | null>(null);
  const [active, setActive] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const close = useCallback(() => { setOpen(false); setPos(null); }, []);

  const openList = () => {
    if (disabled || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const placeBelow = below >= 180 || below >= above;
    const maxHeight = Math.max(120, Math.min(320, placeBelow ? below : above));
    setPos({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 8)),
      minWidth: rect.width,
      maxHeight,
      top: placeBelow ? rect.bottom + 6 : rect.top - 6 - Math.min(maxHeight, options.length * 40 + 8),
    });
    setActive(Math.max(0, options.findIndex(o => o.value === current)));
    setOpen(true);
  };

  const choose = (opt: OptionItem) => {
    if (opt.disabled) return;
    close();
    buttonRef.current?.focus();
    if (opt.value !== current) {
      onChange?.({ target: { value: opt.value }, currentTarget: { value: opt.value } } as unknown as ChangeEvent<HTMLSelectElement>);
    }
  };

  // 바깥 클릭 / 스크롤 / 창 크기 변경 시 닫기
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      close();
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  // 키보드 이동 시 활성 항목이 보이도록 스크롤
  useEffect(() => {
    if (!open || active < 0) return;
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) choose(options[active]); }
    else if (e.key === 'Tab') close();
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        title={title}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        autoFocus={autoFocus}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        aria-label={rest['aria-label']}
        aria-required={rest.required || undefined}
        className={`${className} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60`}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
      >
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : ''}</span>
        {!hideChevron && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.minWidth, maxHeight: pos.maxHeight, zIndex: 100000 }}
          className="overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === current;
            return (
              <li
                key={`${opt.value}-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(opt)}
                className={`mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                  opt.disabled ? 'cursor-not-allowed text-slate-300'
                    : isSelected ? 'bg-[#FFF0EE] text-[#FF6F61]'
                    : i === active ? 'bg-slate-100 text-slate-800' : 'text-slate-700'
                }`}
              >
                <span className="whitespace-nowrap">{opt.label}</span>
                {isSelected && <Check size={14} className="shrink-0" />}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </>
  );
}
