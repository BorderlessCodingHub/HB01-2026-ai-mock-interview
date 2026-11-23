"use client";

import { useEffect, useRef, useState } from "react";

import { useSiteLocale } from "@/features/site-locale/site-locale-provider";
import { useAutoplayVideo } from "@/components/landing/use-autoplay-video";

/**
 * Public assets are not rewritten by Next's `basePath`, so prefix them the
 * same way `auth-client.ts` does (Cloudflare builds serve under a subpath).
 */
const basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";

type LandingVideoProps = {
  /** File stem inside `public/landing/videos` (`<name>.mp4` + `<name>.webp`). */
  name: string;
  /** Accessible description of what the clip shows. */
  label: string;
  width: number;
  height: number;
  className?: string;
};

/**
 * Muted, looping product clip. Loads its source only once it nears the
 * viewport, pauses while off-screen, and renders just the poster when the
 * visitor prefers reduced motion.
 */
export function LandingVideo({
  name,
  label,
  width,
  height,
  className,
}: LandingVideoProps) {
  const { t } = useSiteLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const src = `${basePath}/landing/videos/${name}.mp4`;
  const poster = `${basePath}/landing/videos/${name}.webp`;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const shouldLoad = useAutoplayVideo(videoRef, !reducedMotion);

  const mediaClassName = "block h-auto w-full";

  return (
    <div
      className={`landing-artifact overflow-hidden !p-2 md:!p-3 ${className ?? ""}`}
    >
      <div className="relative overflow-hidden rounded-[16px] border border-border-hairline bg-paper-white">
        <span
          className="manrope pointer-events-none absolute bottom-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-ink-black/75 py-1 pl-1.5 pr-2.5 text-[11px] font-medium leading-none text-white shadow-sm backdrop-blur-sm md:bottom-3 md:right-3"
          aria-hidden
        >
          <span className="landing-playing flex h-4 w-4 items-end justify-center gap-[2px] rounded-full bg-jade pb-[4px]">
            <span />
            <span />
            <span />
          </span>
          {t.video.playing}
        </span>
        {reducedMotion ? (
          // eslint-disable-next-line @next/next/no-img-element -- static poster from /public, sized by width/height
          <img
            src={poster}
            alt={label}
            width={width}
            height={height}
            loading="lazy"
            className={mediaClassName}
          />
        ) : (
          <video
            ref={videoRef}
            src={shouldLoad ? src : undefined}
            poster={poster}
            width={width}
            height={height}
            muted
            loop
            playsInline
            preload={shouldLoad ? "auto" : "none"}
            aria-label={label}
            className={mediaClassName}
          />
        )}
      </div>
    </div>
  );
}
