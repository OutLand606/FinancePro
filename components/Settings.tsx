
import React, { useState, useEffect } from 'react';
import { getSystemRoles, saveSystemRole, deleteSystemRole } from '../services/systemConfigService';
import { fetchCategories } from '../services/categoryService';
import { fetchCashAccounts, createCashAccount, updateCashAccount } from '../services/cashAccountService';
import { exportBackupToFile } from '../services/backupService';
import { getSettings, saveSettings } from '../services/sheetService';
import { checkSystemIntegrity, generateMigrationPackage, IntegrityIssue } from '../services/dataIntegrityService';
import { api } from '../services/api'; 
import { testGeminiConnection } from '../services/geminiService'; // New Import
import { SystemRole, CategoryMaster, CashAccount, AccountType, AccountOwner, SheetConfig, GoogleStorageConfig, AppSettings } from '../types';
import { Lock, Archive, Layers, Download, Plus, X, Trash2, Edit, Database, CreditCard, Save, HardDrive, Bot, CheckCircle2, User, Globe, Server, Activity, AlertTriangle, ShieldCheck, Wifi, Key, Zap } from 'lucide-react';
import { AVAILABLE_PERMISSIONS } from '../constants';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ROLES' | 'CATEGORIES' | 'ACCOUNTS' | 'BACKUP' | 'GOOGLE_INTEGRATION' | 'SYSTEM' | 'MIGRATION'>('ACCOUNTS');
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [categories, setCategories] = useState<CategoryMaster[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  
  // Migration State
  const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [healthScore, setHealthScore] = useState(100);
  
  // Connection Test State
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [aiConnectionStatus, setAiConnectionStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'FAILED'>('IDLE');

  // Google Configs
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({});
  const [driveConfig, setDriveConfig] = useState<GoogleStorageConfig>({
      driveFolderId: '',
      projectSubFolder: true,
      officeSubFolder: true,
      autoShare: 'VIEW'
  });
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  // System Configs
  const [appSettings, setAppSettings] = useState<AppSettings>({
      apiEndpoint: '',
      useMockData: false,
      appVersionName: 'v1.0'
  });
  
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Partial<SystemRole>>({});

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<CashAccount>>({});

  useEffect(() => {
      loadData();
  }, [activeTab]);

  const loadData = async () => {
      const settings = await getSettings();
      
      // Load common data if needed or lazy load
      if (activeTab === 'ROLES') setRoles( await getSystemRoles());
      if (activeTab === 'CATEGORIES') setCategories(await fetchCategories());
      if (activeTab === 'ACCOUNTS') setAccounts(await fetchCashAccounts());
      
      if (activeTab === 'GOOGLE_INTEGRATION') {
          setSheetConfig(settings.googleSheets || {});
          setDriveConfig(settings.googleStorage || {
              driveFolderId: '',
              projectSubFolder: true,
              officeSubFolder: true,
              autoShare: 'VIEW'
          });
          setGeminiApiKey(settings.geminiApiKey || '');
      }
      if (activeTab === 'SYSTEM') {
          setAppSettings({
              apiEndpoint: settings.apiEndpoint || '',
              useMockData: settings.useMockData !== undefined ? settings.useMockData : true,
              appVersionName: settings.appVersionName || 'v1.0'
          });
      }
      if (activeTab === 'MIGRATION') {
          runHealthCheck();
      }
  };

  const runHealthCheck = async () => {
      setIsChecking(true);
      try {
          const issues = await checkSystemIntegrity();
          setIntegrityIssues(issues);
          const deduction = issues.reduce((acc, iss) => acc + (iss.severity === 'HIGH' ? 10 : 2), 0);
          setHealthScore(Math.max(0, 100 - deduction));
      } finally {
          setIsChecking(false);
      }
  };

  const handleTestConnection = async () => {
      if (!appSettings.apiEndpoint) {
          alert("Vui lòng nhập địa chỉ máy chủ (Endpoint) trước khi kiểm tra.");
          return;
      }
      setConnectionStatus('TESTING');
      // Temporarily save to test the NEW connection string
      saveSettings({ ...getSettings(), apiEndpoint: appSettings.apiEndpoint, useMockData: appSettings.useMockData });
      
      const isOk = await api.checkHealth();
      setConnectionStatus(isOk ? 'SUCCESS' : 'FAILED');
  };

  const handleExportMigration = async () => {
      if (integrityIssues.some(i => i.severity === 'HIGH')) {
          if (!confirm("Hệ thống phát hiện lỗi dữ liệu nghiêm trọng. Bạn có chắc muốn xuất file không?")) return;
      }
      
      const payload = await generateMigrationPackage();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Migration_Pack_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
  };

  const handleSaveRole = () => {
      if (!editingRole.name || !editingRole.code) return;
      saveSystemRole({
          id: editingRole.id || `role_${Date.now()}`,
          code: editingRole.code.toUpperCase(),
          name: editingRole.name,
          permissions: editingRole.permissions || []
      });
      setShowRoleModal(false);
      loadData();
  };

  const handleSaveAccount = async () => {
      if (!editingAccount.bankName || !editingAccount.accountName) return;
      const acc: CashAccount = {
          id: editingAccount.id || `acc_${Date.now()}`,
          bankName: editingAccount.bankName,
          accountName: editingAccount.accountName,
          status: editingAccount.status || 'ACTIVE',
          owner: editingAccount.owner || AccountOwner.COMPANY,
          type: editingAccount.type || AccountType.BANK,
          accountNumber: editingAccount.accountNumber || '',
          initialBalance: Number(editingAccount.initialBalance) || 0
      };
      
      if (editingAccount.id) await updateCashAccount(acc);
      else await createCashAccount(acc);
      
      setShowAccountModal(false);
      loadData();
  };

  const handleSaveGoogleConfig = async () => {
      const settings = await getSettings();
      saveSettings({ 
          ...settings, 
          googleSheets: sheetConfig,
          googleStorage: driveConfig,
          geminiApiKey: geminiApiKey
      });
      // Don't alert here if testing AI, we do it in handleTestAI flow
  };

  const handleTestAI = async () => {
      // 1. Save locally first so getSettings can pick it up
      const settings = await getSettings();;
      saveSettings({ ...settings, geminiApiKey });
      
      setAiConnectionStatus('TESTING');
      try {
          await testGeminiConnection();
          setAiConnectionStatus('SUCCESS');
          alert("Kết nối AI thành công! Hệ thống đã sẵn sàng.");
      } catch (e: any) {
          setAiConnectionStatus('FAILED');
          alert("Lỗi kết nối AI: " + e.message + "\nVui lòng kiểm tra lại Key hoặc Internet.");
      }
  };

  const handleSaveSystemConfig = async () => {
      // VALIDATION
      if (!appSettings.useMockData && !appSettings.apiEndpoint) {
          alert("LỖI: Bạn đang chọn chế độ Server (Real API) nhưng chưa nhập địa chỉ máy chủ.\nVui lòng nhập URL hoặc chuyển về chế độ Mockup.");
          return;
      }

      if (!appSettings.useMockData && !appSettings.apiEndpoint.startsWith('http')) {
          alert("LỖI: Địa chỉ máy chủ không hợp lệ. Phải bắt đầu bằng http:// hoặc https://");
          return;
      }

      const settings = await getSettings();;
      saveSettings({
          ...settings,
          apiEndpoint: appSettings.apiEndpoint,
          useMockData: appSettings.useMockData
      });
      
      // Reload logic is handled in App.tsx to catch connection errors, but here we force reload to apply
      if (confirm("Cấu hình đã lưu. Ứng dụng sẽ tải lại để áp dụng kết nối mới.")) {
          window.location.reload();
      }
  };

  const togglePermission = (permCode: string) => {
      const current = editingRole.permissions || [];
      const updated = current.includes(permCode) 
          ? current.filter(p => p !== permCode) 
          : [...current, permCode];
      setEditingRole({ ...editingRole, permissions: updated });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300">
      <div className="flex items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
          <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Database size={24}/>
          </div>
          <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Hệ Thống & Cấu Hình</h1>
              <p className="text-sm text-slate-500 font-medium">Quản lý phân quyền, tài khoản và dữ liệu nền tảng</p>
          </div>
      </div>

      <div className="flex bg-white p-2 rounded-[20px] border border-slate-200 shadow-sm w-fit overflow-x-auto">
          {[
              {k:'ACCOUNTS',i:CreditCard,l:'Quỹ tiền & Tài khoản'},
            //   {k:'SYSTEM',i:Server,l:'Kết nối Hệ Thống'},
            //   {k:'MIGRATION',i:Activity,l:'Sức khỏe & Migration'},
              {k:'GOOGLE_INTEGRATION',i:HardDrive,l:'Google Integration'},
              {k:'ROLES',i:Lock,l:'Phân Quyền & Vai Trò'}, 
            //   {k:'BACKUP',i:Archive,l:'Sao Lưu Dữ Liệu'}
          ].map(t => (
              <button key={t.k} onClick={() => setActiveTab(t.k as any)} className={`flex items-center px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === t.k ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                  <t.i size={16} className="mr-2"/> {t.l}
              </button>
          ))}
      </div>

      {activeTab === 'ROLES' && (
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm animate-in fade-in">
              <div className="flex justify-between items-center mb-6">
                  <div>
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Vai trò & Phân quyền</h3>
                      <p className="text-xs text-slate-500 mt-1">Định nghĩa quyền hạn cho các nhóm nhân sự.</p>
                  </div>
                  <button onClick={() => { setEditingRole({ permissions: [] }); setShowRoleModal(true); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center shadow-lg hover:bg-indigo-700 transition-all">
                      <Plus size={16} className="mr-2"/> Thêm vai trò
                  </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.map(role => (
                      <div key={role.id} className="p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all bg-slate-50 hover:bg-white group">
                          <div className="flex justify-between items-start mb-3">
                              <div>
                                  <h4 className="font-bold text-slate-900">{role.name}</h4>
                                  <span className="text-[10px] font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-600 uppercase">{role.code}</span>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => { setEditingRole(role); setShowRoleModal(true); }} className="p-2 bg-white rounded-lg text-slate-500 hover:text-indigo-600 shadow-sm"><Edit size={14}/></button>
                                  {!role.isSystem && <button onClick={() => { if(confirm('Xóa vai trò này?')) { deleteSystemRole(role.id); loadData(); }}} className="p-2 bg-white rounded-lg text-slate-500 hover:text-red-600 shadow-sm"><Trash2 size={14}/></button>}
                              </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                              {role.permissions.slice(0, 5).map(p => (
                                  <span key={p} className="text-[9px] px-2 py-1 bg-white border border-slate-100 rounded text-slate-500">{p}</span>
                              ))}
                              {role.permissions.length > 5 && <span className="text-[9px] px-2 py-1 bg-white border border-slate-100 rounded text-slate-400">+{role.permissions.length - 5} quyền khác</span>}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'SYSTEM' && (
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm animate-in fade-in">
              <div className="flex justify-between items-center mb-8">
                  <div>
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Cấu hình Kết nối (Backend)</h3>
                      <p className="text-xs text-slate-500 mt-1">Lựa chọn chế độ vận hành Mockup (Offline) hoặc Real API (Server).</p>
                  </div>
                  <button onClick={handleSaveSystemConfig} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center shadow-lg hover:bg-indigo-700 transition-all">
                      <Save size={16} className="mr-2"/> Lưu & Áp Dụng
                  </button>
              </div>

              <div className="space-y-8">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                              <Server size={20} className="text-indigo-600"/>
                              <span className="font-bold text-slate-800">Chế độ vận hành</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={appSettings.useMockData} onChange={e => setAppSettings({...appSettings, useMockData: e.target.checked})} />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                              <span className="ml-3 text-sm font-medium text-gray-900">{appSettings.useMockData ? 'Mock Mode (Giả lập - Offline)' : 'Real API Mode (Server VPS)'}</span>
                          </label>
                      </div>
                      <p className="text-xs text-slate-500 italic bg-amber-50 p-3 rounded-lg border border-amber-100 text-amber-800">
                          ⚠️ Chú ý: Khi chuyển sang "Real API Mode" và triển khai cho 30 nhân viên, <b>bắt buộc</b> phải cấu hình API Endpoint chính xác. Nếu không, dữ liệu sẽ không được đồng bộ.
                      </p>
                  </div>

                  {!appSettings.useMockData && (
                      <div className="space-y-4 animate-in slide-in-from-top-2">
                          <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest border-b pb-2">Thông tin máy chủ (VPS Endpoint)</h4>
                          <div className="flex gap-2 items-center">
                              <div className="relative flex-1">
                                  <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                  <input 
                                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                                    placeholder="http://123.45.67.89:3000 (IP của VPS)"
                                    value={appSettings.apiEndpoint}
                                    onChange={e => setAppSettings({...appSettings, apiEndpoint: e.target.value})}
                                  />
                              </div>
                              <button onClick={handleTestConnection} className="px-6 py-3 bg-white border-2 border-indigo-100 text-indigo-700 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-50 transition-all flex items-center">
                                  <Wifi size={16} className="mr-2"/> Test Connection
                              </button>
                          </div>
                          {connectionStatus === 'TESTING' && <div className="text-xs font-bold text-slate-500 flex items-center"><Activity size={14} className="animate-spin mr-2"/> Đang ping server...</div>}
                          {connectionStatus === 'SUCCESS' && <div className="text-xs font-bold text-emerald-600 flex items-center"><CheckCircle2 size={14} className="mr-2"/> Kết nối thành công! Server sẵn sàng.</div>}
                          {connectionStatus === 'FAILED' && <div className="text-xs font-bold text-rose-600 flex items-center"><AlertTriangle size={14} className="mr-2"/> Không thể kết nối. Kiểm tra IP/Port hoặc Firewall VPS.</div>}
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'GOOGLE_INTEGRATION' && (
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm animate-in fade-in">
              <div className="flex justify-between items-center mb-8">
                  <div>
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Cấu hình Google Drive, Sheets & AI</h3>
                      <p className="text-xs text-slate-500 mt-1">Kết nối các dịch vụ Google để đồng bộ và xử lý thông minh.</p>
                  </div>
                  <button onClick={() => { handleSaveGoogleConfig(); alert("Đã lưu cấu hình."); }} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center shadow-lg hover:bg-emerald-700 transition-all">
                      <Save size={16} className="mr-2"/> Lưu Cấu Hình
                  </button>
              </div>
              
              <div className="space-y-10">
                  {/* GEMINI AI CONFIG */}
                  <div className="space-y-4">
                      <h4 className="font-black text-purple-600 text-sm uppercase tracking-widest border-b border-purple-100 pb-2 flex items-center"><Bot size={16} className="mr-2"/> Gemini AI Intelligence</h4>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gemini API Key (Bắt buộc)</label>
                          <div className="flex gap-2">
                              <div className="relative flex-1">
                                  <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                  <input 
                                    type="password"
                                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-2xl text-sm font-mono font-bold text-slate-700 outline-none focus:border-purple-500" 
                                    placeholder="AIzaSy..."
                                    value={geminiApiKey}
                                    onChange={e => setGeminiApiKey(e.target.value)}
                                  />
                              </div>
                              <button onClick={handleTestAI} className="px-4 py-2 bg-purple-50 text-purple-700 rounded-2xl font-bold text-[10px] uppercase tracking-widest border border-purple-100 hover:bg-purple-100 transition-all flex items-center whitespace-nowrap">
                                  {aiConnectionStatus === 'TESTING' ? <Activity size={14} className="animate-spin mr-1"/> : <Zap size={14} className="mr-1"/>}
                                  Test Key
                              </button>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                              <p className="text-[10px] text-slate-400 italic">Key này kích hoạt toàn bộ AI: Scan hóa đơn, Phân tích tài chính, Chatbot.</p>
                              {aiConnectionStatus === 'SUCCESS' && <span className="text-[10px] font-bold text-emerald-600 flex items-center"><CheckCircle2 size={12} className="mr-1"/> Kết nối AI thành công</span>}
                              {aiConnectionStatus === 'FAILED' && <span className="text-[10px] font-bold text-rose-600 flex items-center"><AlertTriangle size={12} className="mr-1"/> Key không hợp lệ</span>}
                          </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {/* GOOGLE DRIVE CONFIG */}
                      <div className="space-y-6">
                          <h4 className="font-black text-indigo-600 text-sm uppercase tracking-widest border-b border-indigo-100 pb-2 flex items-center"><HardDrive size={16} className="mr-2"/> Google Drive Storage (Chứng từ)</h4>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Drive Root Folder ID</label>
                              <input 
                                className="w-full p-4 border-2 border-slate-100 rounded-2xl text-sm font-mono font-bold text-slate-700 outline-none focus:border-indigo-500" 
                                placeholder="1abcdefGHIJKLMNOP..."
                                value={driveConfig.driveFolderId || ''}
                                onChange={e => setDriveConfig({ ...driveConfig, driveFolderId: e.target.value })}
                              />
                              <p className="text-[10px] text-slate-400 mt-1 italic">ID của thư mục gốc trên Google Drive nơi chứa toàn bộ file.</p>
                          </div>
                          
                          <div className="space-y-3">
                              <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50">
                                  <input 
                                      type="checkbox" 
                                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                      checked={driveConfig.projectSubFolder}
                                      onChange={e => setDriveConfig({ ...driveConfig, projectSubFolder: e.target.checked })}
                                  />
                                  <span className="text-xs font-bold text-slate-700">Tự động tạo thư mục con theo Dự án / Công trình</span>
                              </label>
                              <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50">
                                  <input 
                                      type="checkbox" 
                                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                      checked={driveConfig.officeSubFolder}
                                      onChange={e => setDriveConfig({ ...driveConfig, officeSubFolder: e.target.checked })}
                                  />
                                  <span className="text-xs font-bold text-slate-700">Tự động tạo thư mục con theo VP / Cửa hàng</span>
                              </label>
                          </div>

                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quyền chia sẻ mặc định (Auto-Share)</label>
                              <select 
                                  className="w-full p-3 border-2 border-slate-100 rounded-2xl text-sm font-bold bg-white focus:border-indigo-500 outline-none"
                                  value={driveConfig.autoShare}
                                  onChange={e => setDriveConfig({ ...driveConfig, autoShare: e.target.value as any })}
                              >
                                  <option value="VIEW">VIEW - Bất kỳ ai có link đều xem được</option>
                                  <option value="NONE">NONE - Riêng tư (Chỉ người có quyền)</option>
                              </select>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'MIGRATION' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`p-6 rounded-[28px] border shadow-sm flex flex-col justify-between ${healthScore === 100 ? 'bg-emerald-50 border-emerald-100' : healthScore > 70 ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                      <div>
                          <div className="flex items-center gap-2 mb-2">
                              <Activity size={20} className={healthScore === 100 ? 'text-emerald-600' : 'text-rose-600'}/>
                              <h3 className="font-black uppercase text-sm tracking-widest text-slate-700">Điểm Sức Khỏe Dữ Liệu</h3>
                          </div>
                          <p className={`text-5xl font-black ${healthScore === 100 ? 'text-emerald-600' : healthScore > 70 ? 'text-amber-600' : 'text-rose-600'}`}>{healthScore}/100</p>
                      </div>
                      <p className="text-xs font-bold text-slate-500 mt-4">{isChecking ? 'Đang kiểm tra...' : integrityIssues.length === 0 ? 'Dữ liệu sạch, sẵn sàng migration.' : `Phát hiện ${integrityIssues.length} vấn đề cần xử lý.`}</p>
                  </div>
              </div>
              <div className="bg-indigo-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="relative z-10 max-w-lg">
                      <h3 className="text-2xl font-black mb-2">Sẵn sàng chuyển đổi lên Server?</h3>
                      <p className="text-indigo-200 text-sm leading-relaxed mb-6">
                          Xuất gói dữ liệu JSON chuẩn để import vào Postgres thông qua Backend API.
                      </p>
                      <button onClick={handleExportMigration} className="bg-white text-indigo-900 px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-50 transition-all shadow-lg flex items-center">
                          <Server size={16} className="mr-2"/> Xuất gói Migration (.JSON)
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {/* Account List UI (Preserved) */}
      {activeTab === 'ACCOUNTS' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                  <div><h3 className="font-black text-slate-900 uppercase text-sm">Danh sách Tài khoản / Quỹ</h3></div>
                  <button onClick={() => { setEditingAccount({status: 'ACTIVE', type: AccountType.BANK, owner: AccountOwner.COMPANY, initialBalance: 0}); setShowAccountModal(true); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-lg"><Plus size={16} className="mr-1"/> Thêm Tài khoản</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {accounts.map(acc => (
                      <div key={acc.id} className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-lg transition-all group relative">
                          <div className="flex justify-between items-start mb-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md ${acc.type === AccountType.CASH ? 'bg-emerald-500' : 'bg-blue-600'}`}>{acc.type === AccountType.CASH ? '$' : 'B'}</div>
                              <button onClick={() => { setEditingAccount(acc); setShowAccountModal(true); }} className="p-2 text-slate-300 hover:text-indigo-600 bg-slate-50 rounded-lg hover:bg-white transition-colors"><Edit size={16}/></button>
                          </div>
                          <h4 className="font-black text-slate-900 text-lg mb-1">{acc.bankName}</h4>
                          <p className="text-sm font-bold text-slate-600 mb-4">{acc.accountName}</p>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                              <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest">
                                  <span className={`px-2 py-1 rounded flex items-center ${acc.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{acc.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</span>
                              </div>
                              {acc.initialBalance && acc.initialBalance > 0 && (
                                <div className="text-[10px] text-slate-400">
                                    Đầu kỳ: <span className="font-bold text-slate-600">{acc.initialBalance.toLocaleString()} ₫</span>
                                </div>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Account Modal (Preserved) */}
      {showAccountModal && (
          <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
                  <div className="px-8 py-6 bg-slate-50/50 border-b flex justify-between items-center">
                      <h3 className="font-black text-xl uppercase tracking-tighter text-slate-900">{editingAccount.id ? 'Sửa thông tin quỹ' : 'Thêm quỹ tiền mới'}</h3>
                      <button onClick={()=>setShowAccountModal(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-colors"><X size={24}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên ngân hàng / Loại quỹ *</label>
                          <input className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold" value={editingAccount.bankName || ''} onChange={e=>setEditingAccount({...editingAccount, bankName: e.target.value})} autoFocus placeholder="VD: Tiền mặt, Vietcombank..."/>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên gợi nhớ / Số TK</label>
                          <input className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold" value={editingAccount.accountName || ''} onChange={e=>setEditingAccount({...editingAccount, accountName: e.target.value})} placeholder="VD: Quỹ chính, 0123456789..."/>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Số dư ban đầu (VNĐ)</label>
                          <input 
                            type="number" 
                            className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-800" 
                            value={editingAccount.initialBalance || ''} 
                            onChange={e=>setEditingAccount({...editingAccount, initialBalance: Number(e.target.value)})} 
                            placeholder="0"
                          />
                          <p className="text-[10px] text-slate-400 mt-1 italic">Số tiền thực tế có trong quỹ trước khi sử dụng phần mềm.</p>
                      </div>
                      <button onClick={handleSaveAccount} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all mt-4">Lưu thông tin</button>
                  </div>
              </div>
          </div>
      )}

      {/* ROLE MODAL */}
      {showRoleModal && (
          <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="px-10 py-8 bg-slate-50/50 border-b flex justify-between items-center">
                      <h3 className="font-black text-2xl uppercase tracking-tighter text-slate-900">Cấu hình vai trò hệ thống</h3>
                      <button onClick={()=>setShowRoleModal(false)} className="p-3 hover:bg-white rounded-full text-slate-400 transition-colors"><X size={24}/></button>
                  </div>
                  <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                      <div className="grid grid-cols-2 gap-10 mb-10">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tên vai trò *</label>
                              <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-800 outline-none focus:border-indigo-500" value={editingRole.name || ''} onChange={e=>setEditingRole({...editingRole, name: e.target.value})} placeholder="Kế toán trưởng..."/>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mã vai trò (UNIQUE) *</label>
                              <input className="w-full border-2 border-slate-100 rounded-2xl p-4 font-mono font-bold text-slate-700 outline-none focus:border-indigo-500 uppercase" value={editingRole.code || ''} onChange={e=>setEditingRole({...editingRole, code: e.target.value})} placeholder="ROLE_ACCOUNTANT..." disabled={!!editingRole.id}/>
                          </div>
                      </div>
                      
                      <h4 className="font-black text-indigo-600 text-sm uppercase tracking-widest border-b border-indigo-50 pb-2 mb-6">Phân quyền chi tiết</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {AVAILABLE_PERMISSIONS.map(p => (
                              <label key={p.code} className="flex items-center p-4 rounded-2xl border-2 border-slate-50 hover:border-indigo-100 hover:bg-indigo-50/30 cursor-pointer transition-all">
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mr-4 transition-all ${editingRole.permissions?.includes(p.code) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                      {editingRole.permissions?.includes(p.code) && <CheckCircle2 size={16}/>}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={editingRole.permissions?.includes(p.code) || false} onChange={() => togglePermission(p.code)}/>
                                  <div>
                                      <p className="font-bold text-slate-800 text-sm">{p.label}</p>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.group}</p>
                                  </div>
                              </label>
                          ))}
                      </div>
                  </div>
                  <div className="px-10 py-8 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
                      <button onClick={()=>setShowRoleModal(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-colors">Hủy bỏ</button>
                      <button onClick={handleSaveRole} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">Lưu Vai Trò</button>
                  </div>
              </div>
          </div>
      )}
      
      {activeTab === 'BACKUP' && (
          <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-sm text-center animate-in fade-in flex flex-col items-center justify-center min-h-[400px]">
              <div className="p-6 bg-indigo-50 rounded-3xl mb-6 shadow-inner"><Archive size={64} className="text-indigo-400"/></div>
              <h3 className="font-black text-slate-900 uppercase text-2xl mb-2 tracking-tight">Trung tâm sao lưu dữ liệu</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">
                  Dữ liệu của bạn được lưu cục bộ trên trình duyệt. Hãy xuất file định kỳ để tránh mất mát khi dọn dẹp cache máy tính.
              </p>
              <button 
                  onClick={exportBackupToFile}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center active:scale-95"
              >
                  <Download size={20} className="mr-2"/> Xuất File Toàn Bộ Hệ Thống (.JSON)
              </button>
          </div>
      )}
    </div>
  );
};

export default Settings;
