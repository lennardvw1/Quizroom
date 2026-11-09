(() => {
  const WIDTH = 960;
  const HEIGHT = 540;

  class ArcadeGame {
    constructor(root, config) {
      this.root = root;
      this.config = config;
      this.questions = config.questions;
      this.score = 0;
      this.questionIndex = 0;
      this.paused = false;
      this.finished = false;
      this.lastFrame = 0;
      this.animation = 0;
      this.keys = new Set();
      this.onScore = config.onScore;
      this.towerPlaceMode = false;
      this.root.innerHTML = `<div class="arcade-toolbar"><div class="arcade-score"><small>${config.gameType === 'tower-defense' ? 'CASH EARNED' : 'SCORE'}</small><strong id="arcade-score">0</strong></div><div class="arcade-stats" id="arcade-stats"></div></div><div class="arcade-stage"><canvas width="${WIDTH}" height="${HEIGHT}" aria-label="${config.gameType} game"></canvas><div class="arcade-question" hidden></div><div class="arcade-finish" hidden></div></div><div class="arcade-shop" id="arcade-shop" hidden></div><div class="arcade-controls" id="arcade-controls"></div>`;
      this.canvas = this.root.querySelector('canvas');
      this.context = this.canvas.getContext('2d');
      this.stage = this.root.querySelector('.arcade-stage');
      this.scoreElement = this.root.querySelector('#arcade-score');
      this.statsElement = this.root.querySelector('#arcade-stats');
      this.questionLayer = this.root.querySelector('.arcade-question');
      this.finishLayer = this.root.querySelector('.arcade-finish');
      this.shopRoot = this.root.querySelector('#arcade-shop');
      this.drawBackground();
      this.draw = this.draw.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerLeave = this.onPointerLeave.bind(this);
      this.onControlClick = this.onControlClick.bind(this);
      this.onControlPointerDown = this.onControlPointerDown.bind(this);
      this.onControlPointerUp = this.onControlPointerUp.bind(this);
      this.onShopClick = this.onShopClick.bind(this);
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.canvas.addEventListener('pointerdown', this.onPointerDown);
      this.canvas.addEventListener('pointermove', this.onPointerMove);
      this.canvas.addEventListener('pointerleave', this.onPointerLeave);
      this.controlRoot = this.root.querySelector('#arcade-controls');
      this.controlRoot.addEventListener('click', this.onControlClick);
      this.controlRoot.addEventListener('pointerdown', this.onControlPointerDown);
      this.controlRoot.addEventListener('pointerup', this.onControlPointerUp);
      this.controlRoot.addEventListener('pointercancel', this.onControlPointerUp);
      this.controlRoot.addEventListener('lostpointercapture', this.onControlPointerUp);
      this.shopRoot.addEventListener('click', this.onShopClick);
      window.addEventListener('pointerup', this.onControlPointerUp);
      window.addEventListener('pointercancel', this.onControlPointerUp);
      this.makeControls();
      this.updateScore();
      this.animation = requestAnimationFrame(this.draw);
    }

    makeControls() {
      const controls = {
        snake: [['↑', 'up'], ['←', 'left'], ['↓', 'down'], ['→', 'right']],
        platformer: [['←', 'left'], ['→', 'right'], ['JUMP', 'jump']],
        'tower-defense': [],
        'meteor-dash': [['←', 'left'], ['→', 'right']],
      }[this.config.gameType] || [];
      this.root.querySelector('#arcade-controls').innerHTML = controls.map(([label, direction]) => `<button type="button" class="arcade-control" data-control="${direction}" aria-label="${label}">${label}</button>`).join('');
      this.controlRoot.hidden = controls.length === 0;
    }

    setTowerPlaceMode(active) {
      this.towerPlaceMode = active;
      this.stage.classList.toggle('is-placing', active);
    }

    onShopClick(event) {
      const option = event.target.closest('[data-tower-type]');
      if (option && this.selectTower) this.selectTower(option.dataset.towerType);
    }

    onControlClick(event) {
      const control = event.target.closest('[data-control]')?.dataset.control;
      if (!control) return;
      if (['platformer', 'meteor-dash'].includes(this.config.gameType) && ['left', 'right'].includes(control)) return;
      this.control(control);
    }

    onControlPointerDown(event) {
      const control = event.target.closest('[data-control]')?.dataset.control;
      if (['platformer', 'meteor-dash'].includes(this.config.gameType) && ['left', 'right'].includes(control)) {
        this.keys.add(`arrow${control}`);
      }
    }

    onControlPointerUp() {
      this.keys.delete('arrowleft');
      this.keys.delete('arrowright');
    }

    control(direction) {}

    onKeyDown(event) {
      if (event.key === 'Escape' && this.towerPlaceMode) {
        this.setTowerPlaceMode(false);
        this.updateStats('Placement cancelled');
        return;
      }
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S'];
      if (keys.includes(event.key)) event.preventDefault();
      if (event.repeat) return;
      this.keys.add(event.key.toLowerCase());
      const direction = ({ arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', ' ': 'jump', spacebar: 'jump' })[event.key.toLowerCase()];
      if (direction) this.control(direction);
    }

    onKeyUp(event) {
      this.keys.delete(event.key.toLowerCase());
    }

    onPointerDown(event) {}
    onPointerMove(event) {}
    onPointerLeave() {}

    askQuestion(label, { award = 0, onAnswer = () => {} } = {}) {
      const question = this.questions[this.questionIndex % this.questions.length];
      this.questionIndex += 1;
      this.paused = true;
      this.questionLayer.hidden = false;
      this.questionLayer.innerHTML = `<div class="arcade-question-card"><div class="eyebrow">${label} · QUESTION ${this.questionIndex}</div><h2>${this.escape(question.prompt)}</h2><div class="arcade-answer-grid">${question.choices.map((choice, index) => `<button type="button" class="arcade-answer" data-answer="${index}"><span>${String.fromCharCode(65 + index)}</span>${this.escape(choice)}</button>`).join('')}</div><p class="arcade-answer-feedback" aria-live="polite"></p></div>`;
      this.questionLayer.querySelectorAll('[data-answer]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.disabled) return;
          const correct = Number(button.dataset.answer) === question.correctIndex;
          this.questionLayer.querySelectorAll('[data-answer]').forEach((option, index) => {
            option.disabled = true;
            if (index === question.correctIndex) option.classList.add('is-correct');
            else if (option === button) option.classList.add('is-wrong');
          });
          this.questionLayer.querySelector('.arcade-answer-feedback').textContent = correct ? 'That’s right!' : `Not quite. ${question.choices[question.correctIndex]} is correct.`;
          if (correct && award) this.addScore(award);
          setTimeout(() => {
            this.questionLayer.hidden = true;
            this.paused = false;
            onAnswer(correct);
          }, 600);
        });
      });
    }

    addScore(amount) {
      this.score += amount;
      this.updateScore();
      this.onScore(this.score, false);
    }

    updateScore() {
      this.scoreElement.textContent = this.config.gameType === 'tower-defense' ? `$${this.score.toLocaleString()}` : this.score.toLocaleString();
    }

    updateStats(text) { this.statsElement.textContent = text; }

    finish(message) {
      if (this.finished) return;
      this.finished = true;
      this.onScore(this.score, true);
      this.finishLayer.hidden = false;
      this.finishLayer.innerHTML = `<div class="arcade-finish-card"><div class="finish-mark">✳</div><div class="eyebrow">RUN COMPLETE</div><h2>${message}</h2><p>${this.config.gameType === 'tower-defense' ? `Cash earned: $${this.score.toLocaleString()}` : `Final score: ${this.score.toLocaleString()}`}</p>${this.config.practice ? '<button class="button button-dark" data-arcade-return>Back to games</button>' : '<span>Waiting for the other players…</span>'}</div>`;
      this.finishLayer.querySelector('[data-arcade-return]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('arcade:return')));
    }

    escape(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }

    drawBackground() {
      const context = this.context;
      context.fillStyle = '#e9efe5';
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.strokeStyle = 'rgba(63, 91, 62, .08)';
      context.lineWidth = 1;
      for (let x = 0; x <= WIDTH; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, HEIGHT); context.stroke(); }
      for (let y = 0; y <= HEIGHT; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(WIDTH, y); context.stroke(); }
    }

    draw() {
      this.animation = requestAnimationFrame(this.draw);
    }

    destroy() {
      cancelAnimationFrame(this.animation);
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
      this.controlRoot.removeEventListener('click', this.onControlClick);
      this.controlRoot.removeEventListener('pointerdown', this.onControlPointerDown);
      this.controlRoot.removeEventListener('pointerup', this.onControlPointerUp);
      this.controlRoot.removeEventListener('pointercancel', this.onControlPointerUp);
      this.controlRoot.removeEventListener('lostpointercapture', this.onControlPointerUp);
      this.shopRoot.removeEventListener('click', this.onShopClick);
      window.removeEventListener('pointerup', this.onControlPointerUp);
      window.removeEventListener('pointercancel', this.onControlPointerUp);
    }
  }

  class SnakeGame extends ArcadeGame {
    constructor(root, config) {
      super(root, config);
      this.cell = 24;
      this.columns = 40;
      this.rows = 22;
      this.offsetY = 6;
      this.snake = [{ x: 19, y: 11 }, { x: 18, y: 11 }, { x: 17, y: 11 }];
      this.direction = { x: 1, y: 0 };
      this.nextDirection = this.direction;
      this.fruit = this.newFruit();
      this.moveTimer = 0;
      this.fruits = 0;
      this.updateStats('Fruit 0 · best ' + Number(localStorage.getItem('quizroom-best-snake') || 0));
    }

    newFruit() {
      let fruit;
      do { fruit = { x: Math.floor(Math.random() * this.columns), y: Math.floor(Math.random() * this.rows) }; }
      while (this.snake?.some((part) => part.x === fruit.x && part.y === fruit.y));
      return fruit;
    }

    control(direction) {
      const vectors = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      const next = vectors[direction];
      if (next && (next.x !== -this.direction.x || next.y !== -this.direction.y)) this.nextDirection = next;
    }

    draw(timestamp = 0) {
      const delta = Math.min(timestamp - (this.lastFrame || timestamp), 50);
      this.lastFrame = timestamp;
      if (!this.paused && !this.finished) {
        this.moveTimer += delta;
        if (this.moveTimer >= Math.max(70, 135 - this.fruits * 2)) {
          this.moveTimer = 0;
          this.step();
        }
      }
      this.context.fillStyle = '#f2f5ee';
      this.context.fillRect(0, 0, WIDTH, HEIGHT);
      this.context.fillStyle = '#293d34';
      this.context.fillRect(0, this.offsetY, WIDTH, this.rows * this.cell);
      this.context.fillStyle = '#32483b';
      for (let x = 0; x < this.columns; x++) for (let y = 0; y < this.rows; y++) {
        if ((x + y) % 2 === 0) this.context.fillRect(x * this.cell, this.offsetY + y * this.cell, this.cell, this.cell);
      }
      this.context.fillStyle = '#ffce5c';
      this.context.beginPath();
      this.context.arc(this.fruit.x * this.cell + 12, this.offsetY + this.fruit.y * this.cell + 12, 8, 0, Math.PI * 2);
      this.context.fill();
      this.snake.forEach((part, index) => {
        this.context.fillStyle = index === 0 ? '#b7ee65' : '#82bf54';
        this.context.beginPath();
        this.context.roundRect(part.x * this.cell + 2, this.offsetY + part.y * this.cell + 2, this.cell - 4, this.cell - 4, 5);
        this.context.fill();
      });
      this.animation = requestAnimationFrame(this.draw);
    }

    step() {
      this.direction = this.nextDirection;
      const head = { x: this.snake[0].x + this.direction.x, y: this.snake[0].y + this.direction.y };
      const hitWall = head.x < 0 || head.x >= this.columns || head.y < 0 || head.y >= this.rows;
      const eating = head.x === this.fruit.x && head.y === this.fruit.y;
      const body = eating ? this.snake : this.snake.slice(0, -1);
      if (hitWall || body.some((part) => part.x === head.x && part.y === head.y)) return this.finish('The snake ran out of room.');
      this.snake.unshift(head);
      if (eating) {
        this.fruits += 1;
        this.fruit = this.newFruit();
        this.updateStats(`Fruit ${this.fruits} · best ${Number(localStorage.getItem('quizroom-best-snake') || 0)}`);
        this.askQuestion(`FRUIT ${this.fruits}`, { award: 30 });
      } else this.snake.pop();
    }
  }

  class PlatformerGame extends ArcadeGame {
    constructor(root, config) {
      super(root, config);
      this.level = 1;
      this.lives = 3;
      this.player = { x: 58, y: 444, width: 30, height: 38, vx: 0, vy: 0, grounded: false };
      this.makeLevel();
    }

    makeLevel() {
      const ground = { x: 0, y: 500, width: WIDTH, height: 40 };
      this.platforms = [ground, { x: 140, y: 425, width: 190, height: 17 }, { x: 390, y: 350, width: 175, height: 17 }, { x: 630, y: 425, width: 160, height: 17 }, { x: 770, y: 320, width: 135, height: 17 }];
      const shift = (this.level - 1) * 17;
      this.coins = [{ x: 240 + shift, y: 393 }, { x: 460 - shift, y: 318 }, { x: 680, y: 393 }, { x: 840 - shift, y: 288 }];
      this.updateStats(`Level ${this.level}/3 · ${this.lives} lives`);
    }

    control(direction) {
      if (direction === 'jump' && this.player.grounded) {
        this.player.vy = -15;
        this.player.grounded = false;
      }
    }

    draw(timestamp = 0) {
      const delta = Math.min((timestamp - (this.lastFrame || timestamp)) / 16.67, 2);
      this.lastFrame = timestamp;
      if (!this.paused && !this.finished) this.update(delta);
      const context = this.context;
      context.fillStyle = '#cfe9f3';
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.fillStyle = '#e8f4ec';
      context.beginPath(); context.arc(170, 100, 54, 0, Math.PI * 2); context.arc(218, 112, 43, 0, Math.PI * 2); context.fill();
      this.platforms.forEach((platform) => {
        context.fillStyle = platform.y === 500 ? '#64885a' : '#527d69';
        context.fillRect(platform.x, platform.y, platform.width, platform.height);
        context.fillStyle = '#9fc177';
        context.fillRect(platform.x, platform.y, platform.width, 5);
      });
      this.coins.forEach((coin) => {
        context.fillStyle = '#ffce5c'; context.beginPath(); context.arc(coin.x, coin.y, 11, 0, Math.PI * 2); context.fill();
        context.strokeStyle = '#fff4c4'; context.lineWidth = 3; context.beginPath(); context.arc(coin.x, coin.y, 6, 0, Math.PI * 2); context.stroke();
      });
      context.fillStyle = '#fa816a';
      context.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
      context.fillStyle = '#fff'; context.fillRect(this.player.x + 18, this.player.y + 8, 5, 5);
      this.animation = requestAnimationFrame(this.draw);
    }

    update(delta) {
      const horizontal = Number(this.keys.has('arrowright') || this.keys.has('d')) - Number(this.keys.has('arrowleft') || this.keys.has('a'));
      this.player.vx = horizontal * 4.1;
      if ((this.keys.has(' ') || this.keys.has('spacebar') || this.keys.has('w') || this.keys.has('arrowup')) && this.player.grounded) this.control('jump');
      this.player.x = Math.max(0, Math.min(WIDTH - this.player.width, this.player.x + this.player.vx * delta));
      const previousBottom = this.player.y + this.player.height;
      this.player.vy += 0.72 * delta;
      this.player.y += this.player.vy * delta;
      this.player.grounded = false;
      for (const platform of this.platforms) {
        const bottom = this.player.y + this.player.height;
        const overlaps = this.player.x + this.player.width > platform.x && this.player.x < platform.x + platform.width;
        if (overlaps && previousBottom <= platform.y && bottom >= platform.y && this.player.vy >= 0) {
          this.player.y = platform.y - this.player.height;
          this.player.vy = 0;
          this.player.grounded = true;
        }
      }
      if (this.player.y > HEIGHT) {
        this.lives -= 1;
        if (!this.lives) return this.finish('Out of lives.');
        this.player.x = 35; this.player.y = 444; this.player.vy = 0;
        this.updateStats(`Level ${this.level}/3 · ${this.lives} lives`);
      }
      const coinIndex = this.coins.findIndex((coin) => Math.hypot(coin.x - (this.player.x + 15), coin.y - (this.player.y + 18)) < 27);
      if (coinIndex >= 0) {
        this.coins.splice(coinIndex, 1);
        this.askQuestion(`LEVEL ${this.level} · COIN COLLECTED`, { award: 25, onAnswer: () => {
          if (!this.coins.length) {
            if (this.level >= 3) this.finish('You cleared every level!');
            else { this.level += 1; this.player.x = 35; this.player.y = 444; this.player.vy = 0; this.makeLevel(); }
          }
        } });
      }
    }
  }

  class TowerDefenseGame extends ArcadeGame {
    constructor(root, config) {
      super(root, config);
      this.money = 100;
      this.baseHealth = 8;
      this.wave = 1;
      this.towers = [];
      this.enemies = [];
      this.bullets = [];
      this.waveSpawned = 0;
      this.waveCount = 5;
      this.spawnTimer = 0;
      this.path = [{ x: -10, y: 270 }, { x: 170, y: 270 }, { x: 170, y: 135 }, { x: 400, y: 135 }, { x: 400, y: 405 }, { x: 650, y: 405 }, { x: 650, y: 270 }, { x: 980, y: 270 }];
      this.towerTypes = [
        { id: 'scout', name: 'Scout', cost: 50, description: 'Balanced range and quick shots.', range: 118, damage: 1, fireRate: 0.62, color: '#b7ee65' },
        { id: 'sniper', name: 'Sniper', cost: 75, description: 'Long range, heavy single shots.', range: 200, damage: 2, fireRate: 1.15, color: '#9bd7f2' },
        { id: 'cannon', name: 'Cannon', cost: 100, description: 'Short range, splash damage.', range: 105, damage: 3, fireRate: 1.45, splashRadius: 46, color: '#ff9878' },
      ];
      this.selectedTower = this.towerTypes[0];
      this.shopRoot.hidden = false;
      this.shopRoot.innerHTML = `<div class="tower-shop-heading"><strong>Tower shop</strong><span>Select a tower, then click an open spot beside the track.</span></div><div class="tower-shop-options">${this.towerTypes.map((tower, index) => `<button type="button" class="tower-option ${index === 0 ? 'is-selected' : ''}" data-tower-type="${tower.id}" aria-pressed="${index === 0}"><span class="tower-option-top"><strong>${tower.name}</strong><b>$${tower.cost}</b></span><small>${tower.description}</small><span class="tower-option-stats">${tower.damage} dmg · ${tower.range} range</span></button>`).join('')}</div>`;
      this.setTowerPlaceMode(false);
      this.updateStats('Loading wave 1 · Base 8/8');
      this.askWaveQuestion();
    }

    selectTower(id) {
      const tower = this.towerTypes.find((candidate) => candidate.id === id);
      if (!tower) return;
      this.selectedTower = tower;
      this.shopRoot.querySelectorAll('[data-tower-type]').forEach((option) => {
        const selected = option.dataset.towerType === id;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      });
      this.setTowerPlaceMode(true);
      this.updateStats(`Click an open spot to place ${tower.name}`);
    }

    askWaveQuestion() {
      this.askQuestion(`WAVE ${this.wave} · FUND YOUR DEFENSE`, { onAnswer: (correct) => {
        const reward = correct ? 100 : 0;
        this.money += reward;
        this.addScore(reward);
        this.waveCount = 5 + this.wave * 2;
        this.waveSpawned = 0;
        this.spawnTimer = 0;
        this.updateStats(`Wave ${this.wave}/5 · $${this.money} available · Base ${this.baseHealth}/8`);
      } });
    }

    distanceToPath(x, y) {
      let nearest = Infinity;
      for (let index = 0; index < this.path.length - 1; index++) {
        const first = this.path[index]; const second = this.path[index + 1];
        const dx = second.x - first.x; const dy = second.y - first.y;
        const t = Math.max(0, Math.min(1, ((x - first.x) * dx + (y - first.y) * dy) / (dx * dx + dy * dy)));
        nearest = Math.min(nearest, Math.hypot(x - (first.x + t * dx), y - (first.y + t * dy)));
      }
      return nearest;
    }

    canPlaceTower(x, y) {
      return this.money >= this.selectedTower.cost && x >= 20 && x <= WIDTH - 20 && y >= 20 && y <= HEIGHT - 20 &&
        this.distanceToPath(x, y) > 45 && this.towers.every((tower) => Math.hypot(tower.x - x, tower.y - y) > 40);
    }

    onPointerMove(event) {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerPosition = { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
    }

    onPointerLeave() {
      this.pointerPosition = null;
    }

    onPointerDown(event) {
      if (!this.towerPlaceMode || this.paused || this.finished) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * WIDTH;
      const y = (event.clientY - rect.top) / rect.height * HEIGHT;
      if (this.money < this.selectedTower.cost) return this.updateStats(`Need $${this.selectedTower.cost} to place a ${this.selectedTower.name}`);
      this.pointerPosition = { x, y };
      if (!this.canPlaceTower(x, y)) return this.updateStats('Choose a spot clear of the track and other towers');
      this.money -= this.selectedTower.cost;
      this.towers.push({ ...this.selectedTower, x, y, cooldown: 0 });
      this.setTowerPlaceMode(false);
      this.updateStats(`Wave ${this.wave}/5 · $${this.money} available · Base ${this.baseHealth}/8`);
    }

    positionAt(distance) {
      let remaining = distance;
      for (let index = 0; index < this.path.length - 1; index++) {
        const start = this.path[index]; const end = this.path[index + 1];
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        if (remaining <= length) return { x: start.x + (end.x - start.x) * remaining / length, y: start.y + (end.y - start.y) * remaining / length };
        remaining -= length;
      }
      return this.path[this.path.length - 1];
    }

    draw(timestamp = 0) {
      const delta = Math.min((timestamp - (this.lastFrame || timestamp)) / 1000, 0.05);
      this.lastFrame = timestamp;
      if (!this.paused && !this.finished) this.update(delta);
      const context = this.context;
      context.fillStyle = '#e8f1e4'; context.fillRect(0, 0, WIDTH, HEIGHT);
      context.strokeStyle = 'rgba(55, 93, 59, .08)'; context.lineWidth = 1;
      for (let x = 0; x < WIDTH; x += 48) for (let y = 0; y < HEIGHT; y += 48) context.strokeRect(x, y, 48, 48);
      context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#bfad8a'; context.lineWidth = 49;
      context.beginPath(); this.path.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke();
      context.strokeStyle = '#e1d3b4'; context.lineWidth = 36; context.stroke();
      this.towers.forEach((tower) => {
        this.drawTowerBody(context, tower);
      });
      this.bullets.forEach((bullet) => { context.fillStyle = '#ffce5c'; context.beginPath(); context.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2); context.fill(); });
      this.enemies.forEach((enemy) => {
        const position = this.positionAt(enemy.distance);
        context.fillStyle = '#e76d57'; context.beginPath(); context.arc(position.x, position.y, 14, 0, Math.PI * 2); context.fill();
        context.fillStyle = '#fff'; context.fillRect(position.x - 10, position.y - 22, 20, 4);
        context.fillStyle = '#b94f42'; context.fillRect(position.x - 10, position.y - 22, 20 * enemy.health / enemy.maxHealth, 4);
      });
      context.fillStyle = '#527d69'; context.fillRect(918, 235, 32, 70);
      context.fillStyle = '#fff'; context.font = '700 13px sans-serif'; context.fillText('BASE', 913, 224);
      if (this.towerPlaceMode && this.pointerPosition) this.drawPlacementPreview(context);
      this.animation = requestAnimationFrame(this.draw);
    }

    drawTowerBody(context, tower, opacity = 1) {
      context.save();
      context.globalAlpha = opacity;
      context.fillStyle = '#517965'; context.beginPath(); context.arc(tower.x, tower.y, 20, 0, Math.PI * 2); context.fill();
      context.fillStyle = tower.color;
      if (tower.id === 'sniper') context.fillRect(tower.x - 5, tower.y - 19, 10, 29);
      else if (tower.id === 'cannon') context.fillRect(tower.x - 12, tower.y - 12, 24, 24);
      else context.fillRect(tower.x - 7, tower.y - 15, 14, 23);
      context.restore();
    }

    drawPlacementPreview(context) {
      const { x, y } = this.pointerPosition;
      const tint = this.canPlaceTower(x, y) ? '#6dba68' : '#e16e5b';
      context.save();
      context.fillStyle = tint;
      context.globalAlpha = 0.1;
      context.beginPath(); context.arc(x, y, this.selectedTower.range, 0, Math.PI * 2); context.fill();
      context.globalAlpha = 0.72;
      context.strokeStyle = tint; context.lineWidth = 2; context.setLineDash([7, 6]);
      context.beginPath(); context.arc(x, y, this.selectedTower.range, 0, Math.PI * 2); context.stroke();
      context.setLineDash([]);
      context.restore();
      this.drawTowerBody(context, { ...this.selectedTower, x, y }, 0.56);
    }

    update(delta) {
      this.spawnTimer += delta;
      if (this.waveSpawned < this.waveCount && this.spawnTimer > 0.8) {
        this.spawnTimer = 0;
        const health = 2 + Math.floor(this.wave / 2);
        this.enemies.push({ distance: 0, health, maxHealth: health, speed: 47 + this.wave * 4 });
        this.waveSpawned += 1;
      }
      this.towers.forEach((tower) => {
        tower.cooldown -= delta;
        if (tower.cooldown > 0) return;
        const target = this.enemies.filter((enemy) => { const position = this.positionAt(enemy.distance); return Math.hypot(position.x - tower.x, position.y - tower.y) < tower.range; }).sort((first, second) => second.distance - first.distance)[0];
        if (target) {
          const position = this.positionAt(target.distance);
          this.bullets.push({ x: tower.x, y: tower.y, target, speed: tower.id === 'sniper' ? 470 : 340, damage: tower.damage, splashRadius: tower.splashRadius || 0 });
          tower.cooldown = tower.fireRate;
        }
      });
      this.enemies.forEach((enemy) => { enemy.distance += enemy.speed * delta; });
      const last = this.path[this.path.length - 1];
      const endDistance = this.path.reduce((total, point, index) => index ? total + Math.hypot(point.x - this.path[index - 1].x, point.y - this.path[index - 1].y) : total, 0);
      this.enemies = this.enemies.filter((enemy) => {
        if (enemy.distance >= endDistance) {
          this.baseHealth -= 1;
          this.updateStats(`Wave ${this.wave}/5 · $${this.money} available · Base ${this.baseHealth}/8`);
          if (!this.baseHealth) this.finish('The base was overrun.');
          return false;
        }
        return true;
      });
      this.bullets = this.bullets.filter((bullet) => {
        if (!bullet.target || !this.enemies.includes(bullet.target)) return false;
        const position = this.positionAt(bullet.target.distance);
        const dx = position.x - bullet.x; const dy = position.y - bullet.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 12) {
          const impact = this.positionAt(bullet.target.distance);
          const affected = this.enemies.filter((enemy) => enemy === bullet.target || (bullet.splashRadius && Math.hypot(this.positionAt(enemy.distance).x - impact.x, this.positionAt(enemy.distance).y - impact.y) < bullet.splashRadius));
          affected.forEach((enemy) => { enemy.health -= bullet.damage; });
          const defeated = affected.filter((enemy) => enemy.health <= 0);
          if (defeated.length) {
            this.enemies = this.enemies.filter((enemy) => !defeated.includes(enemy));
            const reward = defeated.length * 10;
            this.money += reward;
            this.addScore(reward);
            this.updateStats(`Wave ${this.wave}/5 · $${this.money} available · Base ${this.baseHealth}/8`);
          }
          return false;
        }
        bullet.x += dx / distance * bullet.speed * delta;
        bullet.y += dy / distance * bullet.speed * delta;
        return true;
      });
      if (!this.finished && this.waveSpawned === this.waveCount && this.enemies.length === 0) {
        if (this.wave >= 5) this.finish('All five waves defeated!');
        else { this.wave += 1; this.askWaveQuestion(); }
      }
    }
  }

  class MeteorGame extends ArcadeGame {
    constructor(root, config) {
      super(root, config);
      this.player = { x: WIDTH / 2, y: HEIGHT - 67, radius: 17 };
      this.meteors = [];
      this.stars = [];
      this.starsCollected = 0;
      this.spawnTimer = 0;
      this.starTimer = 0;
      this.elapsed = 0;
      this.duration = 45;
      this.updateStats('Survive 45 seconds · collect stars');
    }

    draw(timestamp = 0) {
      const delta = Math.min((timestamp - (this.lastFrame || timestamp)) / 1000, 0.05);
      this.lastFrame = timestamp;
      if (!this.paused && !this.finished) this.update(delta);
      const context = this.context;
      context.fillStyle = '#202b36'; context.fillRect(0, 0, WIDTH, HEIGHT);
      for (let index = 0; index < 70; index++) {
        const x = (index * 173 + 45) % WIDTH; const y = (index * 97 + 20) % HEIGHT;
        context.fillStyle = index % 4 ? 'rgba(255,255,255,.25)' : '#fff'; context.fillRect(x, y, 2, 2);
      }
      this.meteors.forEach((meteor) => {
        context.fillStyle = '#fa816a'; context.beginPath(); context.arc(meteor.x, meteor.y, meteor.radius, 0, Math.PI * 2); context.fill();
        context.fillStyle = '#ffbd82'; context.beginPath(); context.arc(meteor.x - 4, meteor.y - 5, meteor.radius * .42, 0, Math.PI * 2); context.fill();
      });
      this.stars.forEach((star) => {
        context.fillStyle = '#ffce5c'; context.font = '700 28px sans-serif'; context.fillText('✦', star.x - 11, star.y + 10);
      });
      context.fillStyle = '#b7ee65'; context.beginPath(); context.moveTo(this.player.x, this.player.y - 20); context.lineTo(this.player.x + 18, this.player.y + 16); context.lineTo(this.player.x, this.player.y + 9); context.lineTo(this.player.x - 18, this.player.y + 16); context.closePath(); context.fill();
      context.fillStyle = '#fff'; context.font = '600 16px sans-serif'; context.fillText(`${Math.max(0, Math.ceil(this.duration - this.elapsed))}s`, 24, 34);
      this.animation = requestAnimationFrame(this.draw);
    }

    update(delta) {
      this.elapsed += delta;
      if (this.elapsed >= this.duration) return this.finish('You made it through the meteor shower!');
      const horizontal = Number(this.keys.has('arrowright') || this.keys.has('d')) - Number(this.keys.has('arrowleft') || this.keys.has('a'));
      this.player.x = Math.max(24, Math.min(WIDTH - 24, this.player.x + horizontal * 310 * delta));
      this.spawnTimer += delta; this.starTimer += delta;
      if (this.spawnTimer > Math.max(.36, .88 - this.elapsed / 110)) {
        this.spawnTimer = 0;
        this.meteors.push({ x: Math.random() * (WIDTH - 36) + 18, y: -22, radius: 12 + Math.random() * 10, speed: 150 + Math.random() * 140 + this.elapsed * 1.5 });
      }
      if (this.starTimer > 4) {
        this.starTimer = 0;
        this.stars.push({ x: Math.random() * (WIDTH - 80) + 40, y: -20, speed: 110 });
      }
      this.meteors.forEach((meteor) => { meteor.y += meteor.speed * delta; });
      this.stars.forEach((star) => { star.y += star.speed * delta; });
      if (this.meteors.some((meteor) => Math.hypot(meteor.x - this.player.x, meteor.y - this.player.y) < meteor.radius + this.player.radius - 3)) return this.finish('A meteor caught your ship.');
      const starIndex = this.stars.findIndex((star) => Math.hypot(star.x - this.player.x, star.y - this.player.y) < 30);
      if (starIndex >= 0) {
        this.stars.splice(starIndex, 1);
        this.starsCollected += 1;
        this.askQuestion('STAR RECOVERED', { award: 25 });
      }
      this.meteors = this.meteors.filter((meteor) => meteor.y < HEIGHT + 30);
      this.stars = this.stars.filter((star) => star.y < HEIGHT + 20);
      this.updateStats(`Stars ${this.starsCollected} · ${Math.max(0, Math.ceil(this.duration - this.elapsed))} sec left`);
    }
  }

  function mount(root, config) {
    const constructors = { snake: SnakeGame, platformer: PlatformerGame, 'tower-defense': TowerDefenseGame, 'meteor-dash': MeteorGame };
    const Game = constructors[config.gameType];
    return Game ? new Game(root, config) : null;
  }

  window.Arcade = { mount };
})();