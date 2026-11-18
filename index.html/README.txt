2030 FUTURE WORLD — TEAM 06 (2030 동묘시장 · MCU AI SOCIETY) 웹사이트
=====================================================================

[폴더 구조]  — 웹사이트 제작 가이드 2장 기준

2030-future-world/
├── index.html                 프로젝트 소개 페이지 (임시 — 수업에서 받은 페이지로 교체)
├── README.txt
└── TEAM06/
    ├── index.html             조 소개 페이지 (2030 동묘시장)
    ├── assets/
    │   ├── images/            team-hero.webp (메인 세계관 이미지, 2560px), logo.png (조 로고)
    │   ├── fonts/             Pretendard 글꼴 (오프라인용)
    │   ├── videos/            (비어 있음)
    │   └── models/            (비어 있음)
    ├── PRODUCT01/index.html   스마트 AI 스크린 거울
    ├── PRODUCT02/index.html   TALKTIDE (톡타이드)
    ├── PRODUCT03/index.html   DONGMYO MARKET 2031
    └── PRODUCT04/index.html   AI 빈티지 디스커버리 태그
        (각 PRODUCT 폴더 안 assets/images, videos, models 는 제품 에셋을 넣을 자리)
        PRODUCT04/assets/images/ : product-hero.webp (메인컷), product-rendering-main.webp,
                                   product-detail-01.webp, product-detail-02.webp


[여는 방법]

1) 간단히 보기
   - ★ 먼저 zip 파일을 '전체 압축 풀기' 하세요. (압축 파일 안에서 바로 index.html 을 열면
     이미지·글꼴·3D·페이지 이동이 동작하지 않아요 → 이때는 화면 위에 안내 문구가 떠요)
   - 풀린 2030-future-world 폴더의 index.html 을 크롬/엣지/사파리/파이어폭스로 열기
   - 인터넷 없이도 모든 페이지 이동·이미지·글꼴·지도·3D 뷰어가 동작함

2) 로컬 웹 서버로 보기 (가이드 권장 — 시연·최종 점검용)
   - 이 폴더(2030-future-world)에서 터미널을 열고 아래 명령 실행
       python -m http.server 8000
   - 브라우저에서 http://localhost:8000 접속
   - 또는 VS Code의 Live Server 확장으로 index.html 열기


[페이지 이동]

- 프로젝트 소개 → TEAM 06 카드
- 조 소개 페이지:  왼쪽 위 '전체 프로젝트'(홈 아이콘) → 프로젝트 소개
                   DONGMYO 로고 → 조 소개 페이지 맨 위
                   연관 제품 카드 / 지도 '상세 정보 바로 보기' → PRODUCT01~04
                   메인 이미지 아래 흐름 띠(01~04) → 각 섹션으로 이동
                   스크롤하면 오른쪽 아래 TOP 버튼 → 맨 위로
- 제품 소개 페이지: '전체 프로젝트'(홈 아이콘) → 프로젝트 소개
                   DONGMYO 로고 → TEAM 06 조 소개 페이지
                   오른쪽 섹션 번호(02~08) → 해당 섹션으로 이동
                   08 MORE FROM TEAM 06 → 다른 제품 페이지
                   오른쪽 아래 TOP 버튼 → 맨 위로
                   맨 아래 '← TEAM 06 · 2030 동묘시장으로 돌아가기'


[팀에서 채워야 할 곳]

- TEAM06/index.html 의 PRODUCTS 목록
    name / summary / detail : 제품명·설명
    features : 관련 장소 특징 번호 (예: [3,5]) — 비워두면 카드에 '입력 필요'로 표시
- PRODUCT01~04/index.html 의 NAMES : 제품명 (4개 파일 모두 같게)


[주의]

- 폴더 이름과 파일 이름(대소문자 포함)을 바꾸지 마세요. 링크가 끊겨요.
- 모든 링크는 상대 경로라 GitHub Pages / Netlify에 폴더째 올리면 그대로 동작해요.
- 제품 이미지·영상·3D 모델은 아직 없어서 회색 칸(자리 표시)으로 되어 있어요.
  각 PRODUCT 폴더의 assets 안에 파일을 넣고 연결하면 돼요.

[PRODUCT 4 내용 반영]
- 02~05 텍스트 입력 완료 (페르소나·문제·핵심 기능·인터랙션 플로우·사용 시나리오)
- TEAM06/PRODUCT04/assets/images/
  product-persona.webp      : 페르소나 (시나리오 03 컷에서 인물 부분을 자른 임시 이미지)
  product-feature-01~03.webp: 핵심 기능 01 들어 올림 / 02 빛·가격 표시 / 03 토글
  product-scene-01~04.webp  : 사용 시나리오 01~04
- 기능·시나리오 이미지를 클릭하면 크게 볼 수 있음 (Esc 또는 클릭으로 닫기)

[PRODUCT 4 · 3D 뷰어]
- 06 Product Design 메인 칸 = 3D 뷰어 (드래그: 돌려 보기, 휠: 확대·축소, '처음 시점' 버튼)
- TEAM06/PRODUCT04/assets/models/
  tag.glb        : 원본 GLB (보관용)
  tag-model.js   : 뷰어가 실제로 읽는 파일 (원본을 세운 자세로 변환·압축, 더블클릭으로 열어도 작동)
- 모델을 못 불러오는 환경에서는 기존 렌더 이미지가 그대로 보임
- 원본은 바닥에 누운 상태 → 뷰어에서 세우고 스트랩을 뒤로 휘어 넘긴 모양으로 보여줌 (원본 GLB 파일은 그대로)

[PRODUCT 4 제품 정보]
- 제품명: AI 빈티지 디스커버리 태그 / 핵심 문장: 들어 올리는 순간, 물건의 가치가 보인다.
- 반영 위치: PRODUCT 4 페이지 맨 위, 모든 제품 페이지의 08 다른 제품 보기,
  조 페이지 연관 제품 카드(한 줄 설명 = 핵심 문장), 3D 지도 정보 박스(설명 = 상세 정보)

[PRODUCT 3 내용 반영 — DONGMYO MARKET 2031]
- TEAM06/PRODUCT03/index.html : DONGMYO MARKET 2031 제품 소개 페이지 (AI 기반 실시간 시장 거래 정보 분석 시스템)
  01 소개 · 02 페르소나 & 문제 · 03 핵심 기능 · 04 인터랙션 플로우 · 05 사용 시나리오 · 06 제품 디자인 · 07 사양
- TEAM06/PRODUCT03/assets/images/
  product-hero.webp            : 메인 이미지
  product-persona.webp         : 페르소나 (김영수, 73세)
  product-feature-01~03.webp   : 핵심 기능 01 상품 발견 / 02 매장 확인 / 03 효율적 쇼핑
  product-scene-01~04.webp     : 사용 시나리오 01~04
  product-rendering-main.webp  : 06 메인 렌더 (3D를 못 불러올 때 대신 보임)
  product-detail-01/02.webp    : 06-1 대형 디스플레이 / 06-2 소형 AI 센서
  logo.png                     : DONGMYO 로고
  product-thumbnail.webp       : 썸네일 (조 페이지 연관 제품 카드·지도 정보 박스, 다른 제품 페이지의 08 다른 제품 보기)
- 06 Product Design 메인 칸 = 3D 뷰어 (PRODUCT04와 같은 오프라인 뷰어, 드래그: 돌려 보기 · 휠: 확대·축소 · '처음 각도로')
  TEAM06/PRODUCT03/assets/models/
  dm.glb        : 원본 GLB (보관용)
  dm-model.js   : 뷰어가 실제로 읽는 파일 (원본을 세운 자세로 변환·압축, 더블클릭으로 열어도 작동)
  · 오크 원목·그레이 패브릭은 텍스처 대신 텍스처의 평균 색으로 표시
- 글꼴: 사이트 전체 Pretendard (TEAM06/assets/fonts, 인터넷 없이 동작)
- 이동: DONGMYO 로고 → TEAM 06 조 소개 페이지 / 메뉴(≡) 안 '← TEAM 06', '← 전체 프로젝트'
        맨 아래 '← TEAM 06 · 2030 동묘시장으로 돌아가기'

[오프라인 글꼴]
- TEAM06/assets/fonts/pretendard-offline.js : 사이트에 쓰인 글자만 담은 Pretendard (모든 페이지 공용)
  · 파일로 열 때 파이어폭스 등이 다른 폴더의 글꼴 파일(.woff2)을 막아도 이 파일로 Pretendard가 그대로 보임
  · 각 페이지 글꼴 순서: PretendardLocal(원본 .woff2) → PretendardEmbed(이 파일) → 시스템 글꼴
  · 이 파일이 안 불러와지면(압축을 안 푼 경우 등) 화면 위에 '압축을 먼저 풀어 주세요' 안내가 뜸


[통합 정리 — 개인 페이지 1~4 합치기]
- 디자인 기준: PRODUCT 4 페이지 (Pretendard, 글자 크기·굵기, 헤더·메뉴, 카드, 3D 뷰어, 확대 보기)
- PRODUCT 1 (스마트 AI 스크린 거울)
  · 따로 만든 사이트(smart-ai-mirror)의 문구·이미지를 PRODUCT 4 틀로 옮김 (글꼴 Noto Sans KR → Pretendard)
  · 이미지 이름을 가이드 규칙으로 변경: product-hero / persona / feature-01~03 / scene-01~04 / detail-01~02
    (feature·scene 은 6칸짜리 시나리오 이미지를 원래 페이지가 쓰던 칸대로 잘라 저장)
  · 3D: assets/models/mirror.glb(원본 보관) → mirror-model.js(뷰어용), 색은 원래 페이지와 같은 리넨 베이지 금속
- PRODUCT 2 (TALKTIDE): 내용 그대로, 아래만 PRODUCT 4에 맞춤
  · 맨 위 한 줄 문장 크기, 카드 위 작은 라벨(핵심 기능 01 / Scene 01), 이미지에 마우스 올렸을 때 확대 효과 제거
  · 확대 보기 창: 어두운 배경·둥근 흰 버튼 → 흰 배경·밑줄 텍스트 버튼
  · 공용 오프라인 글꼴(pretendard-offline.js)·압축 미해제 안내 추가
- PRODUCT 3 (DONGMYO MARKET 2031): 문구·이미지·3D 모델 그대로, PRODUCT 4 틀로 다시 배치
  · 분홍 배경·굵은 제목·둥근 모서리 → 가이드 색·글꼴·직각 카드
  · 상단 메뉴에 '전체 프로젝트' · 'PRODUCT 3' 표시, 08 다른 제품 보기 추가
- 조 페이지 연관 제품 카드·3D 지도 정보 박스: 제품 1~4 이름·한 줄 설명·이미지 모두 반영
- pretendard-offline.js: 새로 들어온 글자까지 포함해 다시 만듦
