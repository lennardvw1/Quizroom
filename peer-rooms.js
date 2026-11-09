(() => {
  if (!window.Peer) {
    window.QuizroomPeer = { configured: false, error: 'The room connection library did not load. Check your internet connection and refresh.' };
    return;
  }

  const ready = Promise.resolve();
  const peerOptions = { host: '0.peerjs.com', port: 443, path: '/', secure: true, key: 'peerjs' };
  const hostRooms = new Map();
  const hostPeers = new Map();
  const playerConnections = new Map();
  let requestId = 0;

  function makeCode() {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String(100000 + (values[0] % 900000));
  }

  function makeToken() {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`;
  }

  function waitFor(target, eventName, timeoutMs = 18000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('The peer connection timed out. Check your internet connection and try again.')), timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        target.off?.(eventName, onSuccess);
        target.off?.('error', onError);
      };
      const finish = (error, value) => {
        cleanup();
        if (error) reject(error);
        else resolve(value);
      };
      const onSuccess = (value) => finish(null, value);
      const onError = (error) => finish(error instanceof Error ? error : new Error(String(error)));
      target.on(eventName, onSuccess);
      target.on('error', onError);
    });
  }

  function configureHostPeer(peer, code) {
    peer.on('connection', (connection) => {
      connection.on('data', async (packet) => {
        if (!packet || packet.kind !== 'request' || !packet.id) return;
        try {
          const value = await handleHostRequest(packet.url, packet.options || {});
          connection.send({ id: packet.id, value });
        } catch (error) {
          connection.send({ id: packet.id, error: error.message || 'The host could not process that request.' });
        }
      });
    });
    peer.on('disconnected', () => {
      if (hostPeers.get(code)?.peer === peer) peer.reconnect();
    });
  }

  async function createRoom(body) {
    if (!body.pack || !Array.isArray(body.pack.questions) || body.pack.questions.length === 0) {
      throw new Error('Add at least one complete question to this pack.');
    }
    const gameType = ['quiz', 'snake', 'platformer', 'tower-defense', 'meteor-dash'].includes(body.gameType) ? body.gameType : 'quiz';
    const hostName = String(body.hostName || 'Host').trim().slice(0, 24);
    const hostPlayerId = gameType === 'quiz' ? null : crypto.randomUUID();
    const hostToken = makeToken();
    let lastError;

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = makeCode();
      if (hostRooms.has(code)) continue;
      const room = {
        code,
        hostToken,
        hostName,
        mode: ['classic', 'streak', 'survival'].includes(body.mode) ? body.mode : 'classic',
        gameType,
        packTitle: String(body.pack.title || 'Untitled pack').trim().slice(0, 60),
        questions: body.pack.questions.map((question) => ({
          prompt: String(question.prompt).trim().slice(0, 300),
          choices: question.choices.map((choice) => String(choice).trim().slice(0, 120)),
          correctIndex: question.correctIndex,
        })),
        players: hostPlayerId ? [{ id: hostPlayerId, name: hostName, score: 0, streak: 0, lives: 3, done: false }] : [],
        answers: {},
        phase: 'lobby',
        questionIndex: -1,
        questionStartedAt: 0,
      };
      const peer = new Peer(`quizroom-${code}`, peerOptions);
      configureHostPeer(peer, code);
      hostRooms.set(code, room);
      try {
        await waitFor(peer, 'open');
        hostPeers.set(code, { peer, room });
        return { code, hostToken, hostPlayerId };
      } catch (error) {
        lastError = error;
        hostRooms.delete(code);
        peer.destroy();
        if (error.type !== 'unavailable-id') throw new Error(`Could not open a game room. ${error.message}`);
      }
    }
    throw new Error(`Could not reserve a room code. ${lastError?.message || ''}`.trim());
  }

  async function connectToHost(code) {
    if (playerConnections.has(code)) return playerConnections.get(code);
    const peer = new Peer(undefined, peerOptions);
    let connection;
    const pending = new Map();
    const cleanup = () => {
      playerConnections.delete(code);
      pending.forEach(({ reject, timer }) => {
        clearTimeout(timer);
        reject(new Error('The host connection closed. Ask the host to reopen the game room.'));
      });
      pending.clear();
      peer.destroy();
    };

    try {
      await waitFor(peer, 'open');
      connection = peer.connect(`quizroom-${code}`, { reliable: true });
      connection.on('data', (packet) => {
        const request = pending.get(packet?.id);
        if (!request) return;
        pending.delete(packet.id);
        clearTimeout(request.timer);
        if (packet.error) request.reject(new Error(packet.error));
        else request.resolve(packet.value);
      });
      connection.on('close', cleanup);
      const closed = new Promise((_, reject) => connection.on('error', reject));
      const peerError = new Promise((_, reject) => peer.on('error', reject));
      await Promise.race([waitFor(connection, 'open'), closed, peerError]);
    } catch (error) {
      peer.destroy();
      throw new Error(`Could not reach the host. Check the game code and make sure their game tab is open. ${error.message}`);
    }

    const session = {
      peer,
      connection,
      pending,
      request(url, options) {
        const id = String(++requestId);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error('The host did not respond. Please try again.'));
          }, 18000);
          pending.set(id, { resolve, reject, timer });
          connection.send({ kind: 'request', id, url, options });
        });
      },
      close: cleanup,
    };
    playerConnections.set(code, session);
    return session;
  }

  async function sendToHost(code, url, options) {
    const session = await connectToHost(code);
    return session.request(url, options);
  }

  function parseBody(options) {
    return options.body ? JSON.parse(options.body) : {};
  }

  async function handleHostRequest(url, options = {}) {
    const requestUrl = new URL(url, window.location.href);
    const match = requestUrl.pathname.match(/\/api\/rooms\/([A-Z0-9]+)(?:\/(join|start|answer|next|score|finish))?$/i);
    if (!match) throw new Error('Unknown multiplayer request.');
    const [, code, action] = match;
    const room = hostRooms.get(code.toUpperCase());
    if (!room) throw new Error('That game code was not found.');
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = parseBody(options);

    if (action === 'join' && method === 'POST') {
      if (room.phase !== 'lobby') throw new Error('This game has already started.');
      const name = String(body.name || '').trim().slice(0, 24);
      if (!name) throw new Error('Enter a name to join.');
      const player = { id: crypto.randomUUID(), name, score: 0, streak: 0, lives: 3, done: false };
      room.players.push(player);
      return { playerId: player.id };
    }

    if (action === 'start' && method === 'POST') {
      if (headers['x-host-token'] !== room.hostToken || room.phase !== 'lobby') throw new Error('Only the host can start a game that is still in the lobby.');
      room.phase = 'playing';
      room.questionIndex = 0;
      room.questionStartedAt = Date.now();
      return { ok: true };
    }

    if (action === 'answer' && method === 'POST') {
      const player = room.players.find((candidate) => candidate.id === body.playerId);
      if (!player) throw new Error('You are not in this game.');
      if (room.phase !== 'playing') throw new Error('This question is no longer active.');
      if (room.mode === 'survival' && player.lives === 0) throw new Error('You are out of lives. Watch the rest of the game.');
      if (!Number.isInteger(body.choice) || body.choice < 0 || body.choice > 3) throw new Error('Choose one of the answers.');
      room.answers[room.questionIndex] ||= {};
      if (room.answers[room.questionIndex][player.id]) throw new Error('You already answered this question.');
      const question = room.questions[room.questionIndex];
      const correct = body.choice === question.correctIndex;
      player.streak = correct ? player.streak + 1 : 0;
      const multiplier = room.mode === 'streak' && correct ? Math.min(player.streak, 3) : 1;
      const basePoints = correct ? Math.max(100, 1000 - Math.floor((Date.now() - room.questionStartedAt) / 35)) : 0;
      const points = basePoints * multiplier;
      if (room.mode === 'survival' && !correct) player.lives = Math.max(0, player.lives - 1);
      player.score += points;
      const answer = { correct, correctIndex: question.correctIndex, choice: body.choice, points, multiplier, streak: player.streak, lives: player.lives, eliminated: room.mode === 'survival' && player.lives === 0 };
      room.answers[room.questionIndex][player.id] = answer;
      return answer;
    }

    if (action === 'next' && method === 'POST') {
      if (headers['x-host-token'] !== room.hostToken || room.phase !== 'playing') throw new Error('Only the host can advance an active quiz.');
      room.questionIndex += 1;
      if (room.questionIndex >= room.questions.length) room.phase = 'finished';
      else room.questionStartedAt = Date.now();
      return { ok: true, phase: room.phase };
    }

    if (action === 'score' && method === 'POST') {
      const player = room.players.find((candidate) => candidate.id === body.playerId);
      if (!player || room.gameType === 'quiz' || room.phase !== 'playing') throw new Error('This arcade game is not active.');
      if (!Number.isSafeInteger(body.score) || body.score < 0 || body.score > 1_000_000) throw new Error('Score is out of range.');
      player.score = Math.max(player.score, body.score);
      player.done = player.done || Boolean(body.done);
      if (room.players.length && room.players.every((candidate) => candidate.done)) room.phase = 'finished';
      return { score: player.score, done: player.done, phase: room.phase };
    }

    if (action === 'finish' && method === 'POST') {
      if (headers['x-host-token'] !== room.hostToken || room.phase !== 'playing' || room.gameType === 'quiz') throw new Error('Only the host can end an active arcade match.');
      room.phase = 'finished';
      return { ok: true };
    }

    if (!action && method === 'GET') {
      const playerId = requestUrl.searchParams.get('playerId');
      const isHost = requestUrl.searchParams.get('host') === room.hostToken;
      const player = room.players.find((candidate) => candidate.id === playerId);
      if (!isHost && !player) throw new Error('You are not in this game.');
      const index = room.questionIndex;
      const answer = index >= 0 ? room.answers[index]?.[isHost ? 'host' : playerId] : undefined;
      const question = room.phase === 'playing' ? room.questions[index] : undefined;
      const state = {
        code: room.code,
        phase: room.phase,
        mode: room.mode,
        gameType: room.gameType,
        packTitle: room.packTitle,
        hostName: room.hostName,
        players: room.players,
        questionIndex: index,
        questionCount: room.questions.length,
        answeredCount: index >= 0 ? Object.keys(room.answers[index] || {}).length : 0,
      };
      if (room.gameType !== 'quiz') state.gameQuestions = room.questions;
      if (!isHost && player) state.playerStatus = { lives: player.lives, streak: player.streak, eliminated: room.mode === 'survival' && player.lives === 0 };
      if (question) state.question = { prompt: question.prompt, choices: question.choices, ...(isHost || answer ? { correctIndex: question.correctIndex } : {}) };
      if (answer && !isHost) state.result = answer;
      return state;
    }
    throw new Error('Unsupported multiplayer request.');
  }

  async function request(url, options = {}) {
    await ready;
    const requestUrl = new URL(url, window.location.href);
    const method = options.method || 'GET';
    const body = parseBody(options);
    if (requestUrl.pathname.endsWith('/api/rooms') && method === 'POST') return createRoom(body);
    const match = requestUrl.pathname.match(/\/api\/rooms\/([A-Z0-9]+)(?:\/(join|start|answer|next|score|finish))?$/i);
    if (!match) throw new Error('Unknown multiplayer request.');
    const code = match[1].toUpperCase();
    if (hostRooms.has(code)) return handleHostRequest(url, options);
    if (match[2] === 'join' && method === 'POST' && !playerConnections.has(code)) {
      const session = await connectToHost(code);
      return session.request(url, options);
    }
    return sendToHost(code, url, options);
  }

  function leave(code) {
    const normalizedCode = String(code || '').toUpperCase();
    const host = hostPeers.get(normalizedCode);
    if (host) {
      host.peer.destroy();
      hostPeers.delete(normalizedCode);
      hostRooms.delete(normalizedCode);
    }
    playerConnections.get(normalizedCode)?.close();
  }

  window.QuizroomPeer = { configured: true, request, leave };
})();