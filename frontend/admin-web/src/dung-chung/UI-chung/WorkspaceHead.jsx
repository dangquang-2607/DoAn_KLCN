export default function WorkspaceHead({ eyebrow, title, description, actions }) {
  return <header className="adm-intro"><div><p className="adm-eyebrow">{eyebrow}</p><h1>{title}<span>.</span></h1>{description && <p className="adm-intro-description">{description}</p>}</div>{actions && <div className="cf-row adm-live-actions">{actions}</div>}</header>;
}
