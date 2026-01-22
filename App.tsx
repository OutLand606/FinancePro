import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import QuickTransactionPage from './components/QuickTransactionPage.tsx';
import EmployeeSelfServicePage from './components/EmployeeSelfServicePage.tsx';
import CustomerView from './components/CustomerView.tsx'; // <--- BỔ SUNG IMPORT
import ErrorBoundary from './components/ErrorBoundary.tsx';

import { Project, Transaction, Partner, CashAccount, PriceRecord, UserContext, GlobalDataProps, Contract, ProjectRoadmap } from './types.ts';
import { fetchAllData, createProject, createTransaction, updateTransaction, deleteTransaction, updateProject } from './services/sheetService.ts';
import { fetchPartners, createPartner } from './services/masterDataService.ts';
import { fetchCashAccounts } from './services/cashAccountService.ts';
import { fetchPriceRecords } from './services/supplierPriceService.ts';
import { fetchContracts } from './services/contractService.ts';
import { checkSession } from './services/authService.ts';
import { getEmployeeById } from './services/employeeService.ts';
import { runMigrations } from './services/migrationService.ts';
import { Loader2 } from 'lucide-react';
import { getFlattenedModules } from './components/moduleRegistry.tsx';
import { api } from './services/api.ts';
import WorkerView from './components/WorkerView.tsx';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Quick Link State
  const [quickLinkToken, setQuickLinkToken] = useState<string | null>(null);
  const [quickMode, setQuickMode] = useState<'TRANSACTION' | 'SELF_REPORT' | 'ROADMAP'>('TRANSACTION');
  
  // Guest Data State (Cho Roadmap View)
  const [guestRoadmap, setGuestRoadmap] = useState<ProjectRoadmap | null>(null);
  const [guestProject, setGuestProject] = useState<Project | null>(null);
  const [guestRole, setGuestRole] = useState<'CUSTOMER' | 'WORKER'>('CUSTOMER');

  // App Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [priceRecords, setPriceRecords] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Run Migrations
    try { runMigrations(); } catch (e) { console.error(e); }

    // 2. HANDLE URL PARAMS (Logic quan trọng)
    const handleUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const mode = params.get('mode');

        if (token) {
            setQuickLinkToken(token);
            
            // CASE 1: ROADMAP (Khách/Thợ xem tiến độ)
            if (mode === 'roadmap') {
                setQuickMode('ROADMAP');
                setActiveTab('quick-mode');
                
                try {
                    const resMap = await api.get<ProjectRoadmap[]>('/project_roadmaps');
                    if (resMap.success) {
                        // --- SỬA ĐOẠN TÌM KIẾM NÀY ---
                        // Tìm Roadmap chứa token và lấy luôn thông tin link đó để biết Role
                        let foundLink: any = null;
                        const foundMap = resMap.data.find(r => {
                            const link = r.accessLinks?.find(l => l.token === token && l.isActive);
                            if (link) {
                                foundLink = link;
                                return true;
                            }
                            return false;
                        });
                        
                        if (foundMap && foundLink) {
                            setGuestRoadmap(foundMap);
                            setGuestRole(foundLink.role); // <--- LƯU ROLE (CUSTOMER/WORKER)
                            
                            const resProj = await api.get<Project>(`/projects/${foundMap.projectId}`);
                            if (resProj.success) setGuestProject(resProj.data);
                        }
                        // -----------------------------
                    }
                } catch (e) { console.error(e); }
                setAuthLoading(false);
                return;
            }

            // CASE 2: SELF REPORT & QUICK TRANSACTION
            setQuickMode(mode === 'self-report' ? 'SELF_REPORT' : 'TRANSACTION');
            setActiveTab('quick-mode');
        }

        // 3. Validate Session (Chỉ chạy nếu không phải Guest Roadmap)
        validateSession();
    };

    const validateSession = async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            const sessionUser = checkSession();
            if (sessionUser) {
                const emp = getEmployeeById(sessionUser.id);
                if (emp) setCurrentUser(sessionUser);
                else { localStorage.removeItem('finance_user_session'); setCurrentUser(null); }
            } else {
                setCurrentUser(null);
            }
        } catch (e) {
            localStorage.removeItem('finance_user_session');
            setCurrentUser(null);
        } finally {
            setAuthLoading(false);
        }
    };
    
    handleUrlParams();

    const safetyTimer = setTimeout(() => setAuthLoading(false), 3000);
    return () => clearTimeout(safetyTimer);
  }, []);

  const loadData = async () => {
    if (!currentUser) return; 
    setLoading(true);
    try {
      const [all, pts, accs, prices, ctrs] = await Promise.all([
        fetchAllData().catch(() => ({ projects: [], transactions: [] })),
        fetchPartners().catch(() => []),
        fetchCashAccounts().catch(() => []),
        fetchPriceRecords().catch(() => []),
        fetchContracts().catch(() => [])
      ]);

      setProjects(all.projects || []);
      setTransactions(all.transactions || []);
      setPartners(pts || []);
      setAccounts(accs || []);
      setPriceRecords(prices || []);
      setContracts(ctrs || []);
    } catch (err) {
      console.error("Critical Data Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const handleLogout = () => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('finance_user_session');
      setCurrentUser(null);
      setActiveTab('dashboard');
  };

  // ... (Giữ nguyên các handlers add/update) ...
  const handleAddProject = async (p: Project) => { setProjects(prev => [p, ...prev]); await createProject(p); };
  const handleUpdateProject = async (p: Project) => { setProjects(prev => prev.map(item => item.id === p.id ? p : item)); await updateProject(p); };
  const handleAddTransaction = async (t: Transaction) => { setTransactions(prev => [t, ...prev]); await createTransaction(t); };
  const handleUpdateTransaction = async (t: Transaction) => { setTransactions(prev => prev.map(item => item.id === t.id ? t : item)); await updateTransaction(t); };
  const handleDeleteTransaction = async (id: string) => { setTransactions(prev => prev.filter(t => t.id !== id)); await deleteTransaction(id); };
  const handleAddPartner = async (p: Partner) => { setPartners(prev => [p, ...prev]); await createPartner(p); };

  // --- RENDER ---

  if (authLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
            <p className="text-slate-500 font-semibold tracking-tight uppercase text-xs animate-pulse">Đang kết nối hệ thống...</p>
        </div>
      );
  }

  // --- VIEW MODE HANDLING ---
  if (activeTab === 'quick-mode' && quickLinkToken) {
    // 1. ROADMAP GUEST VIEW
     if (quickMode === 'ROADMAP') {
        if (guestRoadmap && guestProject) {
            if (guestRole === 'WORKER') {
                return (
                    <WorkerView 
                        project={guestProject} 
                        currentUser={{ id: 'guest_worker', name: 'Tổ Đội (Khách)', role: 'WORKER' }}
                    />
                );
            }

            // Mặc định là CĐT -> Hiển thị CustomerView
            return (
                <CustomerView 
                    project={guestProject} 
                    roadmap={guestRoadmap} 
                    previewMode={true} 
                    onSendFeedback={() => {}} 
                    onRating={() => {}}
                />
            );
            // ---------------------------
        }
        return <div className="h-screen flex items-center justify-center text-slate-500">Đang tải dữ liệu dự án...</div>;
    }

    // 2. SELF SERVICE
    if (quickMode === 'SELF_REPORT') {
        return <EmployeeSelfServicePage token={quickLinkToken} onSuccess={() => {}} />;
    }

    // 3. QUICK TRANSACTION (Yêu cầu login nếu chưa có session)
    if (currentUser) {
        return <QuickTransactionPage token={quickLinkToken} currentUser={currentUser} projects={projects} partners={partners} onSuccess={() => setActiveTab('dashboard')} onLogout={handleLogout} />;
    }
    return <LoginScreen onLoginSuccess={setCurrentUser} />;
  }

  // --- MAIN APP ---
  if (!currentUser) return <LoginScreen onLoginSuccess={setCurrentUser} />;

  if (loading && activeTab !== 'quick-mode') return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-slate-500 font-semibold tracking-tight uppercase text-xs">Đang tải dữ liệu FinancePro...</p>
    </div>
  );

  const renderContent = () => {
      const allModules = getFlattenedModules();
      const activeModule = allModules.find(m => m.key === activeTab);

      if (activeModule) {
          const props: GlobalDataProps = {
              projects, transactions, partners, accounts, contracts, priceRecords, currentUser,
              onAddTransaction: handleAddTransaction, onUpdateTransaction: handleUpdateTransaction, onDeleteTransaction: handleDeleteTransaction,
              onAddProject: handleAddProject, onUpdateProject: handleUpdateProject, onAddPartner: handleAddPartner, onNavigate: setActiveTab 
          };
          const Component = activeModule.component;
          return (
            <ErrorBoundary key={activeModule.key} moduleName={activeModule.label}>
                <Component {...props} />
            </ErrorBoundary>
          );
      }
      return <div className="p-8">Phân hệ {activeTab} đang được phát triển.</div>;
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} onLogout={handleLogout}>
      {renderContent()}
    </Layout>
  );
};

export default App;