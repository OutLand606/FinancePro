
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout.tsx';
import LoginScreen from './components/LoginScreen.tsx';
import QuickTransactionPage from './components/QuickTransactionPage.tsx';
import EmployeeSelfServicePage from './components/EmployeeSelfServicePage.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

import { Project, Transaction, Partner, CashAccount, PriceRecord, UserContext, GlobalDataProps, Contract } from './types.ts';
import { fetchAllData, createProject, createTransaction, updateTransaction, deleteTransaction, updateProject } from './services/sheetService.ts';
import { fetchPartners, createPartner } from './services/masterDataService.ts';
import { fetchCashAccounts } from './services/cashAccountService.ts';
import { fetchPriceRecords } from './services/supplierPriceService.ts';
import { fetchContracts } from './services/contractService.ts';
import { checkSession } from './services/authService.ts';
import { getEmployeeById } from './services/employeeService.ts';
import { runMigrations } from './services/migrationService.ts';
import { Loader2 } from 'lucide-react';
import { getFlattenedModules } from './services/moduleRegistry.tsx';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [quickLinkToken, setQuickLinkToken] = useState<string | null>(null);
  const [quickMode, setQuickMode] = useState<'TRANSACTION' | 'SELF_REPORT'>('TRANSACTION');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [priceRecords, setPriceRecords] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Run Migrations (Silent)
    try {
        runMigrations(); 
    } catch (e) {
        console.error("Migration warning:", e);
    }

    // 2. Parse URL Params
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const mode = params.get('mode');

    if (token) {
      setQuickLinkToken(token);
      setQuickMode(mode === 'self-report' ? 'SELF_REPORT' : 'TRANSACTION');
      setActiveTab('quick-mode');
    }

    // 3. Validate Session
    const validateSession = async () => {
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
            
            const sessionUser = checkSession();
            if (sessionUser) {
                const emp = getEmployeeById(sessionUser.id);
                if (emp) {
                    setCurrentUser(sessionUser);
                } else {
                    localStorage.removeItem('finance_user_session');
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
        } catch (e) {
            console.error("Session check failed:", e);
            localStorage.removeItem('finance_user_session');
            setCurrentUser(null);
        } finally {
            setAuthLoading(false);
        }
    };
    
    validateSession();

    // SAFETY TIMEOUT: Force stop loading after 3 seconds to prevent white screen
    const safetyTimer = setTimeout(() => {
        setAuthLoading(false);
    }, 3000);

    return () => clearTimeout(safetyTimer);
  }, []);

  const loadData = async () => {
    if (!currentUser) return; 
    setLoading(true);
    try {
      const allDataPromise = fetchAllData().catch(() => ({ projects: [], transactions: [] }));
      const partnersPromise = fetchPartners().catch(() => []);
      const accountsPromise = fetchCashAccounts().catch(() => []);
      const pricesPromise = fetchPriceRecords().catch(() => []);
      const contractsPromise = fetchContracts().catch(() => []);

      const [all, pts, accs, prices, ctrs] = await Promise.all([
        allDataPromise, partnersPromise, accountsPromise, pricesPromise, contractsPromise
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

  // Handlers
  const handleLogout = () => {
      localStorage.removeItem('access_token');
      setCurrentUser(null);
      setActiveTab('dashboard');
      // No reload needed, React state change will switch to LoginScreen
  };

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
            <p className="text-slate-500 font-semibold tracking-tight uppercase text-xs animate-pulse">Đang khởi động hệ thống...</p>
        </div>
      );
  }

  if (activeTab === 'quick-mode' && quickLinkToken) {
    if (quickMode === 'SELF_REPORT') return <EmployeeSelfServicePage token={quickLinkToken} onSuccess={() => {}} />;
    if (currentUser) return <QuickTransactionPage token={quickLinkToken} currentUser={currentUser} projects={projects} partners={partners} onSuccess={() => setActiveTab('dashboard')} onLogout={handleLogout} />;
    return <LoginScreen onLoginSuccess={setCurrentUser} />;
  }

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
