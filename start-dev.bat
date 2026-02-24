@echo off
REM 前后端联调快速启动脚本（Windows）
REM 用法: 双击运行或在 cmd 中执行 start-dev.bat

chcp 65001 > nul
setlocal enabledelayedexpansion

echo ==========================================
echo 🚀 牌局计分系统 - 前后端联调启动
echo ==========================================
echo.

REM 获取脚本所在目录
set SCRIPT_DIR=%~dp0

echo 【步骤 1/3】检查后端
echo.

REM 检查后端是否运行
echo 检查后端健康状态: http://localhost:3000/api/health
echo.

REM 尝试 ping 后端
timeout /t 1 /nobreak > nul
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -TimeoutSec 3 -ErrorAction Stop; Write-Host '✅ 后端已启动' -ForegroundColor Green; exit 0 } catch { Write-Host '⚠️ 后端未响应' -ForegroundColor Yellow; exit 1 }"

if !errorlevel! equ 0 (
    set BACKEND_RUNNING=1
) else (
    set BACKEND_RUNNING=0
)

if !BACKEND_RUNNING! equ 0 (
    echo.
    echo 需要启动后端。请在另一个 PowerShell 或 CMD 窗口执行：
    echo.
    echo   cd F:\代码\计分系统\后端\poker-scorekeeper
    echo   npm install  ^(首次运行^)
    echo   npm run dev
    echo.
    pause
)

echo.
echo 【步骤 2/3】安装前端依赖
echo.

cd /d "%SCRIPT_DIR%"

if not exist "node_modules" (
    echo node_modules 不存在，正在安装依赖...
    call npm install
    if !errorlevel! equ 0 (
        echo ✅ 依赖安装成功
    ) else (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo ✅ 依赖已安装
)

echo.
echo 【步骤 3/3】启动前端开发服务器
echo.

echo 启动信息：
echo   前端地址: http://localhost:5173
echo   后端地址: http://localhost:3000/api
echo.

echo 按 Ctrl+C 停止服务器
echo.

call npm run dev

pause
