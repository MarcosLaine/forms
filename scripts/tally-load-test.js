#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const DEFAULT_URL = 'https://tally.so/r/dWxN5r';
const DEFAULT_COUNT = 1;
const DEFAULT_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;

const firstNames = [
  'Ana', 'Bruno', 'Camila', 'Diego', 'Elisa', 'Felipe', 'Giulia', 'Henrique',
  'Isabela', 'Joao', 'Karina', 'Lucas', 'Marina', 'Nicolas', 'Olivia', 'Pedro',
  'Rafaela', 'Sofia', 'Tiago', 'Valentina', 'Alice', 'Arthur', 'Laura', 'Miguel'
];

const lastNames = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Rodrigues',
  'Almeida', 'Nascimento', 'Lima', 'Araújo', 'Fernandes', 'Carvalho', 'Gomes',
  'Martins', 'Rocha', 'Ribeiro', 'Barbosa', 'Melo', 'Dias'
];

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    count: DEFAULT_COUNT,
    delayMs: DEFAULT_DELAY_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    emailDomain: 'example.test',
    headless: true,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    switch (arg) {
      case '--url':
        options.url = next();
        break;
      case '--count':
        options.count = Number.parseInt(next(), 10);
        break;
      case '--delay-ms':
        options.delayMs = Number.parseInt(next(), 10);
        break;
      case '--timeout-ms':
        options.timeoutMs = Number.parseInt(next(), 10);
        break;
      case '--email-domain':
        options.emailDomain = next();
        break;
      case '--headful':
        options.headless = false;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error('--count must be an integer greater than zero.');
  }
  if (!Number.isInteger(options.delayMs) || options.delayMs < 0) {
    throw new Error('--delay-ms must be an integer greater than or equal to zero.');
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error('--timeout-ms must be an integer greater than or equal to 1000.');
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(options.emailDomain)) {
    throw new Error('--email-domain must look like a valid domain, for example example.test.');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run submit:tally -- [options]\n\nOptions:\n  --url <url>             Tally form URL. Defaults to ${DEFAULT_URL}\n  --count <number>        Number of sequential submissions. Defaults to ${DEFAULT_COUNT}\n  --delay-ms <number>     Delay between submissions. Defaults to ${DEFAULT_DELAY_MS}\n  --timeout-ms <number>   Per-page timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}\n  --email-domain <domain> Domain used for generated emails. Defaults to example.test\n  --headful               Show the browser while running\n  --dry-run               Fill the form and skip the final submit click\n  --help                  Show this help message\n\nExample:\n  npm run submit:tally -- --count 25 --delay-ms 500 --email-domain seu-dominio.test\n`);
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function makePerson(emailDomain) {
  const firstName = randomItem(firstNames);
  const lastName = randomItem(lastNames);
  const suffix = randomUUID().slice(0, 8);
  const emailLocalPart = `${firstName}.${lastName}.${suffix}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]/gi, '')
    .toLowerCase();

  return {
    name: `${firstName} ${lastName}`,
    email: `${emailLocalPart}@${emailDomain}`
  };
}

async function fillBestEffortField(page, labelPattern, value, fallbackIndex) {
  const labeledField = page.getByLabel(labelPattern).first();
  if (await labeledField.count()) {
    try {
      await labeledField.fill(value, { timeout: 3000 });
      return;
    } catch {
      // Continue to generic fallback for Tally's custom field markup.
    }
  }

  const placeholderField = page.getByPlaceholder(labelPattern).first();
  if (await placeholderField.count()) {
    try {
      await placeholderField.fill(value, { timeout: 3000 });
      return;
    } catch {
      // Continue to generic fallback for Tally's custom field markup.
    }
  }

  const fields = page.locator('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]');
  const field = fields.nth(fallbackIndex);
  await field.waitFor({ state: 'visible', timeout: 10000 });

  const tagName = await field.evaluate((element) => element.tagName.toLowerCase());
  if (tagName === 'input' || tagName === 'textarea') {
    await field.fill(value);
    return;
  }

  await field.click();
  await field.evaluate((element, text) => {
    element.textContent = text;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }, value);
}

async function checkTerms(page) {
  const checkbox = page.getByRole('checkbox').first();
  if (await checkbox.count()) {
    await checkbox.check({ timeout: 10000 });
    return;
  }

  const agreeText = page.getByText(/agree|aceito|concordo|terms|termos/i).first();
  if (await agreeText.count()) {
    await agreeText.click({ timeout: 10000 });
    return;
  }

  throw new Error('Could not find the terms checkbox.');
}

async function submitForm(page, dryRun) {
  if (dryRun) {
    return;
  }

  const submitButton = page.getByRole('button', { name: /submit|enviar|send|inscrever/i }).first();
  if (await submitButton.count()) {
    await submitButton.click({ timeout: 10000 });
    return;
  }

  await page.locator('button, [role="button"], input[type="submit"]').last().click({ timeout: 10000 });
}

async function submitOne(browser, options, index) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(options.timeoutMs);

  const person = makePerson(options.emailDomain);

  try {
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
    await fillBestEffortField(page, /name|nome/i, person.name, 0);
    await fillBestEffortField(page, /e-?mail|email/i, person.email, 1);
    await checkTerms(page);
    await submitForm(page, options.dryRun);

    if (!options.dryRun) {
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(750);
    }

    console.log(`${options.dryRun ? 'Filled' : 'Submitted'} #${index}: ${person.name} <${person.email}>`);
    return { ok: true };
  } catch (error) {
    const screenshot = `tally-failure-${index}.png`;
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => undefined);
    console.error(`Failed #${index}: ${error.message}. Screenshot: ${screenshot}`);
    return { ok: false };
  } finally {
    await context.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch({ headless: options.headless });
  let successCount = 0;

  try {
    for (let index = 1; index <= options.count; index += 1) {
      const result = await submitOne(browser, options, index);
      if (result.ok) {
        successCount += 1;
      }

      if (index < options.count && options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`Done: ${successCount}/${options.count} ${options.dryRun ? 'filled' : 'submitted'} successfully.`);
  if (successCount !== options.count) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
