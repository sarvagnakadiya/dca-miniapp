import React from "react";

const TokenViewSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans flex flex-col relative">
      {/* Local keyframes for shimmer and dashed line */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }
      `}</style>

      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-6 h-6 bg-[#1E1E1F] rounded" />
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#1E1E1F] border-2 border-[#2A2A2A]" />
            <div className="h-5 w-28 bg-[#1E1E1F] rounded" />
          </div>
        </div>
        <div className="h-6 w-24 bg-[#1E1E1F] rounded" />
      </div>

      {/* Price & Chart Section */}
      <div className="bg-black rounded-xl mb-6 shadow-lg">
        <div className="flex items-center justify-between mb-2 ml-6 mt-6">
          <div className="h-10 w-32 bg-[#1E1E1F] rounded animate-pulse" />
          <div className="flex space-x-1 bg-[#1E1E1F] rounded px-4 py-1 mr-4">
            <div className="h-4 w-6 bg-black rounded" />
            <div className="h-4 w-6 bg-transparent rounded border border-black/20" />
            <div className="h-4 w-6 bg-transparent rounded border border-black/20" />
            <div className="h-4 w-6 bg-transparent rounded border border-black/20" />
          </div>
        </div>
        <div
          className="relative h-[320px] mt-2 rounded-xl overflow-hidden border border-[#2A2A2A]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #1E1E1F 0, #1E1E1F 1px, transparent 1px, transparent 36px), repeating-linear-gradient(0deg, #1E1E1F 0, #1E1E1F 1px, transparent 1px, transparent 24px)",
            backgroundColor: "#101010",
          }}
        >
          {/* Shimmer sweep */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
              animation: "shimmer 1.7s infinite",
            }}
          />
          {/* Animated dashed line */}
          <svg
            className="absolute inset-0 w-full h-full opacity-40"
            viewBox="0 0 400 320"
            preserveAspectRatio="none"
          >
            <path
              d="M0 250 L40 230 L80 240 L120 200 L160 220 L200 170 L240 210 L280 160 L320 190 L360 150 L400 170"
              fill="none"
              stroke="#f97316"
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                strokeDasharray: "8 8",
                animation: "dash 2.8s linear infinite",
              }}
            />
          </svg>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-[#131313] rounded-xl p-6 mb-6">
        <div className="bg-[#1E1E1F] rounded-lg p-4 mb-4 animate-pulse">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="h-4 w-24 bg-[#2A2A2A] rounded mb-2" />
              <div className="h-6 w-28 bg-[#2A2A2A] rounded" />
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="h-5 w-16 bg-[#2A2A2A] rounded-full" />
                <div className="h-4 w-24 bg-[#2A2A2A] rounded" />
              </div>
              <div className="h-6 w-24 bg-[#2A2A2A] rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 animate-pulse">
            <div className="h-4 w-20 bg-[#2A2A2A] rounded" />
            <div className="h-5 w-24 bg-[#2A2A2A] rounded" />
          </div>
          <div className="flex flex-col gap-2 animate-pulse">
            <div className="h-4 w-10 bg-[#2A2A2A] rounded" />
            <div className="h-5 w-24 bg-[#2A2A2A] rounded" />
          </div>
          <div className="flex flex-col gap-2 animate-pulse">
            <div className="h-4 w-20 bg-[#2A2A2A] rounded" />
            <div className="h-5 w-24 bg-[#2A2A2A] rounded" />
          </div>
          <div className="flex flex-col gap-2 animate-pulse">
            <div className="h-4 w-20 bg-[#2A2A2A] rounded" />
            <div className="h-5 w-24 bg-[#2A2A2A] rounded" />
          </div>
        </div>
      </div>

      {/* Frequency Bubble */}
      <div className="bg-[#131313] rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center mb-2 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#2A2A2A] rounded" />
            <div className="h-5 w-24 bg-[#2A2A2A] rounded" />
          </div>
          <div className="h-5 w-12 bg-[#2A2A2A] rounded" />
        </div>
        <div className="bg-[#1E1E1F] rounded-lg p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center animate-pulse">
            <div className="h-4 w-16 bg-[#2A2A2A] rounded" />
            <div className="h-5 w-16 bg-[#2A2A2A] rounded" />
          </div>
          <div className="flex justify-between items-center animate-pulse">
            <div className="h-4 w-16 bg-[#2A2A2A] rounded" />
            <div className="h-5 w-24 bg-[#2A2A2A] rounded" />
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-[#131313] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-2 animate-pulse">
          <div className="w-4 h-4 bg-[#2A2A2A] rounded" />
          <div className="h-5 w-16 bg-[#2A2A2A] rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-[#2A2A2A] rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-[#2A2A2A] rounded animate-pulse" />
          <div className="h-3 w-3/5 bg-[#2A2A2A] rounded animate-pulse" />
        </div>
      </div>

      {/* Floating Invest Button */}
      <div className="fixed bottom-0 left-0 w-full px-4 pb-4 z-50">
        <div className="bg-[#2A2A2A] h-12 rounded-xl animate-pulse" />
      </div>
    </div>
  );
};

export default TokenViewSkeleton;
