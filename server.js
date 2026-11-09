const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');

const root = __dirname;
const rooms = new Map();
const gameModes = ['classic', 'streak', 'survival'];
const gameTypes = ['quiz', 'snake', 'platformer', 'tower-defense', 'meteor-dash'];
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request is too large.');
  }
  return body ? JSON.parse(body) : {};
}

function roomFor(code) {
  return rooms.get(code.toUpperCase());
}

function validQuestions(questions) {
  return Array.isArray(questions) && questions.length > 0 && questions.length <= 30 &&
    questions.every((question) => typeof question.prompt === 'string' && question.prompt.trim() &&
      Array.isArray(question.choices) && question.choices.length === 4 &&
      question.choices.every((choice) => typeof choice === 'string' && choice.trim()) &&
      Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 4);
}

function publicRoom(room, identity, isHost) {
  const index = room.questionIndex;
  const answer = index >= 0 ? room.answers.get(index)?.[identity] : undefined;
  const player = room.players.find((candidate) => candidate.id === identity);
  const question = room.phase === 'playing' ? room.questions[index] : undefined;
  return {
    code: room.code,
    phase: room.phase,
    mode: room.mode,
    gameType: room.gameType,
    packTitle: room.packTitle,
    hostName: room.hostName,
    players: room.players.map(({ id, name, score, done }) => ({ id, name, score, done })),
    questionIndex: index,
    questionCount: room.questions.length,
    gameQuestions: room.gameType === 'quiz' ? undefined : room.questions,
    playerStatus: !isHost && player ? { lives: player.lives, streak: player.streak, eliminated: room.mode === 'survival' && player.lives === 0 } : undefined,
    question: question ? {
      prompt: question.prompt,
      choices: question.choices,
      ...(isHost || answer ? { correctIndex: question.correctIndex } : {}),
    } : undefined,
    answeredCount: index >= 0 ? Object.keys(room.answers.get(index) || {}).length : 0,
    ...(answer && !isHost ? { result: answer } : {}),
  };
}

function matchesHost(room, request) {
  return request.headers['x-host-token'] === room.hostToken;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const route = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]+)(?:\/(join|start|answer|next|score|finish))?$/i);

  try {
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const body = await readJson(request);
      if (!body.pack || !validQuestions(body.pack.questions)) {
        return sendJson(response, 400, { error: 'Add at least one complete question to this pack.' });
      }
      const gameType = gameTypes.includes(body.gameType) ? body.gameType : 'quiz';
      const hostName = String(body.hostName || 'Host').trim().slice(0, 24);
      const hostPlayer = gameType === 'quiz' ? null : { id: randomUUID(), name: hostName, score: 0, streak: 0, lives: 3, done: false };
      let code;
      do {
        code = String(Math.floor(100000 + Math.random() * 900000));
      } while (rooms.has(code));
      const hostToken = randomBytes(24).toString('hex');
      const room = {
        code,
        hostToken,
        hostName,
        mode: gameModes.includes(body.mode) ? body.mode : 'classic',
        gameType,
        packTitle: String(body.pack.title || 'Untitled pack').trim().slice(0, 60),
        questions: body.pack.questions.map((question) => ({
          prompt: question.prompt.trim().slice(0, 300),
          choices: question.choices.map((choice) => choice.trim().slice(0, 120)),
          correctIndex: question.correctIndex,
        })),
        players: hostPlayer ? [hostPlayer] : [],
        answers: new Map(),
        phase: 'lobby',
        questionIndex: -1,
        questionStartedAt: 0,
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      return sendJson(response, 201, { code, hostToken, hostPlayerId: hostPlayer?.id });
    }

    if (route) {
      const [, code, action] = route;
      const room = roomFor(code);
      if (!room) return sendJson(response, 404, { error: 'That game code was not found.' });

      if (action === 'join' && request.method === 'POST') {
        if (room.phase !== 'lobby') return sendJson(response, 409, { error: 'This game has already started.' });
        const body = await readJson(request);
        const name = String(body.name || '').trim().slice(0, 24);
        if (!name) return sendJson(response, 400, { error: 'Enter a name to join.' });
        const player = { id: randomUUID(), name, score: 0, streak: 0, lives: 3, done: false };
        room.players.push(player);
        return sendJson(response, 201, { playerId: player.id });
      }

      if (action === 'start' && request.method === 'POST') {
        if (!matchesHost(room, request)) return sendJson(response, 403, { error: 'Only the host can start this game.' });
        if (room.phase !== 'lobby') return sendJson(response, 409, { error: 'This game is not in the lobby.' });
        room.phase = 'playing';
        room.questionIndex = 0;
        room.questionStartedAt = Date.now();
        return sendJson(response, 200, { ok: true });
      }

      if (action === 'answer' && request.method === 'POST') {
        const body = await readJson(request);
        const player = room.players.find((candidate) => candidate.id === body.playerId);
        if (!player) return sendJson(response, 403, { error: 'Rejoin this game to continue.' });
        if (room.phase !== 'playing') return sendJson(response, 409, { error: 'This question is no longer active.' });
        if (room.mode === 'survival' && player.lives === 0) return sendJson(response, 409, { error: 'You are out of lives. Watch the rest of the game.' });
        if (!Number.isInteger(body.choice) || body.choice < 0 || body.choice > 3) {
          return sendJson(response, 400, { error: 'Choose one of the answers.' });
        }
        let roundAnswers = room.answers.get(room.questionIndex);
        if (!roundAnswers) room.answers.set(room.questionIndex, roundAnswers = {});
        if (roundAnswers[player.id]) return sendJson(response, 409, { error: 'You already answered this question.' });
        const correct = body.choice === room.questions[room.questionIndex].correctIndex;
        player.streak = correct ? player.streak + 1 : 0;
        const multiplier = room.mode === 'streak' && correct ? Math.min(player.streak, 3) : 1;
        const basePoints = correct ? Math.max(100, 1000 - Math.floor((Date.now() - room.questionStartedAt) / 35)) : 0;
        const points = basePoints * multiplier;
        if (room.mode === 'survival' && !correct) player.lives = Math.max(0, player.lives - 1);
        player.score += points;
        roundAnswers[player.id] = {
          correct,
          correctIndex: room.questions[room.questionIndex].correctIndex,
          choice: body.choice,
          points,
          multiplier,
          streak: player.streak,
          lives: player.lives,
          eliminated: room.mode === 'survival' && player.lives === 0,
        };
        return sendJson(response, 200, roundAnswers[player.id]);
      }

      if (action === 'next' && request.method === 'POST') {
        if (!matchesHost(room, request)) return sendJson(response, 403, { error: 'Only the host can advance the game.' });
        if (room.phase !== 'playing') return sendJson(response, 409, { error: 'There is no active question.' });
        room.questionIndex += 1;
        if (room.questionIndex >= room.questions.length) {
          room.phase = 'finished';
        } else {
          room.questionStartedAt = Date.now();
        }
        return sendJson(response, 200, { ok: true, phase: room.phase });
      }

      if (action === 'score' && request.method === 'POST') {
        const body = await readJson(request);
        const player = room.players.find((candidate) => candidate.id === body.playerId);
        if (!player) return sendJson(response, 403, { error: 'You are not in this game.' });
        if (room.gameType === 'quiz' || room.phase !== 'playing') return sendJson(response, 409, { error: 'This arcade game is not active.' });
        if (!Number.isSafeInteger(body.score) || body.score < 0 || body.score > 1_000_000) {
          return sendJson(response, 400, { error: 'Score is out of range.' });
        }
        player.score = Math.max(player.score, body.score);
        player.done = player.done || Boolean(body.done);
        if (room.players.length && room.players.every((candidate) => candidate.done)) room.phase = 'finished';
        return sendJson(response, 200, { score: player.score, done: player.done, phase: room.phase });
      }

      if (action === 'finish' && request.method === 'POST') {
        if (!matchesHost(room, request)) return sendJson(response, 403, { error: 'Only the host can end this game.' });
        if (room.phase !== 'playing' || room.gameType === 'quiz') return sendJson(response, 409, { error: 'There is no active arcade game.' });
        room.phase = 'finished';
        return sendJson(response, 200, { ok: true });
      }

      if (!action && request.method === 'GET') {
        const playerId = url.searchParams.get('playerId');
        const isHost = url.searchParams.has('host') && url.searchParams.get('host') === room.hostToken;
        if (!isHost && !room.players.some((player) => player.id === playerId)) {
          return sendJson(response, 403, { error: 'You are not in this game.' });
        }
        return sendJson(response, 200, publicRoom(room, isHost ? 'host' : playerId, isHost));
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return sendJson(response, 404, { error: 'Not found.' });
    }
    const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.resolve(root, `.${requestedPath}`);
    if (!filePath.startsWith(`${root}${path.sep}`)) return sendJson(response, 403, { error: 'Forbidden.' });
    fs.readFile(filePath, (error, content) => {
      if (error) return sendJson(response, 404, { error: 'Not found.' });
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : content);
    });
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    sendJson(response, status, { error: status === 400 ? 'Invalid request data.' : error.message });
  }
});

setInterval(() => {
  for (const [code, room] of rooms) {
    if (Date.now() - room.createdAt > 4 * 60 * 60 * 1000) rooms.delete(code);
  }
}, 60 * 60 * 1000).unref();

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Quizroom is running at http://localhost:${port}`);
});