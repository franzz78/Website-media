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
                        listenToGlobalSettings();
                        listenToApprovalList(); // Memantau daftar approval register komentar di sisi Owner
                        startRealtimeSecurityCheck(); 
                        checkActiveUserSession(); // Memeriksa sesi log masuk member komentar
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
    blocker.classList.remove('hidden');
    blocker.innerHTML = `<h1>${title}</h1><p>${message}</p>`;
}

function startRealtimeSecurityCheck() {
    setInterval(() => {
        const currentAdmin = sessionStorage.getItem("adminActive");
        const role = sessionStorage.getItem("roleActive");

        if (currentAdmin && role === 'admin') {
            database.ref('whitelist_admins/' + currentAdmin.toLowerCase()).once('value', (snapshot) => {
                if (!snapshot.exists()) {
                    sessionStorage.clear();
                    document.getElementById('appContainer').classList.add('hidden');
                    showBlocker("TIDAK ADA AKSES ADMIN", "Maaf, akun Anda telah dihapus atau dicabut izin aksesnya oleh Owner.");
                }
            });
        }
    }, 3000);
}

// =========================================================================
// 3. MASTER SETTINGS & AUDIO ENGINE (AUTOPLAY YOUTUBE ENGINE LIVE BERSUARA)
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
        // Embed YouTube dipaksa autoplay langsung bersuara secara global dengan manipulasi script interaksi
        container.innerHTML = `<iframe id="ytGlobalPlayer" width="100" height="100" src="https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&enablejsapi=1" allow="autoplay"></iframe>`;
    }
}

function saveGlobalSettings() {
    const logoUrl = document.getElementById('setWebLogo').value.trim();
    const backgroundUrl = document.getElementById('setWebBackground').value.trim();
    const musicUrl = document.getElementById('setWebMusic').value.trim();
    const volume = document.getElementById('setWebVolume').value;

    const settingsData = { logoUrl, backgroundUrl, musicUrl, volume };

    database.ref('global_settings').set(settingsData)
    .then(() => { alert("PENGATURAN GLOBAL SUKSES DISIMPAN!"); })
    .catch(err => alert("Gagal menyimpan: " + err.message));
}

document.addEventListener('input', function(e) {
    if(e.target && e.target.id === 'setWebVolume') {
        document.getElementById('volumeValLabel').innerText = e.target.value + "%";
    }
});

// Pemicu otomatis agar browser memperbolehkan suara langsung aktif saat user klik apapun di web
document.addEventListener('click', () => {
    const iframe = document.getElementById('ytGlobalPlayer');
    if (iframe) {
        iframe.contentWindow.postMessage('{"event":"command","func":"unmute","args":""}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    }
}, { once: true });

// =========================================================================
// 4. PORTAL AUTENTIKASI MEMBER KOMENTAR (ACC/TOLAK/LIMIT RESET 6 MENIT)
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
        // Cari tahu apakah username sudah pernah diajukan
        database.ref('comment_users/' + username.toLowerCase()).once('value', (snap) => {
            if (snap.exists()) {
                alert("Username tersebut sudah terdaftar/sedang dalam proses review!");
            } else {
                // Masukkan data registrasi baru dengan status awal 'pending'
                database.ref('comment_users/' + username.toLowerCase()).set({
                    username: username,
                    password: password,
                    status: 'pending', // Nilai status: pending, approved, rejected
                    commentCount: 5,   // Kuota awal default bagi yang ditolak/pending
                    lastResetTime: Date.now()
                }).then(() => {
                    alert("Pendaftaran berhasil diajukan! Menunggu persetujuan Owner di menu Panel.");
                    document.getElementById('authUsername').value = "";
                    document.getElementById('authPassword').value = "";
                });
            }
        });
    } else {
        // MODE LOG IN MEMBER
        database.ref('comment_users/' + username.toLowerCase()).once('value', (snap) => {
            if (snap.exists() && snap.val().password === password) {
                const userData = snap.val();
                localStorage.setItem("member_username", userData.username);
                alert("Login Member Sukses!");
                checkActiveUserSession();
                closeAllPortals();
            } else {
                alert("Username atau Password Member salah!");
            }
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
            
            // Logika pengecekan sisa kuota & Reset waktu otomatis 6 menit
            let sisaKomentar = u.commentCount;
            let statusTeks = u.status === 'approved' ? '🚀 VERIFIED MEMBER (Bebas Komentar)' : (u.status === 'rejected' ? '⚠️ DITOLAK (Limit Mode Aktif)' : '⏳ PENDING REVIEW');
            
            if (u.status !== 'approved') {
                const waktuSekarang = Date.now();
                const selisihWaktu = waktuSekarang - u.lastResetTime;
                
                if (selisihWaktu >= 6 * 60 * 1000) { // Jika sudah melewati batas waktu 6 menit
                    sisaKomentar = 5;
                    database.ref('comment_users/' + memberUser.toLowerCase()).update({
                        commentCount: 5,
                        lastResetTime: waktuSekarang
                    });
                }
                statusTeks += ` | Sisa Kuota: [${sisaKomentar}/5]`;
            }

            badge.classList.remove('hidden');
            badge.innerHTML = `
                <div>Halo, <strong>${u.username}</strong> (${statusTeks})</div>
                <button onclick="logoutMember()" style="background:#cc1111; color:white; border:none; padding:4px 8px; font-size:11px; cursor:pointer; border-radius:3px;">Logout</button>
            `;
        });
    } else {
        badge.classList.add('hidden');
    }
}

function logoutMember() {
    const memberUser = localStorage.getItem("member_username");
    if(memberUser) database.ref('comment_users/' + memberUser.toLowerCase()).off();
    localStorage.removeItem("member_username");
    checkActiveUserSession();
    alert("Sesi member ditutup.");
}

// =========================================================================
// 5. MANAJEMEN APPROVAL MEMBER DI PANEL OWNER
// =========================================================================
function listenToApprovalList() {
    database.ref('comment_users').on('value', (snapshot) => {
        const tbody = document.getElementById('approvalListTable');
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
                    </tr>
                `;
            }
        });
        if(!adaData) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#666;padding:5px;">Semua registrasi sudah diproses.</td></tr>';
        }
    });
}

function actionApproval(usernameId, keputusan) {
    database.ref('comment_users/' + usernameId).update({
        status: keputusan,
        lastResetTime: Date.now(),
        commentCount: 5
    }).then(() => {
        alert(`User berhasil di-${keputusan.toUpperCase()}!`);
    });
}

// =========================================================================
// 6. SISTEM PENGIRIMAN & PENAMPILAN KOMENTAR BERITA
// =========================================================================
function postComment(newsKey) {
    const memberUser = localStorage.getItem("member_username");
    if (!memberUser) return alert("Anda wajib membuat akun/login terlebih dahulu untuk dapat berkomentar!");

    const inputField = document.getElementById(`input-comment-${newsKey}`);
    const commentText = inputField.value.trim();
    if (!commentText) return alert("Pesan komentar tidak boleh kosong!");

    // Ambil data status akun komentator dari Firebase secara real-time
    database.ref('comment_users/' + memberUser.toLowerCase()).once('value', (snap) => {
        if (!snap.exists()) return;
        const u = snap.val();

        // Validasi pembatasan sisa komentar jika statusnya ditolak/pending
        if (u.status !== 'approved') {
            const waktuSekarang = Date.now();
            if (waktuSekarang - u.lastResetTime >= 6 * 60 * 1000) {
                // Auto Reset instan jika masa tunggu 6 menit terlewati saat hendak posting
                u.commentCount = 5;
                database.ref('comment_users/' + memberUser.toLowerCase()).update({ commentCount: 5, lastResetTime: waktuSekarang });
            }

            if (u.commentCount <= 0) {
                alert("Batas kuota komentar Anda habis (Maks 5x)!\nHarap tunggu waktu reset selama 6 menit agar utuh kembali.");
                return;
            }
        }

        // Jalankan perintah post komentar ke berita terkait
        const commentData = {
            username: u.username,
            text: commentText,
            status: u.status,
            timestamp: Date.now()
        };

        database.ref(`berita/${newsKey}/komentar`).push(commentData).then(() => {
            inputField.value = "";
            
            // Potong kuota komentar jika statusnya bukan 'approved'
            if (u.status !== 'approved') {
                database.ref('comment_users/' + memberUser.toLowerCase()).update({
                    commentCount: u.commentCount - 1
                });
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
            listDiv.innerHTML = "<p style='color:#666; font-size:11px; text-align:center;'>Belum ada komentar di berita ini.</p>";
            return;
        }

        snapshot.forEach((child) => {
            const c = child.val();
            let markClass = c.status === 'approved' ? 'v-member' : 't-member';
            let markLabel = c.status === 'approved' ? '✔️' : '❌ Limit Mode';

            listDiv.innerHTML += `
                <div class="comment-item ${markClass}">
                    <div class="comment-user">
                        <span>@${c.username} <small style="color:#999; font-size:10px;">(${markLabel})</small></span>
                    </div>
                    <div class="comment-text">${c.text}</div>
                </div>
            `;
        });
        listDiv.scrollTop = listDiv.scrollHeight; // Auto scroll ke bawah
    });
}

// =========================================================================
// 7. PUBLISH KONTEN & DASHBOARD MANAGEMENT
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
        submitBtn.innerText = "Siarkan Pengumuman ke Discord";
    }
}

function toggleLoginFields() {
    const type = document.getElementById('loginType').value;
    const bioBtn = document.getElementById('biometricLoginBtn');
    const passGroup = document.getElementById('inputPasswordGroup');
    const userGroup = document.getElementById('inputUserGroup');
    const nrpGroup = document.getElementById('inputNrpGroup');

    userGroup.classList.remove('hidden');
    nrpGroup.classList.add('hidden');
    passGroup.classList.remove('hidden');
    bioBtn.classList.add('hidden');

    if (type === 'dispenad') {
        userGroup.classList.add('hidden');
        nrpGroup.classList.remove('hidden');
    } else if (type === 'owner') {
        if (localStorage.getItem("owner_biometric_registered") === "true") {
            bioBtn.classList.remove('hidden');
        }
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

function setupBiometric() {
    if (!window.PublicKeyCredential) return alert("Perangkat/browser tidak mendukung Biometrik.");
    if (confirm("Daftarkan Sidik Jari perangkat ini untuk login cepat Owner?")) {
        localStorage.setItem("owner_biometric_registered", "true");
        alert("SUKSES mengonfigurasi sidik jari.");
        toggleLoginFields();
    }
}

function loginWithBiometric() {
    if (localStorage.getItem("owner_biometric_registered") !== "true") return;
    navigator.credentials.create({
        publicKey: {
            challenge: new Uint8Array([1, 2, 3, 4]),
            rp: { name: "Media Raya" },
            user: { id: new Uint8Array([1]), name: "owner", displayName: "Owner Raya" },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }]
        }
    }).then(() => {
        sessionStorage.setItem("adminActive", OWNER_USERNAME);
        sessionStorage.setItem("roleActive", "owner");
        checkAdminSession();
    });
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
}

function generateAdmin() {
    const user = document.getElementById('newAdminUser').value.trim();
    const pass = document.getElementById('newAdminPass').value.trim();
    if(!user || !pass) return alert("Lengkapi data form!");

    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const regDate = new Date().toLocaleDateString('id-ID', options) + " WIB";
    
    database.ref('whitelist_admins/' + user.toLowerCase()).set({
        username: user, password: pass, registeredAt: regDate, status: "Offline"
    }).then(() => {
        alert("Admin Whitelist Berhasil Didaftarkan!");
        document.getElementById('newAdminUser').value = '';
        document.getElementById('newAdminPass').value = '';
    });
}

function revokeAdminAccess(username) {
    if (confirm(`Hapus akses untuk "${username}"?`)) {
        database.ref('whitelist_admins/' + username.toLowerCase()).remove();
    }
}

function listenToAccessList() {
    database.ref('whitelist_admins').on('value', (snapshot) => {
        const tbody = document.getElementById('accessListTable');
        tbody.innerHTML = '';
        if(!snapshot.exists()) return;
        snapshot.forEach((child) => {
            const data = child.val();
            const statusColor = data.status === 'Online' ? '#00e676' : '#757575';
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #222; height: 35px;">
                    <td style="color:#fff; font-weight:600; padding: 4px;">${data.username}</td>
                    <td style="padding: 4px;"><span style="color: ${statusColor}; font-weight: bold;">● ${data.status.toUpperCase()}</span></td>
                    <td style="padding: 4px; text-align: center;">
                        <button onclick="revokeAdminAccess('${data.username}')" style="background-color:#b71c1c; color:#fff; font-size:10px; padding:3px 8px; width:auto; margin:0;">Hapus</button>
                    </td>
                </tr>
            `;
        });
    });
}

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
        
        let newsKeys = [];
        let newsData = [];
        snapshot.forEach((childSnapshot) => { 
            newsKeys.push(childSnapshot.key);
            newsData.push(childSnapshot.val()); 
        });

        // Balik urutan untuk menampilkan berita terbaru di paling atas
        for (let i = newsData.length - 1; i >= 0; i--) {
            const item = newsData[i];
            const key = newsKeys[i];

            let badgeHTML = `<span class="badge badge-admin">KONTRIBUTOR</span>`;
            if(item.role === 'dispenad') badgeHTML = `<span class="badge badge-dispenad">🎖️ DISPENAD TNI</span>`;
            else if(item.role === 'owner') badgeHTML = `<span class="badge badge-owner">👑 OWNER</span>`;

            newsContainer.innerHTML += `
                <div class="news-card">
                    <img src="${item.image}" class="news-img" alt="Foto">
                    <div class="news-meta">${badgeHTML} <span>${item.date} • Oleh: <strong>${item.author}</strong></span></div>
                    <div class="news-title">${item.title}</div>
                    <div class="news-content">${item.content}</div>
                    
                    <div class="comment-section">
                        <div class="comment-header">💬 Kolom Komentar Publik</div>
                        <div class="comment-list" id="list-comment-${key}"></div>
                        <div class="comment-box-input">
                            <input type="text" id="input-comment-${key}" placeholder="Tulis komentar publik kamu di sini...">
                            <button onclick="postComment('${key}')">Kirim</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Nyalakan listener data real-time khusus komentar untuk berita ini
            listenToComments(key);
        }
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
        closeAllPortals();
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
    closeAllPortals();
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
