import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { formatEther, isAddress } from "viem";

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

interface GeckoTerminalRawData {
  data?: {
    attributes?: {
      address?: string;
      name?: string;
      symbol?: string;
      decimals?: number;
      image_url?: string;
      total_supply?: string;
      price_usd?: string;
      fdv_usd?: string;
      market_cap_usd?: string;
      volume_usd?: {
        h24?: string;
      };
    };
  };
  [key: string]: unknown;
}

interface TokenResponse {
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
  source: "database" | "clanker" | "zora" | "geckoTerminal";
  rawData?: ClankerRawData | ZoraRawData | GeckoTerminalRawData;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractAddress = searchParams.get("q");

    if (!contractAddress) {
      return NextResponse.json(
        { error: "Contract address is required" },
        { status: 400 }
      );
    }

    // Validate the address
    if (!isAddress(contractAddress)) {
      return NextResponse.json(
        { error: "Invalid contract address format" },
        { status: 400 }
      );
    }

    // Check if token exists in database
    const existingToken = await prisma.token.findUnique({
      where: { address: contractAddress.toLowerCase() },
    });

    if (existingToken) {
      const response: TokenResponse = {
        contractAddress: existingToken.address,
        name: existingToken.name,
        symbol: existingToken.symbol,
        imgUrl: existingToken.image || undefined,
        description: existingToken.about || undefined,
        verified: false, // Database doesn't have verification status
        source: "database",
        rawData: existingToken,
      };

      return NextResponse.json(response);
    }

    // Search from external APIs simultaneously
    const [clankerResult, zoraResult] = await Promise.allSettled([
      searchClanker(contractAddress),
      searchZora(contractAddress),
    ]);

    // Process Clanker result
    if (clankerResult.status === "fulfilled" && clankerResult.value) {
      return NextResponse.json(clankerResult.value);
    }

    // Process Zora result
    if (zoraResult.status === "fulfilled" && zoraResult.value) {
      return NextResponse.json(zoraResult.value);
    }

    // If both Clanker and Zora failed, try GeckoTerminal as fallback
    const geckoResult = await searchGeckoTerminal(contractAddress);
    if (geckoResult) {
      return NextResponse.json(geckoResult);
    }

    // If all APIs failed, don't return a token with unknown source
    return NextResponse.json(
      { error: "Token not found in any source" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error searching token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function searchClanker(
  contractAddress: string
): Promise<TokenResponse | null> {
  try {
    const response = await fetch(
      `https://www.clanker.world/api/tokens?q=${contractAddress}&includeUser=true&limit=3`
    );

    if (!response.ok) {
      throw new Error(`Clanker API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const token = data.data[0];
    const user = token.related?.user;

    return {
      contractAddress: token.contract_address,
      name: token.name,
      symbol: token.symbol,
      imgUrl: token.img_url,
      description: token.description,
      supply: "100000000000",
      verified: token.tags?.verified || false,
      user:
        user && (user.username || user.display_name)
          ? {
              ...(user.fid && { fid: user.fid }),
              ...(user.username && { username: user.username }),
              ...(user.pfp_url && { pfp: user.pfp_url }),
              ...(user.display_name && { displayName: user.display_name }),
              ...(user.custody_address && {
                creator_address: user.custody_address,
              }),
            }
          : undefined,
      source: "clanker",
      rawData: data,
    };
  } catch (error) {
    console.error("Clanker API error:", error);
    return null;
  }
}

async function searchZora(
  contractAddress: string
): Promise<TokenResponse | null> {
  try {
    const response = await getCoin({
      address: contractAddress,
      chain: base.id,
    });

    const coin = response.data?.zora20Token;

    if (!coin) {
      return null;
    }

    const creatorProfile = coin.creatorProfile;
    const user =
      creatorProfile &&
      (creatorProfile.handle ||
        creatorProfile.socialAccounts?.farcaster?.displayName)
        ? {
            ...(creatorProfile.socialAccounts?.farcaster?.id && {
              fid: parseInt(creatorProfile.socialAccounts.farcaster.id),
            }),
            ...(creatorProfile.handle && { username: creatorProfile.handle }),
            ...(creatorProfile.avatar?.previewImage?.small && {
              pfp: creatorProfile.avatar.previewImage.small,
            }),
            ...((creatorProfile.socialAccounts?.farcaster?.displayName ||
              creatorProfile.handle) && {
              displayName:
                creatorProfile.socialAccounts?.farcaster?.displayName ||
                creatorProfile.handle,
            }),
            ...(coin?.creatorAddress && {
              creator_address: coin.creatorAddress,
            }),
          }
        : undefined;

    return {
      contractAddress: contractAddress,
      name: coin.name,
      symbol: coin.symbol,
      imgUrl:
        coin.mediaContent?.previewImage?.medium ||
        coin.mediaContent?.previewImage?.small,
      description: coin.description,
      supply: "1000000000",
      verified: false, // Zora doesn't provide verification status
      user: user,
      source: "zora",
      rawData: response.data,
    };
  } catch (error) {
    console.error("Zora API error:", error);
    return null;
  }
}

async function searchGeckoTerminal(
  contractAddress: string
): Promise<TokenResponse | null> {
  try {
    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/base/tokens/${contractAddress}`
    );

    if (!response.ok) {
      throw new Error(`GeckoTerminal API error: ${response.status}`);
    }

    const data: GeckoTerminalRawData = await response.json();

    if (!data.data?.attributes) {
      return null;
    }

    const attributes = data.data.attributes;

    return {
      contractAddress: attributes.address || contractAddress,
      name: attributes.name || "Unknown Token",
      symbol: attributes.symbol || "UNKNOWN",
      imgUrl: attributes.image_url,
      description: undefined, // GeckoTerminal doesn't provide description
      supply: formatEther(BigInt(Number(attributes.total_supply))),
      verified: false, // GeckoTerminal doesn't provide verification status
      user: undefined, // GeckoTerminal doesn't provide user information
      source: "geckoTerminal",
      rawData: data,
    };
  } catch (error) {
    console.error("GeckoTerminal API error:", error);
    return null;
  }
}
