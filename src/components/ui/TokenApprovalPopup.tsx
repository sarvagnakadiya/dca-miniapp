import React, { useState } from "react";
import { BottomSheetPopup } from "./BottomSheetPopup";
import { Button } from "./Button";
import { Input } from "./input";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { USDC_ABI } from "~/lib/contracts/abi";
import { executeInitialInvestment, publicClient } from "~/lib/utils";
import { waitForTransactionReceipt } from "viem/actions";
import { encodeFunctionData } from "viem";
import DCA_ABI from "~/lib/contracts/DCAForwarder.json";
import { sendCalls, waitForCallsStatus } from "@wagmi/core";
import { config } from "~/components/providers/WagmiProvider";

interface TokenApprovalPopupProps {
  open: boolean;
  onClose: () => void;
  onApprove: (amount: number) => void;
  token?: string;
  defaultAmount?: number;
  tokenOutAddress?: `0x${string}`;
  fid?: number;
  planHash?: string; // Add planHash for initial investment execution
  frequencySeconds?: number;
  hasActivePlan?: boolean;
  planAmount?: number; // amount selected in SetFrequencyPopup (USDC units)
}

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const DCA_EXECUTOR_ADDRESS = process.env
  .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;
const quickAmounts = [5, 10, 50, 100, 500, 1000];

export const TokenApprovalPopup: React.FC<TokenApprovalPopupProps> = ({
  open,
  onClose,
  onApprove,
  token = "USDC",
  defaultAmount = 100,
  tokenOutAddress,
  fid,
  planHash,
  frequencySeconds = 86400,
  hasActivePlan = false,
  planAmount,
}) => {
  const [amount, setAmount] = useState(defaultAmount);
  const [isLoading, setIsLoading] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string>("");
  const { address } = useAccount();

  const { writeContractAsync: approveToken, isPending } = useWriteContract();
  const { writeContractAsync: writeContractDirect } = useWriteContract();

  // Check current allowance
  const { data: currentAllowance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, DCA_EXECUTOR_ADDRESS as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  // Function to check allowance with retry mechanism
  const checkAllowanceWithRetry = async (
    expectedAmount: bigint,
    maxRetries = 5
  ): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const allowance = await publicClient.readContract({
          address: USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: "allowance",
          args: [
            address as `0x${string}`,
            DCA_EXECUTOR_ADDRESS as `0x${string}`,
          ],
        });

        console.log(
          `Allowance check attempt ${
            i + 1
          }: ${allowance.toString()}, Expected: ${expectedAmount.toString()}`
        );

        if (allowance >= expectedAmount) {
          console.log("Allowance confirmed:", allowance.toString());
          return true;
        }

        if (i < maxRetries - 1) {
          console.log(
            `Allowance not yet updated, waiting 2 seconds... (${
              i + 1
            }/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error checking allowance (attempt ${i + 1}):`, error);
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
    return false;
  };

  const handleApprove = async () => {
    if (!address) return;

    try {
      setIsLoading(true);
      const approvalAmountInWei = BigInt(amount * 1000000);
      const planAmountInWei = BigInt((planAmount ?? amount) * 1000000);

      // Check if we have plan data from SetFrequencyPopup (new plan creation)
      const isCreatingNewPlan =
        !hasActivePlan &&
        planAmount !== undefined &&
        tokenOutAddress !== undefined;

      // If user already has an active plan OR no plan data, only approve more USDC
      if (hasActivePlan || !isCreatingNewPlan) {
        setApprovalStatus("Approving USDC...");
        const hash = await approveToken({
          address: USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: "approve",
          args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, approvalAmountInWei],
        });
        setApprovalStatus("Waiting for approval confirmation...");
        await waitForTransactionReceipt(publicClient, { hash });
        setApprovalStatus("Approval confirmed!");
        onApprove(amount);
        return;
      }

      // New plan creation with EIP-5792 batching
      console.log("Creating new plan with batching...");

      // Preflight: may reactivate plan DB-side and skip on-chain create
      const preResp = await fetch("/api/plan/createPlan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          tokenOutAddress,
          recipient: address,
          amountIn: Number(planAmountInWei),
          frequency: frequencySeconds,
          fid,
        }),
      });
      const preJson = await preResp.json();
      if (!preJson.success) {
        throw new Error(preJson.error || "Failed to prepare plan");
      }

      if (preJson.txRequired === false) {
        // Plan exists and was reactivated. Only approve more USDC.
        setApprovalStatus("Approving USDC for reactivated plan...");
        const hash = await approveToken({
          address: USDC_ADDRESS as `0x${string}`,
          abi: USDC_ABI,
          functionName: "approve",
          args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, approvalAmountInWei],
        });
        await waitForTransactionReceipt(publicClient, { hash });
        setApprovalStatus("Reactivated & approved!");
        onApprove(amount);
        return;
      }

      setApprovalStatus("Creating plan & approving USDC...");

      const approveData = encodeFunctionData({
        abi: USDC_ABI,
        functionName: "approve",
        args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, approvalAmountInWei],
      });
      const createPlanData = encodeFunctionData({
        abi: DCA_ABI.abi,
        functionName: "createPlan",
        args: [tokenOutAddress, address as `0x${string}`],
      });
      console.log("naya naya EIP");

      try {
        const { id } = await sendCalls(config, {
          calls: [
            { to: USDC_ADDRESS, data: approveData },
            { to: DCA_EXECUTOR_ADDRESS, data: createPlanData, value: 0n },
          ],
        });

        // Wait for batched calls to complete
        const status = await waitForCallsStatus(config, { id });
        if (status.status !== "success") {
          throw new Error(`Batched call status: ${status.status}`);
        }

        setApprovalStatus("Finalizing plan...");
        // Create plan in DB (finalize=true)
        const finalResp = await fetch("/api/plan/createPlan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userAddress: address,
            tokenOutAddress,
            recipient: address,
            amountIn: Number(planAmountInWei),
            frequency: frequencySeconds,
            fid,
            finalize: true,
          }),
        });
        const finalJson = await finalResp.json();
        if (!finalJson.success) {
          throw new Error(finalJson.error || "Failed to create plan in DB");
        }

        // Optionally execute initial investment (best-effort)
        const createdPlanHash = finalJson.data?.planHash as string | undefined;
        if (createdPlanHash) {
          try {
            const invest = await executeInitialInvestment(createdPlanHash);
            if (!invest.success) {
              console.warn("Initial investment failed:", invest.error);
            }
          } catch (e) {
            console.warn("Initial investment error:", e);
          }
        }

        setApprovalStatus("Plan created & USDC approved!");
        onApprove(amount);
      } catch (batchErr) {
        console.warn(
          "Batching unavailable or failed, falling back to sequential txs:",
          batchErr
        );

        // Fallback: createPlan tx then approve tx sequentially
        try {
          const hash1 = await approveToken({
            address: USDC_ADDRESS as `0x${string}`,
            abi: USDC_ABI,
            functionName: "approve",
            args: [DCA_EXECUTOR_ADDRESS as `0x${string}`, approvalAmountInWei],
          });
          await waitForTransactionReceipt(publicClient, { hash: hash1 });

          const hash2 = await writeContractDirect({
            address: DCA_EXECUTOR_ADDRESS as `0x${string}`,
            abi: DCA_ABI.abi,
            functionName: "createPlan",
            args: [tokenOutAddress, address as `0x${string}`],
          });
          await waitForTransactionReceipt(publicClient, { hash: hash2 });

          // Finalize DB
          const finalResp = await fetch("/api/plan/createPlan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userAddress: address,
              tokenOutAddress,
              recipient: address,
              amountIn: Number(planAmountInWei),
              frequency: frequencySeconds,
              fid,
              finalize: true,
            }),
          });
          const finalJson = await finalResp.json();
          if (!finalJson.success) {
            throw new Error(finalJson.error || "Failed to create plan in DB");
          }
          setApprovalStatus("Plan created & USDC approved!");
          onApprove(amount);
        } catch (seqErr) {
          console.error("Sequential fallback failed:", seqErr);
          setApprovalStatus("Action failed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error approving USDC:", error);
      setApprovalStatus("Approval failed. Please try again.");
    } finally {
      setIsLoading(false);
      // Clear status after a delay
      setTimeout(() => setApprovalStatus(""), 1000);
    }
  };

  return (
    <BottomSheetPopup open={open} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-2xl font-semibold">Approve {token}</span>
        <button className="text-orange-400 text-lg" onClick={onClose}>
          × Close
        </button>
      </div>
      <div className="mb-4">
        <label className="block text-gray-400 mb-1">Amount</label>
        <Input
          type="number"
          value={amount.toString()}
          min={0.01}
          step={0.01}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="bg-[#333333] text-white border-2 border-[#333333] rounded-md"
        />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            className={`py-2 rounded-2xl text-lg font-medium transition-colors bg-[#333333] text-white hover:bg-orange-500 hover:text-white ${
              amount === amt ? "bg-orange-500 text-white" : ""
            }`}
            onClick={() => setAmount(amt)}
          >
            ${amt}
          </button>
        ))}
      </div>
      {currentAllowance !== undefined && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg text-blue-300 text-sm">
          Current allowance:{" "}
          {currentAllowance === 0n ? "0" : Number(currentAllowance) / 1000000}{" "}
          USDC
        </div>
      )}
      {approvalStatus && (
        <div className="mb-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg text-orange-300 text-sm">
          {approvalStatus}
        </div>
      )}
      <div className="mb-4 p-3 bg-[#333333] rounded-lg text-gray-300 text-sm">
        Set a spending limit for your DCA investments. When the limit is
        reached, you can easily top it up or revoke access anytime for complete
        control over your automated purchases.
      </div>
      <Button
        className="bg-orange-500 hover:bg-orange-600 text-black text-lg font-semibold py-3 rounded-xl w-full disabled:bg-gray-600 disabled:text-gray-400"
        onClick={handleApprove}
        disabled={isLoading || isPending}
      >
        {(() => {
          const isCreatingNewPlan =
            !hasActivePlan &&
            planAmount !== undefined &&
            tokenOutAddress !== undefined;

          if (isLoading || isPending) {
            return isCreatingNewPlan
              ? "Creating & Approving..."
              : "Approving...";
          }

          if (isCreatingNewPlan) {
            return "Create & Approve";
          }

          return `Approve ${amount} ${token}`;
        })()}
      </Button>
    </BottomSheetPopup>
  );
};
