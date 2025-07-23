import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";

const prisma = new PrismaClient();

const DCA_EXECUTOR_ADDRESS = process.env.NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;

if (!DCA_EXECUTOR_ADDRESS || !RPC_URL || !PRIVATE_KEY || !ONEINCH_API_KEY) {
  throw new Error(
    "Missing required environment variables for DCA executor or 1inch API"
  );
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const ONEINCH_BASE_URL = "https://api.1inch.dev/swap/v6.0/8453/swap";

const DCAExecutorABI = [
  {
    inputs: [
      { internalType: "address", name: "user", type: "address" },
      { internalType: "address", name: "tokenOut", type: "address" },
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "bytes", name: "swapData", type: "bytes" },
    ],
    name: "executeSwap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "user", type: "address" },
      { internalType: "address", name: "tokenOut", type: "address" },
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "bytes", name: "swapData", type: "bytes" },
    ],
    name: "executeNativeSwap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const ERC20ABI = [
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const contractInstance = new ethers.Contract(
  DCA_EXECUTOR_ADDRESS,
  DCAExecutorABI,
  signer
);

async function getSwapData(
  srcToken: string,
  dstToken: string,
  amount: string,
  fromAddress: string,
  recipient: string
): Promise<string> {
  try {
    const params = new URLSearchParams({
      src: srcToken,
      dst: dstToken,
      amount: amount.toString(),
      from: DCA_EXECUTOR_ADDRESS,
      origin: recipient,
      slippage: "5",
      disableEstimate: "true",
      referrer: "0xe42c136730a9cfefb5514d4d3d06eb27baaf3f08",
      fee: "3",
    } as Record<string, string>);
    const url = `${ONEINCH_BASE_URL}?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ONEINCH_API_KEY}`,
        accept: "application/json",
        "content-type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(
        `1inch API error: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    if (data.tx && data.tx.data) {
      return data.tx.data;
    } else {
      throw new Error("No swap data found in 1inch API response");
    }
  } catch (error) {
    let details = "";
    if (error instanceof Error) {
      details = error.message;
    } else if (typeof error === "string") {
      details = error;
    } else {
      details = JSON.stringify(error);
    }
    throw new Error(`Failed to get swap data: ${details}`);
  }
}

async function checkTokenAllowance(
  tokenAddress: string,
  ownerAddress: string
): Promise<bigint> {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider);
    const allowance: bigint = await tokenContract.allowance(
      ownerAddress,
      DCA_EXECUTOR_ADDRESS
    );
    return allowance;
  } catch (error) {
    throw error;
  }
}

// Function to parse SwapExecuted event from transaction logs
function parseSwapExecutedEvent(receipt: {
  logs?: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}): {
  amountOut: string;
  feeAmount: string;
  amountIn: string;
} {
  const eventTopic =
    "0xad671c9d50262b75ba17bdf7e330ae0d7da971800b2526584a85f83d23296b15"; // SwapExecuted event signature
  let amountOut = "0";
  let feeAmount = "0";
  let amountIn = "0";

  if (receipt.logs && receipt.logs.length > 0) {
    console.log("Receipt logs:", receipt.logs);

    // Find the SwapExecuted event log
    const swapExecutedEvent = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === DCA_EXECUTOR_ADDRESS!.toLowerCase() &&
        log.topics[0] === eventTopic
    );

    if (swapExecutedEvent) {
      console.log("Found SwapExecuted event log:", swapExecutedEvent);

      // Parse the event data according to the structure:
      // event SwapExecuted(
      //   address indexed user,        // topic[1]
      //   address recipient,           // data[0:32]
      //   address toToken,             // data[32:64]
      //   uint256 amountIn,            // data[64:96]
      //   uint256 indexed amountOut,   // topic[2]
      //   uint256 feeAmount            // data[96:128]
      // );

      // Extract indexed parameters from topics
      const userAddress = "0x" + swapExecutedEvent.topics[1].slice(26); // Remove padding from indexed address
      const amountOutIndexed = BigInt(swapExecutedEvent.topics[2]).toString();

      // Extract non-indexed parameters from data
      const data = swapExecutedEvent.data.replace(/^0x/, "");

      if (data.length >= 64 * 2) {
        const recipientHex = data.slice(0, 64);
        const toTokenHex = data.slice(64, 128);
        const amountInHex = data.slice(128, 192);

        const recipient = "0x" + recipientHex.slice(24); // Remove padding from address
        const toToken = "0x" + toTokenHex.slice(24); // Remove padding from address
        amountIn = BigInt("0x" + amountInHex).toString();
        amountOut = amountOutIndexed; // Use indexed amountOut from topics

        // Calculate fee amount as 3% of amountIn
        feeAmount = ((BigInt(amountIn) * BigInt(3)) / BigInt(100)).toString();

        console.log(`User: ${userAddress}`);
        console.log(`Recipient: ${recipient}`);
        console.log(`ToToken: ${toToken}`);
        console.log(`AmountIn: ${amountIn}`);
        console.log(`AmountOut: ${amountOut}`);
        console.log(`FeeAmount (3% of AmountIn): ${feeAmount}`);
      } else {
        console.log("Log data too short or malformed:", data);
      }
    }
  }

  if (amountOut === "0") {
    console.log("Warning: Could not extract amountOut from transaction logs");
  }

  return { amountOut, feeAmount, amountIn };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ planhash: string }> }
) {
  try {
    const { planhash: planHash } = await params;
    if (!planHash) {
      return NextResponse.json(
        { success: false, error: "Missing planHash in URL" },
        { status: 400 }
      );
    }

    console.log(`Starting execution for plan: ${planHash}`);

    // Fetch the plan and related info
    const plan = await prisma.dCAPlan.findUnique({
      where: { planHash },
      include: { tokenOut: true, user: true },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Plan not found" },
        { status: 404 }
      );
    }

    if (plan.lastExecutedAt !== 0) {
      return NextResponse.json(
        { success: false, error: "Initial investment already executed" },
        { status: 409 }
      );
    }

    // Only allow if plan is active
    if (!plan.active) {
      return NextResponse.json(
        { success: false, error: "Plan is not active" },
        { status: 409 }
      );
    }

    console.log(
      `Plan found: ${plan.planHash}, User: ${plan.userWallet}, Amount: ${plan.amountIn}`
    );

    // Prepare swap
    const srcToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
    const dstToken = plan.tokenOut.address;
    const amount = plan.amountIn.toString();
    const fromAddress = plan.userWallet;
    const recipient = plan.recipient;

    // Check allowance if not native
    if (!plan.tokenOut.isWrapped) {
      console.log(`Checking allowance for token: ${dstToken}`);
      const currentAllowance = await checkTokenAllowance(dstToken, fromAddress);
      console.log(
        `Current allowance: ${currentAllowance.toString()}, Required: ${amount}`
      );

      if (BigInt(currentAllowance) < BigInt(amount)) {
        return NextResponse.json(
          { success: false, error: "Insufficient allowance" },
          { status: 402 }
        );
      }
    } else {
      console.log("Native swap - no allowance check needed");
    }

    // Get swap data
    let swapData;
    try {
      console.log(
        `Getting swap data for: ${srcToken} -> ${dstToken}, amount: ${amount}`
      );
      swapData = await getSwapData(
        srcToken,
        dstToken,
        amount,
        fromAddress,
        recipient
      );
      console.log(`Received swap data: ${swapData.substring(0, 66)}...`);
    } catch (e) {
      let details = "";
      if (e instanceof Error) {
        details = e.message;
      } else if (typeof e === "string") {
        details = e;
      } else {
        details = JSON.stringify(e);
      }
      console.error(`Failed to get swap data: ${details}`);
      return NextResponse.json(
        { success: false, error: "Failed to get swap data", details },
        { status: 500 }
      );
    }

    // Execute swap
    let tx, receipt;
    try {
      console.log(`Executing swap transaction...`);
      if (plan.tokenOut.isWrapped) {
        console.log("Executing native swap for WETH");
        tx = await contractInstance.executeNativeSwap(
          fromAddress,
          dstToken,
          recipient,
          BigInt(amount),
          swapData
        );
      } else {
        console.log("Executing regular swap");
        tx = await contractInstance.executeSwap(
          fromAddress,
          dstToken,
          recipient,
          BigInt(amount),
          swapData
        );
      }

      console.log(`Transaction sent: ${tx.hash}`);
      receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    } catch (e) {
      let details = "";
      if (e instanceof Error) {
        details = e.message;
      } else if (typeof e === "string") {
        details = e;
      } else {
        details = JSON.stringify(e);
      }
      console.error(`Swap execution failed: ${details}`);
      return NextResponse.json(
        { success: false, error: "Swap execution failed", details },
        { status: 500 }
      );
    }

    // Parse transaction logs to get amountOut and feeAmount
    const {
      amountOut,
      feeAmount,
      amountIn: parsedAmountIn,
    } = parseSwapExecutedEvent(receipt);

    // Update plan and create execution record in a transaction
    const now = Math.floor(Date.now() / 1000);

    try {
      console.log(`Updating database with execution details...`);

      // Use a transaction to ensure both operations succeed or fail together
      await prisma.$transaction(async (prismaTx) => {
        // Update plan
        await prismaTx.dCAPlan.update({
          where: { planHash },
          data: { lastExecutedAt: now },
        });

        // Create execution record
        await prismaTx.dCAExecution.create({
          data: {
            txHash: tx.hash,
            planHash: plan.planHash,
            amountIn: parsedAmountIn || plan.amountIn.toString(),
            tokenOutAddress: plan.tokenOut.address,
            amountOut: amountOut,
            feeAmount: feeAmount,
          },
        });
      });

      console.log(`Database updated successfully for plan: ${planHash}`);
    } catch (dbError) {
      console.error(`Database update failed for plan ${planHash}:`, dbError);
      return NextResponse.json(
        {
          success: false,
          error: "Database update failed",
          details: dbError instanceof Error ? dbError.message : String(dbError),
        },
        { status: 500 }
      );
    }

    console.log(`Successfully executed plan: ${planHash}`);
    console.log(`Transaction hash: ${tx.hash}`);
    console.log(`Amount Out: ${amountOut}`);
    console.log(`Fee Amount: ${feeAmount}`);

    return NextResponse.json({
      success: true,
      txHash: tx.hash,
      amountOut: amountOut,
      feeAmount: feeAmount,
    });
  } catch (error) {
    console.error(`Unexpected error in POST handler:`, error);
    let errMsg = "Unknown error";
    if (error instanceof Error) {
      errMsg = error.message;
    } else if (typeof error === "string") {
      errMsg = error;
    } else {
      errMsg = JSON.stringify(error);
    }
    return NextResponse.json(
      { success: false, error: errMsg },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
