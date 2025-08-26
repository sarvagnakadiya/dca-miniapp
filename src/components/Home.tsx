import React, { useState, useEffect } from "react";
import { useMiniApp } from "~/components/providers/FrameProvider";
import { useRouter } from "next/navigation";
import sdk from "@farcaster/frame-sdk";
import { BalanceDisplay } from "./ui/BalanceDisplay";
import InvestedPositionTile from "./ui/InvestedPositionTile";
import ExplorePositionTile from "./ui/ExplorePositionTile";
import PositionTileSkeleton from "./ui/PositionTileSkeleton";

interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  about: string | null;
  decimals: string;
  image: string | null;
  isWrapped: boolean;
  wrappedName: string | null;
  wrappedSymbol: string | null;
  originalAddress: string | null;
  hasActivePlan: boolean;
  planCreatedAt: string | null;
  totalInvestedValue: number;
  currentValue: number;
  percentChange: number;
  currentPrice: number;
  fdvUsd: number;
  volume24h: number;
  marketCapUsd: number;
}

interface PortfolioData {
  portfolioCurrentValue: number;
  portfolioInvestedAmount: number;
  portfolioPercentChange: number;
  history?: Array<{
    date: string;
    currentValue: number;
    totalInvestedValue?: number;
    percentChange?: number | null;
  }>;
}

// Utility function to format time ago
const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return "Just started";

  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
  } else if (diffInMinutes > 0) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? "" : "s"} ago`;
  } else {
    return "Just started";
  }
};

// Utility function to format currency
const formatCurrency = (value: number): string => {
  if (isNaN(value) || !isFinite(value) || value === 0) {
    return "NA";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Utility function to format price
const formatPrice = (price: number): string => {
  if (isNaN(price) || !isFinite(price) || price === 0) {
    return "NA";
  }

  // For very small prices, show more decimal places
  if (price < 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    }).format(price);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

// Utility function to format large numbers (market cap, volume, FDV)
const formatLargeNumber = (value: number): string => {
  if (isNaN(value) || !isFinite(value) || value === 0) {
    return "NA";
  }

  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(1)}K`;
  } else {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
};

const Home = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("7D");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const { context, isSDKLoaded, addFrame, added } = useMiniApp();
  const router = useRouter();

  // Use portfolio data from API if available, otherwise fallback to calculated value
  const totalPortfolioBalance =
    portfolioData?.portfolioCurrentValue ||
    tokens
      .filter((token) => token.hasActivePlan)
      .reduce((sum, token) => sum + (token.currentValue || 0), 0);

  // Nice scale util (1-2-5) for dynamic Y axis
  const calculateNiceScale = (
    minValue: number,
    maxValue: number,
    maxTicks: number = 5
  ) => {
    const niceNum = (range: number, round: boolean) => {
      const exponent = Math.floor(Math.log10(range));
      const fraction = range / Math.pow(10, exponent);
      let niceFraction: number;
      if (round) {
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 3) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;
      } else {
        if (fraction <= 1) niceFraction = 1;
        else if (fraction <= 2) niceFraction = 2;
        else if (fraction <= 5) niceFraction = 5;
        else niceFraction = 10;
      }
      return niceFraction * Math.pow(10, exponent);
    };

    if (!isFinite(minValue) || !isFinite(maxValue) || minValue === maxValue) {
      const base = Math.max(1, Math.abs(maxValue) || 10);
      const rounded = niceNum(base, true);
      const niceMin = Math.floor(base / rounded) * rounded;
      const niceMax = niceMin + rounded * (maxTicks - 1);
      const tickSpacing = rounded;
      const ticks: number[] = [];
      for (let v = niceMin; v <= niceMax + 1e-9; v += tickSpacing)
        ticks.push(v);
      return { niceMin, niceMax, tickSpacing, ticks };
    }

    const range = niceNum(maxValue - minValue, false);
    const tickSpacing = niceNum(range / (maxTicks - 1), true);
    const niceMin = Math.floor(minValue / tickSpacing) * tickSpacing;
    const niceMax = Math.ceil(maxValue / tickSpacing) * tickSpacing;
    const ticks: number[] = [];
    for (let v = niceMin; v <= niceMax + 1e-9; v += tickSpacing) ticks.push(v);
    return { niceMin, niceMax, tickSpacing, ticks };
  };

  useEffect(() => {
    console.log("fetching tokens");
    console.log("context:::", context);

    // Automatically prompt to add frame to client if not already added
    if (context && !added) {
      addFrame();
    }

    // Log user visit when they access the app
    const logUserVisit = async () => {
      if (context?.user?.fid) {
        try {
          await fetch("/api/visit/log", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fid: context.user.fid,
              username: context.user.username || null,
            }),
          });
        } catch (error) {
          console.error("Failed to log user visit:", error);
        }
      }
    };

    logUserVisit();

    const fetchTokens = async () => {
      if (!context?.user?.fid) return;

      try {
        console.log("Fetching data...");
        setIsLoading(true);
        console.log("Fetching data for FID:", context.user.fid);
        const response = await fetch(
          `/api/plan/getUserPlans/${context.user.fid}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("API response:", result);

        if (result.success) {
          console.log("Fetched tokens:", result.data);
          console.log("Portfolio data:", result.portfolio);
          console.log(
            "Tokens with active plans:",
            result.data.filter((token: Token) => token.hasActivePlan)
          );
          console.log(
            "Tokens without active plans:",
            result.data.filter((token: Token) => !token.hasActivePlan)
          );
          setTokens(result.data);
          setPortfolioData(result.portfolio || null);
          await sdk.actions.ready({});
        } else {
          console.error("API returned error:", result.error);
        }
      } catch (error) {
        console.error("Error fetching tokens:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
  }, [context, addFrame, added]);

  // Show loading if SDK is not loaded yet
  if (!isSDKLoaded) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-white p-4 font-sans flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-4 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-medium">Home</h1>
        <div className="flex items-center space-x-3">
          <BalanceDisplay />
        </div>
      </div>

      {/* Portfolio Balance Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-gray-400 text-sm mb-2">Portfolio balance</div>
            <div className="text-4xl font-light">
              {formatCurrency(totalPortfolioBalance)}
            </div>
            {portfolioData && (
              <div className="flex items-center space-x-4 mt-2 text-sm">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">Invested:</span>
                  <span className="text-white">
                    {formatCurrency(portfolioData.portfolioInvestedAmount)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">Change:</span>
                  <span
                    className={
                      portfolioData.portfolioPercentChange >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {portfolioData.portfolioPercentChange >= 0 ? "+" : ""}
                    {portfolioData.portfolioPercentChange.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Portfolio Chart */}
        {portfolioData?.history &&
          portfolioData.history.length > 0 &&
          (portfolioData.portfolioInvestedAmount || 0) > 0 && (
            <div className="relative h-40">
              {(() => {
                const data = portfolioData.history!;
                const values = data.map((d) => d.currentValue);
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);
                const { niceMin, niceMax, ticks } = calculateNiceScale(
                  minVal,
                  maxVal,
                  5
                );

                const width = 400;
                const height = 140;
                const paddingLeft = 50; // slightly increased for y-axis labels
                const paddingRight = 10; // reduced right padding
                const paddingTop = 10;
                const paddingBottom = 10;
                const chartHeight = height - paddingTop - paddingBottom;
                const chartWidth = width - paddingLeft - paddingRight;
                const x = (i: number) =>
                  paddingLeft + (i / Math.max(1, data.length - 1)) * chartWidth;
                const y = (v: number) =>
                  paddingTop +
                  (1 - (v - niceMin) / Math.max(1e-9, niceMax - niceMin)) *
                    chartHeight;

                // Build path
                const path = data
                  .map(
                    (d, i) =>
                      `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.currentValue)}`
                  )
                  .join(" ");

                // Area under line
                const innerRight = width - paddingRight;
                const areaPath = `${path} L ${innerRight} ${
                  height - paddingBottom
                } L ${paddingLeft} ${height - paddingBottom} Z`;

                return (
                  <>
                    <svg
                      className="w-full h-full"
                      viewBox={`0 0 ${width} ${height}`}
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient
                          id="chartGradient"
                          x1="0%"
                          y1="0%"
                          x2="0%"
                          y2="100%"
                        >
                          <stop
                            offset="0%"
                            stopColor="#f97316"
                            stopOpacity="0.25"
                          />
                          <stop
                            offset="100%"
                            stopColor="#f97316"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>

                      {ticks.map((t) => (
                        <line
                          key={t}
                          x1={paddingLeft}
                          y1={y(t)}
                          x2={innerRight}
                          y2={y(t)}
                          stroke="#3A3A3A"
                          strokeDasharray="6 6"
                          strokeWidth="1"
                        />
                      ))}

                      <path
                        d={areaPath}
                        fill="url(#chartGradient)"
                        stroke="none"
                      />
                      <path
                        d={path}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="3"
                      />
                    </svg>

                    <div
                      className="pointer-events-none absolute left-0 top-0 h-full flex flex-col justify-between items-end text-[11px] text-gray-400 pr-2"
                      style={{ width: paddingLeft - 5 }}
                    >
                      {ticks
                        .slice()
                        .reverse()
                        .map((t) => (
                          <span key={t}>{formatCurrency(t)}</span>
                        ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
      </div>

      {/* DCA Positions */}
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4">DCA Positions</h2>

        {isLoading ? (
          // Show skeleton loading while fetching data
          <>
            <PositionTileSkeleton />
            <PositionTileSkeleton />
            <PositionTileSkeleton />
          </>
        ) : tokens.filter((token) => token.hasActivePlan).length > 0 ? (
          tokens
            .filter((token) => token.hasActivePlan)
            .map((token) => (
              <div
                key={token.id || token.address}
                className="cursor-pointer hover:cursor-pointer transition-all duration-200 hover:opacity-80"
                onClick={() => router.push(`/token/${token.address}`)}
              >
                <InvestedPositionTile
                  icon={token.image || token.symbol?.[0] || "₿"}
                  iconBgColor="bg-orange-500"
                  name={token.name}
                  currentPrice={formatPrice(token.currentPrice)}
                  startedAgo={formatTimeAgo(token.planCreatedAt)}
                  investedAmount={formatCurrency(token.totalInvestedValue)}
                  currentValue={formatCurrency(token.currentValue)}
                />
              </div>
            ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No active DCA positions yet</p>
            <p className="text-sm mt-2">Start your first DCA plan below</p>
          </div>
        )}
      </div>

      {/* Explore More Tokens */}
      <div>
        <h2 className="text-lg font-medium mb-4">Explore more tokens</h2>

        {isLoading ? (
          // Show skeleton loading while fetching data
          <>
            <PositionTileSkeleton />
            <PositionTileSkeleton />
            <PositionTileSkeleton />
            <PositionTileSkeleton />
          </>
        ) : (
          tokens
            .filter((token) => !token.hasActivePlan)
            .map((token) => (
              <div
                key={token.id || token.address}
                className="cursor-pointer hover:cursor-pointer transition-all duration-200 hover:opacity-80"
                onClick={() => router.push(`/token/${token.address}`)}
              >
                <ExplorePositionTile
                  icon={token.image || token.symbol?.[0] || "₿"}
                  iconBgColor="bg-orange-600"
                  name={token.name}
                  currentPrice={formatPrice(token.currentPrice)}
                  marketCap={formatLargeNumber(token.marketCapUsd)}
                  volume24h={formatLargeNumber(token.volume24h)}
                  fdv={formatLargeNumber(token.fdvUsd)}
                />
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default Home;
