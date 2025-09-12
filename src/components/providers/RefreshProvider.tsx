"use client";
import React, { createContext, useContext, useCallback, useRef } from "react";

/**
 * RefreshProvider - Global data refresh management system
 *
 * This provider enables components to register refresh callbacks and trigger
 * data refreshes across the entire application. This is particularly useful
 * for pull-to-refresh functionality where multiple components need to refresh
 * their data simultaneously.
 *
 * Usage:
 * 1. Components register refresh callbacks using onBalanceRefresh or onTokenRefresh
 * 2. When refresh is needed, call refreshBalance, refreshTokenData, or refreshAll
 * 3. All registered callbacks will be executed
 *
 * Example:
 * ```tsx
 * const { onBalanceRefresh, refreshAll } = useRefresh();
 *
 * useEffect(() => {
 *   const unregister = onBalanceRefresh(() => {
 *     refetchBalance();
 *     refetchAllowance();
 *   });
 *   return unregister;
 * }, []);
 * ```
 */

interface RefreshContextType {
  refreshBalance: () => void;
  refreshTokenData: (tokenAddress?: string) => void;
  refreshAll: () => void;
  onBalanceRefresh: (callback: () => void) => () => void;
  onTokenRefresh: (callback: (tokenAddress?: string) => void) => () => void;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return context;
};

interface RefreshProviderProps {
  children: React.ReactNode;
}

export const RefreshProvider: React.FC<RefreshProviderProps> = ({
  children,
}) => {
  const balanceRefreshCallbacks = useRef<Set<() => void>>(new Set());
  const tokenRefreshCallbacks = useRef<Set<(tokenAddress?: string) => void>>(
    new Set()
  );

  const refreshBalance = useCallback(() => {
    balanceRefreshCallbacks.current.forEach((callback) => callback());
  }, []);

  const refreshTokenData = useCallback((tokenAddress?: string) => {
    tokenRefreshCallbacks.current.forEach((callback) => callback(tokenAddress));
  }, []);

  const refreshAll = useCallback(() => {
    refreshBalance();
    refreshTokenData();
  }, [refreshBalance, refreshTokenData]);

  const onBalanceRefresh = useCallback((callback: () => void) => {
    balanceRefreshCallbacks.current.add(callback);
    return () => {
      balanceRefreshCallbacks.current.delete(callback);
    };
  }, []);

  const onTokenRefresh = useCallback(
    (callback: (tokenAddress?: string) => void) => {
      tokenRefreshCallbacks.current.add(callback);
      return () => {
        tokenRefreshCallbacks.current.delete(callback);
      };
    },
    []
  );

  const value: RefreshContextType = {
    refreshBalance,
    refreshTokenData,
    refreshAll,
    onBalanceRefresh,
    onTokenRefresh,
  };

  return (
    <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
  );
};
