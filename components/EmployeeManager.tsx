
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getEmployees, updateEmployee, createEmployee, getSalaryTemplates } from '../services/employeeService';
import { getSystemRoles } from '../services/systemConfigService';
import { Employee, SystemRole, GlobalDataProps, SalaryTemplate } from '../types';
import { 
  Users, Plus, Search, UserCircle, Briefcase, Phone, Mail, 
  Edit, Trash2, X, Eye, List as ListIcon, Grid as GridIcon,
  Upload, Camera, Info, Heart, Shield, Wallet, FileText, Truck,
  MapPin, Calendar, CreditCard, ChevronRight, Download, Filter, DollarSign, RefreshCw, Lock
} from 'lucide-react';
import Employee360Modal from './Employee360Modal';

// --- SUB-COMPONENTS MOVED OUTSIDE TO FIX FOCUS LOSS ---
const FormSection = ({ title, icon: Icon, id, activeTab, children }: any) => (
    <div className={activeTab === id ? 'block animate-in fade-in' : 'hidden'}>
        <div className="flex items-center gap-2 mb-6 border-b pb-2">
            <Icon size={18} className="text-indigo-600"/>
            <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest">{title}</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {children}
        </div>
    </div>
);

const InputField = ({ label, value, onChange, placeholder, type = "text", options, disabled = false, icon: Icon }: any) => (
    <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
        <div className="relative">
            {options ? (
                <select 
                    className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    value={value || ''} 
                    onChange={e => onChange(e.target.value)}
                    disabled={disabled}
                >
                    <option value="">-- Chọn --</option>
                    {options.map((opt:any) => <option key={opt.v} value={opt.v}>{opt.l}</option>)}
                </select>
            ) : (
                <input 
                    type={type} 
                    className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold focus:border-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder={placeholder} 
                    value={value || ''} 
                    onChange={e => onChange(e.target.value)} 
                    disabled={disabled}
                />
            )}
            {Icon && <Icon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>}
        </div>
    </div>
);

const EmployeeManager: React.FC<GlobalDataProps> = ({ transactions, projects, contracts }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [templates, setTemplates] = useState<SalaryTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('LIST');
  
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Partial<Employee>>({});
  const [activeFormTab, setActiveFormTab] = useState('BASIC');
  const [viewing360Emp, setViewing360Emp] = useState<Employee | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
        const [emps, tpls] = await Promise.all([
            getEmployees(),
            getSalaryTemplates()
        ]);
        setEmployees(emps);
        setTemplates(tpls);
        setRoles( await getSystemRoles());
    } catch (e) {
        console.error("Failed to load employee data", e);
    }
  };

  const departments = useMemo(() => {
      const depts = new Set(employees.map(e => e.department).filter(d => d));
      return ['ALL', ...Array.from(depts)];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = (e.fullName + e.code + e.email).toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || e.status === statusFilter;
      const matchDept = deptFilter === 'ALL' || e.department === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [employees, searchTerm, statusFilter, deptFilter]);

  const handleExport = () => {
      const headers = ['Mã NV', 'Họ Tên', 'Email', 'Điện thoại', 'Phòng ban', 'Chức danh', 'Trạng thái'];
      const rows = filteredEmployees.map(e => [e.code, e.fullName, e.email, e.phone || '', e.department || '', e.position || '', e.status]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Danh_Sach_Nhan_Su_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
  };

  const generateEmployeeCode = () => {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `NV-${year}${month}-${random}`;
  };

  const handleOpenCreate = () => {
      setEditingEmp({
          status: 'ACTIVE', 
          roleId: 'role_staff',
          code: generateEmployeeCode(), // Auto-generate code
          joiningDate: new Date().toISOString().split('T')[0],
          password: '123456' // Mật khẩu mặc định khi tạo mới
      }); 
      setShowEmpModal(true); 
      setActiveFormTab('BASIC');
  };

  const handleRegenerateCode = () => {
      setEditingEmp(prev => ({...prev, code: generateEmployeeCode()}));
  };

  const handleSaveEmployee = async (data?: Employee) => {
      const target = data || editingEmp;
      if(!target.fullName || !target.email) {
          alert("Vui lòng nhập ít nhất Họ tên và Email");
          return;
      }
      
      const emp: Employee = {
          id: target.id || `emp_${Date.now()}`,
          code: target.code || generateEmployeeCode(),
          fullName: target.fullName,
          email: target.email,
          password: target.password || '123456', // Ensure password is saved
          roleId: target.roleId || 'role_staff',
          status: target.status || 'ACTIVE',
          managedProjectIds: target.managedProjectIds || [],
          createdAt: target.createdAt || new Date().toISOString(),
          ...target
      } as Employee;
      
      try {
          if (target.id) {
              await updateEmployee(emp);
              if (viewing360Emp?.id === emp.id) setViewing360Emp(emp);
          } else {
              await createEmployee(emp);
          }
          await loadData(); // Reload list
          setShowEmpModal(false);
      } catch (e: any) {
          alert("Lỗi lưu nhân viên: " + e.message);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setEditingEmp(prev => ({ ...prev, avatarUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20 -m-8 h-screen flex flex-col bg-[#fcfdfe]">
      <div className="bg-white border-b border-slate-100 px-10 py-6 flex items-center justify-between shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-[18px] text-white shadow-lg shadow-indigo-100">
                  <Users size={24}/>
              </div>
              <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Quản lý Nhân sự</h1>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hồ sơ điện tử & Quản trị 360°</p>
              </div>
          </div>
          
          <div className="flex items-center gap-3">
              <button onClick={handleExport} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all" title="Xuất CSV">
                  <Download size={18}/>
              </button>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><ListIcon size={18}/></button>
                  <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}><GridIcon size={18}/></button>
              </div>
              <button 
                onClick={handleOpenCreate}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center"
              >
                <Plus size={18} className="mr-2"/> Tuyển dụng mới
              </button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-6">
                  <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                        placeholder="Tìm theo tên, mã NV, email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <div className="h-10 w-px bg-slate-100"></div>
                  <div className="flex items-center gap-3">
                      <Filter size={16} className="text-slate-300"/>
                      <select className="border-none bg-transparent font-bold text-xs outline-none text-slate-600" value={deptFilter} onChange={e=>setDeptFilter(e.target.value)}>
                          <option value="ALL">Tất cả phòng ban</option>
                          {departments.filter(d=>d!=='ALL').map(d=><option key={d} value={d}>{d}</option>)}
                      </select>
                  </div>
              </div>
          </div>

          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-100">
                      <tr>
                          <th className="px-8 py-5">Nhân viên</th>
                          <th className="px-6 py-5">Phòng ban / Chức danh</th>
                          <th className="px-6 py-5">Thông tin liên hệ</th>
                          <th className="px-6 py-5 text-center">Trạng thái</th>
                          <th className="px-8 py-5 text-right"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredEmployees.map(e => (
                          <tr key={e.id} className="hover:bg-slate-50/50 transition-all group cursor-pointer" onClick={() => setViewing360Emp(e)}>
                              <td className="px-8 py-4">
                                  <div className="flex items-center gap-4">
                                      {e.avatarUrl ? (
                                          <img src={e.avatarUrl} className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                                      ) : (
                                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 border border-indigo-100">
                                              {e.fullName.charAt(0)}
                                          </div>
                                      )}
                                      <div>
                                          <div className="font-black text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{e.fullName}</div>
                                          <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{e.code}</div>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="font-bold text-slate-700 text-xs">{e.position || 'Nhân viên'}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">{e.department || 'Văn phòng'}</div>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1">
                                      <div className="flex items-center text-[11px] font-bold text-slate-600"><Phone size={12} className="mr-1.5 text-slate-300"/> {e.phone || '---'}</div>
                                      <div className="flex items-center text-[11px] font-medium text-slate-400"><Mail size={12} className="mr-1.5 text-slate-300"/> {e.email}</div>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${e.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                                      {e.status === 'ACTIVE' ? 'Đang làm' : 'Đã nghỉ'}
                                  </span>
                              </td>
                              <td className="px-8 py-4 text-right">
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={(ev) => { ev.stopPropagation(); setViewing360Emp(e); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-white hover:shadow-md rounded-xl transition-all"><Eye size={16}/></button>
                                      <button onClick={(ev) => { ev.stopPropagation(); setEditingEmp(e); setShowEmpModal(true); setActiveFormTab('BASIC'); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-md rounded-xl transition-all"><Edit size={16}/></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {showEmpModal && (
          <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-[40px] w-full max-w-5xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col h-[85vh]">
                  <div className="px-10 py-6 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
                      <div>
                        <h3 className="font-black text-xl uppercase tracking-tighter text-slate-900">{editingEmp.id ? 'Sửa hồ sơ nhân sự' : 'Tuyển dụng nhân sự mới'}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Đồng thời tạo tài khoản đăng nhập</p>
                      </div>
                      <button onClick={()=>setShowEmpModal(false)} className="p-3 hover:bg-white rounded-full text-slate-400"><X size={28}/></button>
                  </div>

                  <div className="flex-1 flex overflow-hidden">
                      <div className="w-64 border-r bg-slate-50/30 p-6 flex flex-col gap-1 shrink-0 overflow-y-auto custom-scrollbar">
                          {[
                              {id:'BASIC', l:'Thông tin cơ bản', i:UserCircle},
                              {id:'JOB', l:'Công việc & Vai trò', i:Briefcase},
                              {id:'SALARY', l:'Cấu hình Lương', i:DollarSign},
                              {id:'FAMILY', l:'Gia đình', i:Heart},
                              {id:'HEALTH', l:'Tiêm chủng & BH', i:Shield},
                              {id:'FINANCE', l:'Ngân hàng', i:CreditCard},
                              {id:'ASSETS', l:'Tài sản', i:Truck},
                          ].map(t => (
                              <button key={t.id} onClick={() => setActiveFormTab(t.id)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeFormTab === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}>
                                  <t.i size={16}/> {t.l}
                              </button>
                          ))}
                      </div>

                      <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-white">
                          <FormSection id="BASIC" title="Thông tin cá nhân" icon={UserCircle} activeTab={activeFormTab}>
                              <div className="md:col-span-2 flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 mb-4">
                                 <div className="w-24 h-24 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 relative overflow-hidden group">
                                     {editingEmp.avatarUrl ? (
                                         <img src={editingEmp.avatarUrl} className="w-full h-full object-cover" />
                                     ) : <Camera size={24}/>}
                                     <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity">
                                         <Upload size={20}/>
                                     </div>
                                     <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-700">Ảnh đại diện</p>
                                    <p className="text-xs text-slate-400">Click để thay đổi ảnh hồ sơ (Max 2MB)</p>
                                 </div>
                              </div>
                              <InputField label="Họ và Tên nhân viên *" value={editingEmp.fullName} onChange={(v:string)=>setEditingEmp(prev => ({...prev, fullName: v}))} />
                              <div className="relative">
                                  <InputField label="Mã nhân viên (Tự động)" value={editingEmp.code} onChange={(v:string)=>setEditingEmp(prev => ({...prev, code: v}))} />
                                  <button onClick={handleRegenerateCode} className="absolute right-3 top-8 text-slate-400 hover:text-indigo-600" title="Tạo mã mới"><RefreshCw size={16}/></button>
                              </div>
                              <InputField label="Ngày sinh" type="date" value={editingEmp.dob} onChange={(v:string)=>setEditingEmp(prev => ({...prev, dob: v}))} />
                              <InputField label="Giới tính" options={[{v:'MALE', l:'Nam'},{v:'FEMALE', l:'Nữ'},{v:'OTHER', l:'Khác'}]} value={editingEmp.gender} onChange={(v:any)=>setEditingEmp(prev => ({...prev, gender: v}))} />
                              <InputField label="Số CMND/CCCD" value={editingEmp.idNumber} onChange={(v:string)=>setEditingEmp(prev => ({...prev, idNumber: v}))} />
                              <InputField label="MST cá nhân" value={editingEmp.personalTaxCode} onChange={(v:string)=>setEditingEmp(prev => ({...prev, personalTaxCode: v}))} />
                              <InputField label="Tình trạng hôn nhân" options={[{v:'SINGLE', l:'Độc thân'},{v:'MARRIED', l:'Đã kết hôn'}]} value={editingEmp.maritalStatus} onChange={(v:any)=>setEditingEmp(prev => ({...prev, maritalStatus: v}))} />
                              <InputField label="Nguyên quán" value={editingEmp.hometown} onChange={(v:string)=>setEditingEmp(prev => ({...prev, hometown: v}))} />
                              <InputField label="Dân tộc" value={editingEmp.ethnic} onChange={(v:string)=>setEditingEmp(prev => ({...prev, ethnic: v}))} />
                              <InputField label="Tôn giáo" value={editingEmp.religion} onChange={(v:string)=>setEditingEmp(prev => ({...prev, religion: v}))} />
                              <InputField label="Quốc tịch" value={editingEmp.nationality} onChange={(v:string)=>setEditingEmp(prev => ({...prev, nationality: v}))} />
                          </FormSection>

                          <FormSection id="JOB" title="Thông tin công tác" icon={Briefcase} activeTab={activeFormTab}>
                              <InputField label="Phòng ban" value={editingEmp.department} onChange={(v:string)=>setEditingEmp(prev => ({...prev, department: v}))} />
                              <InputField label="Chức danh" value={editingEmp.position} onChange={(v:string)=>setEditingEmp(prev => ({...prev, position: v}))} />
                              <InputField label="Email công tác (Login) *" value={editingEmp.email} onChange={(v:string)=>setEditingEmp(prev => ({...prev, email: v}))} />
                              <InputField label="Mật khẩu đăng nhập" value={editingEmp.password} onChange={(v:string)=>setEditingEmp(prev => ({...prev, password: v}))} type="password" placeholder="Mặc định: 123456" />
                              <InputField label="Số điện thoại" value={editingEmp.phone} onChange={(v:string)=>setEditingEmp(prev => ({...prev, phone: v}))} />
                              <InputField label="Ngày thử việc" type="date" value={editingEmp.joiningDate} onChange={(v:string)=>setEditingEmp(prev => ({...prev, joiningDate: v}))} />
                              <InputField label="Ngày chính thức" type="date" value={editingEmp.officialDate} onChange={(v:string)=>setEditingEmp(prev => ({...prev, officialDate: v}))} />
                              
                              <InputField label="Phân quyền hệ thống" options={roles.map(r=>({v:r.id, l:r.name}))} value={editingEmp.roleId} onChange={(v:string)=>setEditingEmp(prev => ({...prev, roleId: v}))} />
                              
                              <InputField label="Trạng thái" options={[{v:'ACTIVE', l:'Đang làm việc'},{v:'INACTIVE', l:'Đã nghỉ'}]} value={editingEmp.status} onChange={(v:any)=>setEditingEmp(prev => ({...prev, status: v}))} />
                          </FormSection>

                          <FormSection id="SALARY" title="Cấu hình Lương thỏa thuận" icon={DollarSign} activeTab={activeFormTab}>
                              <InputField 
                                label="Mẫu bảng lương áp dụng" 
                                options={templates.map(t=>({v:t.id, l:t.name}))} 
                                value={editingEmp.salaryTemplateId} 
                                onChange={(v:string)=>setEditingEmp(prev => ({...prev, salaryTemplateId: v}))} 
                              />
                              <InputField label="Lương cơ bản (Theo tháng) *" type="number" value={editingEmp.baseSalary} onChange={(v:string)=>setEditingEmp(prev => ({...prev, baseSalary: Number(v)}))} placeholder="6,000,000" />
                              <InputField label="Phụ cấp cố định" type="number" value={editingEmp.fixedAllowance} onChange={(v:string)=>setEditingEmp(prev => ({...prev, fixedAllowance: Number(v)}))} placeholder="1,000,000" />
                              <InputField label="Mức đóng bảo hiểm" type="number" value={editingEmp.insuranceSalary} onChange={(v:string)=>setEditingEmp(prev => ({...prev, insuranceSalary: Number(v)}))} placeholder="5,000,000" />
                              <InputField label="Số người phụ thuộc" type="number" value={editingEmp.dependents} onChange={(v:string)=>setEditingEmp(prev => ({...prev, dependents: Number(v)}))} />
                          </FormSection>

                          <FormSection id="FAMILY" title="Gia đình & Liên hệ khẩn cấp" icon={Heart} activeTab={activeFormTab}>
                              <div className="md:col-span-2">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Thông tin người thân</label>
                                  <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold h-32 outline-none focus:border-indigo-500" placeholder="Ví dụ: Vợ: Nguyễn Thị C - 098xxxxx" value={editingEmp.familyDetails || ''} onChange={e=>setEditingEmp(prev => ({...prev, familyDetails: e.target.value}))} />
                              </div>
                          </FormSection>

                          <FormSection id="HEALTH" title="Bảo hiểm & Tiêm chủng" icon={Shield} activeTab={activeFormTab}>
                              <InputField label="Số sổ BHXH" value={editingEmp.socialInsuranceNumber} onChange={(v:string)=>setEditingEmp(prev => ({...prev, socialInsuranceNumber: v}))} />
                              <InputField label="Trạng thái đóng BH" value={editingEmp.insuranceStatus} onChange={(v:string)=>setEditingEmp(prev => ({...prev, insuranceStatus: v}))} />
                              <div className="md:col-span-2">
                                  <InputField label="Lịch sử tiêm chủng" value={editingEmp.vaccineInfo} onChange={(v:string)=>setEditingEmp(prev => ({...prev, vaccineInfo: v}))} />
                              </div>
                          </FormSection>

                          <FormSection id="FINANCE" title="Tài khoản nhận lương" icon={CreditCard} activeTab={activeFormTab}>
                              <InputField label="Tên ngân hàng" value={editingEmp.bankName} onChange={(v:string)=>setEditingEmp(prev => ({...prev, bankName: v}))} />
                              <InputField label="Số tài khoản" value={editingEmp.bankAccount} onChange={(v:string)=>setEditingEmp(prev => ({...prev, bankAccount: v}))} />
                              <InputField label="Chi nhánh" value={editingEmp.bankBranch} onChange={(v:string)=>setEditingEmp(prev => ({...prev, bankBranch: v}))} />
                          </FormSection>
                          
                          <FormSection id="ASSETS" title="Trang thiết bị & Tài sản" icon={Truck} activeTab={activeFormTab}>
                               <div className="md:col-span-2">
                                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Danh sách tài sản cấp phát</label>
                                  <textarea className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold h-32 outline-none focus:border-indigo-500" placeholder="Máy tính, Đồng phục, Thẻ tên..." value={editingEmp.assignedAssets || ''} onChange={e=>setEditingEmp(prev => ({...prev, assignedAssets: e.target.value}))} />
                              </div>
                          </FormSection>
                      </div>
                  </div>

                  <div className="px-10 py-8 bg-slate-50 border-t flex justify-end gap-4 shrink-0 shadow-inner">
                      <button onClick={()=>setShowEmpModal(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-colors">Hủy bỏ</button>
                      <button onClick={() => handleSaveEmployee()} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">Lưu & Tạo tài khoản</button>
                  </div>
              </div>
          </div>
      )}

      {viewing360Emp && (
          <Employee360Modal 
            employee={viewing360Emp}
            transactions={transactions}
            projects={projects}
            contracts={contracts}
            onClose={() => setViewing360Emp(null)}
            onUpdateEmployee={handleSaveEmployee}
          />
      )}
    </div>
  );
};

export default EmployeeManager;
