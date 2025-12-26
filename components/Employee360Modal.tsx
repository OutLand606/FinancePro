
import React, { useState, useMemo, useEffect } from 'react';
import { Employee, Transaction, Project, EmployeePerformance, TransactionType, TransactionStatus, Contract, KpiRecord } from '../types';
import { analyzeEmployee360 } from '../services/employeeAnalysisService';
import { getKpiRecords } from '../services/kpiService';
import { 
    X, User, Briefcase, Wallet, TrendingUp, Clock, Building2, 
    DollarSign, FileText, CheckCircle2, AlertCircle, Phone, 
    Mail, MapPin, Calendar, ArrowUpRight, ArrowDownLeft, Target,
    Fingerprint, CreditCard, FileBadge, Cake, Timer, ShieldCheck, UserCircle,
    Info, Users, Heart, Shield, Award, HelpCircle, HardHat, Settings, Search,
    History, Briefcase as JobIcon, BookOpen, Truck, LifeBuoy, Edit, MoreHorizontal, ChevronRight,
    Loader2, Star, Save, Activity, PieChart, TrendingDown, BarChart3, Lock
} from 'lucide-react';

// --- MOVED OUTSIDE COMPONENT ---
const EditableField = ({ label, field, editData, isEditing, setEditData, type = "text", options }: { label: string, field: keyof Employee, editData: Employee, isEditing: boolean, setEditData: Function, type?: string, options?: {v:string, l:string}[] }) => {
    if (!isEditing) {
        let displayValue = editData[field] as any;
        if (field === 'password') {
            displayValue = '••••••';
        } else if (options) {
            displayValue = options.find(o => o.v === displayValue)?.l || displayValue;
        }
        return (
            <div className="flex flex-col border-b border-slate-50 py-3 group hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
                <span className="text-sm font-bold text-slate-800">{displayValue || '---'}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col border-b border-indigo-50 py-3 bg-indigo-50/30 px-2 rounded-lg">
            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">{label}</label>
            {options ? (
                <select 
                    className="bg-white border-2 border-slate-100 rounded-lg p-2 text-sm font-bold outline-none focus:border-indigo-500"
                    value={(editData[field] as string) || ''}
                    onChange={e => setEditData({ ...editData, [field]: e.target.value })}
                >
                    <option value="">-- Chọn --</option>
                    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
            ) : (
                <input 
                    type={type}
                    className="bg-white border-2 border-slate-100 rounded-lg p-2 text-sm font-bold outline-none focus:border-indigo-500"
                    value={(editData[field] as string) || ''}
                    onChange={e => setEditData({ ...editData, [field]: e.target.value })}
                />
            )}
        </div>
    );
};

interface Employee360ModalProps {
    employee: Employee;
    transactions: Transaction[];
    projects: Project[];
    contracts: Contract[];
    onClose: () => void;
    onUpdateEmployee: (emp: Employee) => Promise<void>;
}

const Employee360Modal: React.FC<Employee360ModalProps> = ({ employee, transactions, projects, contracts, onClose, onUpdateEmployee }) => {
    const [activeSection, setActiveSection] = useState('OVERVIEW_360');
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Employee>(employee);
    const [kpiData, setKpiData] = useState<KpiRecord[]>([]);
    
    useEffect(() => {
        setEditData(employee);
    }, [employee]);

    useEffect(() => {
        const fetchKpi = async () => {
            try {
                const allRecords = await getKpiRecords();
                const empRecords = allRecords.filter(r => r.empId === employee.id).sort((a,b) => b.month.localeCompare(a.month));
                setKpiData(empRecords);
            } catch (e) {
                console.error("Failed to load KPI records", e);
            }
        };
        fetchKpi();
    }, [employee.id]);

    const stats: EmployeePerformance = useMemo(() => 
        analyzeEmployee360(employee, transactions, projects), 
    [employee, transactions, projects]);

    const sections = [
        { id: 'OVERVIEW_360', label: 'Tổng quan 360°', icon: Activity },
        { id: 'BASIC', label: 'Thông tin cá nhân', icon: UserCircle },
        { id: 'JOB', label: 'Công việc & Dự án', icon: JobIcon },
        { id: 'SALARY_HISTORY', label: 'Lịch sử Thu nhập', icon: Wallet },
        { id: 'BANK', label: 'Ngân hàng', icon: CreditCard },
        { id: 'CONTRACT', label: 'Hợp đồng lao động', icon: FileText },
        { id: 'INSURANCE', label: 'Bảo hiểm & Y tế', icon: LifeBuoy },
        { id: 'ASSETS', label: 'Tài sản cấp phát', icon: Truck },
    ];

    const normalizedSections = sections.map(s => s.id === 'INSURANCE' ? { ...s, icon: LifeBuoy } : s);
    const filteredSections = normalizedSections.filter(s => s.label.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSave = async () => {
        await onUpdateEmployee(editData);
        setIsEditing(false);
    };

    const renderOverview360 = () => {
        // Safe access to data with fallbacks
        const latestKpi = kpiData[0];
        // Calculate a mock score if actual revenue exists, otherwise 0
        const kpiPoints = latestKpi && latestKpi.snapStandardTarget > 0 
            ? Math.min(100, Math.round((latestKpi.actualRevenue / latestKpi.snapStandardTarget) * 100)) 
            : 0;
        
        return (
            <div className="space-y-10 animate-in fade-in">
                {/* KPI & Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-indigo-600 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Hiệu suất KPI (Tháng này)</p>
                            <h3 className="text-5xl font-black">{kpiPoints}%</h3>
                            <div className="mt-6 flex items-center gap-2">
                                <span className={`px-3 py-1 ${kpiPoints >= 100 ? 'bg-emerald-400 text-emerald-900' : kpiPoints >= 80 ? 'bg-blue-400 text-blue-900' : 'bg-white/20'} rounded-full text-[10px] font-black uppercase`}>
                                    {kpiPoints >= 100 ? 'Xuất sắc' : kpiPoints >= 80 ? 'Tốt' : 'Đang phấn đấu'}
                                </span>
                                <span className="text-[10px] font-bold opacity-60">Doanh số: {(latestKpi?.actualRevenue || 0).toLocaleString()}</span>
                            </div>
                        </div>
                        <Target size={120} className="absolute right-[-20px] bottom-[-20px] opacity-10 group-hover:scale-110 transition-transform"/>
                    </div>

                    <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm flex flex-col justify-between group">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dự án tham gia</p>
                                <h3 className="text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{stats.activeProjectsCount || 0} <span className="text-lg text-slate-400">Dự án</span></h3>
                            </div>
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform"><Building2 size={24}/></div>
                        </div>
                        <div className="flex -space-x-2 mt-4">
                            {stats.involvedProjects.slice(0, 4).map((p, i) => (
                                <div key={i} className="w-10 h-10 rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center text-[10px] font-black text-indigo-600 shadow-sm" title={p.name}>
                                    {p.name.charAt(0)}
                                </div>
                            ))}
                            {stats.involvedProjects.length > 4 && <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold">+{stats.involvedProjects.length-4}</div>}
                        </div>
                    </div>

                    <div className="bg-emerald-50 rounded-[32px] p-8 border border-emerald-100 shadow-sm flex flex-col justify-between group">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Thu nhập lũy kế (Real)</p>
                                <h3 className="text-3xl font-black text-emerald-700">{(stats.totalEarned || 0).toLocaleString()} ₫</h3>
                            </div>
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform"><DollarSign size={24}/></div>
                        </div>
                        <p className="text-[10px] text-emerald-500 font-bold mt-2">Tổng lương & thưởng đã thực nhận</p>
                    </div>
                </div>

                {/* Performance Multi-dim Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                        <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
                            <TrendingUp size={16} className="text-indigo-600"/> Lịch sử Doanh số (KPI)
                        </h4>
                        <div className="space-y-4">
                            {kpiData.slice(0, 5).map(record => {
                                // Safe calculation
                                const target = record.snapStandardTarget || 1;
                                const percent = (record.actualRevenue / target) * 100;
                                
                                return (
                                    <div key={record.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold text-slate-500 text-xs">{record.month.split('-')[1]}</div>
                                            <div>
                                                <p className="text-xs font-black text-slate-800">DS: {(record.actualRevenue || 0).toLocaleString()} ₫</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">Mục tiêu: {(record.snapStandardTarget || 0).toLocaleString()} ₫</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-black ${percent >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{percent.toFixed(1)}%</p>
                                            <div className="w-16 bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                                                <div className={`h-full ${percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${Math.min(percent, 100)}%`}}></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {kpiData.length === 0 && <p className="text-center py-10 text-slate-400 italic text-xs">Chưa có dữ liệu KPI cho nhân viên này.</p>}
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col">
                        <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2">
                            <Wallet size={16} className="text-rose-500"/> Tài chính nội bộ & Phúc lợi
                        </h4>
                        <div className="space-y-4 flex-1">
                            <div className="flex justify-between items-center p-5 bg-slate-50 rounded-[24px] group hover:bg-rose-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white text-rose-500 rounded-xl shadow-sm"><Timer size={18}/></div>
                                    <span className="text-xs font-bold text-slate-500">Tạm ứng tồn đọng</span>
                                </div>
                                <span className="text-sm font-black text-rose-600 group-hover:scale-105 transition-transform">{(stats.totalAdvances || 0).toLocaleString()} ₫</span>
                            </div>
                            <div className="flex justify-between items-center p-5 bg-slate-50 rounded-[24px] group hover:bg-indigo-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white text-indigo-500 rounded-xl shadow-sm"><Star size={18}/></div>
                                    <span className="text-xs font-bold text-slate-500">Mẫu lương áp dụng</span>
                                </div>
                                <span className="text-sm font-black text-indigo-600 group-hover:scale-105 transition-transform truncate max-w-[150px]">{employee.salaryTemplateId || 'Chưa cấu hình'}</span>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">Công thực tế</p>
                                <p className="text-lg font-black text-slate-800">-- / 26</p>
                            </div>
                            <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">Chi tiết bảng công <ChevronRight size={14}/></button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch(activeSection) {
            case 'OVERVIEW_360': return renderOverview360();
            case 'BASIC':
                return (
                    <div className="space-y-10 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            <EditableField label="Mã nhân viên" field="code" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Mật khẩu đăng nhập" field="password" type="password" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Họ và tên đầy đủ" field="fullName" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Email đăng nhập" field="email" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Số điện thoại" field="phone" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Tình trạng hôn nhân" field="maritalStatus" options={[{v:'SINGLE', l:'Độc thân'},{v:'MARRIED', l:'Đã kết hôn'}]} editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Giới tính" field="gender" options={[{v:'MALE', l:'Nam'},{v:'FEMALE', l:'Nữ'},{v:'OTHER', l:'Khác'}]} editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Ngày sinh" field="dob" type="date" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Quốc tịch" field="nationality" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                        </div>
                    </div>
                );
            case 'JOB':
                return (
                    <div className="space-y-10 animate-in fade-in">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            <EditableField label="Vị trí / Chức danh" field="position" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Phòng ban" field="department" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Ngày thử việc" field="joiningDate" type="date" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                            <EditableField label="Ngày chính thức" field="officialDate" type="date" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                         </div>
                         <div className="space-y-4 pt-6 border-t border-slate-50">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Danh sách công trình phụ trách ({stats.involvedProjects.length})</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {stats.involvedProjects.map(p => (
                                    <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform"><HardHat size={16}/></div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{p.name}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-mono">{p.code}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-200'}`}>
                                            {p.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                         </div>
                    </div>
                );
            case 'SALARY_HISTORY':
                return (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Ngày</th>
                                        <th className="px-6 py-4">Nội dung diễn giải</th>
                                        <th className="px-6 py-4 text-right">Số tiền</th>
                                        <th className="px-6 py-4 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {stats.recentTransactions.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500">{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                                            <td className="px-6 py-4 font-bold text-slate-700">{t.description}</td>
                                            <td className={`px-6 py-4 text-right font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {t.type === TransactionType.INCOME ? '+' : '-'}{t.amount.toLocaleString()} ₫
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase">Hoàn tất</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'BANK':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        <EditableField label="Tên ngân hàng" field="bankName" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                        <EditableField label="Số tài khoản" field="bankAccount" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                        <EditableField label="Chi nhánh ngân hàng" field="bankBranch" editData={editData} isEditing={isEditing} setEditData={setEditData} />
                    </div>
                );
            default: return <div className="p-20 text-center text-slate-300 italic">Tính năng đang được cập nhật dữ liệu...</div>;
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-[#fcfdfe] rounded-[40px] shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-white/20">
                
                <div className="bg-white border-b border-slate-100 px-10 py-6 flex items-center justify-between shrink-0 z-10 shadow-sm">
                    <div className="flex items-center gap-8">
                        <button onClick={onClose} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors border border-transparent hover:border-slate-100">
                            <ArrowDownLeft size={24} className="rotate-45"/>
                        </button>
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-slate-900 rounded-[28px] flex items-center justify-center font-black text-3xl text-white shadow-xl relative group ring-4 ring-slate-50 overflow-hidden">
                                {employee.avatarUrl ? (
                                    <img src={employee.avatarUrl} className="w-full h-full object-cover" />
                                ) : employee.fullName.charAt(0)}
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{employee.fullName}</h2>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{employee.code}</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${employee.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{employee.status === 'ACTIVE' ? 'Đang làm việc' : 'Đã thôi việc'}</span>
                                </div>
                                <div className="flex gap-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest items-center">
                                    <p className="flex items-center gap-2"><Building2 size={14} className="text-indigo-400"/> {employee.department || 'Phòng quản lý'}</p>
                                    <p className="flex items-center gap-2"><Calendar size={14} className="text-blue-400"/> Chính thức: {employee.officialDate || '---'}</p>
                                    <p className="flex items-center gap-2"><Phone size={14} className="text-orange-400"/> {employee.phone || 'N/A'}</p>
                                    <p className="flex items-center gap-2 lowercase text-slate-400 font-medium"><Mail size={14} className="text-slate-300"/> {employee.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4 items-center">
                         {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-100 transition-all"><Edit size={16}/> Sửa hồ sơ</button>
                         ) : (
                            <div className="flex gap-2">
                                <button onClick={() => { setIsEditing(false); setEditData(employee); }} className="px-6 py-3 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600">Hủy</button>
                                <button onClick={handleSave} className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all"><Save size={16}/> Lưu thay đổi</button>
                            </div>
                         )}
                         <div className="h-10 w-px bg-slate-100 mx-2"></div>
                         <div className="bg-white px-6 py-2 rounded-2xl border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">KPI Hoàn thành</p>
                            <p className="text-lg font-black text-emerald-600">{stats.kpiCompletionRate}%</p>
                         </div>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-80 bg-white border-r border-slate-100 flex flex-col shrink-0 overflow-hidden shadow-[4px_0_12px_-4px_rgba(0,0,0,0.02)]">
                        <div className="p-6 shrink-0">
                            <div className="relative group">
                                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/>
                                <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500" placeholder="Tìm mục thông tin..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-1.5 pb-10">
                            {filteredSections.map(s => (
                                <button 
                                    key={s.id}
                                    onClick={() => setActiveSection(s.id)}
                                    className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeSection === s.id ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                                >
                                    <div className={`p-2 rounded-xl transition-colors ${activeSection === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                        <s.icon size={16}/>
                                    </div>
                                    <span className="truncate">{s.label}</span>
                                    {activeSection === s.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]"></div>}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="flex-1 bg-[#fcfdfe] p-12 overflow-y-auto custom-scrollbar">
                        <div className="max-w-4xl mx-auto space-y-10">
                            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                        {React.createElement(normalizedSections.find(s=>s.id===activeSection)?.icon || User, { size: 24 })}
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{normalizedSections.find(s=>s.id===activeSection)?.label}</h3>
                                </div>
                                {isEditing && (
                                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full animate-pulse">
                                        ĐANG TRONG CHẾ ĐỘ CHỈNH SỬA
                                    </span>
                                )}
                            </div>
                            <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm min-h-[500px]">
                                {renderContent()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Employee360Modal;
