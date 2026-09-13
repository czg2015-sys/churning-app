"use client";

import { useEffect, useState } from "react";

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function format(value: string | number | null | undefined) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return "";
  const [integer = "0", decimal] = raw.split(".");
  const safeInteger = integer.replace(/[^\d-]/g, "") || "0";
  const formatted = Number(safeInteger).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return decimal !== undefined ? `${formatted}.${decimal.replace(/\D/g, "").slice(0, 2)}` : formatted;
}

export function FormattedNumberInput({
  id,
  name,
  value,
  defaultValue,
  min = 0,
  placeholder,
  required = false,
  onValueChange,
  ariaLabel,
}: {
  id?: string;
  name: string;
  value?: number;
  defaultValue?: number | string | null;
  min?: number;
  placeholder?: string;
  required?: boolean;
  onValueChange?: (value: number) => void;
  ariaLabel?: string;
}) {
  const controlled = typeof value === "number";
  const [display, setDisplay] = useState(() => format(controlled ? value : defaultValue));

  useEffect(() => {
    if (controlled) setDisplay(format(value));
  }, [controlled, value]);

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      placeholder={placeholder}
      required={required}
      aria-label={ariaLabel}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d.,]/g, "").replace(/(\..*)\./g, "$1");
        const formatted = format(next);
        setDisplay(formatted);
        const numeric = Math.max(min, toNumber(formatted));
        onValueChange?.(numeric);
      }}
      onBlur={() => setDisplay((current) => current ? format(Math.max(min, toNumber(current))) : "")}
    />
  );
}
