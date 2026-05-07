import { getIni } from './API.js';

let allPosts = [];
let filteredPosts = [];
let currentPage = 1;
let favorites = JSON.parse(localStorage.getItem('novel_favs')) || [];
let showOnlyFavs = false; 

let API_URL = "";
let appConfig = {};

// 取得選單與按鈕元素
const menuContainer = document.getElementById('menuContainer');
const serviceIcon = document.getElementById('serviceIcon');

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

function renderList(posts) {
    const list = document.getElementById('post-list');
    list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    posts.forEach(post => {
        const card = document.createElement('div');
        card.className = 'post-card';
        const summary = (post["貼文內容"] || "").substring(0, 60) + "...";
        const date = formatDate(post["發佈日期"]);
        const imgData = post["圖片網址"] || post["圖片"] || "";
        const isFav = favorites.includes(post["ID"] || post["發佈日期"]);
        const favStar = `<span class="fav-btn ${isFav ? 'active' : ''}" 
                    onclick="toggleFavorite('${post["ID"] || post["發佈日期"]}', event)">
                    ${isFav ? '★' : '☆'}</span>`;
                    
        let imgHtml = "";
        if (imgData) {
            imgHtml += `<div class="thumb-img-container">`;
            imgData.split(/\r?\n|\|/).slice(0,3).forEach(src => {
                if(src.trim()) imgHtml += `<img src="${src.trim()}" class="thumb-img" onerror="this.style.display='none'">`;
            });
            imgHtml += `</div>`;
        }
        card.innerHTML = `
            ${favStar}
            <div class="post-date">${date}</div>
            <div class="post-title">${post["標題"] || "無標題"}</div>
            <div class="post-content">${summary}</div>
            ${imgHtml}
        `;
        card.onclick = () => openModal(date, post["標題"], post["貼文內容"], imgData);
        fragment.appendChild(card);
    });
    list.appendChild(fragment);
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
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

// --- 核心修改：進入文章模式 ---
function openModal(date, title, body, imgData) {
    document.getElementById('modal-header-title').innerText = title || "無標題";
    document.getElementById('modal-date').innerText = date;
    
    const imgContainer = document.getElementById('modal-images');
    imgContainer.innerHTML = "";
    if (imgData) {
        imgData.split(/\r?\n|\|/).forEach(src => {
            if(src.trim()) imgContainer.innerHTML += `<img src="${src.trim()}" class="modal-img">`;
        });
    }
    
    document.getElementById('modal-body').innerText = body;
    document.getElementById('postModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    document.querySelector('.modal-body-scroll').scrollTop = 0; 

    // 切換選單按鈕狀態：移到右下角、變換圖示為「三字元」
    if (menuContainer) {
        menuContainer.classList.add('minimized');
        if (serviceIcon) serviceIcon.innerText = '☰';
    }
}

// --- 核心修改：關閉文章模式 ---
function closeModal() {
    document.getElementById('postModal').style.display = 'none';
    document.body.style.overflow = 'auto';

    // 恢復選單按鈕狀態：回原位、恢復書本圖示、關閉已展開內容
    if (menuContainer) {
        menuContainer.classList.remove('minimized');
        menuContainer.classList.remove('show-menu');
        if (serviceIcon) serviceIcon.innerText = '📜';
    }
}

// --- 核心修改：處理導航按鈕點擊 ---
function toggleMenu() {
    // 如果目前在「文章模式 (minimized)」
    if (menuContainer && menuContainer.classList.contains('minimized')) {
        menuContainer.classList.toggle('show-menu');
    } else {
        // 如果是一般模式，點擊直接跳轉服務頁面
        window.location.href = "../services/";
    }
}

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

function toggleFavFilter() {
    showOnlyFavs = !showOnlyFavs;
    const btn = document.getElementById('favToggle');
    btn.classList.toggle('active');
    btn.innerText = showOnlyFavs ? '⭐ 顯示全部' : '⭐ 收藏';
    currentPage = 1;
    updateDisplay();
}

// 點擊 Modal 背景也可觸發關閉與按鈕恢復
window.onclick = function(event) {
    const modal = document.getElementById('postModal');
    if (event.target == modal) {
        closeModal();
    }
};

// 掛載到 window 提供 HTML 調用
window.changePage = changePage;
window.toggleFavorite = toggleFavorite;
window.toggleFavFilter = toggleFavFilter;
window.closeModal = closeModal;
window.updateDisplay = updateDisplay;
window.toggleMenu = toggleMenu; // 確保 HTML 的 onclick="toggleMenu()" 可運作

// 啟動
window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => {
        console.error("系統初始化失敗，可能是 API 網址解碼錯誤或連線問題:", err);
    });
});
