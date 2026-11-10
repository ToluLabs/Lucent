"use client";

import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { useId, useRef } from "react";

/** Decorative brand artwork, never transaction or proof progress. */
export function PrivacyVisual({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`privacy-visual ${compact ? "privacy-visual-compact" : ""}`}
      onPointerMove={(event) => {
        if (
          event.pointerType !== "mouse" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        const box = event.currentTarget.getBoundingClientRect();
        ref.current?.style.setProperty(
          "--orbit-x",
          `${((event.clientX - box.left) / box.width) * 12 - 6}deg`,
        );
        ref.current?.style.setProperty(
          "--orbit-y",
          `${6 - ((event.clientY - box.top) / box.height) * 12}deg`,
        );
      }}
      onPointerLeave={() => {
        ref.current?.style.setProperty("--orbit-x", "0deg");
        ref.current?.style.setProperty("--orbit-y", "0deg");
      }}
    >
      <div className="orbit-halo" />
      <div className="orbit-scene">
        <svg className="orbit-map" viewBox="0 0 600 600" fill="none">
          <defs>
            <linearGradient
              id={`${id}-gold`}
              x1="70"
              y1="80"
              x2="520"
              y2="530"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F1D590" stopOpacity=".85" />
              <stop offset=".45" stopColor="#F1D590" stopOpacity=".03" />
              <stop offset="1" stopColor="#F1D590" stopOpacity=".45" />
            </linearGradient>
            <radialGradient id={`${id}-disc`}>
              <stop stopColor="#24231E" />
              <stop offset="1" stopColor="#0A0C10" />
            </radialGradient>
          </defs>
          <circle
            cx="300"
            cy="300"
            r="244"
            stroke="white"
            strokeOpacity=".055"
          />
          <circle
            cx="300"
            cy="300"
            r="202"
            stroke="white"
            strokeOpacity=".055"
            strokeDasharray="2 10"
          />
          <g className="orbit-rotation">
            <circle
              cx="300"
              cy="300"
              r="244"
              stroke={`url(#${id}-gold)`}
              strokeWidth="1.4"
              strokeDasharray="270 1263"
            />
            <circle cx="300" cy="56" r="4" fill="#F1D590" />
            <circle cx="300" cy="544" r="3" fill="#F1D590" fillOpacity=".5" />
          </g>
          <g className="orbit-rotation-reverse">
            <ellipse
              cx="300"
              cy="300"
              rx="263"
              ry="118"
              transform="rotate(-34 300 300)"
              stroke={`url(#${id}-gold)`}
            />
            <ellipse
              cx="300"
              cy="300"
              rx="263"
              ry="118"
              transform="rotate(34 300 300)"
              stroke="white"
              strokeOpacity=".1"
            />
          </g>
          <circle
            cx="300"
            cy="300"
            r="128"
            fill={`url(#${id}-disc)`}
            stroke={`url(#${id}-gold)`}
          />
          <circle
            cx="300"
            cy="300"
            r="117"
            stroke="white"
            strokeOpacity=".035"
          />
          {[90, 180, 270, 360].map((x, i) => (
            <path
              key={x}
              d={`M ${x + 20} ${90 + i * 93} h 6 m -3 -3 v 6`}
              stroke="white"
              strokeOpacity=".2"
            />
          ))}
        </svg>
        <div className="orbit-core">
          <LucentLogoMark size={92} showBg={false} />
        </div>
        {!compact && (
          <>
            <div className="orbit-label orbit-label-top">
              <span className="orbit-label-dot" /> Amount confidential
            </div>
            <div className="orbit-label-bottom">
              <span className="font-mono text-[10px] tracking-[.2em] text-text-muted">
                PUBLIC CHAIN. PRIVATE AMOUNTS.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
