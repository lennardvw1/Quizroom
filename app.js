const starterPacks = [
  {
    id: 'starter-pack', title: 'Quickfire general knowledge',
    questions: [
      { prompt: 'Which planet has the most moons?', choices: ['Earth', 'Saturn', 'Mars', 'Venus'], correctIndex: 1 },
      { prompt: 'What is the largest ocean on Earth?', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3 },
      { prompt: 'How many sides does a hexagon have?', choices: ['Five', 'Six', 'Seven', 'Eight'], correctIndex: 1 },
      { prompt: 'Which animal is the tallest in the world?', choices: ['Elephant', 'Ostrich', 'Giraffe', 'Camel'], correctIndex: 2 },
    ],
  },
  {
    id: 'starter-world', title: 'Around the world',
    questions: [
      { prompt: 'What is the capital of Japan?', choices: ['Kyoto', 'Tokyo', 'Osaka', 'Sapporo'], correctIndex: 1 },
      { prompt: 'Which country is home to the city of Marrakech?', choices: ['Egypt', 'Morocco', 'Turkey', 'Greece'], correctIndex: 1 },
      { prompt: 'The Andes mountains are primarily in which continent?', choices: ['Asia', 'Europe', 'South America', 'Africa'], correctIndex: 2 },
      { prompt: 'Which river runs through London?', choices: ['Seine', 'Danube', 'Thames', 'Rhine'], correctIndex: 2 },
    ],
  },
  {
    id: 'starter-science', title: 'Curious minds: science',
    questions: [
      { prompt: 'What gas do plants absorb from the atmosphere?', choices: ['Oxygen', 'Carbon dioxide', 'Helium', 'Hydrogen'], correctIndex: 1 },
      { prompt: 'What is the chemical symbol for gold?', choices: ['Ag', 'Go', 'Au', 'Gd'], correctIndex: 2 },
      { prompt: 'Which part of a cell contains most of its genetic material?', choices: ['Nucleus', 'Membrane', 'Ribosome', 'Cytoplasm'], correctIndex: 0 },
      { prompt: 'How many bones are in the typical adult human body?', choices: ['106', '206', '306', '406'], correctIndex: 1 },
    ],
  },
  {
    id: 'starter-nature', title: 'Wild world',
    questions: [
      { prompt: 'What is the largest species of big cat?', choices: ['Lion', 'Leopard', 'Tiger', 'Jaguar'], correctIndex: 2 },
      { prompt: 'Which animal is known for changing color to blend in?', choices: ['Chameleon', 'Meerkat', 'Toucan', 'Panda'], correctIndex: 0 },
      { prompt: 'What is a group of crows commonly called?', choices: ['A school', 'A murder', 'A herd', 'A pod'], correctIndex: 1 },
      { prompt: 'Which of these is a mammal that lays eggs?', choices: ['Koala', 'Platypus', 'Otter', 'Sloth'], correctIndex: 1 },
    ],
  },
  {
    id: 'starter-wordplay', title: 'Wordplay & brain teasers',
    questions: [
      { prompt: 'What word becomes shorter when you add two letters to it?', choices: ['Short', 'Small', 'Tiny', 'Brief'], correctIndex: 0 },
      { prompt: 'Which of these is a palindrome?', choices: ['Level', 'Table', 'World', 'Point'], correctIndex: 0 },
      { prompt: 'What comes next: 2, 4, 8, 16, ...?', choices: ['20', '24', '30', '32'], correctIndex: 3 },
      { prompt: 'How many months have 28 days?', choices: ['One', 'Two', 'Six', 'Twelve'], correctIndex: 3 },
    ],
  },
];
const starterPackIds = new Set(starterPacks.map((pack) => pack.id));
const gameModes = [
  { id: 'classic', title: 'Classic', detail: 'Fast answers score more', symbol: '↗' },
  { id: 'streak', title: 'Streak', detail: 'Chain right answers for up to 3× points', symbol: '⚡' },
  { id: 'survival', title: 'Survival', detail: 'Three misses and you’re out', symbol: '♥' },
];
const gameTypes = [
  { id: 'quiz', title: 'Quiz battle', detail: 'Race through the pack together', symbol: '?' },
  { id: 'snake', title: 'Snake', detail: 'Every fruit comes with a question', symbol: 'S', controls: 'Arrow keys or WASD to steer' },
  { id: 'platformer', title: 'Coin climber', detail: 'Collect coins, answer to keep climbing', symbol: '↑', controls: 'A/D or arrows to move · Space to jump' },
  { id: 'tower-defense', title: 'Tower defense', detail: 'Answer each wave to earn tower money', symbol: '▦', controls: 'Place towers beside the path · stop all five waves' },
  { id: 'meteor-dash', title: 'Meteor dash', detail: 'Dodge meteors and quiz for bonus points', symbol: '✦', controls: 'Arrow keys or A/D to dodge' },
];
const colors = ['peach', 'blue', 'yellow', 'green'];
const letters = ['A', 'B', 'C', 'D'];
const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
let packs = loadPacks();
let currentPage = 'home';
let roomSession = null;
let roomPoll = null;
let currentRoom = null;
let draft = null;

function loadPacks() {
  try {
    const saved = JSON.parse(localStorage.getItem('quizroom-packs'));
    const userPacks = Array.isArray(saved) ? saved.filter((pack) => !starterPackIds.has(pack.id)) : [];
    return [...starterPacks, ...userPacks];
  } catch {
    return starterPacks;
  }
}

function savePacks() {
  localStorage.setItem('quizroom-packs', JSON.stringify(packs));
  document.querySelector('#pack-count').textContent = packs.length;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function packCard(pack, index) {
  return `<article class="pack-card">
    <div class="pack-cover ${colors[index % colors.length]}"><span class="pack-symbol">${escapeHtml((pack.title || 'Q').trim().charAt(0).toUpperCase())}</span><span class="pack-tag">${starterPackIds.has(pack.id) ? 'STARTER PACK' : 'YOUR PACK'}</span></div>
    <div class="pack-info"><h3>${escapeHtml(pack.title)}</h3><p>Made by you · ${pack.questions.length} questions</p>
      <div class="pack-card-actions"><span>Multiple choice</span><button class="mini-button" data-action="host-pack" data-id="${escapeHtml(pack.id)}">Host game ↗</button></div>
    </div>
  </article>`;
}

function packCards() {
  return packs.map(packCard).join('');
}

function renderHome() {
  return `<div class="eyebrow">MONDAY, NOVEMBER 9</div>
    <h1 class="page-heading">A good day for a quiz.</h1>
    <section class="hero">
      <div class="hero-copy"><span class="hero-kicker"><span></span> YOUR NEXT GAME NIGHT STARTS HERE</span>
        <h1>Make a little<br>competition.</h1>
        <p>Pick a pack, invite your people, and see who really knows their stuff.</p>
        <div class="hero-actions"><button class="button button-dark" data-action="open-host"><span class="host-glyph">▶</span>Host a game</button><button class="button button-quiet" data-action="open-join">Enter a code</button></div>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="tile-stack"><div class="quiz-tile one">A</div><div class="quiz-tile two">?</div><div class="quiz-tile three">✓</div></div></div>
    </section>
    <div class="section-row"><h2 class="section-heading">Pick up and play</h2><button class="text-button" data-page="packs">All my packs ↗</button></div>
    <div class="pack-grid">${packCards()}</div>
    <div class="quick-strip"><button class="quick-action" data-page="create"><span class="quick-icon">＋</span><span><strong>Build your own pack</strong><small>Write questions, choose the right answers</small></span></button><button class="quick-action" data-action="open-join"><span class="quick-icon">↗</span><span><strong>Got a game code?</strong><small>Jump into a friend's room</small></span></button></div>
    <div class="section-row"><h2 class="section-heading">Play the arcade</h2><button class="text-button" data-page="games">All games ↗</button></div>
    <div class="arcade-preview">${gameTypes.filter((game) => game.id !== 'quiz').slice(0, 3).map((game) => `<button class="arcade-preview-card" data-page="games"><span class="arcade-preview-icon">${game.symbol}</span><strong>${game.title}</strong><small>${game.detail}</small></button>`).join('')}</div>`;
}

function renderGames() {
  return `<div class="eyebrow">THE ARCADE</div><h1 class="page-heading">Pick your game.</h1><p class="games-intro">Practice solo or host a room and race your friends. Every game uses questions from your selected pack.</p>
    <label class="arcade-pack-select"><span>Question pack</span><select id="practice-pack">${packs.map((pack) => `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.title)} · ${pack.questions.length} questions</option>`).join('')}</select></label>
    <div class="game-catalog">${gameTypes.filter((game) => game.id !== 'quiz').map((game, index) => `<article class="game-card game-card-${index}"><div class="game-card-art"><span class="game-art-symbol">${game.symbol}</span><span class="game-art-count">QUIZ + ARCADE</span></div><div class="game-card-body"><h2>${game.title}</h2><p>${game.detail}</p><small>${game.controls}</small><div class="game-card-best">PERSONAL BEST <strong>${Number(localStorage.getItem(`quizroom-best-${game.id}`) || 0).toLocaleString()}${game.id === 'tower-defense' ? ' earned' : ''}</strong></div><div class="game-card-actions"><button class="button button-quiet" data-action="practice-game" data-game="${game.id}">Practice solo</button><button class="button button-dark" data-action="host-game" data-game="${game.id}">Host room</button></div></div></article>`).join('')}</div>`;
}

function renderPractice() {
  const game = gameTypes.find((candidate) => candidate.id === practiceSession?.gameType);
  if (!game) return renderGames();
  return `<div class="practice-heading"><div><div class="eyebrow">SOLO PRACTICE · ${escapeHtml(practiceSession.packTitle)}</div><h1 class="page-heading">${game.symbol} ${game.title}</h1></div><button class="button button-quiet" data-action="back-games">← All games</button></div><div id="arcade-root" class="arcade-root" data-game="${game.id}" data-practice="true"></div>`;
}

function renderPacks() {
  return `<div class="page-toolbar"><div><div class="eyebrow">YOUR LIBRARY</div><h1 class="page-heading">My packs</h1><p>Question sets you've made for your next game.</p></div><button class="button button-dark" data-page="create">＋ New pack</button></div>
    ${packs.length ? `<div class="pack-grid">${packCards()}</div>` : `<div class="empty-state"><strong>Your library is waiting.</strong>Create a question pack and bring your friends in.</div>`}`;
}

function questionEditor(question, index) {
  const choices = question.choices.map((choice, choiceIndex) => `<label class="choice-line"><input type="radio" name="correct-${index}" value="${choiceIndex}" ${question.correctIndex === choiceIndex ? 'checked' : ''} aria-label="Mark ${letters[choiceIndex]} as correct"><span class="choice-letter">${letters[choiceIndex]}</span><input class="choice-input" data-choice="${choiceIndex}" value="${escapeHtml(choice)}" placeholder="Answer ${letters[choiceIndex]}" aria-label="Answer ${letters[choiceIndex]}"></label>`).join('');
  return `<section class="question-editor" data-question="${index}">
    <div class="question-editor-head"><strong>QUESTION ${String(index + 1).padStart(2, '0')}</strong>${draft.questions.length > 1 ? `<button type="button" class="remove-question" data-action="remove-question" data-index="${index}" aria-label="Remove question">×</button>` : ''}</div>
    <label class="field"><span>Question</span><textarea data-field="prompt" maxlength="300" placeholder="Type your question">${escapeHtml(question.prompt)}</textarea></label>
    <div class="choices-label">Answer choices <span>Select the circle beside the correct answer</span></div>
    <div class="choices-grid">${choices}</div>
  </section>`;
}

function renderCreate() {
  if (!draft) draft = { id: null, title: '', questions: [{ prompt: '', choices: ['', '', '', ''], correctIndex: 0 }] };
  return `<div class="eyebrow">PACK BUILDER</div><h1 class="page-heading">Create a pack</h1>
    <form id="pack-form" class="editor">
      <div class="editor-top"><div class="cover-picker" aria-hidden="true">✳</div><label class="field" style="flex:1"><span>Pack name</span><input name="title" maxlength="60" value="${escapeHtml(draft.title)}" placeholder="e.g. Friday night trivia" required></label></div>
      <div class="editor-divider"><h2>Questions</h2><span class="section-meta">${draft.questions.length} ${draft.questions.length === 1 ? 'question' : 'questions'}</span></div>
      ${draft.questions.map(questionEditor).join('')}
      <button type="button" class="add-question" data-action="add-question">＋ Add a question</button>
      <div class="editor-footer"><button type="button" class="button button-quiet" data-page="packs">Cancel</button><button type="submit" class="button button-dark">Save pack</button></div>
    </form>`;
}

function roomPlayers(players) {
  return players.length ? players.map((player, index) => `<div class="player-chip"><span class="player-chip-avatar" style="background:${['#e1efd5','#fae2d9','#dcecf6','#f8edc8'][index % 4]}">${escapeHtml(player.name.charAt(0).toUpperCase())}</span>${escapeHtml(player.name)}</div>`).join('') : '<span class="section-meta">Waiting for the first player...</span>';
}

function scoreboard(players) {
  return `<table class="scoreboard"><thead><tr><th>Place</th><th>Player</th><th>Score</th></tr></thead><tbody>${[...players].sort((a, b) => b.score - a.score).map((player, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(player.name)}</td><td>${player.score.toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
}

function renderRoom() {
  if (!currentRoom || !roomSession) return '';
  const room = currentRoom;
  const isHost = roomSession.role === 'host';
  const mode = gameModes.find((gameMode) => gameMode.id === room.mode) || gameModes[0];
  const top = `<div class="room-topline"><div><div class="room-code-label">${isHost ? 'YOUR JOIN CODE' : 'GAME CODE'}</div><span class="room-code">${room.code}</span></div><button class="button button-quiet" data-action="copy-code">▣ Copy code</button></div>`;
  if (room.phase === 'lobby') {
    return `<div class="room-shell">${top}<div class="room-mode-summary"><span class="mode-symbol">${mode.symbol}</span><span><strong>${escapeHtml(room.packTitle)}</strong><small>${mode.title} mode</small></span></div><h1 class="page-heading">${isHost ? 'Your room is ready.' : 'You’re in. Nice.'}</h1>
      <section class="room-panel"><div class="room-panel-head"><strong>Players in the room</strong><span class="player-count">${room.players.length} ${room.players.length === 1 ? 'player' : 'players'}</span></div><div class="player-list">${roomPlayers(room.players)}</div>${!isHost ? '<div class="waiting-note">The host will start the game in a moment.</div>' : ''}</section>
      <div class="room-actions"><span>${isHost ? 'Share the code so friends can join from another device.' : `Playing as ${escapeHtml(roomSession.name)} · waiting for the host`}</span>${isHost ? '<button class="button button-dark" data-action="start-game">Start game&nbsp; →</button>' : '<button class="button button-quiet" data-action="leave-room">Leave room</button>'}</div></div>`;
  }
  if (room.phase === 'finished') {
    return `<div class="room-shell">${top}<div class="room-panel room-question"><div class="finish-mark">✳</div><div class="eyebrow">THAT'S A WRAP</div><h2>Game over.</h2><p class="section-meta">${escapeHtml(room.packTitle)}</p></div><div class="room-panel" style="margin-top:12px">${room.gameType === 'quiz' ? scoreboard(room.players) : arcadeScoreboard(room.players, room.gameType)}</div><div class="room-actions"><span>${isHost ? 'Good game, everyone.' : 'Thanks for playing.'}</span><button class="button button-dark" data-action="leave-room">Back to overview</button></div></div>`;
  }
  if (room.gameType !== 'quiz') {
    const game = gameTypes.find((candidate) => candidate.id === room.gameType) || gameTypes[1];
    return `<div class="room-shell arcade-room-shell">${top}<div class="arcade-room-heading"><div><div class="eyebrow">${escapeHtml(room.packTitle)} · LIVE MATCH</div><h1 class="page-heading">${game.symbol} ${game.title}</h1></div>${isHost ? '<button class="button button-quiet" data-action="finish-game">End match</button>' : ''}</div><div class="arcade-live-layout"><div id="arcade-root" class="arcade-root" data-game="${game.id}"></div><aside class="arcade-score-panel"><div class="room-panel-head"><strong>Live scores</strong><span class="player-count">${room.players.filter((player) => player.done).length}/${room.players.length} finished</span></div><div id="arcade-scoreboard">${arcadeScoreboard(room.players, game.id)}</div></aside></div><div class="arcade-room-note">${escapeHtml(game.controls)} · Questions award points inside the game.</div></div>`;
  }
  const question = room.question;
  if (!question) return `<div class="room-shell">${top}<p class="section-meta">Loading question…</p></div>`;
  if (isHost) {
    return `<div class="room-shell">${top}<div class="eyebrow" style="margin-top:28px">${mode.title.toUpperCase()} MODE · QUESTION ${room.questionIndex + 1} OF ${room.questionCount}</div><section class="room-panel room-question"><h2>${escapeHtml(question.prompt)}</h2><div class="answer-grid">${question.choices.map((choice, index) => `<div class="answer-button ${index === question.correctIndex ? 'is-correct' : ''}"><span class="answer-marker">${letters[index]}</span>${escapeHtml(choice)}</div>`).join('')}</div></section><div class="room-actions"><span>${room.answeredCount} of ${room.players.length} ${room.players.length === 1 ? 'player has' : 'players have'} answered</span><button class="button button-dark" data-action="next-question">${room.questionIndex + 1 === room.questionCount ? 'Show results' : 'Next question'}&nbsp; →</button></div><div class="room-panel" style="margin-top:18px">${scoreboard(room.players)}</div></div>`;
  }
  const result = room.result;
  const status = room.playerStatus;
  const eliminated = status?.eliminated;
  const feedback = result ? (result.correct ? `Correct! +${result.points.toLocaleString()} points${room.mode === 'streak' ? ` · ${result.multiplier}× streak bonus` : ''}` : room.mode === 'survival' ? `Missed it. ${result.lives} ${result.lives === 1 ? 'life' : 'lives'} left.` : 'Not quite. The highlighted answer is correct.') : '';
  return `<div class="room-shell">${top}<div class="eyebrow" style="margin-top:28px">${mode.title.toUpperCase()} MODE · QUESTION ${room.questionIndex + 1} OF ${room.questionCount}</div>${room.mode === 'survival' ? `<div class="lives-meter" aria-label="${status.lives} lives remaining">${[0, 1, 2].map((life) => `<span class="life-heart ${life < status.lives ? 'is-alive' : ''}">♥</span>`).join('')}<span>${status.lives} lives</span></div>` : ''}<section class="room-panel room-question"><h2>${escapeHtml(question.prompt)}</h2><div class="answer-grid">${question.choices.map((choice, index) => `<button class="answer-button ${result && index === result.correctIndex ? 'is-correct' : ''} ${result && index !== result.correctIndex && result.choice === index ? 'is-wrong' : ''}" data-action="answer" data-choice="${index}" ${result || eliminated ? 'disabled' : ''}><span class="answer-marker">${letters[index]}</span>${escapeHtml(choice)}</button>`).join('')}</div>${eliminated ? '<div class="answer-feedback wrong">You’re out of lives. Stay and watch the final rounds.</div>' : result ? `<div class="answer-feedback ${result.correct ? '' : 'wrong'}">${feedback}</div>` : ''}</section><div class="room-actions"><span>${escapeHtml(roomSession.name)} · ${roomSession.score.toLocaleString()} points${room.mode === 'streak' && status.streak ? ` · ${status.streak} correct in a row` : ''}</span><span>${eliminated ? 'Spectating' : result ? 'Waiting for the host to continue…' : 'Choose your answer'}</span></div></div>`;
}

function arcadeScoreboard(players, gameType) {
  const label = gameType === 'tower-defense' ? 'Earned' : 'Score';
  return `<table class="scoreboard"><thead><tr><th>Place</th><th>Player</th><th>${label}</th></tr></thead><tbody>${[...players].sort((a, b) => b.score - a.score).map((player, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(player.name)}${player.done ? ' <span class="done-mark">✓</span>' : ''}</td><td>${gameType === 'tower-defense' ? '$' : ''}${player.score.toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
}

function updateHeader() {
  const labels = { home: 'Overview', games: 'Games', packs: 'My packs', create: 'Create a pack', room: 'Live game', practice: 'Solo practice' };
  document.querySelector('#page-title').textContent = labels[currentPage] || 'Overview';
  document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('is-active', link.dataset.page === currentPage));
}

function render() {
  arcadeInstance?.destroy();
  arcadeInstance = null;
  updateHeader();
  document.querySelector('#pack-count').textContent = packs.length;
  if (currentPage === 'home') app.innerHTML = renderHome();
  if (currentPage === 'packs') app.innerHTML = renderPacks();
  if (currentPage === 'create') app.innerHTML = renderCreate();
  if (currentPage === 'room') app.innerHTML = renderRoom();
  if (currentPage === 'games') app.innerHTML = renderGames();
  if (currentPage === 'practice') app.innerHTML = renderPractice();
  mountArcade();
}

function navigate(page) {
  if (page === 'create' && currentPage !== 'create') draft = null;
  currentPage = page;
  render();
}

function showModal(content) {
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">${content}</section></div>`;
  modalRoot.querySelector('.modal-backdrop').addEventListener('click', (event) => {
    if (event.target.classList.contains('modal-backdrop') || event.target.closest('[data-action="close-modal"]')) closeModal();
  });
  modalRoot.querySelector('input')?.focus();
}

function closeModal() { modalRoot.innerHTML = ''; }

function hostModal(selectedId, selectedGameId = 'quiz') {
  const selected = packs.find((pack) => pack.id === selectedId) || packs[0];
  if (!selected) return;
  showModal(`<div class="modal-head"><div><h2>Set up your game</h2><p>Pick a question pack and how to play.</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>
    <form id="host-form"><label class="field"><span>Question pack</span><select name="packId">${packs.map((pack) => `<option value="${escapeHtml(pack.id)}" ${pack.id === selected.id ? 'selected' : ''}>${escapeHtml(pack.title)} · ${pack.questions.length} questions</option>`).join('')}</select></label>
    <div class="field"><span>Game</span><div class="game-choice-grid">${gameTypes.map((game) => `<button type="button" class="game-choice ${game.id === selectedGameId ? 'is-selected' : ''}" data-game-choice="${game.id}" aria-pressed="${game.id === selectedGameId}"><span class="game-choice-symbol">${game.symbol}</span><span><strong>${game.title}</strong><small>${game.detail}</small></span></button>`).join('')}</div></div>
    <div class="field mode-field" ${selectedGameId === 'quiz' ? '' : 'hidden'}><span>Quiz scoring</span><div class="mode-picker">${gameModes.map((mode, index) => `<button type="button" class="mode-choice ${index === 0 ? 'is-selected' : ''}" data-mode-choice="${mode.id}" aria-pressed="${index === 0}"><span class="mode-symbol">${mode.symbol}</span><span><strong>${mode.title}</strong><small>${mode.detail}</small></span></button>`).join('')}</div></div>
    <label class="field"><span>Your name</span><input name="hostName" maxlength="24" placeholder="Host" value="Quizmaker" required></label><p class="modal-error" aria-live="polite"></p><button class="button button-dark" type="submit">Create game room&nbsp; →</button></form>`);
}

function joinModal() {
  showModal(`<div class="modal-head"><div><h2>Join a game</h2><p>Enter the six-digit code from your host.</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>
    <form id="join-form"><label class="field"><span>Game code</span><input class="code-input" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required></label><label class="field"><span>Your name</span><input name="name" maxlength="24" placeholder="What should we call you?" required></label><p class="modal-error" aria-live="polite"></p><button class="button button-dark" type="submit">Join room&nbsp; →</button></form>`);
}

async function api(url, options = {}) {
  if (window.QuizroomPeer?.configured) {
    return window.QuizroomPeer.request(url, options);
  }
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(window.QuizroomPeer?.error || 'The room service is unavailable. Check your internet connection and refresh.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The game server returned an invalid response. Please try again.');
  }
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showError(form, error) {
  const target = form.querySelector('.modal-error');
  if (target) target.textContent = error.message;
}

function enterRoom(session) {
  clearInterval(roomPoll);
  roomSession = session;
  currentRoom = null;
  currentPage = 'room';
  render();
  const poll = async () => {
    try {
      const query = session.role === 'host' ? `host=${encodeURIComponent(session.hostToken)}` : `playerId=${encodeURIComponent(session.playerId)}`;
      const next = await api(`/api/rooms/${session.code}?${query}`);
      if (session.role === 'player') {
        const player = next.players.find((candidate) => candidate.id === session.playerId);
        if (player) session.score = player.score;
      }
      const keepArcadeMounted = currentPage === 'room' && next.phase === 'playing' && next.gameType !== 'quiz' && document.querySelector('#arcade-root');
      currentRoom = next;
      if (keepArcadeMounted) {
        const scoreboardRoot = document.querySelector('#arcade-scoreboard');
        if (scoreboardRoot) scoreboardRoot.innerHTML = arcadeScoreboard(next.players, next.gameType);
        const finishedCount = document.querySelector('.arcade-score-panel .player-count');
        if (finishedCount) finishedCount.textContent = `${next.players.filter((player) => player.done).length}/${next.players.length} finished`;
      } else if (currentPage === 'room') render();
      if (next.phase === 'finished') clearInterval(roomPoll);
    } catch (error) {
      clearInterval(roomPoll);
      toast(error.message);
      leaveRoom();
    }
  };
  poll();
  roomPoll = setInterval(poll, 1200);
}

let practiceSession = null;
let arcadeInstance = null;

function mountArcade() {
  const root = document.querySelector('#arcade-root');
  if (!root || !window.Arcade) return;
  const gameType = root.dataset.game;
  const isPractice = root.dataset.practice === 'true';
  const session = isPractice ? practiceSession : roomSession;
  const questions = isPractice ? practiceSession.questions : currentRoom?.gameQuestions;
  if (!session || !questions?.length) return;
  arcadeInstance = window.Arcade.mount(root, {
    gameType,
    questions,
    practice: isPractice,
    onScore: async (score, done) => {
      if (isPractice) {
        const key = `quizroom-best-${gameType}`;
        const best = Number(localStorage.getItem(key) || 0);
        if (score > best) localStorage.setItem(key, String(score));
        return;
      }
      try {
        await api(`/api/rooms/${session.code}/score`, { method: 'POST', body: JSON.stringify({ playerId: session.playerId, score, done }) });
      } catch (error) { toast(error.message); }
    },
  });
}

function startPractice(gameType) {
  const pack = packs.find((candidate) => candidate.id === document.querySelector('#practice-pack')?.value) || packs[0];
  practiceSession = { gameType, packTitle: pack.title, questions: pack.questions };
  currentPage = 'practice';
  render();
}

window.addEventListener('arcade:return', () => {
  practiceSession = null;
  navigate('games');
});

function leaveRoom() {
  clearInterval(roomPoll);
  roomPoll = null;
  window.QuizroomPeer?.leave(roomSession?.code);
  roomSession = null;
  currentRoom = null;
  navigate('home');
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 2200);
}

function syncDraftFromForm() {
  if (currentPage !== 'create' || !draft) return;
  const title = document.querySelector('#pack-form [name="title"]');
  if (title) draft.title = title.value;
  document.querySelectorAll('.question-editor').forEach((element, index) => {
    const question = draft.questions[index];
    if (!question) return;
    question.prompt = element.querySelector('[data-field="prompt"]').value;
    question.choices = [...element.querySelectorAll('.choice-input')].map((input) => input.value);
    question.correctIndex = Number(element.querySelector('input[type="radio"]:checked')?.value || 0);
  });
}

document.addEventListener('click', async (event) => {
  const gameChoice = event.target.closest('[data-game-choice]');
  if (gameChoice) {
    modalRoot.querySelectorAll('[data-game-choice]').forEach((choice) => {
      const selected = choice === gameChoice;
      choice.classList.toggle('is-selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
    const modeField = modalRoot.querySelector('.mode-field');
    if (modeField) modeField.hidden = gameChoice.dataset.gameChoice !== 'quiz';
    return;
  }
  const modeChoice = event.target.closest('[data-mode-choice]');
  if (modeChoice) {
    modalRoot.querySelectorAll('[data-mode-choice]').forEach((choice) => {
      const selected = choice === modeChoice;
      choice.classList.toggle('is-selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
    return;
  }
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { navigate(pageButton.dataset.page); return; }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const { action } = actionButton.dataset;
  if (action === 'open-host') { hostModal(); return; }
  if (action === 'host-pack') { hostModal(actionButton.dataset.id); return; }
  if (action === 'host-game') { hostModal(undefined, actionButton.dataset.game); return; }
  if (action === 'practice-game') { startPractice(actionButton.dataset.game); return; }
  if (action === 'back-games') { practiceSession = null; navigate('games'); return; }
  if (action === 'open-join') { joinModal(); return; }
  if (action === 'add-question') {
    syncDraftFromForm();
    if (draft.questions.length >= 30) return toast('A pack can have up to 30 questions.');
    draft.questions.push({ prompt: '', choices: ['', '', '', ''], correctIndex: 0 });
    render();
    document.querySelector('.question-editor:last-of-type textarea')?.focus();
    return;
  }
  if (action === 'remove-question') {
    syncDraftFromForm();
    draft.questions.splice(Number(actionButton.dataset.index), 1);
    render();
    return;
  }
  if (action === 'copy-code') {
    try { await navigator.clipboard.writeText(roomSession.code); toast('Game code copied.'); }
    catch { toast(`Game code: ${roomSession.code}`); }
    return;
  }
  if (action === 'leave-room') { leaveRoom(); return; }
  if (action === 'start-game' && roomSession?.role === 'host') {
    try { await api(`/api/rooms/${roomSession.code}/start`, { method: 'POST', headers: { 'x-host-token': roomSession.hostToken } }); }
    catch (error) { toast(error.message); }
    return;
  }
  if (action === 'next-question' && roomSession?.role === 'host') {
    try { await api(`/api/rooms/${roomSession.code}/next`, { method: 'POST', headers: { 'x-host-token': roomSession.hostToken } }); }
    catch (error) { toast(error.message); }
    return;
  }
  if (action === 'finish-game' && roomSession?.role === 'host') {
    try { await api(`/api/rooms/${roomSession.code}/finish`, { method: 'POST', headers: { 'x-host-token': roomSession.hostToken } }); }
    catch (error) { toast(error.message); }
    return;
  }
  if (action === 'answer' && roomSession?.role === 'player') {
    actionButton.disabled = true;
    try {
      await api(`/api/rooms/${roomSession.code}/answer`, { method: 'POST', body: JSON.stringify({ playerId: roomSession.playerId, choice: Number(actionButton.dataset.choice) }) });
    } catch (error) { toast(error.message); }
  }
});

document.addEventListener('input', (event) => {
  if (event.target.name === 'code') event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
  if (event.target.matches('[data-field="prompt"]')) {
    const index = Number(event.target.closest('.question-editor').dataset.question);
    if (draft?.questions[index]) draft.questions[index].prompt = event.target.value;
  }
  if (event.target.matches('.choice-input')) {
    const editor = event.target.closest('.question-editor');
    const index = Number(editor.dataset.question);
    const choiceIndex = Number(event.target.dataset.choice);
    if (draft?.questions[index]) draft.questions[index].choices[choiceIndex] = event.target.value;
  }
  if (event.target.name === 'title' && draft) draft.title = event.target.value;
});

document.addEventListener('submit', async (event) => {
  if (event.target.id === 'host-form') {
    event.preventDefault();
    const form = event.target;
    const pack = packs.find((candidate) => candidate.id === form.elements.packId.value);
    try {
      const gameType = form.querySelector('[data-game-choice].is-selected')?.dataset.gameChoice || 'quiz';
      const mode = form.querySelector('[data-mode-choice].is-selected')?.dataset.modeChoice || 'classic';
      const room = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ pack, gameType, mode, hostName: form.elements.hostName.value }) });
      closeModal();
      enterRoom({ role: 'host', code: room.code, hostToken: room.hostToken, playerId: room.hostPlayerId, name: form.elements.hostName.value });
    } catch (error) { showError(form, error); }
  }
  if (event.target.id === 'join-form') {
    event.preventDefault();
    const form = event.target;
    const code = form.elements.code.value.trim();
    try {
      const joined = await api(`/api/rooms/${code}/join`, { method: 'POST', body: JSON.stringify({ name: form.elements.name.value }) });
      const name = form.elements.name.value.trim();
      closeModal();
      enterRoom({ role: 'player', code, playerId: joined.playerId, name, score: 0 });
    } catch (error) { showError(form, error); }
  }
  if (event.target.id === 'pack-form') {
    event.preventDefault();
    syncDraftFromForm();
    if (!draft.title.trim()) return toast('Give your pack a name first.');
    const incomplete = draft.questions.findIndex((question) => !question.prompt.trim() || question.choices.some((choice) => !choice.trim()));
    if (incomplete >= 0) {
      toast(`Finish the question and all four answers in question ${incomplete + 1}.`);
      document.querySelectorAll('.question-editor textarea')[incomplete]?.focus();
      return;
    }
    const pack = { id: draft.id || crypto.randomUUID(), title: draft.title.trim(), questions: draft.questions };
    const existingIndex = packs.findIndex((candidate) => candidate.id === pack.id);
    if (existingIndex >= 0) packs[existingIndex] = pack;
    else packs.unshift(pack);
    savePacks();
    draft = null;
    toast('Pack saved to your library.');
    navigate('packs');
  }
});

savePacks();
render();