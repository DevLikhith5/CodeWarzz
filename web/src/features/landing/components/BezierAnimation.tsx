import { motion } from "framer-motion";
import { useEffect, useState } from "react";

// Quadratic Bezier curve function: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
// We can use SVG paths directly which is easier: M P0 Q P1 P2

interface BezierCurve {
    p0: { x: number; y: number };
    p1: { x: number; y: number };
    p2: { x: number; y: number };
}

export const BezierAnimation = () => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateDimensions = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);

    if (dimensions.width === 0) return null;

    // Define some curves relative to screen size for responsiveness
    // Curves should be subtle background elements, flowing like a graph
    const curves: BezierCurve[] = [
        // Left side curve flowing up-right
        {
            p0: { x: -100, y: dimensions.height * 0.8 },
            p1: { x: dimensions.width * 0.4, y: dimensions.height * 0.5 },
            p2: { x: dimensions.width * 0.2, y: -100 },
        },
        // Right side curve flowing up-left
        {
            p0: { x: dimensions.width + 100, y: dimensions.height * 0.6 },
            p1: { x: dimensions.width * 0.6, y: dimensions.height * 0.8 },
            p2: { x: dimensions.width * 0.1, y: -100 },
        },
        // Bottom crossing curve
        {
            p0: { x: -50, y: dimensions.height * 0.4 },
            p1: { x: dimensions.width * 0.5, y: dimensions.height * 0.9 },
            p2: { x: dimensions.width + 50, y: dimensions.height * 0.3 },
        },
    ];

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            <svg className="w-full h-full opacity-30">
                <defs>
                    <linearGradient id="curve-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                </defs>

                {curves.map((curve, i) => {
                    const pathD = `M ${curve.p0.x} ${curve.p0.y} Q ${curve.p1.x} ${curve.p1.y} ${curve.p2.x} ${curve.p2.y}`;

                    return (
                        <g key={i}>
                            {/* The Path Line (Subtle) */}
                            <path
                                d={pathD}
                                fill="none"
                                stroke="url(#curve-gradient)"
                                strokeWidth="1"
                                className="opacity-20"
                            />

                            {/* Moving Particle */}
                            <motion.circle
                                r="3"
                                fill="hsl(var(--primary))"
                                initial={{ offsetDistance: "0%" }}
                                animate={{ offsetDistance: "100%" }}
                                transition={{
                                    duration: 8 + i * 2, // Varied duration
                                    repeat: Infinity,
                                    ease: "easeInOut", // Smooth motion
                                    repeatDelay: i,
                                }}
                                style={{
                                    offsetPath: `path('${pathD}')`,
                                }}
                            />
                            {/* Trailing Glow Particle */}
                            <motion.circle
                                r="6"
                                fill="hsl(var(--primary))"
                                initial={{ offsetDistance: "0%", opacity: 0 }}
                                animate={{ offsetDistance: "100%", opacity: [0, 0.4, 0] }}
                                transition={{
                                    duration: 8 + i * 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    repeatDelay: i,
                                }}
                                style={{
                                    offsetPath: `path('${pathD}')`,
                                    filter: "blur(4px)"
                                }}
                            />
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};
