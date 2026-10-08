import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-clay text-paper hover:bg-clay-dark",
  secondary: "border border-line bg-paper text-ink hover:border-ink",
  ghost: "text-ink-soft hover:text-ink",
  danger: "border border-bad/30 text-bad hover:bg-bad/5",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
