
import { APP_CURRENT_VERSION } from '../constants';
import { createSnapshot } from './backupService';

const STORAGE_KEYS = {
    VERSION: 'finance_app_version',
    SESSION: 'finance_user_session'
};

// --- MIGRATION SCRIPTS (LOGIC) ---

const migrateToVersion8 = () => {
    console.log("Migrating to Version 8: Safe Clean...");
    try {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
    } catch (e) {
        console.warn("Failed to clear session during migration", e);
    }
}

// --- MAIN RUNNER (SAFE UPGRADE) ---

export const runMigrations = (): boolean => {
    const currentStoredVersionStr = localStorage.getItem(STORAGE_KEYS.VERSION);
    const currentStoredVersion = currentStoredVersionStr ? parseInt(currentStoredVersionStr) : 0;

    // Check if upgrade is needed
    if (currentStoredVersion >= APP_CURRENT_VERSION) {
        return false; // No migration needed
    }

    try {
        console.log(`Upgrading from v${currentStoredVersion} to v${APP_CURRENT_VERSION}`);
        
        // STEP 1: SAFETY FIRST - AUTO BACKUP (Try catch block inside)
        try {
            createSnapshot(`Auto-Backup before Upgrade to v${APP_CURRENT_VERSION}`);
        } catch(e) { console.warn("Backup failed but continuing...", e); }

        // STEP 2: SEQUENTIAL MIGRATIONS
        if (currentStoredVersion < 8) migrateToVersion8();
        
        // STEP 3: UPDATE VERSION
        localStorage.setItem(STORAGE_KEYS.VERSION, APP_CURRENT_VERSION.toString());
        console.log("✅ System upgrade completed successfully.");
        
        // Do NOT trigger reload here to avoid loops. State will be fresh on next organic reload.
        return false;
        
    } catch (error) {
        console.error("❌ UPGRADE FAILED:", error);
        return false;
    }
};
