import "dotenv/config";
import { createDb } from "../src/lib/db-client";
if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL antes de verificar os contatos.");
const db = createDb(process.env.DATABASE_URL);
try {
  const [result] = await db.$queryRaw<{ groups: number }[]>`
    SELECT count(*)::integer AS groups FROM (
      SELECT lower(btrim("email")) FROM "Contact"
      WHERE NULLIF(lower(btrim("email")), '') IS NOT NULL
      GROUP BY lower(btrim("email")) HAVING count(*) > 1
    ) duplicates`;
  if (result.groups) {
    console.error(
      `${result.groups} grupo(s) de contatos com e-mail duplicado. Revise os contatos antes da migration. Nenhum dado foi alterado.`,
    );
    process.exitCode = 1;
  } else
    console.info(
      "Nenhum e-mail de contato duplicado. Verificação somente de leitura concluída.",
    );
} catch {
  console.error(
    "Não foi possível verificar os contatos. Confira a conexão e a existência da tabela Contact. Nenhum dado foi alterado.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
