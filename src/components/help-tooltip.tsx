"use client";
import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
export function HelpTooltip({
  id,
  label,
  text,
}: {
  id: string;
  label: string;
  text: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  function show() {
    const rect = button.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 304)),
        top: Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - 120)),
      });
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const reposition = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      setPosition({
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 304)),
        top: Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - 120)),
      });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);
  return (
    <span ref={root} className="inline-flex">
      <button
        ref={button}
        type="button"
        className="rounded-full text-slate-500 hover:text-brand-600"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={() => {
          if (document.activeElement !== button.current) setOpen(false);
        }}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
      >
        <CircleHelp size={16} />
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="fixed z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg bg-slate-800 p-3 text-xs leading-5 font-normal text-white shadow-lg"
          style={position}
        >
          {text}
        </span>
      )}
    </span>
  );
}
