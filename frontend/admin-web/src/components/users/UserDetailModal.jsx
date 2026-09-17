import { Modal, Loading, ErrorState } from "../design";

/**
 * UserDetailModal - Modal hien thi chi tiet nguoi dung: thong ke giao dich, hoa don, ngay tao.
 */
export default function UserDetailModal({ userId, query, onClose }) {
  if (!userId) return null;

  return (
    <Modal title="Chi tiet nguoi dung" onClose={onClose}>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : (
        <div className="cf-form">
          <div>
            <h3>{query.data.full_name}</h3>
            <p className="cf-muted">{query.data.email}</p>
          </div>
          <div className="cf-form-grid">
            <div>
              <div className="cf-eyebrow">Giao dich</div>
              {query.data.stats?.transactions_count ?? 0}
            </div>
            <div>
              <div className="cf-eyebrow">Hoa don</div>
              {query.data.stats?.invoices_count ?? 0}
            </div>
          </div>
          <div>
            <div className="cf-eyebrow">Ngay tao</div>
            {new Date(query.data.created_at).toLocaleString("vi-VN")}
          </div>
        </div>
      )}
    </Modal>
  );
}