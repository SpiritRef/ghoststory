import { getIni } from './API.js';

let allPosts = [];
let filteredPosts = [];
let currentPage = 1;
let favorites = JSON.parse(localStorage.getItem('novel_favs')) || [];
let showOnlyFavs = false; 

let API_URL = "";
let JsonData = "";

async function initApp() {
    const iniPath = 'settings/postFB.ini';
    const dataPromise = loadData(); 
    const config = await getIni(iniPath);
    
    if (config) {
        if (config.MENU_DATA) initMenu(config.MENU_DATA);
        if (config.API_URL) {
            API_URL = atob(config.API_URL);
            // 💡 當 INI 解析出 API_URL 後，再告訴 loadData 可以去抓遠端更新了
            window.dispatchEvent(new CustomEvent('apiUrlReady', { detail: API_URL }));
        }
        if(config.JsonData) JsonData = config.JsonData;
    } else {
        console.error("無法載入 INI 設定");
    }
}
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

async function loadData() {
    // --- 第一階段：優先讀取快取 (毫秒級響應) ---
    const localCache = localStorage.getItem('cached_novel_data');
    if (localCache) {
        allPosts = JSON.parse(localCache);
        refreshUI();
    } 

    // --- 第二階段：若快取無資料，則抓取靜態 JSON (GitHub 上的檔案) ---
    // 備註：這裡假設你知道靜態 JSON 的路徑，例如 '../Data/postFB.json'
    if (allPosts.length === 0) {
        try {
            const staticRes = await fetch(JsonData);
            if (staticRes.ok) {
                allPosts = await staticRes.json();
                refreshUI();
            }
        } catch (e) { console.log("本地無預設資料"); }
    }

    // --- 第三階段：等 API_URL 準備好後，再去抓最新資料 ---
    if (API_URL) {
        fetchRemoteData();
    } else {
        // 如果執行到這 API_URL 還沒出來，監聽事件
        window.addEventListener('apiUrlReady', (e) => {
            API_URL = e.detail;
            fetchRemoteData();
        }, { once: true });
    }
}

// 獨立出來的遠端更新邏輯
async function fetchRemoteData() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) return;
        const newData = await res.json();
        
        // 只有在資料真的不同時才重新渲染，避免閃爍
        if (JSON.stringify(newData) !== localStorage.getItem('cached_novel_data')) {
            console.log("⚡ 背景更新完成");
            allPosts = newData;
            localStorage.setItem('cached_novel_data', JSON.stringify(newData));
            refreshUI();
        }
    } catch (e) {
        console.error("API 更新失敗", e);
    }
}

// 提取重複的更新邏輯
function refreshUI() {
    updateTitleDropdown();
    updateDisplay();
}

function getCombinedId(post) {
    const pid = post["PostID"] || "0";
    let d = (typeof post["發佈日期"] === 'number') 
            ? new Date((post["發佈日期"] - 25569) * 86400 * 1000) 
            : new Date(post["發佈日期"]);
    if (isNaN(d.getTime())) return `${pid}_00000000000000`;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pid}_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function renderList(posts) {
    const list = document.getElementById('post-list');
    list.innerHTML = '';
    
    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        
        const dateStr = formatDate(post["發佈日期"]);
        const urlId = getCombinedId(post);
        const isFav = favorites.includes(urlId);

        // 圖片解析 (核心防錯)
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
                  onclick="toggleFavorite('${urlId}', event)">${isFav ? '★' : '☆'}</span>
            <div class="post-date">${dateStr}</div>
            <div class="post-title">${post["標題"] || "無標題"}</div>
            <div class="post-content">${(post["貼文內容"] || "").substring(0, 60)}...</div>
            ${imgHtml} 
        `;

        card.onclick = () => {
            window.location.href = `article.html?id=${urlId}`;
        };
        list.appendChild(card);
    });
}

function updateTitleDropdown() {
    const titleFilter = document.getElementById('titleFilter');
    if (!titleFilter) return;
    titleFilter.innerHTML = '<option value="">📌 所有主題標題</option>';
    const titles = [...new Set(allPosts.map(p => p["標題"]).filter(t => t && String(t).trim() !== ""))];
    titles.sort().forEach(title => {
        const opt = document.createElement('option');
        opt.value = title; opt.innerText = title;
        titleFilter.appendChild(opt);
    });
}

function updateDisplay() {
    const term = document.getElementById('search')?.value.toLowerCase() || "";
    const selectedTitle = document.getElementById('titleFilter')?.value || ""; 
    const order = document.getElementById('sortOrder')?.value || "desc";
    const sizeValue = document.getElementById('pageSize')?.value || "20";
    
    filteredPosts = allPosts.filter(p => {
        const content = (p["貼文內容"] || "").toLowerCase();
        const title = (p["標題"] || "").toLowerCase();
        const contentMatch = content.includes(term) || title.includes(term);
        const titleMatch = selectedTitle === "" || p["標題"] === selectedTitle;
        const favMatch = !showOnlyFavs || favorites.includes(getCombinedId(p));
        return contentMatch && titleMatch && favMatch;
    });

    filteredPosts.sort((a, b) => {
        const dA = new Date(a["發佈日期"] || 0);
        const dB = new Date(b["發佈日期"] || 0);
        return order === 'asc' ? dA - dB : dB - dA;
    });

    const pageSize = sizeValue === 'all' ? filteredPosts.length : parseInt(sizeValue);
    const maxPage = Math.ceil(filteredPosts.length / pageSize) || 1;
    if (currentPage > maxPage) currentPage = maxPage;
    const start = (currentPage - 1) * pageSize;
    const pagedData = filteredPosts.slice(start, start + pageSize);

    const pageNumEl = document.getElementById('pageNum');
    if(pageNumEl) pageNumEl.innerText = `${currentPage} / ${maxPage}\n共 ${filteredPosts.length} 筆`;
    renderList(pagedData);
}

function changePage(step) {
    currentPage += step;
    updateDisplay();
    window.scrollTo(0, 0);
}

function formatDate(raw) {
    if (!raw) return "";
    let d = (typeof raw === 'number') ? new Date((raw - 25569) * 86400 * 1000) : new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

window.changePage = changePage;
window.toggleFavorite = toggleFavorite;
window.toggleFavFilter = toggleFavFilter;
window.updateDisplay = updateDisplay;
window.toggleMenu = toggleMenu;

window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => console.error("系統初始化失敗:", err));
});
