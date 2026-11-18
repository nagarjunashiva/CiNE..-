@echo off
title CiNE Backend Server (MongoDB + Nodemailer)
cd /d "%~dp0\server"
echo ======================================================
echo  Starting CiNE Backend (MongoDB + Nodemailer)...
echo ======================================================
node server.js
pause
