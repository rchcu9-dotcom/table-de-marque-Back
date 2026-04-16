import * as dotenv from 'dotenv';
import { parseConfig, usageText } from './config';
import { runSimulation } from './orchestrator';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
      // eslint-disable-next-line no-console
      console.log(usageText());
      return;
    }

    const config = parseConfig(argv);
    // eslint-disable-next-line no-console
    console.log(
      `[simulateur] start mode=${config.mode} timeMode=${config.timeMode} scheduleMode=${config.scheduleMode} seed=${config.seed} sqlDump=${config.sqlDumpPath} reportDir=${config.reportDir}`,
    );
    const result = await runSimulation(config);

    // eslint-disable-next-line no-console
    console.log('[simulateur] completed');
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          mode: config.mode,
          reportDir: result.reportDir,
          files: result.files,
          dryRun: result.dryRun,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[simulateur] failed:', error instanceof Error ? error.message : error);
    // eslint-disable-next-line no-console
    console.error('\n' + usageText());
    process.exitCode = 1;
  }
}

void main();
