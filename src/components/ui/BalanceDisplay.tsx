import React, { useEffect } from "react";
import Image from "next/image";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { useMiniApp } from "~/components/providers/FrameProvider";
import { useRefresh } from "~/components/providers/RefreshProvider";
import { USDC_ABI } from "~/lib/contracts/abi";

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;

const DCA_EXECUTOR_ADDRESS = process.env
  .NEXT_PUBLIC_DCA_EXECUTOR_ADDRESS as `0x${string}`;

interface BalanceDisplayProps {
  className?: string;
  onOpenApproval?: () => void;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  className = "",
  onOpenApproval,
}) => {
  const { address } = useAccount();
  const { context } = useMiniApp();
  const { onBalanceRefresh } = useRefresh();

  // Fetch USDC balance
  const {
    data: balanceData,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useBalance({
    address: address as `0x${string}`,
    token: USDC_ADDRESS as `0x${string}`,
    query: {
      enabled: !!address,
    },
  });

  // Fetch USDC allowance
  const {
    data: allowanceData,
    isLoading: allowanceLoading,
    refetch: refetchAllowance,
  } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [address as `0x${string}`, DCA_EXECUTOR_ADDRESS as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  // Register refresh callback
  useEffect(() => {
    const unregister = onBalanceRefresh(() => {
      refetchBalance();
      refetchAllowance();
    });
    return unregister;
  }, [onBalanceRefresh, refetchBalance, refetchAllowance]);

  // Format balance to display
  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return "$0.00";
    // USDC has 6 decimals
    const usdcAmount = Number(balance) / 1000000;
    return `$${usdcAmount.toFixed(2)}`;
  };

  // Format allowance to display
  const formatAllowance = (allowance: bigint | undefined): string => {
    if (!allowance) return "$0.00";
    // USDC has 6 decimals
    const usdcAmount = Number(allowance) / 1000000;
    return `$${usdcAmount.toFixed(2)}`;
  };

  const isLoading = balanceLoading || allowanceLoading;

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div
        className="flex items-center bg-[#1F1F1F] rounded-lg px-3 py-1 text-sm cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => onOpenApproval?.()}
      >
        <Image
          src="/usdc.png"
          alt="USDC"
          width={16}
          height={16}
          className="mr-1"
        />
        <span>{isLoading ? "..." : formatBalance(balanceData?.value)}</span>
        <span className="mx-2 text-gray-400">|</span>
        <span className="text-gray-300">
          {isLoading ? "..." : formatAllowance(allowanceData)}
        </span>
      </div>
      {context?.user?.pfpUrl ? (
        <Image
          src={context.user.pfpUrl}
          alt="Profile"
          width={32}
          height={32}
          className="w-8 h-8 rounded-full object-cover border-2 border-gray-700"
        />
      ) : (
        <span className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-orange-500 flex items-center justify-center text-lg">
          🐷
        </span>
      )}
    </div>
  );
};
