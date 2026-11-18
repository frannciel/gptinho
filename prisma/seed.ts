import "dotenv/config";
import { createDb } from "../src/lib/db-client";
if (
  process.env.NODE_ENV === "production" ||
  process.env.ALLOW_DEV_SEED !== "true" ||
  !process.env.DATABASE_URL
)
  throw new Error(
    "Seed permitido apenas em desenvolvimento com ALLOW_DEV_SEED=true e DATABASE_URL de desenvolvimento.",
  );
const db = createDb(process.env.DATABASE_URL);
try {
  await db.$transaction(async (tx) => {
    await tx.organization.upsert({
      where: { id: "cdevagency0000000000000000" },
      update: {},
      create: {
        id: "cdevagency0000000000000000",
        legalName: "Órgão Exemplo — Desenvolvimento",
        acronym: "EXEMPLO",
        roles: ["PUBLIC_AGENCY"],
        notes: "Dado fictício exclusivo para desenvolvimento.",
        contacts: {
          create: {
            name: "Contato de demonstração",
            email: "contato@example.org",
          },
        },
      },
    });
    await tx.organization.upsert({
      where: { id: "cdevsupplier00000000000000" },
      update: {},
      create: {
        id: "cdevsupplier00000000000000",
        legalName: "Fornecedor Exemplo — Desenvolvimento",
        roles: ["SUPPLIER"],
        categories: ["Licenças de software"],
        notes: "Dado fictício exclusivo para desenvolvimento.",
      },
    });
    await tx.companySettings.upsert({
      where: { id: "company" },
      update: {},
      create: { id: "company" },
    });
  });
  console.info(
    "Seed de desenvolvimento concluído. Nenhum usuário ou senha padrão foi criado.",
  );
} finally {
  await db.$disconnect();
}
