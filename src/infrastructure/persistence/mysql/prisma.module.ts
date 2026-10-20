import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Unique PrismaClient de l'application. Chaque PrismaClient ouvre son propre pool de
 * connexions : en avoir un par module multipliait les connexions par instance Cloud Run
 * et faisait dépasser `max_user_connections` (40) côté AlwaysData au démarrage à froid.
 * Les clients des modules (Auth, Inscription, Planning, TableDeMarque) restent injectables
 * sous leur propre classe, mais pointent vers cette instance via `useExisting`.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
