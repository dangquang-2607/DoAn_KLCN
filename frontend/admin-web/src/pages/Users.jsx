import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Download, UserPlus, ChevronLeft, ChevronRight, ShieldBan, ShieldCheck, MoreVertical } from 'lucide-react';
import api from '../services/api';

const PER_PAGE = 5;

// Helper tạo color từ chuỗi
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#1f6feb', '#8250df', '#adb5bd', '#2da44e', '#e3702e', '#0969da', '#f59e0b', '#10b981'];
  return colors[Math.abs(hash) % colors.length];
};

// Helper tạo initials
const getInitials = (name) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
};

export default function Users() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  // Fetch dữ liệu từ API
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => {
      const res = await api.get('/admin/users', {
        params: { page, page_size: PER_PAGE, search: search || undefined }
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  // API Ban/Unban
  const banMutation = useMutation({
    mutationFn: async ({ id, isBanned }) => {
      const endpoint = isBanned ? `/admin/users/${id}/unban` : `/admin/users/${id}/ban`;
      await api.patch(endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err) => {
      alert(err.response?.data?.detail || 'Có lỗi xảy ra!');
    }
  });

  const toggleBan = (user) => {
    if (user.role === 'admin') {
      alert('Không thể khóa tài khoản Admin.');
      return;
    }
    if (window.confirm(`Bạn có chắc muốn ${user.is_banned ? 'mở khóa' : 'khóa'} user ${user.email}?`)) {
      banMutation.mutate({ id: user.id, isBanned: user.is_banned });
    }
  };

  const users = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1" style={{ color: '#0d1117' }}>Quản lý Người dùng</h4>
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>Quản lý quyền truy cập hệ thống, vai trò và đặc quyền quản trị.</p>
        </div>
        <button className="btn-primary-dark">
          <UserPlus size={15} /> Thêm Người dùng
        </button>
      </div>

      {/* Table card */}
      <div className="card border shadow-sm" style={{ borderRadius: 12, borderColor: '#e1e4e8' }}>
        {/* Toolbar */}
        <div className="card-header bg-white d-flex align-items-center gap-3 py-3" style={{ borderRadius: '12px 12px 0 0', borderColor: '#e1e4e8' }}>
          <div className="input-icon-wrap" style={{ maxWidth: 320 }}>
            <Search size={14} className="icon" />
            <input type="text" className="form-control form-control-sm" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm kiếm theo tên hoặc email..."
              style={{ borderRadius: 8, fontSize: 13 }} />
          </div>
          <div className="d-flex gap-2 ms-auto">
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" style={{ borderRadius: 8, fontSize: 13 }}>
              <Filter size={13} /> Lọc
            </button>
            <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" style={{ borderRadius: 8, fontSize: 13 }}>
              <Download size={13} /> Xuất
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
            <thead className="table-light">
              <tr>
                <th className="ps-4 fw-semibold text-muted" style={{ fontSize: 11, letterSpacing: '0.05em' }}>NGƯỜI DÙNG</th>
                <th className="fw-semibold text-muted" style={{ fontSize: 11, letterSpacing: '0.05em' }}>EMAIL</th>
                <th className="fw-semibold text-muted" style={{ fontSize: 11, letterSpacing: '0.05em' }}>VAI TRÒ</th>
                <th className="fw-semibold text-muted" style={{ fontSize: 11, letterSpacing: '0.05em' }}>TRẠNG THÁI</th>
                <th className="fw-semibold text-muted" style={{ fontSize: 11, letterSpacing: '0.05em' }}>ĐĂNG NHẬP LẦN CUỐI</th>
                <th className="fw-semibold text-muted" style={{ fontSize: 11, letterSpacing: '0.05em' }}>HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">Đang tải dữ liệu...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-muted">Không tìm thấy người dùng.</td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} style={{ opacity: user.is_banned ? 0.7 : 1 }}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: stringToColor(user.email), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {getInitials(user.full_name || user.email)}
                        </div>
                        <div>
                          <div className="fw-semibold" style={{ color: '#0d1117' }}>{user.full_name}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>#{user.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted">{user.email}</td>
                    <td>
                      <span className={user.role === 'admin' ? 'badge-admin' : 'badge-user'}>
                        {user.role === 'admin' ? 'Quản trị' : 'Người dùng'}
                      </span>
                    </td>
                    <td>
                      <span className={!user.is_banned ? 'badge-active' : 'badge-banned'}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: !user.is_banned ? '#15803d' : '#b91c1c', display: 'inline-block' }} />
                        {!user.is_banned ? 'Đang hoạt động' : 'Bị cấm'}
                      </span>
                    </td>
                    <td className="text-muted">{new Date(user.created_at).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <button onClick={() => toggleBan(user)}
                          disabled={banMutation.isLoading}
                          className={`btn btn-sm d-flex align-items-center gap-1 ${!user.is_banned ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          style={{ borderRadius: 8, fontSize: 12 }}>
                          {!user.is_banned ? <><ShieldBan size={13} /> Khóa</> : <><ShieldCheck size={13} /> Mở</>}
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 8, padding: '4px 8px' }}>
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="card-footer bg-light d-flex align-items-center justify-content-between py-3" style={{ borderRadius: '0 0 12px 12px', borderColor: '#e1e4e8' }}>
          <span className="text-muted" style={{ fontSize: 13 }}>
            Hiển thị <strong>{users.length > 0 ? (page-1)*PER_PAGE+1 : 0}–{Math.min(page*PER_PAGE, total)}</strong> trong <strong>{total}</strong> kết quả
          </span>
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(p => p-1)} style={{ borderRadius: 6 }}>
                  <ChevronLeft size={14} />
                </button>
              </li>
              {Array.from({ length: totalPages }, (_, i) => i+1).map(p => (
                <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                  <button className="page-link" onClick={() => setPage(p)} style={{ borderRadius: 6 }}>{p}</button>
                </li>
              ))}
              <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => setPage(p => p+1)} style={{ borderRadius: 6 }}>
                  <ChevronRight size={14} />
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
