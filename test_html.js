const puppeteer = require("puppeteer");
async function run() {
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto("https://dichvucong.gov.vn/tra-cuu-thu-tuc/danh-sach?showAdvanced=true&searchType=MINISTRY&formalityType=INTERCONNECTED&implementingLevel=MINISTRY&limit=100&activeKey=INTERCONNECTED", { waitUntil: "networkidle2" });
    const html = await page.content();
    console.log("HTML length:", html.length);
    const matches = html.match(/href="\/thu-tuc-hanh-chinh\/([^"]+)/g);
    console.log(matches ? Array.from(new Set(matches)) : "None");
    await browser.close();
}
run().catch(console.error);
