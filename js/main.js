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
  getDocs,
  getDoc 
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
    univ_general: { // 「一般」と「大学生」を統合
        label: "大学生・一般",
        subs: [
            { id: "career_up", label: "キャリアアップ" },
            { id: "relearning", label: "学び直し・基礎科目" },
            { id: "liberal_arts", label: "教養・趣味" }
        ]
    },
    high_school: { 
        label: "高校生",
        subs: [
            { id: "modern_japanese", label: "現代文" },
            { id: "classic_japanese", label: "古文" },
            { id: "chinese_classics", label: "漢文" },
            { id: "math_ia", label: "数学IA" },
            { id: "math_iib", label: "数学IIB" },
            { id: "math_iiic", label: "数学IIIC" },
            { id: "english", label: "英語" },
            { id: "german", label: "ドイツ語" },
            { id: "french", label: "フランス語" },
            { id: "chinese", label: "中国語" },
            { id: "korean", label: "韓国語" },
            { id: "world_history", label: "世界史" },
            { id: "japanese_history", label: "日本史" },
            { id: "geography", label: "地理" },
            { id: "ethics", label: "倫理" },
            { id: "politics_economy", label: "政経" },
            { id: "chemistry", label: "化学" },
            { id: "physics", label: "物理" },
            { id: "biology", label: "生物" },
            { id: "earth_science", label: "地学" },
            { id: "informatics", label: "情報" }
        ]
    },
    junior_high: { 
        label: "中学生",
        subs: [
            { id: "japanese_jh", label: "国語" },
            { id: "math_jh", label: "数学" },
            { id: "science_jh", label: "理科" },
            { id: "social_jh", label: "社会" },
            { id: "english_jh", label: "英語" }
        ]
    },
    elementary: {
        label: "小学生",
        subs: [
            { id: "japanese_elem", label: "国語" },
            { id: "math_elem", label: "算数" },
            { id: "science_elem", label: "理科" },
            { id: "social_elem", label: "社会" },
            { id: "english_elem", label: "英語" }
        ]
    },
    infant: { 
        label: "幼児",
        subs: [] // 小ジャンルによる絞り込みを廃止（空配列）
    }
};

// --- 追加：科目判定用のキーワードマップ (移行スクリプトと同じ内容) ---
const SUBJECT_KEYWORDS = {
    high_school: {
        modern_japanese: ["現代文", "金の漢字", "日本文法"],
        classic_japanese: ["古文"],
        chinese_classics: ["漢文"],
        math_ia: ['数学I', '数学1', '数学A', '数学Ⅰ', '数学1A', '数学IA'],
        math_iib: ["数学II", "数学B", "数II", "数B", "数学2"],
        math_iiic: ["数学III", "数学C", "数III", "数C", "数学3"],
        english: ["英語", "英単語", "英文法", "English", "NextStage", "Next Stage", "ネクステ", "Vintage", "ターゲット"],
        german: ["ドイツ語"],
        french: ["フランス語"],
        chinese: ["中国語"],
        korean: ["韓国語"],
        world_history: ["世界史"],
        japanese_history: ["日本史"],
        geography: ["地理"],
        ethics: ["倫理"],
        politics_economy: ["政経", "政治・経済"],
        chemistry: ["化学"],
        physics: ["物理"],
        biology: ["生物"],
        earth_science: ["地学"],
        informatics: ["情報"]
    },
    junior_high: {
        japanese_jh: ["国語"],
        math_jh: ["数学"],
        science_jh: ["理科"],
        social_jh: ["社会"],
        english_jh: ["英語", "English"]
    },
    elementary: {
        japanese_elem: ["国語", "漢字"],
        math_elem: ["算数", "計算"],
        science_elem: ["理科"],
        social_elem: ["社会"],
        english_elem: ["英語", "English"]
    }
};

// --- 追加：科目判定ロジック ---
// 修正版：科目を判定する補助関数
function detectSubGenre(title, description, target) {
    const text = (title + " " + (description || "")).toLowerCase();
    const subjects = SUBJECT_KEYWORDS[target];
    if (!subjects) return [];
  
    let foundSubId = null;
    let longestMatchLength = 0;
  
    // 全ての科目をチェックし、最も長いキーワードで一致したものを採用する
    for (const [subId, keywords] of Object.entries(subjects)) {
        for (const k of keywords) {
            const lowerK = k.toLowerCase();
            if (text.includes(lowerK)) {
                // 「数学I」より「数学III」の方が文字数が長いため、
                // より具体的な（長い）キーワードに一致した方を優先する
                if (k.length > longestMatchLength) {
                    longestMatchLength = k.length;
                    foundSubId = subId;
                }
            }
        }
    }
    
    return foundSubId ? [foundSubId] : [];
  }
  
// メモリ保存用
const loadedBooks = {}; 
const chartInstances = {};
const isWebSearching = {};
const currentRankingTypes = {};
const searchIndices = {}; 

// ★追加：各ジャンルの現在の表示件数を管理 (初期値20)
const currentLimits = {}; 

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
        currentLimits[genre.id] = 20; // ★初期表示数を20に設定
        setupGenreSection(genre.id);
    });
    initModal();

    // ▼▼▼ 2026年ランキングの初期化 ▼▼▼
    isWebSearching['2026'] = false;
    currentRankingTypes['2026'] = 'score';
    currentLimits['2026'] = 20; // ★初期表示数を20に設定
    setup2026Section(); 

    // ▼▼▼ おすすめ本の読み込み ▼▼▼    
    loadFeaturedBook();

    // ▼▼▼ アクセス集計（PV）を実行 ▼▼▼    
    trackPageLoad(); 
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
 * ジャンルごとの初期設定（ページネーション対応版）
 */
function setupGenreSection(genreId) {
  const listElement = document.getElementById(`list-${genreId}`);
  if (!listElement) return;

  let unsubscribe = null;

    // データを取得・描画する内部関数
    const fetchAndRender = () => {
        if (unsubscribe) unsubscribe();

        const container = document.getElementById(`list-${genreId}`);
        if(container && container.childElementCount === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center;">読み込み中...</p>';
        }

        const sortField = currentRankingTypes[genreId] || 'score';
        const constraints = [];
        constraints.push(where("mainGenre", "==", genreId));

        // main.js の fetchAndRender 内（195行目付近〜）を以下に差し替え
        if (genreId === 'study') {
            const targetEl = document.getElementById("filter-study-target");
            const targetVal = targetEl ? targetEl.value : "all";
            const subEl = document.getElementById("filter-study-sub");
            const subVal = subEl ? subEl.value : "all";
            
            // 【重要】Firestoreの制限回避：array-contains は1つだけ使用する
            if (subVal !== "all") {
                // サブカテゴリ（数学IAなど）が選択されていれば、それを優先して検索
                constraints.push(where("subGenres", "array-contains", subVal));
            } else if (targetVal !== "all") {
                // サブカテゴリが「すべて」の時のみ、ターゲット（高校生など）で検索
                constraints.push(where("target", "array-contains", targetVal));
            }
        } else {
            // ...（他のジャンルの処理はそのまま）
            const filterEl = document.getElementById(`filter-${genreId}`);
            if (filterEl && filterEl.value !== "all") {
                const val = filterEl.value;
                constraints.push(where("subGenres", "array-contains", val));
            }
        }

        constraints.push(orderBy(sortField, "desc"));
        const limitCount = currentLimits[genreId] || 20;
        constraints.push(limit(limitCount));

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
             const msg = "【管理者用メッセージ】<br>インデックスが必要です。コンソールを確認してください。";
             if(container) container.innerHTML = `<p style="padding:20px; color:red; text-align:center; font-weight:bold;">${msg}</p>`;
          } else {
             if(container) container.innerHTML = '<p style="padding:20px; text-align:center;">エラーが発生しました。</p>';
          }
      });
    };

  fetchAndRender();

  // --- イベントリスナー設定 ---
  
  const rankingTypeSelect = document.getElementById(`ranking-type-${genreId}`);
  if (rankingTypeSelect) {
      rankingTypeSelect.addEventListener("change", (e) => {
          currentRankingTypes[genreId] = e.target.value;
          isWebSearching[genreId] = false;
          // ランキング基準を変えたら件数をリセットする
          currentLimits[genreId] = 20;
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
              
              // 絞り込みを変えたら件数をリセットして再取得
              currentLimits[genreId] = 20;
              fetchAndRender();
          });
      }
        if (subSelect) {
            subSelect.addEventListener("change", () => {
                currentLimits[genreId] = 20; // 件数をリセット
                fetchAndRender(); // ★Firestoreから再取得する
            });
        }
  } else {
      const filterSelect = document.getElementById(`filter-${genreId}`);
      if (filterSelect) {
          filterSelect.addEventListener("change", () => {
              // 絞り込みを変えたら件数をリセットして再取得
              currentLimits[genreId] = 20;
              fetchAndRender();
          });
      }
  }

  // ★「もっと見る」ボタンの処理用関数を要素に紐付ける（クロージャ対応）
  listElement.dataset.genreId = genreId;
  listElement.loadMore = () => {
      currentLimits[genreId] += 20; // 20件追加
      fetchAndRender(); // 再取得
  };
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
  
    // ★「もっと見る」ボタンの表示判定とデザイン修正
    const limitCount = currentLimits[genreId] || 20;
    if (books.length >= limitCount) {
        const loadMoreBtn = document.createElement("button");
        loadMoreBtn.textContent = "もっと見る (+20件)";
        
        // ▼▼▼ デザインをサイトのテーマ（青系）に合わせて修正 ▼▼▼
        loadMoreBtn.style.cssText = `
            display: block;
            margin: 30px auto 10px;      /* 上に少し余白を開ける */
            padding: 12px 50px;          /* 横幅を広めに */
            background-color: #fff;      /* 背景は白 */
            color: #3498db;              /* 文字はサイトのテーマカラーの青 */
            border: 2px solid #3498db;   /* 枠線を青く */
            border-radius: 30px;         /* 丸みを強くしてカプセル型に */
            cursor: pointer;
            font-weight: bold;
            font-size: 15px;
            transition: all 0.3s ease;   /* ふわっと変化させる */
            box-shadow: 0 4px 10px rgba(52, 152, 219, 0.2); /* 薄い青の影をつける */
        `;
        
        // マウスを乗せた時の動き（青く反転）
        loadMoreBtn.onmouseover = () => {
            loadMoreBtn.style.background = "#3498db";
            loadMoreBtn.style.color = "#fff";
            loadMoreBtn.style.boxShadow = "0 6px 14px rgba(52, 152, 219, 0.4)";
            loadMoreBtn.style.transform = "translateY(-2px)"; // 少し浮き上がる
        };
        
        // マウスを離した時の動き（元に戻す）
        loadMoreBtn.onmouseout = () => {
            loadMoreBtn.style.background = "#fff";
            loadMoreBtn.style.color = "#3498db";
            loadMoreBtn.style.boxShadow = "0 4px 10px rgba(52, 152, 219, 0.2)";
            loadMoreBtn.style.transform = "translateY(0)";
        };
        
        loadMoreBtn.onclick = () => {
            if (container.loadMore) {
                loadMoreBtn.textContent = "読み込み中...";
                loadMoreBtn.style.opacity = "0.7";
                loadMoreBtn.style.cursor = "wait";
                loadMoreBtn.disabled = true;
                container.loadMore();
            }
        };
        // ▲▲▲ デザイン修正ここまで ▲▲▲
        
        container.appendChild(loadMoreBtn);
    }
  }
  
function updateChart(genreId, books) {
    const ctx = document.getElementById(`chart-${genreId}`);
    if (!ctx) return;
    const limitEl = document.getElementById(`chart-limit-${genreId}`);
    const displayCount = limitEl ? parseInt(limitEl.value, 10) : 10;
    const topBooks = books.slice(0, displayCount);
    
    const currentType = currentRankingTypes[genreId] || 'score';
    const isMobile = window.innerWidth <= 768;
    const cutLength = isMobile ? 12 : 10;
    const labels = topBooks.map(b => b.title.length > cutLength ? b.title.substring(0, cutLength) + '…' : b.title);
    const scores = topBooks.map(b => b[currentType] !== undefined ? b[currentType] : 0);
  
    if (chartInstances[genreId]) {
        chartInstances[genreId].destroy();
    }
    
    const wrapper = ctx.parentElement;
    if (wrapper) wrapper.style.height = '350px';
      
    const genreColorMap = {
        '2026': '191, 33, 33', 
        'literature': '21, 101, 192',
        'business':   '46, 125, 50',
        'hobby':      '230, 126, 34',
        'specialized': '106, 27, 154',
        'children':   '173, 20, 87',
        'study':    '0, 131, 143'
    };

    const themeRGB = genreColorMap[genreId] || '52, 152, 219';
    const barColor = `rgba(${themeRGB}, 0.7)`;
    const borderColor = `rgba(${themeRGB}, 1)`;
  
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
                borderRadius: 8,                    
                borderSkipped: false,
            }]
        },
        options: {
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
              [scoreAxis]: { 
                  beginAtZero: true, 
                  grace: '10%',
                  title: { display: !isMobile, text: '獲得スコア' },
                  ticks: {
                      stepSize: 1,
                      font: { weight: 'bold' }
                  }
              },
              [labelAxis]: {
                  grid: { display: false },
                  ticks: {
                      autoSkip: false,
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
  
    // 検索用に先頭の著者のみを抽出（表示用は authorText をそのまま使用）
    const firstAuthor = (book.authors && book.authors.length > 0) ? book.authors[0] : (book.author || "");
    const searchQuery = `${book.title} ${firstAuthor}`;
    const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchQuery.trim())}`;
    const isVoted = localStorage.getItem(`voted_${book.id}`);
  
    let rankHtml = '';
    if (rank) {
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        rankHtml = `<div class="rank-badge ${rankClass}">${rank}</div>`;
    }
  
    const scoreValue = book[displayType] !== undefined ? book[displayType] : 0;
    const scoreColor = displayType === 'score' ? '#e67e22' : '#27ae60';
    const labelPrefix = '★';
    
    const shareText = `『${book.title}』を応援しています！\nみんなのおすすめ本ランキング #BookRee`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.href)}`;
    
    div.innerHTML = `
        ${rankHtml}
        <div class="book-item">
            ${coverHtml}
            <div class="book-info">
                <div class="book-title" title="${book.title}">${book.title}</div>
                <div class="book-author-text" style="font-size:0.85em; color:#666; margin-bottom:5px;">${authorText}</div>
                <div><span class="current-score" style="color:${scoreColor};">${labelPrefix} ${scoreValue}</span></div>
            </div>
        </div>
        
        <a href="${amazonUrl}" target="_blank" class="amazon-link-btn" onclick="trackClick('${book.id}')">Amazonで見る</a>
  
        <div class="rating-area">
            ${isVoted ? 
               // ▼▼▼ 修正: white-space:nowrap で改行を禁止し、gapを狭めてスマホに収める ▼▼▼
               `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding:10px 0; flex-wrap:nowrap;">
                    <span style="color:#27ae60; background:#eafaf1; border:1px solid #27ae60; font-weight:bold; padding:4px 8px; border-radius:20px; font-size:11px; display:flex; align-items:center; gap:2px; white-space:nowrap; flex-shrink: 0;">
                      ✔ 投票済
                    </span>
                    <a href="${shareUrl}" target="_blank" rel="noopener noreferrer" 
                       style="background-color:#000; color:#fff; text-decoration:none; padding:4px 8px; border-radius:15px; font-size:11px; display:flex; align-items:center; gap:4px; transition: opacity 0.3s; border:1px solid #000; white-space:nowrap; flex-shrink: 0;">
                       <span style="font-style:normal; font-weight:bold;">𝕏</span> でシェア
                    </a>
                </div>`
               : 
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
            btn.addEventListener("click", () => handleVote(book, parseInt(btn.dataset.val), div, displayType));
        });
    }
    return div;
  }
      
/**
 * 外部（Google Books）検索を実行する関数
 * @param {string} genreId 
 * @param {string} keyword 
 * @param {boolean} isLoadMore 追加読み込みかどうか
 */
async function searchExternalBooks(genreId, keyword, isLoadMore = false) {
    isWebSearching[genreId] = true;
    const container = document.getElementById(`list-${genreId}`);
    
    // 新規検索の場合はインデックスをリセットし、画面をクリア
    if (!isLoadMore) {
        searchIndices[genreId] = 0;
        container.innerHTML = `<p style="padding:20px; text-align:center; width:100%;">🔍 検索中...</p>`;
    } else {
        // 「もっと見る」ボタンを一時的に無効化
        const oldBtn = container.querySelector('.search-load-more-btn');
        if (oldBtn) {
            oldBtn.textContent = "読み込み中...";
            oldBtn.disabled = true;
        }
    }

    try {
        const startIndex = searchIndices[genreId] || 0;
        const apiKey = "AIzaSyCL88yBdIcEZIh_Zrw-NOmy-QtRCNB0cns"; // 既存のキーを使用
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keyword)}&langRestrict=ja&maxResults=20&startIndex=${startIndex}&key=${apiKey}`);      
        const data = await res.json();

        // 新規検索なら一旦クリア
        if (!isLoadMore) container.innerHTML = ""; 
        
        // 古い「もっと見る」ボタンを削除
        const oldBtn = container.querySelector('.search-load-more-btn');
        if (oldBtn) oldBtn.remove();

        if (!data.items || data.items.length === 0) {
            if (!isLoadMore) {
                container.innerHTML = `<p style="padding:20px; color:#999; text-align:center; width:100%;">見つかりませんでした。</p>`;
            }
            return;
        }

        // 本を表示
        data.items.forEach(item => {
            try {
                const card = createExternalBookCard(item);
                container.appendChild(card);
            } catch (e) {
                console.warn("特定の本の表示スキップ:", e);
            }
        });

        // インデックスを更新（次は20件目から取得）
        searchIndices[genreId] = startIndex + 20;

        // 次の20件がある場合は「もっと見る」ボタンを追加
        if (data.items.length === 20) {
            const loadMoreBtn = document.createElement("button");
            loadMoreBtn.className = "search-load-more-btn";
            loadMoreBtn.textContent = "もっと見る (Webからさらに検索)";
            
            // デザインを既存の「もっと見る」ボタンと統一
            loadMoreBtn.style.cssText = `
                display: block;
                margin: 30px auto 10px;
                padding: 12px 50px;
                background-color: #fff;
                color: #e67e22;              /* 検索結果なのでオレンジ系に */
                border: 2px solid #e67e22;
                border-radius: 30px;
                cursor: pointer;
                font-weight: bold;
                font-size: 15px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 10px rgba(230, 126, 34, 0.2);
            `;
            
            loadMoreBtn.onmouseover = () => {
                loadMoreBtn.style.background = "#e67e22";
                loadMoreBtn.style.color = "#fff";
                loadMoreBtn.style.transform = "translateY(-2px)";
            };
            loadMoreBtn.onmouseout = () => {
                loadMoreBtn.style.background = "#fff";
                loadMoreBtn.style.color = "#e67e22";
                loadMoreBtn.style.transform = "translateY(0)";
            };

            loadMoreBtn.onclick = () => searchExternalBooks(genreId, keyword, true);
            container.appendChild(loadMoreBtn);
        }

    } catch (err) {
        console.error(err);
        if (!isLoadMore) {
            container.innerHTML = `<p style="padding:20px; color:red; text-align:center; width:100%;">エラーが発生しました。</p>`;
        }
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

  // 検索用に先頭の著者のみを抽出
  const firstAuthor = (info.authors && info.authors.length > 0) ? info.authors[0] : "";
  const searchQuery = `${title} ${firstAuthor}`;
  const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchQuery.trim())}`;
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

async function handleVote(book, points, cardElement, currentDisplayType = 'score') {
    const storageKey = `voted_${book.id}`;
    if (localStorage.getItem(storageKey)) {
        console.log("すでに投票済みのためスキップしました");
        return;
    }
  
    try {
        localStorage.setItem(storageKey, "true");
  
        // ▼▼▼ シェア用URLの作成 ▼▼▼
        const shareText = `『${book.title}』に投票しました！ (+${points}点)\n現在のスコアをチェック 👇 #BookRee`;
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.href)}`;
  
        const ratingArea = cardElement.querySelector(".rating-area");
        if (ratingArea) {
            // ▼▼▼ 修正: テキストだけでなく、シェアボタンも横に並べて表示 ▼▼▼
            ratingArea.innerHTML = `
              <div style="display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 0;">
                  <span style="color:#7f8c8d; font-weight:bold;">投票済み (+${points})</span>
                  <a href="${shareUrl}" target="_blank" rel="noopener noreferrer" 
                     style="background-color:#000; color:#fff; text-decoration:none; padding:4px 10px; border-radius:15px; font-size:11px; display:flex; align-items:center; gap:4px; transition: opacity 0.3s;">
                     <span style="font-style:normal; font-weight:bold;">𝕏</span> でシェア
                  </a>
              </div>`;
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
  
        const bookRef = doc(db, "books", book.id);
        await updateDoc(bookRef, {
            score: increment(scoreIncrement),
            raw_score: increment(rawIncrement),
        });
  
        if (book && book.mainGenre && window.logGenreVote) {
            window.logGenreVote(book.mainGenre);
        }
  
    } catch (error) {
        console.error("投票エラー:", error);
        alert("通信エラーが発生しました。もう一度お試しください。");
        localStorage.removeItem(storageKey);
    }
  }
  
// OpenBDのデータ + 本のタイトルを受け取り、最適な target / genre を返す
function determineSmartGenre(openBdData, title) {
    let cCode = null;
    let target = ['general']; // デフォルト
    let mainGenre = 'general';

    if (openBdData && openBdData.summary && openBdData.summary.c_code) {
        cCode = openBdData.summary.c_code;
    }

    if (!cCode && openBdData && openBdData.onix && openBdData.onix.DescriptiveDetail && 
        openBdData.onix.DescriptiveDetail.ProductClassification) {
        const pc = openBdData.onix.DescriptiveDetail.ProductClassification;
        const found = pc.find(x => x.ProductClassificationType === '04'); 
        if (found && found.ProductClassificationCode) {
            cCode = found.ProductClassificationCode;
        }
    }

    if (cCode) {
        const first = cCode.charAt(0);
        const second = cCode.charAt(1);

        if (first === '6' || first === '7') mainGenre = 'study'; 
        else if (first === '8') mainGenre = 'children';        
        else if (first === '2') mainGenre = 'hobby';           
        else if (first === '1' || first === '9') mainGenre = 'literature'; 
        else if (first === '3') mainGenre = 'business';        
        else if (first === '4' || first === '5') mainGenre = 'specialized'; 
        else mainGenre = 'general';

        switch (second) {
            case '1': target = ['univ_general']; break; 
            case '2': target = ['elementary']; break;            
            case '3': target = ['junior_high']; break;           
            case '4': target = ['high_school']; break;           
            case '5': target = ['univ_general']; break; 
            case '6': target = ['univ_general']; break;               
            case '0': target = ['univ_general']; break;               
            default: target = ['univ_general'];
        }
    }

    const text = (title || "").toLowerCase();
    
    const allHighSchoolWords = Object.values(SUBJECT_KEYWORDS.high_school).flat();

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
        "古文", "漢文", "物理基礎", "化学基礎", "生物基礎", "地学基礎", "数i", "数ii", "数iii", "数a", "数b", "数c", "マドンナ古文", "ゴロゴ",
        ...allHighSchoolWords
    ];

    if (HS_KEYWORDS.some(k => text.includes(k.toLowerCase()))) {
        return { target: ['high_school'], genre: 'study', cCode: cCode };
    }

    if (text.includes("中学") || text.includes("高校入試") || text.includes("中1") || text.includes("中2") || text.includes("中3")) {
        return { target: ['junior_high'], genre: 'study', cCode: cCode };
    }

    if (text.includes("小学") || text.includes("中学入試") || text.includes("中学受験") || text.includes("絵本") || text.includes("図鑑") || text.includes("児童") || text.includes("こども")) {
        if (text.includes("入試") || text.includes("受験") || text.includes("ドリル")) {
            return { target: ['elementary'], genre: 'study', cCode: cCode };
        }
        return { target: ['elementary'], genre: 'children', cCode: cCode };
    }
    
    if (text.includes("大学") || text.includes("論文") || text.includes("研究") || text.includes("学会")) {
        return { target: ['univ_general'], genre: 'specialized', cCode: cCode };
    }

    if (cCode) {
        return { target: target, genre: mainGenre, cCode: cCode };
    }

    return null;
}

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

    // ▼▼▼ シェア用URLの作成 ▼▼▼
    const shareText = `『${title}』を見つけて投票しました！ (+${points}点)\nみんなのおすすめ本ランキング #BookRee`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.href)}`;

    const ratingArea = cardElement.querySelector(".rating-area");
    if (ratingArea) {
        const msg = isBonus ? `Thanks! (+${weightedPoints}) 🏆` : `Thanks! (+${rawPoints})`;
        // ▼▼▼ 修正: こちらもシェアボタンを追加 ▼▼▼
        ratingArea.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 0;">
                <span style="color:#e67e22; font-weight:bold;">${msg}</span>
                <a href="${shareUrl}" target="_blank" rel="noopener noreferrer" 
                   style="background-color:#000; color:#fff; text-decoration:none; padding:4px 10px; border-radius:15px; font-size:11px; display:flex; align-items:center; gap:4px;">
                   <span style="font-style:normal; font-weight:bold;">𝕏</span> でシェア
                </a>
            </div>`;
        
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
  
        const struct = analyzeBookStructure(info);
        let finalGenre = struct.mainGenre;
        let finalTarget = struct.target;
        let finalCCode = null;
  
        const pDate = info.publishedDate || "";
        let pYear = null;
        if (pDate.length >= 4) {
            const y = parseInt(pDate.substring(0, 4));
            if (!isNaN(y)) pYear = y;
        }
  
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
  
        // --- 追加：詳細な科目判定 ---
        let finalSubGenres = struct.subGenres;
        if (finalGenre === 'study') {
            for (const t of finalTarget) {
                const detected = detectSubGenre(title, info.description || "", t);
                if (detected.length > 0) {
                    finalSubGenres = detected;
                    break; 
                }
            }
        }

        if (!isMerge) {
            Object.assign(updateData, {
                authors: info.authors || ["著者不明"],
                description: info.description || "",
                image: info.imageLinks?.thumbnail || "",
                categories: info.categories || [],
                
                publishedDate: pDate,
                publishedYear: pYear,
                
                mainGenre: finalGenre,
                target: finalTarget,
                subGenres: finalSubGenres, 
                cCode: finalCCode || null,
                
                genres: [finalGenre, ...finalSubGenres],
                targetGenres: finalTarget, 
                votedUsers: []
            });
        }
  
        await setDoc(docRef, updateData, { merge: true });
        console.log(`投票完了: ${title}`);
  
        if (window.logGenreVote && finalGenre) {
            window.logGenreVote(finalGenre);
        }
  
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

  for (const [key, val] of Object.entries(API_SUBGENRE_MAP)) {
      if (apiCats.includes(key)) {
          subs.add(val);
      }
  }
  if (fullText.includes("ミステリー") || fullText.includes("推理")) subs.add("mystery");
  if (fullText.includes("ファンタジー")) subs.add("fantasy");
  if (fullText.includes("歴史") || fullText.includes("時代")) subs.add("history");

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

/**
 * 2026年セクション専用のセットアップ関数（ページネーション対応版）
 */
function setup2026Section() {
    const sectionId = '2026';
    const listElement = document.getElementById(`list-${sectionId}`);
    if (!listElement) return;
  
    let unsubscribe = null;
  
    const fetchAndRender = () => {
        if (unsubscribe) unsubscribe();
  
        const container = document.getElementById(`list-${sectionId}`);
        // 初回ロード時のみ「読み込み中」
        if(container && container.childElementCount === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center;">読み込み中...</p>';
        }
  
        const sortField = currentRankingTypes[sectionId] || 'score';
        const filterEl = document.getElementById(`filter-${sectionId}`);
        const selectedGenre = filterEl ? filterEl.value : 'all';

        const constraints = [];
        constraints.push(where("publishedYear", "in", [2025, 2026]));
        
        if (selectedGenre !== 'all') {
            constraints.push(where("mainGenre", "==", selectedGenre));
        }

        constraints.push(orderBy(sortField, "desc"));
        
        // ★動的なリミット設定
        const limitCount = currentLimits[sectionId] || 20;
        constraints.push(limit(limitCount));
  
        const q = query(collection(db, "books"), ...constraints);
  
        unsubscribe = onSnapshot(q, (snapshot) => {
            const books = [];
            snapshot.forEach(doc => {
                books.push({ id: doc.id, ...doc.data() });
            });
            
            loadedBooks[sectionId] = books;
            applyLocalFilter(sectionId);
            
        }, (error) => {
            console.error("Firebase Error (2026):", error);
            const container = document.getElementById(`list-${sectionId}`);
            if(error.code === 'failed-precondition') {
               const msg = "【管理者用メッセージ】<br>インデックスが必要です。コンソールを確認してください。";
               if(container) container.innerHTML = `<p style="padding:20px; color:red; text-align:center; font-weight:bold;">${msg}</p>`;
            } else {
               if(container) container.innerHTML = '<p style="padding:20px; text-align:center;">エラーが発生しました。</p>';
            }
        });
    };
  
    fetchAndRender();
  
    // --- イベントリスナー設定 ---
    
    const rankingTypeSelect = document.getElementById(`ranking-type-${sectionId}`);
    if (rankingTypeSelect) {
        rankingTypeSelect.addEventListener("change", (e) => {
            currentRankingTypes[sectionId] = e.target.value;
            isWebSearching[sectionId] = false;
            currentLimits[sectionId] = 20; // リセット
            fetchAndRender(); 
        });
    }
  
    const filterSelect = document.getElementById(`filter-${sectionId}`);
    if (filterSelect) {
        filterSelect.addEventListener("change", () => {
            currentLimits[sectionId] = 20; // リセット
            fetchAndRender();
        });
    }

    const limitSelect = document.getElementById(`chart-limit-${sectionId}`);
    if (limitSelect) {
        limitSelect.addEventListener("change", () => {
            applyLocalFilter(sectionId);
        });
    }
  
    const searchInput = document.getElementById(`search-${sectionId}`);
    const searchBtn = document.getElementById(`btn-search-${sectionId}`);
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            isWebSearching[sectionId] = false;
            applyLocalFilter(sectionId);
        });
        searchInput.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
                const keyword = searchInput.value.trim();
                if (keyword) {
                    e.preventDefault();
                    await searchExternalBooks(sectionId, keyword);
                }
            }
        });
        if (searchBtn) {
            searchBtn.addEventListener("click", async () => {
                const keyword = searchInput.value.trim();
                if (keyword) await searchExternalBooks(sectionId, keyword);
            });
        }
    }

    // ★「もっと見る」ボタンの処理 (2026年専用)
    listElement.dataset.genreId = sectionId;
    listElement.loadMore = () => {
        currentLimits[sectionId] += 20;
        fetchAndRender();
    };
}

async function loadFeaturedBook() {
    const section = document.getElementById("featured-section");
    if (!section) return;
    
    try {
        const configSnap = await getDoc(doc(db, "config", "featured_book"));
        
        if (!configSnap.exists()) return; 
        
        const configData = configSnap.data();
        const bookId = configData.book_id;
        
        if (!bookId) return;

        const bookSnap = await getDoc(doc(db, "books", bookId));
        
        if (bookSnap.exists()) {
            const book = bookSnap.data();
            const firstAuthor = (book.authors && book.authors.length > 0) ? book.authors[0] : (book.author || "");            
            const searchQuery = `${book.title} ${firstAuthor}`.trim();

            section.innerHTML = `
                <div class="featured-label">★ 今月のピックアップ</div>
                <div style="display: flex; gap: 15px; align-items: flex-start;">
                    <img src="${book.image || 'https://via.placeholder.com/100x140?text=No+Image'}" 
                         style="width: 80px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); object-fit: cover;">
                    <div>
                        <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #2c3e50;">${book.title}</h3>
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #555;">
                            ${book.authors ? book.authors.join(", ") : "著者不明"}
                        </p>
                        <a href="https://www.amazon.co.jp/s?k=${encodeURIComponent(searchQuery.trim())}" target="_blank"                            onclick="trackClick('${bookId}')"
                           style="background: #27ae60; color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: bold; display: inline-block;">
                           Amazonで見る ↗
                        </a>
                    </div>
                </div>
            `;
            section.style.display = "block"; 
        }
        
    } catch (e) {
        console.error("おすすめ本の読み込みに失敗:", e);
    }
}

function getTodayStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
}

async function trackPageLoad() {
    try {
        const globalStatsRef = doc(db, "stats", "global");
        await setDoc(globalStatsRef, {
            page_views: increment(1)
        }, { merge: true });
        
        const todayStr = getTodayStr(); 
        const dailyRef = doc(db, "daily_stats", todayStr);

        await setDoc(dailyRef, {
            pv: increment(1),
            date: todayStr 
        }, { merge: true });
        
        console.log(`PV counted for: ${todayStr}`);

    } catch (e) {
        console.error("Error tracking page view: ", e);
    }
}
