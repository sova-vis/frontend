"use client";

/**
 * Pro/entitlement context for the student app.
 *
 * SAFETY: this hook is designed to FAIL OPEN. Until billing status has loaded, or
 * if it can't be fetched, or whenever the backend master switch (enforced) is off,
 * `isPro` is true and `showGating` is false — so the UI behaves exactly like before
 * billing existed. Gating only ever appears when the server says enforced === true.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useUser } from './auth';
import {
  fetchBillingStatus,
  startTrial as apiStartTrial,
  type BillingStatus,
  type StartTrialResult,
} from './billing';

interface ProContextValue {
  loading: boolean;
  data: BillingStatus | null;
  enforced: boolean;
  isPro: boolean;
  trialAvailable: boolean;
  daysLeft: number | null;
  status: string;
  refresh: () => Promise<void>;
  startTrialFlow: () => Promise<StartTrialResult | null>;
  // Upgrade modal control (owned here so any component / the 402 catcher can open it)
  upgradeOpen: boolean;
  openUpgrade: () => void;
  closeUpgrade: () => void;
}

const ProContext = createContext<ProContextValue>({
  loading: true,
  data: null,
  enforced: false,
  isPro: true,
  trialAvailable: false,
  daysLeft: null,
  status: 'free',
  refresh: async () => {},
  startTrialFlow: async () => null,
  upgradeOpen: false,
  openUpgrade: () => {},
  closeUpgrade: () => {},
});

export function ProProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    const status = await fetchBillingStatus();
    if (status) setData(status);
    setLoading(false);
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  // Any blocked Pro API call (HTTP 402) dispatches this event → open the modal.
  useEffect(() => {
    const onProRequired = () => setUpgradeOpen(true);
    window.addEventListener('propel:pro-required', onProRequired as EventListener);
    return () => window.removeEventListener('propel:pro-required', onProRequired as EventListener);
  }, []);

  const startTrialFlow = useCallback(async () => {
    const result = await apiStartTrial();
    await refresh();
    return result;
  }, [refresh]);

  const value = useMemo<ProContextValue>(() => {
    const enforced = data?.enforced ?? false;
    // Fail open: not enforced, still loading, or no data → treat as Pro.
    const isPro = !enforced || loading || !data ? true : data.isPro;
    return {
      loading,
      data,
      enforced,
      isPro,
      trialAvailable: data?.trialAvailable ?? false,
      daysLeft: data?.daysLeft ?? null,
      status: data?.status ?? 'free',
      refresh,
      startTrialFlow,
      upgradeOpen,
      openUpgrade: () => setUpgradeOpen(true),
      closeUpgrade: () => setUpgradeOpen(false),
    };
  }, [data, loading, refresh, startTrialFlow, upgradeOpen]);

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProContextValue {
  return useContext(ProContext);
}

/** True only when the UI should actively show a lock/upsell for a Pro feature. */
export function useShowGating(): boolean {
  const { enforced, isPro, loading } = usePro();
  return enforced && !loading && !isPro;
}
