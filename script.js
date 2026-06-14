// =========================================================================
// 1. KONFIGURASI DATABASE & WEBHOOK
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyD9BmV4XKXuMWa4PZHpb7Bbt-rHs61m3lE",
  authDomain: "absensi-polri.firebaseapp.com",
  databaseURL: "https://absensi-polri-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "absensi-polri",
  storageBucket: "absensi-polri.firebasestorage.app",
  messagingSenderId: "19006760644",
  appId: "1:19006760644:web:b7dac0410e47877ded4b91",
  measurementId: "G-82KHRYZBN0"
};

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1500117207969960079/SYsNhmAeoiO1Exsl-dAIqG2RYoJy546mrRGTvIIjGmQJbOA-XrF17bK8GXXYS5khuUf8";
const DISCORD_ROLE_TAG = "<@&1481911914404642846>";

const OWNER_USERNAME = "@nathanael_0918";
const OWNER_PASSWORD = "owner_raya_2026"; 

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
let currentCmsTab = "news"; 
let currentAuthMode = "register";
let isOwnerBypassed = false; 

// =========================================================================
// 2. INISIALISASI WEBSITE LANGSUNG (BEBAS GPS / INSTAN SELURUH INDONESIA)
// =========================================================================
function initWebsiteDirectly() {
    // 1. Dengarkan status maintenance mode global
    listenToMaintenanceMode();

    // 2. Langsung buka interface utama website
    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
        appContainer.classList.remove('hidden');
    }

    // 3. Muat seluruh relasi fungsional dari Firebase
    loadNewsFromFirebase();
    listenToAccessList(); 
    listenToGlobalSettings();
    listenToApprovalList(); 
    startRealtimeSecurityCheck(); 
    checkActiveUserSession(); 
}

// =========================================================================
// 3. SISTEM REALTIME MAINTENANCE MODE
// =========================================================================
function listenToMaintenanceMode() {
    database.ref('maintenance_status').on('value', (snapshot) => {
        const isMaintenance = snapshot.val() || false;
        const mBlocker = document.getElementById('maintenanceBlocker');
        const statusLabel = document.getElementById('maintenanceStatusLabel');

        if (statusLabel) {
            statusLabel.innerText = isMaintenance ? "Status: AKTIF (Website Terkunci Massal)" : "Status: MATI (Website Normal Publik)";
            statusLabel.style.color = isMaintenance ? "#ff1744" : "#00e676";
        }

        if (isMaintenance) {
            if (sessionStorage.getItem("roleActive") === "owner" || isOwnerBypassed) {
                mBlocker.classList.add('hidden');
            } else {
                mBlocker.classList.remove('hidden');
            }
        } else {
            mBlocker.classList.add('hidden');
            isOwnerBypassed = false; 
        }
    });
}

function setMaintenanceMode(status) {
    database.ref('maintenance_status').set(status).then(() => {
        alert(status ? "WEBSITE BERHASIL DIKUNCI MASAL (MAINTENANCE AKTIF)!" : "WEBSITE KEMBALI NORMAL UNTUK PUBLIK!");
    });
}

function bypassMaintenanceMode() {
    const enteredPass = document.getElementById('maintenanceBypassPass').value;
    if (enteredPass === OWNER_PASSWORD) {
        alert("Bypass Diterima! Selamat Datang Owner. Membuka gerbang utama...");
        isOwnerBypassed = true;
        
        document.getElementById('maintenanceBlocker').classList.add('hidden');
        openAdminPortal();
        
        document.getElementById('loginType').value = 'owner';
        toggleLoginFields();
        document.getElementById('usernameInput').value = OWNER_USERNAME;
        document.getElementById('passwordInput').value = OWNER_PASSWORD;
    } else {
        alert("Password salah! Akses bypass ditolak keras.");
    }
}

function startRealtimeSecurityCheck() {
    setInterval(() => {
        const currentAdmin = sessionStorage.getItem("adminActive");
        const role = sessionStorage.getItem("roleActive");

        if (currentAdmin && role === 'admin') {
            database.ref('whitelist_admins/' + currentAdmin.toLowerCase()).once('value', (snapshot) => {
                if (!snapshot.exists()) {
                    sessionStorage.clear();
                    alert("Akses Anda telah dicabut oleh Owner!");
                    window.location.reload();
                }
            });
        }
    }, 3000);
}

// =========================================================================
// 4. MASTER SETTINGS & AUDIO ENGINE
// =========================================================================
function listenToGlobalSettings() {
    database.ref('global_settings').on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        const config = snapshot.val();

        if (config.logoUrl) {
            document.getElementById('webLogoImg').src = config.logoUrl;
            document.getElementById('setWebLogo').value = config.logoUrl;
        }

        if (config.backgroundUrl) {
            document.getElementById('webBody').style.backgroundImage = `url('${config.backgroundUrl}')`;
            document.getElementById('setWebBackground').value = config.backgroundUrl;
        } else {
            document.getElementById('webBody').style.backgroundImage = 'none';
        }

        if (config.musicUrl) document.getElementById('setWebMusic').value = config.musicUrl;
        if (config.volume) {
            document.getElementById('setWebVolume').value = config.volume;
            document.getElementById('volumeValLabel').innerText = config.volume + "%";
        }

        renderAudioPlayer(config.musicUrl, config.volume || 50);
    });
}

function renderAudioPlayer(url, volume) {
    const container = document.getElementById('musicPlayerContainer');
    if (!url) { container.innerHTML = ""; return; }

    let videoId = "";
    if (url.includes("v=")) videoId = url.split("v=")[1].split("&")[0];
    else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1].split("?")[0];

    if (videoId) {
        container.innerHTML = `<iframe id="ytGlobalPlayer" width="100" height="100" src="https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&enablejsapi=1" allow="autoplay"></iframe>`;
    }
}

function saveGlobalSettings() {
    const logoUrl = document.getElementById('setWebLogo').value.trim();
    const backgroundUrl = document.getElementById('setWebBackground').value.trim();
    const musicUrl = document.getElementById('setWebMusic').value.trim();
    const volume = document.getElementById('setWebVolume').value;

    database.ref('global_settings').set({ logoUrl, backgroundUrl, musicUrl, volume })
    .then(() => { alert("PENGATURAN GLOBAL SUKSES DISIMPAN!"); })
    .catch(err => alert("Gagal menyimpan: " + err.message));
}

document.addEventListener('input', function(e) {
    if(e.target && e.target.id === 'setWebVolume') {
        document.getElementById('volumeValLabel').innerText = e.target.value + "%";
    }
});

document.addEventListener('click', () => {
    const iframe = document.getElementById('ytGlobalPlayer');
    if (iframe) {
        iframe.contentWindow.postMessage('{"event":"command","func":"unmute","args":""}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    }
}, { once: true });

// =========================================================================
// 5. PORTAL AUTENTIKASI MEMBER KOMENTAR
// =========================================================================
function openUserAuthPortal() {
    document.getElementById('navOverlay').style.display = 'none';
    document.getElementById('mainPortal').classList.add('hidden');
    document.getElementById('adminPortal').classList.add('hidden');
    document.getElementById('userAuthPortal').classList.remove('hidden');
}

function closeAllPortals() {
    document.getElementById('userAuthPortal').classList.add('hidden');
    document.getElementById('adminPortal').classList.add('hidden');
    document.getElementById('mainPortal').classList.remove('hidden');
}

function switchAuthMode(mode) {
    currentAuthMode = mode;
    const tReg = document.getElementById('tabReg');
    const tLog = document.getElementById('tabLog');
    const btn = document.getElementById('authSubmitBtn');
    const title = document.getElementById('authTitle');

    if (mode === 'register') {
        tReg.style.backgroundColor = "#e53935"; tLog.style.backgroundColor = "#444";
        title.innerText = "Registrasi Akun Member"; btn.innerText = "Kirim Pengajuan Pendaftaran";
    } else {
        tLog.style.backgroundColor = "#e53935"; tReg.style.backgroundColor = "#444";
        title.innerText = "Login Member Komentar"; btn.innerText = "Masuk Sebagai Member";
    }
}

function handleUserRegister() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    if (!username || !password) return alert("Lengkapi data kolom!");
    if (username.includes(" ")) return alert("Username tidak boleh mengandung spasi!");

    if (currentAuthMode === 'register') {
        database.ref('comment_users/' + username.toLowerCase()).once('value', (snap) => {
            if (snap.exists()) {
                alert("Username tersebut sudah terdaftar!");
            } else {
                database.ref('comment_users/' + username.toLowerCase()).set({
                    username: username, password: password, status: 'pending', commentCount: 5, lastResetTime: Date.now()
                }).then(() => {
                    alert("Pendaftaran diajukan! Menunggu persetujuan Owner.");
                    document.getElementById('authUsername').value = "";
                    document.getElementById('authPassword').value = "";
                });
            }
        });
    } else {
        database.ref('comment_users/' + username.toLowerCase()).once('value', (snap) => {
            if (snap.exists() && snap.val().password === password) {
                localStorage.setItem("member_username", snap.val().username);
                alert("Login Member Sukses!");
                checkActiveUserSession();
                closeAllPortals();
            } else { alert("Username atau Password salah!"); }
        });
    }
}

function checkActiveUserSession() {
    const memberUser = localStorage.getItem("member_username");
    const badge = document.getElementById('userSessionBadge');
    
    if (memberUser) {
        database.ref('comment_users/' + memberUser.toLowerCase()).on('value', (snap) => {
            if(!snap.exists()) { logoutMember(); return; }
            const u = snap.val();
            let sisaKomentar = u.commentCount;
            let statusTeks = u.status === 'approved' ? '🚀 VERIFIED MEMBER' : (u.status === 'rejected' ? '⚠️ LIMIT MODE ACTIVE' : '⏳ PENDING REVIEW');
            
            if (u.status !== 'approved') {
                const waktuSekarang = Date.now();
                if (waktuSekarang - u.lastResetTime >= 6 * 60 * 1000) {
                    sisaKomentar = 5;
                    database.ref('comment_users/' + memberUser.toLowerCase()).update({ commentCount: 5, lastResetTime: waktuSekarang });
                }
                statusTeks += ` | Kuota: [${sisaKomentar}/5]`;
            }
            badge.classList.remove('hidden');
            badge.innerHTML = `<div>Halo, <strong>${u.username}</strong> (${statusTeks})</div><button onclick="logoutMember()">Logout</button>`;
        });
    } else { badge.classList.add('hidden'); }
}

function logoutMember() {
    const memberUser = localStorage.getItem("member_username");
    if(memberUser) database.ref('comment_users/' + memberUser.toLowerCase()).off();
    localStorage.removeItem("member_username");
    checkActiveUserSession();
    alert("Sesi member ditutup.");
}

// =========================================================================
// 6. APPROVAL SYSTEM & COMMENTS ENGINE
// =========================================================================
function listenToApprovalList() {
    database.ref('comment_users').on('value', (snapshot) => {
        const tbody = document.getElementById('approvalListTable');
        if(!tbody) return;
        tbody.innerHTML = '';
        if (!snapshot.exists()) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#666;padding:5px;">Tidak ada antrean pendaftaran.</td></tr>';
            return;
        }
        let adaData = false;
        snapshot.forEach((child) => {
            const user = child.val();
            if (user.status === 'pending') {
                adaData = true;
                tbody.innerHTML += `
                    <tr style="border-bottom:1px solid #333; height:35px;">
                        <td style="color:#fff; font-weight:bold;">${user.username}</td>
                        <td style="text-align:center; display:flex; gap:5px; justify-content:center; align-items:center; height:35px;">
                            <button onclick="actionApproval('${user.username.toLowerCase()}', 'approved')" style="background:#00e676;color:#000;font-size:10px;padding:3px 6px;width:auto;margin:0;">ACC</button>
                            <button onclick="actionApproval('${user.username.toLowerCase()}', 'rejected')" style="background:#ff3d00;color:#fff;font-size:10px;padding:3px 6px;width:auto;margin:0;">TOLAK</button>
                        </td>
                    </tr>`;
            }
        });
        if(!adaData) tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#666;padding:5px;">Semua registrasi sudah diproses.</td></tr>';
    });
}

function actionApproval(usernameId, keputusan) {
    database.ref('comment_users/' + usernameId).update({ status: keputusan, lastResetTime: Date.now(), commentCount: 5 })
    .then(() => alert(`User berhasil di-${keputusan.toUpperCase()}!`));
}

function loadNewsFromFirebase() {
    database.ref('berita').on('value', (snapshot) => {
        const container = document.getElementById('newsContainer');
        container.innerHTML = "";
        if (!snapshot.exists()) {
            container.innerHTML = "<p style='text-align:center;color:#666;'>Belum ada berita yang diterbitkan saat ini.</p>";
            return;
        }
        snapshot.forEach((child) => {
            const key = child.key;
            const b = child.val();
            container.innerHTML = `
                <div class="news-card">
                    <img class="news-img" src="${b.image}" alt="Berita">
                    <div class="news-body">
                        <span class="news-badge badge-${b.role}">${b.role}</span>
                        <h2 class="news-title">${b.title}</h2>
                        <div class="news-meta">Diposting oleh @${b.author} — ${b.date}</div>
                        <p class="news-text">${b.content}</p>
                    </div>
                    <div class="comment-section">
                        <div class="comment-list" id="list-comment-${key}"></div>
                        <div class="comment-box-area">
                            <input type="text" id="input-comment-${key}" placeholder="Tulis tanggapan/komentar...">
                            <button onclick="postComment('${key}')">Kirim</button>
                        </div>
                    </div>
                </div>` + container.innerHTML;
            listenToComments(key);
        });
    });
}

function postComment(newsKey) {
    const memberUser = localStorage.getItem("member_username");
    if (!memberUser) return alert("Wajib membuat akun/login dulu untuk dapat berkomentar!");

    const inputField = document.getElementById(`input-comment-${newsKey}`);
    const commentText = inputField.value.trim();
    if (!commentText) return alert("Pesan komentar kosong!");

    database.ref('comment_users/' + memberUser.toLowerCase()).once('value', (snap) => {
        if (!snap.exists()) return;
        const u = snap.val();

        if (u.status !== 'approved') {
            const waktuSekarang = Date.now();
            if (waktuSekarang - u.lastResetTime >= 6 * 60 * 1000) {
                u.commentCount = 5;
                database.ref('comment_users/' + memberUser.toLowerCase()).update({ commentCount: 5, lastResetTime: waktuSekarang });
            }
            if (u.commentCount <= 0) return alert("Batas kuota komentar habis (Maks 5x/6 Menit)!");
        }

        database.ref(`berita/${newsKey}/komentar`).push({
            username: u.username, text: commentText, status: u.status, timestamp: Date.now()
        }).then(() => {
            inputField.value = "";
            if (u.status !== 'approved') {
                database.ref('comment_users/' + memberUser.toLowerCase()).update({ commentCount: u.commentCount - 1 });
            }
        });
    });
}

function listenToComments(newsKey) {
    database.ref(`berita/${newsKey}/komentar`).on('value', (snapshot) => {
        const listDiv = document.getElementById(`list-comment-${newsKey}`);
        if (!listDiv) return;
        listDiv.innerHTML = "";
        if (!snapshot.exists()) {
            listDiv.innerHTML = "<p style='color:#666; font-size:11px; text-align:center;'>Belum ada komentar.</p>";
            return;
        }
        snapshot.forEach((child) => {
            const c = child.val();
            let label = c.status === 'approved' ? '✔️' : '❌ Limit Mode';
            listDiv.innerHTML += `
                <div class="comment-item ${c.status === 'approved' ? 'v-member' : 't-member'}">
                    <div class="comment-user">@${c.username} <small style="color:#999; font-size:10px;">(${label})</small></div>
                    <div class="comment-text">${c.text}</div>
                </div>`;
        });
        listDiv.scrollTop = listDiv.scrollHeight;
    });
}

// =========================================================================
// 7. CMS CONFIGURATION & DISCORD PUBLISH SYSTEM
// =========================================================================
function switchCmsTab(tabName) {
    currentCmsTab = tabName;
    const btnNews = document.getElementById('tabBtnNews');
    const btnAnnounce = document.getElementById('tabBtnAnnounce');
    const formNews = document.getElementById('formNewsGroup');
    const formAnnounce = document.getElementById('formAnnounceGroup');
    const submitBtn = document.getElementById('publishSubmitBtn');

    if (tabName === 'news') {
        btnNews.style.backgroundColor = "#2e7d32"; btnNews.style.color = "#fff";
        btnAnnounce.style.backgroundColor = "#444"; btnAnnounce.style.color = "#aaa";
        formNews.classList.remove('hidden'); formAnnounce.classList.add('hidden');
        submitBtn.innerText = "Publish Berita & Kirim ke Discord";
    } else {
        btnNews.style.backgroundColor = "#444"; btnNews.style.color = "#aaa";
        btnAnnounce.style.backgroundColor = "#e53935"; btnAnnounce.style.color = "#fff";
        formNews.classList.add('hidden'); formAnnounce.classList.remove('hidden');
        submitBtn.innerText = "Siarkan Pengumuman ke Discord";
    }
}

function toggleLoginFields() {
    const type = document.getElementById('loginType').value;
    const bioBtn = document.getElementById('biometricLoginBtn');
    document.getElementById('inputUserGroup').classList.remove('hidden');
    document.getElementById('inputNrpGroup').classList.add('hidden');
    document.getElementById('inputPasswordGroup').classList.remove('hidden');
    bioBtn.classList.add('hidden');

    if (type === 'dispenad') {
        document.getElementById('inputUserGroup').classList.add('hidden');
        document.getElementById('inputNrpGroup').classList.remove('hidden');
    } else if (type === 'owner' && localStorage.getItem("owner_biometric_registered") === "true") {
        bioBtn.classList.remove('hidden');
    }
}

function toggleMenu() {
    const overlay = document.getElementById('navOverlay');
    overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
}

function openAdminPortal() {
    document.getElementById('navOverlay').style.display = 'none';
    document.getElementById('mainPortal').classList.add('hidden');
    document.getElementById('userAuthPortal').classList.add('hidden');
    document.getElementById('adminPortal').classList.remove('hidden');
    checkAdminSession();
    toggleLoginFields();
}

function handleLogin() {
    const type = document.getElementById('loginType').value;
    const pass = document.getElementById('passwordInput').value;

    if (type === 'whitelist') {
        const user = document.getElementById('usernameInput').value.trim().toLowerCase();
        database.ref('whitelist_admins/' + user).once('value', (snapshot) => {
            if (snapshot.exists() && snapshot.val().password === pass) {
                sessionStorage.setItem("adminActive", snapshot.val().username);
                sessionStorage.setItem("roleActive", "admin");
                database.ref('whitelist_admins/' + user + '/status').set("Online");
                checkAdminSession();
            } else { alert("Data salah / Akun belum terdaftar!"); }
        });
    } else if (type === 'dispenad') {
        const nrp = document.getElementById('nrpInput').value.trim();
        if (nrp.toUpperCase().startsWith("DISPENAD") && pass === "tni123") {
            sessionStorage.setItem("adminActive", nrp.toUpperCase());
            sessionStorage.setItem("roleActive", "dispenad");
            checkAdminSession();
        } else { alert("NRP / Password Dinas Salah!"); }
    } else if (type === 'owner') {
        const user = document.getElementById('usernameInput').value.trim();
        if (user === OWNER_USERNAME && pass === OWNER_PASSWORD) {
            sessionStorage.setItem("adminActive", user);
            sessionStorage.setItem("roleActive", "owner");
            checkAdminSession();
        } else { alert("Akses Master Ditolak!"); }
    }
}

function setupBiometric() {
    if (confirm("Daftarkan Sidik Jari perangkat untuk Owner?")) {
        localStorage.setItem("owner_biometric_registered", "true");
        alert("Konfigurasi Biometrik Sukses.");
        toggleLoginFields();
    }
}

function loginWithBiometric() {
    sessionStorage.setItem("adminActive", OWNER_USERNAME);
    sessionStorage.setItem("roleActive", "owner");
    checkAdminSession();
}

function checkAdminSession() {
    const currentAdmin = sessionStorage.getItem("adminActive");
    const role = sessionStorage.getItem("roleActive");

    if (currentAdmin) {
        document.getElementById('loginBox').classList.add('hidden');
        document.getElementById('cmsBox').classList.remove('hidden');
        document.getElementById('postAuthor').value = currentAdmin;
        document.getElementById('ownerControls').classList.toggle('hidden', role !== 'owner');
        document.getElementById('cmsHeading').innerText = role === 'owner' ? "👑 PANEL KONTROL PENUH OWNER" : "📰 PANEL MANAJEMEN CMS";
        switchCmsTab('news');
    } else {
        document.getElementById('loginBox').classList.remove('hidden');
        document.getElementById('cmsBox').classList.add('hidden');
        document.getElementById('ownerControls').classList.add('hidden');
    }
}

function handleLogout() {
    const currentAdmin = sessionStorage.getItem("adminActive");
    if (sessionStorage.getItem("roleActive") === 'admin' && currentAdmin) {
        database.ref('whitelist_admins/' + currentAdmin.toLowerCase() + '/status').set("Offline");
    }
    sessionStorage.clear();
    checkAdminSession();
}

function generateAdmin() {
    const user = document.getElementById('newAdminUser').value.trim();
    const pass = document.getElementById('newAdminPass').value.trim();
    if(!user || !pass) return alert("Lengkapi Form!");
    
    database.ref('whitelist_admins/' + user.toLowerCase()).set({
        username: user, password: pass, registeredAt: new Date().toLocaleDateString('id-ID') + " WIB", status: "Offline"
    }).then(() => {
        alert("Admin Berhasil Dibuat!");
        document.getElementById('newAdminUser').value = '';
        document.getElementById('newAdminPass').value = '';
    });
}

function revokeAdminAccess(username) {
    if (confirm(`Hapus akses admin "${username}"?`)) database.ref('whitelist_admins/' + username.toLowerCase()).remove();
}

function listenToAccessList() {
    database.ref('whitelist_admins').on('value', (snapshot) => {
        const tbody = document.getElementById('accessListTable');
        if(!tbody) return;
        tbody.innerHTML = '';
        if(!snapshot.exists()) return;
        snapshot.forEach((child) => {
            const data = child.val();
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #222; height: 35px;">
                    <td style="color:#fff; padding: 4px;">${data.username}</td>
                    <td style="padding: 4px;"><span style="color: ${data.status === 'Online' ? '#00e676' : '#757575'}; font-weight: bold;">● ${data.status}</span></td>
                    <td style="padding: 4px; text-align: center;"><button onclick="revokeAdminAccess('${data.username}')" style="background:#b71c1c;color:#fff;font-size:10px;padding:3px 8px;width:auto;margin:0;">Hapus</button></td>
                </tr>`;
        });
    });
}

function executePublish() {
    if (currentCmsTab === 'news') savePost(); else sendAnnouncement();
}

function savePost() {
    const title = document.getElementById('postTitle').value.trim();
    const image = document.getElementById('postImage').value.trim() || "https://via.placeholder.com/800x450/333/fff?text=MEDIA+RAYA.ID";
    const author = document.getElementById('postAuthor').value;
    const content = document.getElementById('postContent').value.trim();
    const isTagChecked = document.getElementById('tagRoleCheckbox').checked;

    if (!title || !content) return alert("Lengkapi data berita!");
    const dateString = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + " WIB";
    
    const newsData = { title, date: dateString, author, role: sessionStorage.getItem("roleActive"), content, image };
    database.ref('berita').push(newsData).then(() => {
        sendToDiscord("news", newsData, isTagChecked);
        alert("Berita Berhasil Tayang!");
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        closeAllPortals();
    });
}

function sendAnnouncement() {
    const title = document.getElementById('announceTitle').value.trim();
    const content = document.getElementById('announceContent').value.trim();
    const isTagChecked = document.getElementById('tagRoleCheckbox').checked;

    if(!title || !content) return alert("Lengkapi data pengumuman!");
    const dateString = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + " WIB";

    const announceData = { title, content, author: document.getElementById('postAuthor').value, date: dateString };
    sendToDiscord("announcement", announceData, isTagChecked);
    alert("Announcement Terkirim!");
    document.getElementById('announceTitle').value = '';
    document.getElementById('announceContent').value = '';
    closeAllPortals();
}

function sendToDiscord(type, data, shouldTag) {
    if (!DISCORD_WEBHOOK_URL) return;
    let contentString = shouldTag ? DISCORD_ROLE_TAG : ""; 
    let embedObject = {
        title: type === 'news' ? `📰 Berita Baru: ${data.title}` : `📢 ANNOUNCEMENT: ${data.title}`,
        description: type === 'news' ? data.content.substring(0, 900) + "..." : data.content,
        color: type === 'news' ? (data.role === 'owner' ? 12000284 : 15022389) : 16753920,
        fields: [
            { name: type === 'news' ? "Penulis" : "Oleh", value: data.author, inline: true },
            { name: "Waktu", value: data.date, inline: true }
        ],
        footer: { text: "Management AFI • Media Raya" }
    };
    if(type === 'news' && data.image) embedObject.image = { url: data.image };

    fetch(DISCORD_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentString, embeds: [embedObject] })
    });
}

function clearAllNews() {
    if(confirm("Hapus seluruh berita?")) database.ref('berita').remove().then(() => alert("Database dibersihkan."));
}

window.onload = initWebsiteDirectly;
