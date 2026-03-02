import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "felipealisboa@outlook.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  const existing = await db.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin already exists: ${adminEmail}`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await db.user.create({
    data: {
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      emailVerified: true,
    },
  });

  console.log(`Admin created: ${admin.email}`);
  console.log(`Password: ${adminPassword}`);
  console.log("⚠️  Change the password after first login!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
