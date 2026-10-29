import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { getReadyUrl, workspaceRoot } from '@nx/devkit';

const isCI = !!process.env['CI'];
// For CI, you may want to set BASE_URL to the deployed application.
// getReadyUrl moves the address to the port the dev server task reported.
const baseURL = process.env['BASE_URL'] || getReadyUrl('http://localhost:4200');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /*
   * Dois servidores: a aplicação não tem o que mostrar sem a API.
   *
   * O `serve-static` do CI não tem o proxy de desenvolvimento que redireciona
   * `/api` para a porta 3000, então o `BASE_URL` do navegador e o da API
   * precisam combinar — por isso a API sobe de verdade nos dois ambientes, e
   * não só localmente.
   *
   * `reuseExistingServer` aproveita os servidores que já estiverem de pé na
   * máquina de quem desenvolve, em vez de brigar pela porta.
   */
  webServer: [
    {
      command: 'npx nx run api:serve',
      url: 'http://localhost:3000/api',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
    {
      command: isCI ? 'npx nx run web:serve-static' : 'npx nx run web:serve',
      url: getReadyUrl('http://localhost:4200'),
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 120_000,
    },
  ],
  /*
   * Só Chromium.
   *
   * O job de CI instala apenas `chromium` (`playwright install --with-deps
   * chromium`), então Firefox e WebKit falhariam por navegador ausente — eles
   * vinham do gerador do Nx e nunca chegaram a rodar. Três navegadores também
   * triplicam o custo de um job que o próprio workflow chama de caro; quando a
   * compatibilidade entre motores for uma questão real, a decisão volta com um
   * motivo.
   */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
