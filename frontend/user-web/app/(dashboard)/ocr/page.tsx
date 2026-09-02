/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { 
  Upload, Sparkles, Trash2, CheckCircle2, ChevronDown, 
  Calendar as CalendarIcon, Filter, FileText
} from 'lucide-react';

interface Invoice {
  id: string;
  vendor: string;
  date: string;
  amount: number;
  status: string;
  image: string | null;
  tax: number;
  time: string;
  category: string;
}

export default function OCRPage() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices');
      return res.data;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/invoices', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setUploading(false);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploading(true);
      uploadMutation.mutate(e.target.files[0]);
    }
  };

  const displayInvoices = invoicesData?.items?.length ? invoicesData.items.map((inv: {
    id: string;
    filename?: string;
    status: string;
  }) => ({
    id: inv.id,
    vendor: inv.filename || 'Tài liệu không tên',
    date: 'Hôm nay',
    amount: 0,
    status: inv.status === 'SUCCESS' ? 'ĐÃ XỬ LÝ' : 'CHỜ XỬ LÝ',
    image: null,
    tax: 0,
    time: '',
    category: ''
  })) : [];

  const filteredInvoices = displayInvoices.filter((inv: { status: string }) => 
    activeTab === 'pending' ? inv.status === 'CHỜ XỬ LÝ' : inv.status === 'ĐÃ XỬ LÝ'
  );

  const selected = selectedInvoice || (filteredInvoices.length > 0 ? filteredInvoices[0] : null);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
      
      {/* Left Column: Uploads List */}
      <div className="w-full lg:w-80 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Tải lên</h2>
          <button className="text-slate-400 hover:text-slate-600"><Filter className="w-5 h-5" /></button>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <div className="flex bg-slate-200/50 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`flex-1 text-sm py-1.5 px-2 rounded font-semibold transition-colors ${activeTab === 'pending' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Chờ xem xét
            </button>
            <button 
              onClick={() => setActiveTab('processed')}
              className={`flex-1 text-sm py-1.5 px-2 rounded font-semibold transition-colors ${activeTab === 'processed' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Đã xử lý
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredInvoices.map((inv: Invoice) => (
            <div 
              key={inv.id} 
              onClick={() => setSelectedInvoice(inv)}
              className={`flex gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                selected?.id === inv.id 
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                  : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="w-12 h-16 bg-slate-200 rounded object-cover overflow-hidden flex items-center justify-center shrink-0">
                {inv.image ? <img src={inv.image} alt="receipt" className="w-full h-full object-cover opacity-80" /> : <FileText className="w-5 h-5 text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-slate-900 text-sm truncate pr-2">{inv.vendor}</h3>
                  <span className="font-bold text-slate-900 text-sm">${inv.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-xs text-slate-500 font-medium">{inv.date}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    inv.status === 'CHỜ XỬ LÝ' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filteredInvoices.length === 0 && (
            <div className="text-center py-10 text-sm text-slate-500">Không có hóa đơn nào.</div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <label className="cursor-pointer w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors">
            <Upload className="w-4 h-4" />
            {uploading ? 'Đang tải lên...' : 'Tải lên Mới'}
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Right Column: Extracted Data & Preview */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Kiểm tra dữ liệu trích xuất</h2>
            <p className="text-sm text-slate-500 mt-1">Xác minh thông tin được điền tự động trước khi lưu vào sổ cái.</p>
          </div>
          <button className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
        </div>

        {selected ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Form Area */}
            <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-slate-100">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3 mb-6">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-indigo-900 text-sm mb-1">Độ tin cậy khớp cao</h4>
                  <p className="text-sm text-indigo-700/80 leading-relaxed">Hầu hết các trường được trích xuất thành công. Vui lòng kiểm tra các mục được làm nổi bật.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Tên Đơn vị bán</label>
                  <input type="text" defaultValue={selected.vendor} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-900" />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Ngày</label>
                    <div className="relative">
                      <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="text" defaultValue="2023-10-24" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-900" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Thời gian</label>
                    <input type="text" defaultValue={selected.time} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-900" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Danh mục</label>
                  <div className="relative">
                    <select className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-900 appearance-none bg-white">
                      <option>{selected.category || 'Chọn danh mục'}</option>
                      <option>Bữa ăn & Giải trí</option>
                      <option>Đi lại</option>
                      <option>Thiết bị văn phòng</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Tiền thuế</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                      <input type="text" defaultValue={selected.tax?.toFixed(2)} className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-slate-900" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-900 mb-1.5">Tổng số tiền</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 font-bold">$</span>
                      <input type="text" defaultValue={selected.amount?.toFixed(2)} className="w-full pl-7 pr-3 py-2 border-2 border-indigo-100 bg-indigo-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900 shadow-sm" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Ghi chú (Tùy chọn)</label>
                  <textarea rows={3} placeholder="Thêm mục đích kinh doanh..." className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 resize-none"></textarea>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
                <button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-md">
                  <CheckCircle2 className="w-4 h-4" /> Xác nhận & Lưu
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="w-full md:w-1/2 bg-slate-50 p-6 flex flex-col">
              <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex items-center justify-center relative group cursor-crosshair">
                {selected.image ? (
                  <img src={selected.image} alt="Receipt Preview" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Không có hình ảnh xem trước</p>
                  </div>
                )}
              </div>
              <div className="mt-4 text-center">
                <p className="text-xs font-medium text-slate-400 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Di chuột qua hình ảnh để kiểm tra các hộp giới hạn OCR thô
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
            Chọn một hóa đơn bên trái để kiểm tra
          </div>
        )}
      </div>
    </div>
  );
}
