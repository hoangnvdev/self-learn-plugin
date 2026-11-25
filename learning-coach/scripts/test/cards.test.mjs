import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { deepFreeze } from '../lib/deepFreeze.mjs';
import {
    addDays,
    applyGrades,
    getCardId,
    getDueCards,
    getLocalToday,
    getNextInterval,
    validateDeck,
} from '../lib/schedule.mjs';

const TODAY = '2026-11-25';
const SCRIPT = fileURLToPath(new URL('../cards.mjs', import.meta.url));

const buildCard = (back, overrides = {}) => ({
    front: 'f',
    back,
    example: 'e',
    due: TODAY,
    interval: 1,
    ease: 2.5,
    ...overrides,
});

const createNotebook = (context, cards, branch = 'main') => {
    const path = mkdtempSync(join(tmpdir(), 'notebook-'));
    context.after(() => rmSync(path, { recursive: true, force: true }));
    execFileSync('git', ['init', '-q', '-b', branch, path]);
    mkdirSync(join(path, 'vocab'));
    writeFileSync(join(path, 'vocab', 'cards.json'), JSON.stringify({ note: 'keep', cards }));
    return path;
};

const readCardsFile = (notebook) => readFileSync(join(notebook, 'vocab', 'cards.json'), 'utf8');

const runScript = (notebook, ...args) =>
    spawnSync(process.execPath, [SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, LEARNING_NOTEBOOK: notebook },
    });

test('deepFreeze freezes nested values', () => {
    const value = deepFreeze({ list: [{ id: 1 }] });
    assert.throws(() => value.list.push(2), TypeError);
    assert.throws(() => {
        value.list[0].id = 2;
    }, TypeError);
});

test('addDays crosses month, year and leap day', () => {
    assert.equal(addDays('2026-11-25', 7), '2026-12-02');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('getLocalToday uses the local date', () => {
    assert.equal(getLocalToday(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('getNextInterval follows the ladder', () => {
    assert.equal(getNextInterval(1, 'good'), 3);
    assert.equal(getNextInterval(5, 'good'), 7);
    assert.equal(getNextInterval(60, 'good'), 60);
    assert.equal(getNextInterval(90, 'good'), 90);
    assert.equal(getNextInterval(14, 'hard'), 14);
    assert.equal(getNextInterval(30, 'again'), 1);
});

test('getDueCards returns due cards, oldest first', () => {
    const cards = [buildCard('a'), buildCard('b', { due: '2026-11-26' }), buildCard('c', { due: '2026-11-01' })];
    assert.deepEqual(getDueCards(cards, TODAY).map((card) => card.back), ['c', 'a']);
});

test('applyGrades reschedules from today, keeps other fields and rejects a repeat', () => {
    const card = buildCard('a', { due: '2026-11-01', source: 'x' });
    const grades = new Map([[getCardId(card), 'good']]);
    const [updated] = applyGrades([card], grades, TODAY);
    assert.deepEqual(updated, { ...card, interval: 3, due: '2026-11-28' });
    assert.throws(() => applyGrades([updated], grades, TODAY), /No due card/);
});

test('validateDeck rejects bad dates, bad intervals and repeated phrases', () => {
    assert.throws(() => validateDeck([]), /"cards" array/);
    assert.throws(() => validateDeck({ cards: [buildCard('a', { due: '2026-02-30' })] }), /Card 1/);
    assert.throws(() => validateDeck({ cards: [buildCard('a', { interval: '1' })] }), /Card 1/);
    assert.throws(() => validateDeck({ cards: [buildCard('Take a look…'), buildCard('take a look')] }), /repeats/);
});

test('script lists and grades cards, keeping unknown fields', (context) => {
    const notebook = createNotebook(context, [buildCard('a', { due: '2020-01-01' })]);
    const listed = JSON.parse(runScript(notebook, 'due').stdout);
    assert.equal(listed.dueCount, 1);
    assert.equal(listed.hasOrigin, false);
    assert.equal(runScript(notebook, 'grade', `${listed.cards[0].id}=good`).status, 0);
    const saved = JSON.parse(readCardsFile(notebook));
    assert.equal(saved.note, 'keep');
    assert.equal(saved.cards[0].interval, 3);
    assert.equal(saved.cards[0].ease, 2.5);
});

test('script changes nothing when one grade is invalid', (context) => {
    const card = buildCard('a', { due: '2020-01-01' });
    const notebook = createNotebook(context, [card]);
    const before = readCardsFile(notebook);
    assert.equal(runScript(notebook, 'grade', `${getCardId(card)}=good`, 'nope=good').status, 1);
    assert.equal(readCardsFile(notebook), before);
});

test('script refuses a missing notebook, a subfolder and another branch', (context) => {
    const notebook = createNotebook(context, []);
    assert.match(runScript(join(notebook, 'none'), 'due').stderr, /not found/);
    assert.match(runScript(join(notebook, 'vocab'), 'due').stderr, /not the root/);
    assert.match(runScript(createNotebook(context, [], 'other'), 'due').stderr, /not "main"/);
});
