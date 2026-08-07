const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function getLinks() {
    const urlsToCrawl = [
        "https://dichvucong.gov.vn/tra-cuu-thu-tuc/danh-sach?showAdvanced=true&searchType=MINISTRY&formalityType=STANDARD&implementingLevel=UNKNOWN&limit=10&activeKey=STANDARD",
        "https://dichvucong.gov.vn/tra-cuu-thu-tuc/danh-sach?showAdvanced=true&searchType=PROVINCE&formalityType=STANDARD&province=H17&implementingLevel=PROVINCE&limit=10&activeKey=STANDARD",
        "https://dichvucong.gov.vn/tra-cuu-thu-tuc/danh-sach?showAdvanced=true&searchType=PROVINCE&formalityType=STANDARD&province=H17&implementingLevel=COMMUNE&limit=10&activeKey=STANDARD"
    ];

    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    const csvPath = path.join(__dirname, 'crawl_tthc', 'danhsach.csv');
    let allLinks = ["url"]; // Dòng tiêu đề CSV
    
    // Đọc file CSV cũ để không mất dữ liệu
    if (fs.existsSync(csvPath)) {
        const existingData = fs.readFileSync(csvPath, 'utf-8');
        allLinks = existingData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }

    for (let url of urlsToCrawl) {
        console.log("Đang truy cập trang chủ để lấy Session:", url);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));
        
        const urlObj = new URL(url);
        const searchType = urlObj.searchParams.get('searchType') || "PROVINCE";
        const departmentCode = urlObj.searchParams.get('province') || "";
        const level = urlObj.searchParams.get('implementingLevel') || "PROVINCE";
        
        console.log(`Đang chạy API nội bộ quét toàn bộ link (searchType: ${searchType}, level: ${level})...`);
        const result = await page.evaluate(async (dept, lvl, type) => {
            let items = [];
            let lastId = "";
            let hasMore = true;
            
            while (hasMore) {
                const res = await fetch('/api/v1/submitting/formality/list-all-public-formality-by-citizen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        "limit": 100,
                        "lastId": lastId,
                        "q": "",
                        "categoryId": "",
                        "departmentCode": dept,
                        "type": type,
                        "level": lvl,
                        "formalityType": "STANDARD"
                    })
                });
                
                const data = await res.json();
                const newItems = data?.data?.items || [];
                if (newItems.length === 0) {
                    hasMore = false;
                } else {
                    items = items.concat(newItems);
                    lastId = data.data.lastId;
                    if (!lastId) hasMore = false;
                }
            }
            return items.map(item => `https://dichvucong.gov.vn/thu-tuc-hanh-chinh/${item.id}`);
        }, departmentCode, level, searchType);
        
        console.log(`-> Tìm thấy ${result.length} link thủ tục.`);
        allLinks = allLinks.concat(result);
    }

    await browser.close();

    const uniqueLinks = [...new Set(allLinks)];
    fs.writeFileSync(csvPath, uniqueLinks.join('\n'), 'utf-8');
    
    console.log(`\nHoàn tất! Tổng cộng đang có ${uniqueLinks.length - 1} link duy nhất trong file danhsach.csv`);
}

getLinks().catch(console.error);
