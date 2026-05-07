import { getIni } from './API.js';

let allPosts = [];
let filteredPosts = [];
let currentPage = 1;
let favorites = JSON.parse(localStorage.getItem('novel_favs')) || [];
let showOnlyFavs = false; 

let API_URL = "";

// 取得選單與按鈕元素
const menuContainer = document.getElementById('menuContainer');

/**
 * 初始化應用程式
 */
async function initApp() {
    const iniPath = 'settings/postFB.ini'; 
    const config = await getIni(iniPath);
    
    if (config) {
        // 1. 初始化選單
        if (config.MENU_DATA) {
            initMenu(config.MENU_DATA);
        }

        // 2. 初始化資料 API
        if (config.API_URL) {
            API_URL = atob(config.API_URL);
            await loadData();
        }
    } else {
        console.error("無法載入 INI 設定");
    }
}

/**
 * 動態生成選單內容
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
 * 載入資料
 */
async function loadData() {
    const list = document.getElementById('post-list');
    const localData = localStorage.getItem('cached_novel_data');
    
    if (localData) {
        allPosts = JSON.parse(localData);
        updateTitleDropdown();
        updateDisplay();
    } else {
        list.innerHTML = '<div style="text-align:center; padding:50px; color:#888;">正在載入小說資料...</div>';
    }

    try {
        const res = await fetch(API_URL);
        const newData = await res.json();
        
        if (JSON.stringify(newData) !== localData) {
            allPosts = newData;
            localStorage.setItem('cached_novel_data', JSON.stringify(newData));
            updateTitleDropdown();
            updateDisplay();
        }
    } catch (e) {
        console.error("更新失敗", e);
    }
}

/**
 * 生成組合 ID
 */
function getCombinedId(post) {
    const pid = post["PostID"] || "0";
    let d = (typeof post["發佈日期"] === 'number') 
            ? new Date((post["發佈日期"] - 25569) * 86400 * 1000) 
            : new Date(post["發佈日期"]);
            
    if (isNaN(d.getTime())) return `${pid}_00000000000000`;

    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    
    return `${pid}_${ts}`;
}

/**
 * 渲染文章列表 - 【已補回縮圖生成邏輯】
 */
function renderList(posts) {
    const list = document.getElementById('post-list');
    list.innerHTML = '';
    
    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        
        const dateStr = formatDate(post["發佈日期"]);
        const urlId = getCombinedId(post);
        const isFav = favorites.includes(urlId);

        // --- 核心修正：處理圖片 HTML ---
        const imgData = post["圖片網址"] || post["圖片"] || "";
        let imgHtml = "";
        if (imgData) {
            imgHtml += `<div class="thumb-img-container">`;
            // 抓取前三張圖片作為縮圖
            imgData.split(/\r?\n|\|/).slice(0, 3).forEach(src => {
                const cleanSrc = src.trim();
                if(cleanSrc) {
                    imgHtml += `<img src="${cleanSrc}" class="thumb-img" onerror="this.style.display='none'">`;
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

// --- 其餘功能函數保持不變 ---

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
    const term = document.getElementById('search').value.toLowerCase();
    const selectedTitle = document.getElementById('titleFilter').value; 
    const order = document.getElementById('sortOrder').value;
    const sizeValue = document.getElementById('pageSize').value;
    
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

    document.getElementById('pageNum').innerText = `${currentPage} / ${maxPage}\n共 ${filteredPosts.length} 筆`;
    document.getElementById('prevBtn').disabled = (currentPage === 1);
    document.getElementById('nextBtn').disabled = (currentPage === maxPage);
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
    btn.classList.toggle('active');
    btn.innerText = showOnlyFavs ? '⭐ 顯示全部' : '⭐ 收藏';
    currentPage = 1;
    updateDisplay();
}

function toggleMenu() {
    const menu = document.getElementById('menuContainer');
    if (menu) {
        menu.classList.toggle('show-menu');
    }
}

window.changePage = changePage;
window.toggleFavorite = toggleFavorite;
window.toggleFavFilter = toggleFavFilter;
window.updateDisplay = updateDisplay;
window.toggleMenu = toggleMenu;

window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => console.error("系統初始化失敗:", err));
});
