export type MemberStatus = "active" | "frozen";

export interface SubAccount {
  id: string;
  type: string;
  initialDeposit: number;
  openedAt: number;
}

export interface Member {
  id: string;
  name: string;
  status: MemberStatus;
  savingsBalance: number;
  subAccounts: SubAccount[];
}

// Deterministic fixtures used by both discovery and replay demos, including
// the runtime conditions Section 1 calls out: not-found, permission-denied,
// slow load, and a frozen account that fails validation on sub-account open.
export const members: Record<string, Member> = {
  "12345": {
    id: "12345",
    name: "Jane Doe",
    status: "active",
    savingsBalance: 4200.55,
    subAccounts: [],
  },
  "67890": {
    id: "67890",
    name: "John Smith",
    status: "active",
    savingsBalance: 150.0,
    subAccounts: [],
  },
  "40404": {
    id: "40404",
    name: "Frozen Member",
    status: "frozen",
    savingsBalance: 900.0,
    subAccounts: [],
  },
  "55555": {
    id: "55555",
    name: "Delayed Response Member",
    status: "active",
    savingsBalance: 75.2,
    subAccounts: [],
  },
};

export const PERMISSION_DENIED_ID = "99999";
export const SLOW_LOAD_ID = "55555";
export const SLOW_LOAD_MS = 4000;

interface Session {
  operatorId: string;
  requestCount: number;
  createdAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_MAX_REQUESTS = 10;
const SESSION_MAX_AGE_MS = 5 * 60 * 1000;

export function createSession(operatorId: string): string {
  const id = `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  sessions.set(id, { operatorId, requestCount: 0, createdAt: Date.now() });
  return id;
}

export type SessionCheck =
  | { valid: true }
  | { valid: false; reason: "missing" | "expired" };

export function checkAndTouchSession(sessionId: string | undefined): SessionCheck {
  if (!sessionId) return { valid: false, reason: "missing" };
  const session = sessions.get(sessionId);
  if (!session) return { valid: false, reason: "missing" };

  const age = Date.now() - session.createdAt;
  if (age > SESSION_MAX_AGE_MS || session.requestCount >= SESSION_MAX_REQUESTS) {
    sessions.delete(sessionId);
    return { valid: false, reason: "expired" };
  }

  session.requestCount += 1;
  return { valid: true };
}

let subAccountCounter = 1000;
export function nextSubAccountId(): string {
  subAccountCounter += 1;
  return `SA-${subAccountCounter}`;
}
