export function logStep(message: string) {
  console.log(`\n[seed] ${message}`);
}

export function logInfo(message: string) {
  console.log(`[seed] ${message}`);
}

export function logWarning(message: string) {
  console.warn(`[seed][warn] ${message}`);
}
