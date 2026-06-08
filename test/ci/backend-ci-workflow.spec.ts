import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflow = readFileSync(
  join(__dirname, '../../.github/workflows/backend-ci.yml'),
  'utf-8',
);

describe('backend-ci.yml — pnpm audit gate', () => {
  it('runs `pnpm audit --prod --audit-level=high` against production dependencies', () => {
    expect(workflow).toMatch(/run:\s*pnpm audit --prod --audit-level=high/);
  });

  it('places the audit step after install and before Prisma generate, Lint, build & deploy', () => {
    const installIndex = workflow.indexOf('name: Install dependencies');
    const auditIndex = workflow.indexOf('pnpm audit --prod --audit-level=high');
    const prismaIndex = workflow.indexOf('name: Prisma generate');
    const lintIndex = workflow.indexOf('name: Lint');
    const buildIndex = workflow.indexOf('name: Build & push Docker image');
    const deployIndex = workflow.indexOf('name: Deploy to Cloud Run');

    [
      installIndex,
      auditIndex,
      prismaIndex,
      lintIndex,
      buildIndex,
      deployIndex,
    ].forEach((index) => expect(index).toBeGreaterThan(-1));

    expect(auditIndex).toBeGreaterThan(installIndex);
    expect(auditIndex).toBeLessThan(prismaIndex);
    expect(auditIndex).toBeLessThan(lintIndex);
    expect(auditIndex).toBeLessThan(buildIndex);
    expect(auditIndex).toBeLessThan(deployIndex);
  });
});
