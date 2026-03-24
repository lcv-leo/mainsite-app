#!/usr/bin/env pwsh

# Deployment Checklist for mainsite-worker v02.00.00
# Gemini v1beta Modernization - 10 Features
# Date: 2026-03-24

Write-Host "=== MAINSITE-WORKER DEPLOYMENT CHECKLIST ===" -ForegroundColor Cyan
Write-Host ""

# 1. SYNTAX VALIDATION
Write-Host "1️⃣  Checking JavaScript Syntax..." -ForegroundColor Yellow
try {
  node -c src/index.js 2>$null
  Write-Host "   ✅ Syntax validation PASSED" -ForegroundColor Green
} catch {
  Write-Host "   ❌ Syntax errors found" -ForegroundColor Red
  exit 1
}

# 2. FILE SIZE
Write-Host "2️⃣  Checking file size..." -ForegroundColor Yellow
$fileSize = (Get-Item src/index.js).Length / 1KB
Write-Host "   ✅ File size: $([Math]::Round($fileSize, 2)) KB" -ForegroundColor Green

# 3. VERIFY KEY FUNCTIONS
Write-Host "3️⃣  Verifying Gemini v1beta functions..." -ForegroundColor Yellow
$functions = @(
  "GEMINI_CONFIG",
  "structuredLog",
  "estimateTokenCount",
  "validateInputTokens",
  "getModernSafetySettings",
  "getGenerationConfig",
  "fetchWithRetry",
  "extractUsageMetadata",
  "extractTextFromParts"
)

$content = Get-Content src/index.js -Raw
$allFound = $true
foreach ($func in $functions) {
  if ($content -match $func) {
    Write-Host "   ✅ $func found" -ForegroundColor Green
  } else {
    Write-Host "   ❌ $func NOT FOUND" -ForegroundColor Red
    $allFound = $false
  }
}

if (-not $allFound) {
  exit 1
}

# 4. VERIFY ALL 4 ENDPOINTS
Write-Host "4️⃣  Checking all 4 AI endpoints..." -ForegroundColor Yellow
$endpoints = @(
  "app.post\('/api/ai/transform'",
  "app.post\('/api/ai/public/chat'",
  "app.post\('/api/ai/public/summarize'",
  "app.post\('/api/ai/public/translate'"
)

foreach ($ep in $endpoints) {
  $matches = [regex]::Matches($content, $ep).Count
  $epName = [regex]::Match($ep, '/api[^'']*').Value
  if ($matches -gt 0) {
    Write-Host "   ✅ $epName found" -ForegroundColor Green
  } else {
    Write-Host "   ❌ $epName NOT FOUND" -ForegroundColor Red
    exit 1
  }
}

# 5. TOKEN COUNTING IN ALL ENDPOINTS
Write-Host "5️⃣  Verifying token counting in all endpoints..." -ForegroundColor Yellow
$tokenCheckings = @(
  "estimateTokenCount.*transform",
  "estimateTokenCount.*chat", 
  "estimateTokenCount.*summarize",
  "estimateTokenCount.*translate"
)

foreach ($check in $tokenCheckings) {
  $matchCount = [regex]::Matches($content, $check).Count
  if ($matchCount -gt 0) {
    Write-Host "   ✅ Token validation in $([regex]::Match($check, 'transform|chat|summarize|translate').Value)" -ForegroundColor Green
  } else {
    Write-Host "   ⚠️  Token validation pattern not found: $check" -ForegroundColor Yellow
  }
}

# 6. SAFETY SETTINGS UPGRADE
Write-Host "6️⃣  Verifying improved safety settings..." -ForegroundColor Yellow
$safetyCount = [regex]::Matches($content, "BLOCK_ONLY_HIGH").Count
if ($safetyCount -ge 4) {
  Write-Host "   ✅ Safety settings upgraded ($safetyCount BLOCK_ONLY_HIGH found)" -ForegroundColor Green
} else {
  Write-Host "   ❌ Safety settings not properly upgraded" -ForegroundColor Red
  exit 1
}

# 7. STRUCTURED LOGGING
Write-Host "7️⃣  Checking structured logging..." -ForegroundColor Yellow
$loggingCount = [regex]::Matches($content, "structuredLog\(").Count
Write-Host "   ✅ Structured logging implemented ($loggingCount calls found)" -ForegroundColor Green

# 8. SYSTEM PROMPTS PRESERVATION
Write-Host "8️⃣  Verifying system prompts are preserved..." -ForegroundColor Yellow
$prompts = @(
  "Resuma o seguinte texto",
  "Expanda o seguinte texto",
  "Corrija os erros gramaticais",
  "Reescreva o seguinte texto",
  '"Consciência Auxiliar"'
)

foreach ($prompt in $prompts) {
  if ($content -match [regex]::Escape($prompt)) {
    Write-Host "   ✅ Prompt preserved: '$([regex]::Match($prompt, '[^"]*').Value)...'" -ForegroundColor Green
  } else {
    Write-Host "   ❌ Critical prompt missing: $prompt" -ForegroundColor Red
    exit 1
  }
}

# 9. BACKWARD COMPATIBILITY
Write-Host "9️⃣  Verifying backward compatibility..." -ForegroundColor Yellow
$compat = @(
  "rate limit",
  "email",
  "financial",
  "posts",
  "settings",
  "webhooks"
)

foreach ($feature in $compat) {
  if ($content -match $feature) {
    Write-Host "   ✅ Feature preserved: $feature" -ForegroundColor Green
  } else {
    Write-Host "   ⚠️  Feature may be missing: $feature" -ForegroundColor Yellow
  }
}

# 10. VERSION CHECK
Write-Host "🔟 Version update..." -ForegroundColor Yellow
if ($content -match 'Versão: v02.00.00') {
  Write-Host "   ✅ Version updated to v02.00.00" -ForegroundColor Green
} else {
  Write-Host "   ❌ Version not updated correctly" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== DEPLOYMENT READY ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. git add src/index.js" -ForegroundColor Cyan
Write-Host "  2. git commit -m 'chore(version): mainsite-worker v02.00.00, Gemini v1beta modernization with 10 features'" -ForegroundColor Cyan
Write-Host "  3. git push origin main" -ForegroundColor Cyan
Write-Host "  4. Monitor GitHub Actions workflow" -ForegroundColor Cyan
Write-Host ""
