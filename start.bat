@echo off
chcp 65001 >nul
title 合同阅读器 - 一键启动

echo ====================================================
echo   合同阅读器 - 一键启动
echo   本地 AI (Ollama) + 网页界面，全程不联网
echo ====================================================
echo.

REM 切到脚本所在目录（不管双击启动还是命令行启动都对）
cd /d "%~dp0"

REM ---- 第 1 步：检查 Ollama 是否在跑 ----
echo [1/4] 检查 Ollama 是否在跑...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
  echo    Ollama 没在跑，尝试帮你启动 ollama serve...
  start "" "ollama" "serve"
  echo    等待 Ollama 启动（最多 15 秒）...
  set /a i=0
  :wait_ollama
  set /a i+=1
  timeout /t 1 /nobreak >nul
  curl -s http://localhost:11434/api/tags >nul 2>&1
  if %errorlevel% neq 0 (
    if !i! lss 15 goto wait_ollama
    echo.
    echo   [警告] Ollama 还是连不上。请手动打开 Ollama（任务栏羊驼图标）后再试。
    echo   装 Ollama：去 https://ollama.com/download 下载安装。
    echo.
    pause
    exit /b 1
  )
)
echo    [OK] Ollama 在跑
echo.

REM ---- 第 2 步：第一次跑要装依赖 ----
if not exist "node_modules" (
  echo [2/4] 第一次启动，正在装依赖（用淘宝镜像，约 1 分钟）...
  call npm install --registry=https://registry.npmmirror.com
  if %errorlevel% neq 0 (
    echo    [失败] npm install 报错，看上面的日志
    pause
    exit /b 1
  )
  echo    [OK] 依赖装好了
) else (
  echo [2/4] 依赖已存在，跳过安装
)
echo.

REM ---- 第 3 步：确认 PDF worker 文件 ----
if not exist "public\pdf.worker.min.mjs" (
  echo [3/4] 没找到 public\pdf.worker.min.mjs，正在从 node_modules 复制...
  if not exist "public" mkdir public
  copy /Y "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" "public\pdf.worker.min.mjs" >nul
  if %errorlevel% neq 0 (
    echo    [失败] 复制失败，请手动把 node_modules\pdfjs-dist\build\pdf.worker.min.mjs 拷到 public\
    pause
    exit /b 1
  )
  echo    [OK] worker 文件就绪
) else (
  echo [3/4] PDF worker 已就绪
)
echo.

REM ---- 第 4 步：起 Next dev server ----
echo [4/4] 启动网页（首次冷启动慢一点，等 5-10 秒）...
echo.

REM 用 start /b 让窗口不阻塞，单独开个窗口跑 npm run dev
start "合同阅读器-Dev" /D "%~dp0" cmd /c "npm run dev"

REM 等端口 3000 起来再开浏览器
echo    等待端口 3000 就绪...
set /a j=0
:wait_port
set /a j+=1
timeout /t 1 /nobreak >nul
netstat -an | find ":3000" | find "LISTENING" >nul
if %errorlevel% neq 0 (
  if !j! lss 30 goto wait_port
)

echo.
echo ====================================================
echo   [成功] 打开浏览器访问：
echo           http://localhost:3000
echo.
echo   关掉网页：从任务栏右键"羊驼 Ollama"图标选退出，
echo           或者结束"合同阅读器-Dev"窗口。
echo ====================================================
echo.

start "" "http://localhost:3000"

REM 不要立刻关掉，给老大看到结果
timeout /t 5 /nobreak >nul
endlocal
