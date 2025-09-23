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
    fid: number;
    username: string;
    pfp: string;
    displayName: string;
    creator_address?: string;
  };
  source: "database" | "clanker" | "zora";
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
      default:
        return {
          text: "Unknown",
          color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
        };
    }
  };

  return (
    <BottomSheetPopup open={open} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-2xl font-semibold text-white">Add Token</span>
        <button className="text-orange-400 text-lg" onClick={onClose}>
          × Close
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-gray-400 mb-2 text-sm">
          Paste token contract address
        </label>
        <Input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="0x..."
          className="bg-[#333333] text-white border-2 border-[#333333] rounded-md w-full mb-3"
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <Button
          className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-md font-medium w-full"
          onClick={handleSearch}
          disabled={isSearching || !tokenAddress.trim()}
        >
          {isSearching ? "Searching..." : "Search Token"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {searchResult && (
        <div className="mb-6">
          <div className="text-gray-400 text-sm mb-3">Search Result</div>
          <div className="bg-[#333333] rounded-lg p-4 border border-[#444444]">
            <div className="flex items-start gap-3">
              {/* Token Image */}
              <div className="flex-shrink-0">
                {searchResult.imgUrl ? (
                  <Image
                    src={searchResult.imgUrl}
                    alt={searchResult.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover border-2 border-orange-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-gray-600 bg-[#1E1E1F] flex items-center justify-center">
                    <span className="text-lg text-gray-400">
                      {searchResult.name[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
              </div>

              {/* Token Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-medium text-lg truncate">
                    {searchResult.name}
                  </h3>
                  <span className="text-gray-400 text-sm">
                    ({searchResult.symbol})
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-400 text-xs font-mono">
                    {formatAddress(searchResult.contractAddress)}
                  </span>
                  {searchResult.verified && (
                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/30">
                      Verified
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      getSourceBadge(searchResult.source).color
                    }`}
                  >
                    {getSourceBadge(searchResult.source).text}
                  </span>
                </div>

                {/* Description */}
                {searchResult.description && (
                  <p className="text-gray-300 text-sm line-clamp-2 mb-2">
                    {searchResult.description}
                  </p>
                )}

                {/* Creator Info */}
                {searchResult.user && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">Creator:</span>
                    <div className="flex items-center gap-1">
                      {searchResult.user.pfp && (
                        <Image
                          src={searchResult.user.pfp}
                          alt={searchResult.user.displayName}
                          width={16}
                          height={16}
                          className="w-4 h-4 rounded-full"
                        />
                      )}
                      <span className="text-orange-400 text-xs font-medium">
                        {searchResult.user.displayName ||
                          searchResult.user.username}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Add Button */}
            <div className="mt-4 pt-4 border-t border-[#444444]">
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-black text-sm font-semibold py-2 rounded-lg w-full disabled:bg-gray-600 disabled:text-gray-400"
                onClick={handleAddToken}
                disabled={isAdding}
              >
                {isAdding ? "Adding Token..." : "Add Token"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>
          If you dont find the token here, paste the Contract address of the
          token here to start the DCA position in that token
        </p>
      </div>
    </BottomSheetPopup>
  );
};
