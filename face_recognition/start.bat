@echo off
cd /d %~dp0
call venv\Scripts\activate.bat
echo ============================================
echo  Shelter Monitoring - Face Recognition
echo ============================================
echo.
echo Memastikan wajah sudah di-enroll...
python src/stage2/stage2_face_recognition.py diagnose
echo.
echo Memulai face recognition...
python src/stage1/webcam_test.py --recognize --cam-index 0
pause
