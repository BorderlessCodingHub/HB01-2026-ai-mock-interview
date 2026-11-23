"use client";

import { useEffect, useState, type RefObject } from "react";

/** Start fetching the clip a bit before it scrolls into view. */
const LOAD_MARGIN = "300px 0px";
/** How long playback may sit on `waiting`/`stalled` before we reload it. */
const STALL_RECOVERY_MS = 4000;

/**
 * Drives a muted, looping, inline landing clip so it behaves on iOS Safari:
 *
 * - The source is attached only once the clip nears the viewport.
 * - It plays only while actually visible (keeps concurrent decoders low).
 * - It resumes after the tab/app returns to the foreground or the page is
 *   restored from the back/forward cache (iOS pauses media in both cases
 *   and an IntersectionObserver never fires again).
 * - A playback stall that does not recover on its own triggers a reload.
 *
 * Returns whether the `src` should be attached yet.
 */
export function useAutoplayVideo(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): boolean {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    // iOS only autoplays inline media that is muted at the property level.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    let inView = false;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let lastTime = -1;

    const clearStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = undefined;
    };

    const tryPlay = () => {
      if (!inView || document.visibilityState !== "visible") return;
      if (!video.currentSrc && !video.getAttribute("src")) return;
      if (!video.paused) return;
      // Rejected in Low Power Mode or before data is ready; the poster stays.
      void video.play().catch(() => {});
    };

    const pause = () => {
      clearStall();
      if (!video.paused) video.pause();
    };

    const onStall = () => {
      if (stallTimer || !inView) return;
      lastTime = video.currentTime;
      stallTimer = setTimeout(() => {
        stallTimer = undefined;
        if (!inView || video.currentTime !== lastTime) return;
        const resumeAt = video.currentTime;
        video.load();
        video.addEventListener(
          "loadedmetadata",
          () => {
            try {
              video.currentTime = resumeAt;
            } catch {
              // Seeking can fail before the range is buffered; start over.
            }
            tryPlay();
          },
          { once: true },
        );
      }, STALL_RECOVERY_MS);
    };

    if (shouldLoad) video.preload = "auto";

    const loadObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          loadObserver.disconnect();
        }
      },
      { rootMargin: LOAD_MARGIN },
    );

    const playObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) tryPlay();
        else pause();
      },
      { threshold: 0.15 },
    );

    const onVisibility = () => {
      if (document.visibilityState === "visible") tryPlay();
      else pause();
    };
    const onPageShow = () => tryPlay();

    video.addEventListener("canplay", tryPlay);
    video.addEventListener("waiting", onStall);
    video.addEventListener("stalled", onStall);
    video.addEventListener("playing", clearStall);
    video.addEventListener("timeupdate", clearStall);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    loadObserver.observe(video);
    playObserver.observe(video);

    return () => {
      clearStall();
      loadObserver.disconnect();
      playObserver.disconnect();
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("waiting", onStall);
      video.removeEventListener("stalled", onStall);
      video.removeEventListener("playing", clearStall);
      video.removeEventListener("timeupdate", clearStall);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
    // Re-run once the src is attached: the play observer fires again on
    // observe(), which calls play() — iOS ignores preload and only fetches
    // media after play(), so waiting for `canplay` alone would never start it.
  }, [videoRef, enabled, shouldLoad]);

  return shouldLoad;
}

/** True on phone-sized viewports, where scroll-linked video transforms jank. */
export function useIsCompactViewport(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return compact;
}
