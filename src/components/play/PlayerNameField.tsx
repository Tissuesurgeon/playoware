"use client";

export function PlayerNameField({
  name,
  onChange,
}: {
  name: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      Your name
      <input
        value={name}
        onChange={(event) => onChange(event.target.value)}
        maxLength={24}
        required
        autoComplete="nickname"
        placeholder="What should the table call you?"
        className="mt-1 h-11 w-full rounded-2xl border border-line bg-paper px-3 font-normal"
      />
    </label>
  );
}
