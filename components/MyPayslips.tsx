
import React, { useState, useEffect } from 'react';
import { Payslip, UserContext, Employee, SalaryComponent } from '../types';
import { getPayrollRun } from '../services/payrollService'; 
import { getEmployeeById } from '../services/employeeService';
import { DollarSign, Calendar, Printer, Settings, Type, Edit, Info } from 'lucide-react';

interface MyPayslipsProps {
    currentUser: UserContext;
}

const MyPayslips: React.FC<MyPayslipsProps> = ({ currentUser }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [mySlip, setMySlip] = useState<Payslip | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<Employee | undefined>(undefined);
  
  // Customization State
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>('serif');
  const [showSettings, setShowSettings] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
      name: 'CÔNG TY TNHH E&C THÁI BÌNH DƯƠNG',
      address: 'Tầng 5, Tòa nhà Bitexco, Q1, TP.HCM'
  });

  useEffect(() => {
      if (currentUser) {
          getEmployeeById(currentUser.id).then(setEmployeeDetails);
          
          getPayrollRun(selectedMonth).then((run) => {
              if (run) {
                  const found = run.slips.find(s => s.empId === currentUser.id);
                  setMySlip(found || null);
              } else {
                  setMySlip(null);
              }
          });
      }
  }, [selectedMonth, currentUser]);

  const handlePrint = () => {
      window.print();
  };

  if (!currentUser) return <div className="p-10 text-center">Vui lòng đăng nhập để xem lương.</div>;

  const formatMoney = (amount: number) => amount?.toLocaleString('vi-VN') + ' đ';

  // Helper to categorize components
  const getComponentsByType = (type: string) => {
      if (!mySlip || !mySlip.templateSnapshot) return [];
      return mySlip.templateSnapshot.components.filter(c => c.type === type);
  };

  const incomeComponents = getComponentsByType('LUONG');
  const deductionComponents = getComponentsByType('KHAU_TRU');

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <div className="flex justify-between items-center no-print bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Phiếu Lương Cá Nhân</h1>
            <div className="flex items-center gap-2">
                <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Settings size={20}/>
                </button>
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-white">
                    <Calendar size={18} className="text-gray-500" />
                    <input 
                        type="month" 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="outline-none bg-transparent text-sm font-medium" 
                    />
                </div>
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-md">
                    <Printer size={16}/> In Phiếu
                </button>
            </div>
        </div>

        {/* SETTINGS PANEL */}
        {showSettings && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 no-print animate-in slide-in-from-top-2">
                <h3 className="font-bold text-sm text-slate-700 mb-3 flex items-center"><Type size={16} className="mr-2"/> Tùy chỉnh mẫu in</h3>
                <div className="flex gap-6 flex-wrap">
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Kiểu chữ (Font)</label>
                        <select className="text-sm border rounded p-1" value={fontFamily} onChange={(e) => setFontFamily(e.target.value as any)}>
                            <option value="serif">Có chân (Times New Roman)</option>
                            <option value="sans">Không chân (Arial/Inter)</option>
                            <option value="mono">Máy đánh chữ (Courier)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Chế độ hiển thị</label>
                        <div className="flex gap-4">
                            <label className="flex items-center text-sm cursor-pointer">
                                <input type="checkbox" checked={compactMode} onChange={e => setCompactMode(e.target.checked)} className="mr-2"/>
                                Thu gọn
                            </label>
                            <label className="flex items-center text-sm cursor-pointer">
                                <input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} className="mr-2"/>
                                Hiển thị công thức tính
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">Thông tin doanh nghiệp</label>
                        <button onClick={() => setIsEditingCompany(!isEditingCompany)} className="text-xs flex items-center text-blue-600 hover:underline">
                            <Edit size={12} className="mr-1"/> Sửa tiêu đề phiếu
                        </button>
                    </div>
                </div>
            </div>
        )}

        {mySlip ? (
            <div 
                className={`bg-white shadow-xl border border-gray-300 overflow-hidden print:shadow-none print:border-none text-slate-900 ${fontFamily === 'serif' ? 'font-serif' : fontFamily === 'mono' ? 'font-mono' : 'font-sans'}`} 
                id="payslip-print"
            >
                <div className={`p-10 ${compactMode ? 'space-y-4' : 'space-y-8'}`}>
                    {/* HEADER */}
                    <div className="text-center border-b-2 border-gray-800 pb-4 relative group">
                        {isEditingCompany ? (
                            <div className="no-print space-y-2 mb-2">
                                <input className="w-full text-center font-bold border p-1" value={companyInfo.name} onChange={e=>setCompanyInfo({...companyInfo, name: e.target.value})} />
                                <input className="w-full text-center text-xs border p-1" value={companyInfo.address} onChange={e=>setCompanyInfo({...companyInfo, address: e.target.value})} />
                                <button onClick={() => setIsEditingCompany(false)} className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-700">Xong</button>
                            </div>
                        ) : (
                            <>
                                <h3 className="font-bold uppercase text-xs tracking-widest mb-1">{companyInfo.name}</h3>
                                {companyInfo.address && <p className="text-[10px]">{companyInfo.address}</p>}
                            </>
                        )}
                        <h2 className="text-3xl font-black uppercase tracking-wide mb-1 mt-4">PHIẾU LƯƠNG</h2>
                        <p className="text-gray-600 font-medium italic">Tháng {selectedMonth.split('-')[1]} năm {selectedMonth.split('-')[0]}</p>
                    </div>

                    {/* 1. THÔNG TIN */}
                    <div>
                        <h3 className="text-sm font-bold uppercase mb-2 bg-gray-100 p-2 border-l-4 border-gray-800">I. THÔNG TIN NHÂN VIÊN</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm px-4">
                            <p>Mã nhân viên: <b>{employeeDetails?.code}</b></p>
                            <p>Họ và tên: <b>{employeeDetails?.fullName}</b></p>
                            <p>Chức vụ: {employeeDetails?.position || '---'}</p>
                            <p>Bộ phận: {employeeDetails?.department || '---'}</p>
                            <div className="col-span-2 border-t border-dashed my-2"></div>
                            <p>Ngày công chuẩn: 26</p>
                            <p>Ngày công thực tế: <b>{mySlip.actualWorkDays}</b></p>
                        </div>
                    </div>

                    {/* 2. CÁC KHOẢN THU NHẬP */}
                    <div>
                        <h3 className="text-sm font-bold uppercase mb-2 bg-gray-100 p-2 border-l-4 border-gray-800">III. CHI TIẾT THU NHẬP</h3>
                        <div className="px-4 text-sm space-y-2">
                            {incomeComponents.map(comp => (
                                <div key={comp.code}>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-1 items-end">
                                        <span>{comp.name}</span>
                                        <span className="font-semibold">{formatMoney(mySlip?.details[comp.code] || 0)}</span>
                                    </div>
                                    {showDebug && comp.formula && (
                                        <div className="text-[9px] text-slate-400 font-mono mt-0.5 bg-slate-50 p-1 rounded">
                                            CT: {comp.formula}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div className="flex justify-between font-bold bg-gray-50 p-2 rounded mt-2">
                                <span>TỔNG THU NHẬP (A):</span>
                                <span>{formatMoney(mySlip.grossIncome)}</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. CÁC KHOẢN KHẤU TRỪ */}
                    <div>
                        <h3 className="text-sm font-bold uppercase mb-2 bg-gray-100 p-2 border-l-4 border-gray-800">III. CÁC KHOẢN KHẤU TRỪ</h3>
                        <div className="px-4 text-sm space-y-2">
                            {deductionComponents.length > 0 ? deductionComponents.map(comp => (
                                <div key={comp.code}>
                                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-1">
                                        <span>{comp.name}</span>
                                        <span className="text-red-600">-{formatMoney(mySlip?.details[comp.code] || 0)}</span>
                                    </div>
                                    {showDebug && comp.formula && (
                                        <div className="text-[9px] text-slate-400 font-mono mt-0.5 bg-slate-50 p-1 rounded">
                                            CT: {comp.formula}
                                        </div>
                                    )}
                                </div>
                            )) : <p className="text-gray-500 italic">Không có khoản khấu trừ.</p>}
                        </div>
                    </div>

                    {/* 4. THỰC LĨNH */}
                    <div className="mt-6 pt-4 border-t-2 border-gray-800">
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center">
                            <span className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">SỐ TIỀN THỰC LĨNH (A - III)</span>
                            <span className="text-4xl font-black text-slate-900">{formatMoney(mySlip.netSalary)}</span>
                        </div>
                    </div>

                    {/* FOOTER SIGNATURE */}
                    <div className="grid grid-cols-2 gap-10 pt-10 text-center text-xs">
                        <div>
                            <p className="font-bold uppercase">Người Lập Biểu</p>
                            <div className="h-20"></div>
                            <p className="italic">(Ký, họ tên)</p>
                        </div>
                        <div>
                            <p className="font-bold uppercase">Xác nhận của nhân viên</p>
                            <div className="h-20"></div>
                            <p className="italic">(Ký, họ tên)</p>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <DollarSign size={48} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">Chưa có dữ liệu lương cho tháng này.</p>
            </div>
        )}
    </div>
  );
};

export default MyPayslips;
