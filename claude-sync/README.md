# Claude Code 환경 동기화

맥북(iTerm2)과 윈도우(PowerShell) 양쪽에서 Claude Code의 플러그인 / MCP 서버 / 권한 설정을 동일하게 맞추기 위한 파일들입니다.

## 포함된 것

- `settings.json` — `~/.claude/settings.json`에 들어가는 내용 중 두 기기에 공통으로 적용할 부분(설치된 플러그인, 마켓플레이스, 권한, 테마). statusLine은 기기마다 경로가 달라 제외했습니다.
- `mcp-servers.sh` / `mcp-servers.ps1` — MCP 서버 5개(supabase, context7, playwright, chrome-devtools, youtube-transcript)를 등록하는 스크립트. 각 OS에 맞는 걸 실행하세요.
- `.env.example` — MCP 서버 중 API 키가 필요한 것(context7)의 템플릿. 실제 키는 `.env`에 넣고 커밋하지 마세요.

## 새 기기에서 설정하는 순서

1. 이 저장소를 clone
2. `~/.claude/settings.json`을 열어서 `claude-sync/settings.json`의 `enabledPlugins`, `extraKnownMarketplaces`, `permissions`, `theme` 항목을 병합 (완전히 덮어쓰지 말고 기존 값과 합치세요)
3. `claude-sync/.env.example`을 `claude-sync/.env`로 복사하고 `CONTEXT7_API_KEY` 값을 채우기 (키는 1Password 등 비밀번호 관리자나 기존 기기의 `~/.claude.json` 안 `mcpServers.context7.headers`에서 확인)
4. 환경변수 불러온 뒤 스크립트 실행
   - 맥/Git Bash: `set -a; source claude-sync/.env; set +a && bash claude-sync/mcp-servers.sh`
   - 윈도우 PowerShell: `$env:CONTEXT7_API_KEY = (Get-Content claude-sync/.env | Select-String CONTEXT7_API_KEY).ToString().Split('=')[1]; .\claude-sync\mcp-servers.ps1`
5. Claude Code를 재시작하고 `claude-hud:setup` 스킬을 실행해 그 기기에 맞는 statusLine을 새로 생성 (`/claude-hud:setup` 입력)
6. `claude mcp list`로 5개 서버가 모두 연결됐는지 확인

## 주의사항

- `.env`는 절대 커밋하지 마세요 (`.gitignore`에 포함되어 있음)
- `~/.claude/settings.local.json`은 기기별 로컬 전용이라 동기화 대상이 아닙니다
- supabase는 OAuth 방식이라 새 기기에서 처음 쓸 때 브라우저 로그인 창이 뜰 수 있습니다
- 훅(hooks)을 나중에 추가한다면 bash 스크립트는 윈도우 네이티브 PowerShell에서 그대로 못 돌아가니 `.ps1` 버전을 따로 준비하세요
