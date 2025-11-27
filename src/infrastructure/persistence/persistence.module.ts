import { Module } from "@nestjs/common";
import { MatchRepository } from "@/domain/match/repositories/match.repository";
import { InMemoryMatchRepository } from "./memory/in-memory-match.repository";
// import { PrismaMatchRepository } from "./prisma/prisma-match.repository"; // <— restera commenté

@Module({
  providers: [
    {
      provide: MatchRepository,
      useClass: InMemoryMatchRepository, // 👈 ACTIVATION DE L’IN-MEMORY
    },
  ],
  exports: [MatchRepository],
})
export class PersistenceModule {}
