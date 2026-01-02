import { ReactNode, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface StaggerContainerProps {
    children: ReactNode;
    className?: string;
    staggerAmount?: number;
    selector?: string;
    delay?: number;
}

export const StaggerContainer = ({
    children,
    className = "",
    staggerAmount = 0.1,
    selector,
    delay = 0,
}: StaggerContainerProps) => {
    const container = useRef(null);

    useGSAP(() => {
        const el = container.current;
        if (!el) return;

        const targets = selector ? gsap.utils.toArray(selector, el) : (el as HTMLElement).children;

        gsap.fromTo(
            targets,
            { opacity: 0, y: 20 },
            {
                opacity: 1,
                y: 0,
                duration: 0.5,
                stagger: staggerAmount,
                ease: "power3.out",
                delay: delay,
                scrollTrigger: {
                    trigger: el,
                    start: "top 90%",
                },
            }
        );
    }, { scope: container, dependencies: [staggerAmount, selector, delay] });

    return (
        <div ref={container} className={className}>
            {children}
        </div>
    );
};
