const puppeteer = require("puppeteer");
async function run() {
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    
    page.on("request", req => {
        if (req.method() === "POST" && req.url().includes("api")) {
            console.log("POST URL:", req.url());
            console.log("POST DATA:", req.postData());
        }
    });

    await page.goto("https://dichvucong.gov.vn/tra-cuu-thu-tuc/danh-sach?showAdvanced=true&searchType=MINISTRY&formalityType=STANDARD&implementingLevel=MINISTRY&limit=10&activeKey=STANDARD", { waitUntil: "networkidle2" });
    
    await page.evaluate(() => {
        const tabs = document.querySelectorAll("div.ant-tabs-tab-btn");
        for (let tab of tabs) {
            if (tab.innerText.includes("liên thông")) {
                tab.click();
            }
        }
    });
    
    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
}
run().catch(console.error);
