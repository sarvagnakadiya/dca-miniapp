import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userAddress, tokenOutAddress, fid, action } = await req.json();

    // Validation
    const requiredFields = {
      userAddress,
      tokenOutAddress,
      fid,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => value === undefined || value === null)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          missingFields,
        },
        { status: 400 }
      );
    }

    // Find user by FID (following getPlan pattern)
    const user = await prisma.user.findUnique({
      where: { fid: parseInt(fid.toString()) },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const normalizedToken = tokenOutAddress.toLowerCase();
    const op: "stop" | "delete" = action === "delete" ? "delete" : "stop";

    if (op === "stop") {
      // Find only active plan for stop
      const activePlan = await prisma.dCAPlan.findFirst({
        where: {
          userWallet: user.wallet,
          tokenOutAddress: normalizedToken,
          active: true,
        },
      });

      if (!activePlan) {
        return NextResponse.json(
          { success: false, error: "No active plan found for this token" },
          { status: 404 }
        );
      }

      // Only deactivate; keep executions/history
      await prisma.dCAPlan.update({
        where: { planHash: activePlan.planHash },
        data: { active: false },
      });

      return NextResponse.json({
        success: true,
        message: "Plan stopped (set inactive)",
        planHash: activePlan.planHash,
      });
    } else {
      // Delete any plan (active or inactive) and its executions
      const plan = await prisma.dCAPlan.findFirst({
        where: { userWallet: user.wallet, tokenOutAddress: normalizedToken },
      });

      if (!plan) {
        return NextResponse.json(
          { success: false, error: "No plan found for this token" },
          { status: 404 }
        );
      }

      // Delete executions first, then the plan
      await prisma.dCAExecution.deleteMany({
        where: { planHash: plan.planHash },
      });
      await prisma.dCAPlan.delete({ where: { planHash: plan.planHash } });

      return NextResponse.json({
        success: true,
        message: "Plan and all executions deleted",
        deletedPlanHash: plan.planHash,
      });
    }
  } catch (error) {
    console.error("Error deleting plan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete plan",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
