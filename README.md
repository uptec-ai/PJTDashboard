# KongBoard — 개인 프로젝트 관리 대시보드 (PJTDashboard)

GitHub와 달리 **개인 프로젝트의 등록·관리·진행률**에 특화된 대시보드 웹입니다.
Firebase(Auth + Firestore + Storage/GCS) 기반이며, 개발 중에는 로컬 에뮬레이터로 **비용 0원·계정 불필요**로 동작합니다.

## 실행 방법 (개발 모드)

터미널 2개가 필요합니다.

```bash
# 터미널 1: Firebase 에뮬레이터 (가짜 Firebase — 내 PC에서 실행)
npm run emulators

# 터미널 2: 웹 화면
npm run dev
```

| 주소 | 용도 |
|------|------|
| http://localhost:5173 | 대시보드 웹 화면 |
| http://127.0.0.1:4000 | 에뮬레이터 관리 UI (가입자 목록, **인증 메일 링크 확인**) |

## 마스터 계정 만들기 (최초 1회)

에뮬레이터가 켜진 상태에서:

```bash
npm run seed -- "원하는비밀번호"
```

- 비밀번호 정책: 영문 + 숫자 + 특수문자 포함 10자 이상
- 로그인 화면에서 아이디에 **kingkong** 만 입력하면 됩니다
- ⚠️ 초기 비밀번호를 다른 곳에 적어두었다면 **구축 후 반드시 변경**하세요 (내 정보 → 비밀번호 변경)

## 이메일 인증 (개발 모드)

회원가입 후 실제 메일은 발송되지 않습니다.
**에뮬레이터 UI → Authentication 탭**에서 해당 계정의 인증 링크를 클릭하면 인증이 완료됩니다.

## 계정 등급

| 등급 | 권한 |
|------|------|
| 마스터 | 전체 프로젝트 + 회원 관리(등급 변경·비활성화) |
| 개인 | 자기 프로젝트 등록·관리 |
| 게스트 | 가입 없이 입장, 공개 프로젝트 지표만 열람 |

## 데이터 보존 ⚠️

- 에뮬레이터를 **Ctrl+C로 정상 종료**하면 데이터가 `.emulator-data/`에 자동 저장되고, 다음 실행 때 자동 복원됩니다.
- **PC를 그냥 끄면(강제 종료) 저장되지 않아 데이터가 사라집니다.** 중요한 데이터를 넣었다면 에뮬레이터가 켜진 상태에서 수시로 백업하세요:
  ```bash
  npm run backup
  ```
- 데이터가 초기화됐을 때 복구: `npm run seed -- "<비밀번호>"` → `npm run seed:demo` (샘플 데이터)

## 진행 단계

- [x] Phase 0 — 프로젝트 셋업 (Vite + React + Firebase 에뮬레이터)
- [x] Phase 1 — 로그인/회원 (가입·이메일 인증·ID/PW 찾기·회원 관리·5회 실패 잠금)
- [x] Phase 2 — 프로젝트 CRUD + 카드 대시보드 + KPI 요약
- [x] Phase 3 — 장비/일정/이슈 (캘린더, 이슈 상태 관리)
- [x] Phase 4 — 문서 버전 관리 (GCS, diff 표시)
- [x] Phase 5 — Claude Code 자동 업로드 연동 (kongboard-register 스킬 + 등록 스크립트 + 연동 이력)
- [x] Phase 6 — 지표 시각화 (달성률 추이 차트·주간 활동 히트맵·Mermaid 시퀀스 다이어그램)

## Claude Code 연동 (Phase 5)

아무 프로젝트 폴더에서 Claude Code에 **"대시보드에 올려줘"** 라고 하면:
1. 프로젝트 분석 → 요약·목표(마일스톤) 초안 제시
2. 사용자가 목표를 검토·수정 (확인 전에는 등록하지 않음)
3. `scripts/register-project.mjs`로 등록/업데이트 — AI 재작성 문서(자동 버전·diff) 동반 가능
4. 결과는 프로젝트 상세의 **연동 이력** 탭에 기록

전역 스킬: `~/.claude/skills/kongboard-register/SKILL.md`

## 실서버 배포 (추후)

1. 구글 계정으로 [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. 웹 앱 등록 후 발급되는 설정값을 `.env` 파일에 입력 (`VITE_FB_API_KEY` 등)
3. `firebase deploy` → `https://프로젝트명.web.app` 으로 접속
- 로그인/DB/호스팅은 무료(Spark). 문서 파일 저장(GCS)·자동 업로드 API는 Blaze(카드 등록) 필요
