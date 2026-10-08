import * as utils from './API.js';
import { supabase } from './adminAuth.js';

async function requireSession() {
	const { data } = await supabase.auth.getSession();
	if (!data.session) {
		location.replace('login.html');
		return null;
	}
	return data.session;
}

// --- 1. 配置設定 ---
const iniPath = '/settings/global.ini';
const GITHUB_USER = "SpiritRef";
const GITHUB_REPO = "ghoststory";
const GITHUB_PATH = "pic";
// JSON 備份檔目標：固定檔名，前端 INI 的 JsonData 會指向它
const JSON_REPO = "spiritref.github.io";
const JSON_PATH = "Data/postFB.json";

let updateGithub_URL = "";
let updateData_URL = "";
let novelApiB64 = "";
let finalToken = ""; 

async function initApp() {
	try {
		const config = await utils.getIni(iniPath);
		updateGithub_URL = config.updateGithub_URL; 
		updateData_URL = config.updateData_URL;
		novelApiB64 = config.NOVEL_API_URL || "";
		updateTime();
		console.log("✅ 系統設定載入成功");
	} catch (e) {
		console.error("❌ 初始化失敗:", e);
	}
}

function updateTime() {
	const now = new Date();
	const pad = (n) => n.toString().padStart(2, '0');
	const dateInput = document.getElementById('date');
	if (dateInput) {
		dateInput.value = `${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
	}
}

async function checkUser() {
	const userName = document.getElementById('token').value.trim();
	if (!userName) { alert("請輸入使用者名稱！"); return false; }
	const status = document.getElementById('status');
	status.innerText = "⏳ 正在驗證身分...";
	status.style.color = "orange";
	
	const authUrl = atob(updateGithub_URL);
	try {
		const response = await fetch(authUrl, {
			method: "POST",
			body: JSON.stringify({ action: "getGithubToken", user: userName })
		});
		const result = await response.json();
		if (result.success) {
			finalToken = result.githubToken; 
			status.innerText = "✅ 驗證通過：歡迎 " + userName;
			status.style.color = "green";
			return true;
		} else {
			status.innerText = "❌ 驗證失敗：" + result.message;
			status.style.color = "red";
			return false;
		}
	} catch (e) {
		status.innerText = "⚠️ 驗證連線失敗";
		return false;
	}
}

// --- 核心功能：多檔案上傳 ---
window.uploadToGithub = async function() {
	const session = await requireSession();
	if (!session) return;
	if (!finalToken) {
		const ok = await checkUser();
		if (!ok) return;
	}

	const fileInput = document.getElementById('fileInput');
	const status = document.getElementById('status');
	const picInput = document.getElementById('pic');
	
	if (fileInput.files.length === 0) { alert("請先選擇檔案！"); return; }

	status.innerText = `⏳ 準備上傳 ${fileInput.files.length} 個檔案...`;
	status.style.color = "blue";

	let uploadedPaths = [];
	const now = new Date();
	const pad = (n) => n.toString().padStart(2, '0');
	const dateBase = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + 
					 pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());

	for (let i = 0; i < fileInput.files.length; i++) {
		const file = fileInput.files[i];
		const fileExt = file.name.split('.').pop().toLowerCase();
		const fileName = `${dateBase}${i}.${fileExt}`;
		const filePath = `${GITHUB_PATH}/${fileName}`;

		status.innerText = `⏳ 正在上傳 (${i + 1}/${fileInput.files.length}): ${fileName}`;

		try {
			// 1. 取得 Base64 並進行「深度清洗」
			const base64 = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.readAsDataURL(file);
				reader.onload = () => {
					const raw = reader.result.split(',')[1];
					// 移除任何可能的換行符號或空白，這是引發 500 錯誤的主因
					resolve(raw.replace(/\s/g, '')); 
				};
				reader.onerror = (e) => reject(e);
			});

			const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filePath}`;
			const res = await fetch(apiUrl, {
				method: "PUT",
				headers: {
					"Authorization": `token ${finalToken}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					message: `Upload: ${fileName}`,
					content: base64
				})
			});

			// 2. 安全檢查 Response
			if (res.ok) {
				uploadedPaths.push(filePath);
			} else {
				// 如果失敗，先檢查 Response 是否為 JSON
				const contentType = res.headers.get("content-type");
				let errorDetails = `HTTP ${res.status}`;
				
				if (contentType && contentType.includes("application/json")) {
					const errJson = await res.json();
					errorDetails = errJson.message || errorDetails;
				} else {
					const errText = await res.text();
					console.error("GitHub 非 JSON 報錯:", errText);
				}
				throw new Error(errorDetails);
			}
		} catch (e) {
			console.error("詳細上傳失敗資訊:", e);
			status.innerText = `❌ 部分失敗: ${e.message}`;
			status.style.color = "red";
			return; 
		}
	}

	picInput.value = uploadedPaths.join('|');
	status.innerText = `✅ 成功上傳 ${uploadedPaths.length} 個檔案！`;
	status.style.color = "green";
}

window.sendData = async function() {
	const session = await requireSession();
	if (!session) return;
	if (!finalToken) {
		const ok = await checkUser();
		if (!ok) return;
	}

	const dbUrl = atob(updateData_URL);
	const status = document.getElementById('status');
	status.innerText = "🚀 正在傳送資料至資料庫...";

	try {
		await fetch(dbUrl, {
			method: "POST",
			mode: "no-cors", 
			headers: { "Content-Type": "text/plain" },
			body: JSON.stringify({
				token: document.getElementById('token').value.trim(),
				supabase_token: session.access_token,
				date: document.getElementById('date').value.replaceAll('/', '-') + " +08:00",
				title: document.getElementById('title').value,
				content: document.getElementById('content').value,
				pic: document.getElementById('pic').value 
			})
		});

		status.innerText = "✅ 全數完成！資料已匯入資料庫。";
		status.style.color = "green";

		// 上傳後自動同步全量 JSON 備份
		await window.syncJsonToGithub();
		
		document.getElementById('title').value = "";
		document.getElementById('content').value = "";
		document.getElementById('pic').value = "";
		document.getElementById('fileInput').value = "";
		updateTime();

	} catch (e) {
		status.innerText = "❌ 資料庫匯入失敗。";
		console.error(e);
	}
}

// --- 3. 同步全量 JSON 到 GitHub（上傳後自動呼叫，也可手動重試） ---
function toBase64Utf8(str) {
	const bytes = new TextEncoder().encode(str);
	let bin = "";
	const CH = 0x8000;
	for (let i = 0; i < bytes.length; i += CH) {
		bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
	}
	return btoa(bin);
}

function fromBase64Utf8(b64) {
	const bin = atob(b64.replace(/\s/g, ''));
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return new TextDecoder().decode(bytes);
}

window.syncJsonToGithub = async function() {
	const session = await requireSession();
	if (!session) return;
	if (!finalToken) {
		const ok = await checkUser();
		if (!ok) return;
	}
	const status = document.getElementById('status');
	const apiBase = `https://api.github.com/repos/${GITHUB_USER}/${JSON_REPO}/contents/${JSON_PATH}`;
	const headers = {
		"Authorization": `token ${finalToken}`,
		"Accept": "application/vnd.github.v3+json",
		"Content-Type": "application/json"
	};
	try {
		// 1. 先試 API 全量（Source of truth = 試算表）
		let allData = null;
		if (novelApiB64) {
			try {
				const apiUrl = novelApiB64.startsWith("http") ? novelApiB64 : atob(novelApiB64);
				status.innerText = "⏳ 正在抓取全部內容...";
				status.style.color = "blue";
				const sep = apiUrl.includes('?') ? '&' : '?';
				const res = await fetch(`${apiUrl}${sep}t=${Date.now()}`, { cache: 'no-store' });
				if (res.ok) {
					const j = await res.json();
					if (Array.isArray(j)) allData = j;
				} else {
					console.warn(`API HTTP ${res.status}，改用本機附加模式`);
				}
			} catch (e) {
				console.warn("API 連線失敗，改用本機附加模式:", e);
			}
		}

		let modeNote = "";
		if (!allData) {
			// 2. Fallback：API 死掉時，拉 GitHub 現有 JSON，把表單這筆附加進去
			const title = document.getElementById('title').value.trim();
			const content = document.getElementById('content').value;
			if (!title && !content.trim()) throw new Error("API 連不上且表單已清空，無法附加；請重新填寫後再試，或先重部署 GAS");
			status.innerText = "⚠️ API 連不上，改用本機附加模式...";
			status.style.color = "orange";
			const getRes = await fetch(apiBase, { headers });
			let arr = [];
			if (getRes.ok) {
				arr = JSON.parse(fromBase64Utf8((await getRes.json()).content));
			} else if (getRes.status !== 404) {
				throw new Error(`讀取舊 JSON 失敗: HTTP ${getRes.status}（token 可能沒有 ${JSON_REPO} 寫入權限）`);
			}
			// 防重複送出：最後一筆完全相同就沿用
			const last = arr[arr.length - 1];
			if (!(last && last["標題"] === title && (last["貼文內容"] || "") === content)) {
				const maxId = arr.reduce((m, p) => Math.max(m, Number(p.PostID) || 0), 0);
				const picVal = document.getElementById('pic').value.trim();
				arr.push({
					PostID: maxId + 1,
					"發佈日期": document.getElementById('date').value,
					"標題": title,
					"貼文內容": content,
					"圖片網址": picVal || null
				});
			}
			allData = arr;
			modeNote = "（本機附加暫存，GAS 修好後請再同步一次校正）";
		}

		// 3. 推上 GitHub
		status.innerText = `⏳ 正在上傳 JSON 到 GitHub（共 ${allData.length} 筆）...`;
		status.style.color = "blue";
		let sha = null;
		const getRes2 = await fetch(apiBase, { headers });
		if (getRes2.ok) {
			sha = (await getRes2.json()).sha;
		} else if (getRes2.status !== 404) {
			throw new Error(`讀取舊 JSON 失敗: HTTP ${getRes2.status}（token 可能沒有 ${JSON_REPO} 寫入權限）`);
		}
		const putBody = { message: `Sync ${JSON_PATH}: ${allData.length} posts`, content: toBase64Utf8(JSON.stringify(allData, null, 1)) };
		if (sha) putBody.sha = sha;
		const putRes = await fetch(apiBase, { method: "PUT", headers, body: JSON.stringify(putBody) });
		if (!putRes.ok) {
			const msg = await putRes.text();
			throw new Error(`GitHub 上傳失敗: HTTP ${putRes.status} ${msg.slice(0, 120)}`);
		}
		status.innerText = `✅ JSON 已同步！共 ${allData.length} 筆 → ${JSON_REPO}/${JSON_PATH}${modeNote}`;
		status.style.color = "green";
	} catch (e) {
		console.error("JSON 同步失敗:", e);
		status.innerText = "❌ JSON 同步失敗：" + e.message;
		status.style.color = "red";
	}
}

initApp();
