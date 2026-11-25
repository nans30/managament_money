import { z } from 'zod';

/**
 * Semua nominal uang disimpan dan diproses sebagai bilangan bulat Rupiah (integer).
 * Tidak ada float untuk uang!
 */
export const RupiahIntSchema = z.number().int().nonnegative();
export const PositiveRupiahIntSchema = z.number().int().positive();

export const ProfileTypeSchema = z.enum(['fixed', 'freelance', 'daily']);
export type ProfileType = z.infer<typeof ProfileTypeSchema>;

export const WalletTypeSchema = z.enum([
  'cash',
  'bank',
  'gopay',
  'ovo',
  'dana',
  'shopeepay',
  'custom',
]);
export type WalletType = z.infer<typeof WalletTypeSchema>;

export const CategoryPrioritySchema = z.enum(['wajib', 'penting', 'bisa_ditunda']);
export type CategoryPriority = z.infer<typeof CategoryPrioritySchema>;

export const TransactionTypeSchema = z.enum(['income', 'expense', 'transfer']);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const NeedOrWantSchema = z.enum(['perlu', 'pengen']);
export type NeedOrWant = z.infer<typeof NeedOrWantSchema>;

export const IncomeNatureSchema = z.enum(['kerja', 'non_kerja']);
export type IncomeNature = z.infer<typeof IncomeNatureSchema>;

export const AllocationRuleSchema = z.object({
  label: z.string().min(1),
  percentage: z.number().int().min(0).max(100),
});
export type AllocationRule = z.infer<typeof AllocationRuleSchema>;

export const BaseRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

export const ProfileSchema = BaseRecordSchema.extend({
  profile_type: ProfileTypeSchema,
  period_start_day: z.number().int().min(1).max(31),
  mandatory_living_cost: RupiahIntSchema,
  self_salary_amount: RupiahIntSchema,
  allocation_rules: z.array(AllocationRuleSchema),
  emergency_mode: z.boolean(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const WalletSchema = BaseRecordSchema.extend({
  name: z.string().min(1),
  type: WalletTypeSchema,
  initial_balance: z.number().int(),
});
export type Wallet = z.infer<typeof WalletSchema>;

export const CategorySchema = BaseRecordSchema.extend({
  name: z.string().min(1),
  icon: z.string().min(1),
  priority: CategoryPrioritySchema,
  monthly_budget: RupiahIntSchema,
  is_job_search: z.boolean(),
});
export type Category = z.infer<typeof CategorySchema>;

export const TransactionSchema = BaseRecordSchema.extend({
  type: TransactionTypeSchema,
  amount: PositiveRupiahIntSchema,
  wallet_id: z.string().uuid(),
  to_wallet_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  source_or_client: z.string().nullable(),
  need_or_want: NeedOrWantSchema.nullable(),
  work_hours: z.number().positive().nullable(),
  income_nature: IncomeNatureSchema,
  is_job_search_expense: z.boolean(),
  note: z.string(),
  date: z.string(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const RecurringBillSchema = BaseRecordSchema.extend({
  name: z.string().min(1),
  amount: PositiveRupiahIntSchema,
  schedule: z.enum(['weekly', 'monthly', 'yearly']),
  next_due_date: z.string(),
  current_installment: z.number().int().min(1),
  total_installments: z.number().int().min(1).nullable(),
});
export type RecurringBill = z.infer<typeof RecurringBillSchema>;

export const DebtCategorySchema = z.enum(['warung', 'teman', 'keluarga', 'lainnya']);
export type DebtCategory = z.infer<typeof DebtCategorySchema>;

export const DebtSchema = BaseRecordSchema.extend({
  direction: z.enum(['utang', 'piutang']),
  counterparty: z.string().min(1),
  category: DebtCategorySchema,
  amount: PositiveRupiahIntSchema,
  paid_amount: RupiahIntSchema,
  due_date: z.string().nullable(),
  status: z.enum(['belum_lunas', 'sebagian', 'lunas']),
  note: z.string(),
});
export type Debt = z.infer<typeof DebtSchema>;

export const GoalSchema = BaseRecordSchema.extend({
  name: z.string().min(1),
  target_amount: PositiveRupiahIntSchema,
  collected_amount: RupiahIntSchema,
  type: z.enum(['tabungan', 'dana_darurat']),
  monthly_saving_plan: RupiahIntSchema,
});
export type Goal = z.infer<typeof GoalSchema>;

export const InvoiceSchema = BaseRecordSchema.extend({
  client_name: z.string().min(1),
  amount: PositiveRupiahIntSchema,
  issued_date: z.string(),
  due_date: z.string(),
  status: z.enum(['unpaid', 'paid', 'overdue']),
  note: z.string(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const AppBackupSchema = z.object({
  version: z.literal(1),
  exported_at: z.string(),
  profiles: z.array(ProfileSchema),
  wallets: z.array(WalletSchema),
  categories: z.array(CategorySchema),
  transactions: z.array(TransactionSchema),
  recurring_bills: z.array(RecurringBillSchema),
  debts: z.array(DebtSchema),
  goals: z.array(GoalSchema),
  invoices: z.array(InvoiceSchema),
});
export type AppBackup = z.infer<typeof AppBackupSchema>;
