import { ReactNode, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface PageTransitionProps {
    children: ReactNode;
    className?: string;
}

export const PageTransition = ({ children, className = "" }: PageTransitionProps) => {
    const comp = useRef(null);

    useGSAP(() => {
        gsap.fromTo(
            comp.current,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
        );
    }, { scope: comp });

    return (
        <div ref={comp} className={`w-full ${className}`}>
            {children}
        </div>
    );
};
