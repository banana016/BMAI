# 윈도우 PowerShell에서 실행.
# 실행 전: Copy-Item .env.example .env 로 복사 후 CONTEXT7_API_KEY 값을 채우고
#         $env:CONTEXT7_API_KEY = "<값>" 으로 직접 설정한 뒤 이 스크립트를 실행하세요.

if (-not $env:CONTEXT7_API_KEY) {
    throw "CONTEXT7_API_KEY 환경변수를 먼저 설정하세요 (.env.example 참고)"
}

claude mcp add --scope user --transport http supabase "https://mcp.supabase.com/mcp?read_only=true"
claude mcp add --scope user --transport http context7 "https://mcp.context7.com/mcp" --header "CONTEXT7_API_KEY: $($env:CONTEXT7_API_KEY)"
claude mcp add --scope user playwright -- npx -y "@playwright/mcp@latest"
claude mcp add --scope user chrome-devtools -- npx -y chrome-devtools-mcp@latest
claude mcp add --scope user youtube-transcript -- npx -y "@sinco-lab/mcp-youtube-transcript"

Write-Host "완료. 'claude mcp list' 로 확인하세요. supabase는 첫 사용 시 브라우저 OAuth 로그인이 뜰 수 있습니다."
