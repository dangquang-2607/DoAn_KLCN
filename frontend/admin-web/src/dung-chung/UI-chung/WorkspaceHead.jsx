/**
 * Khung tiêu đề tiêu chuẩn đầu trang cho các phân hệ quản trị.
 */
export default function WorkspaceHead({ eyebrow, title, description, actions }) {
  return <header className="adm-intro cf-workspace-head cf-workspace-head--compact"><div><p className="cf-eyebrow">{eyebrow}</p><h1>{title}<span className="cf-heading-dot" aria-hidden="true">.</span></h1>{description && <p className="cf-heading-description">{description}</p>}</div>{actions && <div className="cf-row cf-heading-actions adm-live-actions">{actions}</div>}</header>;
}
