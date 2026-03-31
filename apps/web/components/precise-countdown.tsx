"use client";

import { useEffect, useState } from "react";
import { countdownLabelPrecise } from "../lib/format";

// Styles
import pillStyles from "../styles/components/pill.module.css";

export function PreciseCountdown({ value }: { value: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <span className={pillStyles.pill}>{now ? countdownLabelPrecise(value, now, true) : "即将开始"}</span>;
}
