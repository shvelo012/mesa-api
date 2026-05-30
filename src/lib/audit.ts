import { AuditLog } from "../models/AuditLog";

interface AuditEntry {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
    });
  } catch (err) {
    console.error("[audit] log failed:", err);
  }
}
