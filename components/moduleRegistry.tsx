
import React from 'react';
import { AppModuleDefinition, GlobalDataProps } from '../types.ts';
import { 
  LayoutDashboard, Wallet, FolderKanban, PieChart, Users, 
  FileCheck, ShoppingBag, Settings as SettingsIcon, Bot,
  Clock, CreditCard, UserCircle, Briefcase, User, Contact,
  Target, Building2, Scale
} from 'lucide-react';

import Dashboard from './Dashboard.tsx';
import ProjectManager from './ProjectManager.tsx';
import TransactionList from './TransactionList.tsx';
import ContractManager from './ContractManager.tsx';
import SupplierPriceManager from './SupplierPriceManager.tsx';
import TaxKpiDashboard from './TaxKpiDashboard.tsx';
import PayrollManager from './PayrollManager.tsx';
import Settings from './Settings.tsx';
import EmployeeManager from './EmployeeManager.tsx';
import TimesheetManager from './TimesheetManager.tsx';
import MyPayslips from './MyPayslips.tsx';
import CustomerManager from './CustomerManager.tsx';
import KPIManager from './KPIManager.tsx';
import OfficeManager from './OfficeManager.tsx';
import AIAnalyst from './AIAnalyst.tsx';
import InvoiceBalanceManager from './InvoiceBalanceManager.tsx';

export const APP_MODULES: AppModuleDefinition[] = [
    {
        key: 'dashboard',
        label: 'Tổng quan',
        enabled: true,
        icon: LayoutDashboard,
        component: (props: GlobalDataProps) => <Dashboard currentUser={props.currentUser} transactions={props.transactions} projects={props.projects} accounts={props.accounts} onNavigate={props.onNavigate} />
    },
    {
        key: 'projects',
        label: 'Quản lý Công Trình',
        enabled: true,
        icon: FolderKanban,
        permission: 'PROJECT_VIEW_OWN',
        component: (props: GlobalDataProps) => <ProjectManager {...props} />
    },
    {
        key: 'transactions',
        label: 'Sổ Thu Chi',
        enabled: true,
        icon: Wallet,
        permission: 'TRANS_CREATE',
        component: (props: GlobalDataProps) => <TransactionList {...props} />
    },
    {
        key: 'invoice-balance',
        label: 'Hóa đơn & Cân đối',
        enabled: true,
        icon: Scale,
        permission: 'TRANS_VIEW_ALL',
        component: (props: GlobalDataProps) => <InvoiceBalanceManager 
            transactions={props.transactions} 
            projects={props.projects} 
            partners={props.partners} 
            contracts={props.contracts}
            onAddTransaction={props.onAddTransaction}
            onAddPartner={props.onAddPartner}
            accounts={props.accounts}
        />
    },
    {
        key: 'contracts',
        label: 'Hợp đồng',
        enabled: true,
        icon: FileCheck,
        component: (props: GlobalDataProps) => <ContractManager projects={props.projects} partners={props.partners} transactions={props.transactions} />
    },
    {
        key: 'customers',
        label: 'Khách hàng & CĐT',
        enabled: true,
        icon: Contact,
        component: (props: GlobalDataProps) => <CustomerManager partners={props.partners} projects={props.projects} transactions={props.transactions} contracts={props.contracts || []} />
    },
    {
        key: 'office',
        label: 'Office & Store 360',
        enabled: true,
        icon: Building2,
        permission: 'PROJECT_VIEW_ALL', 
        component: (props: GlobalDataProps) => <OfficeManager transactions={props.transactions} currentUser={props.currentUser} accounts={props.accounts} />
    },
    {
        key: 'suppliers',
        label: 'Thị trường & NCC',
        enabled: true,
        icon: ShoppingBag,
        component: (props: GlobalDataProps) => <SupplierPriceManager transactions={props.transactions} />
    },
    {
        key: 'hr-group',
        label: 'Nhân sự & Lương',
        enabled: true,
        icon: Users,
        component: (props: GlobalDataProps) => <EmployeeManager {...props} />, 
        subItems: [
            {
                key: 'employees',
                label: 'Nhân viên 360°',
                enabled: true,
                icon: UserCircle,
                permission: 'EMPLOYEE_MANAGE',
                component: (props: GlobalDataProps) => <EmployeeManager {...props} />
            },
            {
                key: 'timesheets',
                label: 'Chấm công',
                enabled: true,
                icon: Clock,
                permission: 'HR_VIEW_ALL',
                component: (props: GlobalDataProps) => <TimesheetManager projects={props.projects} />
            },
            {
                key: 'kpi',
                label: 'Quản lý KPI',
                enabled: true,
                icon: Target,
                permission: 'HR_MANAGE',
                component: (props: GlobalDataProps) => <KPIManager transactions={props.transactions} projects={props.projects} />
            },
            {
                key: 'payroll',
                label: 'Quản lý Lương',
                enabled: true,
                icon: CreditCard,
                permission: 'HR_MANAGE',
                component: (props: GlobalDataProps) => <PayrollManager />
            },
            {
                key: 'my-salary',
                label: 'Lương của tôi',
                enabled: true,
                icon: User,
                component: (props: GlobalDataProps) => <MyPayslips currentUser={props.currentUser} />
            }
        ]
    },
    {
        key: 'tax-kpi',
        label: 'Thuế & KPI',
        enabled: true,
        icon: PieChart,
        component: (props: GlobalDataProps) => <TaxKpiDashboard transactions={props.transactions} projects={props.projects} partners={props.partners} accounts={props.accounts} />
    },
    {
        key: 'analysis',
        label: 'AI Phân tích',
        enabled: true,
        icon: Bot,
        permission: 'PROJECT_VIEW_ALL',
        component: (props: GlobalDataProps) => <AIAnalyst projects={props.projects} transactions={props.transactions} />
    },
    {
        key: 'settings',
        label: 'Cấu hình',
        enabled: true,
        icon: SettingsIcon,
        permission: 'SYS_CONFIG_EDIT',
        component: (props: GlobalDataProps) => <Settings />
    }
];

export const getFlattenedModules = () => {
    const flat: AppModuleDefinition[] = [];
    APP_MODULES.forEach(m => {
        flat.push(m);
        if (m.subItems) {
            m.subItems.forEach(sub => flat.push({ ...sub } as AppModuleDefinition));
        }
    });
    return flat;
};
