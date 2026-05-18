# Tally load test bot

Bot simples em Playwright para testar, com autorização, submissões sequenciais no formulário Tally `https://tally.so/r/dWxN5r`.

## Instalação

```bash
npm install
npx playwright install chromium
```

## Uso

Rode uma submissão de teste:

```bash
npm run submit:tally
```

Rode várias submissões sequenciais, com intervalo entre elas:

```bash
npm run submit:tally -- --count 25 --delay-ms 500 --email-domain seu-dominio.test
```

Use `--dry-run` para preencher os campos e marcar a caixa de termos sem clicar em **Submit**:

```bash
npm run submit:tally -- --dry-run --headful
```

## Opções

- `--url <url>`: URL do formulário Tally. Padrão: `https://tally.so/r/dWxN5r`.
- `--count <n>`: quantidade de submissões sequenciais. Padrão: `1`.
- `--delay-ms <n>`: atraso entre submissões. Padrão: `1000`.
- `--timeout-ms <n>`: timeout por página. Padrão: `30000`.
- `--email-domain <domínio>`: domínio usado para e-mails aleatórios. Padrão: `example.test`.
- `--headful`: abre o navegador visível.
- `--dry-run`: preenche o formulário, marca os termos e não envia.

O script não tenta contornar CAPTCHA, limitação de taxa ou qualquer mecanismo de proteção do Tally.
