"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GENDER_OPTIONS, type Gender } from "@/lib/types";

type GenderDropdownProps = {
  value: Gender | "";
  onChange: (value: Gender) => void;
};

export function GenderDropdown({ value, onChange }: GenderDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="field-shell gender-dropdown" ref={rootRef}>
      <span className="field-label">Gender</span>
      <div className="gender-select-wrap">
        <button
          type="button"
          className={`field-control gender-trigger${value ? " has-check" : " is-placeholder"}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span>{value || "Pilih"}</span>
          {value && !open ? (
            <span className="name-check gender-check" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="9" fill="#34a853" />
                <path
                  d="M5 9.2l2.4 2.4L13 6.2"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : (
            <span className={`gender-chevron${open ? " is-open" : ""}`} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 5l4 4 4-4"
                  stroke="#5f6368"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
        </button>

        {open ? (
          <ul
            id={listId}
            className="gender-menu"
            role="listbox"
            aria-label="Gender"
          >
            {GENDER_OPTIONS.map((option) => {
              const selected = value === option;
              return (
                <li key={option} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={`gender-menu-item${selected ? " is-selected" : ""}`}
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                  >
                    {option}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
