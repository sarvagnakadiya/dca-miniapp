import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";
import { useAccount } from "wagmi";
import { useMiniApp } from "~/components/providers/FrameProvider";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface ClankerRawData {
  supply?: string;
  starting_market_cap?: string;
  [key: string]: unknown;
}

interface ZoraRawData {
  zora20Token?: {
    totalSupply?: string;
    marketCap?: string;
    volume24h?: string;
  };
  [key: string]: unknown;
}

interface TokenSearchResponse {
  contractAddress: string;
  name: string;
  symbol: string;
  imgUrl?: string;
  description?: string;
  supply?: string;
  verified: boolean;
  user?: {
    fid?: number;
    username?: string;
    pfp?: string;
    displayName?: string;
    creator_address?: string;
  };
  source: "database" | "clanker" | "zora" | "geckoTerminal" | "unknown";
  rawData?: ClankerRawData | ZoraRawData;
}

interface TokenAddPopupProps {
  open: boolean;
  onClose: () => void;
  onTokenAdded?: (tokenAddress: string) => void;
}

export const TokenAddPopup: React.FC<TokenAddPopupProps> = ({
  open,
  onClose,
  onTokenAdded,
}) => {
  const [tokenAddress, setTokenAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<TokenSearchResponse | null>(
    null
  );
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const { address } = useAccount();
  const { context } = useMiniApp();
  const router = useRouter();

  // Reset state when popup opens/closes
  React.useEffect(() => {
    if (open) {
      setTokenAddress("");
      setSearchResult(null);
      setError("");
    }
  }, [open]);

  const handleSearch = async () => {
    if (!tokenAddress.trim()) {
      setError("Please enter a token address");
      return;
    }

    try {
      setIsSearching(true);
      setError("");

      const response = await fetch(
        `/api/token/searchByAddress?q=${tokenAddress.trim()}`
      );

      if (!response.ok) {
        throw new Error("Failed to search for token");
      }

      const result: TokenSearchResponse = await response.json();

      if (result.contractAddress) {
        setSearchResult(result);
      } else {
        setError("Token not found");
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(
        "Failed to search for token. Please check the address and try again."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToken = async () => {
    if (!searchResult || !address || !context?.user?.fid) {
      return;
    }

    try {
      setIsAdding(true);
      setError("");

      const response = await fetch("/api/token/addToken", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractAddress: searchResult.contractAddress,
          fid: context.user.fid,
          walletAddress: address,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add token");
      }

      // Success - close popup and navigate to token view
      onClose();
      onTokenAdded?.(searchResult.contractAddress);
      router.push(`/token/${searchResult.contractAddress}`);
    } catch (err) {
      console.error("Add token error:", err);
      setError(err instanceof Error ? err.message : "Failed to add token");
    } finally {
      setIsAdding(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "clanker":
        return {
          text: "Clanker",
          color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        };
      case "zora":
        return {
          text: "Zora",
          color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        };
      case "database":
        return {
          text: "Database",
          color: "bg-green-500/20 text-green-400 border-green-500/30",
        };
      case "geckoTerminal":
        return {
          text: "GeckoTerminal",
          color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        };
      default:
        return {
          text: "Unknown",
          color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
        };
    }
  };

  return (
    <BottomSheetPopup open={open} onClose={onClose}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-white">Add Token</h2>
            <button className="text-orange-400 text-lg" onClick={onClose}>
              × Close
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Paste the token CONTRACT_ADDRESS here to add the token and start
            your DCA journey.
          </p>
        </div>

        {/* Search Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-3 text-sm font-medium">
              Contract Address
            </label>
            <div className="relative">
              <Input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="0x..."
                className="bg-[#1E1E1F] text-white border-2 border-[#2A2A2A] rounded-xl w-full px-4 py-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all duration-200"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
              />
              {tokenAddress && (
                <button
                  onClick={() => setTokenAddress("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center transition-colors duration-200"
                  aria-label="Clear"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-300"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <Button
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-black px-6 py-3 rounded-xl font-semibold w-full transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed shadow-lg"
            onClick={handleSearch}
            disabled={isSearching || !tokenAddress.trim()}
          >
            {isSearching ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                <span>Searching...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Search Token</span>
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl text-red-300 text-sm flex items-start space-x-3">
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-medium">Search Error</p>
            <p className="text-red-200/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Search Result */}
      {searchResult && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-400 text-sm font-medium">
              Token Found
            </span>
          </div>
          <div className="bg-gradient-to-br from-[#1E1E1F] to-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] shadow-lg">
            <div className="flex items-start gap-4">
              {/* Token Image */}
              <div className="flex-shrink-0 relative">
                {searchResult.imgUrl ? (
                  <div className="relative">
                    <Image
                      src={searchResult.imgUrl}
                      alt={searchResult.name}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-orange-500/20"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-[#1A1A1A] flex items-center justify-center">
                      <svg
                        width="10"
                        height="10"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-white"
                        />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl border-2 border-gray-600 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <span className="text-xl text-gray-300 font-bold">
                      {searchResult.name[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
              </div>

              {/* Token Info */}
              <div className="flex-1 min-w-0 space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold text-lg truncate">
                      {searchResult.name}
                    </h3>
                    <span className="text-orange-400 text-sm font-medium bg-orange-500/10 px-2 py-1 rounded-lg">
                      {searchResult.symbol}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-400 text-xs font-mono bg-gray-800/50 px-2 py-1 rounded-md">
                      {formatAddress(searchResult.contractAddress)}
                    </span>
                    {searchResult.verified && (
                      <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/30 font-medium">
                        ✓ Verified
                      </span>
                    )}
                    {(searchResult.source === "clanker" ||
                      searchResult.source === "zora") && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full border font-medium ${
                          getSourceBadge(searchResult.source).color
                        }`}
                      >
                        {getSourceBadge(searchResult.source).text}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {searchResult.description && (
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-2">
                    {searchResult.description}
                  </p>
                )}

                {/* Creator Info */}
                {searchResult.user &&
                  (searchResult.user.displayName ||
                    searchResult.user.username) && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-700/50">
                      <span className="text-gray-400 text-xs font-medium">
                        Created by
                      </span>
                      <div className="flex items-center gap-2">
                        {searchResult.user.pfp && (
                          <Image
                            src={searchResult.user.pfp}
                            alt={
                              searchResult.user.displayName ||
                              searchResult.user.username ||
                              "Creator"
                            }
                            width={20}
                            height={20}
                            className="w-5 h-5 rounded-full border border-gray-600"
                          />
                        )}
                        <span className="text-orange-400 text-sm font-medium">
                          {searchResult.user.displayName ||
                            searchResult.user.username}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Add Button */}
            <div className="mt-6 pt-4 border-t border-gray-700/50">
              <Button
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-black font-bold py-3 rounded-xl w-full transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed shadow-lg"
                onClick={handleAddToken}
                disabled={isAdding}
              >
                {isAdding ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    <span>Adding Token...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Add Token</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
    </BottomSheetPopup>
  );
};
