
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Employee, Project, Timesheet, AttendancePeriod, UserContext } from '../types';
import { getEmployees } from '../services/employeeService';
import { 
    fetchTimesheets, saveTimesheets, autoFillOfficeTimesheet, getAttendancePeriod, 
    lockAttendancePeriod, unlockAttendancePeriod, getAllAttendancePeriods, deleteAttendancePeriod, 
    createAttendancePeriod, exportTimesheetToCSV, exportTimesheetToJSON, importTimesheetFromJSON 
} from '../services/timesheetService';
import { extractTimesheetFromImage } from '../services/aiExtractionService';
import { Calendar, Save, Trash2, User, Building2, Plus, Clock, ChevronRight, ChevronDown, Wand2, Folder, Lock, Unlock, Zap, Layout, FileText, AlertTriangle, Loader2, Download, Upload, Archive, Camera } from 'lucide-react';
import { isHoliday } from '../utils/dateUtils';
import { hasPermission } from '../services/authService';
import ExcelImportModal from './ExcelImportModal';

interface TimesheetManagerProps {
    projects: Project[];
    currentUser?: UserContext; 
}

const getQuarter = (month: number) => Math.ceil(month / 3);

const TimesheetManager: React.FC<TimesheetManagerProps> = ({ projects, currentUser }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [period, setPeriod] = useState<AttendancePeriod | undefined>(undefined);
  const [allPeriods, setAllPeriods] = useState<AttendancePeriod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Tree State
  const [expandedYears, setExpandedYears] = useState<string[]>([new Date().getFullYear().toString()]);

  useEffect(() => {
    // Initial Load
    const init = async () => {
        const emps = await getEmployees();
        setEmployees(emps);
        await loadTree();
    };
    init();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadTree = async () => {
      const periods = await getAllAttendancePeriods();
      setAllPeriods(periods);
  };

  const loadData = async () => {
      setIsLoading(true);
      try {
          const [data, p] = await Promise.all([
              fetchTimesheets(selectedMonth),
              getAttendancePeriod(selectedMonth)
          ]);
          setTimesheets(data);
          setPeriod(p);
          await loadTree(); 
      } catch (e) {
          console.error("Error loading timesheets", e);
      } finally {
          setIsLoading(false);
      }
  };

  const periodTree = useMemo(() => {
      const tree: Record<string, Record<string, AttendancePeriod[]>> = {};
      
      const currentExists = allPeriods.find(p => p.month === selectedMonth);
      // Ensure current selection is in the tree even if not saved yet (UI UX)
      const displayList = currentExists ? allPeriods : [...allPeriods, { id: 'temp', month: selectedMonth, status: 'DRAFT', totalWorkDays: 0 } as AttendancePeriod];

      displayList.forEach(p => {
          const [y, m] = p.month.split('-');
          const q = `Q${getQuarter(parseInt(m))}`;
          
          if (!tree[y]) tree[y] = { 'Q1': [], 'Q2': [], 'Q3': [], 'Q4': [] };
          if (!tree[y][q].find(existing => existing.month === p.month)) {
              tree[y][q].push(p);
          }
      });
      return tree;
  }, [allPeriods, selectedMonth]);

  const daysInMonth = useMemo(() => {
      const [y, m] = selectedMonth.split('-').map(Number);
      const days = new Date(y, m, 0).getDate();
      const result = [];
      for (let i = 1; i <= days; i++) {
          const fullDate = `${selectedMonth}-${i.toString().padStart(2, '0')}`;
          const d = new Date(y, m - 1, i);
          result.push({ date: i, dayOfWeek: d.getDay(), fullDate, holiday: isHoliday(fullDate) });
      }
      return result;
  }, [selectedMonth]);

  const handleCreateNewMonth = async () => {
      const m = prompt("Nhập tháng mới (YYYY-MM):", new Date().toISOString().slice(0, 7));
      if (!m) return;
      
      if (!/^\d{4}-\d{2}$/.test(m)) {
          alert("Định dạng tháng không hợp lệ. Vui lòng nhập YYYY-MM");
          return;
      }

      await createAttendancePeriod(m);
      
      // Auto expand the new year
      const year = m.split('-')[0];
      setExpandedYears(prev => prev.includes(year) ? prev : [...prev, year]);
      
      setSelectedMonth(m);
      // loadData will trigger via useEffect
  };

  const handleCellClick = (empId: string, date: string) => {
      if (period?.status === 'LOCKED') return;

      setTimesheets(prev => {
          const existing = prev.find(t => t.empId === empId && t.date === date);
          let newVal = 1;
          if (existing) {
              if (existing.workUnits === 1) newVal = 0.5;
              else if (existing.workUnits === 0.5) newVal = 0;
              else newVal = 1;
          }

          if (newVal === 0) {
              return prev.filter(t => !(t.empId === empId && t.date === date));
          }

          const newEntry: Timesheet = {
              id: existing?.id || `ts_${empId}_${date}`,
              empId,
              date,
              workUnits: newVal,
              otHours: 0,
              projectId: 'OFFICE',
              createdAt: existing?.createdAt || new Date().toISOString()
          };

          if (existing) {
              return prev.map(t => t.id === existing.id ? newEntry : t);
          }
          return [...prev, newEntry];
      });
  };

  const handleSave = async () => {
      if (period?.status === 'LOCKED') return;
      setIsSaving(true);
      try {
          // Only save changes for current month
          const currentMonthSheets = timesheets.filter(t => t.date.startsWith(selectedMonth));
          await saveTimesheets(currentMonthSheets);
          await loadData(); 
          alert("Đã lưu bảng công thành công!");
      } catch (e: any) {
          alert("Lỗi khi lưu: " + e.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleAutoFill = async () => {
      if (period?.status === 'LOCKED') return;
      if (!confirm("Hệ thống sẽ tự động điền 'Đủ công' cho tất cả nhân viên khối văn phòng trong tháng này (Trừ CN & Lễ). Tiếp tục?")) return;
      setIsSaving(true);
      try {
          await autoFillOfficeTimesheet(employees.map(e => e.id), selectedMonth);
          await loadData();
      } finally {
          setIsSaving(false);
      }
  };

  const handleLock = async () => {
      if (!confirm("Chốt bảng công tháng này? Sau khi chốt, dữ liệu sẽ không thể chỉnh sửa.")) return;
      await lockAttendancePeriod(selectedMonth);
      loadData();
  };

  const handleUnlock = async () => {
      if (!confirm("Mở khóa bảng công?")) return;
      await unlockAttendancePeriod(selectedMonth);
      loadData();
  };

  const handleDeletePeriod = async (p: AttendancePeriod) => {
      if (p.status === 'LOCKED' && !hasPermission(currentUser || null, 'SYS_ADMIN')) {
          alert("Chỉ Quản trị viên (Admin) mới có quyền xóa Bảng công đã chốt!");
          return;
      }
      if (!confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu chấm công tháng ${p.month}? Hành động này không thể hoàn tác.`)) return;
      
      await deleteAttendancePeriod(p.month);
      loadTree();
      
      if (p.month === selectedMonth) {
          const others = allPeriods.filter(x => x.month !== p.month);
          if (others.length > 0) setSelectedMonth(others[0].month);
          else setTimesheets([]);
      }
  };

  // Import / Export Handlers
  const handleExportCSV = async () => {
      await exportTimesheetToCSV(selectedMonth, employees);
  }
  const handleArchive = async () => {
      await exportTimesheetToJSON(selectedMonth);
  } 
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          setIsLoading(true);
          const month = await importTimesheetFromJSON(file);
          alert(`Đã khôi phục thành công bảng công tháng ${month}`);
          setSelectedMonth(month);
          // loadData trigger via useEffect
      } catch (err: any) {
          alert("Lỗi: " + err.message);
      } finally {
          setIsLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleGridImport = async (data: any[]) => {
      // Data is array of { empName: string, days: { [day: string]: number } }
      const newEntries: Timesheet[] = [];
      data.forEach(row => {
          const emp = employees.find(e => e.fullName.toLowerCase() === row.empName.toLowerCase());
          if (!emp) return; // Skip if employee not found
          
          Object.entries(row.days).forEach(([day, val]) => {
              const d = parseInt(day);
              if (isNaN(d) || d < 1 || d > 31) return;
              const dateStr = `${selectedMonth}-${d.toString().padStart(2, '0')}`;
              newEntries.push({
                  id: `ts_imp_${emp.id}_${dateStr}`,
                  date: dateStr,
                  empId: emp.id,
                  workUnits: Number(val),
                  otHours: 0,
                  projectId: 'OFFICE',
                  createdAt: new Date().toISOString()
              });
          });
      });
      
      if (newEntries.length === 0) {
          alert("Không tìm thấy dữ liệu hợp lệ hoặc tên nhân viên không khớp.");
          return;
      }
      
      await saveTimesheets(newEntries);
      await loadData();
      alert(`Đã nhập thành công chấm công cho ${data.length} nhân viên.`);
  };

  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsScanning(true);
      try {
          const result = await extractTimesheetFromImage(file, selectedMonth);
          // Result format matches the Grid Import format
          await handleGridImport(result);
      } catch (err: any) {
          alert("Lỗi AI: " + err.message);
      } finally {
          setIsScanning(false);
          if (scanInputRef.current) scanInputRef.current.value = '';
      }
  };

  const toggleYear = (year: string) => {
      setExpandedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };

  const isLocked = period?.status === 'LOCKED';
  const isAdmin = hasPermission(currentUser || null, 'SYS_ADMIN');

  return (
    <div className="h-full flex gap-6 animate-in fade-in">
        
        {/* LEFT SIDEBAR: DIRECTORY TREE */}
        <div className="w-72 flex flex-col bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden shrink-0">
            <div className="p-6 bg-slate-50 border-b border-slate-100">
                <h3 className="font-black text-slate-800 uppercase text-sm tracking-widest flex items-center">
                    <Folder size={16} className="mr-2 text-indigo-600"/> Lưu Trữ
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {Object.keys(periodTree).sort((a,b)=>Number(b)-Number(a)).map(year => (
                    <div key={year} className="mb-2">
                        <button onClick={() => toggleYear(year)} className="w-full flex items-center p-2 rounded-xl hover:bg-slate-50 font-bold text-slate-700 text-sm transition-colors">
                            {expandedYears.includes(year) ? <ChevronDown size={16} className="mr-2"/> : <ChevronRight size={16} className="mr-2"/>}
                            Năm {year}
                        </button>
                        
                        {expandedYears.includes(year) && (
                            <div className="ml-4 border-l-2 border-slate-100 pl-2 mt-1 space-y-4">
                                {Object.keys(periodTree[year]).sort().map(quarter => {
                                    const periods = periodTree[year][quarter];
                                    if (periods.length === 0) return null;
                                    
                                    return (
                                        <div key={quarter}>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-2">Quý {quarter.replace('Q','')}</div>
                                            <div className="space-y-1">
                                                {periods.sort((a,b)=>b.month.localeCompare(a.month)).map(p => {
                                                    const isActive = p.month === selectedMonth;
                                                    const isPLocked = p.status === 'LOCKED';
                                                    return (
                                                        <div key={p.month} className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs font-bold transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-indigo-50'}`} onClick={() => setSelectedMonth(p.month)}>
                                                            <div className="flex items-center">
                                                                {isPLocked ? <Lock size={12} className={`mr-2 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}/> : <FileText size={12} className={`mr-2 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}/>}
                                                                Tháng {p.month.split('-')[1]}
                                                            </div>
                                                            <div className="flex items-center">
                                                                {!isPLocked && <span className={`w-2 h-2 rounded-full mr-2 ${isActive ? 'bg-emerald-400' : 'bg-emerald-500'}`}></span>}
                                                                {(!isPLocked || isAdmin) && (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleDeletePeriod(p); }} 
                                                                        className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 text-current transition-opacity`}
                                                                        title="Xóa bảng công"
                                                                    >
                                                                        <Trash2 size={12}/>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
                {Object.keys(periodTree).length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic">Chưa có dữ liệu lưu trữ.</div>}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
                <button onClick={handleCreateNewMonth} className="w-full py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center">
                    <Plus size={14} className="mr-2"/> Tạo tháng mới
                </button>
            </div>
        </div>

        {/* RIGHT CONTENT: GRID */}
        <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm shrink-0">
                <div>
                    <h1 className="text-xl font-black text-slate-900 flex items-center uppercase tracking-tighter">
                        {isLocked ? <Lock className="mr-2 text-rose-500" size={24}/> : <Clock className="mr-2 text-indigo-600" size={24}/>}
                        Bảng Chấm Công Tháng {selectedMonth.split('-')[1]}/{selectedMonth.split('-')[0]}
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                        {isLocked ? 'ĐÃ KHÓA SỔ - DỮ LIỆU ĐƯỢC BẢO VỆ' : 'Đang mở - Click vào ô để tích công'}
                    </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportCSV} className="flex items-center px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-200 border border-slate-200" title="Xuất Excel (CSV)">
                        <Download size={14} className="mr-2"/> Xuất Excel
                    </button>
                    
                    {!isLocked && (
                        <>
                            <button onClick={() => setShowPasteModal(true)} className="flex items-center px-4 py-2.5 bg-white border border-indigo-100 text-indigo-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-50" title="Copy-Paste từ Excel">
                                <Layout size={14} className="mr-2"/> Dán Excel
                            </button>
                            
                            <button onClick={() => scanInputRef.current?.click()} className="flex items-center px-4 py-2.5 bg-white border border-purple-100 text-purple-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-purple-50" title="Scan ảnh bằng AI" disabled={isScanning}>
                                {isScanning ? <Loader2 size={14} className="animate-spin mr-2"/> : <Camera size={14} className="mr-2"/>} AI Scan
                            </button>
                            <input ref={scanInputRef} type="file" className="hidden" accept="image/*" onChange={handleScanImage}/>
                        </>
                    )}

                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button onClick={handleArchive} className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-indigo-600 transition-all" title="Lưu trữ (Backup JSON)">
                            <Archive size={16}/>
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg text-slate-500 hover:bg-white hover:text-indigo-600 transition-all" title="Nhập khẩu (Restore JSON)">
                            <Upload size={16}/>
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportJSON} />
                    </div>

                    <div className="w-px bg-slate-200 mx-2 h-8 self-center"></div>

                    {!isLocked && (
                        <>
                            <button onClick={handleAutoFill} disabled={isSaving} className="flex items-center px-5 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 border border-indigo-100">
                                <Zap size={14} className="mr-2"/> Auto-Fill
                            </button>
                            <button onClick={handleSave} disabled={isSaving} className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700">
                                {isSaving ? <Loader2 size={14} className="animate-spin mr-2"/> : <Save size={14} className="mr-2"/>}
                                Lưu
                            </button>
                        </>
                    )}
                    
                    {isLocked ? (
                        <button onClick={handleUnlock} className="flex items-center px-6 py-2.5 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700">
                            <Unlock size={14} className="mr-2"/> Mở khóa
                        </button>
                    ) : (
                        <button onClick={handleLock} disabled={timesheets.length === 0} className="flex items-center px-6 py-2.5 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 disabled:opacity-50">
                            <Lock size={14} className="mr-2"/> Chốt công
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden flex flex-col">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-indigo-600"/></div>
                ) : (
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="min-w-full border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-20">
                                <tr>
                                    <th className="sticky left-0 z-30 bg-slate-50 px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 min-w-[200px]">
                                        Họ và tên nhân sự
                                    </th>
                                    {daysInMonth.map(day => (
                                        <th key={day.date} className={`px-2 py-3 text-center text-[10px] font-black border-r border-slate-100 min-w-[36px] ${day.dayOfWeek === 0 ? 'bg-rose-50 text-rose-600' : 'text-slate-500'}`}>
                                            <div>{day.date}</div>
                                            <div className="opacity-50 text-[8px]">{['CN','T2','T3','T4','T5','T6','T7'][day.dayOfWeek]}</div>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase min-w-[60px]">Tổng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employees.map(emp => {
                                    const empSheets = timesheets.filter(t => t.empId === emp.id);
                                    const totalWork = empSheets.reduce((s, t) => s + (t.workUnits || 0), 0);
                                    return (
                                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="sticky left-0 z-10 bg-white px-6 py-3 whitespace-nowrap border-r border-slate-100 group shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs uppercase">{emp.fullName.charAt(0)}</div>
                                                    <div>
                                                        <div className="text-xs font-black text-slate-800">{emp.fullName}</div>
                                                        <div className="text-[9px] text-slate-400 font-bold">{emp.code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            {daysInMonth.map(day => {
                                                const entry = empSheets.find(t => t.date === day.fullDate);
                                                const val = entry?.workUnits || 0;
                                                return (
                                                    <td 
                                                        key={day.date} 
                                                        onClick={() => handleCellClick(emp.id, day.fullDate)}
                                                        className={`text-center border-r border-slate-100 text-[10px] font-black cursor-pointer transition-all hover:bg-indigo-50/50 ${val === 1 ? 'bg-emerald-50 text-emerald-600' : val === 0.5 ? 'bg-amber-50 text-amber-600' : day.dayOfWeek === 0 ? 'bg-rose-50/30' : ''}`}
                                                    >
                                                        {val === 1 ? 'X' : val === 0.5 ? '1/2' : ''}
                                                    </td>
                                                );
                                            })}
                                            <td className="text-center font-black text-indigo-700 bg-indigo-50/30 text-xs">{totalWork}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>

        {showPasteModal && (
            <ExcelImportModal 
                type="TIMESHEET" 
                onImport={handleGridImport} 
                onClose={() => setShowPasteModal(false)}
            />
        )}
    </div>
  );
};

export default TimesheetManager;
