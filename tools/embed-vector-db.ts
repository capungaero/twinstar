import { getDashboardData } from "../lib/legacy-db";
import { persistVectorIndex } from "../lib/vector-search";

async function main() {
  const data = await getDashboardData();
  const result = persistVectorIndex(data);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
