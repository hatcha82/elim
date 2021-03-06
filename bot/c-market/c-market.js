const puppeteer = require('puppeteer')
var moment = require('moment'); // require
require('moment-timezone'); 
var inlineCss = require('inline-css');
var fs = require('fs');
var _ = require('underscore');
var json2xls = require('json2xls');
const Sequelize = require('sequelize')

const config = require('./config/config');
const { exit } = require('process');
const { map } = require('underscore');
var sequelize = new Sequelize(
  config.db.database,
  config.db.user,
  config.db.password,
  config.db.options
)
var browser = {};
moment.tz.setDefault("Asia/Seoul"); 
async function getBidData(headers,cachedFile){
  const page = await browser.newPage()
  await page.tracing.start({
    path: 'trace.json',
    categories: ['devtools.timeline']
  })
  var url = "https://www.c-market.net/login?reqUrl=%2Fb2b%2Fcustomer%2Flogin.asp" // "https://www.c-market.net/b2b/customer/login.asp"

  await page.goto(url, {waitUntil: 'networkidle2', timeout: 0})
  console.log(`크롤링 리스트 가져오기: 시작`);     
  
  var param = {
    selector : '',
    value :  ''        
  }  
  var idSelector = "#loginId1"
  var pwdSelect = "#loginPw1"
  var loginButnSelector  = "#contents > div > div > div.contents_inner > div.cell_box > div:nth-child(2) > div.login_btn.clearfix > div > a" //"#formLogin > table > tbody > tr > td > table > tbody > tr:nth-child(1) > td:nth-child(3) > input";
  await page.waitForSelector(loginButnSelector);
  param = {selector : idSelector,value : config.cMarket.user }
  //await page.evaluate(param => {document.querySelector(param.selector).value = param.value}, param);
  await page.type(param.selector, param.value, {delay: 100});
  param = {selector : pwdSelect,value :config.cMarket.pass}

  await page.type(param.selector, param.value, {delay: 100});
  //await page.evaluate(param => {document.querySelector(param.selector).value = param.value}, param);
  
  await Promise.all([
    page.click(loginButnSelector),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    
]);
///  await page.waitForResponse(request => request.url() === 'https://www.c-market.net/b2b/index.asp')


  // execute standard javascript in the context of the page.
  // newsList = await page.$$eval('#newsFeed > ul.newsFeed_list > li> div > a.newsFeed_item_link', anchors => { 
  //   return anchors.map(anchor => { 
  //     return {wr_subject: anchor.innerText, link : anchor.href }
  //   })
  // })    
  // console.log(`크롤링 리스트 가져오기: 종료`);    
  // var newsPage = await browser.newPage()
  // await page.goto(url, {waitUntil: 'networkidle2', timeout: 0})
  console.log("Login OK")
  await page.goto(config.cMarket.host+ '/supplier/board/list?boardType=P', {waitUntil: 'networkidle2', timeout: 0}) 
  
  
  var tableSelector = '.table_bd';

  var currentTotalBidCountSelector = '#frmSearch > section > div.page_search > div.search_in.clearfix > div.search_total > span > i'
  var currentTotalBidCount = await page.$$eval(currentTotalBidCountSelector, contents =>  { return contents.map(content => content.innerText) }) 
  console.log(`Total : ${currentTotalBidCount}`)
  currentTotalBidCount = parseInt(currentTotalBidCount + "".split(',').join())
  var data = [];
  var per = 15;
  var paging =  Math.ceil(currentTotalBidCount/per);  
  if(cachedFile.length > 0){
   // paging = 5;
   // console.log(`Caching 정보가 존재합니다. 최근 ${paging}페이지만 스캔합니다.`)  
  }
  console.log(`Paging Count : ${paging}`)
  for(var i =1; i <= paging; i++){
    var random = Math.floor(Math.random() * 3) +2;
    await page.waitFor(random * 1000)
    console.log(`${i}번째 페이지 데이터를 가져오는 중입니다..`)
    
    var url = config.cMarket.host + `/supplier/board/list?keyword_search=N&cmvType=&area_search=N&area=%EC%84%9C%EC%9A%B8&searchText=&sortType=A&buy_idx=&boardType=P&rowsPerPage=${per}&currentPage=${i}&myList=`
    
    await page.goto(url, {waitUntil: 'networkidle2', timeout: 0}) 
    await page.waitForSelector(tableSelector);
    var pageData = await page.$$eval(tableSelector, rows => {
      return Array.from(rows, (row,rowSeq )=> {
        const columns = row.querySelectorAll('.tbB_list');
        return Array.from(columns, (column,idx)=> { 
          return {
            rowSeq : rowSeq, 
            idx : (idx % 7) , 
            value :column.querySelector('a') && column.querySelector('a').getAttribute("title") ? column.querySelector('a').getAttribute("title") : column.innerText
          }
        });
      });
    });
    pageData.shift(pageData)
   
    data = data.concat(pageData)
    if(cachedFile.length > 0){
      console.log(` ${data.length } / ${per * paging}`)
    }else{
      console.log(` ${data.length } / ${currentTotalBidCount}`)
    }
  }



  
  console.log("Data Fetch OK")
  data = data.map((row,idx) => {
      var newObj = {};
      newObj['rowIndex'] = idx;
      headers.map(header => {        
         newObj[header.key] = _.where(row,{idx: header.idx})[0].value;

      })      
      return newObj;
  })
  return data;
}
async function createHtml(headers,data,templateName){
  var headerHtml = `<tr>`
  headers.map(header => {
    headerHtml+=`<th>${header.title}</th>`
  })
  headerHtml+=`</tr>`
 
  var bodyHtml =``

  data.map((row,idx) => {
    bodyHtml +=`<tr>`
    headers.map(header => {
      bodyHtml+=`<th class="${header.class}">${row[header.key]}</th>`
    })
    bodyHtml +=`</tr>`
  })

  var html = ''
  
  try {
    html = await fs.readFileSync(templateName, 'utf8')      
  } catch (error) {
    html = '';
  }
  html =html.replace('[now]',moment(). format('YYYY-MM-DD HH:mm:ss'))
  html =html.replace('[header]',headerHtml)
  html = html.replace('[body]',bodyHtml)
  html = await inlineCss(html, {url :'test.html'})
  return html;
}
async function mailSend(title, bodyHtml,attachmentInfo){

  return new Promise((resolve,reject)=>{
    var nodemailer = require('nodemailer');
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      auth: {
        user: config.email.user,
        pass: config.email.pass
      }
    });
    var mailOptions = {
      from: config.email.user,
      to: config.sendTarget.email,
      subject: title,
      html: bodyHtml,
      attachments:[
        {   // stream as an attachment
          filename: attachmentInfo.filename,
          content: fs.createReadStream(attachmentInfo.filename)
        }
      ]
    };
    
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
        resolve(false); 
      } else {
        console.log('Email sent: ' + info.response);
        resolve(true); 
      }
    });

  })

}
(async () => {  
  browser = await puppeteer.launch({ headless: true,args: ['--no-sandbox',`--window-size=1080,680`]})
  
  var cacheFileName = __dirname +`/data/${moment(). format('YYYY-MM-DD')}.json`;
  var cachedFile = [];
  try {
    cachedFile = await fs.readFileSync(cacheFileName, 'utf8')  
    cachedFile = JSON.parse(cachedFile);
  } catch (error) {
    console.log(error)
    cachedFile = [];
  }
  var headers = [
      {idx: 0 , key: 'BID_NO',title : '공고번호', class:''}
    , {idx: 1 , key: 'BUYER',title : '발주기관', class:''}
    , {idx: 2 , key: 'BID_NM',title : '공고명' , class:''}
    , {idx: 3 , key: 'BID_CNT',title : '응찰' , class:''}
    , {idx: 4 , key: 'BID_DUE',title : '마감일시' , class:'align-left'}    
  ]
 

  
  var data = await getBidData(headers,cachedFile)

    data = _.sortBy(data,'BUYER');
  data = data.filter(data => {
    if(cachedFile.length > 0 && _.where(cachedFile, {BID_NO: data.BID_NO}).length > 0){
      return false;
    }else if(data.BUYER.indexOf('우체국') != -1){
      return true;
    }else{
      return false;
    }
  })
  data = _.sortBy(data,'BUYER');

  if(data.length > 0){

    try {
      var bodyHtml = await createHtml(headers,data, __dirname + '/template.html')
      var buyerList = _.uniq(_.pluck(data,'BUYER'))
      var fileName =  __dirname +`/data/${moment(). format('YYYY-MM-DD_HHmmss')}`;
      var title =`[새로운 입찰] `
      title += buyerList.length > 5 ? buyerList.slice(0,5).join() + '... 외 ' + (buyerList.length - 5) + '건' : buyerList.join();      
      var fileData = JSON.stringify(data,null,'\t')
      var jsonFile = fileName + '.json';
      await fs.writeFileSync(jsonFile,  fileData, { mode: 0o755 });
      var htmlFile = fileName + '.html';
      await fs.writeFileSync(htmlFile,  bodyHtml, { mode: 0o755 });
      var excelFile = fileName + '.xls';
      var exceData = data.map((row,idx) => {
        var newObj = {};
        headers.map(header => {
              newObj[header.title] = row[header.key]
        })      
        return newObj;
      })
      var xls = json2xls(exceData);         
      await fs.writeFileSync(excelFile, xls,{encoding:'binary', flag:'w'} );
     

      
      await mailSend(title,bodyHtml, {filename : excelFile})   
      await fs.unlinkSync(jsonFile);
      await fs.unlinkSync(htmlFile);
      await fs.unlinkSync(excelFile);
    } catch (error) {
      console.log(error)  
    }
    
    
  }else{
    console.log(`${data.length } 새로운 입찰건이 없습니다.`)
  }
  
  data = cachedFile.concat(data);
  data = _.sortBy(data,'BID_NO');
  data = data.reverse();
  fileData = JSON.stringify(data,null,'\t')
  
  jsonFile = cacheFileName;
  await fs.writeFileSync(cacheFileName,  fileData ,  { mode: 0o755 });
  // var htmlFile = fileName + '.html';
  // await fs.writeFileSync(htmlFile,  bodyHtml);
  // var excelFile = fileName + '.xls';
  // xls = json2xls(data);    
  // await fs.writeFileSync(excelFile, xls, 'binary');


  var endTime = 31;  
  console.log('프로세스종료를 시작 합니다...') 
  setInterval(function(){
    console.log(--endTime + '초')
  },1000)    
  setTimeout(function(){  
    console.log('프로세스를 종료합니다...')  
    process.exit(1);
  },endTime * 1000)
 
})()
