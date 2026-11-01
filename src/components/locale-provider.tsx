/**
 * locale-provider.tsx — the language choice, and the ONE thing that makes it visible (SCRUM-151).
 *
 * ── ⚠️⚠️ THE TRAP: `setLocale` CHANGES NO PIXELS ─────────────────────────────
 * `t()` reads `i18n.locale` at **call** time. Changing it re-renders nothing, because React has no
 * idea `t()` read it — the dependency is invisible to React. ⚠️ So a switcher that only called
 * `setLocale` would look BROKEN: the label you tapped would stay English until some unrelated state
 * change happened to re-render that screen. That is the whole reason this file exists.
 *
 * ── ⚠️ WHY THE SUBTREE IS REMOUNTED, AND NOT MERELY RE-RENDERED ─────────────
 * The obvious fix — hold the locale in state and let the re-render cascade — **does not work here**,
 * and the reason is worth recording so nobody "simplifies" it back:
 *
 *   · React re-renders a component when its state/props change, or when a context it **consumes**
 *     changes. Screens do not consume this context — they call `t()` — so a context change never
 *     reaches them.
 *   · A provider that re-renders with the **same** `children` element makes React **bail out** of
 *     that subtree entirely.
 *   · And re-rendering the navigator is not enough either: react-navigation memoises its descriptors,
 *     so with an unchanged navigation state `descriptor.render()` returns the **same** element and
 *     the screen does not re-render.
 *
 * ⚠️ So the only reliable trigger is a **remount**, via `key`. That is why `key={locale}` below is
 * load-bearing rather than cosmetic.
 *
 * ⚠️ **The cost, stated rather than hidden:** a language change restarts navigation at the initial
 * route, because the navigator is remounted with everything else. That is a real behaviour, and it is
 * the honest trade for the ticket's acceptance — *"EN ↔ 中文 switches every visible string"* — which a
 * partial re-render cannot guarantee.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Fragment } from 'react';

import type { Locale } from '@/lib/i18n';
import { resolveInitialLocale } from '@/lib/locale';
import { applyLocale, deviceLanguageTags, readStoredLocale, writeLocale } from '@/lib/locale-store';

interface LocaleContextValue {
  readonly locale: Locale;
  readonly setAppLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  /**
   * ⚠️ The FIRST PAINT's locale comes from the DEVICE, synchronously — `getLocales()` is sync, so a
   * Chinese phone opens in 中文 with no flash of English.
   *
   * ⚠️ `applyLocale` is called in the initialiser, which React's rules discourage. It is here
   * deliberately: the `i18n` instance must be right **before any child renders**, and an effect runs
   * after the first paint — which would paint one frame of the previous language. The call is
   * idempotent, so StrictMode's double-invoke is harmless.
   */
  const [locale, setLocaleState] = useState<Locale>(() => {
    const boot = resolveInitialLocale(null, deviceLanguageTags());
    applyLocale(boot);
    return boot;
  });

  /**
   * ⚠️ Then the STORED choice corrects it — because a stored value is a **decision**, and the device
   * tag is only a guess. A user who chose English on a Chinese phone must get English.
   *
   * ⚠️ A `cancelled` guard: the read is async, and a provider unmounted mid-read must not set state.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readStoredLocale();
      if (cancelled) return;
      const next = resolveInitialLocale(stored, deviceLanguageTags());
      applyLocale(next);
      setLocaleState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * ⚠️ **The ONE way to change the app's language.** It does three things in a fixed order, and the
   * order matters: apply to the `i18n` instance FIRST (so the very next `t()` is correct), then
   * persist, then re-render.
   */
  const setAppLocale = useCallback((next: Locale) => {
    applyLocale(next);
    void writeLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setAppLocale }), [locale, setAppLocale]);

  return (
    <LocaleContext.Provider value={value}>
      {/* ⚠️ `key={locale}` REMOUNTS the app on a change — see the header for why nothing less works. */}
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  );
}

/** The active locale and the one setter. ⚠️ Throws outside the provider — a silent `en` is worse. */
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value === null) {
    throw new Error('useLocale() must be used inside <LocaleProvider>');
  }
  return value;
}
