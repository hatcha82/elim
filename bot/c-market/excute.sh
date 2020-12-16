#!/bin/bash

logPath='/home/hatcha82/webDeploy/furigana_bbs/gnuboard5/scheduler/nodejs/yahooPuppeteer'
fileName='db_$(date +%Y%m%d)_$(date +%H%M%S).log' #db_[년월일]_[시분초].log
# 백업 디렉토리는 /logPath/년월/일 을 체크하여 없는 경우 생성
if [ ! -d $logPath/ ]
then
mkdir -p $logPath/
fi
echo ""
echo ""
echo ""
echo "###################      $(date)    #########################" 
echo "################### 번역 시작 $logPath/#########################" 

node $logPath/yahoo.js 


ls $logPath -lh 

lastDay=3
echo "Delete Old File....$lastDay Days" 

find $logPath -ctime $lastDay -name "*.log"
find $logPath -ctime $lastDay -name "*.log" -delete


echo "###################     Result     #########################"
ls $logPath -lh



echo "################### 번역 종료 $logPath/#########################" 
echo "###################      $(date)    #########################" 
echo ""
echo ""
echo ""
echo ""