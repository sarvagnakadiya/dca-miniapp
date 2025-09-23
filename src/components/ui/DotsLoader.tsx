import React, { useState, useEffect } from "react";

interface DotsLoaderProps {
  isVisible: boolean;
  position?: "top" | "bottom";
  className?: string;
}

const DotsLoader: React.FC<DotsLoaderProps> = ({
  isVisible,
  position = "top",
  className = "",
}) => {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const computeDots = () => {
      if (typeof window === "undefined") return;
      const width = window.innerWidth || 320;
      const spacing = 8; // px between dots
      let count = Math.max(11, Math.floor(width / spacing));
      if (count % 2 === 0) count += 1; // odd for a center dot
      setDotCount(count);
    };
    computeDots();
    window.addEventListener("resize", computeDots);
    return () => window.removeEventListener("resize", computeDots);
  }, []);

  if (!isVisible) return null;

  const containerClasses =
    position === "top"
      ? "absolute inset-x-0 top-0 h-[2px] flex items-start justify-between"
      : "flex justify-center items-center py-4";

  return (
    <>
      <div className={`${containerClasses} ${className}`}>
        {position === "top" ? (
          Array.from({ length: dotCount }).map((_, idx) => {
            const center = Math.floor(Math.max(1, dotCount) / 2);
            const distance = Math.abs(idx - center);
            const delayMs = distance * 60;
            return (
              <span
                key={idx}
                className="dotLine"
                style={{ animationDelay: `${delayMs}ms` }}
              />
            );
          })
        ) : (
          <div className="flex items-center space-x-1">
            {Array.from({ length: 5 }).map((_, idx) => {
              const delayMs = idx * 100;
              return (
                <span
                  key={idx}
                  className="dotLine"
                  style={{ animationDelay: `${delayMs}ms` }}
                />
              );
            })}
          </div>
        )}
      </div>
      <style jsx>{`
        .dotLine {
          width: 2px;
          height: 2px;
          border-radius: 9999px;
          background: #f97316;
          box-shadow: 0 0 6px rgba(249, 115, 22, 0.7);
          animation: fade 900ms ease-in-out infinite;
        }
        @keyframes fade {
          0%,
          100% {
            opacity: 0.25;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default DotsLoader;
