import { useSyncExternalStore } from "react";

const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const today = () => formatter.format(new Date());

function subscribe(notify: () => void) {
  let timer: number;
  function schedule() {
    window.clearTimeout(timer);
    notify();
    const midnight = Date.parse(today() + "T00:00:00+07:00") + 86_400_000;
    timer = window.setTimeout(schedule, Math.max(1, midnight - Date.now()));
  }
  schedule();
  document.addEventListener("visibilitychange", schedule);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", schedule);
  };
}

export function useVietnamDay() {
  return useSyncExternalStore(subscribe, today, () => "");
}
