
import React, { useState, useEffect } from 'react';
import { UserContext, TransactionType, SalaryType, Employee, SalaryTemplate, Project } from '../types';
import { parseQuickToken } from '../services/tokenService';
import { createSubmission } from '../services/submissionService';
import { getEmployeeById, getSalaryTypes, getSalaryTemplates } from '../services/employeeService';
import { saveTimesheets } from '../services/timesheetService';
import { fetchAllData } from '../services/sheetService'; // To get Projects
import { CheckCircle, AlertTriangle, Send, LogOut, Calendar, DollarSign, Briefcase, Clock, MapPin, Building2, LayoutDashboard } from 'lucide-react';

interface EmployeeSelfServicePageProps {
  token: string;
  onSuccess: () => void;
}

const EmployeeSelfServicePage: React.FC<EmployeeSelfServicePageProps> = ({ token, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [empData, setEmpData] = useState<{emp: Employee, role: string} | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'DAILY' | 'MONTHLY'>('DAILY');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- DAILY FORM STATE ---
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyProjectId, setDailyProjectId] = useState('OFFICE'); // Default to Office
  const [dailyWork, setDailyWork] = useState(1);
  const [dailyNote, setDailyNote] = useState('');

  // --- MONTHLY FORM STATE ---
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [workingDays, setWorkingDays] = useState<number>(26);
  const [revenue, setRevenue] = useState<number>(0);
  const [monthlyNote, setMonthlyNote] = useState('');

  useEffect(() => {
    validateAndLoad();
  }, [token]);

  const validateAndLoad = async () => {
    setLoading(true);
    try {
        const payload = parseQuickToken(token);
        if (!payload) throw new Error("Link hết hạn hoặc không hợp lệ.");
        
        // Load Employee & Projects
        const [emp, sheetData] = await Promise.all([
            getEmployeeById(payload.empId),
            fetchAllData()
        ]);

        if (!emp) throw new Error("Không tìm thấy thông tin nhân viên.");

        setEmpData({ emp, role: payload.type as any });
        setProjects(sheetData.projects);
        setLoading(false);
    } catch (e: any) {
        setError(e.message);
        setLoading(false);
    }
  };

  const handleDailySubmit = async () => {
      if (!empData) return;
      setIsSubmitting(true);
      try {
          // Construct Timesheet Entry
          const entry = {
              id: `ts_self_${Date.now()}`,
              date: dailyDate,
              empId: empData.emp.id,
              projectId: dailyProjectId,
              workUnits: Number(dailyWork),
              otHours: 0, // Simplified for now
              note: dailyNote,
              createdAt: new Date().toISOString()
          };
          
          await saveTimesheets([entry]);
          setSuccessMsg("Đã chấm công thành công! Hệ thống đã ghi nhận.");
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleMonthlySubmit = async () => {
      if (!empData) return;
      setIsSubmitting(true);
      try {
          await createSubmission(empData.emp.id, month, workingDays, revenue, monthlyNote);
          setSuccessMsg("Gửi báo cáo tháng thành công! Vui lòng chờ quản lý duyệt.");
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsSubmitting(false);
      }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50">Đang tải dữ liệu...</div>;
  if (error) return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
          <AlertTriangle size={48} className="text-red-500 mb-4"/>
          <h3 className="text-xl font-bold text-gray-800">Lỗi Truy Cập</h3>
          <p className="text-gray-600 mt-2">{error}</p>
      </div>
  );

  if (successMsg) return (
      <div className="h-screen flex flex-col items-center justify-center bg-green-50 p-4 text-center">
          <CheckCircle size={64} className="text-green-600 mb-4"/>
          <h3 className="text-2xl font-bold text-green-900 mb-2">Thành Công!</h3>
          <p className="text-green-700 mb-6">{successMsg}</p>
          <button onClick={() => { setSuccessMsg(''); window.location.reload(); }} className="px-8 py-3 bg-white border border-green-200 text-green-700 font-bold rounded-xl shadow-sm hover:shadow-md transition-all">
              Thực hiện tiếp
          </button>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Header */}
        <div className="bg-indigo-700 text-white px-6 py-5 shadow-md">
            <div className="flex justify-between items-center mb-1">
                <h1 className="text-xl font-bold flex items-center"><Briefcase className="mr-2"/> Cổng Nhân Viên</h1>
                <div className="text-xs bg-indigo-800 px-2 py-1 rounded">{empData?.emp.code}</div>
            </div>
            <p className="text-sm opacity-90">Xin chào, <b>{empData?.emp.fullName}</b></p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white px-4 pt-4 shadow-sm border-b border-gray-200 flex gap-4">
            <button 
                onClick={() => setActiveTab('DAILY')}
                className={`flex-1 pb-3 text-sm font-bold border-b-4 transition-colors ${activeTab === 'DAILY' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}
            >
                Chấm Công Ngày
            </button>
            <button 
                onClick={() => setActiveTab('MONTHLY')}
                className={`flex-1 pb-3 text-sm font-bold border-b-4 transition-colors ${activeTab === 'MONTHLY' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500'}`}
            >
                Báo Cáo Tháng
            </button>
        </div>

        <div className="p-4 flex-1 flex justify-center">
            <div className="w-full max-w-md space-y-6">
                
                {/* DAILY TAB */}
                {activeTab === 'DAILY' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center">
                            <Clock size={18} className="text-blue-600 mr-2"/>
                            <span className="font-bold text-blue-800">Chấm công hôm nay</span>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Ngày làm việc</label>
                                <input type="date" className="w-full p-3 border rounded-lg bg-gray-50 font-bold" value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Địa điểm / Công trình</label>
                                <div className="relative">
                                    <MapPin size={18} className="absolute left-3 top-3.5 text-gray-400"/>
                                    <select 
                                        className="w-full pl-10 p-3 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
                                        value={dailyProjectId}
                                        onChange={e => setDailyProjectId(e.target.value)}
                                    >
                                        <option value="OFFICE">🏢 Văn phòng / Hành chính</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>🏗️ {p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Thời gian</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setDailyWork(1)}
                                        className={`p-3 rounded-lg border font-bold text-center transition-all ${dailyWork === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    >
                                        Cả ngày (1.0)
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setDailyWork(0.5)}
                                        className={`p-3 rounded-lg border font-bold text-center transition-all ${dailyWork === 0.5 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    >
                                        Nửa ngày (0.5)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú (Nếu có)</label>
                                <textarea className="w-full p-3 border rounded-lg" rows={2} placeholder="VD: Làm thêm 1h, đi gặp khách..." value={dailyNote} onChange={e => setDailyNote(e.target.value)} />
                            </div>

                            <button 
                                onClick={handleDailySubmit}
                                disabled={isSubmitting}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-transform flex items-center justify-center"
                            >
                                {isSubmitting ? 'Đang lưu...' : 'XÁC NHẬN CHẤM CÔNG'}
                            </button>
                        </div>
                    </div>
                )}

                {/* MONTHLY TAB */}
                {activeTab === 'MONTHLY' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex items-center">
                            <LayoutDashboard size={18} className="text-orange-600 mr-2"/>
                            <span className="font-bold text-orange-800">Tổng kết tháng</span>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 mb-4 border border-yellow-100">
                                Dùng để báo cáo tổng số công và doanh số cuối tháng để tính lương.
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tháng báo cáo</label>
                                <input type="month" className="w-full p-3 border rounded-lg bg-gray-50 font-bold" value={month} onChange={e => setMonth(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Tổng ngày công thực tế</label>
                                <input type="number" className="w-full p-3 border rounded-lg font-bold" value={workingDays} onChange={e => setWorkingDays(Number(e.target.value))} />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Doanh số đạt được (nếu có)</label>
                                <input type="number" className="w-full p-3 border rounded-lg font-bold text-green-600" value={revenue} onChange={e => setRevenue(Number(e.target.value))} placeholder="0" />
                            </div>

                            <button 
                                onClick={handleMonthlySubmit}
                                disabled={isSubmitting}
                                className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold shadow-lg hover:bg-orange-700 active:scale-95 transition-transform"
                            >
                                {isSubmitting ? 'Đang gửi...' : 'GỬI BÁO CÁO THÁNG'}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};

export default EmployeeSelfServicePage;
