import { runSeed } from "./seeds";

const isDirectRun = Boolean(process.argv[1]?.includes("prisma/seed"));

if (isDirectRun) {
  runSeed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default runSeed;
