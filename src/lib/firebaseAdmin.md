# firebaseAdmin.ts 변경 내역 및 Vercel 조치 사항

## 변경 내용

**파일**: `src/lib/firebaseAdmin.ts`

기존 `JSON.parse()` 직접 파싱 방식에서 base64 디코딩 후 파싱 방식으로 변경.

```ts
// 변경 전
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccount = JSON.parse(serviceAccountJson);

// 변경 후
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString(); // utf-8 기본값
const serviceAccount = JSON.parse(serviceAccountJson);
```

`Buffer.toString()`의 인코딩 기본값은 `'utf-8'`이므로 `.toString('utf-8')` 명시 생략 가능.

## 변경 이유

기존 방식(JSON 문자열 직접 입력)은 Vercel 환경변수 저장 과정에서 다음 문제가 발생할 수 있었다.

- `private_key`의 `\n`이 실제 줄바꿈으로 바뀌거나 `\\n`으로 이중 이스케이프되는 경우
- BOM, `\r\n`, 보이지 않는 공백 등 인코딩 오염 문자가 섞이는 경우

base64는 파일의 모든 바이트를 ASCII 안전 문자로 인코딩하기 때문에 위 문제가 구조적으로 발생하지 않는다.

## Vercel에서 해야 할 조치

### 1. base64 값 생성

터미널에서 아래 명령어 실행:

**macOS**
```bash
cat serviceAccountKey.json | base64 | tr -d '\n' | pbcopy
```

**Linux**
```bash
cat serviceAccountKey.json | base64 -w 0 | xclip -selection clipboard
# xclip 없으면
cat serviceAccountKey.json | base64 -w 0 | xsel --clipboard --input
```

- macOS `base64`: 출력에 줄바꿈이 포함되므로 `tr -d '\n'`으로 제거 필요
- Linux `base64 -w 0`: `-w 0` 옵션으로 줄바꿈 없이 한 줄 출력
- 줄바꿈이 남아있으면 Vercel 환경변수 저장 시 값이 깨질 수 있음

### 2. Vercel 환경변수 교체

1. Vercel 대시보드 → 해당 프로젝트 → **Settings** → **Environment Variables**
2. `FIREBASE_SERVICE_ACCOUNT_KEY` 값을 위에서 복사한 base64 문자열로 교체
3. **저장 후 재배포** 필요 (환경변수 변경은 재배포 시 적용됨)

> 기존 JSON 문자열 값은 이제 동작하지 않으므로 반드시 교체해야 한다.

---

## NEXT: 추가로 살펴봐야 할 항목

### 1. null-caching 버그 검증

v6.5.0에서 lazy getter 패턴으로 전환하면서 이론상 해결됐으나, 당시 PEM 재조립 로직 변경과 동시에 이뤄져서 어느 쪽이 실제 원인이었는지 분리 검증이 안 된 상태.

에러가 재발할 경우 Vercel 함수 로그에서 아래 패턴 확인:
- `adminAuth is not a function` 또는 `Cannot read properties of null` → null-caching이 원인
- `Firebase Admin SDK not initialized` → lazy getter가 정상 작동하지 않는 것, 초기화 자체 실패

현재 코드의 lazy getter 패턴이 실제로 매 호출마다 `admin.apps.length`를 재평가하는지 운영 환경에서 확인 필요.

### 4. Vercel 콜드 스타트 타이밍

현재 `initializeAdminApp()`은 모듈 로드 시 동기적으로 실행되므로 일반적인 경우 문제없다. 단, 아래 상황에서는 여전히 위험 가능성 있음:

- **Edge Runtime 사용 시**: Vercel Edge Runtime은 Node.js 런타임과 모듈 캐싱 동작이 다르며 `firebase-admin` 자체가 Edge Runtime 미지원
- **동시 다발적 콜드 스타트**: 트래픽 급증으로 여러 인스턴스가 동시에 초기화될 때 `admin.apps.length` 체크가 경쟁 상태에 빠질 수 있음

확인 사항: Vercel 프로젝트 설정 → Functions → Runtime이 Node.js인지 확인. Edge Runtime으로 설정되어 있으면 `firebase-admin` 동작 자체가 보장되지 않음.