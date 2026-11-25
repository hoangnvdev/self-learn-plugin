import { createHash } from 'node:crypto';
import { deepFreeze } from './deepFreeze.mjs';

export const GRADES = deepFreeze({ AGAIN: 'again', HARD: 'hard', GOOD: 'good' });
export const INTERVAL_LADDER = deepFreeze([1, 3, 7, 14, 30, 60]);

const FIRST_INTERVAL = INTERVAL_LADDER[0];
const LAST_INTERVAL = INTERVAL_LADDER.at(-1);
const ID_LENGTH = 8;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatDate = (year, month, day) =>
    [String(year).padStart(4, '0'), String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');

export const getLocalToday = (now = new Date()) =>
    formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());

// Calendar arithmetic in UTC: adding days in local time can land on the wrong date across a DST change.
export const addDays = (date, days) => {
    const [year, month, day] = date.split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day + days));
    return formatDate(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
};

const checkIsRealDate = (date) =>
    typeof date === 'string' && DATE_PATTERN.test(date) && addDays(date, 0) === date;

const normalizePhrase = (phrase) => phrase.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export const getCardId = (card) =>
    createHash('sha256').update(normalizePhrase(card.back)).digest('hex').slice(0, ID_LENGTH);

export const getNextInterval = (interval, grade) => {
    if (grade === GRADES.AGAIN) return FIRST_INTERVAL;
    if (grade === GRADES.HARD) return interval;
    return INTERVAL_LADDER.find((step) => step > interval) ?? Math.max(interval, LAST_INTERVAL);
};

const checkIsValidCard = (card) =>
    Boolean(card) &&
    typeof card.front === 'string' &&
    typeof card.back === 'string' &&
    checkIsRealDate(card.due) &&
    Number.isInteger(card.interval) &&
    card.interval >= FIRST_INTERVAL;

export const validateDeck = (deck) => {
    if (!Array.isArray(deck?.cards)) throw new Error('cards.json must be an object with a "cards" array.');
    const seenIds = new Set();
    deck.cards.forEach((card, index) => {
        if (!checkIsValidCard(card)) {
            throw new Error(
                `Card ${index + 1} needs text "front" and "back", a real "due" date (YYYY-MM-DD) and a whole "interval" of 1 or more.`,
            );
        }
        const id = getCardId(card);
        if (seenIds.has(id)) throw new Error(`Card ${index + 1} repeats the phrase "${card.back}".`);
        seenIds.add(id);
    });
};

export const getDueCards = (cards, today) =>
    cards.filter((card) => card.due <= today).sort((a, b) => a.due.localeCompare(b.due));

export const getNextDueDate = (cards, today) =>
    cards.map((card) => card.due).filter((due) => due > today).sort()[0] ?? null;

export const applyGrades = (cards, grades, today) => {
    const dueIds = new Set(getDueCards(cards, today).map(getCardId));
    const validGrades = Object.values(GRADES);
    for (const [id, grade] of grades) {
        if (!validGrades.includes(grade)) throw new Error(`Unknown grade "${grade}". Use ${validGrades.join(', ')}.`);
        // Only due cards can be graded, so running the same command twice cannot move a card ahead twice.
        if (!dueIds.has(id)) throw new Error(`No due card has the id "${id}".`);
    }
    return cards.map((card) => {
        const grade = grades.get(getCardId(card));
        if (!grade) return card;
        const interval = getNextInterval(card.interval, grade);
        return { ...card, interval, due: addDays(today, interval) };
    });
};
