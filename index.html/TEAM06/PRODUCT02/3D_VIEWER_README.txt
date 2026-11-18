PRODUCT02 메인 컷 3D 뷰어 (PRODUCT04와 동일한 방식)

- 외부 라이브러리/인터넷 없이 동작하는 자체 WebGL 뷰어입니다. (file:// 로 열어도 동작)
- 모델 파일: assets/models/talktide-model.js  (talktide.glb 를 변환한 파일, PRODUCT04의 tag-model.js 와 같은 형식)
- 원본 GLB: assets/models/talktide.glb (보관용. 모델을 수정했다면 변환을 다시 해야 합니다)
- 조작: 드래그 = 회전 / 휠 = 확대·축소 / '처음 시점' 버튼 = 초기화 / 가만히 두면 자동 회전
- 모델을 불러오지 못하면 기존 product-rendering-main.webp 이미지가 그대로 표시됩니다.
- 브라우저가 WebGL 또는 DecompressionStream 을 지원하지 않는 경우에도 이미지가 표시됩니다 (최신 Chrome/Edge/Safari/Firefox 지원).

[모델 교체 내역]
- assets/models/talktide.glb 를 D_C_모델링_recolor.glb 로 교체 (형태는 동일, 재질만 변경: Greige Body / Rose Beige Pad)
- assets/models/talktide-model.js 의 재질(색상·거칠기·금속성)을 새 GLB 값으로 갱신 (뷰어는 이 js를 읽어 표시)
