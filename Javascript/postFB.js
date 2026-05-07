import { getIni } from './API.js';

let allPosts = [];
let filteredPosts = [];
let currentPage = 1;
let favorites = JSON.parse(localStorage.getItem('novel_favs')) || [];
let showOnlyFavs = false; 

let API_URL = "";

// 取得選單與按鈕元素
const menuContainer = document.getElementById('menuContainer');
const serviceIcon = document.getElementById('serviceIcon');

/**
 * 初始化應用程式
 */
async function initApp() {
    const iniPath = 'settings/postFB.ini'; 
    const config = await getIni(iniPath);
    
    if (config && config.API_URL) {
        API_URL = atob(config.API_URL);
        await loadData();
    } else {
        console.error("無法從 INI 取得 API_URL");
    }
}

/**
 * 載入資料（優先從快取讀取，再從 API 更新）
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
        
        // 如果新資料與快取不同，則更新
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
 * 更新主題下拉選單
 */
function updateTitleDropdown() {
    const titleFilter = document.getElementById('titleFilter');
    if (!titleFilter) return;
    titleFilter.innerHTML = '<option value="">📌 所有主題標題</option>';

    const titles = [...new Set(allPosts.map(p => p["標題"]).filter(t => t && String(t).trim() !== ""))];
    titles.sort(); 
    
    titles.forEach(title => {
        const opt = document.createElement('option');
        opt.value = title;
        opt.innerText = title;
        titleFilter.appendChild(opt);
    });
}

/**
 * 更新畫面顯示（過濾、排序、分頁）
 */
function updateDisplay() {
    const term = document.getElementById('search').value.toLowerCase();
    const titleSelect = document.getElementById('titleFilter');
    const selectedTitle = titleSelect ? titleSelect.value : ""; 
    const order = document.getElementById('sortOrder').value;
    const sizeValue = document.getElementById('pageSize').value;
    
    filteredPosts = allPosts.filter(p => {
        const content = (p["貼文內容"] || "").toLowerCase();
        const title = (p["標題"] || "").toLowerCase();
        const contentMatch = content.includes(term) || title.includes(term);
        const titleMatch = selectedTitle === "" || p["標題"] === selectedTitle;
        const favMatch = !showOnlyFavs || favorites.includes(p["ID"] || p["發佈日期"]);
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

/**
 * 渲染文章列表卡片
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

function renderList(posts) {
    const list = document.getElementById('post-list');
    list.innerHTML = '';
    
    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        
        const dateStr = formatDate(post["發佈日期"]);
        const urlId = getCombinedId(post); // 生成如 "391_20260506200400"
        const isFav = favorites.includes(urlId);

        card.innerHTML = `
            <span class="fav-btn ${isFav ? 'active' : ''}" 
                  onclick="toggleFavorite('${urlId}', event)">${isFav ? '★' : '☆'}</span>
            <div class="post-date">${dateStr}</div>
            <div class="post-title">${post["標題"] || "無標題"}</div>
            <div class="post-content">${(post["貼文內容"] || "").substring(0, 60)}...</div>
        `;

        // 跳轉網址
        card.onclick = () => {
            window.location.href = `article.html?id=${urlId}`;
        };
        list.appendChild(card);
    });
}

/**
 * 分頁切換
 */
function changePage(step) {
    currentPage += step;
    updateDisplay();
    window.scrollTo(0, 0);
}

/**
 * 日期格式化
 */
function formatDate(raw) {
    if (!raw) return "";
    let d = (typeof raw === 'number') ? new Date((raw - 25569) * 86400 * 1000) : new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

/**
 * 收藏功能
 */
function toggleFavorite(postId, event) {
    event.stopPropagation(); 
    const index = favorites.indexOf(postId);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(postId);
    }
    localStorage.setItem('novel_favs', JSON.stringify(favorites));
    updateDisplay(); 
}

/**
 * 切換只顯示收藏
 */
function toggleFavFilter() {
    showOnlyFavs = !showOnlyFavs;
    const btn = document.getElementById('favToggle');
    btn.classList.toggle('active');
    btn.innerText = showOnlyFavs ? '⭐ 顯示全部' : '⭐ 收藏';
    currentPage = 1;
    updateDisplay();
}

/**
 * 選單切換邏輯
 */
function toggleMenu() {
    // 列表頁模式下，點擊按鈕直接跳轉服務項目
    window.location.href = "../services/";
}

// 掛載到 window 提供 HTML 調用
window.changePage = changePage;
window.toggleFavorite = toggleFavorite;
window.toggleFavFilter = toggleFavFilter;
window.updateDisplay = updateDisplay;
window.toggleMenu = toggleMenu;

// 啟動程式
window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => {
        console.error("系統初始化失敗:", err);
    });
});
