
import { BackupSnapshot, AppSettings } from '../types';
import { getSettings, saveSettings } from './sheetService';

const BACKUP_KEY = 'finance_system_backups';

// List of all keys that store critical data in LocalStorage
const CRITICAL_KEYS = [
    'finance_projects',
    'finance_transactions',
    'finance_employees',
    'finance_partners',
    'finance_settings',
    'sys_module_config',
    'sys_field_config',
    'sys_global_config',
    'sys_roles',
    'finance_contracts',
    'finance_timesheets',
    'finance_payroll_runs',
    'finance_payslips',
    'finance_salary_types',
    'finance_price_records',
    'finance_material_categories'
];

export const getBackups = (): BackupSnapshot[] => {
    try {
        const s = localStorage.getItem(BACKUP_KEY);
        return s ? JSON.parse(s) : [];
    } catch (e) {
        return [];
    }
};

export const createSnapshot = (description: string = 'Manual Backup'): BackupSnapshot => {
    const settings = getSettings();
    const currentVersion = settings.appVersionName || 'v1.0.0';
    
    // Gather Data Safely
    const dataPayload: Record<string, any> = {};
    CRITICAL_KEYS.forEach(key => {
        try {
            const val = localStorage.getItem(key);
            if (val) {
                // Try parsing JSON, if fail keep as string or ignore
                try {
                    dataPayload[key] = JSON.parse(val);
                } catch {
                    dataPayload[key] = val;
                }
            }
        } catch (e) {
            console.warn(`Skipping key ${key} during backup due to error`);
        }
    });

    const snapshot: BackupSnapshot = {
        id: `bk_${Date.now()}`,
        versionName: currentVersion,
        timestamp: new Date().toISOString(),
        data: dataPayload,
        sizeBytes: JSON.stringify(dataPayload).length,
        description
    };

    // Save to LocalStorage (Limit to last 5 snapshots to avoid quota limit)
    try {
        const backups = getBackups();
        const updatedBackups = [snapshot, ...backups].slice(0, 5); 
        localStorage.setItem(BACKUP_KEY, JSON.stringify(updatedBackups));
    
        // Update settings last backup
        saveSettings({ ...settings, lastBackupAt: snapshot.timestamp });
    } catch (e) {
        console.error("Backup failed (likely storage full)", e);
    }

    return snapshot;
};

export const restoreSnapshot = (snapshotId: string) => {
    const backups = getBackups();
    const snapshot = backups.find(b => b.id === snapshotId);
    if (!snapshot) throw new Error("Backup not found!");

    restoreData(snapshot.data);
};

export const restoreData = (data: Record<string, any>) => {
    Object.keys(data).forEach(key => {
        try {
            if (typeof data[key] === 'object') {
                localStorage.setItem(key, JSON.stringify(data[key]));
            } else {
                localStorage.setItem(key, data[key]);
            }
        } catch (e) {
            console.error(`Failed to restore key ${key}`, e);
        }
    });
    // Reload to apply changes
    window.location.reload();
};

export const exportBackupToFile = () => {
    const snapshot = createSnapshot('Exported File');
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FinancePro_Backup_${snapshot.versionName}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const importBackupFromFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const snapshot: BackupSnapshot = JSON.parse(content);
                
                if (!snapshot.data) throw new Error("Invalid backup file format");
                
                restoreData(snapshot.data);
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
};

export const deleteSnapshot = (id: string) => {
    const backups = getBackups().filter(b => b.id !== id);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
};
