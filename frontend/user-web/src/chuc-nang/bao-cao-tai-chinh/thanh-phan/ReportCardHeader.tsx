import styles from "../CSS/analytics.module.css";

export default function ReportCardHeader({ title, titleId, context, description }: {
  title: string;
  titleId?: string;
  context?: string;
  description?: string;
}) {
  return (
    <header className={styles.cardHeader}>
      <div className={styles.cardTitleRow}>
        <h2 id={titleId}>{title}</h2>
        {context && <span className={styles.overline}>{context}</span>}
      </div>
      {description && <p>{description}</p>}
    </header>
  );
}
