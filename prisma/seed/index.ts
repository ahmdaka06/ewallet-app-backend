import { prismaSeed } from "./prisma.seed";
import { seedUsers } from "./users.seed";

async function main() {
  console.log("🚀 Starting database seeding...");

  await seedUsers(prismaSeed);

  console.log("✅ Database seeding completed");
}

main()
    .catch((error) => {
        console.error("❌ Database seeding failed");
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prismaSeed.$disconnect();
    });