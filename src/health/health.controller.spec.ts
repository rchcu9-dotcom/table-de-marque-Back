/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import type { HealthPayload } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthService>;

  const mockPayload: HealthPayload = {
    status: 'ok',
    timestamp: '2026-06-02T12:00:00.000Z',
    uptime: 42.5,
    version: '1.0.0',
    environment: 'test',
    db: { status: 'ok', latencyMs: 12 },
  };

  beforeEach(async () => {
    const mockHealthService: jest.Mocked<Pick<HealthService, 'check'>> = {
      check: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService) as jest.Mocked<HealthService>;
  });

  describe('check()', () => {
    it('delegates to healthService.check() with no arguments', async () => {
      healthService.check.mockResolvedValue(mockPayload);

      await controller.check();

      expect(healthService.check).toHaveBeenCalledTimes(1);
      expect(healthService.check).toHaveBeenCalledWith();
    });

    it('returns exactly what healthService.check() returns', async () => {
      healthService.check.mockResolvedValue(mockPayload);

      const result = await controller.check();

      expect(result).toBe(mockPayload);
    });

    it('propagates exceptions thrown by healthService.check()', async () => {
      const error = new Error('unexpected');
      healthService.check.mockRejectedValue(error);

      await expect(controller.check()).rejects.toThrow('unexpected');
    });
  });
});
