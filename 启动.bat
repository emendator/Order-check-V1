@echo off
chcp 65001 >nul
title 订单查重管理系统

echo ========================================
echo    订单查重管理系统 - 一键启动脚本
echo ========================================
echo.

:: 获取脚本所在目录
set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

:: -------- 检查 Python 依赖 --------
echo [1/5] 检查 Python 依赖...
cd /d "%BACKEND_DIR%"
pip install -r requirements.txt -q 2>nul
echo     ✓ Python 依赖就绪

:: -------- 检查 npm 依赖 --------
echo [2/5] 检查前端依赖...
cd /d "%FRONTEND_DIR%"
if not exist "node_modules" (
    call npm install
)
echo     ✓ 前端依赖就绪

:: -------- 清理旧进程 --------
echo [3/5] 清理旧进程...
:: 按端口杀进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001 "') do (
    if not "%%a"=="" (
        taskkill /f /pid %%a >nul 2>&1
    )
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (
    if not "%%a"=="" (
        taskkill /f /pid %%a >nul 2>&1
    )
)
:: 额外杀掉残留的 uvicorn 进程
taskkill /f /fi "WINDOWTITLE eq 订单查重-后端" >nul 2>&1
echo     ✓ 端口已清理

:: -------- 启动后端 --------
echo [4/5] 启动后端服务 (端口 8001)...
cd /d "%BACKEND_DIR%"
:: 使用后台隐藏窗口启动，不与终端绑定，避免意外关闭
start /B python -m uvicorn main:app --host 127.0.0.1 --port 8001
echo     等待后端启动...
timeout /t 4 /nobreak >nul
echo     ✓ 后端服务已启动

:: -------- 启动前端 --------
echo [5/5] 启动前端服务 (端口 3000)...
cd /d "%FRONTEND_DIR%"
start "订单查重-前端" cmd /c "npm run dev"
timeout /t 3 /nobreak >nul
echo     ✓ 前端服务已启动

:: -------- 打开浏览器 --------
echo.
echo ========================================
echo    系统启动完成！
echo    前端地址: http://localhost:3000
echo    后端 API: http://localhost:8001/docs
echo ========================================
echo.
start http://localhost:3000
