import React from "react";
import Image from "next/image";
import { useAccount, useBalance } from "wagmi";
import { useFrame } from "~/components/providers/FrameProvider";

const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

interface BalanceDisplayProps {
  className?: string;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  className = "",
}) => {
  const { address } = useAccount();
  const { context } = useFrame();

  // Fetch USDC balance
  const { data: balanceData, isLoading } = useBalance({
    address: address as `0x${string}`,
    token: USDC_ADDRESS as `0x${string}`,
    query: {
      enabled: !!address,
    },
  });

  // Format balance to display
  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return "$0.00";
    // USDC has 6 decimals
    const usdcAmount = Number(balance) / 1000000;
    return `$${usdcAmount.toFixed(2)}`;
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex items-center bg-gray-800 rounded-lg px-3 py-1 text-sm">
        <Image
          src="/usdc.png"
          alt="USDC"
          width={16}
          height={16}
          className="mr-1"
        />
        <span>{isLoading ? "..." : formatBalance(balanceData?.value)}</span>
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
        <span className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center text-lg">
          🐷
        </span>
      )}
    </div>
  );
};
