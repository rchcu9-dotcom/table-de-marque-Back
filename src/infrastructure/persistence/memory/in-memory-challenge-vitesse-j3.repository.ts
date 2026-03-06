import { Injectable } from '@nestjs/common';
import {
  ChallengeVitesseJ3Player,
  ChallengeVitesseJ3Repository,
} from '@/domain/challenge/repositories/challenge-vitesse-j3.repository';

@Injectable()
export class InMemoryChallengeVitesseJ3Repository
  implements ChallengeVitesseJ3Repository
{
  async findAll(): Promise<ChallengeVitesseJ3Player[]> {
    return [];
  }
}
