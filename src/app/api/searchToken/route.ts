import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: "Query parameter 'q' is required",
      });
    }

    const searchQuery = query.trim().toLowerCase();

    // Search tokens by symbol, name, or address
    const tokens = await prisma.token.findMany({
      where: {
        OR: [
          {
            symbol: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
          {
            name: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
          {
            address: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        address: true,
        symbol: true,
        name: true,
        image: true,
      },
      take: 10, // Get more results to allow for better filtering
    });

    // Sort results by relevance (exact matches first, then partial matches)
    const sortedTokens = tokens.sort((a, b) => {
      const aSymbol = a.symbol?.toLowerCase() || "";
      const bSymbol = b.symbol?.toLowerCase() || "";
      const aName = a.name?.toLowerCase() || "";
      const bName = b.name?.toLowerCase() || "";
      const aAddress = a.address?.toLowerCase() || "";
      const bAddress = b.address?.toLowerCase() || "";

      // Exact matches first
      if (
        aSymbol === searchQuery ||
        aName === searchQuery ||
        aAddress === searchQuery
      ) {
        return -1;
      }
      if (
        bSymbol === searchQuery ||
        bName === searchQuery ||
        bAddress === searchQuery
      ) {
        return 1;
      }

      // Starts with matches
      if (aSymbol.startsWith(searchQuery) || aName.startsWith(searchQuery)) {
        return -1;
      }
      if (bSymbol.startsWith(searchQuery) || bName.startsWith(searchQuery)) {
        return 1;
      }

      // Contains matches
      if (aSymbol.includes(searchQuery) || aName.includes(searchQuery)) {
        return -1;
      }
      if (bSymbol.includes(searchQuery) || bName.includes(searchQuery)) {
        return 1;
      }

      return 0;
    });

    // Return only top 3 results
    const topResults = sortedTokens.slice(0, 3);

    return NextResponse.json({
      success: true,
      data: topResults,
    });
  } catch (error) {
    console.error("Error searching tokens:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to search tokens",
      },
      { status: 500 }
    );
  }
}
