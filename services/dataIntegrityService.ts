
import { Project, Transaction, Partner, Employee } from '../types';
import { fetchAllData } from './sheetService';
import { fetchPartners } from './masterDataService';
import { getEmployees } from './employeeService';

export interface IntegrityIssue {
    id: string;
    entity: string;
    entityId: string;
    issueType: 'ORPHAN' | 'INVALID_DATA' | 'MISSING_FIELD';
    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    canAutoFix: boolean;
}

export const checkSystemIntegrity = async (): Promise<IntegrityIssue[]> => {
    const issues: IntegrityIssue[] = [];
    
    // 1. Load All Data
    const { projects, transactions } = await fetchAllData();
    const partners = await fetchPartners();
    const employees = await getEmployees();

    const projectIds = new Set(projects.map(p => p.id));
    const partnerIds = new Set(partners.map(p => p.id));
    const employeeIds = new Set(employees.map(e => e.id));

    // 2. Check Transactions
    transactions.forEach(t => {
        // Check Project FK
        if (t.scope === 'PROJECT' && t.projectId && !projectIds.has(t.projectId)) {
            issues.push({
                id: `iss_t_prj_${t.id}`,
                entity: 'TRANSACTION',
                entityId: t.id,
                issueType: 'ORPHAN',
                message: `Giao dịch "${t.description}" thuộc về Dự án không tồn tại (ID: ${t.projectId})`,
                severity: 'HIGH',
                canAutoFix: true // Fix by moving to 'General' or clearing projectId
            });
        }

        // Check Partner FK
        if (t.partnerId && !partnerIds.has(t.partnerId) && !employeeIds.has(t.partnerId)) {
             issues.push({
                id: `iss_t_pt_${t.id}`,
                entity: 'TRANSACTION',
                entityId: t.id,
                issueType: 'ORPHAN',
                message: `Giao dịch "${t.description}" liên kết với Đối tác/NV không tồn tại (ID: ${t.partnerId})`,
                severity: 'MEDIUM',
                canAutoFix: true // Fix by clearing partnerId
            });
        }

        // Check Amounts
        if (isNaN(t.amount)) {
            issues.push({
                id: `iss_t_amt_${t.id}`,
                entity: 'TRANSACTION',
                entityId: t.id,
                issueType: 'INVALID_DATA',
                message: `Giao dịch "${t.description}" có số tiền không hợp lệ`,
                severity: 'HIGH',
                canAutoFix: false
            });
        }
    });

    // 3. Check Projects
    projects.forEach(p => {
        if (p.customerId && !partnerIds.has(p.customerId)) {
             issues.push({
                id: `iss_p_cust_${p.id}`,
                entity: 'PROJECT',
                entityId: p.id,
                issueType: 'ORPHAN',
                message: `Dự án "${p.name}" liên kết Khách hàng không tồn tại`,
                severity: 'MEDIUM',
                canAutoFix: true
            });
        }
    });

    return issues;
};

export const generateMigrationPackage = async () => {
    const { projects, transactions } = await fetchAllData();
    const partners = await fetchPartners();
    const employees = await getEmployees();
    
    // Format for Backend Import
    const payload = {
        meta: {
            exportedAt: new Date().toISOString(),
            version: '1.0',
            source: 'FINANCE_PRO_CLIENT_MIGRATION'
        },
        data: {
            employees,
            partners,
            projects,
            transactions
        }
    };
    
    return payload;
};
