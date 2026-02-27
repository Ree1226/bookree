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
  addDoc,
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
const charts = {}; 

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
    univ_general: {
        career_up: ["TOEIC", "TOEFL", "IELTS", "英検", "大学英語","資格試験", "宅建", "簿記", "FP", "ITパスポート","公務員試験", "SPI", "就職活動", "適性検査", "資格"],
        relearning: ["学び直し", "算数", "数学", "国語", "適性検査", "微分積分", "線形代数", "統計学", "大学数学"],
        liberal_arts: ["教養", "常識", "雑学"],
    },
    high_school: {
        modern_japanese: ["現代文", "金の漢字", "日本文法"],
        classic_japanese: ["古文", "古典文法"],
        chinese_classics: ["漢文"],
        math_ia: ["数学I" /*アルファベットのアイ*/, "数学Ⅰ" /*ローマ数字（1文字）*/, '数学A', "数Ⅰ", "数I", '数A', '数学1'],
        math_iib: ["数学II" /*アルファベットのアイ2つ*/, "数学Ⅱ" /*ローマ数字（1文字）*/, "数学B", "数Ⅱ", "数II", "数B", "数学2"],
        math_iiic: ["数学III" /*アルファベットのアイ3つ*/, "数学Ⅲ" /*ローマ数字（1文字）*/, "数学C", "数Ⅲ", "数III", "数C", "数学3"],
        english: ["英語", "英単語", "英文法", "English", "NextStage", "Next Stage", "ネクステ", "Vintage"],
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

// --- ：科目判定ロジック ---
function detectSubGenre(title, description, target) {
    const text = (title + " " + (description || "")).toLowerCase();
    const subjects = SUBJECT_KEYWORDS[target];
    if (!subjects) return [];

    let allMatches = [];

    // 1. まず、すべての科目のすべてのキーワードについて、出現位置（開始・終了）をすべて記録する
    for (const [subId, keywords] of Object.entries(subjects)) {
        for (const k of keywords) {
            const keywordLower = k.toLowerCase();
            let pos = text.indexOf(keywordLower);
            while (pos !== -1) {
                allMatches.push({
                    subId: subId,
                    start: pos,
                    end: pos + keywordLower.length,
                    length: keywordLower.length
                });
                // 同じ単語が複数回出てくる場合のために次を探す
                pos = text.indexOf(keywordLower, pos + 1);
            }
        }
    }

    // 2. 包含関係をチェックして、他の長い単語の一部になっているものを排除する
    const filteredMatches = allMatches.filter((m1, i1) => {
        // m1 が他のマッチ m2 に完全に包まれているかチェック
        const isSubset = allMatches.some((m2, i2) => {
            if (i1 === i2) return false;
            // m1がm2の範囲内に完全に収まっており、かつm2の方が長い（または同じ長さで別物）場合
            const contained = m2.start <= m1.start && m2.end >= m1.end;
            const m2IsBetter = m2.length > m1.length || (m2.length === m1.length && i2 < i1);
            return contained && m2IsBetter;
        });
        return !isSubset;
    });

    // 3. 残ったマッチから subId を取り出し、重複を削って返す
    return [...new Set(filteredMatches.map(m => m.subId))];
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
  "本屋大賞", "直木賞", "芥川賞","山本周五郎賞", "吉川英治文学賞", "吉川英治文学新人賞", "柴田錬三郎賞",
  "江戸川乱歩賞", "日本推理作家協会賞", "このミステリーがすごい", "星雲賞","三島由紀夫賞", "野間文芸新人賞",
  "映画化", "ドラマ化", "アニメ化", "実写化", "ベストセラー", "万部突破"
];
const MISSING_DATA_PATCH_LIST = [
    // 直木賞受賞作
    "ツミデミック","藍を継ぐ海", "八月の御所グラウンド", "少年と犬", "銀河鉄道の父", 
    "月の満ち欠け","バリ山行","破門","恋歌", "昭和の犬","地図と拳", "しろがねの葉", 
    "ともぐい","サラバ！上","容疑者Xの献身","鉄道員（ぽっぽや）","鶴八鶴次郎",
    "カフェーの帰還","ファーストラヴ","きりはずへ","虚の伽藍", "令和元年の人生ゲーム",
    "飽くなき風景","ラウリ・クースクを探し",

    // 芥川賞受賞作
    "サンショウウオの四十九日","東京都同情塔","ハンチバック","この世の喜びよ","荒地の家族",
    "おいしいごはんが食べられますように","ブラックボックス","彼岸花が咲く島","貝に続く場所にて",
    "推し、燃ゆ","首里の馬","破局","背高泡立草","むらさきのスカートの女","1R1分34秒",
    "ニムロッド","送り火","おらおらでひとりいぐも","百年泥","影裏","しんせかい","コンビニ人間",
    "異類婚姻譚","死んでいない者","火花","スクラップ・アンド・ビルド","九年前の祈り","穴","爪と目",
    "abさんご","冥土めぐり","共喰い","道化師の蝶","きことわ","乙女の密告","終の住処","ポトスライムの舟",
    "乳と卵","蹴りたい背中","蛇にピアス","パーク・ライフ","猛スピードで母は","土の中の子供",
    "八月の路上に捨てる","アサッテの人","苦役列車","ハリガネムシ","ポトスライムの舟","夏の終り",
    "裸の王様","飼育",

    // 本屋大賞受賞作
    "カフネ","成瀬は天下を取りにいく","君のクイズ","汝、星のごとく","同志少女よ、敵を撃て",
    "52ヘルツのクジラたち","流浪の月","そして、バトンは渡された","かがみの孤城","蜜蜂と遠雷",
    "羊と鋼の森","鹿の王","村上海賊の娘","海賊とよばれた男","舟を編む","謎解きはディナーのあとで","天地明察",
    "告白","ゴールデンスランバー","夜は短し歩けよ乙女","東京タワー オカンとボクと、時々、オトン",
    "夜のピクニック","博士の愛した数式","本日は、お日柄もよく","アルプス席の母","禁忌の子",
    "盤上の向日葵","屍人荘の殺人","たゆたえども沈まず","AX アックス","ライオンのおやつ","線は、僕を描く",
    "熱源","ノースライト","medium 霊媒探偵城塚翡翠","夏物語","フーガはユーガ","騙し絵の牙",
    "コーヒーが冷めないうちに","君の膵臓をたべたい","火花","サラバ！","満願","ソロモンの偽証","教場",
    "ジェノサイド","くちびるに歌を","植物図鑑","神様のカルテ","告白","終戦のローレライ",

    // 山本周五郎賞受賞作
    "木挽町のあだ討ち","地雷グリコ","君のクイズ","地図と拳","おもかげ","テスカトリポカ",
    "八月の御所グラウンド","ザ・ロイヤルファミリー","熱源","平場の月","本と鍵の季節","ファーストラヴ",
    "ゲームの王国","みかづき","罪の声","湖畔の愛","花まんま","さざなみの国","満願","ホテルローヤル",
    "わたしたちが光の速さで進めないなら","永遠の仔","残穢","ふがいない僕は空を見た","楽園のカンヴァス",
    "後悔と真実の色","光","キケン","ランウェイ☆ビート","私の男","紙の月","凍える牙","五年間の梅",
    "白い薔薇の淵まで","パレード","対岸の彼女","空中ブランコ","容疑者Xの献身","鉄道員（ぽっぽや）",
    "理由","悼む人","柘榴","テルマエ・ロマエ","告白","夜のピクニック","ゴールデンスランバー",
    "鍵のない夢を見る","夢を売る男","火車","孤宿の人","流星ワゴン","流","夜行","まほろ駅前多田便利軒",
    "八日目の蝉","ダイブ!!","永遠のゼロ","のぼうの城","蜩ノ記","東京タワー オカンとボクと、時々、オトン",
    "博士の愛した数式","重力ピエロ","告白","夜は短し歩けよ乙女",

    // 吉川英治文学賞受賞作
    "悪逆","燕は戻ってこない","遠巷説百物語","黒牢城","渦 妹背山婦女庭訓 魂結び","孤鷹の天","幻の山",
    "満願","破裂","駆込み女と駆出し男","ふがいない僕は空を見た","鍵のない夢を見る","テルマエ・ロマエ",
    "告白","永遠の仔","容疑者Xの献身","楽園のカンヴァス","鉄道員（ぽっぽや）","博士の愛した数式",
    "夜のピクニック","理由","重力ピエロ","孤宿の人","火車","永遠のゼロ","蜩ノ記","のぼうの城","ダイブ!!",
    "流星ワゴン","まほろ駅前多田便利軒","八日目の蝉","夢を売る男","ゴールデンスランバー","夜は短し歩けよ乙女",

    // 吉川英治文学新人賞受賞作
    "リラの咲くけものみち","おんなの女房","スモールワールズ","残月記","風よ あらしよ","オルタネート",
    "愛されなくても別に","同志少女よ、敵を撃て","本と鍵の季節","ファーストラヴ","熱源","平場の月",
    "星を掬う","盤上の向日葵","罪の声","みかづき","湖畔の愛","花まんま","さざなみの国","満願",
    "ホテルローヤル","わたしたちが光の速さで進めないなら","永遠の仔","残穢","ふがいない僕は空を見た",
    "楽園のカンヴァス","後悔と真実の色","光","キケン","ランウェイ☆ビート","私の男","紙の月","凍える牙",
    "五年間の梅","白い薔薇の淵まで","パレード","対岸の彼女","空中ブランコ","容疑者Xの献身","鉄道員（ぽっぽや）",
    "理由","悼む人","柘榴","テルマエ・ロマエ","告白","夜のピクニック","ゴールデンスランバー","鍵のない夢を見る",
    "夢を売る男","火車","孤宿の人","流星ワゴン","流","夜行","まほろ駅前多田便利軒","八日目の蝉","ダイブ!!",
    "永遠のゼロ","のぼうの城","蜩ノ記","東京タワー オカンとボクと、時々、オトン","博士の愛した数式",
    "重力ピエロ","夜は短し歩けよ乙女","竜の眠る浜辺","絆の聖域","カフネ","花の鎖","プリズム","方舟",
    "ラブカは静かに弓を持つ","君、星のごとく","花咲く街の少女たち","飽くことなき風景","箱庭クロニクル",

    // 柴田錬三郎賞受賞作
    "かたづの！","別れてのちの恋歌","神々の山嶺","蝶のゆくえ","破軍の星","戦鬼たちの海","かかし長屋",
    "機関車先生","逃亡","幽玄F","破軍の星","戦鬼たちの海","かかし長屋","機関車先生","流","薔薇忌",
    "蝶のゆくえ","虹の彼方へ","猫背の聖母","破裂","罪の声","満願","ホテルローヤル","楽園のカンヴァス",
    "白い薔薇の淵まで","パレード","対岸の彼女","空中ブランコ","容疑者Xの献身","鉄道員（ぽっぽや）","理由",
    "悼む人","柘榴","テルマエ・ロマエ","告白","夜のピクニック","ゴールデンスランバー","鍵のない夢を見る",
    "夢を売る男","火車","孤宿の人","流星ワゴン","夜行","まほろ駅前多田便利軒","八日目の蝉","ダイブ!!","永遠のゼロ",
    "のぼうの城","蜩ノ記","東京タワー オカンとボクと、時々、オトン","博士の愛した数式","重力ピエロ","夜は短し歩けよ乙女",

    // 江戸川乱歩賞受賞作
    "猫は知っていた","濡れた心","危険な関係","孤独なアスファルト","枯草の根","影の地帯","孤島の墓標","蟻の木の下で",
    "越後つつじ","黄金の指","伯林・一九八八年","高層の死角","殺意の演奏","蝶たちは今…","アルキメデスは手を汚さない",
    "暗黒告知","五万キロの死角","ぼくらの時代","毟り取られた翼","猿丸幻視行","原子炉の蟹","焦茶色のパステル","写楽殺人事件",
    "天女の末裔","放課後","花園の迷宮","湿地帯","凍れる瞳","浅草エノケン一座の嵐","剣の道殺人事件","黄金の牙","白く長い廊下",
    "顔のない肖像画","検察捜査","テロリストのパラソル","左手に告げるなかれ","虚線のマリス","果つる底なき","脳男","13階段",
    "滅びの笛","翳りゆく夏","天使のナイフ","三年坂 火の夢","沈めるさかな","誘拐児","再会","プリズン・トリック","完盗オンサイト",
    "襲名犯","闇に香る嘘","道徳の時間","QJKJQ","到達不能点","ノワールをまとう女","老虎残夢","此の世の果ての殺人","蒼天の鳥",

    // 日本推理作家協会賞受賞作
    "本陣殺人事件","新月","不連続殺人事件","宝石泥棒","破戒裁判","天狗","黒いトランク","死せる者よ","日本脱出","憎悪の化石",
    "献身","黒い白鳥","歪んだ空白","黒の試走車","ある作家の死","影の告発","天使の墓","危険な遊戯","虚無への供物","蒼いざんげ",
    "華やかな喪服","白い牙","夜の終る時","百舌の叫ぶ夜","悪魔が来りて笛を吹く","天国と地獄","殺意の風景","幻の殺意","Dの複合",
    "黒い福音","日本沈没","化石の荒野","悪霊の島","死者の学園祭","誘拐報道","誤判","深夜の博覧会","天城越え","モーツァルトは子守唄を歌わない",
    "殺人方程式","花嫁は二度眠る","カディスの赤い星","風の探偵","夜は短し歩けよ乙女","君のクイズ","夜の道標","地雷グリコ",
    "ナイトランド","君のクイズ",

    // このミステリーがすごい賞受賞作
    "四日間（よっかかん）の奇蹟（きせき）","そのケータイはXX（エクスクロス）で","チーム・バチスタの栄光","さよならドビュッシー",
    "完全なる首長竜の日","警視庁捜査二課・郷間彩香 特命指揮官","一千兆円の身代金","龍神の雨","凍てつく太陽",
    "珈琲店タレーランの事件簿 また会えたなら、あなたの淹れた珈琲を","スマホを落としただけなのに","おもかげ","怪物の木こり",
    "名探偵のままでいて","ファラオの密室","謎の香りはパン屋から","最後の皇帝と謎解きを","龍犬城の絶対者（仮）",

    // 星雲賞受賞作
    "霊長類南へ","継ぐのは誰か?","果てしなき流れの果に","宇宙のランデブー","日本沈没","おれの宇宙船","地球0年",
    "火星の砂","パラレルワールド大戦争","地球へ…","吉里吉里人","敵は海賊・海賊版","さよなら、ジュピター","戦闘妖精・雪風",
    "ダーティペアの大逆転","レモンパイ、お屋敷横町ゼロ番地","星界の紋章","ハーモニー","ハイペリオン","ハイペリオンの没落",
    "バビロンまでは何光年?","叛逆航路","メカ・サムライ・エンパイア","システム・クラッシュ マーダーボット・ダイアリー",

    // 三島由紀夫賞受賞作
    "優雅で感傷的な日本野球","黄昏のストーム・シーディング","世紀末鯨鯢記","アウシュヴィッツの絞首台","塩壺の匙","日本の家郷",
    "緑色の濁ったお茶あるいは幸福の散歩道","二百回忌","カブールの園","君たちが大学を辞めていった本当の理由","家族シネマ",
    "水中の蜂","砂漠の船","無限の子供","聖水","真夜中のミサ","日蝕","きことわ","顔","阿弥陀","プラナリア","熊の敷石",
    "地獄","切断","わたしのマトカ","指の骨","ポルノグラフィア","私という運命について","開墾地","文子の四季","その後の世界",
    "星の王子さま","まどろむ島","私をくいとめて","かか","穴とけむり","すばらしい新世界","橘の家",

    // 野間文芸新人賞受賞作
    "僕が語りはじめた彼は","黒い旅","家族の肖像","光抱く人","海の向こうで","家族の光","死の舟","海峡","家族ゲーム","夢の樹",
    "夜の動物園","背中の眼","なにもしてない","ア・ルース・ボーイ","真昼の星","星条旗の聞こえない部屋","海の百合","蛇を踏む",
    "家族の庭","冷静と情熱のあいだ","聖なる怠け者の冒険","家族狩り","永遠の森","脳髄工場","幻冬","アブラクサスの祭","聖職者",
    "パレード","蹴りたい背中","好き好き大好き超愛してる。","最後の息子","廃用身","指の骨","グランド・フィナーレ","私の男",
    "烏有此譚","寝ても覚めても","ぬるい毒","螺法四千年記","むらさきのスカートの女","冥土めぐり","火花","コンビニ人間","異類婚姻譚",
    "空に住む","最高の存在","破局","彼岸花が咲く島","地獄と天国","遠い太鼓","人間に聞く","月ぬ走いや、馬ぬ走い"
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

    // Firebaseからデータを取得・描画する内部関数
    const fetchAndRender = () => {
        if (unsubscribe) unsubscribe();

        const container = document.getElementById(`list-${genreId}`);
        if(container && container.childElementCount === 0) {
            container.innerHTML = '<p style="padding:20px; text-align:center;">読み込み中...</p>';
        }

        const sortField = currentRankingTypes[genreId] || 'score';
        const constraints = [];
        constraints.push(where("isExcluded", "==", false)); 
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
  const errorMsg = document.getElementById(`search-error-${genreId}`); // エラーメッセージ要素を取得

  if (searchInput) {
      searchInput.addEventListener("input", () => {
          const keyword = searchInput.value.trim(); 
          
          // 1. 不適切ワードチェック
          const isSafe = isSafeText(keyword);

          if (!isSafe) {
              // --- 不適切なワードが含まれている場合 ---
              if (errorMsg) errorMsg.style.display = "block"; // メッセージ表示
              if (searchBtn) searchBtn.disabled = true;       // ボタンを無効化
              searchInput.style.borderColor = "#ff4d4f";     // 枠線を赤くする
              
              // グラフのハイライトは消去する
              highlightChartItems(genreId, "");
              return; 
          } else {
              // --- 安全な場合（または空文字の場合） ---
              if (errorMsg) errorMsg.style.display = "none";  // メッセージ非表示
              if (searchBtn) searchBtn.disabled = false;      // ボタンを有効化
              searchInput.style.borderColor = "";            // 枠線を元に戻す
          }

          // 2. 通常の処理（安全な場合のみ実行）
          isWebSearching[genreId] = false;
          applyLocalFilter(genreId);
          highlightChartItems(genreId, keyword);
      });

      // Enterキー押下時の処理
      searchInput.addEventListener("keydown", async (e) => {
          if (e.isComposing) return;
          if (e.key === "Enter") {
              const keyword = searchInput.value.trim();
              // 安全かつ文字が入っている場合のみ外部検索を実行
              if (keyword && isSafeText(keyword)) {
                  e.preventDefault();
                  await searchExternalBooks(genreId, keyword);
              }
          }
      });

      // 検索ボタンクリック時の処理
      if (searchBtn) {
          searchBtn.addEventListener("click", async () => {
              const keyword = searchInput.value.trim();
              // 安全かつ文字が入っている場合のみ外部検索を実行
              if (keyword && isSafeText(keyword)) {
                  await searchExternalBooks(genreId, keyword);
              }
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

/**
 * グラフの棒をハイライトする関数（ソート順同期・著者名検索強化版）
 */
function highlightChartItems(genreId, str) {
    const chart = chartInstances[genreId]; 
    if (!chart) return;

    const normalizedKeyword = normalizeText(str.trim());
    
    let books = [...(loadedBooks[genreId] || [])];
    if (books.length === 0) return;

    books.sort((a, b) => (b.score || 0) - (a.score || 0));

    const limitEl = document.getElementById(`chart-limit-${genreId}`);
    const displayCount = limitEl ? parseInt(limitEl.value, 10) : 10;
    const topBooks = books.slice(0, displayCount);

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

    const backgroundColors = topBooks.map((book) => {
        if (!normalizedKeyword) return `rgba(${themeRGB}, 0.7)`;

        const title = book.title || "";
        
        // 【修正ポイント】著者名を取得し、もし配列なら文字列に変換する
        let authorData = book.author || book.authors || book.author_name || book.writer || "";
        
        // もし authorData が配列（['著者名']）なら、カンマ区切りの文字列に変換
        if (Array.isArray(authorData)) {
            authorData = authorData.join(', ');
        }

        const normalizedTitle = normalizeText(String(title));
        const normalizedAuthor = normalizeText(String(authorData));

        // タイトルまたは著者名にキーワードが含まれているか
        const isMatch = normalizedTitle.includes(normalizedKeyword) || 
                        normalizedAuthor.includes(normalizedKeyword);

        return isMatch ? `rgba(${themeRGB}, 1)` : `rgba(${themeRGB}, 0.15)`;
    });

    chart.data.datasets[0].backgroundColor = backgroundColors;
    chart.update('none'); 
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

/**
 * 文字列を検索用に正規化する共通関数
 * 1. 大文字 -> 小文字
 * 2. 全角英数字 -> 半角英数字
 * 3. カタカナ -> ひらがな
 */
function normalizeText(str) {
    if (!str) return "";
    return str
        .toLowerCase()
        // 全角英数字・記号を半角に変換
        .replace(/[！-～]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
        })
        // カタカナをひらがなに変換
        .replace(/[\u30a1-\u30f6]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0x60);
        })
        .trim();
}

function filterByText(genreId, books) {
    const searchEl = document.getElementById(`search-${genreId}`);
    if (!searchEl) return books;

    // 【修正ポイント1】入力値を正規化（ひらがな化・半角化）
    const searchVal = normalizeText(searchEl.value);
    if (searchVal === "") return books;

    return books.filter(b => {
        // 【修正ポイント2】本のタイトルを正規化
        const title = normalizeText(b.title || "");

        // 【修正ポイント3】著者名を正規化
        let authorStr = "";
        if (Array.isArray(b.authors)) {
            authorStr = b.authors.join(" ");
        } else if (b.author) {
            authorStr = b.author;
        }
        authorStr = normalizeText(authorStr);

        // 正規化したもの同士で比較
        return title.includes(searchVal) || authorStr.includes(searchVal);
    });
}

// 1. NGワードリストの定義（適宜追加してください）
const BANNED_KEYWORDS = ["不適切ワード1", "不適切ワード2"]; 

// 2. 判定関数の定義
function isSafeText(text) {
    if (!text) return true;
    
    // 以前作成した normalizeText を使って、表記揺れを吸収してチェック
    const normalized = normalizeText(text);
    
    return !BANNED_KEYWORDS.some(word => {
        const normalizedWord = normalizeText(word);
        // 1文字などの短いワードで誤判定しないよう、3文字以上の場合のみ部分一致チェックする等の工夫も可能です
        return normalized.includes(normalizedWord);
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
    // --- 関数の末尾部分 ---
    const searchInput = document.getElementById(`search-${genreId}`);
    const searchBtn = document.getElementById(`btn-search-${genreId}`);
    const errorMsg = document.getElementById(`search-error-${genreId}`);
    
    const currentSearchStr = searchInput ? searchInput.value.trim() : "";

    // 安全性のチェックを行い、UIの状態を同期させる
    if (isSafeText(currentSearchStr)) {
        // 安全な場合
        if (errorMsg) errorMsg.style.display = "none";
        if (searchBtn) searchBtn.disabled = false;
        if (searchInput) searchInput.style.borderColor = "";
        
        highlightChartItems(genreId, currentSearchStr);
    } else {
        // 不適切なワードが含まれている場合
        if (errorMsg) errorMsg.style.display = "block";
        if (searchBtn) searchBtn.disabled = true;
        if (searchInput) searchInput.style.borderColor = "#ff4d4f";
        
        // ハイライトは行わない（クリアする）
        highlightChartItems(genreId, "");
    }
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
        imgUrl = getSecureImageUrl(imgUrl);        
        // 画像読み込みに失敗した場合、自分自身を placeholder に置き換える        
        coverHtml = `            
            <img src="${imgUrl}"                  
            class="book-cover"                  
            alt="${book.title}"                  
            onerror="this.onerror=null; this.outerHTML='<div class=&quot;book-cover-placeholder&quot;>No Image</div>';">        
        `;    
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
    
    if (!isLoadMore) {
        searchIndices[genreId] = 0;
        container.innerHTML = `<p style="padding:20px; text-align:center; width:100%;">🔍 検索中...</p>`;
    } else {
        const oldBtn = container.querySelector('.search-load-more-btn');
        if (oldBtn) {
            oldBtn.textContent = "読み込み中...";
            oldBtn.disabled = true;
        }
    }

    try {
        const startIndex = searchIndices[genreId] || 0;
        const apiKey = "AIzaSyCL88yBdIcEZIh_Zrw-NOmy-QtRCNB0cns"; 
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keyword)}&langRestrict=ja&maxResults=20&startIndex=${startIndex}&maxAllowedMaturityRating=not-mature&key=${apiKey}`);        

        // 【修正ポイント1】レスポンスが正常（200 OK）でない場合の処理
        if (!res.ok) {
            console.error("API Response Error:", res.status);
            if (!isLoadMore) {
                container.innerHTML = `
                    <p style="padding:20px; color:#e67e22; text-align:center; width:100%; line-height:1.6;">
                        現在、検索サーバーが混み合っています。<br>
                        恐れ入りますが、少し時間を置いてから再度お試しください。
                    </p>`;
            } else {
                const oldBtn = container.querySelector('.search-load-more-btn');
                if (oldBtn) {
                    oldBtn.textContent = "混雑のため失敗。もう一度試す";
                    oldBtn.disabled = false;
                }
            }
            return;
        }

        const data = await res.json();

        // 新規検索なら一旦クリア
        if (!isLoadMore) container.innerHTML = ""; 
        
        const oldBtn = container.querySelector('.search-load-more-btn');
        if (oldBtn) oldBtn.remove();

        // 【修正ポイント2】データが空（検索結果ゼロ）の場合の処理
        if (!data.items || data.items.length === 0) {
            if (!isLoadMore) {
                container.innerHTML = `<p style="padding:20px; color:#999; text-align:center; width:100%;">該当する本が見つかりませんでした。</p>`;
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

        searchIndices[genreId] = startIndex + 20;

        if (data.items.length === 20) {
            const loadMoreBtn = document.createElement("button");
            loadMoreBtn.className = "search-load-more-btn";
            loadMoreBtn.textContent = "もっと見る (Webからさらに検索)";
            
            loadMoreBtn.style.cssText = `
                display: block;
                margin: 30px auto 10px;
                padding: 12px 50px;
                background-color: #fff;
                color: #e67e22;
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
            container.innerHTML = `<p style="padding:20px; color:red; text-align:center; width:100%;">通信エラーが発生しました。接続状況を確認してください。</p>`;
        }else {            
            const oldBtn = container.querySelector('.search-load-more-btn');            
            if (oldBtn) {                
                oldBtn.textContent = "通信エラー。もう一度試す";                
                oldBtn.disabled = false;            
            }        
        }
    } finally {
        isWebSearching[genreId] = false;
    }
}

/**
 * 外部検索結果（Google Books）用のカード作成
 * ランキング側の createBookCard と見た目を統一
 */
function createExternalBookCard(item) {
    const div = document.createElement("div");
    div.className = "book-card";

    const info = item.volumeInfo || {};
    const title = info.title || "タイトル不明";
    const authors = info.authors ? info.authors.join(", ") : "著者不明";
    
    let coverHtml = '';
    const imgData = info.imageLinks || {};
    // サムネイルURLを取得。空文字や未定義の場合は placeholder を表示
    let imgUrl = imgData.thumbnail || imgData.smallThumbnail;

    if (imgUrl && imgUrl.trim() !== "") {
        imgUrl = getSecureImageUrl(imgUrl);
        // onerror を使い、読み込みに失敗した場合は要素自体を「No Image」のHTMLに書き換えます
        coverHtml = `
            <img src="${imgUrl}"
                class="book-cover"
                alt="${title}"
                onerror="this.onerror=null; this.outerHTML='<div class=&quot;book-cover-placeholder&quot;>No Image</div>';">
       `;    
    } else {
        // 最初からURLがない場合        
        coverHtml = `<div class="book-cover-placeholder">No Image</div>`;    
    }

    // Amazon検索用
    const firstAuthor = (info.authors && info.authors.length > 0) ? info.authors[0] : "";
    const searchQuery = `${title} ${firstAuthor}`;
    const amazonUrl = `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchQuery.trim())}`;
    const isVoted = localStorage.getItem(`voted_${item.id}`);

    // HTML構造をランキング用カードと統一
    div.innerHTML = `
        <div class="book-item">
            ${coverHtml}
            <div class="book-info">
                <div class="book-title" title="${title}">${title}</div>
                <div class="book-author-text" style="font-size:0.85em; color:#666; margin-bottom:5px;">${authors}</div>
            </div>
        </div>
        
        <!-- Amazonボタンを info の外に出してフル幅に -->
        <a href="${amazonUrl}" target="_blank" class="amazon-link-btn">Amazonで見る</a>

        <div class="rating-area">
            ${isVoted ? 
               `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding:10px 0;">
                    <span style="color:#27ae60; background:#eafaf1; border:1px solid #27ae60; font-weight:bold; padding:4px 8px; border-radius:20px; font-size:11px;">
                      ✔ 投票済
                    </span>
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
            lastUpdated: serverTimestamp()
        });
  
        try {            
            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + 30); 

            const voteLogRef = collection(db, "vote_logs");            
            await addDoc(voteLogRef, {                
                bookId: book.id,                
                title: book.title,                
                mainGenre: book.mainGenre || "other", // ジャンルがない場合のフォールバック                
                points: scoreIncrement,               // ボーナス込みのポイントを記録                
                timestamp: serverTimestamp(),
                expireAt: expireDate            
            });            
            console.log("Trend log recorded for existing book.");        
        } catch (logError) {            
            console.warn("Log recording failed:", logError);        
        }

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

    const shareText = `『${title}』を見つけて投票しました！ (+${points}点)\nみんなのおすすめ本ランキング #BookRee`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.href)}`;

    const ratingArea = cardElement.querySelector(".rating-area");
    if (ratingArea) {
        const msg = isBonus ? `Thanks! (+${weightedPoints}) 🏆` : `Thanks! (+${rawPoints})`;
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
  
        // --- 詳細な科目判定 ---
        let finalSubGenres = struct.subGenres;
        if (finalGenre === 'study') {
            let allDetected = [];
            for (const t of finalTarget) {
                const detected = detectSubGenre(title, info.description || "", t);
                if (detected.length > 0) {
                    allDetected = [...allDetected, ...detected];
                }
            }
            if (allDetected.length > 0) {
                finalSubGenres = [...new Set(allDetected)];
            }
        }

        // ★★★ ここから追加：最終的なメインジャンルの補完ロジック ★★★
        // OpenBDの結果などで finalGenre が 'other' や 'general' になってしまった場合、
        // サブジャンルからメインジャンルを逆引きして上書きする
        if (finalGenre === 'other' || finalGenre === 'general' || !finalGenre) {
            if (finalSubGenres && finalSubGenres.length > 0) {
                const counts = {};
                finalSubGenres.forEach(s => {
                    const m = SUB_TO_MAIN_MAP[s];
                    if (m) counts[m] = (counts[m] || 0) + 1;
                });

                const candidates = Object.keys(counts);
                if (candidates.length > 0) {
                    candidates.sort((a, b) => {
                        // 1. 出現回数が多い順
                        if (counts[b] !== counts[a]) return counts[b] - counts[a];
                        // 2. 回数が同じなら優先度順
                        return MAIN_GENRE_PRIORITY.indexOf(a) - MAIN_GENRE_PRIORITY.indexOf(b);
                    });
                    finalGenre = candidates[0]; // 最も適切なメインジャンルをセット
                }
            }
        }
        // 最終防衛線
        if (!finalGenre) finalGenre = 'other';
        // ★★★ ここまで追加 ★★★

        if (!isMerge) {
            Object.assign(updateData, {
                authors: info.authors || ["著者不明"],
                description: info.description || "",
                image: getSecureImageUrl(info.imageLinks?.thumbnail || ""),
                categories: info.categories || [],
                
                isExcluded: false,
                publishedDate: pDate,
                publishedYear: pYear,
                
                mainGenre: finalGenre,
                target: finalTarget,
                subGenres: finalSubGenres, 
                cCode: finalCCode || null,
                
                genres: [finalGenre, ...finalSubGenres],
                targetGenres: finalTarget, 
                votedUsers: [],
                createdAt: serverTimestamp()
            });
        }
  
        await setDoc(docRef, updateData, { merge: true });

        try {
            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + 30); 

            const voteLogRef = collection(db, "vote_logs");
            await addDoc(voteLogRef, {
                bookId: targetDocId,      // どの本か
                title: title,             // (集計を楽にするためタイトルも保持)
                mainGenre: finalGenre,    // ジャンルごとの集計用
                points: weightedPoints,   // 加算されたポイント
                timestamp: serverTimestamp(), // いつ投票されたか
                expireAt: expireDate 
            });
        } catch (logError) {
            console.warn("Log recording failed:", logError);
        }

        console.log(`投票完了: ${title} (Genre: ${finalGenre})`);
  
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
    // --- 1. ランキングの仕組みモーダル ---
    const rankingModal = document.getElementById("ranking-modal"); 
    // フッターに移動した新しいボタンIDを指定
    const rankingBtn = document.getElementById("rankingRuleBtnFooter");
    const rankingClose = document.getElementById("close-modal");

    if (rankingModal && rankingBtn && rankingClose) {
        rankingBtn.onclick = () => {
            rankingModal.style.display = "block";
        };
        rankingClose.onclick = () => {
            rankingModal.style.display = "none";
        };
    }

    // --- 2. 免責事項モーダル (追加) ---
    const disclaimerModal = document.getElementById("disclaimer-modal");
    const disclaimerBtn = document.getElementById("disclaimerBtn");
    const disclaimerClose = document.getElementById("close-disclaimer");

    if (disclaimerModal && disclaimerBtn && disclaimerClose) {
        disclaimerBtn.onclick = () => {
            disclaimerModal.style.display = "block";
        };
        disclaimerClose.onclick = () => {
            disclaimerModal.style.display = "none";
        };
    }

    // --- 3. 共通：背景クリックで閉じる ---
    window.onclick = (e) => {
        if (e.target == rankingModal) {
            rankingModal.style.display = "none";
        }
        if (e.target == disclaimerModal) {
            disclaimerModal.style.display = "none";
        }
    };
}

// --- 追加：サブジャンルからメインジャンルを特定するための逆引きマップ ---
const SUB_TO_MAIN_MAP = {
    // 文芸 (literature)
    "mystery": "literature", "fantasy": "literature", "romance": "literature", "sf": "literature",
    "history": "literature", "politics": "literature", "horror": "literature", "youth": "literature",
    "human": "literature", "lightnovel": "literature", "manga": "literature",

    // ビジネス (business)
    "management": "business", "marketing": "business", "leadership": "business", "work": "business",
    "finance": "business", "economy": "business", "industry": "business", "data": "business", "career": "business",

    // 趣味・実用 (hobby)
    "cooking": "hobby", "parenting": "hobby", "health": "hobby", "beauty": "hobby", "manners": "hobby",
    "travel": "hobby", "gardening": "hobby", "sports": "hobby", "camera": "hobby", "railway": "hobby", "igo_shogi": "hobby",

    // 専門書 (specialized)
    "humanities": "specialized", "social_science": "specialized", "science_tech": "specialized",
    "medical": "specialized", "art": "specialized", "language": "specialized", "license": "specialized",

    // 児童書 (children)
    "picturebook": "children", "fairytale": "children", "nonfiction": "children", "biography": "children",
    "poem": "children", "study_manga": "children", "zukan": "children",

    // 学習参考書 (study)
    // 高校生
    "modern_japanese": "study", "classic_japanese": "study", "chinese_classics": "study",
    "math_ia": "study", "math_iib": "study", "math_iiic": "study",
    "english": "study", "german": "study", "french": "study", "chinese": "study", "korean": "study",
    "world_history": "study", "japanese_history": "study", "geography": "study",
    "ethics": "study", "politics_economy": "study",
    "chemistry": "study", "physics": "study", "biology": "study", "earth_science": "study",
    "informatics": "study",
    // 大学生・一般
    "career_up": "study", "relearning": "study", "liberal_arts": "study",
    // 中学生
    "japanese_jh": "study", "math_jh": "study", "science_jh": "study", "social_jh": "study", "english_jh": "study",
    // 小学生
    "japanese_elem": "study", "math_elem": "study", "science_elem": "study", "social_elem": "study", "english_elem": "study"
};

// ラノベ判定用レーベルリスト
const LN_LABEL_KEYWORDS = [
    // --- 男性向け・総合 ---
    "電撃文庫", "ファンタジア文庫", "MF文庫J", "角川スニーカー文庫", "GA文庫", 
    "HJ文庫", "オーバーラップ文庫", "講談社ラノベ文庫", "ガガガ文庫", "ダッシュエックス文庫", 
    "ファミ通文庫", "モンスター文庫", "一迅社文庫", "ノベルゼロ",

    // --- 新文芸（単行本ラノベ・WEB小説発） ---
    "GCノベルズ", "カドカワBOOKS", "ヒーロー文庫", "PASH!ブックス", "アース・スターノベル", 
    "ツギクルブックス", "アルファポリス", "TOブックス", "Mノベルス", "SQEXノベル", 
    "モーニングスターブックス", "サーガフォレスト", "レジェンドノベルス",

    // --- 女性向け（乙女系・異世界恋愛） ---
    "ビーズログ文庫", "角川ビーンズ文庫", "ルビー文庫", "コバルト文庫", "アイリス文庫", 
    "一迅社文庫アイリス", "レジーナブックス", "アリアンローズ", "メリッサ", "フェアリーキス", 
    "ジュエルブックス", "乙女ドルチェ",

    // --- ライト文芸（キャラ文芸） ---
    // ※これらを「ラノベ」に含めるかは好みですが、一般的にラノベコーナーに置かれます
    "メディアワークス文庫", "富士見L文庫", "集英社オレンジ文庫", "講談社タイガ", "スカイハイ文庫"
];
// ラノベ判定
function isLightNovel(info) {
    const publisher = info.publisher || "";
    const description = info.description || "";
    const categories = info.categories ? info.categories.join(",") : "";
    const title = info.title || "";

    // 1. 出版社・カテゴリ・説明文・タイトルにレーベル名が含まれているかチェック
    const isLabelMatch = LN_LABEL_KEYWORDS.some(label => 
        publisher.includes(label) || 
        categories.includes(label) || 
        description.includes(label) ||
        title.includes(label)
    );

    if (isLabelMatch) return true;

    // 2. 補助判定：Googleのカテゴリに "Light Novels" が含まれている場合
    if (categories.toLowerCase().includes("light novel")) return true;

    return false;
}

// --- 追加：メインジャンルの優先度（カウントが同数の場合の決選投票用） ---
const MAIN_GENRE_PRIORITY = ['literature', 'business', 'hobby', 'specialized', 'children', 'study'];

function analyzeBookStructure(info) {
    const API_SUBGENRE_MAP = {
        // ■ 文芸 (Literature)
        "mystery": "mystery", "detective": "mystery", "crime": "mystery",
        "fantasy": "fantasy", "magic": "fantasy",
        "romance": "romance", "love": "romance",
        "science fiction": "sf", "space": "sf",
        "history": "history", "historical": "history",
        "political science": "politics", "politics": "politics",
        "horror": "horror",
        "juvenile fiction": "youth", // 青春・ヤングアダルト
        "drama": "human", // ヒューマンドラマ

        // ■ ビジネス (Business)
        "business": "management", "management": "management",
        "marketing": "marketing", "advertising": "marketing",
        "leadership": "leadership",
        "success": "work", "careers": "career",
        "finance": "finance", "investment": "finance",
        "economics": "economy",
        "industries": "industry",
        "computers": "data", "data": "data",

        // ■ 趣味・実用 (Hobby)
        "cooking": "cooking", "housekeeping": "cooking",
        "family & relationships": "parenting", "parenting": "parenting",
        "health & fitness": "health", "fitness": "health",
        "beauty": "beauty", "body, mind & spirit": "beauty",
        "travel": "travel",
        "gardening": "gardening",
        "sports & recreation": "sports",
        "photography": "camera",
        "transportation": "railway", // 鉄道など
        "games & activities": "igo_shogi", // 将棋・囲碁など

        // ■ 専門書 (Specialized)
        "philosophy": "humanities", "psychology": "humanities", "religion": "humanities",
        "social science": "social_science",
        "technology": "science_tech", "engineering": "science_tech", "science": "science_tech",
        "medical": "medical", "medicine": "medical",
        "art": "art", "design": "art",
        "language arts & disciplines": "language", "foreign language": "language",
        "study aids": "license", // 資格・試験

        // ■ 児童書 (Children)
        "juvenile nonfiction": "nonfiction",
        "biography & autobiography": "biography",
        "poetry": "poem",
        "picture books": "picturebook",
        "fairy tales": "fairytale"
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

    // ラノベ判定
    if (isLightNovel(info)) {        
        main = "literature";       
        subs.add("lightnovel");
        targets.add("youth");              
        return {             
            mainGenre: main,             
            subGenres: Array.from(subs),             
            target: Array.from(targets)         
        };     
    }
    
    // 1. カテゴリからのメインジャンル判定
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
    }
    else if (apiCats.includes("business") || apiCats.includes("economics")) {
        main = "business";
    }
    else if (apiCats.includes("study aids") || apiCats.includes("education") || apiCats.includes("foreign language study")) {
        main = "study";
    }
    /*else if (
        apiCats.includes("computers") || apiCats.includes("technology") || 
        apiCats.includes("science") || apiCats.includes("medical") || 
        apiCats.includes("mathematics") || apiCats.includes("law") || 
        apiCats.includes("psychology") || apiCats.includes("architecture") ||
        apiCats.includes("engineering")
    ) {
        main = "specialized";
    }*/
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
  
    // 2. キーワードからのサブジャンル判定（APIカテゴリベース）
    for (const [key, val] of Object.entries(API_SUBGENRE_MAP)) {
        if (apiCats.includes(key)) subs.add(val);
    }

    // 3. 全文テキストからのキーワード判定
    // 文芸  
    if (fullText.includes("ミステリー") || fullText.includes("推理") || fullText.includes("探偵")) subs.add("mystery");  
    if (fullText.includes("ファンタジー")) subs.add("fantasy");  
    if (fullText.includes("恋愛") || fullText.includes("ラブ") || fullText.includes("恋")) subs.add("romance");  
    if (fullText.includes("sf") || fullText.includes("空想科学") || fullText.includes("サイエンスフィクション")) subs.add("sf");  
    if (fullText.includes("歴史") || fullText.includes("時代") || fullText.includes("三国志") || fullText.includes("戦争") || fullText.includes("戦闘機")) subs.add("history");  
    if (fullText.includes("政治")) subs.add("politics");  
    if (fullText.includes("ホラー") || fullText.includes("怖い")) subs.add("horror");  
    if (fullText.includes("青春") || fullText.includes("部活")) subs.add("youth");  
    if (fullText.includes("感動") || fullText.includes("ドラマ") || fullText.includes("泣ける")  || fullText.includes("泣いた")|| fullText.includes("人間模様")) subs.add("human");  
    if (fullText.includes("ライトノベル") || fullText.includes("ラノベ")) subs.add("lightnovel");  

    // ビジネス  
    if (fullText.includes("戦略") || fullText.includes("起業") || fullText.includes("経営")) subs.add("management");  
    if (fullText.includes("販促") || fullText.includes("マーケティング")) subs.add("marketing");  
    if (fullText.includes("リーダー") || fullText.includes("リーダーシップ") || fullText.includes("人を動かす") || fullText.includes("マネジメント") || fullText.includes("マネジャー")) subs.add("leadership");  
    if (fullText.includes("仕事") || fullText.includes("仕事術") || fullText.includes("効率")) subs.add("work");  
    if (fullText.includes("デイトレード") || fullText.includes("株") || fullText.includes("投資") || fullText.includes("金融") || fullText.includes("資産") || fullText.includes("お金")) subs.add("finance");  
    if (fullText.includes("政治") || fullText.includes("経済")) subs.add("economy");  
    if (fullText.includes("業界")) subs.add("industry");  
    if (fullText.includes("Gemini") || fullText.includes("Copilot") || fullText.includes("ChatGPT") || fullText.includes("人工知能") || fullText.includes("ai")) subs.add("data");  
    if (fullText.includes("キャリア") || fullText.includes("転職")) subs.add("career");  

    // 趣味・実用  
    if (fullText.includes("料理") || fullText.includes("レシピ") || fullText.includes("献立") || fullText.includes("クッキング") || fullText.includes("お菓子") || fullText.includes("キッチン") || fullText.includes("食卓") || fullText.includes("おかず") || fullText.includes("おつまみ")) subs.add("cooking");  
    if (fullText.includes("育児") || fullText.includes("子育て") || fullText.includes("離乳食")) subs.add("parenting");  
    if (fullText.includes("健康") || fullText.includes("ヨガ") || fullText.includes("筋トレ") || fullText.includes("フィットネス")) subs.add("health");
    if (fullText.includes("美容") || fullText.includes("化粧") || fullText.includes("コスメ") || fullText.includes("スキンケア") || fullText.includes("美肌")) subs.add("beauty");  
    if (fullText.includes("マナー") || fullText.includes("冠婚葬祭") || fullText.includes("結婚式") || fullText.includes("葬式") || fullText.includes("法要") || fullText.includes("法事") || fullText.includes("葬儀")) subs.add("manners");  
    if (fullText.includes("旅行") || fullText.includes("ガイド") || fullText.includes("観光") || fullText.includes("名所") || fullText.includes("パワースポット") || fullText.includes("世界遺産")) subs.add("travel");  
    if (fullText.includes("園芸") || fullText.includes("盆栽") || fullText.includes("植木") || fullText.includes("芝生") || fullText.includes("生花")  || fullText.includes("いけばな") || fullText.includes("ガーデニング") || fullText.includes("庭づくり") || fullText.includes("華道")) subs.add("gardening");
    if (fullText.includes("スポーツ") || fullText.includes("運動") || fullText.includes("野球")  || fullText.includes("大谷翔平") || fullText.includes("サッカー") || fullText.includes("テニス") || fullText.includes("ゴルフ") || fullText.includes("水泳") || fullText.includes("バスケ")) subs.add("sports");  
    if (fullText.includes("カメラ") || fullText.includes("一眼") || fullText.includes("写真") || fullText.includes("フォト")) subs.add("camera");  
    if (fullText.includes("鉄道") || fullText.includes("撮り鉄")) subs.add("railway");  
    if (fullText.includes("将棋") || fullText.includes("囲碁") || fullText.includes("チェス") || fullText.includes("麻雀") || fullText.includes("飛車")) subs.add("igo_shogi");  

    // 専門書  
    if (fullText.includes("人文") || fullText.includes("哲学") || fullText.includes("心理") || fullText.includes("倫理")) subs.add("humanities");  
    if (fullText.includes("社会科学")) subs.add("social_science");  
    if (fullText.includes("理工") || fullText.includes("科学技術") || fullText.includes("機械") || fullText.includes("建築")) subs.add("science_tech");  
    if (fullText.includes("医学") || fullText.includes("看護") || fullText.includes("医療")) subs.add("medical");  
    if (fullText.includes("芸術") || fullText.includes("デザイン") || fullText.includes("アート")) subs.add("art");  
    if (fullText.includes("語学") || fullText.includes("英語")) subs.add("language");  
    if (fullText.includes("資格") || fullText.includes("検定")) subs.add("license");  

    // 児童書  
    if (fullText.includes("絵本") || fullText.includes("えほん")) subs.add("picturebook");
    if (fullText.includes("童話") || fullText.includes("どうわ")) subs.add("fairytale");
    if (fullText.includes("ファンタジー")) subs.add("fantasy");
    if (fullText.includes("SF") || fullText.includes("エスエフ")) subs.add("sf");
    if (fullText.includes("ミステリー")) subs.add("mystery");  
    if (fullText.includes("歴史") || fullText.includes("れきし")) subs.add("history");  
    if (fullText.includes("ノンフィクション")) subs.add("nonfiction");  
    if (fullText.includes("詩") || fullText.includes("ポエム")) subs.add("poem");  
    if (fullText.includes("伝記")) subs.add("biography");  
    if (fullText.includes("学習まんが")) subs.add("study_manga");  
    if (fullText.includes("図鑑") || fullText.includes("ずかん")) subs.add("zukan");  

    // 学習参考書
    if (fullText.includes("確率") || fullText.includes("整数")) subs.add("math_ia");
    if (fullText.includes("ベクトル") || fullText.includes("漸化式") || fullText.includes("数列")) subs.add("math_iib");

    // 4. ★改善：メインジャンルが other の場合、サブジャンルから推測する
    if (main === "other" && subs.size > 0) {
        const counts = {};
        subs.forEach(s => {
            const m = SUB_TO_MAIN_MAP[s];
            if (m) counts[m] = (counts[m] || 0) + 1;
        });

        const candidates = Object.keys(counts);
        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                // 1. 出現回数が多い順
                if (counts[b] !== counts[a]) return counts[b] - counts[a];
                // 2. 回数が同じなら優先度順
                return MAIN_GENRE_PRIORITY.indexOf(a) - MAIN_GENRE_PRIORITY.indexOf(b);
            });
            main = candidates[0];
        }
    }

    // 5. ターゲット判定
    for (const [key, keywords] of Object.entries(TARGET_KEYWORDS)) {
        if (keywords.some(k => fullText.includes(k))) targets.add(key);
    }
    
    // 補完：文芸や学習参考書でターゲットが不明な場合は一般向けとする
    if ((main === "literature" || main === "study") && targets.size === 0) {
        targets.add("general");
    }

    // 何もサブジャンルがヒットしなかった場合のみ other を入れる
    if (subs.size === 0) subs.add("other");

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
        constraints.push(where("isExcluded", "==", false)); 
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
    const errorMsg = document.getElementById(`search-error-${sectionId}`); // エラーメッセージ要素を取得

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const keyword = searchInput.value.trim(); 

          // 1. 不適切ワードチェック
          const isSafe = isSafeText(keyword);

          if (!isSafe) {
              // --- 不適切なワードが含まれている場合 ---
              if (errorMsg) errorMsg.style.display = "block"; // メッセージ表示
              if (searchBtn) searchBtn.disabled = true;       // ボタンを無効化
              searchInput.style.borderColor = "#ff4d4f";     // 枠線を赤くする
              
              // グラフのハイライトは消去する
              highlightChartItems(genreId, "");
              return; 
          } else {
              // --- 安全な場合（または空文字の場合） ---
              if (errorMsg) errorMsg.style.display = "none";  // メッセージ非表示
              if (searchBtn) searchBtn.disabled = false;      // ボタンを有効化
              searchInput.style.borderColor = "";            // 枠線を元に戻す
          }

            isWebSearching[sectionId] = false;
            applyLocalFilter(sectionId);
            highlightChartItems(sectionId, keyword);
        });
        searchInput.addEventListener("keydown", async (e) => {
            if (e.isComposing) return;
            if (e.key === "Enter") {
                const keyword = searchInput.value.trim();
              if (keyword && isSafeText(keyword)) {
                    e.preventDefault();
                    await searchExternalBooks(sectionId, keyword);
                }
            }
        });
        if (searchBtn) {
            searchBtn.addEventListener("click", async () => {
                const keyword = searchInput.value.trim();
                if (keyword && isSafeText(keyword)) {
                    await searchExternalBooks(sectionId, keyword);
                }
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
            
            let displayImg = getSecureImageUrl(book.image || (book.imageLinks && book.imageLinks.thumbnail) || "");
            
            const firstAuthor = (book.authors && book.authors.length > 0) ? book.authors[0] : (book.author || "");            
            const searchQuery = `${book.title} ${firstAuthor}`.trim();

            section.innerHTML = `
                <div class="featured-label">★ 今週のピックアップ</div>
                <div style="display: flex; gap: 20px; align-items: flex-start; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <div style="flex-shrink: 0; width: 100px;">
                        <img src="${displayImg}" alt="${book.title}" 
                             style="width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"
                             onerror="this.onerror=null; this.src='https://via.placeholder.com/100x140?text=No+Image';">
                    </div>
                    <div style="flex-grow: 1;">
                        <h3 style="margin: 0 0 8px 0; font-size: 20px; color: #2c3e50; line-height: 1.4;">${book.title}</h3>
                        <p style="margin: 0 0 15px 0; font-size: 15px; color: #666;">
                            ${book.authors ? book.authors.join(", ") : "著者不明"}
                        </p>
                        <a href="https://www.amazon.co.jp/s?k=${encodeURIComponent(searchQuery.trim())}" target="_blank"
                           onclick="trackClick('${bookId}')"
                           style="background: #27ae60; color: white; text-decoration: none; padding: 8px 16px; border-radius: 4px; font-size: 14px; font-weight: bold; display: inline-block;">
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

// 画像URLを安全なHTTPSに変換する共通関数
function getSecureImageUrl(url) {
    if (!url) return "";
    // http:// を https:// に置換する
    return url.replace("http://", "https://");
}
