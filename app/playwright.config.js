// Testes de fumaça do app (D69): o app de verdade (build + vite preview)
// num Chrome, com o Supabase SIMULADO (testes/simulador.js). Pegam o tipo de
// erro que o teste do banco não pega: tela que não abre, botão que não chama
// a função certa, classe de CSS que some.
//
//   npm test                 roda tudo
//   npm test -- --headed     com a janela aberta, para ver
//
// O Chrome: `npx playwright install chromium` uma vez, ou CHROME=/caminho
// para usar um que já está instalado.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './testes',
    timeout: 30_000,
    fullyParallel: true,
    reporter: [['list']],
    use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        baseURL: 'http://localhost:4174',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        launchOptions: process.env.CHROME ? { executablePath: process.env.CHROME } : {},
    },
    webServer: {
        command: 'npm run build && npx vite preview --port 4174 --strictPort',
        url: 'http://localhost:4174',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
