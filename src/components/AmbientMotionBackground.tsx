"use client";

import { useEffect, useRef } from "react";

export default function AmbientMotionBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPlayback = () => {
      if (document.hidden || reducedMotion.matches) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // The poster remains as the static fallback when autoplay is unavailable.
      });
    };

    document.addEventListener("visibilitychange", syncPlayback);
    reducedMotion.addEventListener("change", syncPlayback);
    syncPlayback();

    return () => {
      document.removeEventListener("visibilitychange", syncPlayback);
      reducedMotion.removeEventListener("change", syncPlayback);
    };
  }, []);

  return (
    <div data-ambient-motion aria-hidden="true">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/media/monstajam-ambient-motion-poster.webp"
        tabIndex={-1}
      >
        <source src="/media/monstajam-ambient-motion.webm" type="video/webm" />
        <source src="/media/monstajam-ambient-motion.mp4" type="video/mp4" />
      </video>
      <span data-ambient-motion-vignette />
    </div>
  );
}
