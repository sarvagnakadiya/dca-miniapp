import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { prisma } from "~/lib/prisma";
import { DCAExecution, Token } from "~/lib/types";

export async function GET(
  req: Request,
  context: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await context.params;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "7");

    console.log(
      "Fetching user plans for FID:",
      fid,
      "Page:",
      page,
      "Limit:",
      limit
    );

    // Validate FID
    if (!fid || isNaN(Number(fid))) {
      console.error("Invalid FID:", fid);
      return NextResponse.json(
        { success: false, error: "Invalid FID provided" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Database connection is handled by the persistent PrismaClient instance

    // Get all tokens
    const tokens: Token[] = await prisma.token.findMany();
    console.log("Total tokens found:", tokens.length);

    if (tokens.length === 0) {
      console.log("No tokens found in database, returning empty response");
      return NextResponse.json(
        {
          success: true,
          data: [],
          portfolio: {
            portfolioCurrentValue: 0,
            portfolioInvestedAmount: 0,
            portfolioPercentChange: 0,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Filter out USDC token
    const filteredTokens: Token[] = tokens.filter(
      (token) =>
        token.address.toLowerCase() !==
        (process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`).toLowerCase()
    );
    console.log("Filtered tokens (excluding USDC):", filteredTokens.length);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { fid: Number(fid) },
    });

    if (!user) {
      console.log("User not found for FID:", fid);
      // Return empty response instead of error, as user might not have plans yet
    }

    // Get user's plans (active and paused) by fid
    const userPlans = await prisma.dCAPlan.findMany({
      where: {
        user: {
          fid: Number(fid),
        },
      },
      include: {
        tokenOut: true,
        executions: true,
      },
    });

    console.log("User plans:", userPlans);
    console.log("--------------------------------");

    // Create a map of token addresses to their plan status and execution data
    const tokenPlanMap = new Map();
    const tokenExecutionMap = new Map();
    const tokenPlanCreatedAtMap = new Map();

    if (userPlans.length === 0) {
      console.log(
        "No user plans found, returning all tokens without active plans"
      );
    }

    userPlans.forEach((plan) => {
      // Mark tokens that have any plan (active or paused)
      tokenPlanMap.set(plan.tokenOut.address, true);

      // Store the earliest createdAt for this token (in case of multiple plans)
      const tokenAddress = plan.tokenOut.address;
      if (
        !tokenPlanCreatedAtMap.has(tokenAddress) ||
        plan.createdAt < tokenPlanCreatedAtMap.get(tokenAddress)
      ) {
        tokenPlanCreatedAtMap.set(tokenAddress, plan.createdAt);
      }

      // Aggregate executions for this token
      if (!tokenExecutionMap.has(tokenAddress)) {
        tokenExecutionMap.set(tokenAddress, []);
      }
      tokenExecutionMap.get(tokenAddress).push(...plan.executions);
    });

    // Process tokens with user data using token model fields
    const tokensWithUserData = filteredTokens.map((token) => {
      const executions = tokenExecutionMap.get(token.address) || [];
      let totalInvestedValue = 0;
      let currentValue = 0;
      let percentChange = 0;

      // Get current token price and metrics from token model
      console.log(`Raw token data for ${token.symbol}:`, {
        price: token.price,
        priceType: typeof token.price,
        fdv: token.fdv,
        marketcap: token.marketcap,
        volume24h: token.volume24h,
      });

      // Try different conversion methods for Decimal types
      const currentPrice = token.price ? parseFloat(token.price.toString()) : 0;
      const fdvUsd = token.fdv ? parseFloat(token.fdv.toString()) : 0;
      const marketCapUsd = token.marketcap
        ? parseFloat(token.marketcap.toString())
        : 0;
      const volume24h = token.volume24h
        ? parseFloat(token.volume24h.toString())
        : 0;

      console.log(
        `Converted metrics for ${token.symbol}: Price: $${currentPrice}, FDV: $${fdvUsd}, Volume: $${volume24h}`
      );

      // Calculate investment metrics only if there are executions
      if (executions.length > 0) {
        // Calculate total invested value (sum of all amountIn minus fees in USDC)
        totalInvestedValue = executions.reduce(
          (sum: number, execution: DCAExecution) => {
            const amountIn = Number(execution.amountIn) / 1_000_000; // Convert from USDC decimals (6)
            const feeAmount = Number(execution.feeAmount) / 1_000_000; // Convert from USDC decimals (6)
            return sum + (amountIn - feeAmount); // Subtract fees from investment amount
          },
          0
        );

        // Calculate current value (sum of all tokenOutAmount * current price)
        const totalTokenAmount = executions.reduce(
          (sum: number, execution: DCAExecution) => {
            return (
              sum +
              Number(execution.amountOut) /
                Math.pow(10, Number(token.decimals.toString()))
            );
          },
          0
        );

        currentValue = totalTokenAmount * currentPrice;

        // Calculate percent change
        if (totalInvestedValue > 0) {
          percentChange =
            ((currentValue - totalInvestedValue) / totalInvestedValue) * 100;
        }
      }

      return {
        id: token.address, // Add id field that Home component expects
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        about: token.about,
        decimals: token.decimals.toString(), // Convert Decimal to string
        image: token.image,
        isWrapped: token.isWrapped,
        wrappedName: token.wrappedName,
        wrappedSymbol: token.wrappedSymbol,
        originalAddress: token.originalAddress,
        hasPlan: tokenPlanMap.has(token.address),
        isActive: userPlans.some(
          (p) => p.tokenOut.address === token.address && p.active
        ),
        planCreatedAt:
          tokenPlanCreatedAtMap.get(token.address)?.toISOString() || null,
        totalInvestedValue,
        currentValue,
        percentChange,
        currentPrice,
        fdvUsd,
        volume24h,
        marketCapUsd,
      };
    });

    // Sort tokens by 24h volume in descending order
    const sortedTokensWithUserData = tokensWithUserData.sort((a, b) => {
      const volumeA = a.volume24h || 0;
      const volumeB = b.volume24h || 0;
      return volumeB - volumeA; // Descending order
    });

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedTokens = sortedTokensWithUserData.slice(
      offset,
      offset + limit
    );
    const totalTokens = sortedTokensWithUserData.length;
    const totalPages = Math.ceil(totalTokens / limit);
    const hasMore = page < totalPages;

    // Calculate portfolio-level metrics
    const portfolioCurrentValue = sortedTokensWithUserData.reduce(
      (sum, token) => sum + (token.currentValue || 0),
      0
    );

    const portfolioInvestedAmount = sortedTokensWithUserData.reduce(
      (sum, token) => sum + (token.totalInvestedValue || 0),
      0
    );

    const portfolioPercentChange =
      portfolioInvestedAmount > 0
        ? ((portfolioCurrentValue - portfolioInvestedAmount) /
            portfolioInvestedAmount) *
          100
        : 0;

    console.log("Portfolio calculation:", {
      tokensCount: tokensWithUserData.length,
      portfolioCurrentValue,
      portfolioInvestedAmount,
      portfolioPercentChange,
    });

    // Fetch day-by-day portfolio changes for chart
    // We join through the relation to User by fid
    const portfolioDailyChanges = await prisma.portfolioDailyChange.findMany({
      where: {
        user: {
          fid: Number(fid),
        },
      },
      orderBy: { date: "asc" },
    });

    const portfolioHistory = portfolioDailyChanges.map((item) => ({
      date: item.date.toISOString(),
      currentValue: parseFloat(item.currentValue.toString()),
      totalInvestedValue: parseFloat(item.totalInvestedValue.toString()),
      percentChange:
        item.percentChange !== null && item.percentChange !== undefined
          ? parseFloat(item.percentChange.toString())
          : null,
    }));

    console.log(
      "Final response - tokens with user data:",
      sortedTokensWithUserData.length
    );
    console.log("Portfolio metrics:", {
      portfolioCurrentValue,
      portfolioInvestedAmount,
      portfolioPercentChange,
    });

    // Validate response structure
    const response = {
      success: true,
      data: paginatedTokens,
      pagination: {
        page,
        limit,
        totalTokens,
        totalPages,
        hasMore,
      },
      portfolio: {
        portfolioCurrentValue,
        portfolioInvestedAmount,
        portfolioPercentChange,
        history: portfolioHistory,
      },
    };

    console.log("Response structure validation:", {
      hasSuccess: "success" in response,
      hasData: "data" in response,
      hasPortfolio: "portfolio" in response,
      hasPagination: "pagination" in response,
      dataLength: response.data.length,
      pagination: response.pagination,
    });

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error in getUserPlans API:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
