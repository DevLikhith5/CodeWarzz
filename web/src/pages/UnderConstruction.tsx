import { motion } from "framer-motion";
import { Hammer, Wrench, ChevronLeft, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const UnderConstruction = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />

            {/* Floating Elements (Background) */}
            <motion.div
                animate={{
                    y: [0, -20, 0],
                    rotate: [0, 5, -5, 0],
                    opacity: [0.1, 0.3, 0.1]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-20 left-10 md:left-40 text-primary opacity-20 hidden md:block"
            >
                <Wrench size={120} />
            </motion.div>
            <motion.div
                animate={{
                    y: [0, 30, 0],
                    rotate: [0, -10, 10, 0],
                    opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-20 right-10 md:right-40 text-primary opacity-20 hidden md:block"
            >
                <Hammer size={120} />
            </motion.div>

            {/* Main Content */}
            <div className="relative z-10 text-center max-w-2xl px-4">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8 flex justify-center"
                >
                    <div className="relative">
                        <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
                        <div className="bg-card border border-border/50 p-6 rounded-2xl shadow-2xl relative">
                            <Terminal size={64} className="text-primary" />
                        </div>
                    </div>
                </motion.div>

                <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl md:text-6xl font-black tracking-tight mb-6 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent"
                >
                    System Upgrade <br /> In Progress
                </motion.h1>

                <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed"
                >
                    Our engineers are currently crafting this module. <br className="hidden md:block" />
                    Expected compilation time: Soon™.
                </motion.p>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <Button
                        onClick={() => navigate(-1)}
                        variant="outline"
                        size="lg"
                        className="group border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                    >
                        <ChevronLeft className="mr-2 group-hover:-translate-x-1 transition-transform" size={18} />
                        Run "cd .."
                    </Button>
                </motion.div>
            </div>

            {/* Bottom Code Scroller effect? Optional. */}
            <div className="absolute bottom-0 w-full overflow-hidden opacity-30 pointer-events-none h-12 flex items-center">
                <motion.div
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="whitespace-nowrap flex gap-8 font-mono text-xs text-primary"
                >
                    {Array(20).fill("npm install awesome-features --save-dev  |  git commit -m 'wip'  |  std::cout << 'loading...';  | ").map((txt, i) => (
                        <span key={i}>{txt}</span>
                    ))}
                </motion.div>
            </div>
        </div>
    );
};

export default UnderConstruction;
