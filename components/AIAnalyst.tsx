import React, { useState } from 'react';
import { Project, Transaction } from '../types';
import { analyzeProjectFinances } from '../services/geminiService';
import { Bot, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIAnalystProps {
  projects: Project[];
  transactions: Transaction[];
}

const AIAnalyst: React.FC<AIAnalystProps> = ({ projects, transactions }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!selectedProjectId) return;
    
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    setLoading(true);
    setAnalysis('');
    
    const result = await analyzeProjectFinances(project, transactions);
    
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Bot className="mr-2 text-indigo-600" />
          Trợ lý Tài chính AI (Gemini)
        </h1>
        <p className="text-gray-500">Sử dụng trí tuệ nhân tạo để phân tích lãi lỗ và rủi ro của từng dự án.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
          <label className="block text-sm font-medium text-indigo-900 mb-2">Chọn dự án cần phân tích</label>
          <div className="flex gap-3">
            <select
              className="flex-1 px-4 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">-- Chọn công trình --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedProjectId}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm transition-all"
            >
              {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Sparkles className="mr-2" size={18} />}
              {loading ? 'Đang phân tích...' : 'Phân tích ngay'}
            </button>
          </div>
        </div>

        <div className="p-8 min-h-[300px]">
          {!analysis && !loading && (
            <div className="flex flex-col items-center justify-center text-gray-400 py-12">
              <Bot size={48} className="mb-4 opacity-50" />
              <p>Chọn một dự án và nhấn "Phân tích ngay" để xem báo cáo.</p>
            </div>
          )}
          
          {analysis && (
            <div className="prose prose-indigo max-w-none">
              <div className="bg-white p-6 rounded-lg border border-gray-100">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
              <div className="mt-4 flex items-center text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                 <AlertTriangle size={16} className="mr-2 text-orange-500" />
                 Lưu ý: Phân tích được tạo tự động bởi AI và chỉ mang tính chất tham khảo. Vui lòng kiểm tra lại số liệu thực tế.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAnalyst;
