const puppeteer = require('puppeteer')
const sharp = require('sharp')
const { exec } = require('child_process')
const fs = require('fs')
const { setTimeout } = require('timers/promises')
require('dotenv').config()

const cooldown = ms => new Promise(resolve => setTimeout(resolve, ms))

const webshot = async () => {
  try {
    const browser = await puppeteer.launch({
      //executablePath: '/usr/bin/chromium-browser', //delete for windows user
      args: ['--no-sandbox'],
    })
    const page = await browser.newPage()

    const url = process.env.GRAFANA_URL
    const selector = process.env.SELECTOR

    if (!url || !selector) {
      throw new Error("URL or SELECTOR not found!")
    }

    await page.setViewport({ 
      width: parseInt(process.env.LEBAR), 
      height: parseInt(process.env.TINGGI) 
    })

    const waitTime = parseInt(process.env.WAIT_TIME)
    console.log(`Navigating to URL: ${url}`)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: waitTime })

    console.log(`Waiting element: ${selector}`)
    await page.waitForSelector(selector, { timeout: waitTime })

    const element = await page.$(selector)
    const boundingBox = await element.boundingBox()
    console.log('Bounding Box:', boundingBox);

    console.log('Catching screenshot...')
    const screenshotBuffer = await page.screenshot()
    const imageMetadata = await sharp(screenshotBuffer).metadata();
    
    const cropArea = {
      x: Math.max(0, boundingBox.x),
      y: Math.max(0, boundingBox.y),
      width: Math.min(boundingBox.width, imageMetadata.width - boundingBox.x),
      height: Math.min(boundingBox.height, imageMetadata.height - boundingBox.y),
    };
    

    
    
    // Validate crop area against screenshot dimensions
    
    setTimeout(() => {
      console.log('Image Metadata:', imageMetadata);
      console.log('Crop Area:', cropArea);
    }, 5000);
    /*
    if (
      cropArea.x < 0 || cropArea.y < 0 ||
      cropArea.width <= 0 || cropArea.height <= 0 ||
      cropArea.x + cropArea.width > imageMetadata.width ||
      cropArea.y + cropArea.height > imageMetadata.height
    ) {
      throw new Error('Invalid crop area: Dimensions are out of bounds or zero.');
    }
    */

    console.log('Cropping screenshot...')
    const croppedImageBuffer = await sharp(screenshotBuffer)
      .extract({
        left: Math.round(cropArea.x),
        top: Math.round(cropArea.y),
        width: Math.round(cropArea.width),
        height: Math.round(cropArea.height),
      })
      .toBuffer()
    const path = require('path')
    const outputPath = process.env.OUTPUT_DIR || path.resolve(__dirname, './pic/webshot.png');     
    await sharp(croppedImageBuffer).toFile(outputPath)
    console.log(`Screenshot completely saved in: ${outputPath}`)

    // Mengirim file ke Telegram dan whatsapp
    //const chatId = process.env.TELEGRAM_CHAT_ID
    //const telegramBotToken = process.env. TELEGRAM_BOT_TOKEN
    const grupID = process.env.WA_GROUP_ID;
    const waApiUrl = process.env.WA_API_URL;
    const title = process.env.TITLE
    
    const timestamp = new Date().toLocaleString();
    
    if ( !grupID|| !waApiUrl) {
      throw new Error("Something not found!")
    }

    const caption = `${title} | ${timestamp} (WIB)`

    //const telegramCurl = `curl -X POST -F "chat_id=${chatId}" -F "photo=@${outputPath}" -F "caption=${caption} " https://api.telegram.org/bot${telegramBotToken}/sendPhoto`
    const waCurl = `curl -X POST -F "phone=${grupID}" -F "view_once=false" -F "caption=${caption}" -F "image=${outputPath}" -F "compress=false" ${waApiUrl}`

    const execCurl = `${waCurl}` 
    console.log(execCurl)
    console.log(`Trying to sending screenshot...`)
    exec(execCurl, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing curl: ${error.message}`)
        return
      }

      fs.unlink(outputPath, (err) => {
        if (err) {
            console.error(`Error deleting file: ${err.message}`);
        } else {
            console.log(`File deleted: ${outputPath}`);
        }
      })
    })

    await browser.close()
  } catch (error) {
    console.error(`Error!: ${error.message}`)
  }
}

//Send Interval
const interval = async () => {
  while (true) {
    await webshot()
    await cooldown(50000)
  }
}
interval()

