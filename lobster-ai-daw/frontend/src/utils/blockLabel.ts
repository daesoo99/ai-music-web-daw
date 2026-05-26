const KEYWORD_TO_TRACK: Record<string, string> = {
  'piano': 'piano', 'grand piano': 'piano', 'keyboard': 'piano',
  '피아노': 'piano', '건반': 'piano', '키보드': 'piano',
  'violin': 'strings', 'cello': 'strings', 'strings': 'strings',
  'orchestra': 'strings', 'orchestral': 'strings',
  '바이올린': 'strings', '첼로': 'strings', '현악': 'strings', '오케스트라': 'strings',
  'drum': 'drums', 'drums': 'drums', 'percussion': 'drums', 'beat': 'drums',
  '드럼': 'drums', '비트': 'drums', '타악기': 'drums',
  'bass': 'bass', 'bass guitar': 'bass', 'double bass': 'bass',
  '베이스': 'bass', '베이스 기타': 'bass',
  'guitar': 'guitar', 'acoustic guitar': 'guitar', 'electric guitar': 'guitar',
  '기타': 'guitar', '통기타': 'guitar', '일렉기타': 'guitar',
  'sax': 'saxophone', 'saxophone': 'saxophone', '색소폰': 'saxophone',
  'flute': 'flute', 'flutist': 'flute', '플루트': 'flute', '플룻': 'flute',
  'trumpet': 'trumpet', 'horn': 'trumpet', '트럼펫': 'trumpet'
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'of', 'in', 'on', 'at',
  'beautiful', 'majestic', 'nice', 'good', 'great', 'amazing', 'epic',
  'highly', 'very', 'really', 'so', 'too', 'intro', 'outro', 'part', 'make',
  '아주', '매우', '정말', '진짜', '좀', '약간', '이게', '그', '저',
  '만들어주라', '만들어줘', '해줘', '부탁', 'solo', 'slow', 'fast', 'sequence',
  'create', 'generate', 'play', 'song', 'music', 'track', 'melody'
]);

function fallbackLabel(originalPrompt: string): string {
  // 원본 prompt의 첫 단어 (불용어 무시) 또는 첫 명사 사용 (1글자 단어 제외)
  const cleaned = originalPrompt.replace(/[,\.\?!#@\-\+\*=~_]/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  
  const firstWord = words.find(w => w.length >= 2);
  
  if (firstWord) {
    // 한글이면 그대로, 영어면 첫 글자 대문자
    return /[가-힣]/.test(firstWord)
      ? firstWord
      : firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }
  
  return 'Block';  // 최후 fallback
}

export function generateBlockLabel(prompt: string): string {
  // 1. BPM 및 초 형태의 수치 사전 제거 (예: 60bpm, 120BPM, bpm, 60s, 90s)
  let cleaned = prompt.replace(/\b\d+BPM\b/gi, '');
  cleaned = cleaned.replace(/\b\d+s\b/gi, '');
  cleaned = cleaned.replace(/\bbpm\b/gi, '');
  
  // 특수문자 제거 후 단어로 쪼갬
  cleaned = cleaned.replace(/[,\.\?!#@\-\+\*=~_]/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);

  const seen = new Set<string>();
  const uniqueWords: string[] = [];

  // 2. 단어 중복 제거 및 불용어(Stopwords) 제거
  for (const w of words) {
    const lower = w.toLowerCase();
    // 숫자만 있는 단어 제거
    if (/^\d+$/.test(w)) continue;
    if (STOP_WORDS.has(lower)) continue;
    
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueWords.push(w);
    }
  }

  // 3. 만약 남은 단어가 없거나, 남은 단어들이 전부 1글자 단어인 경우 fallback 적용
  if (uniqueWords.length === 0 || uniqueWords.every(w => w.length < 2)) {
    return fallbackLabel(prompt);
  }

  const finalWords = uniqueWords;

  // 4. 한글 포함 여부 체크
  const hasKorean = /[가-힣]/.test(prompt);

  if (hasKorean) {
    // 한국어의 경우 어순이 가장 중요하므로 원래 프롬프트에 등장한 순서 그대로 최대 3단어를 사용한다!
    return finalWords.slice(0, 3).map(capitalize).join(' ');
  }

  // 5. 영어의 경우 악기 키워드를 맨 앞으로 배치하여 변별력을 높인다
  const lowerPrompt = prompt.toLowerCase();
  const detectedInstrumentWords = new Set<string>();
  
  for (const kw of Object.keys(KEYWORD_TO_TRACK)) {
    if (lowerPrompt.includes(kw)) {
      kw.split(' ').forEach(k => detectedInstrumentWords.add(k.toLowerCase()));
    }
  }

  const instrumentsInPrompt = finalWords.filter(w => detectedInstrumentWords.has(w.toLowerCase()));
  const othersInPrompt = finalWords.filter(w => !detectedInstrumentWords.has(w.toLowerCase()));

  const resultWords = [...instrumentsInPrompt, ...othersInPrompt].slice(0, 3);
  return resultWords.map(capitalize).join(' ');
}

function capitalize(word: string): string {
  // 한글은 첫글자 대문자화가 불필요하므로 그대로 리턴
  if (/[가-힣]/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
