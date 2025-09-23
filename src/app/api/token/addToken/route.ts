import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAddress } from "viem";
import { TokenSource } from "@prisma/client";

interface AddTokenRequest {
  contractAddress: string;
  fid: number;
  walletAddress: string;
}

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

export async function POST(request: NextRequest) {
  try {
    const body: AddTokenRequest = await request.json();
    const { contractAddress, walletAddress } = body;

    // Validate required fields
    if (!contractAddress || !walletAddress) {
      return NextResponse.json(
        { error: "Contract address and wallet address are required" },
        { status: 400 }
      );
    }

    // Validate contract address format
    if (!isAddress(contractAddress)) {
      return NextResponse.json(
        { error: "Invalid contract address format" },
        { status: 400 }
      );
    }

    // Check if token already exists in database
    const existingToken = await prisma.token.findUnique({
      where: { address: contractAddress.toLowerCase() },
    });

    if (existingToken) {
      return NextResponse.json(
        { error: "Token already exists in database" },
        { status: 409 }
      );
    }

    // Search for token information using the searchByAddress API
    const searchResponse = await fetch(
      `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/api/token/searchByAddress?q=${contractAddress}`
    );

    if (!searchResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch token information" },
        { status: 500 }
      );
    }

    const tokenData: TokenSearchResponse = await searchResponse.json();

    // If token data came from database, it means it already exists
    if (tokenData.source === "database") {
      return NextResponse.json(
        { error: "Token already exists in database" },
        { status: 409 }
      );
    }

    // Determine token source enum
    let tokenSource: TokenSource;
    switch (tokenData.source) {
      case "clanker":
        tokenSource = TokenSource.CLANKER;
        break;
      case "zora":
        tokenSource = TokenSource.ZORA;
        break;
      default:
        tokenSource = TokenSource.CLANKER; // Default fallback
    }

    // Extract creator information
    const createdByFid = tokenData.user?.fid;
    const createdByWallet = tokenData.user
      ? tokenData.user?.creator_address
      : null;

    console.log("createdByWallet", createdByWallet);

    // Create token in database
    const newToken = await prisma.token.create({
      data: {
        address: contractAddress.toLowerCase(),
        symbol: tokenData.symbol,
        name: tokenData.name,
        decimals: 18, // Default to 18 decimals, could be extracted from rawData if available
        about: tokenData.description,
        image: tokenData.imgUrl,
        isWrapped: false, // Default to false, could be determined from token type
        tokenSource: tokenSource,
        addedByWallet: walletAddress,
        createdByFid: createdByFid,
        createdByWallet: createdByWallet,
        // Optional fields that could be populated from rawData
        totalSupply: (tokenData.rawData as ClankerRawData)?.supply
          ? BigInt((tokenData.rawData as ClankerRawData).supply!).toString()
          : (tokenData.rawData as ZoraRawData)?.zora20Token?.totalSupply
          ? BigInt(
              (tokenData.rawData as ZoraRawData).zora20Token!.totalSupply!
            ).toString()
          : null,
        marketcap: (tokenData.rawData as ClankerRawData)?.starting_market_cap
          ? (
              tokenData.rawData as ClankerRawData
            ).starting_market_cap!.toString()
          : (tokenData.rawData as ZoraRawData)?.zora20Token?.marketCap
          ? (
              tokenData.rawData as ZoraRawData
            ).zora20Token!.marketCap!.toString()
          : null,
        volume24h: (tokenData.rawData as ZoraRawData)?.zora20Token?.volume24h
          ? (
              tokenData.rawData as ZoraRawData
            ).zora20Token!.volume24h!.toString()
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Token added successfully",
      token: {
        address: newToken.address,
        name: newToken.name,
        symbol: newToken.symbol,
        image: newToken.image,
        about: newToken.about,
        tokenSource: newToken.tokenSource,
        addedByWallet: newToken.addedByWallet,
        createdByFid: newToken.createdByFid,
        createdByWallet: newToken.createdByWallet,
      },
    });
  } catch (error) {
    console.error("Error adding token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
