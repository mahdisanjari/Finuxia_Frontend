/**
 * The shapes the API returns, written down once. They mirror the backend's `to_primitives()` / `to_document()`
 * (src/<context>/domain/entities.py); when the backend changes a response, change it here and `npm run typecheck` shows
 * every place in src/lib that no longer fits. JavaScript files use them through JSDoc:
 *
 *   // @returns {Promise<import("./types").User>}  (written as a JSDoc block in the .js file)
 */

export type ISODateTime = string;
export type ISODate = string; // "2026-01-31"

/** The signed-in advisor (GET /api/auth/me → { user }). */
export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  subscriptionUntil: ISODateTime | null;
  subscriptionActive: boolean;
  hasAvatar: boolean;
  licensedProvinces: string[];
  quebecSectors: string[];
  companiesRepresented: string[];
  supervisorRequired: boolean;
  supervisorName: string;
  supervisorTitle: string;
  supervisorEmail: string;
  supervisorPhone: string;
  agencyName: string;
  professionalTitle: string;
  businessEmail: string;
  businessPhone: string;
  agentCode: string;
  businessBranchName: string;
  licenceNumbers: string;
  ownershipRelationship: string;
  compensationModel: string;
  additionalCompensationEligible: boolean;
  standingDisclosure: string;
}

export interface SessionResponse {
  user: User;
}

/** A client record. `id` is a string like "c_<hex>" (older records: a number). `version` is the optimistic-lock counter. */
export interface Client {
  id: string | number;
  version: number;
  first: string;
  last: string;
  phone: string;
  email: string;
  telegram: string;
  referredBy: string;
  preferredContact: string;
  job: string;
  dateOfBirth: string;
  instagram: string;
  province: string;
  priority: "High" | "Medium" | "Low" | string;
  color: string;
  joined: ISODate | "";
  followUpDate: ISODate | "";
  nextFollowUp: string;
  lastContact: string;
  lastContactDate: ISODate | "";
  currentStage: string;
  interests: string[];
  stages: Record<string, { status: string; data: Record<string, unknown>; files: unknown[]; date?: string }>;
  meeting: { date: string; time?: string; googleEventId?: string } | null;
  files: unknown[];
  notes: { id: string; text: string; date: ISODate }[];
}

/** What a 409 on a client edit carries: the server's latest copy. */
export interface ClientConflict {
  error: string;
  client: Client;
}

export interface DailyState {
  doneTasks: Record<string, boolean>;
  groups: { id: string; name: string; color: string; memberIds: (string | number)[] }[];
}

export interface Reminder {
  id: number;
  title: string;
  note: string;
  dueDate: ISODate | null;
  dueTime: string | null;
  status: "pending" | "completed";
  clientRef: string | null;
  repeat: "none" | "daily" | "every_other_day" | "weekly" | "monthly";
  seriesId: string | null;
  kind: "reminder" | "followup";
  createdAt: ISODateTime | null;
  completedAt: ISODateTime | null;
}

export interface TicketComment {
  id: number;
  authorName: string;
  isAdmin: boolean;
  message: string;
  createdAt: ISODateTime | null;
}

export interface Ticket {
  id: number;
  type: "bug" | "feature";
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  reporterName: string;
  createdAt: ISODateTime | null;
  updatedAt: ISODateTime | null;
  commentCount: number;
  comments?: TicketComment[];
}

export interface PlanModule {
  key: string;
  name: string;
  description: string;
}

export interface Plan {
  id: number;
  key: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  interval: string;
  isDefault: boolean;
  modules: PlanModule[];
}

export interface PlansResponse {
  plans: Plan[];
  stripeConfigured: boolean;
  purchasesOpen: boolean;
}

/** GET /api/billing/me: which plan the account is on and which modules it unlocks. */
export interface BillingStatus {
  plan: Plan | null;
  status: "active" | "trialing" | "past_due" | "canceled" | string;
  moduleKeys: string[];
  currentPeriodEnd: ISODateTime | null;
  /** A cancellation is pending: access continues until `endsAt`. */
  cancelAtPeriodEnd?: boolean;
  endsAt?: ISODateTime | null;
  canceledAt?: ISODateTime | null;
  /** The cancellation can still be taken back (the paid period has not ended). */
  canReactivate?: boolean;
  /** A downgrade that takes effect at `pendingPlanAt`; until then the current plan stays as it is. */
  pendingPlan?: { key: string; name: string } | null;
  pendingPlanAt?: ISODateTime | null;
}

/** POST /api/billing/plan-change/preview. */
export interface PlanChangePreview {
  kind: "upgrade" | "downgrade";
  effective: "now" | "period_end";
  effectiveAt: ISODateTime | null;
  plan: { id: number; key: string; name: string; priceCents: number; currency: string; interval: string };
  currentPlan: { id: number; key: string; name: string; priceCents: number; currency: string; interval: string };
  /** What an upgrade will invoice (Stripe's figure; negative is a credit); zero for a downgrade. */
  totalCents: number;
  amountDueCents: number;
  currency: string;
  lines: { description: string; amountCents: number; proration: boolean }[];
  /** The instant an upgrade's figure was worked out at: sent back when confirming, so the charge is worked out the same way. */
  prorationDate: number | null;
  billingDate: ISODateTime | null;
  modulesLost: string[];
  modulesGained: string[];
  warnings: string[];
  alreadyScheduled: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  date: ISODateTime | null;
  amountCents: number;
  currency: string;
  status: "paid" | "open" | "draft" | "uncollectible" | "void" | string;
  description: string;
  /** Stripe's page for the invoice, and its PDF; empty when it sent none. */
  hostedUrl: string;
  pdfUrl: string;
}

export interface InvoiceList {
  available: boolean;
  invoices: Invoice[];
}

export interface PurchaseResponse {
  mock?: boolean;
  checkoutUrl?: string;
  subscription?: BillingStatus;
}

/** GET /api/billing/ai-usage: this billing period's AI allowance, in credits (never tokens). */
export interface AiUsage {
  plan: string | null;
  aiIncluded: boolean;
  unlimited: boolean;
  period: { start: ISODateTime; end: ISODateTime; resetsAt: ISODateTime };
  credits: { included: number; extra: number; total: number; used: number; inFlight: number; remaining: number } | null;
  percentUsed: number | null;
  warning: "exhausted" | "critical" | "high" | null;
  byFeature: { feature: string; label: string; calls: number; credits: number }[];
  wallet: { balanceCents: number };
  recentUsage: { feature: string; label: string; costCents: number; credits: number; createdAt: ISODateTime }[];
  restriction: { switchedOff: boolean; switchedOffMessage: string; disabled: boolean; disabledFeatures: string[] };
}

export interface FollowUpRule {
  clientRef: string;
  enabled: boolean;
  frequency: "weekly" | "biweekly" | "monthly";
  tone: "friendly" | "professional" | "reminder";
  lastSentAt: ISODateTime | null;
}

export interface Document {
  id: number;
  title: string;
  summary: string;
  keywords: string[];
  fileName: string;
  uploadedByName: string;
  status: "pending" | "approved" | "rejected";
  rejectionNote: string;
  createdAt: ISODateTime | null;
  reviewedAt: ISODateTime | null;
}

/** The body of an error response. Which fields exist depends on the endpoint; `code` and `actions` come from the AI gateway. */
export interface ErrorBody {
  error?: string;
  detail?: string;
  code?: string;
  actions?: ("top_up" | "upgrade" | "contact_support")[];
  [field: string]: unknown;
}
