import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMiniApp } from "~/components/providers/FrameProvider";
import { useRefresh } from "~/components/providers/RefreshProvider";
import { useRouter } from "next/navigation";
import Image from "next/image";
import sdk from "@farcaster/miniapp-sdk";
import { BalanceDisplay } from "./ui/BalanceDisplay";
import InvestedPositionTile from "./ui/InvestedPositionTile";
import ExplorePositionTile from "./ui/ExplorePositionTile";
import PositionTileSkeleton from "./ui/PositionTileSkeleton";
import DotsLoader from "./ui/DotsLoader";
import TokenView from "~/components/TokenView";
import { TokenApprovalPopup } from "./ui/TokenApprovalPopup";
import { TokenAddPopup } from "./ui/TokenAddPopup";

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
  hasPlan: boolean;
  isActive: boolean;
  planCreatedAt: string | null;
  totalInvestedValue: number;
  currentValue: number;
  percentChange: number;
  currentPrice: number;
  fdvUsd: number;
  volume24h: number;
  marketCapUsd: number;
}

interface SearchToken {
  id: string;
  address: string;
  symbol: string;
  name: string;
  image: string | null;
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

interface PaginationData {
  page: number;
  limit: number;
  totalTokens: number;
  totalPages: number;
  hasMore: boolean;
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
  const [paginationData, setPaginationData] = useState<PaginationData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { context, isSDKLoaded, addFrame, added } = useMiniApp();
  const { refreshAll } = useRefresh();
  const router = useRouter();
  const [openTokenAddress, setOpenTokenAddress] = useState<string | null>(null);
  const [shouldRefreshOnClose, setShouldRefreshOnClose] = useState(false);
  const [chartMode, setChartMode] = useState<"value" | "percent">("value");
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTokenAdd, setShowTokenAdd] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchToken[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const PULL_THRESHOLD = 70;

  // Use portfolio data from API if available, otherwise fallback to calculated value
  const totalPortfolioBalance =
    portfolioData?.portfolioCurrentValue ||
    tokens
      .filter((token) => token.hasPlan)
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

  const fetchTokens = useCallback(
    async (options?: { silent?: boolean; page?: number; append?: boolean }) => {
      const silent = options?.silent === true;
      const page = options?.page || 1;
      const append = options?.append === true;

      if (!context?.user?.fid) return;

      try {
        if (!silent && !append) setIsLoading(true);
        if (append) setIsLoadingMore(true);

        const response = await fetch(
          `/api/plan/getUserPlans/${context.user.fid}?page=${page}&limit=15`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        console.log("API Response:", {
          success: result.success,
          dataLength: result.data?.length,
          pagination: result.pagination,
          append,
        });

        if (result.success) {
          if (append) {
            console.log("Appending tokens:", result.data.length);
            setTokens((prev) => [...prev, ...result.data]);
          } else {
            console.log("Setting initial tokens:", result.data.length);
            setTokens(result.data);
          }
          setPortfolioData(result.portfolio || null);
          setPaginationData(result.pagination || null);
          await sdk.actions.ready({});
        } else {
          console.error("API returned error:", result.error);
        }
      } catch (error) {
        console.error("Error fetching tokens:", error);
      } finally {
        if (!silent && !append) setIsLoading(false);
        if (append) setIsLoadingMore(false);
      }
    },
    [context]
  );

  const searchTokens = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await fetch(
        `/api/searchToken?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setSearchResults(result.data || []);
      } else {
        console.error("Search API returned error:", result.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching tokens:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        searchTokens(value);
      }, 300);
    },
    [searchTokens]
  );

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

    fetchTokens();
  }, [context, addFrame, added, fetchTokens]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (typeof window !== "undefined" && window.scrollY <= 0) {
      touchStartYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
      setPullDistance(0);
    } else {
      touchStartYRef.current = null;
      isDraggingRef.current = false;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || touchStartYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartYRef.current;
    if (delta > 0) {
      const damped = Math.min(120, delta);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const onTouchEnd = async () => {
    const pulled = pullDistanceRef.current;
    if (pulled > PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      try {
        // Refresh all data: tokens, portfolio, balance, and token data
        await Promise.all([
          fetchTokens({ silent: true }),
          new Promise<void>((resolve) => {
            refreshAll();
            // Give a small delay to ensure all refresh callbacks are triggered
            setTimeout(resolve, 100);
          }),
        ]);
      } catch (error) {
        console.error("Error during refresh:", error);
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    isDraggingRef.current = false;
    touchStartYRef.current = null;
  };

  const handleTokenViewClose = async () => {
    setOpenTokenAddress(null);
    setShouldRefreshOnClose(true);
  };

  // Auto-refresh when returning from TokenView
  useEffect(() => {
    if (shouldRefreshOnClose) {
      const performRefresh = async () => {
        try {
          // Refresh all data when returning from TokenView
          await Promise.all([
            fetchTokens({ silent: true }),
            new Promise<void>((resolve) => {
              refreshAll();
              // Give a small delay to ensure all refresh callbacks are triggered
              setTimeout(resolve, 100);
            }),
          ]);
        } catch (error) {
          console.error("Error during auto-refresh:", error);
        } finally {
          setShouldRefreshOnClose(false);
        }
      };
      performRefresh();
    }
  }, [shouldRefreshOnClose, fetchTokens, refreshAll]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !paginationData || isLoadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold

    console.log("Scroll debug:", {
      scrollTop,
      scrollHeight,
      clientHeight,
      isNearBottom,
      hasMore: paginationData.hasMore,
      currentPage: paginationData.page,
      isLoadingMore,
    });

    if (isNearBottom && paginationData.hasMore) {
      console.log("Fetching next page:", paginationData.page + 1);
      fetchTokens({
        page: paginationData.page + 1,
        append: true,
        silent: true,
      });
    }
  }, [paginationData, isLoadingMore, fetchTokens]);

  // Add scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  // Fallback: Use window scroll if container scroll doesn't work
  useEffect(() => {
    const handleWindowScroll = () => {
      if (!paginationData || isLoadingMore) return;

      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const isNearBottom = scrollTop + windowHeight >= documentHeight - 100;

      console.log("Window scroll debug:", {
        scrollTop,
        windowHeight,
        documentHeight,
        isNearBottom,
        hasMore: paginationData.hasMore,
        currentPage: paginationData.page,
        isLoadingMore,
      });

      if (isNearBottom && paginationData.hasMore) {
        console.log(
          "Fetching next page via window scroll:",
          paginationData.page + 1
        );
        fetchTokens({
          page: paginationData.page + 1,
          append: true,
          silent: true,
        });
      }
    };

    window.addEventListener("scroll", handleWindowScroll);
    return () => window.removeEventListener("scroll", handleWindowScroll);
  }, [paginationData, isLoadingMore, fetchTokens]);

  // Show loading if SDK is not loaded yet
  if (!isSDKLoaded) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-white p-4 font-sans flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-screen bg-[#0C0C0C] text-white p-4 font-sans overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="fixed inset-x-0 top-0 z-50 pointer-events-none"
        style={{
          height: isRefreshing || pullDistance > 0 ? 2 : 0,
          transition: "height 120ms ease",
        }}
      >
        <div className="relative w-full h-full">
          {!isRefreshing && pullDistance > 0 && (
            <div
              className="absolute top-0 left-0 bg-orange-500"
              style={{
                height: 2,
                width: `${Math.min(
                  100,
                  (pullDistance / PULL_THRESHOLD) * 100
                )}%`,
                boxShadow: "0 0 6px rgba(249, 115, 22, 0.7)",
                transition: "width 120ms ease",
              }}
            />
          )}
          <DotsLoader isVisible={isRefreshing} position="top" />
        </div>
      </div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-medium">Home</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-8 h-8 bg-black rounded-full flex items-center justify-center hover:border hover:border-orange-500 transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <rect width="24" height="24" fill="black" />
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                stroke="orange"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <BalanceDisplay onOpenApproval={() => setIsApprovalOpen(true)} />
        </div>
      </div>

      {/* Search Section */}
      {showSearch && (
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg px-2 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="mt-2 space-y-1">
              {searchResults.length > 0 ? (
                searchResults.map((token) => (
                  <div
                    key={token.id}
                    onClick={() => {
                      setOpenTokenAddress(token.address);
                      setShowSearch(false);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="flex items-center space-x-3 p-2 bg-[#1E1E1F] border border-[#2A2A2A] rounded-lg hover:bg-[#2A2A2A] transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-black font-semibold text-sm">
                      {token.image ? (
                        <Image
                          src={token.image}
                          alt={token.symbol}
                          width={20}
                          height={20}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        token.symbol?.[0] || "?"
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">
                        {token.symbol}
                      </div>
                      <div className="text-gray-400 text-xs">{token.name}</div>
                    </div>
                  </div>
                ))
              ) : !isSearching && searchQuery ? (
                <div className="text-center py-2 text-gray-400">
                  <p className="text-sm">No tokens found</p>
                  <p className="text-xs mt-0.5">Try a different search term</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Portfolio Balance Section */}
      <div className="mb-8">
        {!isLoading && tokens.filter((t) => t.hasPlan).length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-orange-500 uppercase tracking-widest text-xl font-semibold">
              STOP WATCHING, START STACKING
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-gray-400 text-sm mb-2">
                  Portfolio balance
                </div>
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
                    <div className="absolute right-4 bg-[#1E1E1F] border border-[#2A2A2A] rounded-full p-1 inline-flex shadow-sm mt-[-30px]">
                      <button
                        onClick={() => setChartMode("value")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          chartMode === "value"
                            ? "bg-black text-white"
                            : "text-gray-300"
                        }`}
                      >
                        $
                      </button>
                      <button
                        onClick={() => setChartMode("percent")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          chartMode === "percent"
                            ? "bg-black text-white"
                            : "text-gray-300"
                        }`}
                      >
                        %
                      </button>
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
                  <div className="absolute top-2 right-2 z-10"></div>
                  {(() => {
                    const data = portfolioData.history!;
                    const values =
                      chartMode === "value"
                        ? data.map((d) => d.currentValue)
                        : (() => {
                            const apiPercents = data.map((d) =>
                              d.percentChange !== null &&
                              d.percentChange !== undefined
                                ? Number(d.percentChange)
                                : NaN
                            );
                            const hasApi = apiPercents.some((v) => !isNaN(v));
                            if (hasApi)
                              return apiPercents.map((v) => (isNaN(v) ? 0 : v));
                            const first = data[0]?.currentValue || 0;
                            if (first === 0) return data.map(() => 0);
                            return data.map(
                              (d) => ((d.currentValue - first) / first) * 100
                            );
                          })();

                    const investedValues =
                      chartMode === "value"
                        ? data.map((d) => d.totalInvestedValue ?? 0)
                        : [];

                    const minVal =
                      chartMode === "value"
                        ? Math.min(...values, ...investedValues)
                        : Math.min(...values);
                    const maxVal =
                      chartMode === "value"
                        ? Math.max(...values, ...investedValues)
                        : Math.max(...values);
                    const { niceMin, niceMax, ticks } = calculateNiceScale(
                      minVal,
                      maxVal,
                      5
                    );

                    const width = 400;
                    const height = 140;
                    const paddingLeft = 38; // tighter left padding to reduce empty space
                    const paddingRight = 8; // slightly reduced right padding
                    const paddingTop = 10;
                    const paddingBottom = 10;
                    const chartHeight = height - paddingTop - paddingBottom;
                    const chartWidth = width - paddingLeft - paddingRight;
                    const x = (i: number) =>
                      paddingLeft +
                      (i / Math.max(1, data.length - 1)) * chartWidth;
                    const y = (v: number) =>
                      paddingTop +
                      (1 - (v - niceMin) / Math.max(1e-9, niceMax - niceMin)) *
                        chartHeight;

                    // Build path(s)
                    const path = data
                      .map((d, i) => {
                        const value =
                          chartMode === "value"
                            ? d.currentValue
                            : d.percentChange !== null &&
                              d.percentChange !== undefined
                            ? Number(d.percentChange)
                            : (() => {
                                const first = data[0]?.currentValue || 0;
                                return first === 0
                                  ? 0
                                  : ((d.currentValue - first) / first) * 100;
                              })();
                        return `${i === 0 ? "M" : "L"} ${x(i)} ${y(value)}`;
                      })
                      .join(" ");

                    const investedPath =
                      chartMode === "value"
                        ? data
                            .map((d, i) => {
                              const value = d.totalInvestedValue ?? 0;
                              return `${i === 0 ? "M" : "L"} ${x(i)} ${y(
                                value
                              )}`;
                            })
                            .join(" ")
                        : "";

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
                          {chartMode === "value" && (
                            <path
                              d={investedPath}
                              fill="none"
                              stroke="#60a5fa"
                              strokeWidth="2"
                            />
                          )}
                        </svg>

                        <div
                          className="pointer-events-none absolute left-0 top-0 h-full flex flex-col justify-between items-end text-[11px] text-gray-400 pr-2"
                          style={{ width: paddingLeft - 2 }}
                        >
                          {ticks
                            .slice()
                            .reverse()
                            .map((t) => (
                              <span key={t}>
                                {chartMode === "value"
                                  ? new Intl.NumberFormat("en-US", {
                                      style: "currency",
                                      currency: "USD",
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    }).format(t)
                                  : `${Number(t.toFixed(0))}%`}
                              </span>
                            ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            {/* Legend outside chart */}
            {chartMode === "value" ? (
              <div className="mt-3 flex justify-center gap-6 items-center text-[12px] text-gray-300">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: "#f97316" }}
                  />
                  <span>Portfolio Value</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: "#60a5fa" }}
                  />
                  <span>Total Invested</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex justify-center items-center text-[12px] text-gray-300">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: "#f97316" }}
                  />
                  <span>Percent Change</span>
                </div>
              </div>
            )}
          </>
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
        ) : tokens.filter((token) => token.hasPlan && token.isActive).length >
          0 ? (
          tokens
            .filter((token) => token.hasPlan && token.isActive)
            .map((token) => (
              <div
                key={token.id || token.address}
                className="cursor-pointer hover:cursor-pointer transition-all duration-200 hover:opacity-80"
                onClick={() => setOpenTokenAddress(token.address)}
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

      {/* Paused Positions */}
      {tokens.some((t) => t.hasPlan && !t.isActive) && (
        <div className="mt-8">
          <h2 className="text-lg font-medium mb-4">Paused positions</h2>
          {tokens
            .filter((t) => t.hasPlan && !t.isActive)
            .map((token) => (
              <div
                key={token.id || token.address}
                className="cursor-pointer hover:cursor-pointer transition-all duration-200 hover:opacity-80"
                onClick={() => setOpenTokenAddress(token.address)}
              >
                <InvestedPositionTile
                  icon={token.image || token.symbol?.[0] || "₿"}
                  iconBgColor="bg-gray-600"
                  name={token.name}
                  currentPrice={formatPrice(token.currentPrice)}
                  startedAgo={
                    token.planCreatedAt
                      ? formatTimeAgo(token.planCreatedAt)
                      : "Paused"
                  }
                  investedAmount={formatCurrency(token.totalInvestedValue)}
                  currentValue={formatCurrency(token.currentValue)}
                />
              </div>
            ))}
        </div>
      )}

      {/* Explore More Tokens */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Explore more tokens</h2>
          <button
            onClick={() => setShowTokenAdd(true)}
            className="w-8 h-8 bg-orange-500 hover:bg-orange-600 text-black rounded-full flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {isLoading ? (
          // Show skeleton loading while fetching data
          <>
            <PositionTileSkeleton />
            <PositionTileSkeleton />
            <PositionTileSkeleton />
            <PositionTileSkeleton />
          </>
        ) : (
          <>
            {tokens
              .filter((token) => !token.hasPlan)
              .map((token) => (
                <div
                  key={token.id || token.address}
                  className="cursor-pointer hover:cursor-pointer transition-all duration-200 hover:opacity-80"
                  onClick={() => setOpenTokenAddress(token.address)}
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
              ))}

            {/* Loading more indicator */}
            <DotsLoader isVisible={isLoadingMore} position="bottom" />

            {/* End of list indicator */}
            {!paginationData?.hasMore &&
              tokens.filter((token) => !token.hasPlan).length > 0 && (
                <div className="flex justify-center items-center py-4">
                  <span className="text-gray-500 text-sm">
                    No more tokens to load
                  </span>
                </div>
              )}
          </>
        )}
      </div>

      {openTokenAddress && (
        <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
          <TokenView
            tokenAddress={openTokenAddress}
            onClose={handleTokenViewClose}
          />
        </div>
      )}

      <TokenApprovalPopup
        open={isApprovalOpen}
        onClose={() => setIsApprovalOpen(false)}
        onApprove={() => setIsApprovalOpen(false)}
      />
      <TokenAddPopup
        open={showTokenAdd}
        onClose={() => setShowTokenAdd(false)}
        onTokenAdded={(tokenAddress) => {
          // Refresh tokens after adding a new token
          fetchTokens();
        }}
      />
    </div>
  );
};

export default Home;
