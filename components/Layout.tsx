import React, { useState } from "react";
import { Menu, X, LogOut, ChevronDown } from "lucide-react";
import { isModuleEnabled } from "../services/systemConfigService";
import { hasPermission } from "../services/authService";
import { UserContext } from "../types";
import { APP_MODULES } from "../services/moduleRegistry";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserContext;
  onLogout: () => void; 
}

const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["hr"]);

  // --- LOGIC PHÂN QUYỀN SIDEBAR (TƯƠNG TỰ DASHBOARD) ---
  const checkSidebarAccess = (moduleKey: string): boolean => {
      if (currentUser?.permissions?.includes('SYS_ADMIN') ) return true;
      const perms = currentUser?.permissions || [];

      console.log('perms',perms)

      switch (moduleKey) {
          case 'dashboard': // Ai cũng vào được Dashboard
              return true;
          case 'projects': // Quản lý Công Trình
              return perms.some(p => ['PROJECT_VIEW_ALL', 'PROJECT_VIEW_OWN'].includes(p));
          case 'transactions': // Sổ Thu Chi
              return perms.some(p => ['TRANS_CREATE', 'TRANS_VIEW_ALL', 'TRANS_APPROVE', 'TRANS_PAY'].includes(p));
          case 'contracts': // Hợp đồng
          case 'customers': // Khách hàng
          case 'suppliers': // Thị trường
              return perms.some(p => ['PROJECT_VIEW_ALL', 'TRANS_CREATE'].includes(p));
          case 'office': // Office & Store
              return perms.includes('OFFICE_VIEW') || perms.includes('OFFICE_MANAGE');
          case 'hr-group': // Nhóm Nhân sự (Cha)
              return true
          case 'employees': // Nhân viên
          case 'timesheets': // Chấm công
          case 'payroll': // Bảng lương
          case 'kpi': // KPI
              return perms.some(p => ['HR_VIEW_ALL', 'HR_MANAGE', 'EMPLOYEE_MANAGE', 'SALARY_MANAGE'].includes(p));
          case 'my-salary': // Lương của tôi
              return true; 
          case 'tax-kpi': // Thuế
          case 'analysis': // AI
          case 'settings': // Cấu hình
              return perms.some(p => ['SYS_ADMIN', 'SYS_CONFIG_EDIT'].includes(p));
          default:
              return false;
      }
  };

  const canShowItem = (item: any) => {
    console.log('item.keyitem.key',item.key)
    // 1. Check System Config (Module có được bật không?)
    if (!isModuleEnabled(item.key) && item.key !== "settings") return false;
    
    // 2. Check User Permission (Logic mới)
    return checkSidebarAccess(item.key);
  };

  const NavButton: React.FC<{ item: any; isSub?: boolean }> = ({
    item,
    isSub = false,
  }) => {
    if (!canShowItem(item)) return null;
    
    const Icon = item.icon;
    const isActive = activeTab === item.key;

    return (
      <button
        onClick={() => {
          setActiveTab(item.key);
          if (!item.subItems) setIsSidebarOpen(false);
        }}
        className={`
                flex items-center w-full px-4 ${
                  isSub ? "py-2 text-sm" : "py-2.5 rounded-lg"
                } mb-1 transition-colors
                ${
                  isActive
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                }
                ${isSub ? "pl-10" : ""}
            `}
      >
        <Icon size={isSub ? 16 : 18} className="mr-3" />
        <span className="text-[13px] tracking-tight">{item.label}</span>
      </button>
    );
  };

  // Extract Settings module to render it separately at the bottom
  const settingsModule = APP_MODULES.find((m) => m.key === "settings");

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        <div className="flex items-center gap-3 h-16 px-6 border-b border-slate-800">
          <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold text-lg">
            F
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            FinancePro
          </h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {APP_MODULES.map((module) => {
            // Hide Settings from the main list (we will render it at the bottom)
            if (module.key === "settings") return null;

            // Xử lý logic hiển thị Menu Cha (Group)
            if (module.subItems) {
              // Lọc ra các sub-item mà user có quyền xem
              const visibleSubItems = module.subItems.filter(sub => canShowItem(sub));
              
              // Nếu không có sub-item nào được xem -> Ẩn luôn menu cha
              if (visibleSubItems.length === 0) return null;

              // Check quyền xem menu cha (để chắc chắn)
              if (!canShowItem(module)) return null;

              const isExpanded = expandedGroups.includes(module.key);
              return (
                <div key={module.key} className="mb-1">
                  <button
                    onClick={() =>
                      setExpandedGroups((prev) =>
                        prev.includes(module.key)
                          ? prev.filter((k) => k !== module.key)
                          : [...prev, module.key]
                      )
                    }
                    className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-300"
                  >
                    <span className="flex items-center">
                      <module.icon size={14} className="mr-2" /> {module.label}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="mt-1">
                      {visibleSubItems.map((sub) => (
                        <NavButton key={sub.key} item={sub} isSub={true} />
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return <NavButton key={module.key} item={module} />;
          })}
        </nav>

        {/* Render Settings at the bottom (Chỉ hiện nếu có quyền) */}
        {settingsModule && canShowItem(settingsModule) && (
          <div className="px-3 pt-2 border-t border-slate-800 mt-auto">
            <NavButton item={settingsModule} />
          </div>
        )}

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 p-2">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {currentUser.roleName}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="text-slate-500 hover:text-rose-400 p-1"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-slate-600"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-indigo-600">FinancePro</span>
          <div className="w-8" />
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;