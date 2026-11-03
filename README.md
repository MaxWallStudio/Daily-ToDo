# 오늘의 기록

매일 반복할 활동, 실제 수행 시간, 그날의 일기를 몇 번의 터치로 기록하는 개인 생활 로그 PWA입니다. 서버와 회원가입이 없으며 데이터는 현재 브라우저에만 저장됩니다.

## 로컬 실행

Node.js 20 이상에서 다음 명령을 실행하고 `http://localhost:4173`을 엽니다. 외부 패키지 설치는 필요하지 않습니다.

```bash
npm run dev
```

## 빌드와 배포

```bash
npm run build
npm run preview
```

`dist/`가 배포할 정적 파일입니다. Cloudflare Pages 또는 Vercel에 저장소를 연결하고 빌드 명령을 `npm run build`, 출력 폴더를 `dist`로 설정하세요. GitHub Pages에도 `dist/` 내용을 게시할 수 있습니다. 상대 경로를 사용하므로 저장소 하위 경로에서도 실행됩니다. 일반 정적 호스팅의 HTTPS 주소 또는 `localhost`에서 Service Worker가 작동합니다.

### GitHub Pages 자동 배포

저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정하세요. `main` 브랜치에 푸시하면 `.github/workflows/deploy-pages.yml`이 `npm run build`를 실행하고 `dist/`를 게시합니다. 배포 주소는 `https://popkont.github.io/Daily-ToDo/`입니다.

이 프로젝트는 Vite가 아닌 자체 정적 빌드 스크립트를 사용합니다. HTML의 리소스 경로, PWA manifest의 `start_url`·`scope`·아이콘 경로, Service Worker 등록과 오프라인 캐시는 앱 경로를 기준으로 설정되어 있어 저장소 하위 경로에서 동작합니다.

## PWA 설치와 오프라인 사용

Chrome, Edge, Samsung Internet 등 설치 프롬프트를 지원하는 브라우저에서는 설정의 **앱 설치하기**를 눌러 설치할 수 있습니다. Instagram, Facebook, KakaoTalk 등의 인앱 브라우저에서는 설치 안내를 표시합니다. Android는 Chrome 또는 Samsung Internet에서 열고, iOS는 Safari에서 연 뒤 공유 버튼 → **홈 화면에 추가**를 선택하세요. 설치된 앱(standalone)으로 실행 중이면 설치 UI를 표시하지 않습니다.

첫 온라인 방문에서 앱 파일을 캐시하므로 이후 오프라인에서도 앱을 실행할 수 있습니다. 앱을 시작하거나 다시 포그라운드로 가져오거나 온라인으로 전환할 때 Service Worker 업데이트를 확인하며, 최신 파일을 먼저 네트워크에서 받고 실패하면 기존 캐시를 사용합니다. 새 워커가 활성화되면 이전 앱 캐시를 자동으로 제거합니다.

`npm run build`는 배포용 `dist/sw.js`에 고유한 빌드 ID 기반 캐시 이름을 자동으로 기록합니다. GitHub Actions 배포에서도 같은 과정이 실행되므로 `sw.js`의 캐시 버전을 직접 변경할 필요가 없습니다. 캐시 이름은 앱 경로별로 구분되며 GitHub Pages의 저장소 하위 경로에서도 동작합니다. 이 캐시 정리는 Cache Storage에만 적용되고, `localStorage`의 `daily-life-log:v1` 사용자 데이터에는 영향을 주지 않습니다.
## 데이터와 백업

데이터는 `localStorage`의 `daily-life-log:v1` 키에 즉시 저장됩니다. 일기는 입력 후 550ms에 자동 저장하고 화면 이동 및 앱 종료 시 남은 입력을 저장합니다. 날짜는 기기의 **로컬 날짜**를 사용합니다. 활동 설정에는 날짜별 변경 이력이 있으며, 실제 수행 기록에는 활동 이름과 목표 시간의 스냅샷이 들어가 과거 기록의 의미를 유지합니다. 활동 삭제는 과거 기록을 지우지 않습니다.

**설정 → JSON 내보내기**로 활동, 기록, 일기, 화면 설정을 포함한 백업 파일을 받습니다. **JSON 가져오기**는 형식과 날짜 등을 검사한 뒤 현재 데이터를 교체합니다. 브라우저 데이터 삭제나 기기 교체 전에 백업하세요.

## 계산 기준

그날 예정된 활동만 포함합니다. 시간 목표는 `기록 분 / 목표 분`을 최대 100%로, 체크 활동은 완료 시 100%로 계산한 뒤 평균을 냅니다. 예정 활동이 없으면 휴식일입니다. 일기는 달성률에 포함되지 않습니다. 연속 달성은 100%인 날을 기준으로 하고 휴식일은 건너뜁니다. 오늘이 아직 미완료라면 어제부터 셉니다.

## 구조

- `src/app.js` — 화면과 사용자 입력
- `src/model.js` — 반복 일정, 달성률, 통계
- `src/storage.js` — 저장, 백업 형식 검사, 기록 갱신
- `src/dates.js` — 로컬 날짜 처리
- `src/styles.css` — 반응형 화면과 다크 모드
- `sw.js`, `manifest.webmanifest`, `icons/` — 설치와 오프라인 실행
- `scripts/build.mjs`, `scripts/serve.mjs`, `scripts/test.mjs` — 빌드, 로컬 서버, 핵심 로직 검증

검증은 `npm test`로 실행합니다.
