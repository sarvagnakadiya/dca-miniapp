import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getCoin } from "@zoralabs/coins-sdk";
import { base } from "viem/chains";
import { isAddress } from "viem";

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

interface TokenResponse {
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

    // If both APIs failed
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
      user: user
        ? {
            fid: user.fid,
            username: user.username,
            pfp: user.pfp_url,
            displayName: user.display_name,
            creator_address: user.custody_address,
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
      creatorProfile && creatorProfile.socialAccounts?.farcaster?.id
        ? {
            fid: parseInt(creatorProfile.socialAccounts.farcaster.id),
            username: creatorProfile.handle,
            pfp: creatorProfile.avatar?.previewImage?.small || "",
            displayName:
              creatorProfile.socialAccounts.farcaster.displayName ||
              creatorProfile.handle,
            creator_address: coin?.creatorAddress,
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
