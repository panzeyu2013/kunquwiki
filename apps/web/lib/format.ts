export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai"
  }).format(new Date(value));
}

export function countdownLabel(value: string, nowInput = new Date()) {
  return countdownLabelPrecise(value, nowInput, false);
}

export function countdownLabelPrecise(value: string, nowInput = new Date(), includeSeconds = true) {
  const now = nowInput.getTime();
  const target = new Date(value).getTime();
  const diff = target - now;
  if (diff <= 0) {
    return "已开始或已结束";
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  if (!includeSeconds) {
    return `${days} 天 ${hours} 小时后开始`;
  }
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return `${days} 天 ${hours} 小时 ${minutes} 分 ${seconds} 秒后开始`;
}
