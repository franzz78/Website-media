// =========================================================================
// 1. KONFIGURASI DATABASE & WEBHOOK (FINAL POLRI & DISCORD)
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

// Data Utama Pemilik Website
const OWNER_USERNAME = "@nathanael_0918";
const OWNER_PASSWORD = "owner_raya_2026"; 

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
let currentCmsTab = "news"; 

// =========================================================================
// 2. SISTEM GEOLOCATION
// =========================================================================
const BLACKLIST_REGIONS = [
    "batam", "kepulauan riau", "kepri", "papua", "papua barat", "papua selatan", 
    "papua tengah", "papua pegunungan", "papua barat daya", "nusa tenggara timur", 
    "ntt", "nusa tenggara barat", "ntb", "maluku", "maluku utara", "aceh"
];

function checkLocation() {
    if (!navigator.geolocation) {
        showBlocker("TIDAK BISA MENGAKSES WEBSITE", "Browser Anda tidak memiliki fitur GPS.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            if (lat < -11.0 || lat > 6.0 || lng < 95.0 || lng > 141.0) {
                showBlocker("AKSES DITOLAK", "Layanan hanya tersedia di area domestik Indonesia.");
                return;
            }

            const geoApiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;

            fetch(geoApiUrl, { headers: { 'User-Agent': 'MediaRayaID/1.0' } })
            .then(res => res.json())
            .then(data => {
                if (data && data.address) {
                    const city = (data.address.city || data.address.city_district || data.address.county || data.address.municipality || "").toLowerCase();
                    const state = (data.address.state || "").toLowerCase();

                    const isRestricted = BLACKLIST_REGIONS.some(region => city.includes(region) || state.includes(region));

                    if (isRestricted) {
                        showBlocker("AKSES DITOLAK", "Wilayah administrasi Anda berada di luar batas izin operasional.");
                    } else {
                        document.getElementById('geoBlocker').classList.add('hidden');
                        document.getElementById('appContainer').classList.remove('hidden');
                        loadNewsFromFirebase();
                        listenToAccessList(); 
                    }
                } else { showBlocker("GAGAL OTENTIKASI", "Gagal memproses nama wilayah."); }
            })
            .catch(() => { showBlocker("MASALAH JARINGAN", "Hambatan koneksi saat memetakan lokasi."); });
        },
        () => { showBlocker("GPS WAJIB AKTIF", "Anda wajib mengaktifkan izin GPS Lokasi untuk masuk."); },
        { enableHighAccuracy: true, timeout: 15000 }
    );
}

function showBlocker(title, message) {
    const blocker = document.getElementById('geoBlocker');
    blocker.innerHTML = `<h1>${title}</h1><p>${message}</p>`;
}

// =========================================================================
// 3. SELEKSI CMS TAB
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

// =========================================================================
// 4. SISTEM LOGIN & SESI
// =========================================================================
function toggleLoginFields() {
    const type = document.getElementById('loginType').value;
    if (type === 'dispenad') {
        document.getElementById('inputUserGroup').classList.add('hidden');
        document.getElementById('inputNrpGroup').classList.remove('hidden');
    } else {
        document.getElementById('inputUserGroup').classList.remove('hidden');
        document.getElementById('inputNrpGroup').classList.add('hidden');
    }
}

function toggleMenu() {
    const overlay = document.getElementById('navOverlay');
    overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
}

function openAdminPortal() {
    document.getElementById('navOverlay').style.display = 'none';
    document.getElementById('mainPortal').classList.add('hidden');
    document.getElementById('adminPortal').classList.remove('hidden');
    checkAdminSession();
}

function closeAdminPortal() {
    document.getElementById('adminPortal').classList.add('hidden');
    document.getElementById('mainPortal').classList.remove('hidden');
}

function handleLogin() {
    const type = document.getElementById('loginType').value;
    const pass = document.getElementById('passwordInput').value;

    if (type === 'whitelist') {
        const user = document.getElementById('usernameInput').value.trim().toLowerCase();
        database.ref('whitelist_admins/' + user).once('value', (snapshot) => {
            if (snapshot.exists() && snapshot.val().password === pass) {
                alert("Akses Masuk Diterima!");
                sessionStorage.setItem("adminActive", snapshot.val().username);
                sessionStorage.setItem("roleActive", "admin");
                database.ref('whitelist_admins/' + user + '/status').set("Online");
                checkAdminSession();
            } else { alert("Akun belum didaftarkan Owner / Password salah!"); }
        });
    } else if (type === 'dispenad') {
        const nrp = document.getElementById('nrpInput').value.trim();
        if (nrp.toUpperCase().startsWith("DISPENAD") && pass === "tni123") {
            alert("Akses DISPENAD Aktif!");
            sessionStorage.setItem("adminActive", nrp.toUpperCase());
            sessionStorage.setItem("roleActive", "dispenad");
            checkAdminSession();
        } else { alert("NRP / Password Dinas Salah!"); }
    } else if (type === 'owner') {
        const user = document.getElementById('usernameInput').value.trim();
        if (user === OWNER_USERNAME && pass === OWNER_PASSWORD) {
            alert("Selamat Datang Owner @nathanael_0918!");
            sessionStorage.setItem("adminActive", user);
            sessionStorage.setItem("roleActive", "owner");
            checkAdminSession();
        } else { alert("Otentikasi Owner Ditolak!"); }
    }
}

function checkAdminSession() {
    const currentAdmin = sessionStorage.getItem("adminActive");
    const role = sessionStorage.getItem("roleActive");

    if (currentAdmin) {
        document.getElementById('loginBox').classList.add('hidden');
        document.getElementById('cmsBox').classList.remove('hidden');
        document.getElementById('postAuthor').value = currentAdmin;
        
        if(role === 'owner') {
            document.getElementById('ownerControls').classList.remove('hidden');
            document.getElementById('cmsHeading').innerText = "👑 PANEL KONTROL PENUH OWNER";
        } else {
            document.getElementById('ownerControls').classList.add('hidden');
            document.getElementById('cmsHeading').innerText = "📰 PANEL MANAJEMEN CMS";
        }
        switchCmsTab('news');
    } else {
        document.getElementById('loginBox').classList.remove('hidden');
        document.getElementById('cmsBox').classList.add('hidden');
        document.getElementById('ownerControls').classList.add('hidden');
    }
}

function handleLogout() {
    const currentAdmin = sessionStorage.getItem("adminActive");
    const role = sessionStorage.getItem("roleActive");

    if (role === 'admin' && currentAdmin) {
        database.ref('whitelist_admins/' + currentAdmin.toLowerCase() + '/status').set("Offline");
    }
    sessionStorage.removeItem("adminActive");
    sessionStorage.removeItem("roleActive");
    checkAdminSession();
    alert("Sesi ditutup.");
}

// =========================================================================
// 5. MANAJEMEN USER (EKSKLUSIF PANEL OWNER)
// =========================================================================
function generateAdmin() {
    const user = document.getElementById('newAdminUser').value.trim();
    const pass = document.getElementById('newAdminPass').value.trim();

    if(!user || !pass) { alert("Lengkapi form user baru!"); return; }
    if(user.includes(" ") || user.startsWith("@")) { alert("Username dilarang pakai spasi/@!"); return; }

    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const regDate = new Date().toLocaleDateString('id-ID', options) + " WIB";
    
    const adminData = { username: user, password: pass, registeredAt: regDate, status: "Offline" };

    database.ref('whitelist_admins/' + user.toLowerCase()).set(adminData)
    .then(() => {
        alert(`Akun "${user}" berhasil didaftarkan!`);
        document.getElementById('newAdminUser').value = '';
        document.getElementById('newAdminPass').value = '';
    }).catch(err => alert("Gagal mendata: " + err.message));
}

function listenToAccessList() {
    database.ref('whitelist_admins').on('value', (snapshot) => {
        const tbody = document.getElementById('accessListTable');
        tbody.innerHTML = '';
        if(!snapshot.exists()) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#555;padding:10px;">Belum ada nama terdaftar.</td></tr>';
            return;
        }
        snapshot.forEach((child) => {
            const data = child.val();
            const statusColor = data.status === 'Online' ? '#00e676' : '#757575';
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #222; height: 32px;">
                    <td style="color:#fff; font-weight:600; padding: 4px;">${data.username}</td>
                    <td style="color:#aaa; padding: 4px;">${data.registeredAt}</td>
                    <td style="padding: 4px;"><span style="color: ${statusColor}; font-weight: bold;">● ${data.status.toUpperCase()}</span></td>
                </tr>
            `;
        });
    });
}

// =========================================================================
// 6. PUBLISH KONTEN & DISCORD SINKRONISASI
// =========================================================================
function executePublish() {
    if (currentCmsTab === 'news') { savePost(); } else { sendAnnouncement(); }
}

function loadNewsFromFirebase() {
    database.ref('berita').on('value', (snapshot) => {
        const newsContainer = document.getElementById('newsContainer');
        newsContainer.innerHTML = '';
        if (!snapshot.exists()) {
            newsContainer.innerHTML = '<p style="text-align:center;color:#555;padding:20px;">Belum ada berita terbit.</p>';
            return;
        }
        let newsList = [];
        snapshot.forEach((childSnapshot) => { newsList.push(childSnapshot.val()); });
        newsList.reverse().forEach(item => {
            let badgeHTML = `<span class="badge badge-admin">KONTRIBUTOR</span>`;
            if(item.role === 'dispenad') badgeHTML = `<span class="badge badge-dispenad">🎖️ DISPENAD TNI</span>`;
            else if(item.role === 'owner') badgeHTML = `<span class="badge badge-owner">👑 OWNER</span>`;

            newsContainer.innerHTML += `
                <div class="news-card">
                    <img src="${item.image}" class="news-img" alt="Foto">
                    <div class="news-meta">${badgeHTML} <span>${item.date} • Oleh: <strong>${item.author}</strong></span></div>
                    <div class="news-title">${item.title}</div>
                    <div class="news-content">${item.content}</div>
                </div>
            `;
        });
    });
}

function savePost() {
    const title = document.getElementById('postTitle').value.trim();
    const image = document.getElementById('postImage').value.trim() || "https://via.placeholder.com/800x450/333/fff?text=MEDIA+RAYA.ID";
    const author = document.getElementById('postAuthor').value;
    const role = sessionStorage.getItem("roleActive");
    const content = document.getElementById('postContent').value.trim();
    const isTagChecked = document.getElementById('tagRoleCheckbox').checked;

    if (!title || !content) { return alert("Form wajib diisi!"); }

    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const dateString = new Date().toLocaleDateString('id-ID', options) + " WIB";
    const newsData = { title, date: dateString, author, role, content, image };

    database.ref('berita').push(newsData).then(() => {
        alert("Berita berhasil tayang!");
        sendToDiscord("news", newsData, isTagChecked);
        document.getElementById('postTitle').value = '';
        document.getElementById('postContent').value = '';
        closeAdminPortal();
    });
}

function sendAnnouncement() {
    const title = document.getElementById('announceTitle').value.trim();
    const content = document.getElementById('announceContent').value.trim();
    const author = document.getElementById('postAuthor').value;
    const isTagChecked = document.getElementById('tagRoleCheckbox').checked;

    if(!title || !content) { return alert("Form wajib diisi!"); }

    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const dateString = new Date().toLocaleDateString('id-ID', options) + " WIB";
    const announceData = { title, content, author, date: dateString };

    sendToDiscord("announcement", announceData, isTagChecked);
    alert("Announcement terkirim!");
    document.getElementById('announceTitle').value = '';
    document.getElementById('announceContent').value = '';
    closeAdminPortal();
}

function sendToDiscord(type, data, shouldTag) {
    if (!DISCORD_WEBHOOK_URL) return;
    let contentString = shouldTag ? DISCORD_ROLE_TAG : ""; 
    let embedObject = {};

    if(type === 'news') {
        embedObject = {
            title: `📰 Berita Baru: ${data.title}`,
            description: data.content.substring(0, 900) + "...", 
            color: data.role === 'dispenad' ? 1793568 : (data.role === 'owner' ? 12000284 : 15022389),
            fields: [
                { name: "Penulis", value: data.author, inline: true },
                { name: "Waktu", value: data.date, inline: true }
            ],
            image: { url: data.image },
            footer: { text: "Portal Berita Resmi • Management AFI" }
        };
    } else {
        embedObject = {
            title: `📢 ANNOUNCEMENT: ${data.title}`,
            description: data.content,
            color: 16753920,
            fields: [
                { name: "Oleh", value: data.author, inline: true },
                { name: "Waktu", value: data.date, inline: true }
            ],
            footer: { text: "Pemberitahuan Sistem Komunitas • Management AFI" }
        };
    }

    fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentString, embeds: [embedObject] })
    });
}

function clearAllNews() {
    if(confirm("Hapus seluruh berita?")) {
        database.ref('berita').remove().then(() => alert("Database dibersihkan."));
    }
}

window.onload = checkLocation;
                      
