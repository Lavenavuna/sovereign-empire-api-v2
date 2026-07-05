logo.html
<!DOCTYPE html>
<html>
<head>
    <title>Sovereign Empire AI Logo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0f0c29;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: 'Segoe UI', Arial, sans-serif;
            flex-direction: column;
            gap: 30px;
        }
        .logo-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 60px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(102, 126, 234, 0.4);
        }
        .logo {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .symbol {
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.12);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 44px;
            border: 2px solid rgba(255,255,255,0.25);
        }
        .text { color: #fff; }
        .text h1 { font-size: 36px; font-weight: 700; letter-spacing: 2px; }
        .text .sub { font-size: 14px; opacity: 0.75; letter-spacing: 5px; text-transform: uppercase; }
        .text .tagline { font-size: 11px; opacity: 0.5; margin-top: 4px; letter-spacing: 1px; }
        .download-btn {
            background: rgba(255,255,255,0.1);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.2);
            padding: 12px 30px;
            border-radius: 10px;
            font-size: 14px;
            cursor: pointer;
        }
        .download-btn:hover { background: rgba(255,255,255,0.2); }
    </style>
</head>
<body>
    <div class="logo-container" id="logoContainer">
        <div class="logo">
            <div class="symbol">⚡</div>
            <div class="text">
                <h1>SOVEREIGN EMPIRE</h1>
                <div class="sub">AI PLATFORM</div>
                <div class="tagline">✦ Autonomous Agents · 24/7 Automation ✦</div>
            </div>
        </div>
    </div>
    <button class="download-btn" onclick="downloadPNG()">📥 Download PNG</button>
    <p style="color:#666; font-size:12px;">Click the button to download the logo</p>

    <script>
        function downloadPNG() {
            const container = document.getElementById('logoContainer');
            const script = document.createElement('script');
            script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
            script.onload = function() {
                html2canvas(container, {
                    backgroundColor: null,
                    scale: 3,
                    useCORS: true
                }).then(function(canvas) {
                    const link = document.createElement('a');
                    link.download = 'Sovereign_Empire_AI_Logo.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                });
            };
            document.head.appendChild(script);
        }
    </script>
</body>
</html>