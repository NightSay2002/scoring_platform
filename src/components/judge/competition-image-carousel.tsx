"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";

type CompetitionImage = {
  id: string;
  imageUrl: string;
  imageName: string | null;
  displayOrder: number;
};

export function CompetitionImageCarousel({
  images,
  title,
}: {
  images: CompetitionImage[];
  title: string;
}) {
  const sortedImages = useMemo(
    () => images.slice().sort((a, b) => a.displayOrder - b.displayOrder),
    [images],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const activeImage = sortedImages[activeIndex];

  const move = useCallback(
    (direction: -1 | 1) => {
      setActiveIndex((current) => (current + direction + sortedImages.length) % sortedImages.length);
    },
    [sortedImages.length],
  );

  useEffect(() => {
    if (!viewerOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewerOpen(false);
      }

      if (event.key === "ArrowLeft") {
        move(-1);
      }

      if (event.key === "ArrowRight") {
        move(1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move, viewerOpen]);

  useEffect(() => {
    if (!viewerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerOpen]);

  if (!activeImage) {
    return null;
  }

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.10)] sm:px-6">
        <div className="relative mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="relative block w-full overflow-hidden rounded-xl bg-white text-left outline-none ring-offset-2 transition focus-visible:ring-4 focus-visible:ring-sky-200"
            aria-label="View image"
          >
            {/* Plain img keeps uploaded local files and arbitrary image URLs working without image domain config. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.imageUrl}
              alt={activeImage.imageName ?? title}
              className="aspect-[2.7/1] w-full object-contain"
            />
          </button>

          {sortedImages.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => move(-1)}
                className="absolute left-2 top-1/2 flex h-12 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-slate-900/10 text-slate-700 transition hover:bg-slate-900/20 sm:-left-14"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => move(1)}
                className="absolute right-2 top-1/2 flex h-12 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-slate-900/10 text-slate-700 transition hover:bg-slate-900/20 sm:-right-14"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}

          <div className="mt-3 flex items-center justify-center gap-2">
            {sortedImages.map((image, index) => (
              <button
                key={image.id}
                type="button"
                aria-label={`Show image ${index + 1}`}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition",
                  index === activeIndex ? "bg-slate-900" : "bg-slate-300 hover:bg-slate-500",
                )}
              />
            ))}
          </div>
        </div>
      </section>

      {viewerOpen && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setViewerOpen(false)}
        >
          <div className="relative flex h-full w-full items-center justify-center">
            <button
              type="button"
              aria-label="Close image viewer"
              onClick={(event) => {
                event.stopPropagation();
                setViewerOpen(false);
              }}
              className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg transition hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>

            {sortedImages.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={(event) => {
                    event.stopPropagation();
                    move(-1);
                  }}
                  className="absolute left-2 top-1/2 z-10 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-white/85 text-slate-900 shadow-lg transition hover:bg-white"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={(event) => {
                    event.stopPropagation();
                    move(1);
                  }}
                  className="absolute right-2 top-1/2 z-10 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-white/85 text-slate-900 shadow-lg transition hover:bg-white"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.imageUrl}
              alt={activeImage.imageName ?? title}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[92vh] max-w-[92vw] object-contain shadow-2xl"
            />
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
