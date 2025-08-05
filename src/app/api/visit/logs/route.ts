import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const fid = searchParams.get("fid");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: {
      fid?: number;
      visitedAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {};

    if (fid) {
      where.fid = parseInt(fid);
    }

    if (startDate || endDate) {
      where.visitedAt = {};
      if (startDate) {
        where.visitedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.visitedAt.lte = new Date(endDate);
      }
    }

    // Get visits with pagination
    const [visits, total] = await Promise.all([
      prisma.userVisit.findMany({
        where,
        orderBy: {
          visitedAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.userVisit.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: visits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching visit logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch visit logs" },
      { status: 500 }
    );
  }
}
