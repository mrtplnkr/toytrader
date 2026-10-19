import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import gbFlag from "flag-icons/flags/4x3/gb.svg";
import ltFlag from "flag-icons/flags/4x3/lt.svg";
import ruFlag from "flag-icons/flags/4x3/ru.svg";
import { setLanguage, SupportedLanguage } from "../i18n";

const LANGUAGES: { code: SupportedLanguage, label: string, flag: string }[] = [
  { code: "en", label: "English", flag: gbFlag },
  { code: "lt", label: "Lietuvių", flag: ltFlag },
  { code: "ru", label: "Русский", flag: ruFlag },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  // Close on an outside click or Escape - the rest of the app's dropdowns
  // (see components/auth.tsx) only close on selection, but this one sits
  // right next to the sign-in avatar menu, so leaving it open on an
  // unrelated click would be an easy thing to trip over right there.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2 py-1 text-text hover:border-primary"
      >
        <img src={current.flag} alt="" className="h-[0.95em] w-[1.3em] rounded-[2px] object-cover" />
        <span className="text-[0.8em] font-semibold uppercase">{current.code}</span>
        <svg viewBox="0 0 10 6" className={`h-[0.4em] w-[0.6em] fill-text-dim transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M0 0 L5 6 L10 0 Z" />
        </svg>
      </button>

      {open &&
        <ul role="listbox" className="absolute right-0 z-20 mt-1 w-[9.5em] list-none rounded-sm border border-border bg-surface-raised p-1 shadow">
          {LANGUAGES.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                role="option"
                aria-selected={lang.code === current.code}
                onClick={() => onSelect(lang.code)}
                className={`flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-[0.85em] hover:bg-bg ${lang.code === current.code ? "font-semibold text-primary" : "text-text"}`}
              >
                <img src={lang.flag} alt="" className="h-[0.95em] w-[1.3em] rounded-[2px] object-cover" />
                {lang.label}
              </button>
            </li>
          ))}
        </ul>}
    </div>
  );
}

export default LanguageSwitcher;
