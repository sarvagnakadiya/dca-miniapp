import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, username } = body;

    if (!fid) {
      return NextResponse.json(
        { success: false, error: "FID is required" },
        { status: 400 }
      );
    }

    // Log the user visit
    const visit = await prisma.userVisit.create({
      data: {
        fid: parseInt(fid),
        username: username || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: visit,
    });
  } catch (error) {
    console.error("Error logging user visit:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log visit" },
      { status: 500 }
    );
  }
}
