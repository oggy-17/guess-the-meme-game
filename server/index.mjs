import express from 'express';
import session from 'express-session';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, getUserByUsername, insertUser, getUserById, getMemesWithCaptions, insertGame, getUserGameCount, getUserGameHistory } from './controllers/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

console.log('Using database file:', './database/memes.db'); // Confirm database file path

app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

// Serve static files from the "memes" directory
app.use('/memes', express.static(path.join(__dirname, 'memes')));

app.use(
    session({
        secret: 'your_secret_key',
        resave: false,
        saveUninitialized: false,
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
    new LocalStrategy(async (username, password, done) => {
        try {
            const user = await getUserByUsername(username);
            if (!user) {
                return done(null, false, { message: 'User not found. Please register.' });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password.' });
            }
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await getUserById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(401).json({ message: info.message });
        }
        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.sendStatus(200);
        });
    })(req, res, next);
});

app.post('/api/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Failed to log out' });
        }
        res.sendStatus(200);
    });
});

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        await insertUser(username, password);
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.get('/api/memes', async (req, res) => {
    try {
        console.log('Fetching memes...');
        const memes = await getMemesWithCaptions();
        res.json(memes);
    } catch (error) {
        console.error('Failed to fetch memes:', error);
        res.status(500).json({ error: 'Failed to fetch memes', details: error.message });
    }
});

app.post('/api/game', async (req, res) => {
    const { score } = req.body;
    const userId = req.user ? req.user.id : null;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        await insertGame(userId, score);
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save game' });
    }
});

app.get('/api/user/gamecount', async (req, res) => {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const gameCount = await getUserGameCount(userId);
        res.json({ gameCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch game count' });
    }
});

app.get('/api/user/history', async (req, res) => {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const history = await getUserGameHistory(userId);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch game history' });
    }
});

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
