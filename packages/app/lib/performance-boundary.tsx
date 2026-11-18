"use client";
import { Profiler, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
const development = process.env.NODE_ENV === "development";
/** Local DevTools User Timing entries only; never records URLs, props or financial data. */
export function PerformanceBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const navigation = useRef<number | null>(null);
  useEffect(() => {
    if (!development) return;
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (
        !anchor ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        anchor.target === "_blank"
      )
        return;
      const url = new URL(anchor.href);
      if (url.origin === location.origin && url.pathname !== location.pathname)
        navigation.current = performance.now();
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  useEffect(() => {
    if (!development || navigation.current === null) return;
    performance.clearMeasures("lucent.navigation.commit");
    performance.measure("lucent.navigation.commit", {
      start: navigation.current,
      end: performance.now(),
    });
    navigation.current = null;
  }, [pathname]);
  if (!development) return children;
  return (
    <Profiler
      id="connected-app"
      onRender={(_id, _phase, duration) => {
        performance.clearMeasures("lucent.react.render");
        performance.measure("lucent.react.render", {
          start: performance.now() - duration,
          end: performance.now(),
        });
      }}
    >
      {children}
    </Profiler>
  );
}
