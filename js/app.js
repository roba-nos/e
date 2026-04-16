document.addEventListener("DOMContentLoaded", () => {
    // Check if Firebase is available
    if (typeof firebase === "undefined" || typeof auth === "undefined") {
        console.warn("Firebase not loaded on Index page. Sync disabled.");
    }

    // === API Helper ===
    const API_BASE = "https://api.mail.gw";
    
    // === State ===
    let currentEmail = localStorage.getItem("savedEmail") || "";
    let currentPassword = localStorage.getItem("savedPassword") || "";
    let authToken = localStorage.getItem("savedToken") || "";
    let messages = [];
    let selectedMessageId = null;
    let autoRefreshInterval = null;
    let userId = null;

    // Timer Logic
    let timeLeft = parseInt(localStorage.getItem("emailTimeLeft")) || 3600; 
    let countdownInterval = null;

    // === DOM Elements ===
    const customUsername = document.getElementById("customUsername");
    const domainSelector = document.getElementById("domainSelector");
    const emailDisplay = document.getElementById("currentEmail");
    const copyBtn = document.getElementById("copyBtn");
    const newEmailBtn = document.getElementById("newEmailBtn");
    const messagesContainer = document.getElementById("messagesListContainer");
    const inboxCount = document.getElementById("inboxCount");
    const manualRefreshBtn = document.getElementById("manualRefreshBtn");
    const autoRefreshSpinner = document.getElementById("autoRefreshSpinner");

    // Detail UI
    const noMessageSelected = document.getElementById("noMessageSelected");
    const msgDetailDisplay = document.getElementById("messageDetailDisplay");
    const msgSubject = document.getElementById("msgSubject");
    const msgSender = document.getElementById("msgSender");
    const msgFromEmail = document.getElementById("msgFromEmail");
    const msgDate = document.getElementById("msgDate");
    const msgBodyFrame = document.getElementById("msgBodyFrame");

    // Auth UI
    const navLoginBtn = document.getElementById("navLoginBtn");
    const navProfileDropdown = document.getElementById("navProfileDropdown");
    const profileToggleBtn = document.getElementById("profileToggleBtn");
    const navProfileEmail = document.getElementById("navProfileEmail");
    const navProfilePic = document.getElementById("navProfilePic");
    const profileMenu = document.getElementById("profileMenu");
    const navLogoutPlatformBtn = document.getElementById("navLogoutPlatformBtn");

    const revealedPassword = document.getElementById("revealedPassword");
    const copyPassBtn = document.getElementById("copyPassBtn");
    const showPassBtn = document.getElementById("showPassBtn");
    const passModal = document.getElementById("passModal");
    const closePassModalBtn = document.getElementById("closePassModalBtn");

    const openRestoreBtn = document.getElementById("openRestoreBtn");
    const restoreModal = document.getElementById("restoreModal");
    const closeRestoreBtn = document.getElementById("closeRestoreBtn");
    const restoreEmailAddr = document.getElementById("restoreEmailAddr");
    const restoreEmailPass = document.getElementById("restoreEmailPass");
    const submitRestoreBtn = document.getElementById("submitRestoreBtn");

    const emailCountdown = document.getElementById("emailCountdown");
    const extendEmailBtn = document.getElementById("extendEmailBtn");
    const guestTimerSection = document.getElementById("guestTimerSection");

    const msgPrintBtn = document.getElementById("msgPrintBtn");
    const msgDeleteBtn = document.getElementById("msgDeleteBtn");
    const msgExpandBtn = document.getElementById("msgExpandBtn");

    // --- Firebase Auth Observer ---
    if (typeof auth !== "undefined") {
        auth.onAuthStateChanged((user) => {
            if (user) {
                userId = user.uid;
                console.log("Nebula: User detected on Index:", user.email);
                localStorage.setItem("activePlatformUser", user.email); // Sync across local storage
                updateAuthUI(user);
            } else {
                userId = null;
                console.log("Nebula: No user detected on Index.");
                updateAuthUI(null);
            }
        });
    }

    function generateSecurePassword(length = 12) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let result = '';
        for(let i=0; i<length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function saveSession(email, password, token) {
        localStorage.setItem("savedEmail", email);
        localStorage.setItem("savedPassword", password);
        localStorage.setItem("savedToken", token);
        
        currentEmail = email;
        currentPassword = password;
        authToken = token;
        
        if(emailDisplay) emailDisplay.textContent = currentEmail;
        startAutoRefresh();
    }

    function clearSession() {
        localStorage.removeItem("savedEmail");
        localStorage.removeItem("savedPassword");
        localStorage.removeItem("savedToken");
        localStorage.removeItem("emailTimeLeft");
        
        currentEmail = "";
        currentPassword = "";
        authToken = "";
        timeLeft = 3600;
        
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        if (countdownInterval) clearInterval(countdownInterval);
        
        if(emailDisplay) emailDisplay.textContent = "جاري الإعداد...";
        messages = [];
        selectedMessageId = null;
        renderMessagesList();
        hideMessageDetail();
    }

    function startCountdown() {
        if (countdownInterval) clearInterval(countdownInterval);
        
        // Members (logged in users) don't have a guest timer
        if (userId) { 
            if (guestTimerSection) guestTimerSection.style.display = "none";
            return;
        }
        
        if (guestTimerSection) guestTimerSection.style.display = "flex";
        countdownInterval = setInterval(() => {
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                showToastV3("<i class='fa-solid fa-hourglass-end'></i> انتهت مدة البريد للزائر.");
                return;
            }
            timeLeft--;
            localStorage.setItem("emailTimeLeft", timeLeft);
            updateTimerUI();
        }, 1000);
    }

    function updateTimerUI() {
        if (!emailCountdown) return;
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        emailCountdown.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    if(extendEmailBtn) {
        extendEmailBtn.addEventListener("click", () => {
            timeLeft = 3600;
            localStorage.setItem("emailTimeLeft", timeLeft);
            updateTimerUI();
            showToast("<i class='fa-solid fa-clock-rotate-left'></i> تم التمديد!");
        });
    }

    function updateAuthUI(user) {
        if (user) {
            if (navLoginBtn) navLoginBtn.classList.add("hidden");
            if (navProfileDropdown) navProfileDropdown.classList.remove("hidden");
            const displayName = user.email.split('@')[0];
            if (navProfileEmail) navProfileEmail.textContent = displayName;
            if (navProfilePic) {
                navProfilePic.src = `https://ui-avatars.com/api/?name=${displayName}&background=6366f1&color=fff`;
            }
            if (openRestoreBtn) openRestoreBtn.classList.add("hidden");
            
            // Hide Timer for members
            if (guestTimerSection) guestTimerSection.style.display = "none";
            if (countdownInterval) clearInterval(countdownInterval);
        } else {
            if (navLoginBtn) navLoginBtn.classList.remove("hidden");
            if (navProfileDropdown) navProfileDropdown.classList.add("hidden");
            if (openRestoreBtn) openRestoreBtn.classList.remove("hidden");
        }
    }

    if(profileToggleBtn) {
        profileToggleBtn.addEventListener("click", () => {
            if(profileMenu) profileMenu.classList.toggle("hidden");
        });
    }
    
    if(navLogoutPlatformBtn) {
        navLogoutPlatformBtn.addEventListener("click", () => {
            auth.signOut().then(() => {
                localStorage.removeItem("activePlatformUser");
                window.location.reload();
            });
        });
    }

    async function generateNewEmail() {
        try {
            clearSession();
            if(emailDisplay) emailDisplay.textContent = "جاري الإعداد...";
            
            if (domainSelector.options.length <= 1) await fetchDomains();
            const domain = domainSelector.value.replace('@', '');

            let desiredName = customUsername.value.trim().toLowerCase().replace(/[^a-z0-9\.\-_]/g, '');
            if (!desiredName) desiredName = Math.random().toString(36).substring(2, 12);

            const newEmail = `${desiredName}@${domain}`;
            const newPassword = generateSecurePassword(14);

            const accountRes = await fetch(`${API_BASE}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: newEmail, password: newPassword })
            });

            if (!accountRes.ok && accountRes.status !== 422) throw new Error("AccFail");

            const tokenRes = await fetch(`${API_BASE}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: newEmail, password: newPassword })
            });
            
            if (!tokenRes.ok) throw new Error(accountRes.status === 422 ? "NAME_TAKEN" : "TokenFail");
            const tokenData = await tokenRes.json();
            
            saveSession(newEmail, newPassword, tokenData.token);
            
            // --- SYNC TO FIREBASE IF LOGGED IN ---
            if (userId) {
                try {
                    // Use .set with merge:true to create doc if it doesn't exist
                    await db.collection("users").doc(userId).set({
                        saved_emails: firebase.firestore.FieldValue.arrayUnion({
                            address: newEmail,
                            password: newPassword,
                            token: tokenData.token,
                            id: tokenData.id,
                            createdAt: new Date().toISOString()
                        })
                    }, { merge: true });
                    
                    console.log("Nebula: Sync successful for", userId);
                    showToast("<i class='fa-solid fa-cloud-arrow-up'></i> تم المزامنة مع حسابك بنجاح!");
                } catch (e) { 
                    console.error("Sync Error Detailed:", e); 
                }
            }

            showToast("<i class='fa-solid fa-check-circle'></i> جاهز للاستخدام!");
            if(customUsername) customUsername.value = ""; 
            checkInbox();
            startCountdown();

        } catch (error) {
            console.error(error);
            if(emailDisplay) emailDisplay.textContent = error.message === "NAME_TAKEN" ? "الاسم محجوز!" : "خطأ!";
            showToast("<i class='fa-solid fa-triangle-exclamation'></i> حدث خطأ أثناء الإنشاء.");
        }
    }

    async function checkInbox() {
        if (!authToken || !autoRefreshSpinner) return;
        try {
            autoRefreshSpinner.style.display = "block";
            const res = await fetch(`${API_BASE}/messages?page=1`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.status === 401) {
                clearSession();
                return;
            }
            const data = await res.json();
            const newMessages = data['hydra:member'] || [];
            messages = newMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // --- NEW: CLOUD ARCHIVING FOR MEMBERS ---
            if (userId && messages.length > 0) {
                archiveNewMessagesToCloud(messages);
            }

            renderMessagesList();
        } catch (error) { console.error(error); } finally {
            autoRefreshSpinner.style.display = "none";
        }
    }

    async function archiveNewMessagesToCloud(msgList) {
        if (!userId) return;
        msgList.forEach(async (msg) => {
            const msgDocId = `${userId}_${msg.id}`; // Unique ID per message per user
            const msgRef = db.collection("archived_messages").doc(msg.id);
            
            // Check if already archived to avoid redundant writes
            const snapshot = await msgRef.get();
            if (!snapshot.exists) {
                // Fetch full details (body) before archiving
                try {
                    const detailRes = await fetch(`${API_BASE}/messages/${msg.id}`, {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    const fullData = await detailRes.json();
                    
                    await msgRef.set({
                        userId: userId,
                        accountEmail: currentEmail,
                        msgId: msg.id,
                        from: fullData.from,
                        subject: fullData.subject,
                        html: fullData.html?.[0] || "",
                        text: fullData.text?.[0] || "",
                        createdAt: fullData.createdAt,
                        archivedAt: new Date().toISOString()
                    });
                    console.log("Cobra: Message archived to cloud:", msg.id);
                } catch(err) { console.error("Archive Error:", err); }
            }
        });
    }

    function renderMessagesList() {
        if(inboxCount) inboxCount.textContent = messages.length;
        if (!messagesContainer) return;
        if (messages.length === 0) {
            messagesContainer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>بانتظار الرسائل...</p></div>`;
            return;
        }
        messagesContainer.innerHTML = "";
        messages.forEach(msg => {
            const msgEl = document.createElement("div");
            msgEl.className = `msg-item ${selectedMessageId === msg.id ? 'active' : ''}`;
            msgEl.onclick = () => loadMessage(msg.id);
            const date = new Date(msg.createdAt);
            const timeStr = date.toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'});
            msgEl.innerHTML = `
                <div class="msg-item-header">
                    <div class="msg-item-sender">${escapeHTML(msg.from.name || msg.from.address)}</div>
                    <div class="msg-item-time">${timeStr}</div>
                </div>
                <div class="msg-item-subject">${escapeHTML(msg.subject) || "(بدون موضوع)"}</div>
            `;
            messagesContainer.appendChild(msgEl);
        });
    }

    async function loadMessage(id) {
        selectedMessageId = id;
        renderMessagesList(); 
        if(noMessageSelected) noMessageSelected.classList.add("hidden");
        if(msgDetailDisplay) msgDetailDisplay.classList.remove("hidden");
        
        if(msgBodyFrame) {
            const iframeDoc = msgBodyFrame.contentDocument || msgBodyFrame.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write('<body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;color:#999;background:#fff;">جاري تحميل...</body>');
            iframeDoc.close();
        }

        try {
            const res = await fetch(`${API_BASE}/messages/${id}`, {
                 headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const msgData = await res.json();
            if(msgSubject) msgSubject.textContent = msgData.subject || "(بدون موضوع)";
            if(msgSender) msgSender.textContent = msgData.from.name || 'مجهول';
            if(msgFromEmail) msgFromEmail.textContent = msgData.from.address;
            
            const avatarEl = document.getElementById("msgSenderAvatar");
            if(avatarEl) avatarEl.textContent = (msgData.from.name || msgData.from.address || "?")[0].toUpperCase();

            if(msgDate) msgDate.textContent = new Date(msgData.createdAt).toLocaleString('ar-EG');

            let htmlContent = msgData.html?.[0] || `<div style="white-space:pre-wrap;">${escapeHTML(msgData.text?.[0] || "الرسالة فارغة")}</div>`;
            
            if(msgBodyFrame) {
                const iframeDoc = msgBodyFrame.contentDocument || msgBodyFrame.contentWindow.document;
                iframeDoc.open();
                iframeDoc.write(`<head><style>body{font-family:sans-serif;padding:20px;color:#111;background:#fff;} img{max-width:100%;height:auto;}</style></head><body>${htmlContent}</body>`);
                iframeDoc.close();
            }
        } catch (error) { console.error(error); }
    }

    function hideMessageDetail() {
        if(noMessageSelected) noMessageSelected.classList.remove("hidden");
        if(msgDetailDisplay) msgDetailDisplay.classList.add("hidden");
        selectedMessageId = null;
    }

    function startAutoRefresh() {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        autoRefreshInterval = setInterval(() => checkInbox(), 10000);
    }

    async function fetchDomains() {
        if(!domainSelector) return;
        try {
            const res = await fetch(`${API_BASE}/domains`);
            const data = await res.json();
            if (data['hydra:member']) {
                domainSelector.innerHTML = ''; 
                data['hydra:member'].forEach(d => {
                    const opt = document.createElement("option");
                    opt.value = "@" + d.domain;
                    opt.textContent = "@" + d.domain;
                    domainSelector.appendChild(opt);
                });
            }
        } catch(e) { console.error(e); }
    }

    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(html) {
        let toast = document.getElementById("appToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "appToast";
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        toast.innerHTML = html;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 4000);
    }

    if(copyBtn) {
        copyBtn.addEventListener("click", () => {
            if (!currentEmail) return;
            navigator.clipboard.writeText(currentEmail).then(() => showToast("<i class='fa-solid fa-copy'></i> تم نسخ البريد!"));
        });
    }

    if(newEmailBtn) newEmailBtn.addEventListener("click", () => generateNewEmail());
    if(manualRefreshBtn) manualRefreshBtn.addEventListener("click", () => checkInbox());

    if(showPassBtn) {
        showPassBtn.addEventListener("click", () => {
            if (!currentPassword) return;
            if(revealedPassword) revealedPassword.textContent = currentPassword;
            if(passModal) passModal.classList.remove("hidden");
        });
    }
    if(closePassModalBtn) closePassModalBtn.addEventListener("click", () => passModal.classList.add("hidden"));
    if(copyPassBtn) {
        copyPassBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(currentPassword).then(() => showToast("<i class='fa-solid fa-copy'></i> تم نسخ كلمة المرور!"));
        });
    }

    if(openRestoreBtn) openRestoreBtn.addEventListener("click", () => restoreModal.classList.remove("hidden"));
    if(closeRestoreBtn) closeRestoreBtn.addEventListener("click", () => restoreModal.classList.add("hidden"));

    if(submitRestoreBtn) {
        submitRestoreBtn.addEventListener("click", async () => {
            const email = restoreEmailAddr.value.trim().toLowerCase();
            const pass = restoreEmailPass.value.trim();
            if(!email || !pass) return;
            submitRestoreBtn.disabled = true;
            try {
                const res = await fetch(`${API_BASE}/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: email, password: pass })
                });
                if(!res.ok) throw new Error("AuthFail");
                const data = await res.json();
                saveSession(email, pass, data.token);
                if(restoreModal) restoreModal.classList.add("hidden");
                checkInbox();
                showToast("<i class='fa-solid fa-plug-circle-check'></i> تم الاستعادة!");
            } catch(e) { showToast("<i class='fa-solid fa-xmark'></i> بيانات خاطئة."); }
            finally { submitRestoreBtn.disabled = false; }
        });
    }

    // Initial Load
    fetchDomains().then(() => {
        if (authToken && currentEmail && currentPassword) {
            if(emailDisplay) emailDisplay.textContent = currentEmail;
            checkInbox();
            startAutoRefresh();
            startCountdown();
        } else {
            generateNewEmail();
        }
    });
});
