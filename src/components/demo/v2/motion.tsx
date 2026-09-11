"use client";

import { useEffect } from "react";

/**
 * The only JavaScript a new-generation demo page runs.
 *
 * Everything that CAN be CSS is CSS (see site.css). This island adds the
 * three things CSS cannot:
 *
 *   1. Reveals for browsers without scroll-driven animations -- through an
 *      IntersectionObserver, and only after marking the page `.dx-js`, so a
 *      page whose script never runs hides nothing.
 *   2. A cursor that follows the pointer and swells over links.
 *   3. Magnetic buttons that lean toward the pointer.
 *
 * 2 and 3 only on fine pointers (a mouse or trackpad -- never touch), and none
 * of it under prefers-reduced-motion. Renders nothing itself.
 */
export function MotionIsland() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".dx");
    if (!root) return;
    root.classList.add("dx-js");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    // ---- 1. Fallback reveals -------------------------------------------
    const scrollTimelines = typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()");
    const reveals = root.querySelectorAll<HTMLElement>(".dx-reveal");
    if (!scrollTimelines && !reduce && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("dx-in");
              observer.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px" },
      );
      reveals.forEach((element) => observer.observe(element));
      cleanups.push(() => observer.disconnect());
    } else {
      reveals.forEach((element) => element.classList.add("dx-in"));
    }

    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !finePointer) {
      return () => cleanups.forEach((fn) => fn());
    }

    // ---- 2. Cursor -------------------------------------------------------
    const cursor = document.createElement("div");
    cursor.className = "dx-cursor";
    cursor.setAttribute("aria-hidden", "true");
    root.appendChild(cursor);

    let targetX = -100;
    let targetY = -100;
    let x = targetX;
    let y = targetY;
    let frame = 0;
    const tick = () => {
      // Ease toward the pointer rather than snapping: the lag is the effect.
      x += (targetX - x) * 0.22;
      y += (targetY - y) * 0.22;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      cursor.classList.add("is-on");
      const interactive = (event.target as Element | null)?.closest("a, button, summary");
      cursor.classList.toggle("is-hover", Boolean(interactive));
    };
    const onLeave = () => cursor.classList.remove("is-on");
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    cleanups.push(() => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      cursor.remove();
    });

    // ---- 3. Magnetic buttons ------------------------------------------
    const magnets = root.querySelectorAll<HTMLElement>("[data-magnetic]");
    magnets.forEach((element) => {
      const move = (event: PointerEvent) => {
        const box = element.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        element.style.transform = `translate3d(${dx * 0.22}px, ${dy * 0.3}px, 0)`;
      };
      const reset = () => {
        element.style.transform = "";
      };
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", reset);
      cleanups.push(() => {
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", reset);
        reset();
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
