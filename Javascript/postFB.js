import { getIni } from './API.js';

let allPosts = [];
let filteredPosts = [];
let currentPage = 1;
let favorites = JSON.parse(localStorage.getItem('novel_favs')) || [];
let showOnlyFavs = false; 

let API_URL = "";
let JsonData = "";

/**
 * 1. 系統初始化
 */
async function initApp() {
    const iniPath = 'https://spiritref.github.io/settings/global.ini';
    const config = await getIni(iniPath);
    
    if (config) {
        if (config.MENU_DATA) initMenu(config.MENU_DATA);
        if (config.JsonData) JsonData = config.JsonData; 
        
        // 啟動資料讀取程序
        loadData(); 

        if (config.API_URL) {
            API_URL = atob(config.API_URL);
            // 廣播 API 已就緒
            window.dispatchEvent(new CustomEvent('apiUrlReady', { detail: API_URL }));
        }
    } else {
        console.error("無法載入 INI 設定檔");
    }
}

/**
 * 2. 選單初始化
 */
function initMenu(menuData) {
    const menuContent = document.getElementById('menuContent');
    if (!menuContent) return;
    const items = menuData.split('|');
    menuContent.innerHTML = ''; 
    items.forEach(item => {
        const parts = item.split(',');
        if (parts.length >= 3) {
            const [text, link, icon] = parts;
            const a = document.createElement('a');
            a.href = link;
            a.className = 'menu-item';
            a.innerHTML = `<span class="icon">${icon}</span> <span class="text">${text}</span>`;
            menuContent.appendChild(a);
        }
    });
}

/**
 * 3. 資料載入策略 (快取優先 -> 靜態備份 -> 遠端同步)
 */
async function loadData() {
    // A. 優先讀取快取 (達成秒開)
    const localCache = localStorage.getItem('cached_novel_data');
    if (localCache) {
        allPosts = JSON.parse(localCache);
        refreshUI();
    } 

    // B. 若無快取，則抓取靜態備份
    if (allPosts.length === 0 && JsonData) {
        try {
            const staticRes = await fetch(JsonData);
            if (staticRes.ok) {
                allPosts = await staticRes.json();
                refreshUI();
            }
        } catch (e) { console.log("本地靜態資料載入失敗"); }
    }

    // C. 處理遠端最新資料同步
    if (API_URL) {
        fetchRemoteData();
    } else {
        window.addEventListener('apiUrlReady', (e) => {
            API_URL = e.detail;
            fetchRemoteData();
        }, { once: true });
    }
}

/**
 * 4. 漸進式遠端更新邏輯
 */
async function fetchRemoteData() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) return;
        const newData = await res.json();
        
        // 只有在資料真的有變動時才處理
        if (JSON.stringify(newData) !== localStorage.getItem('cached_novel_data')) {
            allPosts = newData;
            
            // 💡 步驟一：立即渲染 UI (優先顯示首頁文章)
            console.log("⚡ 優先渲染首頁內容...");
            refreshUI();

            // 💡 步驟二：後台處理重型任務 (存入快取)
            setTimeout(() => {
                localStorage.setItem('cached_novel_data', JSON.stringify(newData));
                console.log("✅ 背景資料庫快取同步完成");
            }, 200);
        }
    } catch (e) {
        console.error("遠端同步失敗:", e);
    }
}

function refreshUI() {
    updateTitleDropdown();
    updateDisplay();
}

/**
 * 5. 核心顯示邏輯 (搜尋、排序、分頁)
 */
function updateDisplay() {
    const term = document.getElementById('search')?.value.toLowerCase() || "";
    const selectedTitle = document.getElementById('titleFilter')?.value || ""; 
    const order = document.getElementById('sortOrder')?.value || "desc";
    const sizeValue = document.getElementById('pageSize')?.value || "20";
    
    // A. 執行過濾
    filteredPosts = allPosts.filter(p => {
        const content = (p["貼文內容"] || "").toLowerCase();
        const title = (p["標題"] || "").toLowerCase();
        const contentMatch = content.includes(term) || title.includes(term);
        const titleMatch = selectedTitle === "" || p["標題"] === selectedTitle;
        const favMatch = !showOnlyFavs || favorites.includes(getCombinedId(p));
        return contentMatch && titleMatch && favMatch;
    });

    // B. 執行排序
    filteredPosts.sort((a, b) => {
        const dA = (typeof a["發佈日期"] === 'number') ? (a["發佈日期"] - 25569) : new Date(a["發佈日期"]).getTime();
        const dB = (typeof b["發佈日期"] === 'number') ? (b["發佈日期"] - 25569) : new Date(b["發佈日期"]).getTime();
        return order === 'asc' ? dA - dB : dB - dA;
    });

    // C. 分頁計算
    const pageSize = sizeValue === 'all' ? filteredPosts.length : parseInt(sizeValue);
    const maxPage = Math.ceil(filteredPosts.length / pageSize) || 1;
    if (currentPage > maxPage) currentPage = maxPage;
    if (currentPage < 1) currentPage = 1;

    // D. 💡 更新跳頁選單內容
    updateJumpSelect(maxPage);

    // E. 渲染資料
    const start = (currentPage - 1) * pageSize;
    const pagedData = filteredPosts.slice(start, start + pageSize);

    const pageNumEl = document.getElementById('pageNum');
    if(pageNumEl) pageNumEl.innerText = `/ ${maxPage} 頁 (共 ${filteredPosts.length} 筆)`;
    
    document.getElementById('prevBtn').disabled = (currentPage === 1);
    document.getElementById('nextBtn').disabled = (currentPage >= maxPage);

    renderList(pagedData);
}

/**
 * 6. 更新跳頁選單 (Jump Select)
 */
function updateJumpSelect(maxPage) {
    const select = document.getElementById('pageJump');
    if (!select) return;
    
    let options = "";
    for (let i = 1; i <= maxPage; i++) {
        options += `<option value="${i}" ${i === currentPage ? 'selected' : ''}>${i}</option>`;
    }
    select.innerHTML = options;
}

/**
 * 7. 渲染文章列表到 HTML
 */
function renderList(posts) {
    const list = document.getElementById('post-list');
    if (!list) return;
    list.innerHTML = '';
    
    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        
        const dateStr = formatDate(post["發佈日期"]);
        const urlId = getCombinedId(post);
        const isFav = favorites.includes(urlId);

        let imgData = post["圖片網址"] || post["圖片"] || "";
        let imgHtml = "";

        if (typeof imgData === 'string' && imgData.trim() !== "") {
            imgHtml = `<div class="thumb-img-container">`;
            imgData.split(/\r?\n|\|/).slice(0, 3).forEach(src => {
                const cleanSrc = src.trim();
                if(cleanSrc) {
                    imgHtml += `<img src="${cleanSrc}" class="thumb-img" loading="lazy" onerror="this.style.display='none'">`;
                }
            });
            imgHtml += `</div>`;
        }

        card.innerHTML = `
            <span class="fav-btn ${isFav ? 'active' : ''}" 
                  onclick="window.toggleFavorite('${urlId}', event)">${isFav ? '★' : '☆'}</span>
            <div class="post-date">${dateStr}</div>
            <div class="post-title">${post["標題"] || "無標題"}</div>
            <div class="post-content">${(post["貼文內容"] || "").substring(0, 65)}...</div>
            ${imgHtml} 
        `;

        card.onclick = () => {
            window.location.href = `article/?id=${urlId}`;
        };
        list.appendChild(card);
    });
}

/**
 * 8. 輔助函式 (ID生成、日期、標題選單)
 */
function getCombinedId(post) {
    const pid = post["PostID"] || "0";
    let d = (typeof post["發佈日期"] === 'number') 
            ? new Date((post["發佈日期"] - 25569) * 86400 * 1000) 
            : new Date(post["發佈日期"]);
    if (isNaN(d.getTime())) return `${pid}_00000000000000`;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pid}_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function formatDate(raw) {
    if (!raw) return "無日期";
    let d = (typeof raw === 'number') ? new Date((raw - 25569) * 86400 * 1000) : new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateTitleDropdown() {
    const titleFilter = document.getElementById('titleFilter');
    if (!titleFilter) return;
    const currentVal = titleFilter.value;
    titleFilter.innerHTML = '<option value="">📌 所有主題標題</option>';
    const titles = [...new Set(allPosts.map(p => p["標題"]).filter(t => t && String(t).trim() !== ""))];
    titles.sort().forEach(title => {
        const opt = document.createElement('option');
        opt.value = title; opt.innerText = title;
        if (title === currentVal) opt.selected = true;
        titleFilter.appendChild(opt);
    });
}

/**
 * 9. 事件處理與全域掛載
 */
function changePage(step) {
    const sizeValue = document.getElementById('pageSize')?.value || "20";
    const pageSize = sizeValue === 'all' ? filteredPosts.length : parseInt(sizeValue);
    const maxPage = Math.ceil(filteredPosts.length / pageSize) || 1;
    
    let newPage = currentPage + step;
    if (newPage >= 1 && newPage <= maxPage) {
        currentPage = newPage;
        updateDisplay();
        window.scrollTo(0, 0);
    }
}

function toggleFavorite(postId, event) {
    event.stopPropagation(); 
    const index = favorites.indexOf(postId);
    if (index > -1) favorites.splice(index, 1);
    else favorites.push(postId);
    localStorage.setItem('novel_favs', JSON.stringify(favorites));
    updateDisplay(); 
}

function toggleFavFilter() {
    showOnlyFavs = !showOnlyFavs;
    const btn = document.getElementById('favToggle');
    if(btn) {
        btn.classList.toggle('active');
        btn.innerText = showOnlyFavs ? '⭐ 顯示全部' : '⭐ 收藏';
    }
    currentPage = 1;
    updateDisplay();
}

function toggleMenu() {
    const menu = document.getElementById('menuContainer');
    if (menu) menu.classList.toggle('show-menu');
}

// 💡 註冊全域函式供 HTML 事件調用
window.changePage = changePage;
window.toggleFavorite = toggleFavorite;
window.toggleFavFilter = toggleFavFilter;
window.updateDisplay = updateDisplay;
window.toggleMenu = toggleMenu;
window.jumpToPage = () => {
    const select = document.getElementById('pageJump');
    if (select) {
        currentPage = parseInt(select.value);
        updateDisplay();
        window.scrollTo(0, 0);
    }
};

// 系統啟動
window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => console.error("啟動失敗:", err));
});
window.toggleMenu = function() {
    const menu = document.getElementById('menuContainer');
    if (menu) menu.classList.toggle('show-menu');
};

window.jumpToPage = function() {
    const select = document.getElementById('pageJump');
    if (select && window.updateDisplay) {
        // 觸發自定義跳頁事件或直接修改全域變數
        window.currentPage = parseInt(select.value);
        window.updateDisplay();
        window.scrollTo(0, 0);
    }
};
