export const KEYWORD_TO_TRACK: Record<string, string> = {
  // Piano 계열 (piano)
  'grand piano': 'piano',
  'acoustic piano': 'piano',
  'solo piano': 'piano',
  'classic piano': 'piano',
  'soft piano': 'piano',
  'piano': 'piano',
  'keyboard': 'piano',
  'synthesizer': 'piano',
  'electric piano': 'piano',
  'rhodes': 'piano',
  '피아노': 'piano',
  '그랜드 피아노': 'piano',
  '건반': 'piano',
  '키보드': 'piano',
  '신디사이저': 'piano',
  '신스': 'piano',
  '일렉 피아노': 'piano',
  
  // Contrabass (콘트라베이스)
  'contrabass': 'contrabass',
  'double bass': 'contrabass',
  '콘트라베이스': 'contrabass',
  '더블베이스': 'contrabass',
  '더블 베이스': 'contrabass',

  // Viola (비올라)
  'viola': 'viola',
  '비올라': 'viola',

  // Violin (바이올린)
  'violin solo': 'violin',
  'violin': 'violin',
  '바이올린': 'violin',
  '바이올린 솔로': 'violin',

  // Cello (첼로)
  'cello solo': 'cello',
  'cello': 'cello',
  '첼로': 'cello',
  '첼로 솔로': 'cello',

  // Harp (하프)
  'harp': 'harp',
  '하프': 'harp',

  // Flute (플루트)
  'flute solo': 'flute',
  'flute': 'flute',
  '플루트 솔로': 'flute',
  '플루트': 'flute',
  '플룻': 'flute',

  // Oboe (오보에)
  'oboe': 'oboe',
  '오보에': 'oboe',

  // Clarinet (클라리넷)
  'clarinet': 'clarinet',
  '클라리넷': 'clarinet',

  // Bassoon (바순)
  'bassoon': 'bassoon',
  '바순': 'bassoon',

  // Trumpet (트럼펫)
  'trumpet solo': 'trumpet',
  'trumpet': 'trumpet',
  '트럼펫 솔로': 'trumpet',
  '트럼펫': 'trumpet',

  // Trombone (트롬본)
  'trombone': 'trombone',
  '트롬본': 'trombone',

  // Horn (호른)
  'horn': 'horn',
  '호른': 'horn',
  '프렌치 호른': 'horn',

  // Tuba (튜바)
  'tuba': 'tuba',
  '튜바': 'tuba',

  // Timpani (팀파니)
  'timpani': 'timpani',
  '팀파니': 'timpani',

  // Harpsichord (하프시코드)
  'harpsichord': 'harpsichord',
  '하프시코드': 'harpsichord',

  // Organ (오르간)
  'organ': 'organ',
  '오르간': 'organ',

  // Strings Ensemble 계열 (strings)
  'strings ensemble': 'strings',
  'orchestra': 'strings',
  'orchestral': 'strings',
  'strings': 'strings',
  'string quartet': 'strings',
  '현악 앙상블': 'strings',
  '오케스트라': 'strings',
  '오케스트랄': 'strings',
  '스트링': 'strings',
  '스트링스': 'strings',
  '현악': 'strings',
  '현악기': 'strings',
  '현악 4중주': 'strings',
  
  // Drums 계열 (drums)
  'acoustic drums': 'drums',
  'drum kit': 'drums',
  'drum loop': 'drums',
  'percussion': 'drums',
  'drum': 'drums',
  'drums': 'drums',
  'beat': 'drums',
  'groove': 'drums',
  'rhythm': 'drums',
  'hiphop beat': 'drums',
  '드럼 키트': 'drums',
  '어쿠스틱 드럼': 'drums',
  '드럼': 'drums',
  '타악기': 'drums',
  '비트': 'drums',
  '리듬': 'drums',
  '퍼커션': 'drums',
  '그루브': 'drums',
  
  // Bass 계열 (bass)
  'bass guitar': 'bass',
  'sub bass': 'bass',
  'synth bass': 'bass',
  'electric bass': 'bass',
  'acoustic bass': 'bass',
  'bass': 'bass',
  '베이스 기타': 'bass',
  '서브 베이스': 'bass',
  '신스 베이스': 'bass',
  '베이스': 'bass',

  // Guitar 계열 (guitar)
  'acoustic guitar': 'guitar',
  'electric guitar': 'guitar',
  'classical guitar': 'guitar',
  'nylon guitar': 'guitar',
  'guitar solo': 'guitar',
  'guitar': 'guitar',
  'ukulele': 'guitar',
  '어쿠스틱 기타': 'guitar',
  '일렉 기타': 'guitar',
  '클래식 기타': 'guitar',
  '기타 솔로': 'guitar',
  '기타': 'guitar',
  '우쿨렐레': 'guitar',
  
  // Saxophone 계열 (saxophone)
  'saxophone solo': 'saxophone',
  'saxophone': 'saxophone',
  'sax': 'saxophone',
  '색소폰 솔로': 'saxophone',
  '색소폰': 'saxophone',
  '섹소폰': 'saxophone',
};

export function inferTrackFromPrompt(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  // 정렬 순서를 긴 키워드 순으로 정렬하여 구체적 악기 매칭 우선권을 확보
  const sorted = Object.keys(KEYWORD_TO_TRACK).sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    if (lower.includes(kw)) {
      return KEYWORD_TO_TRACK[kw];
    }
  }
  return null;
}
