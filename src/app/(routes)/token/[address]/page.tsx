"use client";
import React from "react";
import TokenView from "~/components/TokenView";
import { useParams, useRouter } from "next/navigation";

const TokenPage = () => {
  const params = useParams();
  const router = useRouter();
  const tokenAddress = params?.address as string;

  return (
    <TokenView tokenAddress={tokenAddress} onClose={() => router.push("/")} />
  );
};

export default TokenPage;
