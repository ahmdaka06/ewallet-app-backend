import * as bcrypt from "bcrypt";
import type { PrismaClient } from "../../src/generated/prisma/client";

const SALT_ROUNDS = 12;

type SeedUser = {
    name: string;
    email: string;
    password: string;
};

const users: SeedUser[] = [
    {
        name: "John",
        email: "john@example.com",
        password: "password123",
    },
    {
        name: "Jane",
        email: "jane@example.com",
        password: "password123",
    },
];

export async function seedUsers(prisma: PrismaClient): Promise<void> {
    console.log("🌱 Seeding users...");

    for (const user of users) {
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);

        await prisma.user.upsert({
            where: {
                email: user.email,
            },
            update: {
                name: user.name,
                password: hashedPassword,
            },
            create: {
                name: user.name,
                email: user.email,
                password: hashedPassword,
            },
        });

        console.log(`✅ User seeded: ${user.email}`);
    }
}