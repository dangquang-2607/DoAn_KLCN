import type { ReactNode, ReactElement } from "react";
export function MotionValue(props: { children: ReactNode }): ReactElement;
export function TransferFlow(props: { from: string; to: string; amount?: string; confirmed?: boolean; onClose?: () => void }): ReactElement;
export function OcrSteps(props: { status: string }): ReactElement;

export function useMotionAllowed(): boolean;
