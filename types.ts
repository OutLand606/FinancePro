
import React from 'react';

/**
 * 🏗️ DATABASE SCHEMA SPECIFICATION (TARGET)
 * ... (Giữ nguyên phần comment cũ)
 */

// --- 1. API CONTRACT & OPENAPI SPECIFICATION ---
// This interface defines the contract between Frontend and Backend.
// Backend must implement these routes returning ApiResponse<Data>.
export interface ApiContract {
    // Core
    '/auth/login': { method: 'POST', body: { email: string }, response: LoginResponse };
    '/projects': { method: 'GET', response: Project[] } | { method: 'POST', body: Project, response: Project };
    '/projects/:id': { method: 'PUT', body: Project, response: Project } | { method: 'DELETE', response: {id: string} };
    '/transactions': { method: 'GET', response: Transaction[] } | { method: 'POST', body: Transaction, response: Transaction };
    // Finance
    '/cash-accounts': { method: 'GET', response: CashAccount[] };
    // Master Data
    '/partners': { method: 'GET', response: Partner[] } | { method: 'POST', body: Partner, response: Partner };
    '/employees': { method: 'GET', response: Employee[] };
    // Office & Assets
    '/offices': { method: 'GET', response: Office[] };
    '/assets': { method: 'GET', response: Asset[] };
    '/inventory': { method: 'GET', response: InventoryItem[] };
}

// --- ERP ARCHITECTURE TYPES ---
export interface ApiResponse<T> {
    data: T;
    success: boolean;
    message?: string;
    timestamp: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
    }
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface LoginResponse {
    user: UserContext;
    tokens: AuthTokens;
}

export interface ApiError {
    code: string;
    message: string;
    details?: any;
}

export interface SheetConfig {
    transactionsUrl?: string;
    kpiUrl?: string;
    purchaseUrl?: string;
    projectUrl?: string;
}

export interface GoogleStorageConfig {
    driveFolderId: string;
    projectSubFolder: boolean;
    officeSubFolder: boolean;
    autoShare: 'VIEW' | 'NONE';
}

export interface AppSettings {
  apiEndpoint: string;
  useMockData: boolean;
  appVersionName?: string;
  lastBackupAt?: string;
  googleSheets?: SheetConfig;
  googleStorage?: GoogleStorageConfig;
  geminiApiKey?: string;
}

// Enum-like string unions or Enums
export enum AccountType { CASH = 'CASH', BANK = 'BANK' }
export enum AccountOwner { COMPANY = 'COMPANY', INDIVIDUAL = 'INDIVIDUAL' }
export enum ProjectType { RETAIL = 'RETAIL', PROJECT = 'PROJECT' }
export enum ProjectLevel { SMALL = 'SMALL', MEDIUM = 'MEDIUM', LARGE = 'LARGE' }
export enum PartnerType { CUSTOMER = 'CUSTOMER', SUPPLIER = 'SUPPLIER', LABOR = 'LABOR', BOTH = 'BOTH' }
export enum CategoryType { MATERIAL = 'MATERIAL', LABOR = 'LABOR', OTHER = 'OTHER' }
export enum TransactionScope { PROJECT = 'PROJECT', COMPANY_FIXED = 'COMPANY_FIXED', COMMERCIAL = 'COMMERCIAL', MARKETING = 'MARKETING', OTHER = 'OTHER' }
export enum ContractType { REVENUE = 'REVENUE', SUPPLIER_MATERIAL = 'SUPPLIER_MATERIAL', LABOR = 'LABOR', SUB_CONTRACT = 'SUB_CONTRACT' }
export enum ContractStatus { DRAFT = 'DRAFT', SIGNED = 'SIGNED', COMPLETED = 'COMPLETED' }
export enum DataSource { FROM_EXPENSE = 'FROM_EXPENSE', FROM_AI = 'FROM_AI' }
export enum DocumentType { INVOICE = 'INVOICE', QUOTATION = 'QUOTATION', BOQ = 'BOQ', OTHER = 'OTHER' }
export enum TransactionType { INCOME = 'INCOME', EXPENSE = 'EXPENSE' }
export enum TransactionStatus { SUBMITTED = 'SUBMITTED', APPROVED = 'APPROVED', PAID = 'PAID', REJECTED = 'REJECTED', DRAFT = 'DRAFT' }
export enum AmountVatMode { INCLUDE = 'INCLUDE', EXCLUDE = 'EXCLUDE' }
export enum ProposalStatus { PENDING = 'PENDING', APPROVED = 'APPROVED', REJECTED = 'REJECTED' }
export enum EstimationStatus { PLANNED = 'PLANNED', PURCHASED = 'PURCHASED' }
export enum FeedbackStatus { PENDING = 'PENDING', CONFIRMED = 'CONFIRMED' }
export enum SubmissionStatus { PENDING = 'PENDING', APPROVED = 'APPROVED', REJECTED = 'REJECTED' }
export enum OfficeType { OFFICE = 'OFFICE', STORE = 'STORE', WAREHOUSE = 'WAREHOUSE' }
export enum InvoiceType { VAT = 'VAT', SALES = 'SALES' }
export enum ProcessingStatus { UPLOADED = 'UPLOADED', ANALYZING = 'ANALYZING', REVIEW_NEEDED = 'REVIEW_NEEDED', COMPLETED = 'COMPLETED', ERROR = 'ERROR' }

// NEW ENUMS FOR ASSETS & INVENTORY
export enum AssetStatus { ACTIVE = 'ACTIVE', MAINTENANCE = 'MAINTENANCE', LIQUIDATED = 'LIQUIDATED', LOST = 'LOST' }
export enum AssetType { DEVICE = 'DEVICE', FURNITURE = 'FURNITURE', VEHICLE = 'VEHICLE', MACHINERY = 'MACHINERY' }
export enum InventoryLogType { IMPORT = 'IMPORT', EXPORT = 'EXPORT', ADJUST = 'ADJUST' }

export interface CashAccount {
    id: string;
    bankName: string;
    accountName: string;
    accountNumber?: string;
    initialBalance?: number; // Số dư đầu kỳ
    status: 'ACTIVE' | 'INACTIVE';
    owner: AccountOwner;
    type: AccountType;
}

export interface UserContext {
    id: string;
    name: string;
    email: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    managedProjectIds: string[];
    isAuthenticated: boolean;
    avatarUrl?: string;
    department?: string; 
}

export interface Attachment {
    id: string;
    name: string;
    type: 'IMAGE' | 'PDF' | 'EXCEL' | 'OTHER';
    url: string; // Local Blob URL (Offline) or Cloud URL
    mimeType?: string;
    size?: number;
    // Drive Backup Fields
    driveFileId?: string;
    driveLink?: string;
    syncStatus?: 'PENDING' | 'SYNCED' | 'ERROR'; // Track cloud backup status
}

export interface ProjectNote {
    id: string;
    content: string;
    author: string;
    date: string;
}

export interface Project {
    id: string;
    code: string;
    name: string;
    type: ProjectType;
    status: 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'CANCELLED';
    customerId?: string;
    customerName: string;
    // CONTACTS
    customerPhone?: string; // SĐT đăng nhập CĐT
    contacts?: ProjectContact[]; // Danh sách liên hệ động

    // Deprecated fields (kept for compatibility during migration if needed
    managerName?: string; 
    managerPhone?: string; 

    contractTotalValue?: number;
    managerEmpId?: string;
    salesEmpIds?: string[];
    laborEmpIds?: string[];
    address?: string;
    startDate?: string;
    endDate?: string;
    createdAt: string;
    operationalNotes?: ProjectNote[];
    documents?: Attachment[];
    projectLevel?: ProjectLevel;
    infoFields?: ProjectInfoField[]; 
    tipQrUrl?: string; 
}

export interface Partner {
    id: string;
    code: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    taxCode?: string;
    representative?: string;
    position?: string;
    bankAccountNumber?: string;
    bankName?: string;
    bankBranch?: string;
    type: PartnerType;
    status: 'ACTIVE' | 'INACTIVE';
    rating?: number;
    providedCategoryIds?: string[];
}

export interface Transaction {
    id: string;
    code?: string;
    date: string;
    type: TransactionType;
    amount: number;
    scope: TransactionScope;
    category: string;
    description: string;
    projectId?: string;
    partnerId?: string;
    employeeId?: string;
    requesterId?: string;
    performedBy: string; // Employee ID
    confirmedBy?: string; // Employee ID
    status: TransactionStatus;
    targetAccountId?: string; // CashAccount ID
    attachments?: Attachment[];
    
    costCenterId?: string;
    costCenterType?: 'PROJECT' | 'OFFICE' | 'STORE';
    paymentMethod?: string;
    
    hasVATInvoice?: boolean;
    vatAmount?: number;
    isMaterialCost?: boolean;
    isLaborCost?: boolean;
    contractId?: string;
    purchaseProposalId?: string;
    
    costGroup?: 'MATERIAL' | 'LABOR' | 'OTHER';
    payerName?: string;
    isPayroll?: boolean;
    transferRemark?: string;
    misaVoucherNo?: string;
    
    createdAt: string;
    confirmedAt?: string;
    rejectionReason?: string;
    syncStatus?: 'PENDING' | 'SYNCED' | 'ERROR';
}

export interface Contract {
    id: string;
    code: string;
    name: string;
    type: ContractType;
    projectId: string;
    partnerId: string;
    value: number;
    signedDate: string;
    status: ContractStatus;
    fileLink?: string;
    note?: string;
    createdAt: string;
}

export interface Employee {
    id: string;
    code: string;
    fullName: string;
    email: string;
    password?: string; // Mật khẩu đăng nhập
    phone?: string;
    roleId: string;
    status: 'ACTIVE' | 'INACTIVE';
    managedProjectIds: string[];
    
    department?: string;
    position?: string;
    
    // HR Details
    dob?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    idNumber?: string;
    personalTaxCode?: string;
    maritalStatus?: 'SINGLE' | 'MARRIED';
    hometown?: string;
    ethnic?: string;
    religion?: string;
    nationality?: string;
    
    joiningDate?: string;
    officialDate?: string;
    
    // Salary
    salaryTemplateId?: string;
    baseSalary?: number;
    evalSalary?: number;
    fixedAllowance?: number;
    insuranceSalary?: number;
    dependents?: number;
    
    // Bank
    bankName?: string;
    bankAccount?: string;
    bankBranch?: string;
    
    // Other
    familyDetails?: string;
    socialInsuranceNumber?: string;
    insuranceStatus?: string;
    vaccineInfo?: string;
    assignedAssets?: string; // Legacy text field, kept for backward compat
    
    kpiRoleCode?: string;
    
    avatarUrl?: string;
    createdAt: string;
}

// --- NEW STRUCTS FOR ASSETS & INVENTORY ---

export interface Asset {
    id: string;
    code: string;
    name: string;
    type: AssetType;
    officeId: string; // Thuộc văn phòng/kho nào
    holderId?: string; // Nhân viên đang giữ (Optional)
    value: number; // Giá trị mua ban đầu
    purchaseDate: string;
    depreciationMonths: number; // Số tháng khấu hao
    status: AssetStatus;
    description?: string;
    imageUrl?: string;
}

export interface InventoryItem {
    id: string;
    officeId: string; // Kho nào
    materialMasterId: string; // Mã vật tư chuẩn
    quantity: number;
    minStock: number;
    lastUpdated: string;
}

export interface InventoryLog {
    id: string;
    officeId: string;
    materialMasterId: string;
    type: InventoryLogType;
    quantity: number;
    date: string;
    performedBy: string;
    refTransactionId?: string; // Liên kết phiếu nhập/xuất
    note?: string;
}

export interface SystemRole {
    id: string;
    code: string;
    name: string;
    permissions: string[];
    isSystem?: boolean;
}

export interface SalaryComponent {
    id: string;
    code: string;
    name: string;
    type: 'LUONG' | 'KHAU_TRU' | 'KHAC';
    nature: 'THU_NHAP' | 'KHAU_TRU' | 'KHAC';
    isTaxable: boolean;
    formula: string;
    value?: number;
    status: 'ACTIVE' | 'INACTIVE';
    isSystem?: boolean;
}

export interface SalaryTemplate {
    id: string;
    name: string;
    description?: string;
    appliedPositions: string[];
    components: SalaryComponent[];
    status: 'ACTIVE' | 'INACTIVE';
}

export interface SalaryType {
    id: string;
    name: string;
}

export interface Timesheet {
    id: string;
    date: string;
    empId: string;
    projectId: string;
    workUnits: number;
    otHours: number;
    note?: string;
    createdAt: string;
}

export interface AttendancePeriod {
    id: string;
    month: string;
    status: 'DRAFT' | 'LOCKED';
    totalWorkDays: number;
    lockedAt?: string;
    snapshots?: Timesheet[];
}

export interface Payslip {
    id: string;
    empId: string;
    empName: string;
    roleName: string;
    baseSalary: number;
    actualWorkDays: number;
    otHours: number;
    kpiMoney: number;
    allowance: number;
    insuranceSalary: number;
    bonus: number;
    deduction: number;
    note?: string;
    grossIncome: number;
    totalDeduction: number;
    netSalary: number;
    details: Record<string, number>;
    templateSnapshot?: SalaryTemplate;
}

export interface PayrollRun {
    id: string;
    month: string;
    status: 'DRAFT' | 'LOCKED' | 'PAID';
    totalAmount: number;
    employeeCount: number;
    slips: Payslip[];
    createdAt: string;
    lockedAt?: string;
    paidAt?: string;
    paymentTransactionId?: string;
}

export interface KpiConfig {
    code: string;
    name: string;
    standardTarget: number;
    advancedTarget: number;
    level1Percent: number;
    level2Percent: number;
    level3Percent: number;
}

export interface KpiRecord {
    id: string;
    month: string;
    empId: string;
    roleCode: string;
    
    snapStandardTarget: number;
    snapAdvancedTarget: number;
    snapLevel1Percent: number;
    snapLevel2Percent: number;
    snapLevel3Percent: number;
    
    actualRevenue: number;
    manualRevenueAdjustment: number;
    
    level1Revenue?: number;
    level2Revenue?: number;
    level3Revenue?: number;
    
    level1Commission?: number;
    level2Commission?: number;
    level3Commission?: number;
    
    totalCommission: number;
    
    status: 'DRAFT' | 'FINALIZED';
    isLocked: boolean;
    updatedAt: string;
}

export interface KpiPeriod {
    id: string;
    month: string;
    status: 'DRAFT' | 'LOCKED';
    totalRevenue: number;
    totalCommission: number;
    lockedAt?: string;
    lockedBy?: string;
    snapshots: KpiRecord[];
}

export interface Material {
    id: string;
    name: string;
}

export interface MaterialMaster {
    id: string;
    code: string;
    name: string;
    unit: string;
    categoryId?: string;
}

export interface CategoryMaster {
    id: string;
    code: string;
    name: string;
    type: CategoryType;
}

export interface PriceRecord {
    id: string;
    materialId: string; // or 'UNKNOWN'
    resolvedName: string;
    partnerId: string;
    price: number;
    unit: string;
    date: string; // YYYY-MM-DD
    dataSource: DataSource;
    refTransactionId?: string;
    trustLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
    createdAt: string;
    sourceType?: DocumentType;
    sourceDocId?: string;
}

export interface MaterialCategory {
    id: string;
    name: string;
}

export interface MaterialEstimation {
    id: string;
    projectId: string;
    rawName: string;
    unit: string;
    estimatedQty: number;
    usedQty: number;
    categoryGroup?: string;
    status: EstimationStatus;
    source: 'BOQ' | 'MANUAL' | 'AI';
    createdAt: string;
    actualRequiredQty?: number;
    discrepancyNote?: string;
    feedbackStatus?: FeedbackStatus;
}

export interface PurchaseProposalItem {
    id: string;
    estimationId?: string;
    materialCode: string;
    rawName: string;
    unit: string;
    qty: number;
    price: number;
    total: number;
}

export interface PurchaseProposal {
    id: string;
    code: string;
    projectId: string;
    supplierId: string;
    title: string;
    items: PurchaseProposalItem[];
    totalAmount: number;
    status: ProposalStatus;
    createdBy: string;
    createdAt: string;
}

export interface DocumentValidation {
    isValid: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    issues: string[];
    detectedType: string;
    confidence: number;
}

export interface ExtractedItem {
    id: string;
    docId: string;
    rawName: string;
    rawUnit: string;
    rawQty: number;
    rawPrice: number;
    mappedMaterialId?: string;
    status: 'PENDING' | 'MAPPED';
    isIgnored: boolean;
}

export interface Document {
    id: string;
    name: string;
    type: DocumentType | string;
    fileUrl: string;
    partnerId?: string;
    uploadedBy: string;
    status: ProcessingStatus;
    createdAt: string;
    aiValidation?: DocumentValidation;
    mimeType?: string;
    isLink?: boolean;
    driveLink?: string;
}

export interface AIKnowledgeBase {
    version: number;
    lastUpdated: string;
    wasteCoefficients: Record<string, number>;
    edgeMaterialKeywords: string[];
}

export interface Office {
    id: string;
    code: string;
    name: string;
    type: OfficeType;
    address?: string;
    managerId?: string;
    defaultCashAccountId?: string;
    description?: string;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: string;
    isCostCenter?: boolean;
}

export interface EmployeeSubmission {
    id: string;
    empId: string;
    month: string;
    workingDays: number;
    revenue: number;
    note?: string;
    status: SubmissionStatus;
    submittedAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
}

export interface EmployeePerformance {
    empId: string;
    totalAdvances: number;
    totalEarned: number;
    activeProjectsCount: number;
    kpiCompletionRate: number;
    recentTransactions: Transaction[];
    involvedProjects: Project[];
}

export interface PartnerPerformance {
    partnerId: string;
    transactionCount: number;
    projectCount: number;
    lastTransactionDate?: string;
    aiScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    strengths: string[];
    weaknesses: string[];
    totalSpent?: number;
    topCategories?: string[];
    priceTrend?: 'STABLE' | 'UP' | 'DOWN';
    totalRevenue?: number;
    totalDebt?: number;
    debtRatio?: number;
    paymentSpeed?: 'FAST' | 'NORMAL' | 'SLOW';
    totalContractValue?: number;
}

export interface TaxKpiTarget {
    targetVatInputRatio: number;
    targetLaborRatio: number;
    targetMaterialRatio: number;
}

export interface FeatureConfig {
    key: string;
    label: string;
    enabled: boolean;
    description?: string;
}

export interface FieldConfig {
    id: string;
    module: string;
    fieldName: string;
    label: string;
    isRequired: boolean;
    isHidden: boolean;
}

export interface GlobalConfig {
    key: string;
    value: string;
}

export interface ModuleConfig {
    key: string;
    label: string;
    enabled: boolean;
    icon?: any;
    component?: any;
    subItems?: ModuleConfig[];
    permission?: string;
    requiredPermission?: string;
}

export interface AppModuleDefinition extends ModuleConfig {
    component: React.FC<GlobalDataProps>;
}

export interface GlobalDataProps {
    transactions: Transaction[];
    projects: Project[];
    partners: Partner[];
    accounts: CashAccount[];
    contracts: Contract[];
    priceRecords: PriceRecord[];
    currentUser: UserContext;
    onAddTransaction: (t: Transaction) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string) => void;
    onAddProject: (p: Project) => void;
    onUpdateProject: (p: Project) => void;
    onAddPartner: (p: Partner) => void; // Added for sync
    onNavigate: (tab: string) => void;
}

export interface AuditLog {
    id: string;
    action: 'VIEW_DETAIL' | 'CREATE' | 'UPDATE' | 'DELETE';
    entity: 'TRANSACTION' | 'PROJECT' | 'SYSTEM';
    entityId: string;
    actorId: string;
    actorName: string;
    timestamp: string;
    metadata?: string;
    hash?: string;
}

export interface BackupSnapshot {
    id: string;
    versionName: string;
    timestamp: string;
    data: any;
    sizeBytes: number;
    description?: string;
}



export enum StageStatus { PENDING = 'PENDING', IN_PROGRESS = 'IN_PROGRESS', COMPLETED = 'COMPLETED', BLOCKED = 'BLOCKED' }
export enum LogType { WORK_REPORT = 'WORK_REPORT', ACCEPTANCE = 'ACCEPTANCE', ISSUE_REPORT = 'ISSUE_REPORT', FEEDBACK = 'FEEDBACK' }



export interface RoadmapTemplate {
    id: string;
    name: string;
    stages: { title: string; description: string; weightPercent?: number }[];
}

export interface RoadmapStage {
    id: string;
    roadmapId: string;
    title: string;
    description: string;
    status: StageStatus;
    order: number;
    weightPercent?: number;
    startDate?: string;
    endDate?: string;
    expectedMaterialDate?: string; // NEW FIELD: Ngày cấp vật tư dự kiến
}


export interface RoadmapLog {
    id: string;
    projectId: string;
    roadmapId: string;
    stageId?: string;
    performerId: string;
    performerName: string;
    performerRole: 'WORKER' | 'MANAGER' | 'CUSTOMER';
    timestamp: string;
    content: string;
    locationTag?: string;
    photos: Attachment[];
    type: LogType;
    isHighlighted: boolean;
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}


export interface CustomerFeedback {
    id: string;
    customerId: string;
    content: string;
    date: string;
    rating?: number;
    attachments?: Attachment[]; // Added attachments support
}


export interface RoadmapAccessLink {
    token: string;
    projectId: string;
    role: 'CUSTOMER' | 'WORKER';
    label: string;
    createdAt: string;
    expiresAt: string;
    isActive: boolean;
}

export interface ProjectRoadmap {
    id: string;
    projectId: string;
    templateName?: string;
    stages: RoadmapStage[];
    logs: RoadmapLog[];
    settings?: {
        showSpecs: boolean;
        allowRating: boolean;
        allowFeedback: boolean;
    };
    feedbacks?: CustomerFeedback[];
    lastUpdated: string;
    overallProgress: number;
    accessLinks?: RoadmapAccessLink[];
}



export interface ProjectInfoField {
    id: string;
    label: string; // Tên trường (VD: "Bản vẽ hoàn công", "Mật khẩu cửa")
    value: string; // Giá trị text
    type: 'TEXT' | 'FILE';
    attachment?: Attachment; // Nếu là File
}


export interface ProjectContact {
    id: string;
    role: string; // VD: "Chỉ huy trưởng", "Tổ đội điện nước", "Kỹ thuật"
    name: string; // VD: "Nguyễn Văn A"
    phone: string; // VD: "0912345678"
    isWorkerLogin: boolean; // Cho phép số này đăng nhập giao diện Thợ
}

export interface CostTarget {
    id: string;
    label: string;
    percent: number; // % trên Doanh thu
    mappingKey: 'MATERIAL' | 'LABOR' | 'MARKETING' | 'OFFICE' | 'OTHER'; // Logic map
    description?: string;
}

export interface CostPlan {
    id: string;
    year: number;
    name: string;
    targetMaterial: number; // Deprecated but kept for backward compact
    targetLabor: number; // Deprecated
    targetOverhead: number; // Deprecated
    targetProfit: number; // Deprecated
    targets?: CostTarget[]; // NEW DYNAMIC TARGETS
}

export interface InvoiceObligation {
    id: string;
    sourceType: 'CONTRACT' | 'ORPHAN_EXPENSE';
    sourceId: string;
    sourceName: string;
    partnerId: string;
    partnerName: string;
    totalObligationAmount: number;
    collectedAmount: number;
    missingAmount: number;
    status: 'FULFILLED' | 'PARTIAL' | 'MISSING';
    linkedTransactionIds: string[];
}

export interface CostSnapshot {
    period: string;
    actualRevenue: number;
    actualMaterial: number;
    actualLabor: number;
    actualOverhead: number;
    ratioMaterial: number;
    ratioLabor: number;
    ratioOverhead: number;
    plan: CostPlan;
    warnings: string[];
}

export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_REVIEW' | 'WAITING' | 'COMPLETED' | 'CANCELLED';
export type TicketPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
export type TicketType = 
    | 'REQUEST_PURCHASE' 
    | 'REQUEST_PAYMENT'  
    | 'REQUEST_BOQ'      
    | 'REQUEST_DOCS'     
    | 'REQUEST_LEAVE'    
    | 'REQUEST_IT'       
    | 'SUGGESTION'       
    | 'OTHER';

export interface TicketStats {
    total: number;
    pending: number;
    urgent: number;
    completedThisMonth: number;
    avgSatisfaction: number;
    myPendingCount: number;
    aiInsight: string;
    
    byDept: { name: string, value: number }[];
    byProject: { name: string, value: number }[];
    slaStatus: { onTime: number, overdue: number };
    avgResolutionHours: number;
    
    lazyEmployees: { name: string, count: number }[];
    workloadByDept: { name: string, value: number }[]; 
}

export interface ManualReminder {
    id: string;
    targetName: string;
    content: string;
    dueDate?: string;
    isDone: boolean;
    createdAt: string;
}

export interface Ticket {
    id: string;
    code: string;
    title: string;
    type: TicketType;
    priority: TicketPriority;
    description: string;
    completionCriteria?: string;
    
    creatorId: string;
    creatorName: string;
    creatorAvatar?: string;
    
    assigneeIds: string[];
    followerIds: string[];
    departmentCode: string;

    // Configurable Approver
    approverId?: string; 
    approverName?: string;

    projectId?: string;
    projectName?: string;
    
    status: TicketStatus;
    createdAt: string;
    updatedAt: string;
    lastActivityAt?: string;
    
    slaDeadline?: string;
    startedAt?: string;
    closedAt?: string;
    firstResponseAt?: string;
    
    // Approval info
    approvedBy?: string;
    approvedAt?: string;

    rating?: number;
    ratingComment?: string;
    
    isRecurring?: boolean;
    recurringType?: 'MONTHLY' | 'WEEKLY';
    
    comments: TicketComment[];
    history?: TicketLog[];
    attachments: Attachment[];
    
    isOverdue?: boolean;
    reminderHistory?: string[];
}

export interface TicketLog {
    id: string;
    action: 'CREATE' | 'UPDATE_STATUS' | 'COMMENT' | 'ASSIGN' | 'AUTO_REMINDER' | 'REJECTED' | 'APPROVED';
    oldValue?: string;
    newValue?: string;
    actorId: string;
    actorName: string;
    timestamp: string;
    details?: string;
}

export interface TicketComment {
    id: string;
    ticketId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    attachments: Attachment[];
    createdAt: string;
    isSystemLog?: boolean; 
}

export interface EmployeeEvaluation {
    empId: string;
    activeTasks: number;
    totalResolved: number;
    avgResolutionHours: number;
    avgRating: number;
    overdueCount: number;
}


export interface Ticket {
    id: string;
    code: string;
    title: string;
    type: TicketType;
    priority: TicketPriority;
    description: string;
    completionCriteria?: string;
    
    creatorId: string;
    creatorName: string;
    creatorAvatar?: string;
    
    assigneeIds: string[];
    followerIds: string[];
    departmentCode: string;

    // Configurable Approver
    approverId?: string; 
    approverName?: string;

    projectId?: string;
    projectName?: string;
    
    status: TicketStatus;
    createdAt: string;
    updatedAt: string;
    lastActivityAt?: string;
    
    slaDeadline?: string;
    startedAt?: string;
    closedAt?: string;
    firstResponseAt?: string;
    
    // Approval info
    approvedBy?: string;
    approvedAt?: string;

    rating?: number;
    ratingComment?: string;
    
    isRecurring?: boolean;
    recurringType?: 'MONTHLY' | 'WEEKLY';
    
    comments: TicketComment[];
    history?: TicketLog[];
    attachments: Attachment[];
    
    isOverdue?: boolean;
    reminderHistory?: string[];
}