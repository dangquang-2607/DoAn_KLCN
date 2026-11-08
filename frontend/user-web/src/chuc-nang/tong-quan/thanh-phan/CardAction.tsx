import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import styles from "../CSS/overview.module.css";

type Props = { children: string } & (
  { href: string } | { onClick: () => void; "aria-haspopup": "dialog" }
);

export default function CardAction(props: Props) {
  const label = <>{props.children}<ArrowUpRight size={15} aria-hidden="true" /></>;
  if ("href" in props) return <Link className={styles.cardAction} href={props.href}>{label}</Link>;
  return <button className={styles.cardAction} type="button" aria-haspopup={props["aria-haspopup"]} onClick={props.onClick}>{label}</button>;
}
