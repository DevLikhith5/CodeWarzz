import { ReactNode, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

interface ScrollAnimationWrapperProps {
  children: ReactNode;
  className?: string;
  delay?: number; // kept for compatibility, though GSAP handles delays differently, we can use it
  direction?: "up" | "down" | "left" | "right" | "fade";
}

export const ScrollAnimationWrapper = ({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: ScrollAnimationWrapperProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let initialProps: gsap.TweenVars = {
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      delay: delay / 1000,
    };

    switch (direction) {
      case "up":
        initialProps.y = 50;
        break;
      case "down":
        initialProps.y = -50;
        break;
      case "left":
        initialProps.x = 50;
        break;
      case "right":
        initialProps.x = -50;
        break;
      case "fade":
      default:
        // just opacity
        break;
    }

    gsap.fromTo(
      el,
      initialProps,
      {
        opacity: 1,
        x: 0,
        y: 0,
        scrollTrigger: {
          trigger: el,
          start: "top 85%", // trigger when top of element hits 85% of viewport height
          toggleActions: "play none none reverse", // play on enter, reverse on leave back up
        },
      }
    );
  }, { scope: wrapperRef, dependencies: [delay, direction] });

  return (
    <div ref={wrapperRef} className={className}>
      {children}
    </div>
  );
};
