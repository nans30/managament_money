'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getAllLocalRecords,
  readFullLocalSnapshot,
  replaceFullLocalSnapshot,
  softDeleteLocalRecord,
  upsertLocalRecord,
} from '@/lib/db';
import {
  createDefaultCategories,
  createDefaultProfile,
  createDefaultWallets,
  generateUUID,
  nowIso,
} from '@/lib/defaults';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { syncWithSupabase, type SyncResult } from '@/lib/sync';
import type {
  AppBackup,
  Category,
  Debt,
  Goal,
  Invoice,
  Profile,
  ProfileType,
  RecurringBill,
  Transaction,
  Wallet,
} from '@/lib/types';

export interface AppDataState {
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  supabaseReady: boolean;
  authUserId: string | null;
  authEmail: string | null;
  syncStatus: SyncResult | null;
  syncing: boolean;
  needsOnboarding: boolean;
  profile: Profile | null;
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  recurringBills: RecurringBill[];
  debts: Debt[];
  goals: Goal[];
  invoices: Invoice[];
}

const LOCAL_GUEST_USER_ID = '00000000-0000-4000-8000-000000000000';

export function useFinanceStore() {
  const [state, setState] = useState<AppDataState>({
    loading: true,
    error: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    supabaseReady: isSupabaseConfigured(),
    authUserId: null,
    authEmail: null,
    syncStatus: null,
    syncing: false,
    needsOnboarding: false,
    profile: null,
    wallets: [],
    categories: [],
    transactions: [],
    recurringBills: [],
    debts: [],
    goals: [],
    invoices: [],
  });

  const loadLocalData = useCallback(async () => {
    try {
      const [
        profiles,
        wallets,
        categories,
        transactions,
        recurringBills,
        debts,
        goals,
        invoices,
      ] = await Promise.all([
        getAllLocalRecords('profiles'),
        getAllLocalRecords('wallets'),
        getAllLocalRecords('categories'),
        getAllLocalRecords('transactions'),
        getAllLocalRecords('recurring_bills'),
        getAllLocalRecords('debts'),
        getAllLocalRecords('goals'),
        getAllLocalRecords('invoices'),
      ]);

      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        needsOnboarding: profiles.length === 0,
        profile: profiles[0] ?? null,
        wallets,
        categories,
        transactions,
        recurringBills,
        debts,
        goals,
        invoices,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Gagal memuat data lokal perangkat.',
      }));
    }
  }, []);

  const triggerSync = useCallback(async () => {
    setState((prev) => ({ ...prev, syncing: true }));
    const result = await syncWithSupabase();
    setState((prev) => ({ ...prev, syncing: false, syncStatus: result }));
    if (result.pulledCount > 0) {
      await loadLocalData();
    }
    return result;
  }, [loadLocalData]);

  useEffect(() => {
    // Daftarkan Service Worker PWA untuk dukungan offline penuh
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Abaikan jika gagal di mode dev / browser tanpa SW
      });
    }

    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      void triggerSync();
    };
    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const supabase = getSupabaseClient();
    let unsubscribe: (() => void) | undefined;

    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        setState((prev) => ({
          ...prev,
          authUserId: data.user?.id ?? null,
          authEmail: data.user?.email ?? null,
        }));
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setState((prev) => ({
          ...prev,
          authUserId: session?.user?.id ?? null,
          authEmail: session?.user?.email ?? null,
        }));
        if (session?.user) {
          void triggerSync();
        }
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    }

    void loadLocalData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubscribe) unsubscribe();
    };
  }, [loadLocalData, triggerSync]);

  const activeUserId = state.authUserId ?? LOCAL_GUEST_USER_ID;

  // Onboarding: pilih profil pertama kali + buat dompet & kategori default
  const completeOnboarding = useCallback(
    async (profileType: ProfileType, periodStartDay: number, mandatoryLivingCost: number) => {
      const profile = createDefaultProfile(activeUserId, profileType);
      profile.period_start_day = periodStartDay;
      profile.mandatory_living_cost = Math.max(0, Math.round(mandatoryLivingCost));

      const wallets = createDefaultWallets(activeUserId);
      const categories = createDefaultCategories(activeUserId);

      await upsertLocalRecord('profiles', profile);
      for (const w of wallets) {
        await upsertLocalRecord('wallets', w);
      }
      for (const c of categories) {
        await upsertLocalRecord('categories', c);
      }

      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [activeUserId, loadLocalData, triggerSync]
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!state.profile) return;
      const updated: Profile = {
        ...state.profile,
        ...patch,
        updated_at: nowIso(),
      };
      await upsertLocalRecord('profiles', updated);
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [state.profile, loadLocalData, triggerSync]
  );

  const addTransaction = useCallback(
    async (input: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const now = nowIso();
      const record: Transaction = {
        ...input,
        id: generateUUID(),
        user_id: activeUserId,
        amount: Math.round(input.amount),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await upsertLocalRecord('transactions', record);
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
      return record;
    },
    [activeUserId, loadLocalData, triggerSync]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await softDeleteLocalRecord('transactions', id);
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [loadLocalData, triggerSync]
  );

  const addWallet = useCallback(
    async (name: string, type: Wallet['type'], initialBalance: number) => {
      const now = nowIso();
      const record: Wallet = {
        id: generateUUID(),
        user_id: activeUserId,
        name: name.trim(),
        type,
        initial_balance: Math.round(initialBalance),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await upsertLocalRecord('wallets', record);
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [activeUserId, loadLocalData, triggerSync]
  );

  const saveCategory = useCallback(
    async (cat: Omit<Category, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> & { id?: string }) => {
      const now = nowIso();
      const existing = cat.id ? state.categories.find((c) => c.id === cat.id) : undefined;
      const record: Category = {
        id: existing?.id ?? generateUUID(),
        user_id: activeUserId,
        name: cat.name.trim(),
        icon: cat.icon,
        priority: cat.priority,
        monthly_budget: Math.max(0, Math.round(cat.monthly_budget)),
        is_job_search: cat.is_job_search,
        created_at: existing?.created_at ?? now,
        updated_at: now,
        deleted_at: null,
      };
      await upsertLocalRecord('categories', record);
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [activeUserId, state.categories, loadLocalData, triggerSync]
  );

  const addRecurringBill = useCallback(
    async (input: Omit<RecurringBill, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const now = nowIso();
      await upsertLocalRecord('recurring_bills', {
        ...input,
        id: generateUUID(),
        user_id: activeUserId,
        amount: Math.round(input.amount),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [activeUserId, loadLocalData, triggerSync]
  );

  const deleteRecurringBill = useCallback(
    async (id: string) => {
      await softDeleteLocalRecord('recurring_bills', id);
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [loadLocalData, triggerSync]
  );

  const addDebt = useCallback(
    async (input: Omit<Debt, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const now = nowIso();
      await upsertLocalRecord('debts', {
        ...input,
        id: generateUUID(),
        user_id: activeUserId,
        amount: Math.round(input.amount),
        paid_amount: Math.round(input.paid_amount),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [activeUserId, loadLocalData, triggerSync]
  );

  const payDebtPartial = useCallback(
    async (debtId: string, payAmount: number) => {
      const target = state.debts.find((d) => d.id === debtId);
      if (!target) return;
      const newPaid = Math.min(target.amount, target.paid_amount + Math.max(0, Math.round(payAmount)));
      const newStatus: Debt['status'] =
        newPaid >= target.amount ? 'lunas' : newPaid > 0 ? 'sebagian' : 'belum_lunas';
      await upsertLocalRecord('debts', {
        ...target,
        paid_amount: newPaid,
        status: newStatus,
        updated_at: nowIso(),
      });
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [state.debts, loadLocalData, triggerSync]
  );

  const addGoal = useCallback(
    async (input: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const now = nowIso();
      await upsertLocalRecord('goals', {
        ...input,
        id: generateUUID(),
        user_id: activeUserId,
        target_amount: Math.round(input.target_amount),
        collected_amount: Math.round(input.collected_amount),
        monthly_saving_plan: Math.round(input.monthly_saving_plan),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [activeUserId, loadLocalData, triggerSync]
  );

  const addGoalProgress = useCallback(
    async (goalId: string, addAmount: number) => {
      const target = state.goals.find((g) => g.id === goalId);
      if (!target) return;
      await upsertLocalRecord('goals', {
        ...target,
        collected_amount: target.collected_amount + Math.max(0, Math.round(addAmount)),
        updated_at: nowIso(),
      });
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [state.goals, loadLocalData, triggerSync]
  );

  const addInvoice = useCallback(
    async (input: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const now = nowIso();
      await upsertLocalRecord('invoices', {
        ...input,
        id: generateUUID(),
        user_id: activeUserId,
        amount: Math.round(input.amount),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [activeUserId, loadLocalData, triggerSync]
  );

  const markInvoicePaid = useCallback(
    async (invoiceId: string) => {
      const target = state.invoices.find((i) => i.id === invoiceId);
      if (!target) return;
      await upsertLocalRecord('invoices', {
        ...target,
        status: 'paid',
        updated_at: nowIso(),
      });
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [state.invoices, loadLocalData, triggerSync]
  );

  const exportSnapshot = useCallback(async () => {
    return readFullLocalSnapshot();
  }, []);

  const importSnapshot = useCallback(
    async (backup: AppBackup) => {
      await replaceFullLocalSnapshot(backup, true);
      await loadLocalData();
      if (navigator.onLine) void triggerSync();
    },
    [loadLocalData, triggerSync]
  );

  return {
    state,
    actions: {
      completeOnboarding,
      updateProfile,
      addTransaction,
      deleteTransaction,
      addWallet,
      saveCategory,
      addRecurringBill,
      deleteRecurringBill,
      addDebt,
      payDebtPartial,
      addGoal,
      addGoalProgress,
      addInvoice,
      markInvoicePaid,
      triggerSync,
      exportSnapshot,
      importSnapshot,
    },
  };
}
