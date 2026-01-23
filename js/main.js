import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  increment, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/* ===== Firebase 設定 ===== */
const firebaseConfig = {
  apiKey: "AIzaSyD8NPDFZcumM96ypgJOLSm5BA0I2wTBaKg",
  authDomain: "book-ree.firebaseapp.com",
  projectId: "book-ree",
  storageBucket: "book-ree.firebasestorage.app",
  messagingSenderId: "721168073032",
  appId: "1:721168073032:web:9d46233bd8b0d11b73f37d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ジャンル定義
const GENRES = [
    { id: 'literature', label: '文芸' },
    { id: 'business',   label: 'ビジネス' },
    { id: 'hobby',      label: '趣味・実用' },
    { id: 'specialized', label: '専門書' },
    { id: 'children',   label: '児童書' },
    { id: 'study',      label: '学習参考書' }
];

// 学習参考書の階層データ (表示用ラベル)
const STUDY_HIERARCHY = {
  general: {
      label: "一般",
      subs: [
          { id: "career_up", label: "キャリアアップ" },
          { id: "relearning", label: "学び直し・基礎科目" },
          { id: "liberal_arts", label: "教養・趣味" }
      ]
  },
  university: {
      label: "大学生",
      subs: [
          { id: "department", label: "学科別" },
          { id: "self_help", label: "自己啓発" },
          { id: "certification", label: "資格" }
      ]
  },
  high_school: { 
      label: "高校生",
      subs: [
          { id: "subject_based", label: "教科別" },
          { id: "level_based", label: "レベル別（基礎〜難関）" },
          { id: "purpose_based", label: "目的別（受験・勉強法）" }
      ]
  },
  junior_high: { 
      label: "中学生",
      subs: [
          { id: "basics", label: "基礎理解" },
          { id: "hs_exam", label: "高校入試対策" },
          { id: "weakness", label: "苦手克服" },
          { id: "comprehensive", label: "総合" },
          { id: "textbook", label: "教科書準拠" }
      ]
  },
  elementary: {
      label: "小学生",
      subs: [
          { id: "subject_elem", label: "科目別" },
          { id: "level_elem", label: "レベル別（発展・教科書）" },
          { id: "purpose_elem", label: "目的別（中受・総復習）" },
          { id: "format_elem", label: "形式別（ドリル・一問一答）" }
      ]
  },
  infant: { 
      label: "幼児",
      subs: [
          { id: "moji", label: "もじ（ひらがな等）" },
          { id: "kazu", label: "かず" },
          { id: "chie", label: "ちえ" },
          { id: "fingertip", label: "指先・運筆" },
          { id: "english_kids", label: "英語・アルファベット" },
          { id: "curiosity", label: "知的好奇心・総合" }
      ]
  }
};

// メモリ保存用
const loadedBooks = {}; 
const chartInstances = {};
const isWebSearching = {};
const currentRankingTypes = {};

const AWARD_KEYWORDS = [
  "本屋大賞", "直木賞", "芥川賞",
  "山本周五郎賞", "吉川英治文学賞", "吉川英治文学新人賞", "柴田錬三郎賞",
  "江戸川乱歩賞", "日本推理作家協会賞", "このミステリーがすごい", "星雲賞",
  "三島由紀夫賞", "野間文芸新人賞",
  "映画化", "ドラマ化", "アニメ化", "実写化", "ベストセラー", "万部突破"
];
const MISSING_DATA_PATCH_LIST = [
    "ツミデミック", "バリ山行", "サンショウウオの四十九日", "成瀬は天下を取りにいく",
    "ともぐい", "八月の御所グラウンド", "東京都同情塔", "汝、星のごとく",
    "ハンチバック", "木挽町のあだ討ち", "極楽征夷大将軍", "カフネ"
];

const normalize = (str) => {
  if (!str) return "";
  return str.normalize('NFKC').replace(/[()（）]/g, "").replace(/\s+/g, "").toLowerCase();
};

window.addEventListener('DOMContentLoaded', () => {
    GENRES.forEach(genre => {
        isWebSearching[genre.id] = false; 
        currentRankingTypes[genre.id] = 'score'; 
        setupGenreSection(genre.id);
    });
    initModal();
});

function isAwardWinner(data) {
    if(!data) return false;
    const title = (data.title || "").trim();
    const description = (data.description || "").trim();
    const text = (title + "\n" + description).toLowerCase();

    const isInPatchList = MISSING_DATA_PATCH_LIST.some(patchTitle => title.includes(patchTitle));
    if (isInPatchList) return true;

    const hasAwardName = AWARD_KEYWORDS.some(k => text.includes(k.toLowerCase()));
    if (!hasAwardName) return false;

    if (/受賞(作家|著者)/.test(text) || /賞(作家|著者)/.test(text)) return false;
    if (/候補|ノミネート/.test(text)) {
        if (!/(１位|1位|大賞|決定)/.test(text)) return false;
    }
    const isConfirmedWinner = /(受賞|大賞|１位|1位)/.test(text);
    return isConfirmedWinner;
}

/**
 * ジャンルごとの初期設定
 */
function setupGenreSection(genreId) {
  const listElement = document.getElementById(`list-${genreId}`);
  if (!listElement) return;

  let unsubscribe = null;

  const fetchAndRender = () => {
      if (unsubscribe) unsubscribe();

      const container = document.getElementById(`list-${genreId}`);
      if(container) container.innerHTML = '<p style="padding:20px; text-align:center;">読み込み中...</p>';

      const sortField = currentRankingTypes[genreId] || 'score';
      
      const constraints = [];
      constraints.push(where("mainGenre", "==", genreId));

      if (genreId === 'study') {
          const targetEl = document.getElementById("filter-study-target");
          const targetVal = targetEl ? targetEl.value : "all";
          
          if (targetVal !== "all") {
              constraints.push(where("target", "array-contains", targetVal));
          }
      } else {
          const filterEl = document.getElementById(`filter-${genreId}`);
          if (filterEl && filterEl.value !== "all") {
              const val = filterEl.value;
              constraints.push(where("subGenres", "array-contains", val));
          }
      }

      constraints.push(orderBy(sortField, "desc"));
      constraints.push(limit(50));

      const q = query(collection(db, "books"), ...constraints);

      unsubscribe = onSnapshot(q, (snapshot) => {
          const books = [];
          snapshot.forEach(doc => {
              books.push({ id: doc.id, ...doc.data() });
          });
          
          loadedBooks[genreId] = books;
          applyLocalFilter(genreId);
          
      }, (error) => {
          console.error("Firebase Error:", error);
          const container = document.getElementById(`list-${genreId}`);
          if(error.code === 'failed-precondition') {
             const msg = "【管理者用メッセージ】<br>この絞り込み条件での検索にはインデックスが必要です。<br>F12キーを押してコンソールを開き、表示されているURLをクリックしてインデックスを作成してください。";
             if(container) container.innerHTML = `<p style="padding:20px; color:red; text-align:center; font-weight:bold;">${msg}</p>`;
          } else {
             if(container) container.innerHTML = '<p style="padding:20px; text-align:center;">エラーが発生しました。</p>';
          }
      });
  };

  fetchAndRender();

  const rankingTypeSelect = document.getElementById(`ranking-type-${genreId}`);
  if (rankingTypeSelect) {
      rankingTypeSelect.addEventListener("change", (e) => {
          currentRankingTypes[genreId] = e.target.value;
          isWebSearching[genreId] = false;
          fetchAndRender(); 
      });
  }

  const limitSelect = document.getElementById(`chart-limit-${genreId}`);
  if (limitSelect) {
      limitSelect.addEventListener("change", () => {
          const categoryFiltered = filterByDropdowns(genreId);
          updateChart(genreId, categoryFiltered);
      });
  }

  const searchInput = document.getElementById(`search-${genreId}`);
  const searchBtn = document.getElementById(`btn-search-${genreId}`);
  if (searchInput) {
      searchInput.addEventListener("input", () => {
          isWebSearching[genreId] = false;
          applyLocalFilter(genreId);
      });
      searchInput.addEventListener("keydown", async (e) => {
          if (e.key === "Enter") {
              const keyword = searchInput.value.trim();
              if (keyword) {
                  e.preventDefault();
                  await searchExternalBooks(genreId, keyword);
              }
          }
      });
      if (searchBtn) {
          searchBtn.addEventListener("click", async () => {
              const keyword = searchInput.value.trim();
              if (keyword) await searchExternalBooks(genreId, keyword);
          });
      }
  }

  if (genreId === 'study') {
      const targetSelect = document.getElementById("filter-study-target");
      const subSelect = document.getElementById("filter-study-sub");
      const subSelectContainer = document.getElementById("study-sub-container");

      if (targetSelect) {
          targetSelect.addEventListener("change", (e) => {
              const selectedTarget = e.target.value;
              
              if (subSelect && STUDY_HIERARCHY && STUDY_HIERARCHY[selectedTarget]) {
                  subSelect.innerHTML = '<option value="all">すべて</option>';
                  STUDY_HIERARCHY[selectedTarget].subs.forEach(sub => {
                      const option = document.createElement("option");
                      option.value = sub.id;
                      option.textContent = sub.label;
                      subSelect.appendChild(option);
                  });
                  if (subSelectContainer) subSelectContainer.style.display = "block";
              } else {
                  if (subSelectContainer) subSelectContainer.style.display = "none";
                  if (subSelect) subSelect.innerHTML = '<option value="all">すべて</option>';
              }
              
              fetchAndRender();
          });
      }
      if (subSelect) subSelect.addEventListener("change", () => applyLocalFilter(genreId));
  } else {
      const filterSelect = document.getElementById(`filter-${genreId}`);
      if (filterSelect) {
          filterSelect.addEventListener("change", () => {
              fetchAndRender();
          });
      }
  }
}

function applyLocalFilter(genreId) {
  const categoryFiltered = filterByDropdowns(genreId);
  updateChart(genreId, categoryFiltered);
  const listFiltered = filterByText(genreId, categoryFiltered);
  renderBookshelf(genreId, listFiltered);
}

function filterByDropdowns(genreId) {
    let filtered = loadedBooks[genreId] || [];
    
    if (genreId === 'study') {
        const subEl = document.getElementById("filter-study-sub");
        const subVal = subEl ? subEl.value : "all";

        if (subVal !== "all") {
            filtered = filtered.filter(b => b.subGenres && b.subGenres.includes(subVal));
        }
    } 
    return filtered;
}

function filterByText(genreId, books) {
    const searchEl = document.getElementById(`search-${genreId}`);
    if (!searchEl) return books;
    const searchVal = searchEl.value.trim().toLowerCase();
    if (searchVal === "") return books;
    return books.filter(b => {
        const title = (b.title || "").toLowerCase();
        let authorStr = "";
        if (Array.isArray(b.authors)) authorStr = b.authors.join(" ");
        else if (b.author) authorStr = b.author;
        authorStr = authorStr.toLowerCase();
        return title.includes(searchVal) || authorStr.includes(searchVal);
    });
}

function renderBookshelf(genreId, books) {
  const container = document.getElementById(`list-${genreId}`);
  container.innerHTML = "";
  
  if (books.length === 0) {
      container.innerHTML = `<p style="padding:20px; color:#666; width:100%; text-align:center;">
          ランキング内に見つかりません。<br>
          <span style="font-size:0.9em; color:#3498db;">Enterキー または 検索ボタンで、Web上の本を検索・投票できます</span>
      </p>`;
      return;
  }

  const currentType = currentRankingTypes[genreId] || 'score';

  books.forEach((book, index) => {
      container.appendChild(createBookCard(book, index + 1, currentType)); 
  });
}

function updateChart(genreId, books) {
    const ctx = document.getElementById(`chart-${genreId}`);
    if (!ctx) return;
    const limitEl = document.getElementById(`chart-limit-${genreId}`);
    const displayCount = limitEl ? parseInt(limitEl.value, 10) : 10; // デフォルト10に変更
    const topBooks = books.slice(0, displayCount);
    
    const currentType = currentRankingTypes[genreId] || 'score';
    
    // スマホ判定（画面幅768px以下ならスマホとみなす）
    const isMobile = window.innerWidth <= 768;
  
    // ラベル作成
    // スマホ(横グラフ)の場合は少し長くても表示しやすいので12文字、PC(縦グラフ)は10文字でカット
    const cutLength = isMobile ? 12 : 10;
    const labels = topBooks.map(b => b.title.length > cutLength ? b.title.substring(0, cutLength) + '…' : b.title);
    const scores = topBooks.map(b => b[currentType] !== undefined ? b[currentType] : 0);
  
    if (chartInstances[genreId]) {
        chartInstances[genreId].destroy();
    }
    
    // コンテナの高さ設定
    // 10件表示だと縦に長くなるので、少し高さを確保
    const wrapper = ctx.parentElement;
    if (wrapper) wrapper.style.height = '350px';
      
    // 各ジャンルのイメージカラー定義（RGB）
    const genreColorMap = {
        'literature': '21, 101, 192',   // 文芸：青
        'business':   '46, 125, 50',    // ビジネス：緑
        'hobby':      '230, 126, 34',   // 趣味・実用：オレンジ
        'specialized': '106, 27, 154',   // 専門書：紫
        'children':   '173, 20, 87',   // 児童書：黄色
        'study':    '0, 131, 143'      // 専門書：濃いグレー
    };

    // ジャンルIDに対応する色を取得（未定義ならデフォルトの青）
    const themeRGB = genreColorMap[genreId] || '52, 152, 219';

    // 色を作成（背景は少し透明、枠線は不透明）
    const barColor = `rgba(${themeRGB}, 0.7)`;
    const borderColor = `rgba(${themeRGB}, 1)`;
  
    // 軸の設定を動的に切り替え
    // 縦グラフ(PC): indexAxis='x' → y軸がスコア
    // 横グラフ(スマホ): indexAxis='y' → x軸がスコア
    const scoreAxis = isMobile ? 'x' : 'y';
    const labelAxis = isMobile ? 'y' : 'x';
  
    chartInstances[genreId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: scores,
                backgroundColor: barColor,
                borderColor: borderColor,
                borderWidth: 1,
                maxBarThickness: 50,

                borderRadius: 8,       // ★棒の角を丸くする（数字が大きいほど丸くなる）                
                borderSkipped: false,  // ★棒の「根元」も丸くして、カプセルみたいに浮かせる
            }]
        },
        options: {
          // ★ここで向きを決定
          indexAxis: isMobile ? 'y' : 'x', 
          responsive: true,
          maintainAspectRatio: false,
          plugins: { 
              legend: { display: false },
              tooltip: {
                  callbacks: {
                      title: function(context) {
                          const index = context[0].dataIndex;
                          return topBooks[index].title; 
                      }
                  }
              }
          },
          scales: {
              // スコア軸（点数）の設定
              [scoreAxis]: { 
                  beginAtZero: true, 
                  grace: '10%', // 天井に10%の余白
                  title: { display: !isMobile, text: '獲得スコア' }, // スマホでは狭いのでタイトル省略
                  ticks: {
                      stepSize: 1,
                      font: { weight: 'bold' }
                  }
              },
              // ラベル軸（本のタイトル）の設定
              [labelAxis]: {
                  grid: { display: false },
                  ticks: {
                      autoSkip: false,
                      // PCの場合は斜めにして詰め込む
                      maxRotation: isMobile ? 0 : 45,
                      minRotation: isMobile ? 0 : 45
                  }
              }
          }
        }
    });
  }
      
function createBookCard(book, rank = null, displayType = 'score') {
  const div = document.createElement("div");
  div.className = "book-card";

  let authorText = "著者不明";
  if (book.authors && Array.isArray(book.authors) && book.authors.length > 0) {
      authorText = book.authors.join(", ");
  } else if (book.author) {
      authorText = book.author;
  }

  let coverHtml = '';
  const imgData = book.imageLinks || {}; 
  let imgUrl = imgData.thumbnail || imgData.smallThumbnail || book.image;
  if (imgUrl) {
      imgUrl = imgUrl.replace('http://', 'https://');
      coverHtml = `<img src="${imgUrl}" class="book-cover" alt="${book.title}">`;
  } else {
      coverHtml = `<div class="book-cover-placeholder">No Image</div>`;
  }

  const searchQuery = `${book.title} ${authorText}`;
  const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchQuery)}`;
  const isVoted = localStorage.getItem(`voted_${book.id}`);

  let rankHtml = '';
  if (rank) {
      const rankClass = rank <= 3 ? `rank-${rank}` : '';
      rankHtml = `<div class="rank-badge ${rankClass}">${rank}</div>`;
  }

  const scoreValue = book[displayType] !== undefined ? book[displayType] : 0;
  const scoreColor = displayType === 'score' ? '#e67e22' : '#27ae60';
  const labelPrefix = '★';
  
  // ▼▼▼ ここから書き換え ▼▼▼
  div.innerHTML = `
      ${rankHtml}
      <div class="book-item">
          ${coverHtml}
          <div class="book-info">
              <div class="book-title" title="${book.title}">${book.title}</div>
              <div class="book-author-text" style="font-size:0.85em; color:#666; margin-bottom:5px;">${authorText}</div>
              <div><span class="current-score" style="color:${scoreColor};">${labelPrefix} ${scoreValue}</span></div>
              <!-- ★ここにAmazonボタンがありましたが、削除して下に移動しました -->
          </div>
      </div>
      
      <!-- ★移動場所：book-itemの外、rating-areaの前 -->
      <a href="${amazonUrl}" target="_blank" class="amazon-link-btn">Amazonで見る</a>

      <div class="rating-area">
          ${isVoted ? 
             `<div class="voted-message" style="color:#7f8c8d; font-weight:bold; padding:10px 0;">投票済み</div>` : 
             `<div class="rating-buttons">
                  <button class="btn-vote" data-val="1">+1</button>
                  <button class="btn-vote" data-val="3">+3</button>
                  <button class="btn-vote" data-val="5">+5</button>
              </div>`
          }
      </div>
  `;
  // ▲▲▲ 書き換えここまで ▲▲▲
  
  if (!isVoted) {
      div.querySelectorAll(".btn-vote").forEach(btn => {
          btn.addEventListener("click", () => handleVote(book, parseInt(btn.dataset.val), div, displayType));
      });
  }
  return div;
}

async function searchExternalBooks(genreId, keyword) {
  isWebSearching[genreId] = true;

  const container = document.getElementById(`list-${genreId}`);
  container.innerHTML = `<p style="padding:20px; text-align:center; width:100%;">🔍 検索中...</p>`;

  try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keyword)}&langRestrict=ja&maxResults=40`);
      const data = await res.json();

      container.innerHTML = ""; 

      if (!data.items || data.items.length === 0) {
          container.innerHTML = `<p style="padding:20px; color:#999; text-align:center; width:100%;">見つかりませんでした。</p>`;
          return;
      }

      data.items.forEach(item => {
          try {
              const card = createExternalBookCard(item);
              container.appendChild(card);
          } catch (e) {
              console.warn("特定の本の表示スキップ:", item, e);
          }
      });

  } catch (err) {
      console.error(err);
      container.innerHTML = `<p style="padding:20px; color:red; text-align:center; width:100%;">エラーが発生しました。<br><span style="font-size:0.8em">通信環境を確認してください</span></p>`;
  }
}

function createExternalBookCard(item) {
  const div = document.createElement("div");
  div.className = "book-card";

  const info = item.volumeInfo || {};
  const title = info.title || "タイトル不明";
  const authors = info.authors ? info.authors.join(", ") : "著者不明";
  
  let coverHtml = '';
  const imgData = info.imageLinks || {};
  let imgUrl = imgData.thumbnail || imgData.smallThumbnail;

  if (imgUrl) {
      imgUrl = imgUrl.replace('http://', 'https://');
      coverHtml = `<img src="${imgUrl}" class="book-cover" alt="${title}">`;
  } else {
      coverHtml = `<div class="book-cover-placeholder">No Image</div>`;
  }

  const searchQuery = `${title} ${authors}`;
  const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchQuery)}`;
  const isVoted = localStorage.getItem(`voted_${item.id}`);

  div.innerHTML = `
      <div class="book-item">
          ${coverHtml}
          <div class="book-info">
              <div class="book-title" title="${title}">${title}</div>
              <div class="book-author-text" style="font-size:0.85em; color:#666; margin-bottom:5px;">${authors}</div>
              <div><span class="current-score" style="color:#e67e22; font-weight:bold;"></span></div>
              <a href="${amazonUrl}" target="_blank" class="amazon-link-btn" style="margin-top:5px; display:inline-block; font-size:0.8em;">Amazon</a>
          </div>
      </div>
      <div class="rating-area">
          ${isVoted ? 
             `<div class="voted-message" style="color:#7f8c8d; font-weight:bold; padding:10px 0;">投票済み</div>` : 
             `<div class="rating-buttons">
                  <button class="btn-vote" data-val="1">+1</button>
                  <button class="btn-vote" data-val="3">+3</button>
                  <button class="btn-vote" data-val="5">+5</button>
              </div>`
          }
      </div>
  `;

  if (!isVoted) {
      div.querySelectorAll(".btn-vote").forEach(btn => {
          btn.addEventListener("click", () => voteForNewBook(item, parseInt(btn.dataset.val), div));
      });
  }

  return div;
}

/* 
   main.js の handleVote 関数
   修正：既存の本（ランキング）への投票なので、セキュリティルールに抵触しないよう
   「点数のみ」を更新する updateDoc に戻します。
*/
async function handleVote(book, points, cardElement, currentDisplayType = 'score') {
  const storageKey = `voted_${book.id}`;
  if (localStorage.getItem(storageKey)) {
      console.log("すでに投票済みのためスキップしました");
      return;
  }

  try {
      localStorage.setItem(storageKey, "true");

      const ratingArea = cardElement.querySelector(".rating-area");
      if (ratingArea) {
          ratingArea.innerHTML = `<div class="voted-message" style="color:#7f8c8d; font-weight:bold; padding:10px 0;">投票済み (+${points})</div>`;
      }
      
      const scoreSpan = cardElement.querySelector(".current-score");
      if(scoreSpan) {
          const currentText = scoreSpan.textContent.replace(/[^0-9]/g, '');
          const currentVal = parseInt(currentText, 10) || 0;
          
          let displayIncrement = points;
          if (currentDisplayType === 'score') {
              const raw = book.raw_score || 0;
              const total = book.score || 0;
              if (total > raw * 1.5) { 
                   displayIncrement = points * 2; 
              }
          }
          
          const labelPrefix = '★';
          scoreSpan.textContent = `${labelPrefix} ${currentVal + displayIncrement}`;
      }

      const isBonus = isAwardWinner(book);
      const scoreIncrement = isBonus ? points * 2 : points;
      const rawIncrement = points;

      // ▼▼▼ 修正箇所 ▼▼▼
      // ランキングにある本は確実にDBに存在するため、updateDocを使用します。
      // タイトルやジャンルを含めず、点数だけ更新することでセキュリティエラーを回避します。
      const bookRef = doc(db, "books", book.id);
      await updateDoc(bookRef, {
          score: increment(scoreIncrement),
          raw_score: increment(rawIncrement),
          // lastUpdated: serverTimestamp() // もし更新日時もルールで禁止されている場合は、この行も削除してください
      });
      // ▲▲▲ --------------------------------------- ▲▲▲

      // グラフ更新用の通知（既存の本なので book.mainGenre は確実に存在します）
      if (book && book.mainGenre && window.logGenreVote) {
          window.logGenreVote(book.mainGenre);
      }

  } catch (error) {
      console.error("投票エラー:", error);
      alert("通信エラーが発生しました。もう一度お試しください。");
      localStorage.removeItem(storageKey);
  }
}


/* --------------------------------------------------------------------------
   ▼▼▼ 最強ジャンル判定ロジック (V6 Hybrid) ▼▼▼
   OpenBDのCコード(基本・ONIX)と、強力なキーワード判定を組み合わせて
   新規本登録時のジャンル揺れを徹底的に防ぎます。
   -------------------------------------------------------------------------- */

// OpenBDのデータ + 本のタイトルを受け取り、最適な target / genre を返す
function determineSmartGenre(openBdData, title) {
    let cCode = null;
    let target = ['general']; // デフォルト
    let mainGenre = 'general';

    // 1. OpenBDの基本データ (Summary) からCコードを探す
    if (openBdData && openBdData.summary && openBdData.summary.c_code) {
        cCode = openBdData.summary.c_code;
    }

    // 2. なければ、詳細データ (ONIX) の深層からCコードを探す
    if (!cCode && openBdData && openBdData.onix && openBdData.onix.DescriptiveDetail && 
        openBdData.onix.DescriptiveDetail.ProductClassification) {
        const pc = openBdData.onix.DescriptiveDetail.ProductClassification;
        const found = pc.find(x => x.ProductClassificationType === '04'); // Type 04 = C-Code
        if (found && found.ProductClassificationCode) {
            cCode = found.ProductClassificationCode;
        }
    }

    // A. Cコードが見つかった場合の判定
    if (cCode) {
        const first = cCode.charAt(0);
        const second = cCode.charAt(1);

        // ジャンル (mainGenre) の決定
        if (first === '6' || first === '7') mainGenre = 'study'; // 語学・学習
        else if (first === '8') mainGenre = 'children';        // 児童
        else if (first === '2') mainGenre = 'hobby';           // 実用
        else if (first === '1' || first === '9') mainGenre = 'literature'; // 文芸
        else if (first === '3') mainGenre = 'business';        // ビジネス
        else if (first === '4' || first === '5') mainGenre = 'specialized'; // 専門
        else mainGenre = 'general';

        // ターゲット (target) の決定
        switch (second) {
            case '1': target = ['general', 'university']; break; // 一般・教養
            case '2': target = ['elementary']; break;            // 小学生
            case '3': target = ['junior_high']; break;           // 中学生
            case '4': target = ['high_school']; break;           // 高校生
            case '5': target = ['university', 'general']; break; // 専門・大学生
            case '6': target = ['general']; break;               // 成人
            case '0': target = ['general']; break;               // 一般
            default: target = ['general'];
        }
    }

    // B. キーワード救済 (Keyword-Rescue)
    // Cコードがない、あるいは「一般」判定だが、タイトルが明らかに学生向けの場合などを上書き
    const text = (title || "").toLowerCase();
    
    // 【最優先】高校生・受験キーワード (ユーザー要望により大幅増強)
    const HS_KEYWORDS = [
        "大学入試", "大学受験", "共通テスト", "センター試験", "大学入", "大学受",
        "高校生", "高校", "高1", "高2", "高3", 
        "ターゲット", "シス単", "システム英単語", "英単語ターゲット", "単語王", "鉄壁", "速読英単語", "duo 3.0", "duo3.0",
        "赤本", "黒本", "青本", "過去問", "教学社",
        "チャート式", "focus gold", "フォーカスゴールド", "レジェンド", "1対1対応", "プラチカ", "やさしい理系数学", "ハイレベル理系数学",
        "next stage", "vintage", "scramble", "ネクステ", "スクランブル", "アップグレード", "upgrade", "forest", "evergreen", "透視図", "ポレポレ",
        "物理のエッセンス", "良問の風", "名問の森", "重要問題集", "重問", "セミナー", "リードα",
        "山川", "一問一答", "用語集", "標準問題精講", "基礎問題精講", "入門問題精講",
        "鉄緑会", "東大", "京大", "医学部", "難関",
        "古文", "漢文", "物理基礎", "化学基礎", "生物基礎", "地学基礎", "数i", "数ii", "数iii", "数a", "数b", "数c", "マドンナ古文", "ゴロゴ"
    ];

    if (HS_KEYWORDS.some(k => text.includes(k.toLowerCase()))) {
        // もし既存判定が既に study ならそのまま、そうでなければ study に変更
        return { target: ['high_school'], genre: 'study', cCode: cCode };
    }

    // 中学生
    if (text.includes("中学") || text.includes("高校入試") || text.includes("中1") || text.includes("中2") || text.includes("中3")) {
        return { target: ['junior_high'], genre: 'study', cCode: cCode };
    }

    // 小学生
    if (text.includes("小学") || text.includes("中学入試") || text.includes("中学受験") || text.includes("絵本") || text.includes("図鑑") || text.includes("児童") || text.includes("こども")) {
        // 絵本などはchildren, 中学受験系はstudyの可能性が高いが、簡易的にchildren/elementaryまたはstudyに振り分ける
        if (text.includes("入試") || text.includes("受験") || text.includes("ドリル")) {
            return { target: ['elementary'], genre: 'study', cCode: cCode };
        }
        return { target: ['elementary'], genre: 'children', cCode: cCode };
    }
    
    // 大学生・専門
    if (text.includes("大学") || text.includes("論文") || text.includes("研究") || text.includes("学会")) {
        return { target: ['university', 'general'], genre: 'specialized', cCode: cCode };
    }

    // Cコードによる判定が生きているならそれを返す
    if (cCode) {
        return { target: target, genre: mainGenre, cCode: cCode };
    }

    // 完全に不明
    return null;
}

/**
 * 新規の本への投票（OpenBD対応 & V6ロジック完全統合版）
 * 修正点：管理者用グラフへの通知処理を追加
 */
async function voteForNewBook(book, points, cardElement) {
  const info = book.volumeInfo || {};
  const title = info.title || "タイトル不明";
  const googleId = book.id;
  
  const storageKey = `voted_${googleId}`;
  if (localStorage.getItem(storageKey)) {
      alert("この本にはすでに投票済みです");
      return;
  }

  const isBonus = isAwardWinner(info);
  const rawPoints = points;
  const weightedPoints = isBonus ? points * 2 : points;

  localStorage.setItem(storageKey, "true");
  const ratingArea = cardElement.querySelector(".rating-area");
  if (ratingArea) {
      const msg = isBonus ? `Thanks! (+${weightedPoints}) 🏆 Award Bonus!` : `Thanks! (+${rawPoints})`;
      ratingArea.innerHTML = `<div class="voted-message" style="color:#e67e22; font-weight:bold; padding:10px 0;">${msg}</div>`;
      const scoreSpan = cardElement.querySelector(".current-score");
      if(scoreSpan) scoreSpan.textContent = `★ ${weightedPoints}`; 
  }

  try {
      const searchKey = normalize(title);
      let targetDocId = googleId;
      let isMerge = false;

      const booksRef = collection(db, "books");
      const q1 = query(booksRef, where("searchKey", "==", searchKey));
      const snap1 = await getDocs(q1);

      if (!snap1.empty) {
          targetDocId = snap1.docs[0].id;
          isMerge = true;
      } else {
          const q2 = query(booksRef, where("title", "==", title));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
              targetDocId = snap2.docs[0].id;
              isMerge = true;
          }
      }

      // 1. Google Books情報で仮構築 (Fallback用)
      const struct = analyzeBookStructure(info);
      let finalGenre = struct.mainGenre;
      let finalTarget = struct.target;
      let finalCCode = null;

      // 2. OpenBDで正確な情報を取得し、V6ロジックで判定
      let isbn = null;
      if (info.industryIdentifiers) {
          const found = info.industryIdentifiers.find(id => id.type === "ISBN_13") 
                     || info.industryIdentifiers.find(id => id.type === "ISBN_10");
          if(found) isbn = found.identifier;
      }

      if (isbn) {
          try {
              const cleanIsbn = isbn.replace(/[^0-9X]/g, '');
              const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${cleanIsbn}`);
              const json = await res.json();
              const openBdData = json && json[0] ? json[0] : null;

              // ★最強ロジック呼び出し
              const smartResult = determineSmartGenre(openBdData, title);
              
              if (smartResult) {
                  console.log(`Smart Genre Determined:`, smartResult);
                  finalGenre = smartResult.genre;
                  finalTarget = smartResult.target;
                  finalCCode = smartResult.cCode;
              }
          } catch (e) {
              console.warn("OpenBD fetch failed, using Google fallback:", e);
          }
      }

      const docRef = doc(db, "books", targetDocId);
      const updateData = {
          title: title,
          searchKey: searchKey,
          score: increment(weightedPoints),
          raw_score: increment(rawPoints),
          lastUpdated: serverTimestamp()
      };

      if (!isMerge) {
          Object.assign(updateData, {
              authors: info.authors || ["著者不明"],
              description: info.description || "",
              image: info.imageLinks?.thumbnail || "",
              categories: info.categories || [],
              
              // 確定したジャンル情報を保存
              mainGenre: finalGenre,
              target: finalTarget,
              subGenres: struct.subGenres, // Google情報由来のサブジャンルは維持
              cCode: finalCCode || null,
              
              // 旧互換用
              genres: [finalGenre, ...struct.subGenres],
              targetGenres: finalTarget, 
              votedUsers: []
          });
      }

      await setDoc(docRef, updateData, { merge: true });
      console.log(`投票完了: ${title}`);

      // ▼▼▼ 追加: 管理者画面のグラフ更新用フック ▼▼▼
      // これにより、新規登録時のジャンルもグラフに即時反映されます
      if (window.logGenreVote && finalGenre) {
          window.logGenreVote(finalGenre);
      }
      // ▲▲▲ --------------------------------------- ▲▲▲

  } catch (e) {
      console.error("新規投票エラー:", e);
      localStorage.removeItem(storageKey);
      const ratingArea = cardElement.querySelector(".rating-area");
      if(ratingArea) ratingArea.innerHTML = `<span style="color:red; font-size:12px;">エラーが発生しました</span>`;
      alert("投票に失敗しました。通信環境を確認してください。");
  }
}

function initModal() {
  const modal = document.getElementById("ranking-modal"); 
  const btn = document.getElementById("rankingRuleBtn");
  const span = document.getElementById("close-modal");

  if (modal && btn && span) {
      btn.onclick = () => {
          modal.style.display = "block";
      };
      span.onclick = () => {
          modal.style.display = "none";
      };
      window.onclick = (e) => {
          if (e.target == modal) {
              modal.style.display = "none";
          }
      };
  }
}

/**
 * Google Books APIの情報からジャンル構造を解析する関数（OpenBD失敗時のフォールバック用）
 */
function analyzeBookStructure(info) {
  const API_SUBGENRE_MAP = {
      "mystery": "mystery", "detective": "mystery", "crime": "mystery",
      "fantasy": "fantasy", "magic": "fantasy",
      "science fiction": "sf", "space": "sf",
      "history": "history", "historical": "history",
      "business": "management", "economics": "management", "management": "management",
      "finance": "finance", "investment": "finance",
      "health": "health", "fitness": "health",
      "medical": "medical", "medicine": "medical",
      "technology": "science_tech", "engineering": "science_tech", "computer": "science_tech",
      "art": "art", "design": "art",
      "language": "language", "education": "education",
      "mathematics": "math",
      "science": "science", "physics": "science", "chemistry": "science", "biology": "science",
      "psychology": "humanities", "philosophy": "humanities",
      "comics": "manga", "manga": "manga", "graphic novels": "manga"
  };

  // Google判定用にもキーワードを増強
  const TARGET_KEYWORDS = {
      "university": ["大学", "学部", "卒", "資格", "専門", "キャンパス", "論文", "研究"],
      "high_school": ["高校", "大学受験", "共通テスト", "センター試験", "青春", "赤本", "チャート式", "ターゲット", "重要問題集", "数I", "数A", "物理基礎"],
      "junior_high": ["中学", "高校入試", "中学生"],
      "elementary": ["小学", "中学入試", "児童", "こども", "絵本"],
      "infant": ["幼児", "絵本", "読み聞かせ"]
  };

  const apiCats = (info.categories || []).join(" ").toLowerCase();
  
  const fullText = JSON.stringify([
      info.title || "", 
      info.categories || [], 
      info.description || ""
  ]).toLowerCase();

  let main = "other";
  let targets = new Set();
  let subs = new Set();

  // --- 大ジャンル判定 ---
  if (apiCats.includes("juvenile") || apiCats.includes("children")) {
      main = "children";
      if (fullText.includes("young adult")) targets.add("high_school");
      else targets.add("elementary");
  }
  else if (apiCats.includes("fiction") || apiCats.includes("literature") || apiCats.includes("drama") || apiCats.includes("poetry")) {
      main = "literature";
  }
  else if (apiCats.includes("comics") || apiCats.includes("manga")) {
      main = "literature"; 
      subs.add("manga"); 
  }
  else if (apiCats.includes("business") || apiCats.includes("economics")) {
      main = "business";
  }
  else if (apiCats.includes("study aids") || apiCats.includes("education") || apiCats.includes("foreign language study")) {
      main = "study";
  }
  else if (
      apiCats.includes("computers") || apiCats.includes("technology") || 
      apiCats.includes("science") || apiCats.includes("medical") || 
      apiCats.includes("mathematics") || apiCats.includes("law") || 
      apiCats.includes("psychology") || apiCats.includes("architecture") ||
      apiCats.includes("engineering")
  ) {
      main = "specialized";
  }
  else if (
      apiCats.includes("cooking") || apiCats.includes("travel") || 
      apiCats.includes("health") || apiCats.includes("fitness") || 
      apiCats.includes("crafts") || apiCats.includes("hobbies") || 
      apiCats.includes("sports") || apiCats.includes("art") || 
      apiCats.includes("music") || apiCats.includes("photography") ||
      apiCats.includes("gardening")
  ) {
      main = "hobby";
  }
  
  // --- 大ジャンル判定（キーワード） ---
  if (main === "other") {
    if (fullText.includes("絵本") || fullText.includes("童話") || fullText.includes("こども") || fullText.includes("図鑑") || fullText.includes("小学館")) {
        main = "children";
        targets.add("elementary"); 
    }
    else if (fullText.includes("大学入試") || fullText.includes("参考書")) main = "study";
    else if (fullText.includes("小説") || fullText.includes("文庫")) main = "literature";
    else if (
        fullText.includes("技術") || fullText.includes("工学") || 
        fullText.includes("プログラミング") || fullText.includes("ソフトウェア") || 
        fullText.includes("コード") || fullText.includes("エンジニア") ||
        fullText.includes("言語") || fullText.includes("システム")
    ) {
        main = "specialized";
    }
    else if (fullText.includes("ビジネス") || fullText.includes("投資") || fullText.includes("マネジメント")) main = "business";
    else if (fullText.includes("レシピ") || fullText.includes("旅行") || fullText.includes("ガイド")) main = "hobby";
  }

  // --- 小ジャンル判定 ---
  for (const [key, val] of Object.entries(API_SUBGENRE_MAP)) {
      if (apiCats.includes(key)) {
          subs.add(val);
      }
  }
  if (fullText.includes("ミステリー") || fullText.includes("推理")) subs.add("mystery");
  if (fullText.includes("ファンタジー")) subs.add("fantasy");
  if (fullText.includes("歴史") || fullText.includes("時代")) subs.add("history");

  // --- ターゲット判定（キーワード） ---
  for (const [key, keywords] of Object.entries(TARGET_KEYWORDS)) {
      if (keywords.some(k => fullText.includes(k))) targets.add(key);
  }
  
  if ((main === "literature" || main === "study") && targets.size === 0) {
      targets.add("general");
  }

  return {
      mainGenre: main,
      subGenres: Array.from(subs),
      target: Array.from(targets) 
  };
}
