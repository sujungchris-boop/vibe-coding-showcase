const students = [
  {
    id: 1,
    name: "김민준",
    title: "인터랙티브 파티클",
    description: "마우스를 따라 움직이는 파티클 효과",
    codepen: "https://codepen.io/pen/example1",
    prompt: "마우스를 따라 움직이는 화려한 파티클 효과를 만들어줘",
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Particle Effect</title>
</head>
<body>
  <canvas id="canvas"></canvas>
</body>
</html>`,
    css: `body {
  margin: 0;
  background: #0a0a0a;
  overflow: hidden;
}
canvas {
  display: block;
}`,
    js: `const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particles = [];
// ... particle logic`
  },
  {
    id: 2,
    name: "이서연",
    title: "CSS 애니메이션 카드",
    description: "호버 시 뒤집히는 3D 카드",
    codepen: "https://codepen.io/pen/example2",
    prompt: "마우스를 올리면 앞뒤로 뒤집히는 3D 카드를 만들어줘",
    html: `<div class="card-container">
  <div class="card">
    <div class="front">앞면</div>
    <div class="back">뒷면</div>
  </div>
</div>`,
    css: `.card-container {
  perspective: 1000px;
  width: 200px;
  height: 300px;
}
.card {
  transform-style: preserve-3d;
  transition: transform 0.6s;
}
.card:hover {
  transform: rotateY(180deg);
}`,
    js: `// No JS needed for this one!
console.log('Pure CSS magic!');`
  },
  {
    id: 3,
    name: "박지호",
    title: "미니 계산기",
    description: "깔끔한 UI의 기능성 계산기",
    codepen: "https://codepen.io/pen/example3",
    prompt: "사칙연산이 되는 미니멀한 디자인의 계산기를 만들어줘",
    html: `<div class="calculator">
  <div class="display">0</div>
  <div class="buttons">
    <button>7</button>
    <button>8</button>
    <button>9</button>
    <button class="op">÷</button>
  </div>
</div>`,
    css: `.calculator {
  background: #1e1e1e;
  border-radius: 16px;
  padding: 20px;
  width: 240px;
}
.display {
  font-size: 2rem;
  color: white;
  text-align: right;
}`,
    js: `const display = document.querySelector('.display');
let current = '';

document.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    // calculation logic
  });
});`
  },
  {
    id: 4,
    name: "최유진",
    title: "그라디언트 생성기",
    description: "드래그로 그라디언트 색상을 조합",
    codepen: "https://codepen.io/pen/example4",
    prompt: "색상을 선택하면 실시간으로 CSS 그라디언트를 생성해주는 도구를 만들어줘",
    html: `<div class="app">
  <div class="preview"></div>
  <div class="controls">
    <input type="color" id="color1" value="#ff6b6b">
    <input type="color" id="color2" value="#4ecdc4">
  </div>
  <div class="output"></div>
</div>`,
    css: `.app { text-align: center; padding: 2rem; }
.preview {
  width: 100%;
  height: 200px;
  border-radius: 12px;
  margin-bottom: 1rem;
}`,
    js: `const color1 = document.getElementById('color1');
const color2 = document.getElementById('color2');
const preview = document.querySelector('.preview');

function update() {
  preview.style.background =
    \`linear-gradient(135deg, \${color1.value}, \${color2.value})\`;
}
color1.addEventListener('input', update);
color2.addEventListener('input', update);
update();`
  },
  {
    id: 5,
    name: "정하은",
    title: "타이핑 효과 포트폴리오",
    description: "글자가 타이핑되는 자기소개 페이지",
    codepen: "https://codepen.io/pen/example5",
    prompt: "글자가 하나씩 타이핑되는 애니메이션으로 자기소개를 보여주는 페이지를 만들어줘",
    html: `<div class="hero">
  <h1>안녕하세요, 저는 <span class="typed"></span></h1>
  <p>디자인과 코드를 좋아합니다.</p>
</div>`,
    css: `.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: sans-serif;
}
.typed { color: #6c63ff; }`,
    js: `const words = ['개발자', '디자이너', '창작자'];
let i = 0, j = 0, current = '';

function type() {
  if (j < words[i].length) {
    current += words[i][j++];
  } else {
    setTimeout(erase, 1500);
    return;
  }
  document.querySelector('.typed').textContent = current;
  setTimeout(type, 150);
}`
  },
  {
    id: 6,
    name: "강도현",
    title: "다크모드 토글",
    description: "부드러운 전환의 다크/라이트 모드",
    codepen: "https://codepen.io/pen/example6",
    prompt: "클릭하면 다크모드와 라이트모드가 부드럽게 전환되는 페이지를 만들어줘",
    html: `<div class="page">
  <button id="toggle">🌙 다크모드</button>
  <h1>Hello World</h1>
  <p>테마 전환 예제입니다.</p>
</div>`,
    css: `:root { --bg: #fff; --text: #111; }
.dark { --bg: #111; --text: #fff; }
.page {
  background: var(--bg);
  color: var(--text);
  transition: all 0.3s ease;
  min-height: 100vh;
  padding: 2rem;
}`,
    js: `const toggle = document.getElementById('toggle');
const page = document.querySelector('.page');

toggle.addEventListener('click', () => {
  page.classList.toggle('dark');
  toggle.textContent = page.classList.contains('dark')
    ? '☀️ 라이트모드' : '🌙 다크모드';
});`
  },
  {
    id: 7,
    name: "윤서아",
    title: "반응형 카드 레이아웃",
    description: "화면 크기에 따라 변하는 카드 그리드",
    codepen: "https://codepen.io/pen/example7",
    prompt: "화면 크기에 따라 자동으로 배치가 바뀌는 카드 그리드 레이아웃을 만들어줘",
    html: `<div class="grid">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
  <div class="card">Card 4</div>
  <div class="card">Card 5</div>
  <div class="card">Card 6</div>
</div>`,
    css: `.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1rem;
}
.card {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 2rem;
  border-radius: 12px;
}`,
    js: `// Pure CSS Grid — no JS needed
console.log('Responsive without media queries!');`
  },
  {
    id: 8,
    name: "임준혁",
    title: "로딩 애니메이션 모음",
    description: "CSS로만 만든 다양한 로딩 스피너",
    codepen: "https://codepen.io/pen/example8",
    prompt: "CSS 애니메이션으로만 만든 개성있는 로딩 스피너 3가지를 보여줘",
    html: `<div class="showcase">
  <div class="spinner-1"></div>
  <div class="spinner-2"></div>
  <div class="spinner-3"></div>
</div>`,
    css: `.spinner-1 {
  width: 40px; height: 40px;
  border: 4px solid #f3f3f3;
  border-top-color: #6c63ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}`,
    js: `// All animation done in CSS!`
  },
  {
    id: 9,
    name: "송민서",
    title: "퀴즈 앱",
    description: "점수를 매기는 인터랙티브 퀴즈",
    codepen: "https://codepen.io/pen/example9",
    prompt: "버튼을 클릭해서 답을 고르고 점수를 계산하는 퀴즈 앱을 만들어줘",
    html: `<div class="quiz">
  <div class="question"></div>
  <div class="options"></div>
  <div class="score">점수: <span>0</span></div>
</div>`,
    css: `.quiz {
  max-width: 500px;
  margin: 2rem auto;
  font-family: sans-serif;
}
.options button {
  display: block;
  width: 100%;
  margin: 0.5rem 0;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}`,
    js: `const questions = [
  { q: "2 + 2 = ?", options: ["3","4","5"], answer: 1 },
  { q: "HTML의 약자는?", options: ["HyperText","HighText","HyperTool"], answer: 0 },
];
let score = 0, current = 0;
// render and check logic...`
  }
];
