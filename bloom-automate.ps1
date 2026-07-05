# bloom-automate.ps1 - Complete Bloom AI Automation
$env:BLOOM_API_KEY = "bloom_sk_YOUR_KEY_HERE"

Write-Host "🌸 BLOOM AI AUTOMATION" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# Step 1: Test connection
Write-Host "`n📡 Testing API..." -ForegroundColor Yellow
node bloom-simple.js test

# Step 2: Create brand
Write-Host "`n🏷️ Creating brand..." -ForegroundColor Yellow
node bloom-simple.js brand "Sovereign Empire Brand" "Created via automation"

# Step 3: Run batch campaign
Write-Host "`n🎨 Running batch campaign..." -ForegroundColor Yellow
node bloom-simple.js batch "Sovereign Empire"

Write-Host "`n✅ Automation complete!" -ForegroundColor Green
Write-Host "📁 Check bloom-batch-results.json for outputs"
