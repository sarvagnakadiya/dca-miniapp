"use client";
import React, { useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { useFrame } from "../../../../components/providers/FrameProvider";
import { useParams } from "next/navigation";

const TokenPage = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("7D");
  const { context } = useFrame();
  const params = useParams();
  const address = params?.address;

  React.useEffect(() => {
    if (address) {
      console.log("Token address:", address);
    }
  }, [address]);

  // Placeholder data
  const token = {
    name: "Pol",
    icon: "🔗",
    price: 0.25,
    priceHistory: [0.13, 0.22, 0.19, 0.3, 0.31, 0.42],
    stats: {
      oneYearAgo: 0.01,
      invested: 100,
      currentValue: 1380,
      marketCap: 250,
      fdv: 200,
      circSupply: 19.86,
      totalSupply: 19.86,
    },
    about:
      "Automatically convert USDC to cBTC for seamless Bitcoin investing. Your daily contributions are swapped and allocated to build your Bitcoin portfolio over time through dollar-cost averaging.",
  };

  // Chart points (simple linear mapping for placeholder)
  const chartPoints = token.priceHistory
    .map((p, i) => `${i * 80},${120 - p * 200}`)
    .join(" ");

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans flex flex-col">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-2xl bg-gray-800 rounded-full p-2">
            {token.icon}
          </span>
          <span className="text-lg font-medium">{token.name}</span>
          {address && (
            <span className="text-xs text-gray-400 ml-2">[{address}]</span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-1 text-sm">
            <span className="mr-1">💳</span>
            <span>$2,000</span>
          </div>
          {context?.user?.pfpUrl ? (
            <img
              src={context.user.pfpUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border-2 border-gray-700"
            />
          ) : (
            <span className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center text-lg">
              🐷
            </span>
          )}
        </div>
      </div>

      {/* Price & Chart Section */}
      <div className="bg-gray-900 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-gray-400 text-sm">Pol price</div>
            <div className="text-4xl font-light">${token.price.toFixed(2)}</div>
          </div>
          <div className="flex space-x-2 bg-gray-800 rounded-lg p-1">
            {["7D", "1M", "1Y", "5Y"].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === period
                    ? "bg-black text-white"
                    : "text-gray-400"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        {/* Chart */}
        <div className="relative h-40 mt-2">
          <svg width="100%" height="100%" viewBox="0 0 400 160">
            {/* Y-axis grid lines */}
            {[0.1, 0.2, 0.3, 0.4].map((y, i) => (
              <line
                key={i}
                x1="0"
                y1={160 - y * 400}
                x2="400"
                y2={160 - y * 400}
                stroke="#333"
                strokeWidth="0.5"
              />
            ))}
            {/* Chart path (placeholder) */}
            <polyline
              fill="none"
              stroke="#f97316"
              strokeWidth="3"
              points="0,120 80,100 160,110 240,70 320,90 400,40"
            />
          </svg>
          {/* Y-axis labels */}
          <div className="absolute left-2 top-0 h-full flex flex-col justify-between text-[10px] text-gray-500 w-10 pointer-events-none">
            <span>$0.4</span>
            <span>$0.3</span>
            <span>$0.2</span>
            <span>$0.1</span>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gray-900 rounded-xl p-6 mb-6">
        <div className="text-lg font-medium mb-4">Stats</div>
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-gray-400 text-sm">1 years ago price</div>
            <div className="text-white text-lg">
              ${token.stats.oneYearAgo.toFixed(2)}
            </div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <div>
              <div className="text-gray-400 text-sm">If you invested</div>
              <div className="text-white text-xl font-medium">
                ${token.stats.invested}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-sm">Current value</div>
              <div className="text-green-400 text-xl font-medium">
                ${token.stats.currentValue}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-gray-400">Market cap</span>
            <span className="text-white font-medium">
              ${token.stats.marketCap}M
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">FDV</span>
            <span className="text-white font-medium">${token.stats.fdv}M</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">Circulating supply</span>
            <span className="text-white font-medium">
              {token.stats.circSupply}M
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">Total supply</span>
            <span className="text-white font-medium">
              {token.stats.totalSupply}M
            </span>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-gray-900 rounded-xl p-6 mb-6">
        <div className="text-lg font-medium mb-2">About</div>
        <div className="text-gray-300 text-sm leading-relaxed">
          {token.about}
        </div>
      </div>

      {/* Invest Button */}
      <div className="mt-auto">
        <Button className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-4 rounded-xl w-full">
          Invest in Pol
        </Button>
      </div>
    </div>
  );
};

export default TokenPage;
