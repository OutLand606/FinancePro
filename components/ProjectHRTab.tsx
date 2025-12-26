
import React, { useState, useEffect } from 'react';
import { Project, Employee, Transaction, TransactionType } from '../types';
import { getEmployees, updateEmployee } from '../services/employeeService';
import { updateProject } from '../services/sheetService';
import { User, ShieldCheck, HardHat, Plus, X, Briefcase, Mail, Phone, ExternalLink, UserPlus, CheckCircle, Search, Trash2 } from 'lucide-react';

interface ProjectHRTabProps {
    project: Project;
    transactions: Transaction[];
}

interface EmployeeCardProps {
    emp: Employee;
    roleLabel: string;
    colorClass: string;
    type?: 'SALES' | 'LABOR';
    expenseAmount: number;
    onRemove?: (type: 'SALES' | 'LABOR', empId: string) => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ emp, roleLabel, colorClass, type, expenseAmount, onRemove }) => (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
        <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-inner ${colorClass}`}>
                {emp.fullName.charAt(0)}
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900">{emp.fullName}</h4>
                    <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded uppercase text-slate-500">{roleLabel}</span>
                </div>
                <div className="flex gap-3 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1 font-medium"><Phone size={12}/> {emp.phone || 'N/A'}</span>
                    <span className="flex items-center gap-1 font-medium"><Briefcase size={12}/> {emp.position || 'Nhân viên'}</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đã tạm ứng/chi</p>
                <p className="font-black text-indigo-600">{expenseAmount.toLocaleString()} ₫</p>
            </div>
            {type && onRemove && (
                <button onClick={() => onRemove(type, emp.id)} className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={16}/>
                </button>
            )}
        </div>
    </div>
);

const ProjectHRTab: React.FC<ProjectHRTabProps> = ({ project, transactions }) => {
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [showAddModal, setShowAddModal] = useState<{ isOpen: boolean, type: 'SALES' | 'LABOR' | 'MANAGER' }>({ isOpen: false, type: 'SALES' });
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        getEmployees().then(setAllEmployees);
    }, []);

    const manager = allEmployees.find(e => e.id === project.managerEmpId);
    const salesTeam = allEmployees.filter(e => project.salesEmpIds?.includes(e.id));
    const laborTeam = allEmployees.filter(e => project.laborEmpIds?.includes(e.id));

    const getPersonalExpense = (empId: string) => {
        return transactions
            .filter(t => t.projectId === project.id && (t.employeeId === empId || t.partnerId === empId))
            .reduce((sum, t) => sum + t.amount, 0);
    };

    const handleAssignPersonnel = async (empId: string) => {
        let updatedProject = { ...project };
        if (showAddModal.type === 'MANAGER') {
            updatedProject.managerEmpId = empId;
        } else if (showAddModal.type === 'SALES') {
            const current = project.salesEmpIds || [];
            updatedProject.salesEmpIds = current.includes(empId) ? current : [...current, empId];
        } else if (showAddModal.type === 'LABOR') {
            const current = project.laborEmpIds || [];
            updatedProject.laborEmpIds = current.includes(empId) ? current : [...current, empId];
        }

        await updateProject(updatedProject);
        // Cập nhật state local để UI phản hồi nhanh
        Object.assign(project, updatedProject);
        setShowAddModal({ ...showAddModal, isOpen: false });
    };

    const handleRemovePersonnel = async (type: 'SALES' | 'LABOR', empId: string) => {
        if (!confirm("Gỡ nhân sự này khỏi dự án?")) return;
        let updatedProject = { ...project };
        if (type === 'SALES') {
            updatedProject.salesEmpIds = (project.salesEmpIds || []).filter(id => id !== empId);
        } else {
            updatedProject.laborEmpIds = (project.laborEmpIds || []).filter(id => id !== empId);
        }
        await updateProject(updatedProject);
        Object.assign(project, updatedProject);
        window.location.reload(); // Cách đơn giản nhất để cập nhật dữ liệu toàn cục
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* 1. QUẢN LÝ CHÍNH */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck size={14} className="text-indigo-600"/> Quản lý dự án (PM/Giám sát)
                    </h3>
                    <button onClick={() => setShowAddModal({ isOpen: true, type: 'MANAGER' })} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest flex items-center"><UserPlus size={14} className="mr-1"/> Thay đổi</button>
                </div>
                {manager ? (
                    <EmployeeCard key={manager.id} emp={manager} roleLabel="PM" colorClass="bg-indigo-50 text-indigo-600" expenseAmount={getPersonalExpense(manager.id)} />
                ) : (
                    <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 italic text-sm">
                        Chưa chỉ định quản lý chính.
                    </div>
                )}
            </section>

            {/* 2. ĐỘI NGŨ KINH DOANH */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Briefcase size={14} className="text-emerald-600"/> Phụ trách kinh doanh (Tính doanh số KPI)
                    </h3>
                    <button onClick={() => setShowAddModal({ isOpen: true, type: 'SALES' })} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest flex items-center"><UserPlus size={14} className="mr-1"/> Thêm người</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {salesTeam.map(emp => (
                        <EmployeeCard key={emp.id} emp={emp} roleLabel="Sales" colorClass="bg-emerald-50 text-emerald-600" type="SALES" expenseAmount={getPersonalExpense(emp.id)} onRemove={handleRemovePersonnel}/>
                    ))}
                    {salesTeam.length === 0 && <p className="text-sm text-slate-400 italic bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center">Chưa có nhân sự kinh doanh phụ trách.</p>}
                </div>
            </section>

            {/* 3. ĐỘI THI CÔNG / NHÂN CÔNG */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <HardHat size={14} className="text-orange-600"/> Đội ngũ thi công tham gia
                    </h3>
                    <button onClick={() => setShowAddModal({ isOpen: true, type: 'LABOR' })} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest flex items-center"><UserPlus size={14} className="mr-1"/> Thêm đội thợ</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {laborTeam.map(emp => (
                        <EmployeeCard key={emp.id} emp={emp} roleLabel="Worker" colorClass="bg-orange-50 text-orange-600" type="LABOR" expenseAmount={getPersonalExpense(emp.id)} onRemove={handleRemovePersonnel}/>
                    ))}
                    {laborTeam.length === 0 && <p className="text-sm text-slate-400 italic bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center">Chưa gán đội thợ tham gia công trình.</p>}
                </div>
            </section>

            {/* Thống kê Footer */}
            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <User size={16} className="text-indigo-400"/>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Thống kê nhân sự 360° (Dữ liệu Thực tế)</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                        <div>
                            <p className="text-3xl font-black">{1 + salesTeam.length + laborTeam.length}</p>
                            <p className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-1">Tổng nhân sự</p>
                        </div>
                        <div>
                            <p className="text-3xl font-black text-emerald-400">
                                {transactions
                                    .filter(t => t.projectId === project.id && t.isLaborCost && t.status === 'PAID')
                                    .reduce((s,t) => s + t.amount, 0).toLocaleString()} ₫
                            </p>
                            <p className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-1">Lương & Nhân công đã chi</p>
                        </div>
                        <div>
                            <p className="text-3xl font-black text-indigo-400">
                                {transactions
                                    .filter(t => t.projectId === project.id && t.type === TransactionType.INCOME && t.status === 'PAID')
                                    .reduce((s,t) => s + t.amount, 0).toLocaleString()} ₫
                            </p>
                            <p className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-1">Doanh số thực thu</p>
                        </div>
                    </div>
                </div>
                <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
                    <HardHat size={180}/>
                </div>
            </div>

            {/* MODAL GÁN NHÂN SỰ */}
            {showAddModal.isOpen && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                        <div className="px-8 py-6 border-b bg-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Gán Nhân Sự Phụ Trách</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {showAddModal.type === 'SALES' ? 'Chọn nhân viên tính doanh số KPI' : showAddModal.type === 'LABOR' ? 'Chọn nhân sự tham gia thi công' : 'Chọn quản lý chính dự án'}
                                </p>
                            </div>
                            <button onClick={() => setShowAddModal({ ...showAddModal, isOpen: false })} className="p-2 hover:bg-white rounded-full text-slate-400"><X size={24}/></button>
                        </div>
                        <div className="p-6 shrink-0 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                                <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tìm tên hoặc mã NV..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
                            {allEmployees
                                .filter(e => e.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || e.code.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map(emp => (
                                    <button 
                                        key={emp.id} 
                                        onClick={() => handleAssignPersonnel(emp.id)}
                                        className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100 group"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-white flex items-center justify-center font-black text-slate-400 group-hover:text-indigo-600 shadow-inner">
                                            {emp.fullName.charAt(0)}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-black text-slate-800">{emp.fullName}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{emp.code} • {emp.position}</p>
                                        </div>
                                        <div className="ml-auto opacity-0 group-hover:opacity-100 text-indigo-600"><CheckCircle size={18}/></div>
                                    </button>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectHRTab;
