import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import api from '../services/api';

const EMOJIS = ['💼','📈','🏠','🎁','💡','🍴','🚗','🏥','🎓','🛒','🎮','📱','✈️','🏋️','💊','📚','🎵','🌱','🔧','💰','🎨','🏦','⚡','🛡️','📦'];

export default function Categories() {
  const [tab, setTab] = useState('expense');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📦');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  
  const queryClient = useQueryClient();

  const { data: allCats, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await api.get('/admin/categories');
      return res.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => api.post('/admin/categories', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => api.patch(`/admin/categories/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
  });

  const list = (allCats || []).filter(c => c.type === tab);
  const incomeCount = (allCats || []).filter(c => c.type === 'income').length;
  const expenseCount = (allCats || []).filter(c => c.type === 'expense').length;

  const add = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), type: tab, icon: newEmoji });
    setNewName(''); setNewEmoji('📦'); setAdding(false);
  };

  const del = id => {
    if (window.confirm('Bạn có chắc muốn xoá danh mục này?')) {
      deleteMutation.mutate(id);
    }
  };

  const save = id => {
    if (!editName.trim()) return;
    updateMutation.mutate({ id, payload: { name: editName.trim() } });
    setEditId(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1" style={{ color: '#0d1117' }}>Danh mục Hệ thống</h4>
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>Quản lý danh mục Thu/Chi mặc định được cài sẵn cho tất cả người dùng.</p>
        </div>
        <button className="btn-primary-dark" onClick={() => setAdding(true)}>
          <Plus size={15} /> Thêm Danh mục
        </button>
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'income' ? 'active' : ''}`} onClick={() => { setTab('income'); setAdding(false); }}>
            💰 Danh mục Thu
            <span className={`badge ms-2 ${tab === 'income' ? 'bg-white text-dark' : 'bg-secondary'}`}>{incomeCount}</span>
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'expense' ? 'active' : ''}`} onClick={() => { setTab('expense'); setAdding(false); }}>
            💸 Danh mục Chi
            <span className={`badge ms-2 ${tab === 'expense' ? 'bg-white text-dark' : 'bg-secondary'}`}>{expenseCount}</span>
          </button>
        </li>
      </ul>

      {/* Card list */}
      <div className="card border shadow-sm" style={{ borderRadius: 12, borderColor: '#e1e4e8' }}>
        <div className="card-header bg-light d-flex justify-content-between py-2 px-4" style={{ borderRadius: '12px 12px 0 0', borderColor: '#e1e4e8' }}>
          <span className="text-muted fw-semibold" style={{ fontSize: 11, letterSpacing: '0.05em' }}>DANH MỤC</span>
          <span className="text-muted fw-semibold" style={{ fontSize: 11, letterSpacing: '0.05em' }}>NGƯỜI DÙNG SỬ DỤNG</span>
        </div>

        {/* Add row */}
        {adding && (
          <div className="d-flex align-items-center gap-3 px-4 py-3 border-bottom" style={{ background: '#f0f9ff' }}>
            <select className="form-select form-select-sm" style={{ width: 80, fontSize: 20, textAlign: 'center', borderRadius: 8 }}
              value={newEmoji} onChange={e => setNewEmoji(e.target.value)}>
              {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input className="form-control form-control-sm flex-fill" autoFocus
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Tên danh mục mới..." style={{ borderRadius: 8, maxWidth: 320 }} />
            <button className="btn btn-sm btn-success d-flex align-items-center gap-1" style={{ borderRadius: 8 }} onClick={add}>
              <Check size={14} /> Thêm
            </button>
            <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 8 }} onClick={() => setAdding(false)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Rows */}
        {isLoading ? (
          <div className="text-center py-5 text-muted">Đang tải danh mục...</div>
        ) : list.map((cat, idx) => (
          <div key={cat.id} className="d-flex align-items-center px-4 py-3"
            style={{ borderBottom: idx < list.length - 1 ? '1px solid #f0f2f5' : 'none' }}>
            <div className="d-flex align-items-center gap-3 flex-fill">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: tab === 'income' ? '#dcfce7' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {cat.icon}
              </div>
              {editId === cat.id ? (
                <input className="form-control form-control-sm" autoFocus
                  value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(cat.id); if (e.key === 'Escape') setEditId(null); }}
                  style={{ maxWidth: 280, borderRadius: 8 }} />
              ) : (
                <div>
                  <div className="fw-semibold" style={{ fontSize: 14, color: '#0d1117' }}>{cat.name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>ID #{cat.id.slice(0, 8)}</div>
                </div>
              )}
            </div>

            <div className="d-flex align-items-center gap-4">
              <div className="text-end">
                <div className="fw-semibold" style={{ fontSize: 14, color: '#0d1117' }}>-</div>
                <div className="text-muted" style={{ fontSize: 11 }}>người dùng</div>
              </div>
              <div className="d-flex gap-2">
                {editId === cat.id ? (
                  <>
                    <button className="btn btn-sm btn-success" style={{ borderRadius: 8, padding: '4px 10px' }} onClick={() => save(cat.id)}><Check size={13} /></button>
                    <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 8, padding: '4px 10px' }} onClick={() => setEditId(null)}><X size={13} /></button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 8, padding: '4px 10px' }}
                      onClick={() => { setEditId(cat.id); setEditName(cat.name); }}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" style={{ borderRadius: 8, padding: '4px 10px' }}
                      onClick={() => del(cat.id)}>
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {!isLoading && list.length === 0 && (
          <div className="text-center py-5">
            <div style={{ fontSize: 40 }}>📂</div>
            <p className="text-muted mt-2 mb-0" style={{ fontSize: 14 }}>Chưa có danh mục nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
