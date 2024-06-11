import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';

console.log('Loading database module...');

const dbPromise = open({
    filename: './database/memes.db',
    driver: sqlite3.Database,
});

let db;

export const initDB = async () => {
    db = await dbPromise;
    console.log('Database initialized');
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS memes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS captions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            correct INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS meme_captions (
            meme_id INTEGER NOT NULL,
            caption_id INTEGER NOT NULL,
            FOREIGN KEY(meme_id) REFERENCES memes(id),
            FOREIGN KEY(caption_id) REFERENCES captions(id)
        );

        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            date_played TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
    `);
};

export const getUserByUsername = async (username) => {
    return db.get('SELECT * FROM users WHERE username = ?', [username]);
};

export const getUserById = async (id) => {
    return db.get('SELECT * FROM users WHERE id = ?', [id]);
};

export const insertUser = async (username, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    return db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
};

export const getMemesWithCaptions = async () => {
    try {
        const query = `
            SELECT memes.id AS memeId, memes.url, captions.id AS captionId, captions.text, captions.correct
            FROM memes
            JOIN meme_captions ON memes.id = meme_captions.meme_id
            JOIN captions ON captions.id = meme_captions.caption_id
        `;
        const result = await db.all(query);
        const memesMap = {};
        result.forEach(row => {
            if (!memesMap[row.memeId]) {
                memesMap[row.memeId] = {
                    id: row.memeId,
                    url: row.url,
                    captions: []
                };
            }
            memesMap[row.memeId].captions.push({
                id: row.captionId,
                text: row.text,
                correct: !!row.correct
            });
        });
        return Object.values(memesMap);
    } catch (error) {
        console.error('Error fetching memes with captions:', error);
        throw error;
    }
};

export const insertGame = async (userId, score) => {
    const date = new Date().toISOString();
    return db.run('INSERT INTO games (user_id, score, date_played) VALUES (?, ?, ?)', [userId, score, date]);
};

export const getUserGameCount = async (userId) => {
    const result = await db.get('SELECT COUNT(*) AS gameCount FROM games WHERE user_id = ?', [userId]);
    return result.gameCount;
};

export const getUserGameHistory = async (userId) => {
    return db.all('SELECT * FROM games WHERE user_id = ? ORDER BY date_played DESC', [userId]);
};
