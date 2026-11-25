import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { deepFreeze } from './lib/deepFreeze.mjs';
import {
    applyGrades,
    getCardId,
    getDueCards,
    getLocalToday,
    getNextDueDate,
    validateDeck,
} from './lib/schedule.mjs';

const DEFAULT_NOTEBOOK = '~/code/self-learn-english';
const NOTEBOOK_BRANCH = 'main';
const DEFAULT_LIMIT = 10;
const BOM = '﻿';
const USAGE = 'Usage: cards.mjs due [limit] | cards.mjs grade <id>=<again|hard|good> ...';

const expandHome = (path) => path.replace(/^~(?=$|[\\/])/, () => homedir());

const readGit = (notebook, ...args) => {
    try {
        return execFileSync('git', ['-C', notebook, ...args], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return null;
    }
};

// realpath on both sides: Windows short names and symlinks make equal folders look different.
const checkIsSameFolder = (first, second) =>
    relative(realpathSync.native(first), realpathSync.native(second)) === '';

const locateNotebook = () => {
    const notebook = resolve(expandHome(process.env.LEARNING_NOTEBOOK || DEFAULT_NOTEBOOK));
    if (!existsSync(notebook)) throw new Error(`Notebook not found: ${notebook}`);
    const root = readGit(notebook, 'rev-parse', '--show-toplevel');
    if (!root || !checkIsSameFolder(root, notebook)) {
        throw new Error(`Notebook is not the root of a git repo: ${notebook}`);
    }
    const branch = readGit(notebook, 'branch', '--show-current');
    if (branch !== NOTEBOOK_BRANCH) {
        throw new Error(`Notebook is on "${branch}", not "${NOTEBOOK_BRANCH}": ${notebook}`);
    }
    return notebook;
};

const getDeckPath = (notebook) => join(notebook, 'vocab', 'cards.json');

const readDeck = (deckPath) => {
    if (!existsSync(deckPath)) return { cards: [] };
    const text = readFileSync(deckPath, 'utf8');
    const deck = JSON.parse(text.startsWith(BOM) ? text.slice(BOM.length) : text);
    validateDeck(deck);
    return deck;
};

// Write to a temporary file and rename, so an interrupted run cannot leave a half-written deck.
const writeDeck = (deckPath, deck) => {
    const temporaryPath = `${deckPath}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(deck, null, 2)}\n`);
    renameSync(temporaryPath, deckPath);
};

const parseLimit = (text) => {
    const limit = text === undefined ? DEFAULT_LIMIT : Number(text);
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error(`Limit must be a whole number of 1 or more.\n${USAGE}`);
    }
    return limit;
};

const parseGrades = (args) => {
    if (args.length === 0) throw new Error(USAGE);
    const grades = new Map();
    for (const arg of args) {
        const [id, grade, ...rest] = arg.split('=');
        if (!grade || rest.length > 0) throw new Error(USAGE);
        if (grades.has(id)) throw new Error(`Card "${id}" is graded twice.`);
        grades.set(id, grade);
    }
    return grades;
};

const toListedCard = (card) => {
    const { front, back, example, due, interval } = card;
    return { id: getCardId(card), front, back, example, due, interval };
};

const listDue = (notebook, deck, today, [limitText]) => {
    const dueCards = getDueCards(deck.cards, today);
    return {
        notebook,
        hasOrigin: readGit(notebook, 'remote', 'get-url', 'origin') !== null,
        today,
        totalCards: deck.cards.length,
        dueCount: dueCards.length,
        nextDue: getNextDueDate(deck.cards, today),
        cards: dueCards.slice(0, parseLimit(limitText)).map(toListedCard),
    };
};

const gradeCards = (notebook, deck, today, args) => {
    const grades = parseGrades(args);
    const cards = applyGrades(deck.cards, grades, today);
    writeDeck(getDeckPath(notebook), { ...deck, cards });
    return {
        notebook,
        graded: cards
            .filter((card) => grades.has(getCardId(card)))
            .map(({ back, interval, due }) => ({ back, interval, due })),
        stillDue: getDueCards(cards, today).length,
        nextDue: getNextDueDate(cards, today),
    };
};

const COMMANDS = deepFreeze({ due: listDue, grade: gradeCards });

const runCommand = ([command = '', ...args]) => {
    if (!Object.hasOwn(COMMANDS, command)) throw new Error(USAGE);
    const notebook = locateNotebook();
    const deck = readDeck(getDeckPath(notebook));
    return COMMANDS[command](notebook, deck, getLocalToday(), args);
};

try {
    console.log(JSON.stringify(runCommand(process.argv.slice(2)), null, 2));
} catch (error) {
    console.error(`cards: ${error.message}`);
    process.exitCode = 1;
}
