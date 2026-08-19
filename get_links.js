const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function getLinks() {
    const formalityTypes = ['STANDARD', 'INTERCONNECTED'];
    let urlsToCrawl = [];
    
    for (let fType of formalityTypes) {
        // Đà Nẵng
        urlsToCrawl.push(`https://dichvucong.gov.vn/tra-cuu-thu-tuc/danh-sach?showAdvanced=true&searchType=PROVINCE&formalityType=${fType}&province=H17&limit=10&activeKey=${fType}`);
        // Bộ ngành
        urlsToCrawl.push(`https://dichvucong.gov.vn/tra-cuu-thu-tuc/danh-sach?showAdvanced=true&searchType=MINISTRY&formalityType=${fType}&implementingLevel=MINISTRY&limit=10&activeKey=${fType}`);
    }

    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    const csvPath = path.join(__dirname, 'crawl_tthc', 'danhsach.csv');
    let allLinks = ["url"]; // Dòng tiêu đề CSV
    
    // Tạm bỏ chức năng đọc file cũ để lấy lại đúng link 2 URL này theo yêu cầu của user

    for (let url of urlsToCrawl) {
        console.log("Đang truy cập trang chủ để lấy Session:", url);
        let retries = 3;
        while(retries > 0) {
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));
                break;
            } catch (e) {
                console.log(`Lỗi truy cập ${url}: ${e.message}. Đang thử lại...`);
                retries--;
                if(retries === 0) throw e;
                await new Promise(r => setTimeout(r, 5000));
            }
        }
        
        const urlObj = new URL(url);
        const searchType = urlObj.searchParams.get('searchType') || "PROVINCE";
        const departmentCode = urlObj.searchParams.get('province') || "";
        const level = urlObj.searchParams.get('implementingLevel') || "UNKNOWN";
        const formalityType = urlObj.searchParams.get('formalityType') || "STANDARD";
        
        console.log(`Đang chạy API nội bộ quét toàn bộ link (searchType: ${searchType}, level: ${level}, formalityType: ${formalityType})...`);
        const result = await page.evaluate(async (dept, lvl, type, fType) => {
            let items = [];
            let lastId = "";
            let hasMore = true;
            
            while (hasMore) {
                let data = null;
                let fetchRetries = 5;
                while (fetchRetries > 0) {
                    try {
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
                                "formalityType": fType
                            })
                        });
                        
                        data = await res.json();
                        break; // Success!
                    } catch (err) {
                        console.error('Fetch lỗi, đang thử lại...', err.message);
                        fetchRetries--;
                        if(fetchRetries === 0) throw err;
                        await new Promise(r => setTimeout(r, 5000));
                    }
                }
                
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
        }, departmentCode, level, searchType, formalityType);
        
        console.log(`-> Tìm thấy ${result.length} link thủ tục.`);
        allLinks = allLinks.concat(result);
    }

    await browser.close();

    const uniqueLinksSet = new Set(allLinks);
    
    // Add 5 manual interconnected links
    uniqueLinksSet.add("https://dichvucong.gov.vn/thu-tuc-hanh-chinh-lien-thong/234778");
    uniqueLinksSet.add("https://dichvucong.gov.vn/thu-tuc-hanh-chinh-lien-thong/341088");
    uniqueLinksSet.add("https://dichvucong.gov.vn/thu-tuc-hanh-chinh-lien-thong/341089");
    uniqueLinksSet.add("https://dichvucong.gov.vn/thu-tuc-hanh-chinh-lien-thong/409857");
    uniqueLinksSet.add("https://dichvucong.gov.vn/thu-tuc-hanh-chinh-lien-thong/420163");

    fs.writeFileSync(csvPath, [...uniqueLinksSet].join('\n'), 'utf-8');
    
    console.log(`\nHoàn tất! Tổng cộng đang có ${uniqueLinksSet.size - 1} link duy nhất trong file danhsach.csv`);
}

getLinks().catch(console.error);
