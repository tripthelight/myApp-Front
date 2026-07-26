# iPhone Safari에서 로컬 PWA 테스트하기

PC의 `localhost`는 iPhone의 `localhost`와 다른 장치입니다. iPhone에서 `https://PC의-LAN-IP:5173`으로 접속해 Service Worker와 오프라인 기능을 사용하려면, 해당 LAN IP가 인증서에 포함되어 있고 iPhone이 그 인증서를 발급한 로컬 인증 기관을 신뢰해야 합니다.

## 1. mkcert 설치

Windows PowerShell 또는 Windows Terminal에서 실행합니다.

```powershell
winget install FiloSottile.mkcert
```

설치 후 터미널을 완전히 닫고 다시 엽니다.

## 2. LAN HTTPS 인증서 생성

프로젝트 루트에서 실행합니다.

```bash
npm run setup:https
```

이 명령은 다음 작업을 수행합니다.

- 현재 PC의 LAN IPv4 주소를 자동 탐색합니다.
- `localhost`, `127.0.0.1`, `::1`, LAN IPv4 주소가 모두 포함된 인증서를 생성합니다.
- Vite가 사용하는 `certs/dev-key.pem`, `certs/dev-cert.pem`을 생성합니다.
- iPhone에 설치할 `certs/mkcert-rootCA.cer`를 준비합니다.

PC의 IP가 바뀌면 `npm run setup:https`를 다시 실행해야 합니다.

## 3. iPhone에서 인증서 신뢰

1. `certs/mkcert-rootCA.cer` 파일을 AirDrop, iCloud Drive, 메일 등으로 iPhone에 전달합니다.
2. iPhone에서 파일을 열고 프로파일을 설치합니다.
3. `설정 > 일반 > VPN 및 기기 관리`에서 프로파일 설치를 완료합니다.
4. `설정 > 일반 > 정보 > 인증서 신뢰 설정`으로 이동합니다.
5. 설치한 mkcert 루트 인증서의 **완전한 신뢰**를 켭니다.
6. Safari를 앱 전환 화면에서 완전히 종료합니다.

이 인증서는 본인이 관리하는 개발 장치에서만 사용하고, 외부에 공개하거나 저장소에 커밋하지 마세요.

## 4. 개발 서버 실행

```bash
npm run dev
```

출력된 주소 또는 PC에서 확인한 주소로 iPhone Safari에서 접속합니다.

```text
https://PC의-LAN-IP:5173
```

Safari 주소창에 인증서 경고가 없어야 합니다.

## 5. 홈 화면에 설치

iPhone Safari는 PC Chrome처럼 자동 설치 버튼이나 설치 배너를 제공하지 않습니다.

1. Safari의 **공유** 버튼을 누릅니다.
2. **홈 화면에 추가**를 선택합니다.
3. 오른쪽 위의 **추가**를 누릅니다.
4. 홈 화면에 생성된 아이콘으로 실행합니다.

홈 화면 아이콘으로 실행했을 때 Safari의 주소창이 없는 독립 실행 화면이 표시되면 정상입니다.

## 확인 사항

- iPhone과 PC가 같은 Wi-Fi에 연결되어 있어야 합니다.
- Windows 방화벽에서 Node.js 또는 TCP 5173 포트의 사설 네트워크 접근이 허용되어야 합니다.
- 페이지가 단순히 열리는 것과 Service Worker가 활성화되는 것은 다릅니다. iPhone이 HTTPS 인증서를 완전히 신뢰해야 `window.isSecureContext`가 활성화됩니다.
- `npm run setup:https` 실행 후 PC의 LAN IP가 변경되었다면 인증서를 다시 생성해야 합니다.
