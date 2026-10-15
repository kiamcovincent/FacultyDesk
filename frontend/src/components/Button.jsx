import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

export default function Button({
  children,
  className = '',
  disabled = false,
  loading = false,
  type = 'button',
  variant = 'primary',
  style,
  ...props
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isUnavailable = disabled || loading;

  function moveTowardPointer(event) {
    if (
      event.pointerType !== 'mouse' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(any-pointer: coarse)').matches
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - (bounds.left + bounds.width / 2)) * 0.08;
    const y = (event.clientY - (bounds.top + bounds.height / 2)) * 0.08;
    setOffset({ x: Math.max(-4, Math.min(4, x)), y: Math.max(-4, Math.min(4, y)) });
  }

  return (
    <button
      {...props}
      type={type}
      disabled={isUnavailable}
      aria-busy={loading || undefined}
      className={`fd-button fd-button--${variant} ${className}`.trim()}
      onPointerMove={moveTowardPointer}
      onPointerLeave={() => setOffset({ x: 0, y: 0 })}
      style={{ ...style, transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
    >
      {loading && <LoaderCircle className="fd-button__spinner" size={17} aria-hidden="true" />}
      {children}
    </button>
  );
}
