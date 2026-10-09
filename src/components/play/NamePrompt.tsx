"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

export function NamePrompt({
  open,
  name,
  onChange,
  pending = false,
  error,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  name: string;
  onChange: (value: string) => void;
  pending?: boolean;
  error?: string | null;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        className="w-full max-w-sm rounded-3xl bg-paper p-6"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !pending) onClose();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || pending) return;
          onConfirm();
        }}
      >
        <h2 id="name-prompt-title" className="font-serif text-2xl">
          Your name
        </h2>
        <p className="mt-2 text-sm text-ink-soft">This is the name at the table.</p>
        <label className="mt-5 block text-sm font-semibold">
          Your name
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => onChange(event.target.value)}
            maxLength={24}
            required
            autoComplete="nickname"
            placeholder="What should the table call you?"
            className="mt-1 h-11 w-full rounded-2xl border border-line bg-cream px-3 font-normal"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-bad">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={pending || !name.trim()}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
