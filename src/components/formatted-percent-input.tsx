"use client";

import { useEffect, useState } from "react";

function normalize(value: string | number | null | undefined, max: number) {
  const raw = String(value ?? "").replace(/%/g, "").replace(/,/g, "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.min(max, Math.max(0, parsed)));
}

export function FormattedPercentInput({
  id,
  name,
  defaultValue,
  value,
  max = 100,
  placeholder,
  onValueChange,
}: {
  id?: string;
  name: string;
  defaultValue?: number | string | null;
  value?: number;
  max?: number;
  placeholder?: string;
  onValueChange?: (value: number) => void;
}) {
  const controlled = typeof value === "number";
  const [display, setDisplay] = useState(() => normalize(controlled ? value : defaultValue, max));

  useEffect(() => {
    if (controlled) setDisplay(normalize(value, max));
  }, [controlled, max, value]);

  return (
    <div className="percent-input-wrap">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value.replace(/%/g, "").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
          setDisplay(next);
          const parsed = Number(next);
          onValueChange?.(Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : 0);
        }}
        onBlur={() => setDisplay((current) => normalize(current, max))}
      />
      <span aria-hidden="true">%</span>
    </div>
  );
}
