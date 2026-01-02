
import { TaxKpiTarget, FeatureConfig, FieldConfig, CashAccount, AccountOwner, AccountType, Project, ProjectType, ProjectLevel, Partner, PartnerType, CategoryMaster, CategoryType, TransactionScope, MaterialMaster, Contract, ContractType, ContractStatus, PriceRecord, DataSource, DocumentType, Transaction, TransactionType, TransactionStatus, AmountVatMode, SystemRole, Material, SalaryTemplate, KpiConfig, Timesheet, Office, OfficeType, Asset, AssetType, AssetStatus, InventoryItem, Employee } from './types';

export const APP_CURRENT_VERSION = 8; 

// --- 1. CONFIG & ROLES (KEEP SYSTEM DATA) ---
export const INITIAL_KPI_CONFIGS: KpiConfig[] = [
    { code: 'SALES_MEMBER', name: 'Nhân viên Kinh doanh', standardTarget: 500000000, advancedTarget: 800000000, level1Percent: 1.0, level2Percent: 1.5, level3Percent: 2.5 },
    { code: 'SALES_LEADER', name: 'Trưởng nhóm', standardTarget: 2000000000, advancedTarget: 3500000000, level1Percent: 0.5, level2Percent: 0.8, level3Percent: 1.2 },
    { code: 'SALES_DIRECTOR', name: 'Giám đốc Kinh doanh', standardTarget: 5000000000, advancedTarget: 8000000000, level1Percent: 0.2, level2Percent: 0.4, level3Percent: 0.6 }
];

export const INITIAL_SALARY_TEMPLATES: SalaryTemplate[] = [
    {
        id: 'tpl_office_basic', name: 'Mẫu lương Văn Phòng', appliedPositions: ['Nhân viên', 'Kế toán', 'Hành chính'], status: 'ACTIVE',
        components: [
            { id: 'c1', code: 'LUONG_CB', name: 'Lương Thời Gian', type: 'LUONG', nature: 'THU_NHAP', isTaxable: true, formula: '({base_salary} / 26) * {actual_work_days}', status: 'ACTIVE' },
            { id: 'c2', code: 'PHU_CAP', name: 'Phụ cấp', type: 'LUONG', nature: 'THU_NHAP', isTaxable: true, formula: '{fixed_allowance}', status: 'ACTIVE' },
            { id: 'c_lunch', code: 'PC_AN_TRUA', name: 'Phụ cấp Ăn trưa', type: 'LUONG', nature: 'THU_NHAP', isTaxable: false, formula: '30000 * {actual_work_days}', status: 'ACTIVE' },
            { id: 'c_ot', code: 'LUONG_OT', name: 'Lương làm thêm', type: 'LUONG', nature: 'THU_NHAP', isTaxable: true, formula: '({base_salary} / 26 / 8) * 1.5 * {ot_hours}', status: 'ACTIVE' },
            { id: 'c_kpi', code: 'HOA_HONG', name: 'Hoa hồng KPI', type: 'LUONG', nature: 'THU_NHAP', isTaxable: true, formula: '{kpi_money}', status: 'ACTIVE' },
            { id: 'c_leave', code: 'LUONG_PHEP', name: 'Lương phép dư', type: 'LUONG', nature: 'THU_NHAP', isTaxable: true, formula: '({base_salary} / 26) * {unused_leave}', status: 'ACTIVE' },
            { id: 'c3', code: 'BHXH_NV', name: 'Khấu trừ BHXH', type: 'KHAU_TRU', nature: 'KHAU_TRU', isTaxable: false, formula: '{insurance_salary} * 0.105', status: 'ACTIVE' },
            { id: 'c_final', code: 'THUC_LINH', name: 'Thực Lĩnh', type: 'KHAC', nature: 'KHAC', isTaxable: false, formula: '{LUONG_CB} + {PHU_CAP} + {PC_AN_TRUA} + {LUONG_OT} + {HOA_HONG} + {LUONG_PHEP} - {BHXH_NV}', status: 'ACTIVE' }
        ]
    },
    {
        id: 'tpl_worker_daily', name: 'Mẫu lương Công nhật', appliedPositions: ['Công nhân', 'Thợ'], status: 'ACTIVE',
        components: [
            { id: 'w1', code: 'LUONG_CONG', name: 'Lương Công Nhật', type: 'LUONG', nature: 'THU_NHAP', isTaxable: true, formula: '{base_salary} * {actual_work_days}', status: 'ACTIVE' },
            { id: 'w_final', code: 'THUC_LINH', name: 'Thực Lĩnh', type: 'KHAC', nature: 'KHAC', isTaxable: false, formula: '{LUONG_CONG}', status: 'ACTIVE' }
        ]
    }
];

// export const INITIAL_SYSTEM_ROLES: SystemRole[] = [
//   { id: 'role_admin', code: 'ADMIN', name: 'Quản trị viên', isSystem: true, permissions: ['SYS_ADMIN'] },
//   { id: 'role_manager', code: 'MANAGER', name: 'Quản lý Dự án', permissions: ['PROJECT_VIEW_OWN', 'TRANS_CREATE', 'HR_VIEW_ALL'] },
//   { id: 'role_accountant', code: 'KT_VIEN', name: 'Kế toán viên', permissions: ['TRANS_CREATE', 'TRANS_APPROVE', 'HR_MANAGE', 'OFFICE_VIEW'] },
//   { id: 'role_staff', code: 'STAFF', name: 'Nhân viên', permissions: ['SALARY_VIEW_SELF'] }
// ];

export const DEFAULT_KPI_TARGETS: TaxKpiTarget = { targetVatInputRatio: 60, targetLaborRatio: 30, targetMaterialRatio: 50 };
export const DEFAULT_FEATURES: FeatureConfig[] = [{ key: 'AI_RECEIPT_SCAN', label: 'AI Scan Hóa Đơn', enabled: true, description: 'Tự động bóc tách hóa đơn bằng AI' }];
export const INITIAL_FIELD_CONFIGS: FieldConfig[] = [];

export const AVAILABLE_PERMISSIONS = [
    { code: 'SYS_ADMIN', label: 'Quản trị hệ thống (Full)', group: 'Hệ thống' },
    { code: 'SYS_CONFIG_EDIT', label: 'Cấu hình hệ thống', group: 'Hệ thống' },
    { code: 'PROJECT_VIEW_ALL', label: 'Xem tất cả dự án', group: 'Dự án' },
    { code: 'PROJECT_VIEW_OWN', label: 'Xem dự án được giao', group: 'Dự án' },
    { code: 'PROJECT_CREATE', label: 'Tạo dự án mới', group: 'Dự án' },
    { code: 'PROJECT_EDIT', label: 'Chỉnh sửa dự án', group: 'Dự án' },
    { code: 'TRANS_CREATE', label: 'Tạo phiếu thu/chi', group: 'Thu Chi' },
    { code: 'TRANS_APPROVE', label: 'Duyệt phiếu', group: 'Thu Chi' },
    { code: 'TRANS_PAY', label: 'Xác nhận thanh toán', group: 'Thu Chi' },
    { code: 'TRANS_VIEW_ALL', label: 'Xem tất cả phiếu', group: 'Thu Chi' },
    { code: 'HR_VIEW_ALL', label: 'Xem danh sách nhân sự', group: 'Nhân sự' },
    { code: 'HR_MANAGE', label: 'Quản lý nhân sự (Sửa/Xóa)', group: 'Nhân sự' },
    { code: 'SALARY_VIEW_SELF', label: 'Xem lương cá nhân', group: 'Nhân sự' },
    { code: 'SALARY_MANAGE', label: 'Tính & Duyệt lương', group: 'Nhân sự' },
    { code: 'EMPLOYEE_MANAGE', label: 'Quản lý hồ sơ nhân viên', group: 'Nhân sự' },
    // NEW PERMISSIONS FOR OFFICE & ASSETS
    { code: 'OFFICE_VIEW', label: 'Xem danh sách Văn phòng/Kho', group: 'Hành chính' },
    { code: 'OFFICE_MANAGE', label: 'Quản lý Văn phòng & Tài sản', group: 'Hành chính' }
];

// --- 2. DATA (CLEANED FOR PRODUCTION) ---

export const INITIAL_CASH_ACCOUNTS: CashAccount[] = [
  { id: 'acc_default', bankName: 'TIỀN MẶT', accountName: 'Quỹ tiền mặt', status: 'ACTIVE', owner: AccountOwner.COMPANY, type: AccountType.CASH }
];

export const INITIAL_PARTNERS: Partner[] = [];
export const INITIAL_PROJECTS: Project[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_CONTRACTS: Contract[] = [];

export const INITIAL_CATEGORY_MASTER: CategoryMaster[] = [
    { id: 'cat_mat_1', code: 'MAT-RAW', name: 'Vật liệu xây thô', type: CategoryType.MATERIAL },
    { id: 'cat_mat_2', code: 'MAT-FIN', name: 'Vật liệu hoàn thiện', type: CategoryType.MATERIAL },
    { id: 'cat_mat_3', code: 'MAT-ELC', name: 'Điện nước & ME', type: CategoryType.MATERIAL },
    { id: 'cat_lab_1', code: 'LAB-MAIN', name: 'Nhân công chính', type: CategoryType.LABOR }
];
export const INITIAL_MATERIAL_MASTER: MaterialMaster[] = [];
export const INITIAL_PRICE_RECORDS: PriceRecord[] = [];
export const INITIAL_MATERIALS: Material[] = []; 
export const EXPENSE_CATEGORIES_BY_SCOPE: Record<TransactionScope, string[]> = { [TransactionScope.PROJECT]: [], [TransactionScope.COMPANY_FIXED]: [], [TransactionScope.MARKETING]: [], [TransactionScope.COMMERCIAL]: [], [TransactionScope.OTHER]: [] };
export const INCOME_CATEGORIES: string[] = [];

// Empty Timesheets and KPI
export const INITIAL_TIMESHEETS: Timesheet[] = [];
export const INITIAL_KPI_RECORDS: any[] = [];

// NEW: INITIAL OFFICES
export const INITIAL_OFFICES: Office[] = [
    { 
        id: 'office_main', 
        code: 'VP-HCM', 
        name: 'Văn phòng Chính (HCM)', 
        type: OfficeType.OFFICE, 
        status: 'ACTIVE', 
        createdAt: new Date().toISOString(), 
        isCostCenter: true, 
        address: 'Tòa nhà Bitexco, Q1'
    }
];

// NEW: INITIAL ASSETS & INVENTORY (MOCK DATA)
export const INITIAL_ASSETS: Asset[] = [
    {
        id: 'asset_01', code: 'LAP-001', name: 'Laptop Dell XPS 15', type: AssetType.DEVICE,
        officeId: 'office_main', holderId: 'emp_owner', value: 35000000, purchaseDate: '2023-01-15',
        depreciationMonths: 36, status: AssetStatus.ACTIVE, description: 'Máy cấp cho Giám đốc'
    },
    {
        id: 'asset_02', code: 'CAR-001', name: 'Xe bán tải Ford Ranger', type: AssetType.VEHICLE,
        officeId: 'office_main', value: 850000000, purchaseDate: '2022-06-20',
        depreciationMonths: 120, status: AssetStatus.ACTIVE
    }
];

export const INITIAL_INVENTORY: InventoryItem[] = [];

export const GEMINI_API_KEY = 'AIzaSyBBgth-NCxKrggnbzgD1kWGFGvJYmayNc4'
