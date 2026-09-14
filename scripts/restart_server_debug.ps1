
$pidToKill = 43888
Write-Host "Killing Process $pidToKill..."
Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue

$env:PORT = "3000"
$env:MP_WEBHOOK_SECRET = "testing123"
# Ensure we are in root or server dir?
# The script is in scripts/, Cwd is root.
# node server/index.js requires Cwd to be root so require('./config') works relative to server/index.js?
# Wait. require('./config') from server/index.node is relative to file.
# But dotenv might look for .env in CWD.
# We should run from server/ directory to be safe, or root.
# Usually root.

Write-Host "Starting Server..."
$proc = Start-Process -FilePath "node" -ArgumentList "server/index.js" -RedirectStandardOutput "server_debug.log" -RedirectStandardError "server_debug.log" -PassThru -NoNewWindow
Write-Host "Server Started with PID $($proc.Id)"
