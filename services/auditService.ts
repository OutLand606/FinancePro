
import { AuditLog, UserContext } from '../types';

const STORAGE_KEYS = {
  AUDIT_LOGS: 'finance_audit_logs'
};

const getLogs = (): AuditLog[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
  return stored ? JSON.parse(stored) : [];
};

export const logAccess = async (
  user: UserContext,
  action: 'VIEW_DETAIL' | 'CREATE' | 'UPDATE' | 'DELETE',
  entity: 'TRANSACTION' | 'PROJECT' | 'SYSTEM',
  entityId: string,
  details?: string
): Promise<void> => {
  
  // Simulating Encryption/Hashing
  const timestamp = new Date().toISOString();
  const rawString = `${user.id}-${action}-${entityId}-${timestamp}`;
  // Simple hash simulation
  const hash = btoa(rawString).substring(0, 20) + "..."; 

  const newLog: AuditLog = {
    id: `log_${Date.now()}`,
    action,
    entity,
    entityId,
    actorId: user.id,
    actorName: user.name,
    timestamp,
    metadata: details,
    hash
  };

  const logs = getLogs();
  // Append new log (most recent last, or first depending on UI pref. Here append)
  const updatedLogs = [newLog, ...logs]; // Newest first
  
  // Limit to last 1000 logs for localStorage performance
  if (updatedLogs.length > 1000) updatedLogs.length = 1000;

  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(updatedLogs));
  
  // Console log for debug
  console.log(`[SECURE LOG] User ${user.name} performed ${action} on ${entity} ${entityId}. Hash: ${hash}`);
};

export const fetchAuditLogs = async (entityId?: string): Promise<AuditLog[]> => {
    const logs = getLogs();
    if (entityId) {
        return logs.filter(l => l.entityId === entityId);
    }
    return logs;
};
