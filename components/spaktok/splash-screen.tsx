"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { APP_LOGO_URL, APP_NAME } from "@/lib/brand";

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number;
}

export function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete?.();
      }, 500);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
        >
          <div className="absolute inset-0 bg-black" aria-hidden="true" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
              className="relative"
            >
              {/* Official brand mark */}
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 24px rgba(37, 55, 255, 0.22)",
                    "0 0 72px rgba(37, 55, 255, 0.52)",
                    "0 0 24px rgba(37, 55, 255, 0.22)",
                  ],
                }}
                transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY }}
                className="relative h-40 w-40 overflow-hidden rounded-[58%_42%_46%_54%/44%_58%_42%_56%] bg-black ring-1 ring-blue-400/35 shadow-[0_0_34px_rgba(37,55,255,0.28)]"
              >
                <img
                  src={APP_LOGO_URL}
                  alt={`${APP_NAME} شعار`}
                  className="h-[112%] w-[112%] -translate-x-[6%] -translate-y-[6%] object-cover"
                />
              </motion.div>

              <div className="pointer-events-none absolute -inset-4 rounded-[62%_38%_48%_52%/42%_64%_36%_58%] border border-blue-400/30 shadow-[0_0_22px_rgba(37,55,255,0.2)]" aria-hidden="true" />
            </motion.div>

            {/* App name */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-8 text-center"
            >
              <h1 className="text-4xl font-bold">
<span className="bg-gradient-to-r from-white via-white to-[#3155ff] bg-clip-text text-transparent">
                {APP_NAME}
              </span>
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-muted-foreground mt-2"
              >
                أنشئ. شارك. تواصل.
              </motion.p>
            </motion.div>

            {/* Loading indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-12"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 0.6,
                      delay: i * 0.15,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                    className="w-2 h-2 bg-primary rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
